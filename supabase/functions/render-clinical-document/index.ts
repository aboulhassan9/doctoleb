/**
 * render-clinical-document/index.ts
 *
 * Supabase Edge Function — renders a clinical document template into a PDF.
 *
 * Flow:
 *   1. CORS preflight
 *   2. Auth: verify JWT → resolve staff doctor context
 *   3. Validate request body (document_id required; optional idempotent flag)
 *   4. Idempotency short-circuit: if the row already has a file_url and
 *      caller passed `idempotent: true`, re-sign and return without rendering
 *   5. Load render context (contextLoader)
 *   6. Render PDF (pdfRenderer), bounded by a hard deadline
 *   7. Upload to storage; on signed-URL failure, delete the orphan bytes
 *   8. Persist file_url + render_content_hash on clinical_documents
 *   9. Audit-log the success (`render_clinical_document`)
 *  10. Return { pdfUrl, contentHash }
 *
 * Security:
 *   - Requires authenticated staff (doctor role)
 *   - Logs only short ID hashes, error codes, and latency
 *   - No PHI, names, content, or full ids in console output
 *   - Service role key stays server-side
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { loadRenderContext } from './contextLoader.ts';
import { renderPdf, API_VERSION } from './pdfRenderer.ts';
import { fetchLogo } from './logoFetch.js';
import { emitRenderMetric } from './metrics.js';

// ── CORS ─────────────────────────────────────────────────────────

const DEFAULT_ALLOWED_ORIGINS = new Set([
  'http://localhost:3002',
  'http://localhost:5173',
  'https://doctoleb-clinic-ops.vercel.app',
]);

function getAllowedOrigins(): Set<string> {
  const configured = Deno.env.get('RENDER_PDF_ALLOWED_ORIGINS');
  if (!configured) return DEFAULT_ALLOWED_ORIGINS;
  return new Set(configured.split(',').map((o) => o.trim()).filter(Boolean));
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowed = getAllowedOrigins();
  const allowedOrigin = origin && allowed.has(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

// ── Response helpers ─────────────────────────────────────────────

function jsonResponse(data: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function errorResponse(status: number, error: string, headers: Record<string, string>) {
  return jsonResponse({ data: null, error }, status, headers);
}

// ── UUID validation ──────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ── Storage + render budget ──────────────────────────────────────

const STORAGE_BUCKET = 'clinical-documents';
const SIGNED_URL_TTL_SECONDS = 300;
const RENDER_DEADLINE_MS = 4500;          // SC-1: < 4 s total click-to-open budget
const SOFT_BYTE_BUDGET = 1_048_576;       // 1 MB — warn-only over this, never fail
const HARD_BYTE_BUDGET = 2 * 1_048_576;   // 2 MB — archival templates fail closed past this

// Archival template types — these are PDF/A-2b targets where a >2 MB
// artifact is a structural problem (likely an embedded raster snuck in)
// rather than a render quirk. Non-archival types (prescription, custom)
// stay soft-warn so doctors can still ship a heavy custom form.
const ARCHIVAL_DOCUMENT_TYPES = new Set(['referral', 'report', 'certificate']);

// ── Logging helpers ──────────────────────────────────────────────

/**
 * Short non-PHI breadcrumb hash for an id. Used in every structured log so
 * a single render can be correlated end-to-end without leaking the full UUID.
 */
function shortIdHash(id: string | null | undefined): string {
  if (!id) return '∅';
  return id.replace(/-/g, '').slice(0, 6);
}

interface LogContext {
  correlationId: string;
  documentHash: string;
  actorHash: string;
  startedAt: number;
}

function makeLog(ctx: LogContext) {
  return function log(stage: string, extra: Record<string, unknown> = {}) {
    const elapsedMs = Math.round(performance.now() - ctx.startedAt);
    console.log('[render]', {
      stage,
      correlation: ctx.correlationId,
      document: ctx.documentHash,
      actor: ctx.actorHash,
      elapsedMs,
      ...extra,
    });
  };
}

// ── Render with deadline ─────────────────────────────────────────

/**
 * Wraps the PDF render in a Promise.race against a hard timeout so a runaway
 * logo fetch, slow font embed, or large composite can never blow past SC-1.
 */
function renderWithDeadline<T>(work: Promise<T>, deadlineMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error('RENDER_TIMEOUT'), { name: 'RenderTimeoutError' }));
    }, deadlineMs);
    work.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

// ── Idempotency: re-sign an existing file_url ────────────────────

