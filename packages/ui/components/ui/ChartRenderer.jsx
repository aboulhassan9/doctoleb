/**
 * ChartRenderer — single entry point for all analytical-report visualizations.
 *
 * Why one component, not six:
 *   - The viz `type` lives on the saved report definition. A switch here
 *     keeps the consumer code (`ReportViewerPage`, `ReportEditorPage`'s
 *     preview pane) trivial.
 *   - Common axes config (label resolution, color palette, empty state)
 *     applies across every chart shape; keeping it in one place avoids
 *     drift between renderers.
 *
 * The component is INTENTIONALLY stateless — it takes the report
 * definition + the `rows` array the service returned and emits a chart.
 * State (loading, refetch, filter strip) belongs upstream.
 *
 * Props:
 *   definition  — full analyticalReportDefinition object (dataSource, groupBy, etc.)
 *   rows        — array of result-row objects from the RPC
 *   onDrillDown — optional callback `({ column, value, dataSource }) => void`
 *                 fired when the user clicks a group-by value in any viz.
 *                 The parent can use this to add an eq filter and re-run.
 */

import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { resolveColumnLabel } from '@core/lib/reportLabels';

// Brand-aligned palette. Picked for accessibility (each color has > 3:1
// contrast against white and against the neighboring color in the
// sequence) and for printing.
const ANIMATION_ROW_THRESHOLD = 100;
const ANIMATION_DURATION_MS = 400;

const CHART_COLORS = [
  '#2563eb', // blue-600
  '#16a34a', // green-600
  '#ea580c', // orange-600
  '#9333ea', // purple-600
  '#0891b2', // cyan-600
  '#dc2626', // red-600
  '#65a30d', // lime-600
  '#7c3aed', // violet-600
  '#d97706', // amber-600
  '#0d9488', // teal-600
  '#e11d48', // rose-600
  '#4f46e5', // indigo-600
  '#ca8a04', // yellow-600
  '#be185d', // pink-700
  '#15803d', // green-700
  '#1d4ed8', // blue-700
];

/** Human-friendly labels for aggregation functions, used to derive measure names. */
const AGG_FN_LABELS = {
  count: 'Count',
  count_distinct: 'Distinct Count',
  sum: 'Total',
  avg: 'Average',
  min: 'Minimum',
  max: 'Maximum',
};

function pickPrimaryGroupKey(definition) {
  return definition?.groupBy?.[0]?.alias || definition?.groupBy?.[0]?.column || null;
}

function pickPrimaryMeasureKey(definition) {
  return definition?.aggregations?.[0]?.as || null;
}


/**
 * Build a label map for all result-row keys in a report definition.
 * Maps raw keys (groupBy alias/column, aggregation `as`) to friendly labels.
 *
 * This is the single source of label resolution for every sub-renderer.
 */
function buildColumnLabelMap(definition) {
  const ds = definition.dataSource;
  const map = {};

  // GroupBy keys: the result-row key is alias || column; label comes from the column.
  for (const g of (definition.groupBy || [])) {
    const key = g.alias || g.column;
    map[key] = resolveColumnLabel(ds, g.column);
    // Append granularity hint when present (e.g. "Appointment Date (Month)")
    if (g.granularity) {
      const granLabel = g.granularity.charAt(0).toUpperCase() + g.granularity.slice(1);
      map[key] = `${map[key]} (${granLabel})`;
    }
  }

  // Aggregation keys: derive from fn + column label.
  for (const a of (definition.aggregations || [])) {
    if (a.fn === 'count' && !a.column) {
      map[a.as] = 'Count';
    } else {
      const fnLabel = AGG_FN_LABELS[a.fn] || a.fn;
      const colLabel = a.column ? resolveColumnLabel(ds, a.column) : '';
      map[a.as] = colLabel ? `${fnLabel} ${colLabel}` : fnLabel;
    }
  }

  return map;
}

function NoData({ message = 'No data for this report.' }) {
  return (
    <div className="flex h-64 items-center justify-center rounded border border-dashed border-slate-300 text-sm text-slate-500">
      {message}
    </div>
  );
}

function formatKpiValue(value) {
  if (value == null) return '—';
  if (typeof value !== 'number') return String(value);
  if (Number.isNaN(value)) return '—';
  // Use compact notation for large numbers (≥10 000), standard grouping otherwise
  const options = Math.abs(value) >= 10_000
    ? { notation: 'compact', maximumFractionDigits: 1 }
    : { useGrouping: true, maximumFractionDigits: 2 };
  return Intl.NumberFormat('en', options).format(value);
}

