/**
 * Document template schemas.
 *
 * Note on cohesion: medication-catalog schemas previously lived here; they
 * were moved to `./medicationCatalog.js`. The barrel `./index.js` still
 * re-exports both groups, so callers using `@core/schemas` keep working.
 */

import { z } from 'zod';
import { nullableTrimmedString } from './helpers.js';
import {
  COMPOSITE_PLACEHOLDER_RE,
  extractCompositeBindings,
  DERIVATION_FUNCTIONS,
} from '../lib/composite.js';

/**
 * Template field types — the closed set.
 * Adding a new type is a plan change (update § 14 + renderer + editor).
 *
 * `composite_text` is the "doctor builds a custom field from other fields"
 * primitive: it carries a `template` string with `{{binding}}` placeholders
 * that the renderer substitutes from the closed binding set at render time.
 * It is rendered like static_text but with live data woven in.
 */
const TEMPLATE_FIELD_TYPES = [
  'text',
  'textarea',
  'date',
  'select',
  'checkbox',
  'checkbox_grid',
  'static_text',
  'composite_text',
  'derived',
  'signature',
];

// Composite placeholder primitives live in `packages/core/lib/composite.js`
// so the editor preview, the schema validator, and (mirrored) the renderer
// all share a single substitution contract. Re-exported below for callers
// that still import them from this schema barrel.

/**
 * Template types — maps 1:1 with the document_templates.template_type
 * check constraint.
 */
const TEMPLATE_TYPES = [
  'referral',
  'report',
  'certificate',
  'lab_request',
  'prescription',
  'custom',
];

/**
 * Closed set of autofill bindings the renderer resolves. Keep in lockstep
 * with the autofill map in `supabase/functions/render-clinical-document/
 * pdfRenderer.ts`. `patient.gender` is a legacy alias for `patient.sex`
 * preserved so already-seeded templates keep rendering.
 */
const TEMPLATE_AUTOFILL_KEYS = [
  'patient.full_name',
  'patient.date_of_birth',
  'patient.sex',
  'patient.gender',
  'patient.phone',
  'patient.email',
  'doctor.full_name',
  'doctor.specialization',
  'doctor.license_number',
  'clinic.name',
  'clinic.address',
  'clinic.phone',
  'tenant.display_name',
  'tenant.support_phone',
  'tenant.support_email',
  'tenant.timezone',
  'encounter.chief_complaint',
  'encounter.summary',
  'encounter.started_at',
  'document.created_at',
];

/**
 * Conservative per-template caps. The renderer's page-break planner is not
 * yet a full splitter (see plan § 8.11), so unbounded section/field counts
 * are a real DoS risk. The lab-request seed (the largest shipped template)
 * is 7 sections × max 4 fields plus one 11-group checkbox grid; these
 * limits give 4× headroom over that.
 */
const MAX_SECTIONS_PER_TEMPLATE = 30;
const MAX_FIELDS_PER_SECTION = 25;

/**
 * Conditional-display shape. When present, the renderer skips the field
 * unless the resolved binding value equals (case-insensitive, trimmed) the
 * configured `equals` string. Editor UX exposes this as "Show only when…".
 *
 * Designed deliberately narrow: a closed binding + a literal equality.
 * Richer expressions (regex, range, in-list) belong in a follow-up so we
 * don't accidentally re-invent a query language inside the JSON schema.
 */
const showIfSchema = z.object({
  binding: z.enum(TEMPLATE_AUTOFILL_KEYS),
  equals: z.string().trim().min(1).max(240),
}).strict();

/**
 * Derivation arg — either a closed-set binding or a literal string. No
 * nested derivations: keeps the recursive type tree closed and the
 * renderer trivially terminating.
 */
const derivationArgSchema = z.union([
  z.object({ binding: z.enum(TEMPLATE_AUTOFILL_KEYS) }).strict(),
  z.object({ literal: z.string().max(240) }).strict(),
]);

const derivationSchema = z.object({
  fn: z.enum(DERIVATION_FUNCTIONS),
  args: z.array(derivationArgSchema).min(1).max(8),
}).strict();

/**
 * A single field inside a template section.
 *
 * `template` is the composite-text source string. Only fields of type
 * `composite_text` use it; all other types must leave it null. The validator
 * also rejects unknown bindings inside `{{ }}` placeholders so a doctor
 * cannot reference a binding the renderer doesn't know about.
 */
