import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSupabaseMock } from './__helpers__/supabaseMock.mjs';
import { __setSupabaseClientForTest } from '../../../packages/core/lib/supabase.js';
import {
  createReportDefinitionFromLegacyTemplate,
  createReportDefinitionChecksum,
  reportDefinitionService,
} from '../../../packages/core/services/reportDefinitions.js';

const TEMPLATE_ID = '11111111-1111-4111-8111-111111111111';
const TEMPLATE_VERSION_ID = '22222222-2222-4222-8222-222222222222';
const CLINICAL_DOCUMENT_ID = '33333333-3333-4333-8333-333333333333';
const USER_ID = '44444444-4444-4444-8444-444444444444';
const DEFAULT_TEMPLATE_SPECS_DIR = resolve('docs/specs/default-templates');

const VALID_DEFINITION = {
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
      type: 'header',
      bindings: ['tenant.display_name', 'doctor.full_name'],
    },
    {
      type: 'section',
      key: 'patient_info',
      title: { en: 'Patient information' },
      fields: [
        {
          key: 'patient_name',
          label: { en: 'Patient name' },
          type: 'text',
          binding: 'patient.full_name',
        },
      ],
    },
  ],
};

const VERSION_ROW = {
  id: TEMPLATE_VERSION_ID,
  template_id: TEMPLATE_ID,
  version_number: 1,
  status: 'draft',
  is_current: false,
  schema_version: '2',
  authoring_mode: 'flow_document',
  render_profile: 'gotenberg_html',
  locale: 'en',
  direction: 'ltr',
  definition: VALID_DEFINITION,
  definition_checksum: 'a'.repeat(64),
  created_by: USER_ID,
  published_by: null,
  published_at: null,
  created_at: '2026-05-15T10:00:00Z',
  updated_at: '2026-05-15T10:00:00Z',
};

const LEGACY_TEMPLATE = {
  id: TEMPLATE_ID,
  name: 'Lab Request Form',
  template_type: 'lab_request',
  sections: [
    {
      key: 'patient_info',
      title: 'Patient information',
      fields: [
        {
          key: 'patient_name',
          label: 'Patient name',
          type: 'text',
          autofill: 'patient.full_name',
          required: true,
        },
        {
          key: 'request_notes',
          label: 'Clinical notes',
          type: 'static_text',
          content: 'Attach previous lab results when available.',
        },
      ],
    },
    {
      key: 'tests',
      title: 'Tests',
      fields: [{
        key: 'requested_tests',
        label: 'Requested tests',
        type: 'checkbox_grid',
        groups: [{
          label: 'Hematology',
          items: ['CBC', 'ESR'],
        }],
      }],
    },
    {
      key: 'signature',
      title: 'Signature',
      fields: [{
        key: 'doctor_signature',
        label: 'Doctor signature',
        type: 'signature',
      }],
    },
  ],
};

let mock;
let previousClient;

beforeEach(() => {
  mock = createSupabaseMock();
  previousClient = __setSupabaseClientForTest(mock.client);
});

afterEach(() => {
  __setSupabaseClientForTest(previousClient);
});

describe('createReportDefinitionChecksum', () => {
  it('returns the same checksum for equivalent object key ordering', async () => {
    const left = {
      schemaVersion: '2',
      nested: { b: 2, a: 1 },
      blocks: [{ type: 'header', bindings: ['doctor.full_name'] }],
    };
    const right = {
      blocks: [{ bindings: ['doctor.full_name'], type: 'header' }],
      nested: { a: 1, b: 2 },
      schemaVersion: '2',
    };

    assert.equal(
      await createReportDefinitionChecksum(left),
      await createReportDefinitionChecksum(right)
    );
  });
});

