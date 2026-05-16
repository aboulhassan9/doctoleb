import { z } from 'zod';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const HTML_TAG = /<\/?[a-z][\s\S]*>/i;
const SAFE_KEY = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const STORAGE_BUCKET = /^[a-z0-9][a-z0-9._-]*$/;

export const REPORT_SCHEMA_VERSION = '2';
export const REPORT_AUTHORING_MODES = ['fixed_canvas', 'flow_document'];
export const REPORT_RENDER_PROFILES = ['edge_pdf_lib', 'gotenberg_html'];
export const REPORT_SUPPORTED_LOCALES = ['en', 'ar-LB', 'fr'];
export const REPORT_DIRECTIONS = ['ltr', 'rtl'];
export const REPORT_PAGE_SIZES = ['A4'];
export const REPORT_ORIENTATIONS = ['portrait', 'landscape'];
export const REPORT_FONT_FAMILIES = ['noto_sans', 'noto_naskh_arabic'];
export const REPORT_TEMPLATE_ASSET_TYPES = ['logo', 'stamp', 'signature', 'background'];
export const REPORT_TEMPLATE_ASSET_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];
export const REPORT_TEMPLATE_ASSET_MAX_BYTES = 2 * 1024 * 1024;
export const REPORT_TEMPLATE_ASSET_MAX_DIMENSION_PX = 4096;
export const REPORT_CANVAS_FIELD_TYPES = [
  'text',
  'textarea',
  'date',
  'number',
  'checkbox',
  'image',
  'line',
  'rectangle',
  'ellipse',
  'qrcode',
  'signature',
  'static_text',
];

export const REPORT_BINDINGS = [
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
  'diagnoses.summary',
  'prescriptions.active_summary',
  'document.created_at',
  'now',
];

const REPORT_FIELD_TYPES = [
  'text',
  'textarea',
  'date',
  'number',
  'select',
  'checkbox',
  'checkbox_grid',
  'static_text',
];

const REPORT_TABLE_SOURCES = ['prescriptions', 'diagnoses', 'lab_tests'];
const REPORT_CONDITIONS = [
  'has_encounter',
  'has_diagnoses',
  'has_prescriptions',
  'has_lab_tests',
  'has_patient_phone',
  'has_patient_email',
];

const noRawHtml = (value) => !HTML_TAG.test(value);

const localizedTextSchema = z.object({
  en: z.string().trim().min(1).max(500).refine(noRawHtml, {
    message: 'Raw HTML is not allowed in report text.',
  }).optional(),
  'ar-LB': z.string().trim().min(1).max(500).refine(noRawHtml, {
    message: 'Raw HTML is not allowed in report text.',
  }).optional(),
  fr: z.string().trim().min(1).max(500).refine(noRawHtml, {
    message: 'Raw HTML is not allowed in report text.',
  }).optional(),
}).strict().refine(
  (value) => Object.values(value).some((entry) => typeof entry === 'string' && entry.trim().length > 0),
  { message: 'At least one localized text value is required.' }
);

const reportFieldGroupSchema = z.object({
  label: localizedTextSchema,
  items: z.array(localizedTextSchema).min(1).max(80),
}).strict();

const reportFieldSchema = z.object({
  key: z.string().trim().regex(SAFE_KEY).max(120),
  label: localizedTextSchema,
  type: z.enum(REPORT_FIELD_TYPES),
  binding: z.enum(REPORT_BINDINGS).optional(),
  required: z.boolean().optional().default(false),
  width: z.number().min(1).max(12).optional(),
  options: z.array(localizedTextSchema).max(80).optional(),
  groups: z.array(reportFieldGroupSchema).max(20).optional(),
  content: z.string().max(4000).refine(noRawHtml, {
    message: 'Raw HTML is not allowed in report text.',
  }).optional(),
  helpText: localizedTextSchema.optional(),
}).strict().refine(
  ({ type, options }) => type !== 'select' || (Array.isArray(options) && options.length > 0),
  { message: 'Select report fields must include options.' }
).refine(
  ({ type, groups }) => type !== 'checkbox_grid' || (Array.isArray(groups) && groups.length > 0),
  { message: 'Checkbox-grid report fields must include groups.' }
);

const pdfmePositionSchema = z.object({
  x: z.number().min(0).max(595),
  y: z.number().min(0).max(842),
}).strict();

