/**
 * Structured logging utility — replaces raw console.error() in pages.
 *
 * DEV:  Logs to console with context tags.
 * PROD: Silent (future hook for Sentry/LogRocket/Datadog).
 *
 * USAGE:
 *   import { logError, logWarn, logInfo } from '@/lib/logger';
 *   catch (err) { logError('AppointmentsPage.fetch', err); }
 */

const isDev = import.meta.env.DEV;

/**
 * Log an error with context tag.
 * @param {string} context - Where the error happened, e.g. 'usePatients.fetch'
 * @param {Error|string} error - The error object or message
 * @param {Record<string, unknown>} [meta] - Optional metadata for monitoring
 */
export function logError(context, error, meta = {}) {
  if (isDev) {
    console.error(`[ERROR][${context}]`, error, meta);
  }
  // Future: Sentry.captureException(error, { tags: { context }, extra: meta });
}

/**
 * Log a warning (non-fatal issues).
 * @param {string} context
 * @param {string} message
 */
export function logWarn(context, message) {
  if (isDev) {
    console.warn(`[WARN][${context}]`, message);
  }
}

/**
 * Log info for debugging (dev only, never in prod).
 * @param {string} context
 * @param {string} message
 * @param {Record<string, unknown>} [data]
 */
export function logInfo(context, message, data) {
  if (isDev) {
    console.info(`[INFO][${context}]`, message, data ?? '');
  }
}
