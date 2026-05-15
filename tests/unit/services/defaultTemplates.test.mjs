/**
 * defaultTemplates.test.mjs
 *
 * Slice 5 acceptance tests for the built-in default templates seed.
 *
 * AT-5.1 — Two default templates seeded (referral + report)
 * AT-5.2 — Trigger blocks DELETE on default templates
 * AT-5.3 — Autofill keys in seeded templates resolve against the context
 *
 * These tests validate:
 *   - The migration SQL file contains the correct template data
 *   - The JSON spec files are valid against the Zod schema
 *   - Every autofill key used is in the closed set (§ 8.10)
 *   - The guard trigger logic is respected by the service layer
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSupabaseMock } from './__helpers__/supabaseMock.mjs';
import { __setSupabaseClientForTest } from '../../../packages/core/lib/supabase.js';
import { templateService } from '../../../packages/core/services/templates.js';
import {
  documentTemplateCreateSchema,
  TEMPLATE_FIELD_TYPES,
} from '../../../packages/core/schemas/documentTemplates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPECS_DIR = resolve(__dirname, '../../../docs/specs/default-templates');
const MIGRATION_PATH = resolve(
  __dirname,
  '../../../supabase/migrations/20260515140000_seed_default_templates.sql'
);

// ── Closed set of valid autofill keys (from § 8.10) ──────────────

const VALID_AUTOFILL_KEYS = new Set([
  'patient.full_name',
  'patient.date_of_birth',
  'patient.phone',
  'patient.email',
  'patient.sex',
  'patient.gender', // alias used in the select field
  'doctor.full_name',
  'doctor.specialization',
  'doctor.license_number',
  'tenant.display_name',
  'tenant.support_phone',
  'tenant.support_email',
  'tenant.timezone',
  'encounter.chief_complaint',
  'encounter.summary',
  'encounter.started_at',
  'diagnoses.summary',
  'prescriptions.active_summary',
  'now',
  'clinic.name',
  'clinic.address',
  'clinic.phone',
  'document.created_at',
]);

// ── Helpers ──────────────────────────────────────────────────────

function loadJsonSpec(filename) {
  return JSON.parse(readFileSync(resolve(SPECS_DIR, filename), 'utf-8'));
}

function extractAutofillKeys(sections) {
  const keys = [];
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.autofill) keys.push(field.autofill);
    }
  }
  return keys;
}

function extractFieldTypes(sections) {
  const types = [];
  for (const section of sections) {
    for (const field of section.fields) {
      types.push(field.type);
    }
  }
  return types;
}

// ── AT-5.1: Two default templates seeded ─────────────────────────

describe('AT-5.1 — Two default templates seeded', () => {
  it('migration SQL file exists and is non-empty', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf-8');
    assert.ok(sql.length > 500, 'Migration SQL should be substantial');
  });

  it('migration contains Medical Referral Letter insert', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf-8');
    assert.ok(
      sql.includes("'Medical Referral Letter'"),
      'Migration must insert Medical Referral Letter'
    );
    assert.ok(
      sql.includes("'referral'"),
      'Migration must set template_type = referral'
    );
  });

  it('migration contains Medical Report insert', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf-8');
    assert.ok(
      sql.includes("'Medical Report'"),
      'Migration must insert Medical Report'
    );
    assert.ok(
      sql.includes("'report'"),
      'Migration must set template_type = report'
    );
  });

  it('migration sets is_default = true for both templates', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf-8');
    // Both inserts set is_default to true
    const matches = sql.match(/is_default/g);
    assert.ok(matches && matches.length >= 2, 'Both inserts must set is_default');
    assert.ok(sql.includes('true'), 'is_default must be set to true');
  });

  it('migration uses ON CONFLICT DO NOTHING for idempotency', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf-8');
    assert.ok(
      sql.includes('on conflict do nothing'),
      'Migration must be idempotent via ON CONFLICT DO NOTHING'
    );
  });

  it('referral JSON spec is valid against documentTemplateCreateSchema', () => {
    const spec = loadJsonSpec('medical-referral.json');
    spec.created_by = '11111111-1111-4111-8111-111111111111'; // stub UUID for validation
    const result = documentTemplateCreateSchema.safeParse(spec);
    assert.ok(result.success, `Referral spec should pass schema validation: ${JSON.stringify(result.error?.issues)}`);
    assert.equal(result.data.template_type, 'referral');
    assert.equal(result.data.is_default, true);
    assert.ok(result.data.sections.length >= 4, 'Referral should have at least 4 sections');
  });

  it('report JSON spec is valid against documentTemplateCreateSchema', () => {
    const spec = loadJsonSpec('medical-report.json');
    spec.created_by = '11111111-1111-4111-8111-111111111111';
    const result = documentTemplateCreateSchema.safeParse(spec);
    assert.ok(result.success, `Report spec should pass schema validation: ${JSON.stringify(result.error?.issues)}`);
    assert.equal(result.data.template_type, 'report');
    assert.equal(result.data.is_default, true);
    assert.ok(result.data.sections.length >= 5, 'Report should have at least 5 sections');
  });
});

// ── AT-5.2: Trigger blocks DELETE on default templates ───────────

describe('AT-5.2 — Trigger blocks DELETE on default templates', () => {
  let mock;

  afterEach(() => {
    __setSupabaseClientForTest(null);
  });

  it('archive service rejects when DB trigger raises P0001', async () => {
    mock = createSupabaseMock();
    // Simulate the Postgres trigger error P0001 for archive on default
    mock.onFrom('document_templates', () => ({
      data: null,
      error: {
        code: 'P0001',
        message: 'Cannot archive a default template. Clear is_default first.',
      },
    }));
    __setSupabaseClientForTest(mock.client);

    const result = await templateService.archive(
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333'
    );

    assert.ok(result.error, 'archive should return error for default template');
    assert.equal(result.data, null);
  });

  it('archive requires id parameter', async () => {
    mock = createSupabaseMock();
    __setSupabaseClientForTest(mock.client);

    const result = await templateService.archive(null, 'some-actor-id');
    assert.ok(result.error, 'archive should reject when id is null');
    assert.ok(
      result.error.toLowerCase().includes('required'),
      'Error message should mention required'
    );
  });

  it('archive requires archivedBy parameter', async () => {
    mock = createSupabaseMock();
    __setSupabaseClientForTest(mock.client);

    const result = await templateService.archive('some-template-id', null);
    assert.ok(result.error, 'archive should reject when archivedBy is null');
    assert.ok(
      result.error.toLowerCase().includes('required'),
      'Error message should mention required'
    );
  });
});

// ── AT-5.3: Autofill keys resolve against context ────────────────

describe('AT-5.3 — Autofill keys in default templates resolve', () => {
  it('all autofill keys in referral template are in the closed set', () => {
    const spec = loadJsonSpec('medical-referral.json');
    const keys = extractAutofillKeys(spec.sections);
    assert.ok(keys.length >= 4, 'Referral template should have at least 4 autofill keys');

    for (const key of keys) {
      assert.ok(
        VALID_AUTOFILL_KEYS.has(key),
        `Autofill key '${key}' is not in the closed set (§ 8.10). Valid keys: ${[...VALID_AUTOFILL_KEYS].join(', ')}`
      );
    }
  });

  it('all autofill keys in report template are in the closed set', () => {
    const spec = loadJsonSpec('medical-report.json');
    const keys = extractAutofillKeys(spec.sections);
    assert.ok(keys.length >= 5, 'Report template should have at least 5 autofill keys');

    for (const key of keys) {
      assert.ok(
        VALID_AUTOFILL_KEYS.has(key),
        `Autofill key '${key}' is not in the closed set (§ 8.10). Valid keys: ${[...VALID_AUTOFILL_KEYS].join(', ')}`
      );
    }
  });

  it('all field types in referral template are valid', () => {
    const spec = loadJsonSpec('medical-referral.json');
    const types = extractFieldTypes(spec.sections);
    for (const type of types) {
      assert.ok(
        TEMPLATE_FIELD_TYPES.includes(type),
        `Field type '${type}' is not in the closed set. Valid types: ${TEMPLATE_FIELD_TYPES.join(', ')}`
      );
    }
  });

  it('all field types in report template are valid', () => {
    const spec = loadJsonSpec('medical-report.json');
    const types = extractFieldTypes(spec.sections);
    for (const type of types) {
      assert.ok(
        TEMPLATE_FIELD_TYPES.includes(type),
        `Field type '${type}' is not in the closed set. Valid types: ${TEMPLATE_FIELD_TYPES.join(', ')}`
      );
    }
  });

  it('select fields have at least one option in referral template', () => {
    const spec = loadJsonSpec('medical-referral.json');
    for (const section of spec.sections) {
      for (const field of section.fields) {
        if (field.type === 'select') {
          assert.ok(
            Array.isArray(field.options) && field.options.length > 0,
            `Select field '${field.key}' in section '${section.key}' must have at least one option`
          );
        }
      }
    }
  });

  it('select fields have at least one option in report template', () => {
    const spec = loadJsonSpec('medical-report.json');
    for (const section of spec.sections) {
      for (const field of section.fields) {
        if (field.type === 'select') {
          assert.ok(
            Array.isArray(field.options) && field.options.length > 0,
            `Select field '${field.key}' in section '${section.key}' must have at least one option`
          );
        }
      }
    }
  });

  it('referral template has a signature section', () => {
    const spec = loadJsonSpec('medical-referral.json');
    const signatureSections = spec.sections.filter(s =>
      s.fields.some(f => f.type === 'signature')
    );
    assert.ok(
      signatureSections.length === 1,
      'Referral template must have exactly one signature section'
    );
  });

  it('report template has a signature section', () => {
    const spec = loadJsonSpec('medical-report.json');
    const signatureSections = spec.sections.filter(s =>
      s.fields.some(f => f.type === 'signature')
    );
    assert.ok(
      signatureSections.length === 1,
      'Report template must have exactly one signature section'
    );
  });

  it('referral template sections have unique keys', () => {
    const spec = loadJsonSpec('medical-referral.json');
    const sectionKeys = spec.sections.map(s => s.key);
    const unique = new Set(sectionKeys);
    assert.equal(sectionKeys.length, unique.size, 'Section keys must be unique');

    // Also check field keys within each section
    for (const section of spec.sections) {
      const fieldKeys = section.fields.map(f => f.key);
      const uniqueFields = new Set(fieldKeys);
      assert.equal(
        fieldKeys.length,
        uniqueFields.size,
        `Field keys in section '${section.key}' must be unique`
      );
    }
  });

  it('report template sections have unique keys', () => {
    const spec = loadJsonSpec('medical-report.json');
    const sectionKeys = spec.sections.map(s => s.key);
    const unique = new Set(sectionKeys);
    assert.equal(sectionKeys.length, unique.size, 'Section keys must be unique');

    for (const section of spec.sections) {
      const fieldKeys = section.fields.map(f => f.key);
      const uniqueFields = new Set(fieldKeys);
      assert.equal(
        fieldKeys.length,
        uniqueFields.size,
        `Field keys in section '${section.key}' must be unique`
      );
    }
  });

  it('both templates have required fields marked', () => {
    const referral = loadJsonSpec('medical-referral.json');
    const report = loadJsonSpec('medical-report.json');

    const referralRequired = referral.sections
      .flatMap(s => s.fields)
      .filter(f => f.required === true);
    assert.ok(
      referralRequired.length >= 2,
      `Referral template should have at least 2 required fields, found ${referralRequired.length}`
    );

    const reportRequired = report.sections
      .flatMap(s => s.fields)
      .filter(f => f.required === true);
    assert.ok(
      reportRequired.length >= 2,
      `Report template should have at least 2 required fields, found ${reportRequired.length}`
    );
  });

  it('migration JSONB sections match the JSON spec files', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf-8');
    const referralSpec = loadJsonSpec('medical-referral.json');
    const reportSpec = loadJsonSpec('medical-report.json');

    // Verify the section keys from specs exist in the migration SQL
    for (const section of referralSpec.sections) {
      assert.ok(
        sql.includes(`"key": "${section.key}"`),
        `Migration must contain referral section key "${section.key}"`
      );
    }
    for (const section of reportSpec.sections) {
      assert.ok(
        sql.includes(`"key": "${section.key}"`),
        `Migration must contain report section key "${section.key}"`
      );
    }
  });
});