const pdfmeFieldSchema = z.object({
  type: z.enum(REPORT_CANVAS_FIELD_TYPES),
  position: pdfmePositionSchema,
  width: z.number().min(1).max(595),
  height: z.number().min(1).max(842),
  binding: z.enum(REPORT_BINDINGS).optional(),
  assetId: z.string().uuid().optional(),
  content: z.string().max(4000).refine(noRawHtml, {
    message: 'Raw HTML is not allowed in report text.',
  }).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.type === 'image' && !value.assetId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['assetId'],
      message: 'Fixed-canvas image fields must reference a safe template asset.',
    });
  }

  if (value.assetId && !['image', 'signature'].includes(value.type)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['assetId'],
      message: 'Template assets can only be used by image or signature fields.',
    });
  }
});

const pdfmeSchemaPage = z.record(z.string().trim().regex(SAFE_KEY).max(120), pdfmeFieldSchema);

const pdfmeTemplateEnvelopeSchema = z.object({
  engine: z.literal('pdfme'),
  templateVersion: z.string().trim().min(1).max(40).optional(),
  schemas: z.array(pdfmeSchemaPage).min(1).max(20),
}).strict();

let reportBlockSchema;

const sectionBlockSchema = z.object({
  type: z.literal('section'),
  key: z.string().trim().regex(SAFE_KEY).max(120),
  title: localizedTextSchema,
  fields: z.array(reportFieldSchema).min(1).max(40),
}).strict();

const tableBlockSchema = z.object({
  type: z.literal('table'),
  key: z.string().trim().regex(SAFE_KEY).max(120),
  title: localizedTextSchema.optional(),
  rows: z.enum(REPORT_TABLE_SOURCES),
  columns: z.array(reportFieldSchema).min(1).max(20),
}).strict();

const repeatBlockSchema = z.object({
  type: z.literal('repeat'),
  key: z.string().trim().regex(SAFE_KEY).max(120),
  source: z.enum(REPORT_TABLE_SOURCES),
  blocks: z.array(z.lazy(() => reportBlockSchema)).min(1).max(10),
}).strict();

const conditionBlockSchema = z.object({
  type: z.literal('condition'),
  key: z.string().trim().regex(SAFE_KEY).max(120),
  when: z.enum(REPORT_CONDITIONS),
  blocks: z.array(z.lazy(() => reportBlockSchema)).min(1).max(10),
}).strict();

const headerBlockSchema = z.object({
  type: z.literal('header'),
  bindings: z.array(z.enum(REPORT_BINDINGS)).min(1).max(12),
}).strict();

const signatureBlockSchema = z.object({
  type: z.literal('signature'),
  signer: z.literal('doctor'),
}).strict();

const qrVerificationBlockSchema = z.object({
  type: z.literal('qr_verification'),
}).strict();

reportBlockSchema = z.discriminatedUnion('type', [
  headerBlockSchema,
  sectionBlockSchema,
  tableBlockSchema,
  repeatBlockSchema,
  conditionBlockSchema,
  signatureBlockSchema,
  qrVerificationBlockSchema,
]);

function collectReportFields(blocks = []) {
  const fields = [];

  for (const block of blocks) {
    if (block.type === 'section') {
      fields.push(...block.fields);
      continue;
    }

    if (block.type === 'table') {
      fields.push(...block.columns);
      continue;
    }

    if (block.type === 'repeat' || block.type === 'condition') {
      fields.push(...collectReportFields(block.blocks));
    }
  }

  return fields;
}

const reportThemeSchema = z.object({
  fontFamily: z.enum(REPORT_FONT_FAMILIES),
  primaryColor: z.string().regex(HEX_COLOR),
  accentColor: z.string().regex(HEX_COLOR),
}).strict();

