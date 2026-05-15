import { z } from 'zod';
import { nullableTrimmedString } from './helpers.js';

/**
 * Template field types — the closed set.
 * Adding a new type is a plan change (update § 14 + renderer + editor).
 */
const TEMPLATE_FIELD_TYPES = [
  'text',
  'textarea',
  'date',
  'select',
  'checkbox',
  'checkbox_grid',
  'static_text',
  'signature',
];

/**
 * Template types — maps 1:1 with document_templates.template_type check constraint.
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
 * A single field inside a template section.
 */
const templateFieldSchema = z.object({
  key: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(240),
  type: z.enum(TEMPLATE_FIELD_TYPES),
  autofill: z.string().trim().max(120).optional().nullable(),
  required: z.boolean().optional().default(false),
  options: z.array(z.string().trim().min(1).max(240)).optional().nullable(),
  groups: z.array(z.object({
    label: z.string().trim().min(1).max(240),
    items: z.array(z.string().trim().min(1).max(240)).min(1),
  })).optional().nullable(),
  content: z.string().max(4000).optional().nullable(),
}).refine(
  ({ type, options }) => type !== 'select' || (Array.isArray(options) && options.length > 0),
  { message: 'Select fields must have at least one option.' }
).refine(
  ({ type, groups }) => type !== 'checkbox_grid' || (Array.isArray(groups) && groups.length > 0),
  { message: 'Checkbox grid fields must have at least one group.' }
);

/**
 * A section inside a template. Contains an ordered list of fields.
 */
const templateSectionSchema = z.object({
  key: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(240),
  fields: z.array(templateFieldSchema).min(1).max(40),
});

/**
 * Create a new document template.
 */
export const documentTemplateCreateSchema = z.object({
  name: z.string().trim().min(1).max(240),
  template_type: z.enum(TEMPLATE_TYPES),
  description: nullableTrimmedString(2000).optional(),
  sections: z.array(templateSectionSchema).min(1).max(50),
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
  sections: z.array(templateSectionSchema).min(1).max(50).optional(),
  is_default: z.boolean().optional(),
});

/**
 * Medication catalog — create/update schema.
 */
export const medicationCatalogCreateSchema = z.object({
  name: z.string().trim().min(1).max(240),
  generic_name: nullableTrimmedString(240).optional(),
  dosage_forms: z.array(z.string().trim().min(1).max(240)).optional().default([]),
  common_dosages: z.array(z.string().trim().min(1).max(240)).optional().default([]),
  notes: nullableTrimmedString(4000).optional(),
});

export const medicationCatalogUpdateSchema = z.object({
  name: z.string().trim().min(1).max(240).optional(),
  generic_name: nullableTrimmedString(240).optional(),
  dosage_forms: z.array(z.string().trim().min(1).max(240)).optional(),
  common_dosages: z.array(z.string().trim().min(1).max(240)).optional(),
  notes: nullableTrimmedString(4000).optional(),
});

// Re-export the sub-schemas for use in tests and the template editor.
export { templateFieldSchema, templateSectionSchema, TEMPLATE_FIELD_TYPES, TEMPLATE_TYPES };
