/**
 * ReportEditorPage — build-your-own analytical report, no technical skill.
 *
 * This is the editor surface for the domain report engine. A doctor /
 * admin picks, in plain language:
 *   - what data    → data source
 *   - break it down by → group-by columns
 *   - what to measure  → aggregations (count / sum / average / …)
 *   - narrow it      → filters
 *   - how to show it   → chart type
 * …and sees a live preview before saving. No SQL, no JSON.
 *
 * Save path:
 *   - New  (`/reports/new`)      → create the report row, then publish v1.
 *   - Edit (`/reports/:id/edit`) → update metadata, then publish v(N+1).
 *
 * Both go through `analyticalReportService` — the definition is validated
 * by `analyticalReportDefinitionSchema` before it can be previewed or
 * saved, and the closed-set RPC enforces the same allowlist server-side.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import DashboardLayout from '@ui/components/layouts/DashboardLayout';
import {
  PageHeader, LoadingSkeleton, EmptyState, FormField, ChartRenderer, ChartErrorBoundary,
  ConfirmDialog,
} from '@ui/components/ui';
import { useAuth } from '@ui/contexts/AuthContext';
import { useToast } from '@ui/contexts/ToastContext';
import { analyticalReportService } from '@core/services/analyticalReports';
import {
  analyticalReportDefinitionSchema,
  REPORT_DATA_SOURCES,
  REPORT_DATA_SOURCE_COLUMNS,
  REPORT_DATA_SOURCE_COLUMN_TYPES,
  REPORT_COLUMN_TYPE_OPERATORS,
  REPORT_COLUMN_TYPE_AGGREGATIONS,
  REPORT_FILTER_OPERATORS,
  REPORT_AGGREGATION_FUNCTIONS,
  REPORT_TIME_GRANULARITIES,
  REPORT_VISUALIZATIONS,
} from '@core/schemas/analyticalReports';
import { resolveColumnLabel } from '@core/lib/reportLabels';
import { stagger, fadeUp } from '@core/lib/animations';

// ── Friendly labels ─────────────────────────────────────────────────
// Doctors should never see raw identifiers. Every closed-set value gets a
// plain-language label here.

const DATA_SOURCE_LABELS = {
  appointments: 'Appointments',
  encounters: 'Encounters / visits',
  diagnoses: 'Diagnoses',
  prescriptions: 'Prescriptions',
  lab_orders: 'Lab orders',
  imaging_orders: 'Imaging orders',
  payments: 'Payments',
  patients: 'Patients',
  care_tasks: 'Care tasks',
  medical_intake: 'Medical intake',
};

const AGG_FN_LABELS = {
  count: 'Count of rows',
  count_distinct: 'Distinct count of',
  sum: 'Sum of',
  avg: 'Average of',
  min: 'Minimum of',
  max: 'Maximum of',
};

const VIZ_LABELS = {
  table: 'Table',
  bar: 'Bar chart',
  line: 'Line chart',
  pie: 'Pie chart',
  kpi: 'Single number (KPI)',
  stacked_bar: 'Stacked bar chart',
};

const OPERATOR_LABELS = {
  eq: 'equals',
  neq: 'does not equal',
  gt: 'greater than',
  gte: 'greater than or equal',
  lt: 'less than',
  lte: 'less than or equal',
  in: 'is one of (comma-separated)',
  not_in: 'is not one of (comma-separated)',
  is_null: 'is empty',
  not_null: 'is not empty',
};

const GRANULARITY_LABELS = {
  '': 'No time bucket',
  day: 'By day',
  week: 'By week',
  month: 'By month',
  quarter: 'By quarter',
  year: 'By year',
};

const CATEGORY_OPTIONS = [
  { value: 'clinical_activity', label: 'Clinical activity' },
  { value: 'medication_usage', label: 'Medications' },
  { value: 'lab_workflow', label: 'Lab workflow' },
  { value: 'financial', label: 'Financial' },
  { value: 'operational', label: 'Operational' },
  { value: 'custom', label: 'Custom' },
];

const AUDIENCE_OPTIONS = [
  { value: 'staff', label: 'All staff' },
  { value: 'doctor', label: 'Doctors only' },
  { value: 'admin', label: 'Admins only' },
  { value: 'public_safe', label: 'Public-safe' },
];


/** Legacy alias — used in places where dataSource isn't available (e.g. sort refs). */
function prettyColumn(col) {
  if (!col) return '';
  return col
    .replace(/_id$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Slugify an aggregation alias to the `^[a-z][a-z0-9_]*$` shape. */
function slugifyAlias(input, fallback) {
  const slug = String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return /^[a-z]/.test(slug) ? slug : fallback;
}

// ── Quick-start templates ────────────────────────────────────────────
// Pre-built definitions for the most common clinical reports. The doctor
// picks one and the editor fills in all the steps — then they can tweak.

const QUICK_START_TEMPLATES = [
  {
    label: 'Appointments this month by doctor',
    definition: {
      schemaVersion: '1',
      dataSource: 'appointments',
      groupBy: [{ column: 'doctor_id', granularity: '' }],
      aggregations: [{ fn: 'count', as: 'count' }],
      filters: [],
      orderBy: [{ ref: 'count', dir: 'desc' }],
      limit: 100,
      visualization: { type: 'bar' },
      header: { title: 'Appointments this month by doctor', showFilters: true },
    },
  },
  {
    label: 'Monthly revenue trend',
    definition: {
      schemaVersion: '1',
      dataSource: 'payments',
      groupBy: [{ column: 'created_at', granularity: 'month' }],
      aggregations: [{ fn: 'sum', column: 'amount', as: 'total_amount' }],
      filters: [{ column: 'status', operator: 'eq', value: 'completed' }],
      orderBy: [{ ref: 'created_at', dir: 'asc' }],
      limit: 24,
      visualization: { type: 'line' },
      header: { title: 'Monthly revenue trend', showFilters: true },
    },
  },
  {
    label: 'Top diagnoses this quarter',
    definition: {
      schemaVersion: '1',
      dataSource: 'diagnoses',
      groupBy: [{ column: 'icd_code', granularity: '' }],
      aggregations: [{ fn: 'count', as: 'count' }],
      filters: [],
      orderBy: [{ ref: 'count', dir: 'desc' }],
      limit: 20,
      visualization: { type: 'bar' },
      header: { title: 'Top diagnoses this quarter', showFilters: true },
    },
  },
  {
    label: 'Care tasks by priority',
    definition: {
      schemaVersion: '1',
      dataSource: 'care_tasks',
      groupBy: [{ column: 'priority', granularity: '' }],
      aggregations: [{ fn: 'count', as: 'count' }],
      filters: [{ column: 'status', operator: 'eq', value: 'open' }],
      orderBy: [{ ref: 'count', dir: 'desc' }],
      limit: 50,
      visualization: { type: 'pie' },
      header: { title: 'Open care tasks by priority', showFilters: true },
    },
  },
];

// ── Step progress indicator ──────────────────────────────────────────

const EDITOR_STEPS = [
  { key: 'details',   label: 'Details' },
  { key: 'data',      label: 'Data' },
  { key: 'groupby',   label: 'Breakdown' },
  { key: 'measure',   label: 'Measure' },
  { key: 'filters',   label: 'Filters' },
  { key: 'display',   label: 'Display' },
];

function StepProgress({ steps, current }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1" role="navigation" aria-label="Report editor steps">
      {steps.map((s, i) => {
        const isComplete = i < current;
        const isCurrent = i === current;
        return (
          <div key={s.key} className="flex items-center gap-1" aria-current={isCurrent ? 'step' : undefined}>
            <div
              className={`flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold shrink-0 ${
                isComplete
                  ? 'bg-blue-600 text-white'
                  : isCurrent
                    ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-600'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              {isComplete ? '✓' : i + 1}
            </div>
            <span
              className={`text-xs whitespace-nowrap ${
                isComplete ? 'text-blue-600 font-medium' : isCurrent ? 'text-blue-700 font-medium' : 'text-slate-400'
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div className={`h-0.5 w-4 ${isComplete ? 'bg-blue-600' : 'bg-slate-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────────

export default function ReportEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const isNew = !id || id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [fetchError, setFetchError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const initialValuesRef = useRef(null);

  // ── Report metadata ──
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('clinical_activity');
  const [audience, setAudience] = useState('staff');

  // ── Definition state ──
  const [dataSource, setDataSource] = useState('appointments');
  const [groupBy, setGroupBy] = useState([{ column: '', granularity: '' }]);
  const [aggregations, setAggregations] = useState([{ fn: 'count', column: '', as: 'count' }]);
  const [filters, setFilters] = useState([]);
  const [orderBy, setOrderBy] = useState([]);
  const [limit, setLimit] = useState(100);
  const [vizType, setVizType] = useState('bar');
  const [headerSubtitle, setHeaderSubtitle] = useState('');

  // ── Preview state ──
  const [previewRows, setPreviewRows] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [autoPreviewEnabled, setAutoPreviewEnabled] = useState(true);

  const availableColumns = REPORT_DATA_SOURCE_COLUMNS[dataSource] || [];
  const columnTypeMap = REPORT_DATA_SOURCE_COLUMN_TYPES[dataSource] || {};

  // ── Smart column-aware helpers ──
  // Filter operators available for a given column (based on its type).
  const operatorsForColumn = useCallback((col) => {
    const colType = columnTypeMap[col]?.type;
    if (!colType) return REPORT_FILTER_OPERATORS;
    return REPORT_COLUMN_TYPE_OPERATORS[colType] || REPORT_FILTER_OPERATORS;
  }, [columnTypeMap]);

  // Columns valid for a given aggregation function (based on their type).
  const columnsForAggFn = useCallback((fn) => {
    if (fn === 'count') return availableColumns; // count works on any column or no column
    const allowed = [];
    for (const col of availableColumns) {
      const colType = columnTypeMap[col]?.type;
      if (colType && REPORT_COLUMN_TYPE_AGGREGATIONS[colType]?.includes(fn)) {
        allowed.push(col);
      }
    }
    return allowed;
  }, [availableColumns, columnTypeMap]);

  // Whether a column supports time granularity (timestamp or date type).
  const columnSupportsGranularity = useCallback((col) => {
    const colType = columnTypeMap[col]?.type;
    return colType === 'timestamp' || colType === 'date';
  }, [columnTypeMap]);

  // Granularities valid for a given column.
  const granularitiesForColumn = useCallback((col) => {
    const meta = columnTypeMap[col];
    if (!meta || !meta.granularities) return REPORT_TIME_GRANULARITIES;
    return meta.granularities;
  }, [columnTypeMap]);

  // Enum values for a column (for filter value suggestions).
  const enumValuesForColumn = useCallback((col) => {
    return columnTypeMap[col]?.values || null;
  }, [columnTypeMap]);

  // ── Step progress computation ──
  // Which step is the doctor currently on? Based on how far they've filled
  // in the form. Steps are: details, data, groupby, measure, filters, display.
  const currentStep = useMemo(() => {
    if (!name.trim()) return 0; // details
    if (!dataSource) return 1; // data
    if (groupBy.some((g) => g.column)) return 2; // groupby (at least partially filled)
    if (aggregations.some((a) => a.fn && a.as)) return 3; // measure
    if (filters.length > 0) return 4; // filters
    return 5; // display
  }, [name, dataSource, groupBy, aggregations, filters]);

  // Result keys an order-by entry may reference: group-by columns/aliases
  // plus aggregation aliases.
  const resultKeys = useMemo(() => {
    const keys = [];
    for (const g of groupBy) {
      if (g.column) keys.push(g.column);
    }
    for (const a of aggregations) {
      if (a.as) keys.push(a.as);
    }
    return keys;
  }, [groupBy, aggregations]);

  const editorSnapshot = useMemo(() => JSON.stringify({
    name,
    description,
    category,
    audience,
    dataSource,
    groupBy,
    aggregations,
    filters,
    orderBy,
    limit: String(limit),
    vizType,
    headerSubtitle,
  }), [
    name,
    description,
    category,
    audience,
    dataSource,
    groupBy,
    aggregations,
    filters,
    orderBy,
    limit,
    vizType,
    headerSubtitle,
  ]);

  useEffect(() => {
    if (!loading && initialValuesRef.current == null) {
      initialValuesRef.current = editorSnapshot;
    }
  }, [loading, editorSnapshot]);

  const isDirty = initialValuesRef.current != null && initialValuesRef.current !== editorSnapshot;

  // ── Auto-preview with debounce + throttle ──
  // When the definition changes and is valid, automatically run preview
  // after a 3s debounce. Throttle: if a preview is already running, we
  // mark a pending ref and re-trigger after the current run completes.
  // The user can opt out via the auto-preview toggle checkbox.
  const AUTO_PREVIEW_DEBOUNCE_MS = 3000;
  const debounceRef = useRef(null);
  const autoPreviewVersionRef = useRef(0);
  const pendingAutoPreviewRef = useRef(false);

  const triggerAutoPreview = useCallback(() => {
    if (!autoPreviewEnabled) return;

    autoPreviewVersionRef.current += 1;
    const version = autoPreviewVersionRef.current;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      // Skip if a newer trigger came in while we waited
      if (version !== autoPreviewVersionRef.current) return;
      // Throttle: if already running, mark pending and skip this round.
      // The running preview's completion handler will re-trigger.
      if (previewing) {
        pendingAutoPreviewRef.current = true;
        return;
      }

      const definition = buildDefinition();
      const parsed = analyticalReportDefinitionSchema.safeParse(definition);
      if (!parsed.success) return; // silently skip invalid definitions

      setPreviewing(true);
      setPreviewError('');
      const { data, error } = await analyticalReportService.runDefinition(parsed.data, {});
      if (version !== autoPreviewVersionRef.current) { setPreviewing(false); return; }
      if (error) {
        setPreviewError(error);
        setPreviewRows(null);
      } else {
        setPreviewRows(data.rows);
        setPreviewError('');
      }
      setPreviewing(false);

      // If a preview was throttled while this one ran, re-trigger now.
      if (pendingAutoPreviewRef.current) {
        pendingAutoPreviewRef.current = false;
        triggerAutoPreview();
      }
    }, AUTO_PREVIEW_DEBOUNCE_MS);
  }, [previewing, autoPreviewEnabled]);

  // Re-trigger auto-preview whenever definition-shaping state changes.
  useEffect(() => {
    if (loading || !autoPreviewEnabled) return;
    triggerAutoPreview();
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [dataSource, groupBy, aggregations, filters, orderBy, limit, vizType, name, headerSubtitle, triggerAutoPreview, loading, autoPreviewEnabled]);

  // ── Load existing report when editing ──
  useEffect(() => {
    if (isNew) return undefined;
    let alive = true;

    (async () => {
      setLoading(true);
      const [reportRes, versionRes] = await Promise.all([
        analyticalReportService.getById(id),
        analyticalReportService.getCurrentVersion(id),
      ]);
      if (!alive) return;

      if (reportRes.error) {
        setFetchError(reportRes.error);
        setLoading(false);
        return;
      }
      const r = reportRes.data;
      setName(r.name || '');
      setDescription(r.description || '');
      setCategory(r.category || 'clinical_activity');
      setAudience(r.audience || 'staff');

      // The current version may not exist yet (report created without a
      // version) — fall back to sane defaults.
      const def = versionRes.data?.definition;
      if (def) {
        setDataSource(def.dataSource || 'appointments');
        setGroupBy(
          (def.groupBy || []).length
            ? def.groupBy.map((g) => ({ column: g.column, granularity: g.granularity || '' }))
            : [{ column: '', granularity: '' }],
        );
        setAggregations(
          (def.aggregations || []).length
            ? def.aggregations.map((a) => ({ fn: a.fn, column: a.column || '', as: a.as }))
            : [{ fn: 'count', column: '', as: 'count' }],
        );
        setFilters((def.filters || []).map((f) => ({
          column: f.column,
          operator: f.operator,
          value: f.value == null ? '' : String(f.value),
          bind: f.bind || '',
        })));
        setOrderBy((def.orderBy || []).map((o) => ({ ref: o.ref, dir: o.dir || 'desc' })));
        setLimit(def.limit || 100);
        setVizType(def.visualization?.type || 'bar');
        setHeaderSubtitle(def.header?.subtitle || '');
      }
      setLoading(false);
    })();

    return () => { alive = false; };
  }, [id, isNew]);

  // ── Assemble the definition object from editor state ──
  function buildDefinition() {
    const cleanGroupBy = groupBy
      .filter((g) => g.column)
      .map((g) => (g.granularity
        ? { column: g.column, granularity: g.granularity }
        : { column: g.column }));

    const cleanAggregations = aggregations
      .filter((a) => a.fn && a.as)
      .map((a) => (a.fn === 'count'
        ? { fn: 'count', as: a.as }
        : { fn: a.fn, column: a.column, as: a.as }));

    const cleanFilters = filters
      .filter((f) => f.column && f.operator)
      .map((f) => {
        // `bind` makes the filter runtime-adjustable — the viewer renders a
        // filter box for it and the value here becomes the default.
        const base = { column: f.column, operator: f.operator };
        if (f.bind) base.bind = f.bind;
        if (f.operator === 'is_null' || f.operator === 'not_null') {
          return base;
        }
        if (f.operator === 'in' || f.operator === 'not_in') {
          return {
            ...base,
            value: String(f.value || '').split(',').map((s) => s.trim()).filter(Boolean),
          };
        }
        return { ...base, value: f.value };
      });

    const cleanOrderBy = orderBy
      .filter((o) => o.ref)
      .map((o) => ({ ref: o.ref, dir: o.dir || 'desc' }));

    return {
      schemaVersion: '1',
      dataSource,
      groupBy: cleanGroupBy,
      aggregations: cleanAggregations,
      filters: cleanFilters,
      orderBy: cleanOrderBy,
      limit: Number(limit) || 100,
      visualization: { type: vizType },
      header: {
        title: name || 'Untitled report',
        ...(headerSubtitle ? { subtitle: headerSubtitle } : {}),
        showFilters: true,
      },
    };
  }

  // ── Live preview ──
  async function handlePreview() {
    setPreviewing(true);
    setPreviewError('');
    const definition = buildDefinition();
    const parsed = analyticalReportDefinitionSchema.safeParse(definition);
    if (!parsed.success) {
      setPreviewError(parsed.error.issues.map((i) => i.message).join('; '));
      setPreviewRows(null);
      setPreviewing(false);
      return;
    }
    const { data, error } = await analyticalReportService.runDefinition(parsed.data, {});
    if (error) {
      setPreviewError(error);
      setPreviewRows(null);
    } else {
      setPreviewRows(data.rows);
    }
    setPreviewing(false);
  }

  // ── Save ──

  /**
   * Validate the current editor state into a definition. Returns
   * `{ definition }` on success or `{ error }` with a friendly message.
   */
  function validateDefinition() {
    const parsed = analyticalReportDefinitionSchema.safeParse(buildDefinition());
    if (!parsed.success) {
      return { error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
    }
    return { definition: parsed.data };
  }

  /** Create a brand-new report row + publish its first version. */
  async function persistNewReport(reportName, definition) {
    const created = await analyticalReportService.create({
      name: reportName,
      description: description || null,
      category,
      audience,
      created_by: user.id,
    });
    if (created.error) return { error: created.error };
    const published = await analyticalReportService.publishNewVersion(
      created.data.id, definition, { publishedBy: user.id },
    );
    if (published.error) return { error: published.error };
    return { reportId: created.data.id };
  }

  async function handleSave() {
    if (!user?.id) return;
    setSaving(true);
    setSaveError('');

    const validated = validateDefinition();
    if (validated.error) { setSaveError(validated.error); setSaving(false); return; }

    if (isNew) {
      const result = await persistNewReport(name, validated.definition);
      if (result.error) { setSaveError(result.error); setSaving(false); return; }
      addToast({ type: 'success', message: 'Report created.' });
      navigate(`/reports/${result.reportId}`, { replace: true });
      return;
    }

    // Edit: update metadata, then publish a new version.
    const updated = await analyticalReportService.update(id, {
      name, description: description || null, category, audience,
    });
    if (updated.error) { setSaveError(updated.error); setSaving(false); return; }
    const published = await analyticalReportService.publishNewVersion(
      id, validated.definition, { publishedBy: user.id },
    );
    if (published.error) { setSaveError(published.error); setSaving(false); return; }
    addToast({ type: 'success', message: 'Report updated.' });
    navigate(`/reports/${id}`);
  }

  /**
   * Save the current state as a brand-new report (fork / duplicate).
   * The natural path for customizing a built-in default report, since
   * default reports are trigger-protected from archival.
   */
  async function handleSaveAsCopy() {
    if (!user?.id) return;
    setSaving(true);
    setSaveError('');
    const validated = validateDefinition();
    if (validated.error) { setSaveError(validated.error); setSaving(false); return; }
    const copyName = name.startsWith('Copy of ') ? name : `Copy of ${name}`;
    const result = await persistNewReport(copyName, validated.definition);
    if (result.error) { setSaveError(result.error); setSaving(false); return; }
    addToast({ type: 'success', message: 'Saved as a new copy.' });
    navigate(`/reports/${result.reportId}`, { replace: true });
  }

  // ── Data-source change resets the column-bound builders ──
  function handleDataSourceChange(next) {
    setDataSource(next);
    setGroupBy([{ column: '', granularity: '' }]);
    setAggregations([{ fn: 'count', column: '', as: 'count' }]);
    setFilters([]);
    setOrderBy([]);
    setPreviewRows(null);
  }

  // ── Quick-start template handler ──
  function applyTemplate(template) {
    const def = template.definition;
    setName(def.header?.title || template.label);
    setDataSource(def.dataSource);
    setGroupBy(
      (def.groupBy || []).length
        ? def.groupBy.map((g) => ({ column: g.column, granularity: g.granularity || '' }))
        : [{ column: '', granularity: '' }],
    );
    setAggregations(
      (def.aggregations || []).length
        ? def.aggregations.map((a) => ({ fn: a.fn, column: a.column || '', as: a.as }))
        : [{ fn: 'count', column: '', as: 'count' }],
    );
    setFilters(
      (def.filters || []).map((f) => ({
        column: f.column,
        operator: f.operator,
        value: f.value == null ? '' : String(f.value),
        bind: f.bind || '',
      })),
    );
    setOrderBy((def.orderBy || []).map((o) => ({ ref: o.ref, dir: o.dir || 'desc' })));
    setLimit(def.limit || 100);
    setVizType(def.visualization?.type || 'bar');
    setHeaderSubtitle(def.header?.subtitle || '');
  }

  if (loading) {
    return (
      <DashboardLayout role="doctor">
        <div className="p-6"><LoadingSkeleton rows={10} /></div>
      </DashboardLayout>
    );
  }

  if (fetchError) {
    return (
      <DashboardLayout role="doctor">
        <div className="p-6">
          <EmptyState icon="error" title="Failed to load report" subtitle={fetchError} />
        </div>
      </DashboardLayout>
    );
  }

  const columnOptions = [
    { value: '', label: '— pick a column —' },
    ...availableColumns.map((c) => ({ value: c, label: resolveColumnLabel(dataSource, c) })),
  ];

  // Live validation — surfaces schema problems as the doctor builds, so
  // Save is never a surprise. Cheap enough to run every render.
  const definitionIssues = (() => {
    const parsed = analyticalReportDefinitionSchema.safeParse(buildDefinition());
    return parsed.success ? [] : parsed.error.issues.map((i) => i.message);
  })();

  return (
    <DashboardLayout role="doctor">
      <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-6 p-6">
        {/* Step progress indicator */}
        <motion.div variants={fadeUp}>
          <StepProgress steps={EDITOR_STEPS} current={currentStep} />
        </motion.div>

        {/* Quick-start templates (only for new reports) */}
        {isNew && (
          <motion.div variants={fadeUp} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Quick start</h2>
            <p className="text-xs text-slate-500">Pick a template to fill in the steps automatically — then tweak as needed.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {QUICK_START_TEMPLATES.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => applyTemplate(t)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 text-left"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div variants={fadeUp}>
          <PageHeader
            title={isNew ? 'New report' : `Edit: ${name || 'report'}`}
            subtitle="Build a report step by step — pick the data, what to measure, and how to show it."
            actions={
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (isDirty) { setShowCancelConfirm(true); } else { navigate('/reports'); }
                  }}
                  className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  aria-label="Cancel editing"
                >
                  Cancel
                </button>
                {!isNew && (
                  <button
                    type="button"
                    onClick={handleSaveAsCopy}
                    disabled={saving || !name.trim()}
                    className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    aria-label="Save as a new copy of this report"
                  >
                    Save as copy
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !name.trim()}
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  aria-label="Save this report"
                >
                  {saving ? 'Saving…' : 'Save report'}
                </button>
              </div>
            }
          />
        </motion.div>

        {saveError && (
          <motion.div variants={fadeUp} className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {saveError}
          </motion.div>
        )}

        {definitionIssues.length > 0 && (
          <motion.div variants={fadeUp} className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            <p className="font-medium">A few things to fix before this report can be saved:</p>
            <ul className="mt-1 list-disc pl-5 space-y-0.5">
              {definitionIssues.map((msg, i) => <li key={i}>{msg}</li>)}
            </ul>
          </motion.div>
        )}

        {/* Step 1 — Report details */}
        <motion.div variants={fadeUp} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">1. Report details</h2>
          <FormField label="Report name" value={name} onChange={setName} error={!name.trim() ? 'A name is required' : ''} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Category" type="select" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
            <FormField label="Who can see it" type="select" value={audience} onChange={setAudience} options={AUDIENCE_OPTIONS} />
          </div>
          <FormField label="Description" type="textarea" value={description} onChange={setDescription} />
          <FormField label="Chart subtitle (optional)" value={headerSubtitle} onChange={setHeaderSubtitle} />
        </motion.div>

        {/* Step 2 — Data */}
        <motion.div variants={fadeUp} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">2. What data</h2>
          <FormField
            label="Data source"
            type="select"
            value={dataSource}
            onChange={handleDataSourceChange}
            options={REPORT_DATA_SOURCES.map((s) => ({ value: s, label: DATA_SOURCE_LABELS[s] || s }))}
          />
          <p className="text-xs text-slate-500">
            You will only see rows your account is allowed to see — the report respects the same
            access rules as the rest of DoctoLeb.
          </p>
        </motion.div>

        {/* Step 3 — Break down by (group-by) */}
        <motion.div variants={fadeUp} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">3. Break down by</h2>
            <button
              type="button"
              onClick={() => setGroupBy((p) => [...p, { column: '', granularity: '' }])}
              disabled={groupBy.length >= 4}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:text-slate-400"
            >
              + Add breakdown
            </button>
          </div>
          {groupBy.map((g, idx) => {
            const supportsGran = columnSupportsGranularity(g.column);
            const granOptions = supportsGran
              ? ['', ...granularitiesForColumn(g.column)].map((gr) => ({ value: gr, label: GRANULARITY_LABELS[gr] }))
              : [{ value: '', label: 'Not applicable' }];
            return (
            <div key={idx} className="grid gap-3 sm:grid-cols-[2fr_2fr_auto] items-end">
              <FormField
                label="Column"
                type="select"
                value={g.column}
                onChange={(v) => setGroupBy((p) => p.map((x, i) => {
                  if (i !== idx) return x;
                  // Clear granularity if the new column doesn't support it
                  const nextGran = columnSupportsGranularity(v) ? x.granularity : '';
                  return { ...x, column: v, granularity: nextGran };
                }))}
                options={columnOptions}
              />
              <FormField
                label={supportsGran ? 'Time bucket' : 'Time bucket (not applicable)'}
                type="select"
                value={g.granularity || ''}
                onChange={(v) => setGroupBy((p) => p.map((x, i) => (i === idx ? { ...x, granularity: v } : x)))}
                options={granOptions}
                disabled={!supportsGran}
              />
              <button
                type="button"
                onClick={() => setGroupBy((p) => p.filter((_, i) => i !== idx))}
                className="mb-1 text-xs text-red-600 hover:text-red-800"
              >
                Remove
              </button>
            </div>
            );
          })}
          <p className="text-xs text-slate-500">
            Leave empty for a grand total. Add a column to split the numbers (e.g. by doctor, by month).
          </p>
        </motion.div>

        {/* Step 4 — Measure (aggregations) */}
        <motion.div variants={fadeUp} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">4. What to measure</h2>
            <button
              type="button"
              onClick={() => setAggregations((p) => [...p, { fn: 'count', column: '', as: `measure_${p.length + 1}` }])}
              disabled={aggregations.length >= 8}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:text-slate-400"
            >
              + Add measure
            </button>
          </div>
          {aggregations.map((a, idx) => {
            const aggColumnOptions = a.fn === 'count'
              ? columnOptions
              : [
                  { value: '', label: '— pick a column —' },
                  ...columnsForAggFn(a.fn).map((c) => ({ value: c, label: resolveColumnLabel(dataSource, c) })),
                ];
            return (
            <div key={idx} className="grid gap-3 sm:grid-cols-[2fr_2fr_2fr_auto] items-end">
              <FormField
                label="Measure"
                type="select"
                value={a.fn}
                onChange={(v) => setAggregations((p) => p.map((x, i) => {
                  if (i !== idx) return x;
                  // If the current column isn't valid for the new fn, clear it
                  const currentColValid = v === 'count' || columnsForAggFn(v).includes(x.column);
                  const nextColumn = currentColValid ? x.column : '';
                  const nextAs = v === 'count'
                    ? (x.as || 'count')
                    : slugifyAlias(`${v}_${resolveColumnLabel(dataSource, nextColumn)}`, x.as || `measure_${idx + 1}`);
                  return { ...x, fn: v, column: nextColumn, as: nextAs };
                }))}
                options={REPORT_AGGREGATION_FUNCTIONS.map((fn) => ({ value: fn, label: AGG_FN_LABELS[fn] || fn }))}
              />
              <FormField
                label={a.fn === 'count' ? 'Column (not needed)' : 'Column'}
                type="select"
                value={a.column || ''}
                onChange={(v) => setAggregations((p) => p.map((x, i) => (i === idx
                  ? { ...x, column: v, as: x.fn === 'count' ? x.as : slugifyAlias(`${x.fn}_${resolveColumnLabel(dataSource, v)}`, x.as) }
                  : x)))}
                options={aggColumnOptions}
              />
              <FormField
                label="Result name"
                value={a.as}
                onChange={(v) => setAggregations((p) => p.map((x, i) => (i === idx ? { ...x, as: slugifyAlias(v, x.as) } : x)))}
              />
              <button
                type="button"
                onClick={() => setAggregations((p) => p.filter((_, i) => i !== idx))}
                disabled={aggregations.length <= 1}
                className="mb-1 text-xs text-red-600 hover:text-red-800 disabled:text-slate-300"
              >
                Remove
              </button>
            </div>
            );
          })}
        </motion.div>

        {/* Step 5 — Filters */}
        <motion.div variants={fadeUp} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">5. Filters (optional)</h2>
            <button
              type="button"
              onClick={() => setFilters((p) => [...p, { column: '', operator: 'eq', value: '' }])}
              disabled={filters.length >= 12}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:text-slate-400"
            >
              + Add filter
            </button>
          </div>
          {filters.length === 0 && (
            <p className="text-xs text-slate-500">No filters — the report counts every row you can see.</p>
          )}
          {filters.map((f, idx) => {
            const noValue = f.operator === 'is_null' || f.operator === 'not_null';
            const bound = Boolean(f.bind);
            const allowedOps = operatorsForColumn(f.column);
            const enumVals = enumValuesForColumn(f.column);
            const isEnumColumn = Boolean(enumVals);
            // For enum columns with eq/neq/in/not_in, show a select instead of text
            const showEnumSelect = isEnumColumn && !noValue && (f.operator === 'eq' || f.operator === 'neq');
            const showEnumMulti = isEnumColumn && !noValue && (f.operator === 'in' || f.operator === 'not_in');
            return (
              <div key={idx} className="rounded-lg border border-slate-150 bg-slate-50 p-3 space-y-2">
                <div className="grid gap-3 sm:grid-cols-[2fr_2fr_2fr_auto] items-end">
                  <FormField
                    label="Column"
                    type="select"
                    value={f.column}
                    onChange={(v) => setFilters((p) => p.map((x, i) => {
                      if (i !== idx) return x;
                      // If the current operator isn't valid for the new column, reset to eq
                      const newOps = operatorsForColumn(v);
                      const opValid = newOps.includes(x.operator);
                      return { ...x, column: v, operator: opValid ? x.operator : 'eq', value: '' };
                    }))}
                    options={columnOptions}
                  />
                  <FormField
                    label="Condition"
                    type="select"
                    value={f.operator}
                    onChange={(v) => setFilters((p) => p.map((x, i) => (i === idx ? { ...x, operator: v, value: '' } : x)))}
                    options={allowedOps.map((op) => ({ value: op, label: OPERATOR_LABELS[op] || op }))}
                  />
                  {showEnumSelect ? (
                    <FormField
                      label={bound ? 'Default value' : 'Value'}
                      type="select"
                      value={f.value || ''}
                      onChange={(v) => setFilters((p) => p.map((x, i) => (i === idx ? { ...x, value: v } : x)))}
                      options={[{ value: '', label: '— pick a value —' }, ...enumVals.map((v) => ({ value: v, label: v }))]}
                    />
                  ) : showEnumMulti ? (
                    <FormField
                      label={bound ? 'Default values (comma-separated)' : 'Values (comma-separated)'}
                      value={noValue ? '' : (f.value || '')}
                      onChange={(v) => setFilters((p) => p.map((x, i) => (i === idx ? { ...x, value: v } : x)))}
                      hint={isEnumColumn ? `Allowed: ${enumVals.join(', ')}` : undefined}
                    />
                  ) : (
                    <FormField
                      label={noValue ? 'Value (not needed)' : (bound ? 'Default value' : 'Value')}
                      value={noValue ? '' : (f.value || '')}
                      onChange={(v) => setFilters((p) => p.map((x, i) => (i === idx ? { ...x, value: v } : x)))}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setFilters((p) => p.filter((_, i) => i !== idx))}
                    className="mb-1 text-xs text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={bound}
                    onChange={(e) => setFilters((p) => p.map((x, i) => {
                      if (i !== idx) return x;
                      return {
                        ...x,
                        bind: e.target.checked
                          ? slugifyAlias(x.column || `filter_${idx + 1}`, `filter_${idx + 1}`)
                          : '',
                      };
                    }))}
                    className="rounded border-slate-300"
                  />
                  Let viewers change this filter when they open the report
                </label>
                {bound && (
                  <p className="text-xs text-slate-500">
                    Viewers will see a “{f.bind}” filter box — the value above is the default.
                  </p>
                )}
              </div>
            );
          })}
        </motion.div>

        {/* Step 6 — Sort, limit, chart */}
        <motion.div variants={fadeUp} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">6. Sort &amp; display</h2>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Sort by</span>
            <button
              type="button"
              onClick={() => setOrderBy((p) => [...p, { ref: resultKeys[0] || '', dir: 'desc' }])}
              disabled={orderBy.length >= 4 || resultKeys.length === 0}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:text-slate-400"
            >
              + Add sort
            </button>
          </div>
          {orderBy.map((o, idx) => (
            <div key={idx} className="grid gap-3 sm:grid-cols-[2fr_2fr_auto] items-end">
              <FormField
                label="Sort field"
                type="select"
                value={o.ref}
                onChange={(v) => setOrderBy((p) => p.map((x, i) => (i === idx ? { ...x, ref: v } : x)))}
                options={resultKeys.map((k) => ({ value: k, label: resolveColumnLabel(dataSource, k) || prettyColumn(k) }))}
              />
              <FormField
                label="Direction"
                type="select"
                value={o.dir}
                onChange={(v) => setOrderBy((p) => p.map((x, i) => (i === idx ? { ...x, dir: v } : x)))}
                options={[{ value: 'desc', label: 'Highest first' }, { value: 'asc', label: 'Lowest first' }]}
              />
              <button
                type="button"
                onClick={() => setOrderBy((p) => p.filter((_, i) => i !== idx))}
                className="mb-1 text-xs text-red-600 hover:text-red-800"
              >
                Remove
              </button>
            </div>
          ))}
          <div className="grid gap-4 sm:grid-cols-2 pt-2">
            <FormField
              label="Chart type"
              type="select"
              value={vizType}
              onChange={setVizType}
              options={REPORT_VISUALIZATIONS.map((v) => ({ value: v, label: VIZ_LABELS[v] || v }))}
            />
            <FormField
              label="Max rows"
              type="number"
              value={String(limit)}
              onChange={(v) => setLimit(v)}
            />
          </div>
        </motion.div>

        {/* Preview — auto-refreshes when definition changes */}
        <motion.div variants={fadeUp} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 relative overflow-hidden">
          {/* Indeterminate progress bar while preview is running */}
          {previewing && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-slate-100 overflow-hidden" aria-hidden="true">
              <div className="h-full bg-slate-500 animate-[slide-progress_1.5s_ease-in-out_infinite]" style={{ width: '40%' }} />
            </div>
          )}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Preview</h2>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoPreviewEnabled}
                  onChange={(e) => setAutoPreviewEnabled(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-slate-800 focus:ring-slate-500"
                />
                Auto-preview
              </label>
              {previewing && (
                <span className="text-sm text-slate-600 font-medium animate-pulse" aria-live="polite">Refreshing…</span>
              )}
              <button
                type="button"
                onClick={handlePreview}
                disabled={previewing}
                className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 disabled:opacity-50"
              >
                {previewing ? 'Running…' : 'Run now'}
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            {autoPreviewEnabled
              ? 'Preview auto-refreshes when you change settings (3s delay). You can also click "Run now" for an immediate refresh.'
              : 'Auto-preview is off. Click "Run now" to preview manually, or enable auto-preview above.'}
          </p>
          {previewError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{previewError}</div>
          )}
          {previewing ? (
            <LoadingSkeleton rows={5} />
          ) : previewRows == null ? (
            <p className="text-sm text-slate-400 italic">Fill in the steps above — preview will appear automatically.</p>
          ) : (
            <ChartErrorBoundary>
              <ChartRenderer definition={buildDefinition()} rows={previewRows} />
            </ChartErrorBoundary>
          )}
        </motion.div>
      </motion.div>
      {/* Cancel confirmation — warns about unsaved changes */}
      <ConfirmDialog
        isOpen={showCancelConfirm}
        title="Discard unsaved changes?"
        message="You have made changes that haven't been saved. Leaving now will lose all your edits."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        variant="danger"
        onConfirm={() => { setShowCancelConfirm(false); navigate('/reports'); }}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </DashboardLayout>
  );
}
