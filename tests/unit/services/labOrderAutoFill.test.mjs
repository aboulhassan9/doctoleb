/**
 * labOrderAutoFill.test.mjs
 *
 * Slice 6 acceptance tests for the Lab Request Form template + auto-fill hook.
 *
 * AT-6.1 — Lab template seeded
 * AT-6.2 — lab_orderId pre-checks tests (resolveLabTests maps correctly)
 * AT-6.3 — Unknown title leaves boxes empty
 *
 * These tests validate:
 *   - The lab-request.json spec is valid against the Zod schema
 *   - The migration SQL file contains the correct data
 *   - resolveLabTests correctly maps lab order titles to checkbox_grid items
 *   - Every test item returned by resolveLabTests exists in the template spec
 *   - Unknown/unrecognized titles return an empty array
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  documentTemplateCreateSchema,
  TEMPLATE_FIELD_TYPES,
} from '../../../packages/core/schemas/documentTemplates.js';
import {
  resolveLabTests,
  TITLE_TO_TESTS,
} from '../../../packages/core/lib/labOrderToTestMap.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPECS_DIR = resolve(__dirname, '../../../docs/specs/default-templates');
const MIGRATION_PATH = resolve(
  __dirname,
  '../../../supabase/migrations/20260515150000_seed_lab_request_template.sql'
);

// ── Helpers ──────────────────────────────────────────────────────

function loadJsonSpec(filename) {
  return JSON.parse(readFileSync(resolve(SPECS_DIR, filename), 'utf-8'));
}

/** Extract all test items from all checkbox_grid groups in the template. */
function extractAllTestItems(spec) {
  const items = new Set();
  for (const section of spec.sections) {
    for (const field of section.fields) {
      if (field.type === 'checkbox_grid' && Array.isArray(field.groups)) {
        for (const group of field.groups) {
          for (const item of group.items) {
            items.add(item);
          }
        }
      }
    }
  }
  return items;
}

/** Valid autofill keys (same closed set as defaultTemplates.test.mjs). */
const VALID_AUTOFILL_KEYS = new Set([
  'patient.full_name', 'patient.date_of_birth', 'patient.phone',
  'patient.email', 'patient.sex', 'patient.gender',
  'doctor.full_name', 'doctor.specialization', 'doctor.license_number',
  'tenant.display_name', 'tenant.support_phone', 'tenant.support_email',
  'tenant.timezone', 'encounter.chief_complaint', 'encounter.summary',
  'encounter.started_at', 'diagnoses.summary', 'prescriptions.active_summary',
  'now', 'clinic.name', 'clinic.address', 'clinic.phone', 'document.created_at',
]);

// ── AT-6.1: Lab template seeded ──────────────────────────────────

