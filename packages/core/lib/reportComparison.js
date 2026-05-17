/**
 * reportComparison.js — period-over-period comparison for analytical reports.
 *
 * A report with a `comparison` block is executed twice: once for the
 * current window and once shifted back in time. The two result sets are
 * merged into a single dual-series dataset so a chart can draw "this
 * period" against "the period before".
 *
 * The current window is derived from the report's own date filters on the
 * comparison column — there is no separate window config. `previous_period`
 * slides the window back by its own span; `previous_year` shifts it back
 * one calendar year.
 *
 * These are pure functions — the service wires them to the RPC, and they
 * are unit-tested in isolation (tests/unit/lib/reportComparison.test.mjs).
 */

/** Suffix appended to a measure key to hold the earlier period's value. */
export const PREVIOUS_KEY_SUFFIX = '__prev';

const LOWER_BOUND_OPERATORS = new Set(['gte', 'gt']);
const UPPER_BOUND_OPERATORS = new Set(['lte', 'lt']);

/** Resolve a filter's effective value — a bound filter reads from filterArgs. */
function effectiveFilterValue(filter, filterArgs) {
  if (filter.bind) return filterArgs ? filterArgs[filter.bind] : undefined;
  return filter.value;
}

function toDate(value) {
  if (value == null || value === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Determine the current [from, to) window from the report's filters on the
 * comparison column. Returns `{ from, to }` (Date objects) or `{ error }`.
 */
export function resolveComparisonWindow(definition, filterArgs = {}) {
  const comparison = definition && definition.comparison;
  if (!comparison) return { error: 'No comparison is configured on this report.' };

  const column = comparison.column;
  let lower = null;
  let upper = null;

  for (const filter of (definition.filters || [])) {
    if (filter.column !== column) continue;
    const date = toDate(effectiveFilterValue(filter, filterArgs));
    if (!date) continue;
    if (LOWER_BOUND_OPERATORS.has(filter.operator)) {
      if (!lower || date > lower) lower = date; // keep the tightest lower bound
    } else if (UPPER_BOUND_OPERATORS.has(filter.operator)) {
      if (!upper || date < upper) upper = date; // keep the tightest upper bound
    }
  }

  if (!lower) {
    return { error: `Period comparison needs an "on or after" date filter on ${column}.` };
  }
  const to = upper || new Date();
  if (to <= lower) {
    return { error: 'Period comparison date range is empty.' };
  }
  return { from: lower, to };
}

function shiftDate(date, period, spanMs) {
  if (period === 'previous_year') {
    const shifted = new Date(date.getTime());
    shifted.setFullYear(shifted.getFullYear() - 1);
    return shifted;
  }
  // previous_period — slide back by the window's own span
  return new Date(date.getTime() - spanMs);
}

/**
 * Build the "previous period" run from the base definition. Date filters on
 * the comparison column are shifted back; the `comparison` block is dropped
 * so the shifted definition runs as a plain single query.
 *
 * Returns `{ definition, filterArgs }` ready to hand to `runDefinition`.
 */
export function buildPreviousRun(definition, filterArgs, window) {
  const comparison = definition.comparison;
  const spanMs = window.to.getTime() - window.from.getTime();
  const nextArgs = { ...(filterArgs || {}) };

  const nextFilters = (definition.filters || []).map((filter) => {
    if (filter.column !== comparison.column) return filter;
    const date = toDate(effectiveFilterValue(filter, filterArgs));
    if (!date) return filter;
    const shifted = shiftDate(date, comparison.period, spanMs).toISOString();
    if (filter.bind) {
      nextArgs[filter.bind] = shifted;
      return filter;
    }
    return { ...filter, value: shifted };
  });

  const base = { ...definition, filters: nextFilters };
  delete base.comparison;
  return { definition: base, filterArgs: nextArgs };
}

/**
 * Merge current + previous result rows into one dual-series dataset.
 * Each measure `m` keeps its current value; the earlier period's value
 * lands on `m + PREVIOUS_KEY_SUFFIX`. Rows are matched on the group-by
 * keys; a group present in only one period gets 0 for the missing side.
 */
export function mergeComparisonRows(currentRows, previousRows, baseDefinition) {
  const groupKeys = (baseDefinition.groupBy || []).map((g) => g.alias || g.column);
  const measures = (baseDefinition.aggregations || []).map((a) => a.as);
  const keyOf = (row) => groupKeys.map((k) => String(row && row[k] != null ? row[k] : '')).join('');

  const merged = new Map();

  for (const row of (currentRows || [])) {
    const entry = { ...row };
    for (const m of measures) entry[`${m}${PREVIOUS_KEY_SUFFIX}`] = 0;
    merged.set(keyOf(row), entry);
  }

  for (const row of (previousRows || [])) {
    const key = keyOf(row);
    let entry = merged.get(key);
    if (!entry) {
      entry = {};
      for (const gk of groupKeys) entry[gk] = row && row[gk] != null ? row[gk] : null;
      for (const m of measures) entry[m] = 0;
      merged.set(key, entry);
    }
    for (const m of measures) {
      entry[`${m}${PREVIOUS_KEY_SUFFIX}`] = row && row[m] != null ? row[m] : 0;
    }
  }

  return [...merged.values()];
}
