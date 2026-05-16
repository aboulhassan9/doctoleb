/**
 * composite.js — Pure helpers for the doctor-built custom-field primitive.
 *
 * `composite_text` field type carries a `template` string with placeholders:
 *
 *   {{patient.full_name}} — born {{patient.date_of_birth}}
 *
 * These helpers are imported by:
 *   - the schema (`packages/core/schemas/documentTemplates.js`) for validation
 *   - the editor preview (`apps/clinic-ops/src/components/templates/*`)
 *   - the Edge Function renderer (which mirrors the substitution rules inline
 *     because Deno can't reach into `packages/core` at deploy time)
 *
 * Anything in this module MUST stay pure: no DB, no network, no Date.now()
 * unless the caller passes a clock. The renderer relies on the substitution
 * being deterministic for content-hash stability.
 */

/**
 * Match a single `{{binding.key}}` placeholder. Whitespace around the
 * binding name is tolerated so doctors can write `{{ patient.full_name }}`
 * from the editor without breaking the substitution.
 */
export const COMPOSITE_PLACEHOLDER_RE = /\{\{\s*([a-z][a-z0-9_.]*)\s*\}\}/g;

/**
 * Extract every binding referenced by `{{binding}}` placeholders in a
 * composite template. Returns bindings in document order with duplicates
 * preserved so the editor can show "binding used N times" hints.
 */
export function extractCompositeBindings(template) {
  if (typeof template !== 'string') return [];
  const out = [];
  // Reset before each call so this module-scoped regex stays reusable.
  COMPOSITE_PLACEHOLDER_RE.lastIndex = 0;
  let match = COMPOSITE_PLACEHOLDER_RE.exec(template);
  while (match !== null) {
    out.push(match[1]);
    match = COMPOSITE_PLACEHOLDER_RE.exec(template);
  }
  return out;
}

// ── Derived-field DSL ─────────────────────────────────────────────
//
// Doctors want fields like "Patient age" or "Diagnosis line" composed from
// known bindings without a free-form expression language. We expose a tiny
// closed set of named functions (no eval, no arithmetic operators, no
// arbitrary JS). Adding a new function is a deliberate plan change.
//
// A derivation looks like:
//   { fn: 'age', args: [{ binding: 'patient.date_of_birth' }] }
//   { fn: 'concat', args: [{ binding: 'patient.full_name' },
//                           { literal: ' — born ' },
//                           { binding: 'patient.date_of_birth' }] }
//
// Args can be either `{ binding }` (resolved at render time) or `{ literal }`
// (verbatim string). No nested derivations — keeps the type tree finite.

export const DERIVATION_FUNCTIONS = Object.freeze([
  'age',
  'years_between',
  'concat',
  'upper',
  'lower',
  'trim',
]);

/**
 * Compute the difference in whole years between two ISO date strings.
 * Returns null when either input is unparseable so the renderer can fall
 * back to an empty cell rather than emitting "NaN years".
 */
function diffYears(fromIso, toIso) {
  if (!fromIso || !toIso) return null;
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  let years = to.getUTCFullYear() - from.getUTCFullYear();
  const m = to.getUTCMonth() - from.getUTCMonth();
  if (m < 0 || (m === 0 && to.getUTCDate() < from.getUTCDate())) years -= 1;
  return years;
}

/**
 * Resolve a single derivation argument. `binding` args look up the closed
 * autofill map; `literal` args pass through. Anything else resolves to ''.
 */
function resolveArg(arg, bindings) {
  if (!arg || typeof arg !== 'object') return '';
  if (typeof arg.binding === 'string') {
    const v = bindings?.[arg.binding];
    return typeof v === 'string' ? v : '';
  }
  if (typeof arg.literal === 'string') return arg.literal;
  return '';
}

/**
 * Evaluate a derivation against a bindings map. Returns an empty string
 * when the function name is unknown or an argument is missing — never
 * throws, so a misconfigured template degrades to an empty cell rather
 * than failing the whole render.
 *
 * `nowIso` defaults to the current UTC date so the helper is deterministic
 * for tests when an explicit clock is passed.
 */
export function evaluateDerivation(derivation, bindings, nowIso = new Date().toISOString()) {
  if (!derivation || typeof derivation !== 'object') return '';
  const { fn, args } = derivation;
  if (!DERIVATION_FUNCTIONS.includes(fn)) return '';
  const resolved = Array.isArray(args) ? args.map((a) => resolveArg(a, bindings)) : [];

  switch (fn) {
    case 'age': {
      const dob = resolved[0];
      const years = diffYears(dob, nowIso);
      return years == null ? '' : String(years);
    }
    case 'years_between': {
      const years = diffYears(resolved[0], resolved[1]);
      return years == null ? '' : String(years);
    }
    case 'concat':
      return resolved.join('');
    case 'upper':
      return (resolved[0] || '').toUpperCase();
    case 'lower':
      return (resolved[0] || '').toLowerCase();
    case 'trim':
      return (resolved[0] || '').trim();
    default:
      return '';
  }
}

/**
 * Substitute placeholders in `template` against a flat bindings map.
 *
 * `bindings` is the same shape the renderer's `resolveAutofill` produces:
 * `{ 'patient.full_name': 'Asma Saleh', ... }`. Any binding the caller did
 * not include (or that resolves to a non-string / empty) gets the
 * "known-empty" treatment: replaced with an empty string. Unknown bindings
 * — keys outside the closed `knownKeys` set — render as the literal
 * `[binding.key]` so the bug is visible during QA rather than silently
 * disappearing.
 *
 * @param {string} template
 * @param {Record<string, string | null | undefined>} bindings
 * @param {Iterable<string>} knownKeys  closed-set check (typically TEMPLATE_AUTOFILL_KEYS)
 * @returns {string}
 */
export function renderCompositeTemplate(template, bindings, knownKeys) {
  if (typeof template !== 'string' || !template) return '';
  const known = knownKeys instanceof Set ? knownKeys : new Set(knownKeys || []);
  return template.replace(COMPOSITE_PLACEHOLDER_RE, (_match, binding) => {
    const value = bindings?.[binding];
    if (typeof value === 'string' && value.trim()) return value;
    if (known.has(binding)) return '';
    return `[${binding}]`;
  });
}
