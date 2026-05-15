/**
 * render-clinical-document/index.ts
 *
 * Supabase Edge Function — renders a clinical document template into a PDF.
 *
 * Flow:
 *   1. CORS preflight
 *   2. Auth: verify JWT → resolve staff doctor context
 *   3. Validate request body (document_id required)
 *   4. Load render context (contextLoader)
 *   5. Render PDF (pdfRenderer)
 *   6. Upload to storage
 *   7. Return { pdfUrl, contentHash }
 *
 * Security:
 *   - Requires authenticated staff (doctor role)
 *   - No PHI in console output
 *   - No patient name in storage path
 *   - Service role key stays server-side
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { loadRenderContext } from './contextLoader.ts';
import { renderPdf, API_VERSION } from './pdfRenderer.ts';
import { fetchLogo } from './logoFetch.js';

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
  return {
    'Access-Control-Allow-Origin': allowed.has(origin) ? origin : '',
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

// ── Storage bucket ───────────────────────────────────────────────

const STORAGE_BUCKET = 'clinical-documents';
const SIGNED_URL_TTL_SECONDS = 300;

// ── Handler ──────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req);
  const origin = req.headers.get('Origin') || '';

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
  let body: { document_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'INVALID_JSON', headers);
  }

  const documentId = typeof body.document_id === 'string' ? body.document_id.trim() : '';
  if (!documentId || !UUID_RE.test(documentId)) {
    return errorResponse(400, 'INVALID_REQUEST', headers);
  }

  // Create admin client
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify actor
  const { data: { user: actor }, error: actorErr } = await admin.auth.getUser(token);
  if (actorErr || !actor?.id) {
    return errorResponse(401, 'UNAUTHENTICATED', headers);
  }

  // Verify the actor is an active doctor
  const { data: actorProfile } = await admin
    .from('users')
    .select('id, role, is_active')
    .eq('auth_user_id', actor.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!actorProfile || actorProfile.role !== 'doctor') {
    return errorResponse(403, 'FORBIDDEN', headers);
  }

  // ── Load render context ──
  const { data: ctx, error: ctxError } = await loadRenderContext(admin, documentId);
  if (ctxError || !ctx) {
    const status = ctxError === 'DOCUMENT_NOT_FOUND' ? 404 : 500;
    return errorResponse(status, ctxError || 'CONTEXT_LOAD_FAILED', headers);
  }

  // ── Fetch logo (best-effort, never blocks render) ──
  // Logo is fetched but the current pdf-lib renderer embeds it in v2.
  // For v1, we attempt the fetch to validate the pipeline; the logo
  // bytes are available for embedding when that code path is added.
  const _logoBytes = await fetchLogo(ctx.brand.logoUrl);

  // ── Render PDF ──
  let pdfResult: Awaited<ReturnType<typeof renderPdf>>;
  try {
    pdfResult = await renderPdf(ctx);
  } catch (err) {
    const errName = err instanceof Error ? err.name : 'unknown';
    console.error('[render] render failed', { errName });
    return errorResponse(500, 'RENDER_FAILED', headers);
  }

  // ── Upload to storage ──
  const { error: uploadErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(pdfResult.storagePath, pdfResult.bytes, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadErr) {
    console.error('[render] upload failed', { code: uploadErr.message?.slice(0, 50) });
    return errorResponse(500, 'UPLOAD_FAILED', headers);
  }

  // ── Generate signed URL ──
  const { data: signedUrlData, error: signedUrlErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(pdfResult.storagePath, SIGNED_URL_TTL_SECONDS);

  if (signedUrlErr || !signedUrlData?.signedUrl) {
    console.error('[render] signed URL failed');
    return errorResponse(500, 'SIGNED_URL_FAILED', headers);
  }

  // ── Success ──
  return jsonResponse(
    {
      data: {
        pdfUrl: signedUrlData.signedUrl,
        storagePath: pdfResult.storagePath,
        contentHash: pdfResult.contentHash,
        apiVersion: API_VERSION,
      },
      error: null,
    },
    200,
    headers,
  );
});
