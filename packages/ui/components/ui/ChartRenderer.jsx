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
 * Dark mode: the app flips themes with a global `invert(1) hue-rotate(180deg)`
 * filter on <html> (see src/index.css). A naive invert distorts every brand
 * color, so ChartRenderer opts its subtree OUT of that filter — the same
 * trick the stylesheet already uses for <img>/<video> — and instead applies
 * an explicit dark token set. Series colors keep their true hue.
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
import { PREVIOUS_KEY_SUFFIX } from '@core/lib/reportComparison';
import { useTheme } from '../../contexts/ThemeContext';

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

/**
 * Brighter palette for dark surfaces — the *-600/700 light palette reads
 * muddy on a dark card. Same hue order so a series keeps its identity when
 * the user flips the theme.
 */
const CHART_COLORS_DARK = [
  '#60a5fa', // blue-400
  '#4ade80', // green-400
  '#fb923c', // orange-400
  '#c084fc', // purple-400
  '#22d3ee', // cyan-400
  '#f87171', // red-400
  '#a3e635', // lime-400
  '#a78bfa', // violet-400
  '#fbbf24', // amber-400
  '#2dd4bf', // teal-400
  '#fb7185', // rose-400
  '#818cf8', // indigo-400
  '#facc15', // yellow-400
  '#f472b6', // pink-400
  '#86efac', // green-300
  '#93c5fd', // blue-300
];

/**
 * Theme tokens for chart primitives. Because ChartRenderer cancels the
 * global dark-mode invert for its subtree, the dark token set is authored
 * literally for a dark surface (light grid/text, dark card).
 */
const CHART_THEME = {
  light: {
    grid: '#e2e8f0',
    axis: '#64748b',
    surface: '#ffffff',
    surfaceAlt: '#f8fafc',
    border: '#e2e8f0',
    text: '#0f172a',
    textMuted: '#64748b',
    series: CHART_COLORS,
  },
  dark: {
    grid: '#475569',
    axis: '#94a3b8',
    surface: '#1e293b',
    surfaceAlt: '#334155',
    border: '#334155',
    text: '#e2e8f0',
    textMuted: '#94a3b8',
    series: CHART_COLORS_DARK,
  },
};

/** Recharts <Tooltip> styling derived from the active theme. */
function tooltipProps(theme) {
  return {
    contentStyle: {
      backgroundColor: theme.surface,
      border: `1px solid ${theme.border}`,
      borderRadius: 8,
      color: theme.text,
    },
    labelStyle: { color: theme.text },
    itemStyle: { color: theme.text },
  };
}

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

  // Period-over-period comparison pairs each measure with a "previous" series.
  if (definition.comparison) {
    for (const a of (definition.aggregations || [])) {
      map[`${a.as}${PREVIOUS_KEY_SUFFIX}`] = `${map[a.as]} (previous)`;
    }
  }

  return map;
}

/**
 * Series descriptors for bar / line charts. With a `comparison` block each
 * measure yields two series — the current period and the earlier one,
 * sharing a hue so they read as the same metric.
 */
function buildSeries(definition, theme) {
  const measures = definition?.aggregations?.map((a) => a.as) || [];
  const hasComparison = Boolean(definition?.comparison);
  const series = [];
  measures.forEach((m, i) => {
    const color = theme.series[i % theme.series.length];
    series.push({ key: m, color, isPrev: false });
    if (hasComparison) {
      series.push({ key: `${m}${PREVIOUS_KEY_SUFFIX}`, color, isPrev: true });
    }
  });
  return series;
}