function KpiCard({ rows, definition, labelMap }) {
  const measureKey = pickPrimaryMeasureKey(definition);
  const value = rows[0]?.[measureKey];
  const label = labelMap?.[measureKey] || measureKey || 'Result';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-4xl font-bold text-slate-900">
        {formatKpiValue(value)}
      </div>
    </div>
  );
}

/**
 * ReportTable — tabular view with friendly column headers and optional
 * drill-down on group-by values.
 */
function ReportTable({ rows, definition, labelMap, onDrillDown }) {
  if (!rows.length) return <NoData />;
  const columns = Object.keys(rows[0]);
  const groupKeys = (definition?.groupBy || []).map((g) => g.alias || g.column);

  return (
    <div className="overflow-auto rounded border border-slate-200">
      <table className="w-full text-sm">
        <caption className="sr-only">
          {definition?.header?.title || 'Report data table'}
        </caption>
        <thead className="bg-slate-50">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 text-left font-medium text-slate-700">
                {labelMap?.[c] || c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50/50">
              {columns.map((c) => {
                const isGroupKey = groupKeys.includes(c);
                const cellValue = r[c] == null ? '—' : String(r[c]);

                if (isGroupKey && onDrillDown) {
                  const rawColumn = definition.groupBy.find(
                    (g) => (g.alias || g.column) === c,
                  )?.column || c;
                  return (
                    <td key={c} className="px-3 py-1.5 text-slate-700">
                      <button
                        type="button"
                        className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left"
                        onClick={() => onDrillDown({
                          column: rawColumn,
                          value: r[c],
                          dataSource: definition.dataSource,
                        })}
                        aria-label={`Drill down on ${labelMap?.[c] || c}: ${cellValue}`}
                        title={`Drill down on ${labelMap?.[c] || c}: ${cellValue}`}
                      >
                        {cellValue}
                      </button>
                    </td>
                  );
                }

                return (
                  <td key={c} className="px-3 py-1.5 text-slate-700">
                    {cellValue}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * BarViz — categorical x-axis, numeric y-axis. Supports stacked variant.
 * Clicking a bar triggers drill-down on the group-by value.
 */
function BarViz({ rows, definition, stacked = false, onDrillDown, labelMap, chartHeight = 320 }) {
  const groupKey = pickPrimaryGroupKey(definition);
  const measures = definition?.aggregations?.map((a) => a.as) || [];
  if (!groupKey || !measures.length) return <NoData />;

  const handleBarClick = onDrillDown
    ? (entry) => {
        const value = entry?.payload?.[groupKey];
        if (value != null) {
          onDrillDown({
            column: definition.groupBy[0]?.column || groupKey,
            value,
            dataSource: definition.dataSource,
          });
        }
      }
    : undefined;

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={rows} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey={groupKey}
          fontSize={12}
          stroke="#64748b"
          label={{
            value: labelMap?.[groupKey] || groupKey,
            position: 'insideBottom',
            offset: -5,
            style: { fontSize: 11, fill: '#64748b' },
          }}
        />
        <YAxis fontSize={12} stroke="#64748b" />
        <Tooltip
          labelFormatter={(v) => `${labelMap?.[groupKey] || groupKey}: ${v}`}
          formatter={(v, name) => [v, labelMap?.[name] || name]}
        />
        <Legend formatter={(v) => labelMap?.[v] || v} />
        {measures.map((m, i) => (
          <Bar
            key={m}
            dataKey={m}
            fill={CHART_COLORS[i % CHART_COLORS.length]}
            stackId={stacked ? 'a' : undefined}
            onClick={handleBarClick}
            cursor={onDrillDown ? 'pointer' : undefined}
            isAnimationActive={rows.length <= ANIMATION_ROW_THRESHOLD}
            animationDuration={ANIMATION_DURATION_MS}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * LineViz — time-series or ordinal x-axis. Clicking a data point triggers
 * drill-down on the group-by value.
 */
function LineViz({ rows, definition, onDrillDown, labelMap, chartHeight = 320 }) {
  const groupKey = pickPrimaryGroupKey(definition);
  const measures = definition?.aggregations?.map((a) => a.as) || [];
  if (!groupKey || !measures.length) return <NoData />;

  const handlePointClick = onDrillDown
    ? (entry) => {
        const value = entry?.payload?.[groupKey];
        if (value != null) {
          onDrillDown({
            column: definition.groupBy[0]?.column || groupKey,
            value,
            dataSource: definition.dataSource,
          });
        }
      }
    : undefined;

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <LineChart data={rows} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey={groupKey}
          fontSize={12}
          stroke="#64748b"
          label={{
            value: labelMap?.[groupKey] || groupKey,
            position: 'insideBottom',
            offset: -5,
            style: { fontSize: 11, fill: '#64748b' },
          }}
        />
        <YAxis fontSize={12} stroke="#64748b" />
        <Tooltip
          labelFormatter={(v) => `${labelMap?.[groupKey] || groupKey}: ${v}`}
          formatter={(v, name) => [v, labelMap?.[name] || name]}
        />
        <Legend formatter={(v) => labelMap?.[v] || v} />
        {measures.map((m, i) => (
          <Line
            key={m}
            type="monotone"
            dataKey={m}
            stroke={CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3, onClick: handlePointClick, cursor: onDrillDown ? 'pointer' : undefined }}
            activeDot={{ r: 5, onClick: handlePointClick, cursor: onDrillDown ? 'pointer' : undefined }}
            isAnimationActive={rows.length <= ANIMATION_ROW_THRESHOLD}
            animationDuration={ANIMATION_DURATION_MS}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/**
 * PieViz — single dimension, single measure share. Clicking a slice triggers
 * drill-down on the group-by value.
 */
const PIE_LABEL_THRESHOLD = 8;

function PieViz({ rows, definition, onDrillDown, labelMap, chartHeight = 320 }) {
  const groupKey = pickPrimaryGroupKey(definition);
  const measureKey = pickPrimaryMeasureKey(definition);
  if (!groupKey || !measureKey || !rows.length) return <NoData />;

  const tooManySlices = rows.length > PIE_LABEL_THRESHOLD;

  const handleSliceClick = onDrillDown
    ? (entry) => {
        const value = entry?.[groupKey] ?? entry?.name;
        if (value != null) {
          onDrillDown({
            column: definition.groupBy[0]?.column || groupKey,
            value,
            dataSource: definition.dataSource,
          });
        }
      }
    : undefined;

  const renderLabel = tooManySlices
    ? false
    : ({ name, percent }) =>
        `${labelMap?.[groupKey] ? `${labelMap[groupKey]}: ` : ''}${name} (${(percent * 100).toFixed(0)}%)`;

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <PieChart>
        <Pie
          data={rows}
          dataKey={measureKey}
          nameKey={groupKey}
          outerRadius={tooManySlices ? 100 : 120}
          label={renderLabel}
          onClick={handleSliceClick}
          cursor={onDrillDown ? 'pointer' : undefined}
          isAnimationActive={rows.length <= ANIMATION_ROW_THRESHOLD}
          animationDuration={ANIMATION_DURATION_MS}
        >
          {rows.map((_, idx) => (
            <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v, name) => [v, labelMap?.[measureKey] || measureKey]}
          labelFormatter={(v) => `${labelMap?.[groupKey] || groupKey}: ${v}`}
        />
        <Legend formatter={(v) => labelMap?.[groupKey] ? `${labelMap[groupKey]}: ${v}` : v} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/**
 * Single entry point. Picks the right viz based on
 * `definition.visualization.type` and falls back to a table when the type
 * is unknown — so a future-introduced viz type renders SOMETHING rather
 * than nothing in an older client.
 *
 * Builds a `labelMap` from the definition's dataSource + column metadata
 * so every sub-renderer shows human-friendly headers, axis labels, and
 * legend entries instead of raw column keys.
 */
export default function ChartRenderer({ definition, rows, onDrillDown, chartHeight = 320 }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const type = definition?.visualization?.type || 'table';
  const labelMap = definition ? buildColumnLabelMap(definition) : {};

  if (safeRows.length === 0 && type !== 'kpi') {
    return <NoData />;
  }

  switch (type) {
    case 'kpi':         return <KpiCard rows={safeRows} definition={definition} labelMap={labelMap} />;
    case 'bar':         return <BarViz rows={safeRows} definition={definition} onDrillDown={onDrillDown} labelMap={labelMap} chartHeight={chartHeight} />;
    case 'stacked_bar': return <BarViz rows={safeRows} definition={definition} stacked onDrillDown={onDrillDown} labelMap={labelMap} chartHeight={chartHeight} />;
    case 'line':        return <LineViz rows={safeRows} definition={definition} onDrillDown={onDrillDown} labelMap={labelMap} chartHeight={chartHeight} />;
    case 'pie':         return <PieViz rows={safeRows} definition={definition} onDrillDown={onDrillDown} labelMap={labelMap} chartHeight={chartHeight} />;
    case 'table':
    default:            return <ReportTable rows={safeRows} definition={definition} labelMap={labelMap} onDrillDown={onDrillDown} />;
  }
}
