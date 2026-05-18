/**
 * render-analytical-report-pdf — Supabase Edge Function (Deno). Review FEAT-6.
 *
 * Renders a doctor-built analytical report (its result rows + definition)
 * into a branded PDF using pdf-lib.
 *
 * Design:
 *   - Pure renderer. The CLIENT sends the already-computed result rows, the
 *     report definition, and friendly column labels. The function does NOT
 *     touch the database — so it needs no service-role key and there is no
 *     RLS surface here. The Supabase platform still gates the endpoint to
 *     authenticated callers via JWT verification.
 *   - Keeping pdf-lib server-side keeps it out of the clinic-ops browser
 *     bundle, which is already large.
 *   - The response is the PDF as base64 inside the standard { data, error }
 *     envelope so the browser can decode and download it.
 *
 * Deploy: `supabase functions deploy render-analytical-report-pdf`.
 */

import { renderReportPdf } from './pdfReport.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/** Chunked base64 — avoids a call-stack overflow on large byte arrays. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function sanitizeFilename(name: string): string {
  const slug = String(name || 'report')
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  return `${slug || 'report'}.pdf`;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ data: null, error: 'METHOD_NOT_ALLOWED' }, 405);
  }
  if (!req.headers.get('Authorization')) {
    return jsonResponse({ data: null, error: 'NOT_AUTHORIZED' }, 401);
  }

  let payload: {
    report_name?: string;
    tenant_name?: string;
    definition?: Record<string, unknown>;
    rows?: Array<Record<string, unknown>>;
    column_labels?: Record<string, string>;
    filter_summary?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ data: null, error: 'INVALID_REQUEST' }, 400);
  }

  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  // A hard ceiling — analytical result_summary sets are aggregated and small;
  // anything past this is a misuse, not a real report.
  if (rows.length > 5000) {
    return jsonResponse({ data: null, error: 'TOO_MANY_ROWS' }, 413);
  }

  const reportName = typeof payload?.report_name === 'string' && payload.report_name.trim()
    ? payload.report_name.trim()
    : 'Analytical report';

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await renderReportPdf({
      reportName,
      tenantName: typeof payload?.tenant_name === 'string' ? payload.tenant_name : '',
      definition: (payload?.definition && typeof payload.definition === 'object')
        ? payload.definition
        : {},
      rows,
      columnLabels: (payload?.column_labels && typeof payload.column_labels === 'object')
        ? payload.column_labels
        : {},
      filterSummary: typeof payload?.filter_summary === 'string' ? payload.filter_summary : '',
      generatedAt: new Date(),
    });
  } catch (_err) {
    return jsonResponse({ data: null, error: 'RENDER_FAILED' }, 500);
  }

  return jsonResponse({
    data: { pdfBase64: bytesToBase64(pdfBytes), filename: sanitizeFilename(reportName) },
    error: null,
  });
});