const templateFieldSchema = z.object({
  key: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(240),
  type: z.enum(TEMPLATE_FIELD_TYPES),
  autofill: z.enum(TEMPLATE_AUTOFILL_KEYS).optional().nullable(),
  required: z.boolean().optional().default(false),
  options: z.array(z.string().trim().min(1).max(240)).optional().nullable(),
  groups: z.array(z.object({
    label: z.string().trim().min(1).max(240),
    items: z.array(z.string().trim().min(1).max(240)).min(1),
  })).optional().nullable(),
  content: z.string().max(4000).optional().nullable(),
  template: z.string().max(4000).optional().nullable(),
  /**
   * Optional human-visible help string. The editor uses it to caption a
   * field; it never appears in rendered PDFs. Keeps doctor-author intent
   * separate from the field label that gets printed.
   */
  hint: z.string().max(240).optional().nullable(),
  show_if: showIfSchema.optional().nullable(),
  derivation: derivationSchema.optional().nullable(),
}).refine(
  ({ type, derivation }) => {
    // Only `derived` fields may carry a derivation. Other types stay
    // semantically clean (no surprise behaviors from leftover config).
    if (type === 'derived') return derivation != null;
    return derivation == null;
  },
  { message: 'derivation is required on derived fields and forbidden on others.' },
).refine(
  ({ type, options }) => type !== 'select' || (Array.isArray(options) && options.length > 0),
  { message: 'Select fields must have at least one option.' },
).refine(
  ({ type, groups }) => type !== 'checkbox_grid' || (Array.isArray(groups) && groups.length > 0),
  { message: 'Checkbox grid fields must have at least one group.' },
).refine(
  ({ type, template }) => type !== 'composite_text' || (typeof template === 'string' && template.trim().length > 0),
  { message: 'Composite text fields must have a template string.' },
).refine(
  ({ type, template }) => {
    if (type !== 'composite_text' || typeof template !== 'string') return true;
    const bindings = extractCompositeBindings(template);
    return bindings.every((b) => TEMPLATE_AUTOFILL_KEYS.includes(b));
  },
  {
    message: 'Composite text template references an unknown binding. Use one of the listed autofill keys.',
  },
).refine(
  ({ type, template }) => {
    // Non-composite fields must not carry a template — keeps semantics clean.
    if (type === 'composite_text') return true;
    return template == null || template === '';
  },
  { message: 'Only composite_text fields may carry a template string.' },
);

/**
 * A section inside a template. Field keys must be unique within a section
 * because the renderer keys overrides by field.key.
 */
const templateSectionSchema = z.object({
  key: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(240),
  fields: z.array(templateFieldSchema).min(1).max(MAX_FIELDS_PER_SECTION),
}).refine(
  (section) => {
    const seen = new Set();
    for (const f of section.fields) {
      if (seen.has(f.key)) return false;
      seen.add(f.key);
    }
    return true;
  },
  { message: 'Field keys must be unique within a section.' },
);

const sectionsSchema = z.array(templateSectionSchema)
  .min(1)
  .max(MAX_SECTIONS_PER_TEMPLATE)
  .refine(
    (sections) => {
      const seen = new Set();
      for (const s of sections) {
        if (seen.has(s.key)) return false;
        seen.add(s.key);
      }
      return true;
    },
    { message: 'Section keys must be unique within a template.' },
  );

/**
 * Create a new document template.
 */
export const documentTemplateCreateSchema = z.object({
  name: z.string().trim().min(1).max(240),
  template_type: z.enum(TEMPLATE_TYPES),
  description: nullableTrimmedString(2000).optional(),
  sections: sectionsSchema,
  is_default: z.boolean().optional().default(false),
  created_by: z.string().uuid(),
});

/**
 * Update an existing document template (partial).
 */
export const documentTemplateUpdateSchema = z.object({
  name: z.string().trim().min(1).max(240).optional(),
  template_type: z.enum(TEMPLATE_TYPES).optional(),
  description: nullableTrimmedString(2000).optional(),
  sections: sectionsSchema.optional(),
  is_default: z.boolean().optional(),
});

// Human-readable labels for TEMPLATE_TYPES — single canonical source.
// Used by TemplatesPage, TemplateEditorPage, and any future UI that
// displays template type names.  Keeps labels in lockstep with the enum.
const TEMPLATE_TYPE_LABELS = {
  referral: 'Referral',
  report: 'Report',
  certificate: 'Certificate',
  lab_request: 'Lab Request',
  prescription: 'Prescription',
  custom: 'Custom',
};

// Re-export the sub-schemas + constants for the editor, tests, and renderer.
export {
  templateFieldSchema,
  templateSectionSchema,
  TEMPLATE_FIELD_TYPES,
  TEMPLATE_TYPES,
  TEMPLATE_TYPE_LABELS,
  TEMPLATE_AUTOFILL_KEYS,
  MAX_SECTIONS_PER_TEMPLATE,
  MAX_FIELDS_PER_SECTION,
  COMPOSITE_PLACEHOLDER_RE,
  extractCompositeBindings,
  DERIVATION_FUNCTIONS,
};

// Backwards-compat re-export: the previous version of this file exported
// medicationCatalog schemas alongside the template ones. Some external
// consumers (and the medicationCatalog service) imported them from here.
// Re-export from the canonical location so old imports keep resolving.
export {
  medicationCatalogCreateSchema,
  medicationCatalogUpdateSchema,
} from './medicationCatalog.js';
