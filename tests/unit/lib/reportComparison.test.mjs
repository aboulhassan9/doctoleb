/**
 * Unit tests for the period-over-period comparison helpers.
 * Pure functions — no DB, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PREVIOUS_KEY_SUFFIX,
  resolveComparisonWindow,
  buildPreviousRun,
  mergeComparisonRows,
} from '../../../packages/core/lib/reportComparison.js';

const FROM = '2026-04-01T00:00:00.000Z';
const TO = '2026-05-01T00:00:00.000Z';

function baseDefinition(period = 'previous_period', extraFilters = []) {
  return {
    schemaVersion: '1',
    dataSource: 'appointments',
    groupBy: [{ column: 'doctor_id' }],
    aggregations: [{ fn: 'count', as: 'visits' }],
    filters: [
      { column: 'scheduled_at', operator: 'gte', value: FROM },
      { column: 'scheduled_at', operator: 'lt', value: TO },
      ...extraFilters,
    ],
    comparison: { column: 'scheduled_at', period },
  };
}

test('resolveComparisonWindow reads the window from inline date filters', () => {
  const window = resolveComparisonWindow(baseDefinition(), {});
  assert.equal(window.error, undefined);
  assert.equal(window.from.toISOString(), FROM);
  assert.equal(window.to.toISOString(), TO);
});

test('resolveComparisonWindow errors when there is no lower bound', () => {
  const def = baseDefinition();
  def.filters = [{ column: 'scheduled_at', operator: 'lt', value: TO }];
  const window = resolveComparisonWindow(def, {});
  assert.match(window.error, /on or after/i);
});

test('resolveComparisonWindow resolves a bound filter from filterArgs', () => {
  const def = {
    ...baseDefinition(),
    filters: [{ column: 'scheduled_at', operator: 'gte', bind: 'from_date' }],
  };
  const window = resolveComparisonWindow(def, { from_date: FROM });
  assert.equal(window.error, undefined);
  assert.equal(window.from.toISOString(), FROM);
});

test('buildPreviousRun shifts inline filters back one full period and drops comparison', () => {
  const def = baseDefinition('previous_period');
  const window = resolveComparisonWindow(def, {});
  const { definition, filterArgs } = buildPreviousRun(def, {}, window);

  const span = Date.parse(TO) - Date.parse(FROM);
  const expectedGte = new Date(Date.parse(FROM) - span).toISOString();
  const expectedLt = new Date(Date.parse(TO) - span).toISOString();

  const gte = definition.filters.find((f) => f.operator === 'gte');
  const lt = definition.filters.find((f) => f.operator === 'lt');
  assert.equal(gte.value, expectedGte);
  assert.equal(lt.value, expectedLt);
  assert.equal(definition.comparison, undefined);
  // Non-comparison filters are untouched, filterArgs unchanged.
  assert.deepEqual(filterArgs, {});
});

test('buildPreviousRun with previous_year shifts back one calendar year', () => {
  const def = baseDefinition('previous_year');
  const window = resolveComparisonWindow(def, {});
  const { definition } = buildPreviousRun(def, {}, window);
  const gte = definition.filters.find((f) => f.operator === 'gte');
  assert.equal(gte.value, '2025-04-01T00:00:00.000Z');
});

test('buildPreviousRun shifts bound filter values via filterArgs', () => {
  const def = {
    ...baseDefinition('previous_period'),
    filters: [
      { column: 'scheduled_at', operator: 'gte', bind: 'from_date' },
      { column: 'scheduled_at', operator: 'lt', bind: 'to_date' },
    ],
  };
  const args = { from_date: FROM, to_date: TO };
  const window = resolveComparisonWindow(def, args);
  const { filterArgs } = buildPreviousRun(def, args, window);
  const span = Date.parse(TO) - Date.parse(FROM);
  assert.equal(filterArgs.from_date, new Date(Date.parse(FROM) - span).toISOString());
  assert.equal(filterArgs.to_date, new Date(Date.parse(TO) - span).toISOString());
});

test('mergeComparisonRows pairs each measure with its previous value', () => {
  const baseDef = {
    groupBy: [{ column: 'doctor_id' }],
    aggregations: [{ fn: 'count', as: 'visits' }],
  };
  const current = [{ doctor_id: 'a', visits: 10 }, { doctor_id: 'b', visits: 5 }];
  const previous = [{ doctor_id: 'a', visits: 8 }, { doctor_id: 'c', visits: 3 }];
  const merged = mergeComparisonRows(current, previous, baseDef);

  const byDoctor = Object.fromEntries(merged.map((r) => [r.doctor_id, r]));
  assert.equal(byDoctor.a.visits, 10);
  assert.equal(byDoctor.a[`visits${PREVIOUS_KEY_SUFFIX}`], 8);
  // Group present only in the current period → 0 for the previous side.
  assert.equal(byDoctor.b.visits, 5);
  assert.equal(byDoctor.b[`visits${PREVIOUS_KEY_SUFFIX}`], 0);
  // Group present only in the previous period → 0 for the current side.
  assert.equal(byDoctor.c.visits, 0);
  assert.equal(byDoctor.c[`visits${PREVIOUS_KEY_SUFFIX}`], 3);
  assert.equal(merged.length, 3);
});

test('mergeComparisonRows handles the KPI case (no group-by)', () => {
  const baseDef = {
    groupBy: [],
    aggregations: [{ fn: 'sum', column: 'amount', as: 'total' }],
  };
  const merged = mergeComparisonRows([{ total: 100 }], [{ total: 80 }], baseDef);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].total, 100);
  assert.equal(merged[0][`total${PREVIOUS_KEY_SUFFIX}`], 80);
});