describe('AT-6.1 — Lab Request Form template seeded', () => {
  it('lab-request.json spec is valid against documentTemplateCreateSchema', () => {
    const spec = loadJsonSpec('lab-request.json');
    spec.created_by = '11111111-1111-4111-8111-111111111111';
    const result = documentTemplateCreateSchema.safeParse(spec);
    assert.ok(
      result.success,
      `Lab request spec should pass schema validation: ${JSON.stringify(result.error?.issues)}`
    );
    assert.equal(result.data.template_type, 'lab_request');
    assert.equal(result.data.is_default, true);
  });

  it('lab template has a checkbox_grid field', () => {
    const spec = loadJsonSpec('lab-request.json');
    const gridFields = spec.sections
      .flatMap(s => s.fields)
      .filter(f => f.type === 'checkbox_grid');
    assert.ok(gridFields.length >= 1, 'Must have at least one checkbox_grid field');
    assert.ok(
      gridFields[0].groups.length >= 8,
      `Checkbox grid must have at least 8 groups, found ${gridFields[0].groups.length}`
    );
  });

  it('migration SQL file exists and contains Lab Request Form', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf-8');
    assert.ok(sql.length > 500, 'Migration SQL should be substantial');
    assert.ok(sql.includes("'Lab Request Form'"), 'Migration must insert Lab Request Form');
    assert.ok(sql.includes("'lab_request'"), 'Migration must set template_type = lab_request');
    assert.ok(sql.includes('on conflict do nothing'), 'Migration must be idempotent');
  });

  it('all autofill keys in lab template are in the closed set', () => {
    const spec = loadJsonSpec('lab-request.json');
    for (const section of spec.sections) {
      for (const field of section.fields) {
        if (field.autofill) {
          assert.ok(
            VALID_AUTOFILL_KEYS.has(field.autofill),
            `Autofill key '${field.autofill}' is not in the closed set (§ 8.10)`
          );
        }
      }
    }
  });

  it('all field types in lab template are valid', () => {
    const spec = loadJsonSpec('lab-request.json');
    for (const section of spec.sections) {
      for (const field of section.fields) {
        assert.ok(
          TEMPLATE_FIELD_TYPES.includes(field.type),
          `Field type '${field.type}' is not in the closed set`
        );
      }
    }
  });

  it('lab template has a signature section', () => {
    const spec = loadJsonSpec('lab-request.json');
    const hasSig = spec.sections.some(s => s.fields.some(f => f.type === 'signature'));
    assert.ok(hasSig, 'Lab template must have a signature section');
  });

  it('lab template section keys are unique', () => {
    const spec = loadJsonSpec('lab-request.json');
    const keys = spec.sections.map(s => s.key);
    assert.equal(keys.length, new Set(keys).size, 'Section keys must be unique');
  });

  it('migration JSONB sections contain the spec section keys', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf-8');
    const spec = loadJsonSpec('lab-request.json');
    for (const section of spec.sections) {
      assert.ok(
        sql.includes(`"key": "${section.key}"`),
        `Migration must contain section key "${section.key}"`
      );
    }
  });
});

// ── AT-6.2: lab_orderId pre-checks tests ─────────────────────────