describe('createReportDefinitionFromLegacyTemplate', () => {
  it('converts legacy sections into a valid v2 report definition without losing form semantics', () => {
    const result = createReportDefinitionFromLegacyTemplate(LEGACY_TEMPLATE);

    assert.equal(result.error, null);
    assert.equal(result.data.schemaVersion, '2');
    assert.equal(result.data.authoringMode, 'flow_document');
    assert.equal(result.data.renderProfile, 'edge_pdf_lib');
    assert.equal(result.data.blocks[0].type, 'section');
    assert.equal(result.data.blocks[0].fields[0].binding, 'patient.full_name');
    assert.equal(result.data.blocks[0].fields[1].type, 'static_text');
    assert.equal(result.data.blocks[0].fields[1].content, 'Attach previous lab results when available.');
    assert.equal(result.data.blocks[1].fields[0].type, 'checkbox_grid');
    assert.equal(result.data.blocks[1].fields[0].groups[0].items[0].en, 'CBC');
    assert.ok(result.data.blocks.some((block) => block.type === 'signature'));
  });

  it('routes Arabic legacy conversions to the advanced renderer without forcing English templates onto it', () => {
    const english = createReportDefinitionFromLegacyTemplate(LEGACY_TEMPLATE);
    const arabic = createReportDefinitionFromLegacyTemplate(LEGACY_TEMPLATE, { locale: 'ar-LB' });

    assert.equal(english.error, null);
    assert.equal(english.data.renderProfile, 'edge_pdf_lib');
    assert.equal(english.data.direction, 'ltr');

    assert.equal(arabic.error, null);
    assert.equal(arabic.data.renderProfile, 'gotenberg_html');
    assert.equal(arabic.data.direction, 'rtl');
  });

  it('rejects legacy templates with unsupported autofill bindings', () => {
    const result = createReportDefinitionFromLegacyTemplate({
      ...LEGACY_TEMPLATE,
      sections: [{
        key: 'bad',
        title: 'Bad',
        fields: [{
          key: 'private_notes',
          label: 'Private notes',
          type: 'text',
          autofill: 'patient.private_notes',
        }],
      }],
    });

    assert.equal(result.data, null);
    assert.match(result.error, /invalid|binding|option/i);
  });

  it('converts every seeded default template spec into a valid v2 report definition', () => {
    for (const filename of [
      'medical-referral.json',
      'medical-report.json',
      'lab-request.json',
    ]) {
      const template = {
        id: TEMPLATE_ID,
        ...JSON.parse(readFileSync(resolve(DEFAULT_TEMPLATE_SPECS_DIR, filename), 'utf8')),
      };

      const result = createReportDefinitionFromLegacyTemplate(template);

      assert.equal(result.error, null, `${filename} should convert without losing supported bindings`);
      assert.equal(result.data.schemaVersion, '2');
      assert.ok(result.data.blocks.length >= template.sections.length - 1);
    }
  });
});

describe('reportDefinitionService.createVersion', () => {
  it('validates the definition, computes checksum, flattens metadata, and inserts a version row', async () => {
    mock.onFrom('document_template_versions', ({ callEntry }) => {
      const insert = callEntry.modifiers.find((m) => m.method === 'insert');
      const [rows] = insert.args;
      const row = rows[0];

      assert.equal(row.schema_version, '2');
      assert.equal(row.authoring_mode, 'flow_document');
      assert.equal(row.render_profile, 'gotenberg_html');
      assert.equal(row.locale, 'en');
      assert.equal(row.direction, 'ltr');
      assert.match(row.definition_checksum, /^[a-f0-9]{64}$/);

      return {
        data: { ...VERSION_ROW, definition_checksum: row.definition_checksum },
        error: null,
      };
    });

    const result = await reportDefinitionService.createVersion({
      template_id: TEMPLATE_ID,
      version_number: 1,
      definition: VALID_DEFINITION,
      created_by: USER_ID,
    });

    assert.equal(result.error, null);
    assert.equal(result.data.template_id, TEMPLATE_ID);
    const calls = mock.calls.from.filter((call) => call.table === 'document_template_versions');
    assert.equal(calls.length, 1);
    assert.ok(calls[0].modifiers.some((modifier) => modifier.method === 'insert'));
  });

  it('rejects unsafe raw HTML definitions before calling Supabase', async () => {
    const result = await reportDefinitionService.createVersion({
      template_id: TEMPLATE_ID,
      version_number: 1,
      definition: {
        ...VALID_DEFINITION,
        blocks: [{ type: 'html', html: '<script>alert(1)</script>' }],
      },
      created_by: USER_ID,
    });

    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    assert.equal(mock.calls.from.length, 0);
  });

  it('rejects caller-supplied checksum mismatches', async () => {
    const result = await reportDefinitionService.createVersion({
      template_id: TEMPLATE_ID,
      version_number: 1,
      definition: VALID_DEFINITION,
      definition_checksum: 'b'.repeat(64),
      created_by: USER_ID,
    });

    assert.equal(result.data, null);
    assert.match(result.error, /checksum/i);
    assert.equal(mock.calls.from.length, 0);
  });

  it('requires a publisher when creating a published version', async () => {
    const result = await reportDefinitionService.createVersion({
      template_id: TEMPLATE_ID,
      version_number: 1,
      status: 'published',
      is_current: true,
      definition: VALID_DEFINITION,
      created_by: USER_ID,
    });

    assert.equal(result.data, null);
    assert.match(result.error, /published_by/i);
    assert.equal(mock.calls.from.length, 0);
  });
});