function NoData({ message = 'No data for this report.', theme = CHART_THEME.light }) {
  return (
    <div
      className="flex h-64 items-center justify-center rounded border border-dashed text-sm"
      style={{ borderColor: theme.border, color: theme.textMuted }}
    >
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

function KpiCard({ rows, definition, labelMap, theme = CHART_THEME.light }) {
  const measureKey = pickPrimaryMeasureKey(definition);
  const value = rows[0]?.[measureKey];
  const label = labelMap?.[measureKey] || measureKey || 'Result';
  const hasComparison = Boolean(definition?.comparison);
  const prevValue = hasComparison ? rows[0]?.[`${measureKey}${PREVIOUS_KEY_SUFFIX}`] : undefined;
  const delta = (typeof value === 'number' && typeof prevValue === 'number')
    ? value - prevValue
    : null;
  return (
    <div
      className="rounded-xl border p-6 text-center"
      style={{ backgroundColor: theme.surface, borderColor: theme.border }}
    >
      <div className="text-xs uppercase tracking-wide" style={{ color: theme.textMuted }}>
        {label}
      </div>
      <div className="mt-2 text-4xl font-bold" style={{ color: theme.text }}>
        {formatKpiValue(value)}
      </div>
      {hasComparison && (
        <div className="mt-2 text-sm" style={{ color: theme.textMuted }}>
          {delta != null && (
            <span style={{ color: delta >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
              {delta >= 0 ? '▲' : '▼'} {formatKpiValue(Math.abs(delta))}
            </span>
          )}
          {' '}vs previous ({formatKpiValue(prevValue)})
        </div>
      )}
    </div>
  );
}

/**
 * ReportTable — tabular view with friendly column headers and optional
 * drill-down on group-by values.
 */
function ReportTable({ rows, definition, labelMap, onDrillDown, theme = CHART_THEME.light }) {
  if (!rows.length) return <NoData theme={theme} />;
  const columns = Object.keys(rows[0]);
  const groupKeys = (definition?.groupBy || []).map((g) => g.alias || g.column);

  return (
    <div className="overflow-auto rounded border" style={{ borderColor: theme.border }}>
      <table className="w-full text-sm">
        <caption className="sr-only">
          {definition?.header?.title || 'Report data table'}
        </caption>
        <thead style={{ backgroundColor: theme.surfaceAlt }}>
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 text-left font-medium" style={{ color: theme.text }}>
                {labelMap?.[c] || c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx} className="border-t" style={{ borderColor: theme.border }}>
              {columns.map((c) => {
                const isGroupKey = groupKeys.includes(c);
                const cellValue = r[c] == null ? '—' : String(r[c]);

                if (isGroupKey && onDrillDown) {
                  const rawColumn = definition.groupBy.find(
                    (g) => (g.alias || g.column) === c,
                  )?.column || c;
                  return (
                    <td key={c} className="px-3 py-1.5">
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
                  <td key={c} className="px-3 py-1.5" style={{ color: theme.text }}>
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
function BarViz({ rows, definition, stacked = false, onDrillDown, labelMap, chartHeight = 320, theme = CHART_THEME.light }) {
  const groupKey = pickPrimaryGroupKey(definition);
  const measures = definition?.aggregations?.map((a) => a.as) || [];
  if (!groupKey || !measures.length) return <NoData theme={theme} />;
  const series = buildSeries(definition, theme);

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
        <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
        <XAxis
          dataKey={groupKey}
          stroke={theme.axis}
          tick={{ fontSize: 12, fill: theme.axis }}
          label={{
            value: labelMap?.[groupKey] || groupKey,
            position: 'insideBottom',
            offset: -5,
            style: { fontSize: 11, fill: theme.axis },
          }}
        />
        <YAxis stroke={theme.axis} tick={{ fontSize: 12, fill: theme.axis }} />
        <Tooltip
          labelFormatter={(v) => `${labelMap?.[groupKey] || groupKey}: ${v}`}
          formatter={(v, name) => [v, labelMap?.[name] || name]}
          {...tooltipProps(theme)}
        />
        <Legend formatter={(v) => labelMap?.[v] || v} wrapperStyle={{ color: theme.text, fontSize: 12 }} />
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            fill={s.color}
            fillOpacity={s.isPrev ? 0.45 : 1}
            stackId={stacked ? (s.isPrev ? 'prev' : 'current') : undefined}
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
function LineViz({ rows, definition, onDrillDown, labelMap, chartHeight = 320, theme = CHART_THEME.light }) {
  const groupKey = pickPrimaryGroupKey(definition);
  const measures = definition?.aggregations?.map((a) => a.as) || [];
  if (!groupKey || !measures.length) return <NoData theme={theme} />;
  const series = buildSeries(definition, theme);

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
        <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
        <XAxis
          dataKey={groupKey}
          stroke={theme.axis}
          tick={{ fontSize: 12, fill: theme.axis }}
          label={{
            value: labelMap?.[groupKey] || groupKey,
            position: 'insideBottom',
            offset: -5,
            style: { fontSize: 11, fill: theme.axis },
          }}
        />
        <YAxis stroke={theme.axis} tick={{ fontSize: 12, fill: theme.axis }} />
        <Tooltip
          labelFormatter={(v) => `${labelMap?.[groupKey] || groupKey}: ${v}`}
          formatter={(v, name) => [v, labelMap?.[name] || name]}
          {...tooltipProps(theme)}
        />
        <Legend formatter={(v) => labelMap?.[v] || v} wrapperStyle={{ color: theme.text, fontSize: 12 }} />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            stroke={s.color}
            strokeWidth={2}
            strokeDasharray={s.isPrev ? '5 4' : undefined}
            strokeOpacity={s.isPrev ? 0.75 : 1}
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

function PieViz({ rows, definition, onDrillDown, labelMap, chartHeight = 320, theme = CHART_THEME.light }) {
  const groupKey = pickPrimaryGroupKey(definition);
  const measureKey = pickPrimaryMeasureKey(definition);
  if (!groupKey || !measureKey || !rows.length) return <NoData theme={theme} />;

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
            <Cell key={idx} fill={theme.series[idx % theme.series.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) => [v, labelMap?.[measureKey] || measureKey]}
          labelFormatter={(v) => `${labelMap?.[groupKey] || groupKey}: ${v}`}
          {...tooltipProps(theme)}
        />
        <Legend
          formatter={(v) => labelMap?.[groupKey] ? `${labelMap[groupKey]}: ${v}` : v}
          wrapperStyle={{ color: theme.text, fontSize: 12 }}
        />
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
  const { isDarkMode } = useTheme() || {};
  const theme = isDarkMode ? CHART_THEME.dark : CHART_THEME.light;
  const safeRows = Array.isArray(rows) ? rows : [];
  const type = definition?.visualization?.type || 'table';
  const labelMap = definition ? buildColumnLabelMap(definition) : {};

  let chart;
  if (safeRows.length === 0 && type !== 'kpi') {
    chart = <NoData theme={theme} />;
  } else {
    switch (type) {
      case 'kpi':
        chart = <KpiCard rows={safeRows} definition={definition} labelMap={labelMap} theme={theme} />;
        break;
      case 'bar':
        chart = <BarViz rows={safeRows} definition={definition} onDrillDown={onDrillDown} labelMap={labelMap} chartHeight={chartHeight} theme={theme} />;
        break;
      case 'stacked_bar':
        chart = <BarViz rows={safeRows} definition={definition} stacked onDrillDown={onDrillDown} labelMap={labelMap} chartHeight={chartHeight} theme={theme} />;
        break;
      case 'line':
        chart = <LineViz rows={safeRows} definition={definition} onDrillDown={onDrillDown} labelMap={labelMap} chartHeight={chartHeight} theme={theme} />;
        break;
      case 'pie':
        chart = <PieViz rows={safeRows} definition={definition} onDrillDown={onDrillDown} labelMap={labelMap} chartHeight={chartHeight} theme={theme} />;
        break;
      case 'table':
      default:
        chart = <ReportTable rows={safeRows} definition={definition} labelMap={labelMap} onDrillDown={onDrillDown} theme={theme} />;
        break;
    }
  }

  // The app's dark mode is a global invert() on <html>. Opt the chart
  // subtree out of it (re-invert) so the explicit dark tokens above render
  // as authored and series colors keep their true brand hue.
  return (
    <div style={isDarkMode ? { filter: 'invert(1) hue-rotate(180deg)' } : undefined}>
      {chart}
    </div>
  );
}