describe('AT-6.2 — resolveLabTests maps lab order titles correctly', () => {
  const labSpec = loadJsonSpec('lab-request.json');
  const validItems = extractAllTestItems(labSpec);

  it('every test item in TITLE_TO_TESTS exists in the lab-request.json spec', () => {
    for (const entry of TITLE_TO_TESTS) {
      for (const test of entry.tests) {
        assert.ok(
          validItems.has(test),
          `Test item "${test}" (from pattern "${entry.pattern}") is not in lab-request.json checkbox_grid items`
        );
      }
    }
  });

  it('"CBC" title resolves to CBC test', () => {
    const result = resolveLabTests('CBC');
    assert.ok(result.includes('CBC'), `Should include CBC, got: ${result}`);
  });

  it('"Complete Blood Count" resolves to CBC', () => {
    const result = resolveLabTests('Complete Blood Count');
    assert.ok(result.includes('CBC'));
  });

  it('"CBC and Lipid Panel" resolves to both', () => {
    const result = resolveLabTests('CBC and Lipid Panel');
    assert.ok(result.includes('CBC'), 'Should include CBC');
    assert.ok(result.includes('Lipid Panel'), 'Should include Lipid Panel');
  });

  it('"Liver Function Tests" resolves to full liver panel', () => {
    const result = resolveLabTests('Liver Function Tests');
    assert.ok(result.includes('ALT (SGPT)'));
    assert.ok(result.includes('AST (SGOT)'));
    assert.ok(result.includes('ALP'));
    assert.ok(result.includes('Total Bilirubin'));
  });

  it('"LFT" resolves to full liver panel', () => {
    const result = resolveLabTests('LFT');
    assert.ok(result.includes('ALT (SGPT)'));
    assert.ok(result.includes('AST (SGOT)'));
  });

  it('"Thyroid panel" resolves to TSH + Free T4 + Free T3', () => {
    const result = resolveLabTests('Thyroid panel');
    assert.ok(result.includes('TSH'));
    assert.ok(result.includes('Free T4'));
    assert.ok(result.includes('Free T3'));
  });

  it('"TSH only" resolves to just TSH', () => {
    const result = resolveLabTests('TSH only');
    assert.ok(result.includes('TSH'));
    assert.ok(!result.includes('Free T4'), 'Should not include Free T4 for TSH-only');
  });

  it('"Renal function tests" resolves to kidney panel', () => {
    const result = resolveLabTests('Renal function tests');
    assert.ok(result.includes('BUN / Urea'));
    assert.ok(result.includes('Creatinine'));
    assert.ok(result.includes('eGFR'));
    assert.ok(result.includes('Electrolytes (Na/K/Cl)'));
  });

  it('"Pre-operative workup" resolves to pre-op panel', () => {
    const result = resolveLabTests('Pre-operative workup');
    assert.ok(result.includes('CBC'));
    assert.ok(result.includes('Coagulation (PT/INR)'));
    assert.ok(result.includes('Creatinine'));
    assert.ok(result.includes('Electrolytes (Na/K/Cl)'));
  });

  it('"Diabetes screening" resolves to diabetes panel', () => {
    const result = resolveLabTests('Diabetes screening');
    assert.ok(result.includes('FBS / Fasting Glucose'));
    assert.ok(result.includes('HbA1c'));
    assert.ok(result.includes('Creatinine'));
    assert.ok(result.includes('Urine Microalbumin'));
  });

  it('"Hepatitis B screening" resolves to HBsAg', () => {
    const result = resolveLabTests('Hepatitis B screening');
    assert.ok(result.includes('HBsAg'));
  });

  it('"HIV testing" resolves to HIV 1/2', () => {
    const result = resolveLabTests('HIV testing');
    assert.ok(result.includes('HIV 1/2'));
  });

  it('case-insensitive: "cbc" and "CBC" both resolve', () => {
    const lower = resolveLabTests('cbc');
    const upper = resolveLabTests('CBC');
    assert.deepEqual(lower, upper, 'Should be case-insensitive');
    assert.ok(lower.includes('CBC'));
  });

  it('deduplicates results when multiple patterns match the same test', () => {
    // "creatinine" matches both the creatinine entry AND adds eGFR
    const result = resolveLabTests('creatinine eGFR');
    const eGFRCount = result.filter(t => t === 'eGFR').length;
    assert.equal(eGFRCount, 1, 'Should not duplicate eGFR');
  });

  it('all returned tests are in the valid items set', () => {
    for (const entry of TITLE_TO_TESTS) {
      const result = resolveLabTests(entry.pattern);
      for (const test of result) {
        assert.ok(
          validItems.has(test),
          `Resolved test "${test}" is not in lab-request.json spec`
        );
      }
    }
  });
});

// ── AT-6.3: Unknown title leaves boxes empty ─────────────────────

describe('AT-6.3 — Unknown/unrecognized titles return empty array', () => {
  it('empty string returns empty array', () => {
    assert.deepEqual(resolveLabTests(''), []);
  });

  it('null returns empty array', () => {
    assert.deepEqual(resolveLabTests(null), []);
  });

  it('undefined returns empty array', () => {
    assert.deepEqual(resolveLabTests(undefined), []);
  });

  it('whitespace-only string returns empty array', () => {
    assert.deepEqual(resolveLabTests('   '), []);
  });

  it('completely unrecognized title returns empty array', () => {
    assert.deepEqual(resolveLabTests('Something completely unrelated'), []);
  });

  it('"General checkup" with no matching keywords returns empty array', () => {
    assert.deepEqual(resolveLabTests('General checkup please'), []);
  });

  it('"xyz123" returns empty array', () => {
    assert.deepEqual(resolveLabTests('xyz123'), []);
  });

  it('number returns empty array', () => {
    assert.deepEqual(resolveLabTests(42), []);
  });

  it('object returns empty array', () => {
    assert.deepEqual(resolveLabTests({}), []);
  });
});
