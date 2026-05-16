/**
 * analyticalReportService — CRUD + run pipeline for doctor-built reports.
 *
 * Architectural notes:
 *   - The "definition" is a closed-set JSON document (see
 *     `packages/core/schemas/analyticalReports.js`). The service compiles
 *     it to a safe supabase-js chain — there is no SQL-string concatenation
 *     in this file, and the only RPC it calls is the closed-set
 *     `run_analytical_report` function (added in the next slice).
 *   - Versions are immutable once published. The service publishes a new
 *     version when the doctor edits and saves; the old version stays
 *     queryable so an old "run history" entry can re-run with the
 *     original logic.
 *   - All reads/writes go through `apiCall` / `apiPaged` so the error
 *     contract stays uniform across services (CLAUDE.md rule 1).
 *
 * Compile / run path (slice-2):
 *   The service will gain `runByReportId(reportId, filterArgs)` and
 *   `runByVersionId(versionId, filterArgs)` once the matching
 *   `run_analytical_report(...)` RPC lands. That RPC takes the validated
 *   definition JSON + filter_args and returns a `setof jsonb` of
 *   aggregated rows. The RPC runs SECURITY INVOKER so RLS still applies
 *   to whichever underlying clinical/financial table the report scans.
 */

import { supabase } from '../lib/supabase.js';
import { validationError, parse } from '../lib/serviceHelpers.js';
import {
  ANALYTICAL_REPORT_SELECT_FIELDS,
  ANALYTICAL_REPORT_VERSION_SELECT_FIELDS,
  ANALYTICAL_REPORT_RUN_SELECT_FIELDS,
} from '../lib/selects.js';
import {
  analyticalReportDefinitionSchema,
  analyticalReportCreateSchema,
  analyticalReportVersionCreateSchema,
  analyticalReportRunRequestSchema,
} from '../schemas/analyticalReports.js';
import { apiCall, apiPaged } from './api.js';

// ── Canonical serialization for the checksum ────────────────────────

