const LOGO_TIMEOUT_MS = 8000;
const LOGO_MAX_BYTES = 200 * 1024;
const LOGO_ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/svg+xml']);
const PRIVATE_RANGES_RE = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.|::1|0\.0\.0\.0)/;

/**
 * Best-effort logo fetch for clinical PDF rendering.
 *
 * The renderer must continue without a logo if the URL is unsafe, slow,
 * unavailable, too large, or not an allowed image type.
 */
export async function fetchLogo(url, options = {}) {
  if (!url || typeof url !== 'string') return null;

  const {
    fetchImpl = fetch,
    timeoutMs = LOGO_TIMEOUT_MS,
    log = (...args) => console.log(...args),
  } = options;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      log('[render] logo_skipped: protocol not https');
      return null;
    }

    if (PRIVATE_RANGES_RE.test(parsed.hostname)) {
      log('[render] logo_skipped: private range');
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await fetchImpl(url, {
        signal: controller.signal,
        headers: { Accept: 'image/png, image/jpeg, image/svg+xml' },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      log('[render] logo_skipped: non-200 response', { status: response.status });
      return null;
    }

    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() || '';
    if (!LOGO_ALLOWED_TYPES.has(contentType)) {
      log('[render] logo_skipped: unsupported content type');
      return null;
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > LOGO_MAX_BYTES) {
      log('[render] logo_skipped: exceeds 200KB limit');
      return null;
    }

    return new Uint8Array(buffer);
  } catch (err) {
    const reason = err instanceof Error ? err.name : 'unknown';
    log('[render] logo_skipped:', { reason });
    return null;
  }
}

export {
  LOGO_ALLOWED_TYPES,
  LOGO_MAX_BYTES,
  LOGO_TIMEOUT_MS,
  PRIVATE_RANGES_RE,
};
