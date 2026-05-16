/* global Deno */
/**
 * metrics.js — Fire-and-forget counter + latency emitter for the renderer.
 *
 * Why this lives inside the Edge Function and not in `packages/core/lib/`:
 *   The Deno deploy boundary cannot import packages/core at runtime. The
 *   API surface mirrors the canonical contract (a sibling module in
 *   packages/core/lib/metrics.js can ship later for browser-side counters)
 *   but the actual fetch lives here.
 *
 * The endpoint is configured via `RENDER_METRICS_ENDPOINT` env. When the
 * env is unset (local/dev/CI), every emission is a no-op so tests stay
 * deterministic and the function never leaks unsolicited requests.
 *
 * No PHI is ever sent. Outcomes are a closed enum, latency is an integer
 * millisecond count, and the optional tags carry only short hashes and
 * document type buckets — never names, content, or full ids.
 */

/** Closed enum mirroring index.ts log stages. */
export const RENDER_OUTCOMES = Object.freeze([
  'rendered',
  'cached',
  'timeout',
  'failed',
  'forbidden',
  'invalid',
  'over_budget',
]);

function endpoint() {
  return Deno.env.get('RENDER_METRICS_ENDPOINT') || '';
}

/**
 * Emit a single metrics line. Returns immediately — the actual fetch is
 * fire-and-forget so render latency is unaffected by collector slowness.
 */
export function emitRenderMetric(outcome, options = {}) {
  const url = endpoint();
  if (!url) return; // no-op in dev/test
  if (!RENDER_OUTCOMES.includes(outcome)) return;

  const payload = {
    kind: 'render_clinical_document',
    outcome,
    latencyMs: typeof options.latencyMs === 'number' ? Math.round(options.latencyMs) : null,
    byteSize: typeof options.byteSize === 'number' ? options.byteSize : null,
    documentType: typeof options.documentType === 'string' ? options.documentType : null,
    correlation: typeof options.correlation === 'string' ? options.correlation : null,
    apiVersion: typeof options.apiVersion === 'string' ? options.apiVersion : null,
    emittedAt: new Date().toISOString(),
  };

  // Fire-and-forget. AbortController caps the request at 2 s so a stuck
  // collector never holds the function's runtime back.
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .catch(() => { /* collector down — render must not be affected */ })
      .finally(() => clearTimeout(timeout));
  } catch {
    /* never throw out of the emitter */
  }
}