/**
 * Deterministic JSON stringify — same shape as the one used by
 * reportDefinitions.js for clinical-document versions. Sorting keys means
 * two semantically-equivalent definitions produce the same SHA-256, so a
 * round-trip through the editor never appears as a "new version" unless
 * the doctor actually changed something.
 */
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(',')}}`;
}

function bytesToHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createReportDefinitionChecksum(definition) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto SHA-256 is required to checksum report definitions.');
  }
  const encoded = new TextEncoder().encode(stableStringify(definition));
  return bytesToHex(await subtle.digest('SHA-256', encoded));
}

// ── Internal helper: build the version-insert payload ──────────────

async function buildVersionInsertPayload(payload) {
  const parsedDef = parse(analyticalReportDefinitionSchema, payload?.definition);
  if (parsedDef.error) return validationError(parsedDef.error);

  let checksum;
  try {
    checksum = await createReportDefinitionChecksum(parsedDef.data);
  } catch (err) {
    return validationError(err?.message || 'Report checksum failed.');
  }

  if (payload.definition_checksum && payload.definition_checksum !== checksum) {
    return validationError('Report definition checksum does not match the canonical definition.');
  }

  const parsed = parse(analyticalReportVersionCreateSchema, {
    ...payload,
    definition: parsedDef.data,
    definition_checksum: checksum,
  });
  if (parsed.error) return validationError(parsed.error);

  return {
    data: {
      ...parsed.data,
      published_at: parsed.data.status === 'published' ? new Date().toISOString() : null,
    },
    error: null,
  };
}

// ── Service surface ─────────────────────────────────────────────────

export const analyticalReportService = {
  /**
   * List all visible reports. RLS scopes to staff visibility automatically.
   */
  async list({ category = null, includeArchived = false, page = 1, pageSize = 25 } = {}) {
    let query = supabase
      .from('analytical_reports')
      .select(ANALYTICAL_REPORT_SELECT_FIELDS, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (category) query = query.eq('category', category);
    if (!includeArchived) query = query.eq('is_archived', false);

    return apiPaged(query, { page, pageSize });
  },

  async getById(id) {
    if (!id) return validationError('Report id is required.');
    return apiCall(
      supabase
        .from('analytical_reports')
        .select(ANALYTICAL_REPORT_SELECT_FIELDS)
        .eq('id', id)
        .single(),
    );
  },

  async create(payload) {
    const parsed = parse(analyticalReportCreateSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('analytical_reports')
        .insert([parsed.data])
        .select(ANALYTICAL_REPORT_SELECT_FIELDS)
        .single(),
    );
  },

  /**
   * Update a report's catalog metadata (name / description / category /
   * audience). RLS restricts this to the author or an admin. The
   * definition itself is NOT edited here — that goes through
   * `publishNewVersion` so the version history stays immutable.
   */
  async update(id, patch) {
    if (!id) return validationError('Report id is required.');
    if (!patch || typeof patch !== 'object') return validationError('Patch object is required.');

    const ALLOWED = ['name', 'description', 'category', 'audience'];
    const filtered = {};
    for (const key of ALLOWED) {
      if (key in patch) filtered[key] = patch[key];
    }
    if (Object.keys(filtered).length === 0) {
      return validationError('No allowed fields in patch.');
    }

    return apiCall(
      supabase
        .from('analytical_reports')
        .update(filtered)
        .eq('id', id)
        .select(ANALYTICAL_REPORT_SELECT_FIELDS)
        .single(),
    );
  },

  async archive(id, archivedBy) {
    if (!id) return validationError('Report id is required.');
    if (!archivedBy) return validationError('archivedBy is required.');

    return apiCall(
      supabase
        .from('analytical_reports')
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by: archivedBy,
        })
        .eq('id', id)
        .select(ANALYTICAL_REPORT_SELECT_FIELDS)
        .single(),
    );
  },

  // ── Versions ──

  async listVersions(reportId, { includeArchived = false, page = 1, pageSize = 25 } = {}) {
    if (!reportId) return validationError('Report id is required.');

    let query = supabase
      .from('analytical_report_versions')
      .select(ANALYTICAL_REPORT_VERSION_SELECT_FIELDS, { count: 'exact' })
      .eq('report_id', reportId)
      .order('version_number', { ascending: false });

    if (!includeArchived) query = query.neq('status', 'archived');

    return apiPaged(query, { page, pageSize });
  },

  async getCurrentVersion(reportId) {
    if (!reportId) return validationError('Report id is required.');

    return apiCall(
      supabase
        .from('analytical_report_versions')
        .select(ANALYTICAL_REPORT_VERSION_SELECT_FIELDS)
        .eq('report_id', reportId)
        .eq('status', 'published')
        .eq('is_current', true)
        .maybeSingle(),
    );
  },

  async createVersion(payload) {
    const built = await buildVersionInsertPayload(payload);
    if (built.error) return built;

    return apiCall(
      supabase
        .from('analytical_report_versions')
        .insert([built.data])
        .select(ANALYTICAL_REPORT_VERSION_SELECT_FIELDS)
        .single(),
    );
  },

  /**
   * Publish a new version of a report as the current one.
   *
   * Used by the editor for BOTH "save a brand-new report" (version 1) and
   * "save an edit to an existing report" (version N+1). The flow:
   *   1. Find the highest existing version_number.
   *   2. Supersede the current published version — flip `is_current` to
   *      false + `status` to 'superseded'. This must happen BEFORE the
   *      insert because the partial unique index allows only one
   *      `is_current = true AND status = 'published'` row per report.
   *   3. Insert the new version as published + current.
   *
   * There is a small window between step 2 and step 3 where the report
   * has no current version. The partial unique index still guarantees
   * correctness — a true concurrent publish loses the insert race and the
   * caller simply retries. Atomicity-via-RPC is a deliberate follow-up if
   * concurrent editing of one report ever becomes common.
   */
  async publishNewVersion(reportId, definition, { publishedBy } = {}) {
    if (!reportId) return validationError('Report id is required.');
    if (!publishedBy) return validationError('publishedBy is required.');

    const { data: latest, error: latestErr } = await supabase
      .from('analytical_report_versions')
      .select('version_number')
      .eq('report_id', reportId)
      .order('version_number', { ascending: false })
      .limit(1);
    if (latestErr) return { data: null, error: latestErr.message };
    const nextVersionNumber = (latest?.[0]?.version_number || 0) + 1;

    const { data: current, error: currentErr } = await supabase
      .from('analytical_report_versions')
      .select('id')
      .eq('report_id', reportId)
      .eq('status', 'published')
      .eq('is_current', true)
      .maybeSingle();
    if (currentErr) return { data: null, error: currentErr.message };

    if (current?.id) {
      const { error: supersedeErr } = await supabase
        .from('analytical_report_versions')
        .update({ is_current: false, status: 'superseded' })
        .eq('id', current.id);
      if (supersedeErr) return { data: null, error: supersedeErr.message };
    }

    return analyticalReportService.createVersion({
      report_id: reportId,
      version_number: nextVersionNumber,
      status: 'published',
      is_current: true,
      definition,
      created_by: publishedBy,
      published_by: publishedBy,
    });
  },

  // ── Runs ──

  /**
   * Persist a run row in `analytical_report_runs`. The actual SQL
   * execution lives in the closed-set `run_analytical_report` RPC that
   * the next slice adds — for now this method validates the request shape
   * and writes a `queued` row so the UI has something to render while
   * the engine is wired up.
   */
  async queueRun(payload) {
    const parsed = parse(analyticalReportRunRequestSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    // Resolve the version_id to use. Caller passes either report_id (we
    // look up the current published version) or an explicit version_id.
    let versionId = parsed.data.version_id;
    let reportId = null;

    if (versionId) {
      const { data: version, error: versionErr } = await supabase
        .from('analytical_report_versions')
        .select('id, report_id, status')
        .eq('id', versionId)
        .maybeSingle();
      if (versionErr) return { data: null, error: versionErr.message };
      if (!version) return validationError('Report version not found.');
      reportId = version.report_id;
    } else {
      const { data: current, error: currentErr } = await supabase
        .from('analytical_report_versions')
        .select('id, report_id')
        .eq('report_id', parsed.data.report_id)
        .eq('status', 'published')
        .eq('is_current', true)
        .maybeSingle();
      if (currentErr) return { data: null, error: currentErr.message };
      if (!current) return validationError('Report has no current published version.');
      versionId = current.id;
      reportId = current.report_id;
    }

    return apiCall(
      supabase
        .from('analytical_report_runs')
        .insert([{
          report_id: reportId,
          version_id: versionId,
          filter_args: parsed.data.filter_args ?? {},
          requested_by: parsed.data.requested_by,
          status: 'queued',
        }])
        .select(ANALYTICAL_REPORT_RUN_SELECT_FIELDS)
        .single(),
    );
  },

  async getRunById(id) {
    if (!id) return validationError('Run id is required.');
    return apiCall(
      supabase
        .from('analytical_report_runs')
        .select(ANALYTICAL_REPORT_RUN_SELECT_FIELDS)
        .eq('id', id)
        .single(),
    );
  },

  async listMyRuns({ reportId = null, page = 1, pageSize = 25 } = {}) {
    let query = supabase
      .from('analytical_report_runs')
      .select(ANALYTICAL_REPORT_RUN_SELECT_FIELDS, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (reportId) query = query.eq('report_id', reportId);

    return apiPaged(query, { page, pageSize });
  },

  /**
   * Execute an ad-hoc definition (e.g. the editor's "Preview" button).
   * Validates the definition locally, then calls the SECURITY INVOKER
   * `run_analytical_report` RPC which compiles + runs the query as the
   * logged-in user. RLS still scopes the underlying clinical/financial
   * rows.
   *
   * Returns `{ data: { rows: object[] }, error }`. `rows` is the
   * aggregated result_summary array — small enough that the caller can
   * hand it straight to a chart component without further paging.
   */
  async runDefinition(definition, filterArgs = {}) {
    const parsedDef = parse(analyticalReportDefinitionSchema, definition);
    if (parsedDef.error) return validationError(parsedDef.error);

    const { data, error } = await apiCall(
      supabase.rpc('run_analytical_report', {
        p_definition: parsedDef.data,
        p_filter_args: filterArgs || {},
      }),
    );
    if (error) return { data: null, error };

    // The RPC returns `setof jsonb` — Supabase delivers it as an array of
    // JSON objects. Normalize the envelope so callers always get
    // `{ rows: [...] }` regardless of empty / single-row shape.
    const rows = Array.isArray(data)
      ? data
      : data && typeof data === 'object'
        ? [data]
        : [];
    return { data: { rows }, error: null };
  },

  /**
   * Run a saved report by id. Resolves the current published version,
   * persists a `succeeded` row in `analytical_report_runs` capturing the
   * result_summary + latency, and returns the same envelope as
   * `runDefinition()`. Failures persist a `failed` row with a safe
   * error summary — never a raw stack trace.
   */
  async runByReport(reportId, filterArgs = {}, { requestedBy } = {}) {
    if (!reportId) return validationError('Report id is required.');
    if (!requestedBy) return validationError('requestedBy is required.');

    const { data: version, error: versionErr } = await supabase
      .from('analytical_report_versions')
      .select('id, report_id, definition')
      .eq('report_id', reportId)
      .eq('status', 'published')
      .eq('is_current', true)
      .maybeSingle();

    if (versionErr) return { data: null, error: versionErr.message };
    if (!version) return validationError('Report has no current published version.');

    const startedAt = Date.now();
    const runResult = await analyticalReportService.runDefinition(
      version.definition,
      filterArgs,
    );
    const latencyMs = Date.now() - startedAt;

    // Best-effort run ledger write. We never block the caller on it.
    const ledgerPayload = {
      report_id: reportId,
      version_id: version.id,
      filter_args: filterArgs || {},
      requested_by: requestedBy,
      latency_ms: latencyMs,
      started_at: new Date(startedAt).toISOString(),
      completed_at: new Date().toISOString(),
    };

    if (runResult.error) {
      void supabase.from('analytical_report_runs').insert([{
        ...ledgerPayload,
        status: 'failed',
        safe_error_summary: String(runResult.error).slice(0, 500),
      }]).then(
        () => {},
        (ledgerErr) => console.error('[analyticalReports] failed-run ledger write failed:', ledgerErr?.message || ledgerErr),
      );
      return runResult;
    }

    void supabase.from('analytical_report_runs').insert([{
      ...ledgerPayload,
      status: 'succeeded',
      result_summary: { rows: runResult.data.rows },
      scanned_row_estimate: runResult.data.rows.length,
    }]).then(
      () => {},
      (ledgerErr) => console.error('[analyticalReports] succeeded-run ledger write failed:', ledgerErr?.message || ledgerErr),
    );

    return runResult;
  },
};