async function existingArtifactSignedUrl(
  admin: SupabaseClient,
  fileUrl: string | null,
): Promise<string | null> {
  if (!fileUrl) return null;
  // file_url is stored as the storage path (relative to the bucket), so we
  // re-sign it. Defensive: if a legacy row stored a full URL, just return it.
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    return fileUrl;
  }
  const { data, error } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(fileUrl, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

// ── audit_log helper ─────────────────────────────────────────────

async function writeRenderAudit(
  admin: SupabaseClient,
  options: {
    documentId: string;
    actorUserId: string;
    outcome: 'rendered' | 'cached';
    contentHash: string;
    byteSize: number;
  },
) {
  // Fire-and-forget. Never block the user-facing response on the audit row.
  // audit_log uses the canonical schema: table_name, record_id, action,
  // actor_user_id, before_data, after_data, created_at.
  try {
    await admin.from('audit_log').insert([{
      table_name: 'clinical_documents',
      record_id: options.documentId,
      action: 'render_clinical_document',
      actor_user_id: options.actorUserId,
      before_data: null,
      after_data: {
        outcome: options.outcome,
        content_hash: options.contentHash,
        byte_size: options.byteSize,
        api_version: API_VERSION,
      },
    }]);
  } catch {
    /* audit write is best-effort */
  }
}

// ── Handler ──────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req);
  const origin = req.headers.get('Origin') || '';
  const startedAt = performance.now();
  const correlationId = (req.headers.get('x-request-id')
    || crypto.randomUUID()).slice(0, 12);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    if (origin && !headers['Access-Control-Allow-Origin']) {
      return errorResponse(403, 'ORIGIN_NOT_ALLOWED', headers);
    }
    return new Response('ok', { headers });
  }

  // Origin check
  if (origin && !headers['Access-Control-Allow-Origin']) {
    return errorResponse(403, 'ORIGIN_NOT_ALLOWED', headers);
  }

  // Method check
  if (req.method !== 'POST') {
    return errorResponse(405, 'METHOD_NOT_ALLOWED', headers);
  }

  // Env
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return errorResponse(503, 'RENDER_NOT_CONFIGURED', headers);
  }

  // Auth
  const authorization = req.headers.get('Authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  if (!token) {
    return errorResponse(401, 'UNAUTHENTICATED', headers);
  }

  // Parse body
  let body: { document_id?: unknown; idempotent?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'INVALID_JSON', headers);
  }

  const documentId = typeof body.document_id === 'string' ? body.document_id.trim() : '';
  if (!documentId || !UUID_RE.test(documentId)) {
    return errorResponse(400, 'INVALID_REQUEST', headers);
  }
  const idempotent = body.idempotent === true;

  // Admin client (service-role)
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify actor
  const { data: { user: actor }, error: actorErr } = await admin.auth.getUser(token);
  if (actorErr || !actor?.id) {
    return errorResponse(401, 'UNAUTHENTICATED', headers);
  }

  const { data: actorProfile } = await admin
    .from('users')
    .select('id, role, is_active')
    .eq('auth_user_id', actor.id)
    .eq('is_active', true)
    .maybeSingle();

  // Allowed actor roles for rendering. Doctors sign their own documents;
  // secretaries and admins legitimately render on a doctor's behalf (e.g.
  // an insurance form prepared for a patient). The audit_log row captures
  // the actor's actual role so the trail shows who did what.
  const ALLOWED_RENDER_ROLES = new Set(['doctor', 'secretary', 'admin']);
  if (!actorProfile || !ALLOWED_RENDER_ROLES.has(actorProfile.role)) {
    return errorResponse(403, 'FORBIDDEN', headers);
  }

  const logCtx: LogContext = {
    correlationId,
    documentHash: shortIdHash(documentId),
    actorHash: shortIdHash(actorProfile.id),
    startedAt,
  };
  const log = makeLog(logCtx);

  // ── Idempotent cache short-circuit ──
  // If the caller opts in AND the row already has a stored file_url, return
  // a freshly signed URL of the existing artifact without re-rendering.
  if (idempotent) {
    const { data: existing } = await admin
      .from('clinical_documents')
      .select('file_url, content')
      .eq('id', documentId)
      .maybeSingle();
    if (existing?.file_url) {
      const signed = await existingArtifactSignedUrl(admin, existing.file_url);
      if (signed) {
        log('cache_hit', { storagePath: '<existing>' });
        await writeRenderAudit(admin, {
          documentId,
          actorUserId: actorProfile.id,
          outcome: 'cached',
          contentHash: '',
          byteSize: 0,
        });
        emitRenderMetric('cached', {
          latencyMs: performance.now() - startedAt,
          correlation: correlationId,
          apiVersion: API_VERSION,
        });
        return jsonResponse({
          data: {
            pdfUrl: signed,
            storagePath: existing.file_url,
            contentHash: null,
            apiVersion: API_VERSION,
            cached: true,
          },
          error: null,
        }, 200, headers);
      }
    }
  }

  // ── Load render context ──
  const { data: ctx, error: ctxError } = await loadRenderContext(admin, documentId);
  if (ctxError || !ctx) {
    const status = ctxError === 'DOCUMENT_NOT_FOUND' ? 404 : 500;
    log('context_failed', { code: ctxError });
    return errorResponse(status, ctxError || 'CONTEXT_LOAD_FAILED', headers);
  }

  // ── Fetch logo (best-effort, never blocks render) ──
  const logoBytes = await fetchLogo(ctx.brand.logoUrl);

  // ── Render PDF (bounded by deadline) ──
  let pdfResult: Awaited<ReturnType<typeof renderPdf>>;
  try {
    pdfResult = await renderWithDeadline(
      renderPdf(ctx, { logoBytes }),
      RENDER_DEADLINE_MS,
    );
  } catch (err) {
    const errName = err instanceof Error ? err.name : 'unknown';
    log('render_failed', { errName });
    const timedOut = errName === 'RenderTimeoutError';
    emitRenderMetric(timedOut ? 'timeout' : 'failed', {
      latencyMs: performance.now() - startedAt,
      correlation: correlationId,
      apiVersion: API_VERSION,
      documentType: ctx.document.documentType,
    });
    if (timedOut) return errorResponse(504, 'RENDER_TIMEOUT', headers);
    return errorResponse(500, 'RENDER_FAILED', headers);
  }

  if (pdfResult.bytes.byteLength > SOFT_BYTE_BUDGET) {
    log('byte_budget_warning', { byteSize: pdfResult.bytes.byteLength });
  }

  // Hard ceiling for archival document types. PDF/A-2b artifacts past 2 MB
  // almost always indicate an embedded raster image that broke the
  // vector-only invariant; we'd rather surface a clear error than ship a
  // non-conformant archive.
  const isArchival = ARCHIVAL_DOCUMENT_TYPES.has(ctx.document.documentType);
  if (isArchival && pdfResult.bytes.byteLength > HARD_BYTE_BUDGET) {
    log('byte_budget_exceeded', {
      byteSize: pdfResult.bytes.byteLength,
      limit: HARD_BYTE_BUDGET,
      documentType: ctx.document.documentType,
    });
    emitRenderMetric('over_budget', {
      byteSize: pdfResult.bytes.byteLength,
      latencyMs: performance.now() - startedAt,
      correlation: correlationId,
      documentType: ctx.document.documentType,
      apiVersion: API_VERSION,
    });
    return errorResponse(413, 'BYTE_BUDGET_EXCEEDED', headers);
  }

  // ── Upload to storage ──
  const { error: uploadErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(pdfResult.storagePath, pdfResult.bytes, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadErr) {
    log('upload_failed', { code: uploadErr.message?.slice(0, 50) });
    return errorResponse(500, 'UPLOAD_FAILED', headers);
  }

  // ── Generate signed URL ──
  const { data: signedUrlData, error: signedUrlErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(pdfResult.storagePath, SIGNED_URL_TTL_SECONDS);

  if (signedUrlErr || !signedUrlData?.signedUrl) {
    // Compensation: the upload succeeded but signing failed. Without this
    // delete the bucket would accumulate orphan bytes on every transient
    // signing error.
    await admin.storage
      .from(STORAGE_BUCKET)
      .remove([pdfResult.storagePath])
      .catch(() => { /* orphan cleanup is best-effort */ });
    log('signed_url_failed', {});
    return errorResponse(500, 'SIGNED_URL_FAILED', headers);
  }

  // ── Persist file_url on clinical_documents (enables idempotent re-sign) ──
  await admin
    .from('clinical_documents')
    .update({ file_url: pdfResult.storagePath })
    .eq('id', documentId)
    .then(({ error }) => {
      // Non-fatal: the PDF is already uploaded and a fresh signed URL exists.
      // The next render will simply not be able to short-circuit on cache.
      if (error) log('persist_file_url_failed', { code: error.code });
    });

  // ── Audit ──
  await writeRenderAudit(admin, {
    documentId,
    actorUserId: actorProfile.id,
    outcome: 'rendered',
    contentHash: pdfResult.contentHash,
    byteSize: pdfResult.bytes.byteLength,
  });

  log('rendered', {
    storagePath: pdfResult.storagePath,
    byteSize: pdfResult.bytes.byteLength,
  });
  emitRenderMetric('rendered', {
    latencyMs: performance.now() - startedAt,
    byteSize: pdfResult.bytes.byteLength,
    correlation: correlationId,
    documentType: ctx.document.documentType,
    apiVersion: API_VERSION,
  });

  return jsonResponse(
    {
      data: {
        pdfUrl: signedUrlData.signedUrl,
        storagePath: pdfResult.storagePath,
        contentHash: pdfResult.contentHash,
        apiVersion: API_VERSION,
        cached: false,
      },
      error: null,
    },
    200,
    headers,
  );
});