export const reportDefinitionSchema = z.object({
  schemaVersion: z.literal(REPORT_SCHEMA_VERSION),
  authoringMode: z.enum(REPORT_AUTHORING_MODES),
  renderProfile: z.enum(REPORT_RENDER_PROFILES),
  locale: z.enum(REPORT_SUPPORTED_LOCALES),
  direction: z.enum(REPORT_DIRECTIONS),
  page: z.object({
    size: z.enum(REPORT_PAGE_SIZES),
    orientation: z.enum(REPORT_ORIENTATIONS),
  }).strict(),
  theme: reportThemeSchema,
  canvas: pdfmeTemplateEnvelopeSchema.optional(),
  blocks: z.array(reportBlockSchema).min(1).max(80),
}).strict().superRefine((value, ctx) => {
  if (value.authoringMode === 'fixed_canvas' && !value.canvas) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['canvas'],
      message: 'Fixed-canvas definitions require a pdfme canvas envelope.',
    });
  }

  // Flow-document definitions must NOT carry a canvas envelope — the two
  // authoring modes are intentionally structurally separate so flow content
  // cannot accidentally drag pdfme positional metadata into the HTML path.
  if (value.authoringMode === 'flow_document' && value.canvas) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['canvas'],
      message: 'Flow-document definitions must not include a pdfme canvas envelope.',
    });
  }

  // Field-level invariants on static_text: `content` is required on static
  // fields and forbidden on any non-static input field. This stops doctors
  // from accidentally embedding boilerplate inside a `text`/`textarea` cell.
  for (const field of collectReportFields(value.blocks)) {
    if (field.type === 'static_text' && (!field.content || !field.content.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['blocks'],
        message: `Static text field "${field.key}" must carry content.`,
      });
    }
    if (field.type !== 'static_text' && typeof field.content === 'string') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['blocks'],
        message: `Field "${field.key}" (${field.type}) cannot carry static content; move it to a static_text field.`,
      });
    }
  }

  if (value.locale === 'ar-LB' && value.direction !== 'rtl') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['direction'],
      message: 'Arabic definitions must be RTL.',
    });
  }

  if (value.locale !== 'ar-LB' && value.direction !== 'ltr') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['direction'],
      message: 'Non-Arabic definitions must be LTR for this phase.',
    });
  }

  if (value.locale === 'ar-LB' && value.renderProfile !== 'gotenberg_html') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['renderProfile'],
      message: 'Arabic definitions require the advanced Gotenberg renderer until baseline shaping is proven.',
    });
  }
});

export const reportTemplateVersionCreateSchema = z.object({
  template_id: z.string().uuid(),
  version_number: z.number().int().min(1),
  status: z.enum(['draft', 'published', 'superseded', 'archived']).optional().default('draft'),
  is_current: z.boolean().optional().default(false),
  definition: reportDefinitionSchema,
  definition_checksum: z.string().regex(SHA256_HEX),
  created_by: z.string().uuid(),
  published_by: z.string().uuid().optional().nullable(),
}).strict().superRefine((value, ctx) => {
  if (value.status === 'published' && !value.published_by) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['published_by'],
      message: 'published_by is required when publishing a report definition version.',
    });
  }
  // The DB partial-unique index requires that only one row per
  // (template_id, locale) is `is_current = true AND status = 'published'`,
  // so we mirror the same invariant in the schema to reject drafts/
  // superseded/archived rows that try to claim `is_current = true`.
  if (value.is_current && value.status !== 'published') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['is_current'],
      message: 'is_current may only be true on a published version.',
    });
  }
});

export const reportRenderJobCreateSchema = z.object({
  clinical_document_id: z.string().uuid(),
  template_version_id: z.string().uuid(),
  render_profile: z.enum(REPORT_RENDER_PROFILES),
  requested_by: z.string().uuid(),
}).strict();

export const reportTemplateAssetCreateSchema = z.object({
  template_id: z.string().uuid().optional().nullable(),
  template_version_id: z.string().uuid().optional().nullable(),
  asset_type: z.enum(REPORT_TEMPLATE_ASSET_TYPES),
  storage_bucket: z.string().trim().min(1).max(80).regex(STORAGE_BUCKET),
  storage_path: z.string().trim().min(1).max(500)
    .refine((value) => !value.includes('://'), { message: 'Remote asset URLs are not allowed.' })
    .refine((value) => !value.includes('..'), { message: 'Path traversal is not allowed.' })
    .refine((value) => !value.includes('\\'), { message: 'Backslash paths are not allowed.' })
    .refine((value) => !value.startsWith('/'), { message: 'Storage path must be relative.' }),
  content_type: z.enum(REPORT_TEMPLATE_ASSET_CONTENT_TYPES),
  byte_size: z.number().int().min(1).max(REPORT_TEMPLATE_ASSET_MAX_BYTES),
  checksum: z.string().regex(SHA256_HEX),
  image_width_px: z.number().int().min(1).max(REPORT_TEMPLATE_ASSET_MAX_DIMENSION_PX),
  image_height_px: z.number().int().min(1).max(REPORT_TEMPLATE_ASSET_MAX_DIMENSION_PX),
  scan_status: z.literal('passed'),
  uploaded_by: z.string().uuid(),
}).strict().superRefine((value, ctx) => {
  if (!value.template_id && !value.template_version_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['template_id'],
      message: 'A template asset must belong to a template or template version.',
    });
  }
});

export {
  localizedTextSchema,
  pdfmeTemplateEnvelopeSchema,
  reportBlockSchema,
  reportFieldSchema,
  reportFieldGroupSchema,
};
