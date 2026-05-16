import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  REPORT_AUTHORING_MODES,
  REPORT_RENDER_PROFILES,
  REPORT_TEMPLATE_ASSET_MAX_BYTES,
  REPORT_SUPPORTED_LOCALES,
  reportDefinitionSchema,
  reportTemplateAssetCreateSchema,
  reportTemplateVersionCreateSchema,
} from '../../../packages/core/schemas/reportDefinitions.js';

const BASE_FIELD = {
  key: 'patient_name',
  label: { en: 'Patient name' },
  type: 'text',
  binding: 'patient.full_name',
};

const VALID_FLOW_DEFINITION = {
  schemaVersion: '2',
  authoringMode: 'flow_document',
  renderProfile: 'gotenberg_html',
  locale: 'en',
  direction: 'ltr',
  page: { size: 'A4', orientation: 'portrait' },
  theme: {
    fontFamily: 'noto_sans',
    primaryColor: '#0f172a',
    accentColor: '#38bdf8',
  },
  blocks: [
    {
      type: 'section',
      key: 'patient_info',
      title: { en: 'Patient information' },
      fields: [BASE_FIELD],
    },
    {
      type: 'signature',
      signer: 'doctor',
    },
  ],
};

const VALID_FIXED_DEFINITION = {
  ...VALID_FLOW_DEFINITION,
  authoringMode: 'fixed_canvas',
  renderProfile: 'gotenberg_html',
  canvas: {
    engine: 'pdfme',
    templateVersion: '5.x',
    schemas: [
      {
        patient_name: {
          type: 'text',
          position: { x: 42, y: 88 },
          width: 180,
          height: 22,
          binding: 'patient.full_name',
        },
      },
    ],
  },
};

