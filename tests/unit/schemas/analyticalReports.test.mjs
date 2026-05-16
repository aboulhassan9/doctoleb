/**
 * analyticalReports.test.mjs
 *
 * Locks the closed-set invariants for the doctor-built report engine:
 *   - Every column referenced must be in the source's allowlist.
 *   - Visualization-specific constraints (KPI vs pie vs others) hold.
 *   - Duplicate result keys (group_by alias + aggregation `as`) reject.
 *   - Aggregations that need a column actually carry one.
 *   - is_current on a version is gated to status='published'.
 *
 * If any of these tests fail, a doctor could save a report that either
 * blows up at run time or sneaks past the data-source allowlist. Both are
 * non-negotiable.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  analyticalReportDefinitionSchema,
  analyticalReportCreateSchema,
  analyticalReportVersionCreateSchema,
  analyticalReportRunRequestSchema,
  REPORT_DATA_SOURCES,
  REPORT_AGGREGATION_FUNCTIONS,
  REPORT_FILTER_OPERATORS,
  REPORT_VISUALIZATIONS,
  REPORT_DATA_SOURCE_COLUMNS,
  REPORT_DATA_SOURCE_COLUMN_TYPES,
  REPORT_COLUMN_TYPE_OPERATORS,
  REPORT_COLUMN_TYPE_AGGREGATIONS,
} from '../../../packages/core/schemas/analyticalReports.js';

const APPOINTMENTS_BY_DOCTOR = Object.freeze({
  schemaVersion: '1',
  dataSource: 'appointments',
  groupBy: [{ column: 'doctor_id' }],
  aggregations: [{ fn: 'count', as: 'n' }],
  filters: [{ column: 'status', operator: 'eq', value: 'completed' }],
  orderBy: [{ ref: 'n', dir: 'desc' }],
  limit: 20,
  visualization: { type: 'bar' },
  header: { title: 'Completed appointments by doctor', showFilters: true },
});

describe('analyticalReportDefinitionSchema — closed-set invariants', () => {
  it('accepts the canonical "appointments by doctor" definition', () => {
    const r = analyticalReportDefinitionSchema.safeParse(APPOINTMENTS_BY_DOCTOR);
    assert.equal(r.success, true);
  });

  it('rejects an unknown data source', () => {
    const r = analyticalReportDefinitionSchema.safeParse({
      ...APPOINTMENTS_BY_DOCTOR,
      dataSource: 'raw_sql',
    });
    assert.equal(r.success, false);
  });

  it('rejects a groupBy column not in the source allowlist', () => {
    const r = analyticalReportDefinitionSchema.safeParse({
      ...APPOINTMENTS_BY_DOCTOR,
      groupBy: [{ column: 'patient_full_name' }],
    });
    assert.equal(r.success, false);
    assert.ok(
      r.error.issues.some((i) => /not allowed on data source/.test(i.message)),
    );
  });

  it('rejects a filter column not in the source allowlist', () => {
    const r = analyticalReportDefinitionSchema.safeParse({
      ...APPOINTMENTS_BY_DOCTOR,
      filters: [{ column: 'medications_text', operator: 'eq', value: 'x' }],
    });
    assert.equal(r.success, false);
  });

  it('rejects an aggregation with a column outside the allowlist', () => {
    const r = analyticalReportDefinitionSchema.safeParse({
      ...APPOINTMENTS_BY_DOCTOR,
      aggregations: [{ fn: 'sum', column: 'allergies', as: 'sum_a' }],
    });
    assert.equal(r.success, false);
  });

  it('rejects non-count aggregations without a column', () => {
    const r = analyticalReportDefinitionSchema.safeParse({
      ...APPOINTMENTS_BY_DOCTOR,
      aggregations: [{ fn: 'sum', as: 'total' }],
    });
    assert.equal(r.success, false);
  });

  it('rejects duplicate result keys across groupBy + aggregations', () => {
    const r = analyticalReportDefinitionSchema.safeParse({
      ...APPOINTMENTS_BY_DOCTOR,
      groupBy: [{ column: 'doctor_id', alias: 'n' }], // alias collides with agg.as
      aggregations: [{ fn: 'count', as: 'n' }],
    });
    assert.equal(r.success, false);
  });

  it('KPI viz requires exactly one aggregation and zero groupBy', () => {
    const ok = analyticalReportDefinitionSchema.safeParse({
      ...APPOINTMENTS_BY_DOCTOR,
      groupBy: [],
      aggregations: [{ fn: 'count', as: 'total' }],
      orderBy: [],
      visualization: { type: 'kpi' },
    });
    assert.equal(ok.success, true);

    const tooMany = analyticalReportDefinitionSchema.safeParse({
      ...APPOINTMENTS_BY_DOCTOR,
      visualization: { type: 'kpi' },
    });
    assert.equal(tooMany.success, false);
  });

  it('pie viz requires exactly one groupBy + one aggregation', () => {
    const ok = analyticalReportDefinitionSchema.safeParse({
      ...APPOINTMENTS_BY_DOCTOR,
      visualization: { type: 'pie' },
    });
    assert.equal(ok.success, true);

    const wrong = analyticalReportDefinitionSchema.safeParse({
      ...APPOINTMENTS_BY_DOCTOR,
      groupBy: [{ column: 'doctor_id' }, { column: 'clinic_id' }],
      visualization: { type: 'pie' },
    });
    assert.equal(wrong.success, false);
  });

  it('exposes the closed sets to UI controls', () => {
    assert.ok(REPORT_DATA_SOURCES.includes('appointments'));
    assert.ok(REPORT_AGGREGATION_FUNCTIONS.includes('count'));
    assert.ok(REPORT_FILTER_OPERATORS.includes('in'));
    assert.ok(REPORT_VISUALIZATIONS.includes('bar'));
  });

  it('limit caps at 1000 and floors at 1', () => {
    assert.equal(
      analyticalReportDefinitionSchema.safeParse({ ...APPOINTMENTS_BY_DOCTOR, limit: 0 }).success,
      false,
    );
    assert.equal(
      analyticalReportDefinitionSchema.safeParse({ ...APPOINTMENTS_BY_DOCTOR, limit: 5000 }).success,
      false,
    );
  });

  it('filter is_null / not_null require neither value nor bind', () => {
    const r = analyticalReportDefinitionSchema.safeParse({
      ...APPOINTMENTS_BY_DOCTOR,
      filters: [{ column: 'duration_minutes', operator: 'is_null' }],
    });
    assert.equal(r.success, true);
  });

  it('filter eq must have either value or bind', () => {
    const r = analyticalReportDefinitionSchema.safeParse({
      ...APPOINTMENTS_BY_DOCTOR,
      filters: [{ column: 'status', operator: 'eq' }],
    });
    assert.equal(r.success, false);
  });
});

describe('analyticalReportCreateSchema', () => {
  it('accepts a typical clinical_activity report', () => {
    const r = analyticalReportCreateSchema.safeParse({
      name: 'Monthly visits',
      category: 'clinical_activity',
      created_by: '11111111-1111-4111-8111-111111111111',
    });
    assert.equal(r.success, true);
  });

  it('rejects an unknown category', () => {
    const r = analyticalReportCreateSchema.safeParse({
      name: 'X',
      category: 'random',
      created_by: '11111111-1111-4111-8111-111111111111',
    });
    assert.equal(r.success, false);
  });
});

describe('analyticalReportVersionCreateSchema', () => {
  it('rejects is_current=true on a draft version', () => {
    const r = analyticalReportVersionCreateSchema.safeParse({
      report_id: '11111111-1111-4111-8111-111111111111',
      version_number: 1,
      status: 'draft',
      is_current: true,
      definition: APPOINTMENTS_BY_DOCTOR,
      definition_checksum: 'a'.repeat(64),
      created_by: '22222222-2222-4222-8222-222222222222',
    });
    assert.equal(r.success, false);
  });

  it('requires published_by when status=published', () => {
    const r = analyticalReportVersionCreateSchema.safeParse({
      report_id: '11111111-1111-4111-8111-111111111111',
      version_number: 1,
      status: 'published',
      definition: APPOINTMENTS_BY_DOCTOR,
      definition_checksum: 'a'.repeat(64),
      created_by: '22222222-2222-4222-8222-222222222222',
    });
    assert.equal(r.success, false);
  });

  it('rejects checksum that does not match the SHA-256 hex shape', () => {
    const r = analyticalReportVersionCreateSchema.safeParse({
      report_id: '11111111-1111-4111-8111-111111111111',
      version_number: 1,
      definition: APPOINTMENTS_BY_DOCTOR,
      definition_checksum: 'nope',
      created_by: '22222222-2222-4222-8222-222222222222',
    });
    assert.equal(r.success, false);
  });
});

describe('analyticalReportRunRequestSchema', () => {
  it('requires exactly one of report_id or version_id', () => {
    const both = analyticalReportRunRequestSchema.safeParse({
      report_id: '11111111-1111-4111-8111-111111111111',
      version_id: '22222222-2222-4222-8222-222222222222',
      requested_by: '33333333-3333-4333-8333-333333333333',
    });
    assert.equal(both.success, false);

    const neither = analyticalReportRunRequestSchema.safeParse({
      requested_by: '33333333-3333-4333-8333-333333333333',
    });
    assert.equal(neither.success, false);

    const ok = analyticalReportRunRequestSchema.safeParse({
      report_id: '11111111-1111-4111-8111-111111111111',
      requested_by: '33333333-3333-4333-8333-333333333333',
    });
    assert.equal(ok.success, true);
  });
});

// ── Column-type metadata invariants ──────────────────────────────────

const KNOWN_COLUMN_TYPES = ['timestamp', 'date', 'number', 'enum', 'boolean', 'text', 'uuid'];

describe('REPORT_DATA_SOURCE_COLUMN_TYPES — closed-set invariants', () => {
  it('every data source in REPORT_DATA_SOURCE_COLUMNS has a type map', () => {
    for (const ds of Object.keys(REPORT_DATA_SOURCE_COLUMNS)) {
      assert.ok(REPORT_DATA_SOURCE_COLUMN_TYPES[ds], `Missing type map for data source "${ds}"`);
    }
  });

  it('every column in REPORT_DATA_SOURCE_COLUMNS has a type entry', () => {
    for (const [ds, cols] of Object.entries(REPORT_DATA_SOURCE_COLUMNS)) {
      const typeMap = REPORT_DATA_SOURCE_COLUMN_TYPES[ds];
      for (const col of cols) {
        assert.ok(typeMap[col], `Column "${col}" in "${ds}" has no type entry`);
      }
    }
  });

  it('every type value is a known column type', () => {
    for (const [ds, typeMap] of Object.entries(REPORT_DATA_SOURCE_COLUMN_TYPES)) {
      for (const [col, meta] of Object.entries(typeMap)) {
        assert.ok(
          KNOWN_COLUMN_TYPES.includes(meta.type),
          `Column "${col}" in "${ds}" has unknown type "${meta.type}"`,
        );
      }
    }
  });

  it('every type entry has a label string', () => {
    for (const [ds, typeMap] of Object.entries(REPORT_DATA_SOURCE_COLUMN_TYPES)) {
      for (const [col, meta] of Object.entries(typeMap)) {
        assert.equal(typeof meta.label, 'string', `Column "${col}" in "${ds}" has non-string label`);
      }
    }
  });

  it('no extra columns in type map beyond the column allowlist', () => {
    for (const [ds, typeMap] of Object.entries(REPORT_DATA_SOURCE_COLUMN_TYPES)) {
      const allowedCols = REPORT_DATA_SOURCE_COLUMNS[ds];
      for (const col of Object.keys(typeMap)) {
        assert.ok(
          allowedCols.includes(col),
          `Type map for "${ds}" has extra column "${col}" not in REPORT_DATA_SOURCE_COLUMNS`,
        );
      }
    }
  });
});

describe('REPORT_COLUMN_TYPE_OPERATORS — closed-set invariants', () => {
  it('every known column type has an operator list', () => {
    for (const ct of KNOWN_COLUMN_TYPES) {
      assert.ok(REPORT_COLUMN_TYPE_OPERATORS[ct], `Missing operator list for column type "${ct}"`);
    }
  });

  it('every listed operator is in REPORT_FILTER_OPERATORS', () => {
    for (const [ct, ops] of Object.entries(REPORT_COLUMN_TYPE_OPERATORS)) {
      for (const op of ops) {
        assert.ok(
          REPORT_FILTER_OPERATORS.includes(op),
          `Operator "${op}" for column type "${ct}" not in REPORT_FILTER_OPERATORS`,
        );
      }
    }
  });

  it('no unknown column types in the operator map', () => {
    for (const ct of Object.keys(REPORT_COLUMN_TYPE_OPERATORS)) {
      assert.ok(
        KNOWN_COLUMN_TYPES.includes(ct),
        `Unknown column type "${ct}" in REPORT_COLUMN_TYPE_OPERATORS`,
      );
    }
  });
});

describe('REPORT_COLUMN_TYPE_AGGREGATIONS — closed-set invariants', () => {
  it('every known column type has an aggregation list', () => {
    for (const ct of KNOWN_COLUMN_TYPES) {
      assert.ok(REPORT_COLUMN_TYPE_AGGREGATIONS[ct], `Missing aggregation list for column type "${ct}"`);
    }
  });

  it('every listed aggregation is in REPORT_AGGREGATION_FUNCTIONS', () => {
    for (const [ct, aggs] of Object.entries(REPORT_COLUMN_TYPE_AGGREGATIONS)) {
      for (const agg of aggs) {
        assert.ok(
          REPORT_AGGREGATION_FUNCTIONS.includes(agg),
          `Aggregation "${agg}" for column type "${ct}" not in REPORT_AGGREGATION_FUNCTIONS`,
        );
      }
    }
  });

  it('no unknown column types in the aggregation map', () => {
    for (const ct of Object.keys(REPORT_COLUMN_TYPE_AGGREGATIONS)) {
      assert.ok(
        KNOWN_COLUMN_TYPES.includes(ct),
        `Unknown column type "${ct}" in REPORT_COLUMN_TYPE_AGGREGATIONS`,
      );
    }
  });

  it('sum and avg only appear for number-type columns', () => {
    for (const [ct, aggs] of Object.entries(REPORT_COLUMN_TYPE_AGGREGATIONS)) {
      if (ct !== 'number') {
        assert.ok(!aggs.includes('sum'), `"sum" should not be allowed for non-number type "${ct}"`);
        assert.ok(!aggs.includes('avg'), `"avg" should not be allowed for non-number type "${ct}"`);
      }
    }
  });
});