describe('reportDefinitionService.createVersionFromLegacyTemplate', () => {
  it('converts and stores a legacy template as version 1', async () => {
    mock.onFrom('document_template_versions', ({ callEntry }) => {
      const insert = callEntry.modifiers.find((m) => m.method === 'insert');
      const [rows] = insert.args;
      const row = rows[0];

      assert.equal(row.template_id, TEMPLATE_ID);
      assert.equal(row.version_number, 1);
      assert.equal(row.definition.schemaVersion, '2');
      assert.equal(row.definition.blocks[0].fields[0].binding, 'patient.full_name');

      return {
        data: { ...VERSION_ROW, definition: row.definition, definition_checksum: row.definition_checksum },
        error: null,
      };
    });

    const result = await reportDefinitionService.createVersionFromLegacyTemplate(LEGACY_TEMPLATE, {
      createdBy: USER_ID,
    });

    assert.equal(result.error, null);
    assert.equal(result.data.template_id, TEMPLATE_ID);
  });
});

describe('reportDefinitionService.getCurrentVersion', () => {
  it('loads the current published version for a template and locale', async () => {
    mock.onFrom('document_template_versions', () => ({ data: VERSION_ROW, error: null }));

    const result = await reportDefinitionService.getCurrentVersion(TEMPLATE_ID, { locale: 'en' });

    assert.equal(result.error, null);
    assert.equal(result.data.id, TEMPLATE_VERSION_ID);
    const calls = mock.calls.from.filter((call) => call.table === 'document_template_versions');
    assert.equal(calls.length, 1);
    assert.ok(calls[0].modifiers.some((m) => m.method === 'eq' && m.args[0] === 'template_id'));
    assert.ok(calls[0].modifiers.some((m) => m.method === 'eq' && m.args[0] === 'is_current'));
    assert.ok(calls[0].modifiers.some((m) => m.method === 'eq' && m.args[0] === 'locale'));
  });
});

describe('reportDefinitionService.createRenderJob', () => {
  it('validates and creates a queued render job without PHI payload fields', async () => {
    mock.onFrom('document_render_jobs', ({ callEntry }) => {
      const insert = callEntry.modifiers.find((m) => m.method === 'insert');
      const [rows] = insert.args;
      const row = rows[0];

      assert.equal(row.status, 'queued');
      assert.equal(row.clinical_document_id, CLINICAL_DOCUMENT_ID);
      assert.equal(row.template_version_id, TEMPLATE_VERSION_ID);
      assert.equal(Object.hasOwn(row, 'payload'), false);
      assert.equal(Object.hasOwn(row, 'content'), false);

      return { data: { id: '55555555-5555-4555-8555-555555555555', ...row }, error: null };
    });

    const result = await reportDefinitionService.createRenderJob({
      clinical_document_id: CLINICAL_DOCUMENT_ID,
      template_version_id: TEMPLATE_VERSION_ID,
      render_profile: 'gotenberg_html',
      requested_by: USER_ID,
    });

    assert.equal(result.error, null);
    assert.equal(result.data.status, 'queued');
  });
});

describe('reportDefinitionService.createAsset', () => {
  it('validates and stores only safe asset metadata', async () => {
    mock.onFrom('document_template_assets', ({ callEntry }) => {
      const insert = callEntry.modifiers.find((m) => m.method === 'insert');
      const [rows] = insert.args;
      const row = rows[0];

      assert.equal(row.asset_type, 'logo');
      assert.equal(row.content_type, 'image/png');
      assert.equal(row.scan_status, 'passed');
      assert.equal(Object.hasOwn(row, 'bytes'), false);
      assert.equal(Object.hasOwn(row, 'url'), false);

      return {
        data: {
          id: '66666666-6666-4666-8666-666666666666',
          ...row,
          is_archived: false,
          created_at: '2026-05-15T10:00:00Z',
          updated_at: '2026-05-15T10:00:00Z',
        },
        error: null,
      };
    });

    const result = await reportDefinitionService.createAsset({
      template_id: TEMPLATE_ID,
      asset_type: 'logo',
      storage_bucket: 'template-assets',
      storage_path: 'templates/11111111/logo.png',
      content_type: 'image/png',
      byte_size: 120_000,
      checksum: 'c'.repeat(64),
      image_width_px: 512,
      image_height_px: 256,
      scan_status: 'passed',
      uploaded_by: USER_ID,
    });

    assert.equal(result.error, null);
    assert.equal(result.data.asset_type, 'logo');
  });

  it('rejects unsafe asset metadata before calling Supabase', async () => {
    const result = await reportDefinitionService.createAsset({
      template_id: TEMPLATE_ID,
      asset_type: 'logo',
      storage_bucket: 'template-assets',
      storage_path: 'https://example.com/logo.png',
      content_type: 'image/png',
      byte_size: 120_000,
      checksum: 'c'.repeat(64),
      image_width_px: 512,
      image_height_px: 256,
      scan_status: 'passed',
      uploaded_by: USER_ID,
    });

    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    assert.equal(mock.calls.from.length, 0);
  });
});