describe('reportDefinitionSchema', () => {
  it('accepts a flow-document report definition', () => {
    const parsed = reportDefinitionSchema.safeParse(VALID_FLOW_DEFINITION);
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.renderProfile, 'gotenberg_html');
  });

  it('accepts a pdfme-style fixed-canvas envelope', () => {
    const parsed = reportDefinitionSchema.safeParse(VALID_FIXED_DEFINITION);
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.canvas.engine, 'pdfme');
  });

  it('keeps flow-document and fixed-canvas authoring modes structurally separate', () => {
    const parsed = reportDefinitionSchema.safeParse({
      ...VALID_FLOW_DEFINITION,
      canvas: VALID_FIXED_DEFINITION.canvas,
    });
    assert.equal(parsed.success, false);
  });

  it('keeps fixed-canvas assets as safe asset ids, not remote URLs', () => {
    const parsed = reportDefinitionSchema.safeParse({
      ...VALID_FIXED_DEFINITION,
      canvas: {
        ...VALID_FIXED_DEFINITION.canvas,
        schemas: [{
          clinic_logo: {
            type: 'image',
            position: { x: 42, y: 20 },
            width: 80,
            height: 40,
            assetId: '33333333-3333-4333-8333-333333333333',
          },
        }],
      },
    });
    assert.equal(parsed.success, true);

    const remoteUrl = reportDefinitionSchema.safeParse({
      ...VALID_FIXED_DEFINITION,
      canvas: {
        ...VALID_FIXED_DEFINITION.canvas,
        schemas: [{
          clinic_logo: {
            type: 'image',
            position: { x: 42, y: 20 },
            width: 80,
            height: 40,
            url: 'https://example.com/logo.png',
          },
        }],
      },
    });
    assert.equal(remoteUrl.success, false);
  });

  it('rejects fixed-canvas HTML/script field types and image fields without asset ids', () => {
    const htmlField = reportDefinitionSchema.safeParse({
      ...VALID_FIXED_DEFINITION,
      canvas: {
        ...VALID_FIXED_DEFINITION.canvas,
        schemas: [{
          injected_html: {
            type: 'html',
            position: { x: 42, y: 20 },
            width: 80,
            height: 40,
            content: '<script>alert(1)</script>',
          },
        }],
      },
    });
    assert.equal(htmlField.success, false);

    const unboundImage = reportDefinitionSchema.safeParse({
      ...VALID_FIXED_DEFINITION,
      canvas: {
        ...VALID_FIXED_DEFINITION.canvas,
        schemas: [{
          clinic_logo: {
            type: 'image',
            position: { x: 42, y: 20 },
            width: 80,
            height: 40,
          },
        }],
      },
    });
    assert.equal(unboundImage.success, false);
  });

  it('rejects fixed-canvas definitions without a canvas envelope', () => {
    const { canvas: _canvas, ...withoutCanvas } = VALID_FIXED_DEFINITION;
    const parsed = reportDefinitionSchema.safeParse(withoutCanvas);
    assert.equal(parsed.success, false);
  });

  it('rejects raw HTML/script blocks', () => {
    const parsed = reportDefinitionSchema.safeParse({
      ...VALID_FLOW_DEFINITION,
      blocks: [{ type: 'html', html: '<script>alert(1)</script>' }],
    });
    assert.equal(parsed.success, false);
  });

  it('rejects raw HTML inside template text fields', () => {
    const parsed = reportDefinitionSchema.safeParse({
      ...VALID_FLOW_DEFINITION,
      blocks: [{
        type: 'section',
        key: 'unsafe_copy',
        title: { en: 'Unsafe copy' },
        fields: [{
          key: 'static_warning',
          label: { en: 'Warning' },
          type: 'static_text',
          content: '<strong onclick="steal()">Unsafe</strong>',
        }],
      }],
    });
    assert.equal(parsed.success, false);
  });

  it('requires static text fields to carry text content only on static text fields', () => {
    const missingStaticContent = reportDefinitionSchema.safeParse({
      ...VALID_FLOW_DEFINITION,
      blocks: [{
        type: 'section',
        key: 'empty_static',
        title: { en: 'Empty static' },
        fields: [{
          key: 'empty_static_copy',
          label: { en: 'Empty copy' },
          type: 'static_text',
        }],
      }],
    });
    assert.equal(missingStaticContent.success, false);

    const contentOnTextInput = reportDefinitionSchema.safeParse({
      ...VALID_FLOW_DEFINITION,
      blocks: [{
        type: 'section',
        key: 'text_with_content',
        title: { en: 'Text with content' },
        fields: [{
          ...BASE_FIELD,
          content: 'This belongs on static text only.',
        }],
      }],
    });
    assert.equal(contentOnTextInput.success, false);
  });

  it('applies static text content rules inside nested and table blocks', () => {
    const nestedStaticWithoutContent = reportDefinitionSchema.safeParse({
      ...VALID_FLOW_DEFINITION,
      blocks: [{
        type: 'condition',
        key: 'when_patient_has_phone',
        when: 'has_patient_phone',
        blocks: [{
          type: 'section',
          key: 'nested_static',
          title: { en: 'Nested static' },
          fields: [{
            key: 'nested_static_copy',
            label: { en: 'Nested static copy' },
            type: 'static_text',
          }],
        }],
      }],
    });
    assert.equal(nestedStaticWithoutContent.success, false);

    const tableTextWithContent = reportDefinitionSchema.safeParse({
      ...VALID_FLOW_DEFINITION,
      blocks: [{
        type: 'table',
        key: 'prescription_table',
        title: { en: 'Prescriptions' },
        rows: 'prescriptions',
        columns: [{
          key: 'medication_name',
          label: { en: 'Medication' },
          type: 'text',
          binding: 'prescriptions.active_summary',
          content: 'This belongs on static text only.',
        }],
      }],
    });
    assert.equal(tableTextWithContent.success, false);
  });

  it('rejects unknown data bindings so doctors cannot type raw paths', () => {
    const parsed = reportDefinitionSchema.safeParse({
      ...VALID_FLOW_DEFINITION,
      blocks: [{
        type: 'section',
        key: 'bad',
        title: { en: 'Bad' },
        fields: [{ ...BASE_FIELD, binding: 'patients.private_notes' }],
      }],
    });
    assert.equal(parsed.success, false);
  });

  it('routes Arabic definitions to RTL and the advanced renderer', () => {
    const parsed = reportDefinitionSchema.safeParse({
      ...VALID_FLOW_DEFINITION,
      locale: 'ar-LB',
      direction: 'rtl',
      renderProfile: 'gotenberg_html',
      theme: { ...VALID_FLOW_DEFINITION.theme, fontFamily: 'noto_naskh_arabic' },
      blocks: [{
        type: 'section',
        key: 'arabic_patient_info',
        title: { 'ar-LB': 'بيانات المريض' },
        fields: [{ ...BASE_FIELD, label: { 'ar-LB': 'اسم المريض' } }],
      }],
    });
    assert.equal(parsed.success, true);
  });

  it('rejects Arabic definitions on the baseline pdf-lib renderer', () => {
    const parsed = reportDefinitionSchema.safeParse({
      ...VALID_FLOW_DEFINITION,
      locale: 'ar-LB',
      direction: 'rtl',
      renderProfile: 'edge_pdf_lib',
    });
    assert.equal(parsed.success, false);
  });

  it('exports closed sets for UI controls', () => {
    assert.deepEqual(REPORT_AUTHORING_MODES, ['fixed_canvas', 'flow_document']);
    assert.ok(REPORT_RENDER_PROFILES.includes('gotenberg_html'));
    assert.ok(REPORT_SUPPORTED_LOCALES.includes('ar-LB'));
  });
});

