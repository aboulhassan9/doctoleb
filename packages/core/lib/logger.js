import { isRuntimeDev } from './env.js';

const SAFE_TAG_KEYS = Object.freeze(new Set([
  'tenantId',
  'tenantSlug',
  'surface',
  'route',
  'featureCode',
  'appVersion',
]));

const SENSITIVE_KEY_PATTERN = /(password|token|secret|key|email|phone|name|diagnosis|message|note|document|content|reason|address|birth|medical|patient)/i;

let monitoringSink = null;

function safeTags(meta = {}) {
  const tags = {};
  for (const key of SAFE_TAG_KEYS) {
    if (meta[key] !== undefined && meta[key] !== null) {
      tags[key] = String(meta[key]).slice(0, 160);
    }
  }
  return tags;
}

function safeExtra(meta = {}) {
  const extra = {};
  for (const [key, value] of Object.entries(meta)) {
    if (SAFE_TAG_KEYS.has(key)) continue;
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      extra[key] = '[redacted]';
      continue;
    }
    if (value === null || value === undefined) {
      extra[key] = value;
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      extra[key] = value;
    } else {
      extra[key] = '[object]';
    }
  }
  return extra;
}

function normalizeError(error) {
  if (error instanceof Error) return error;
  return new Error(typeof error === 'string' ? error : 'Unknown error');
}

export function buildSafeMonitoringContext(meta = {}) {
  return {
    tags: safeTags(meta),
    extra: safeExtra(meta),
  };
}

export function configureMonitoringSink(sink) {
  monitoringSink = typeof sink === 'function' ? sink : null;
}

export function logError(context, error, meta = {}) {
  const safeContext = buildSafeMonitoringContext({ ...meta, context });
  const normalizedError = normalizeError(error);

  if (isRuntimeDev()) {
    console.error(`[ERROR][${context}]`, normalizedError, safeContext);
  }

  if (monitoringSink) {
    monitoringSink('error', context, normalizedError, safeContext);
  }
}

export function logWarn(context, message, meta = {}) {
  const safeContext = buildSafeMonitoringContext({ ...meta, context });

  if (isRuntimeDev()) {
    console.warn(`[WARN][${context}]`, message, safeContext);
  }

  if (monitoringSink) {
    monitoringSink('warn', context, message, safeContext);
  }
}

export function logInfo(context, message, data = {}) {
  const safeContext = buildSafeMonitoringContext({ ...data, context });

  if (isRuntimeDev()) {
    console.info(`[INFO][${context}]`, message, safeContext);
  }

  if (monitoringSink) {
    monitoringSink('info', context, message, safeContext);
  }
}
