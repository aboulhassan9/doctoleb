/**
 * Shared service-layer helpers.
 *
 * These micro-functions standardize the { data, error } response contract
 * used across all services. Previously duplicated in 11 service files.
 */
import { parseWithSchema } from '../schemas/index.js';

/**
 * Return a standard validation-error envelope.
 * @param {string} error - Human-readable error message.
 * @returns {{ data: null, error: string }}
 */
export function validationError(error) {
  return { data: null, error };
}

/**
 * Parse a payload against a Zod schema and return the standard envelope.
 * Wraps `parseWithSchema` for consistent use across services.
 * @param {import('zod').ZodSchema} schema
 * @param {unknown} payload
 * @returns {{ data?: unknown, error?: string }}
 */
export function parse(schema, payload) {
  const result = parseWithSchema(schema, payload);
  if (result.error) {
    return { error: result.error };
  }
  return { data: result.data };
}