describe('reportTemplateVersionCreateSchema', () => {
  it('requires a real template id, creator id, version number, and checksum', () => {
    const parsed = reportTemplateVersionCreateSchema.safeParse({
      template_id: '11111111-1111-4111-8111-111111111111',
      version_number: 2,
      definition: VALID_FLOW_DEFINITION,
      definition_checksum: 'a'.repeat(64),
      created_by: '22222222-2222-4222-8222-222222222222',
    });
    assert.equal(parsed.success, true);
  });

  it('rejects invalid definition checksums', () => {
    const parsed = reportTemplateVersionCreateSchema.safeParse({
      template_id: '11111111-1111-4111-8111-111111111111',
      version_number: 2,
      definition: VALID_FLOW_DEFINITION,
      definition_checksum: 'not-a-sha',
      created_by: '22222222-2222-4222-8222-222222222222',
    });
    assert.equal(parsed.success, false);
  });

  it('allows is_current only for published versions', () => {
    const parsed = reportTemplateVersionCreateSchema.safeParse({
      template_id: '11111111-1111-4111-8111-111111111111',
      version_number: 2,
      status: 'draft',
      is_current: true,
      definition: VALID_FLOW_DEFINITION,
      definition_checksum: 'a'.repeat(64),
      created_by: '22222222-2222-4222-8222-222222222222',
    });
    assert.equal(parsed.success, false);
  });
});

describe('reportTemplateAssetCreateSchema', () => {
  const VALID_ASSET = {
    template_id: '11111111-1111-4111-8111-111111111111',
    asset_type: 'logo',
    storage_bucket: 'template-assets',
    storage_path: 'templates/11111111/logo.png',
    content_type: 'image/png',
    byte_size: 120_000,
    checksum: 'a'.repeat(64),
    image_width_px: 512,
    image_height_px: 256,
    scan_status: 'passed',
    uploaded_by: '22222222-2222-4222-8222-222222222222',
  };

  it('accepts a scanned tenant-local image asset within the safety budget', () => {
    const parsed = reportTemplateAssetCreateSchema.safeParse(VALID_ASSET);
    assert.equal(parsed.success, true);
    assert.equal(REPORT_TEMPLATE_ASSET_MAX_BYTES, 2 * 1024 * 1024);
  });

  it('rejects oversized, unscanned, or unsupported template assets', () => {
    assert.equal(reportTemplateAssetCreateSchema.safeParse({
      ...VALID_ASSET,
      byte_size: REPORT_TEMPLATE_ASSET_MAX_BYTES + 1,
    }).success, false);

    assert.equal(reportTemplateAssetCreateSchema.safeParse({
      ...VALID_ASSET,
      content_type: 'application/pdf',
    }).success, false);

    assert.equal(reportTemplateAssetCreateSchema.safeParse({
      ...VALID_ASSET,
      scan_status: 'pending',
    }).success, false);
  });

  it('rejects remote URLs and path traversal in storage paths', () => {
    assert.equal(reportTemplateAssetCreateSchema.safeParse({
      ...VALID_ASSET,
      storage_path: 'https://example.com/logo.png',
    }).success, false);

    assert.equal(reportTemplateAssetCreateSchema.safeParse({
      ...VALID_ASSET,
      storage_path: '../logo.png',
    }).success, false);
  });
});
