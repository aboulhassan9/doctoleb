/**
 * ReportViewerPage — Runs a saved analytical report and renders its chart.
 *
 * Flow:
 *   1. Load the report metadata + current published version.
 *   2. Call `analyticalReportService.runByReport(id)` — the RPC executes
 *      the closed-set query as the logged-in user; RLS still scopes rows.
 *   3. Hand the `{ rows }` envelope to ChartRenderer + a tabular detail.
 *
 * Surfaces:
 *   - Filter strip — for bound filters (filter.bind) the doctor can adjust.
 *   - Drill-down — click a chart element to add an eq filter and re-run.
 *   - CSV export — the current rows, escaped, client-side download.
 *   - Print — browser print with @media print CSS hiding non-content elements.
 *   - Recent runs — the requester-scoped run ledger (analytical_report_runs).
 *   - Archive — doctor/admin only; default reports are trigger-protected.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import DashboardLayout from '@ui/components/layouts/DashboardLayout';
import {
  PageHeader, LoadingSkeleton, EmptyState, ChartRenderer, ChartErrorBoundary, FormField,
  StatusBadge, ConfirmDialog, DatePickerInput,
} from '@ui/components/ui';
import { useAuth } from '@ui/contexts/AuthContext';
import { analyticalReportService } from '@core/services/analyticalReports';
import { REPORT_DATA_SOURCE_COLUMN_TYPES } from '@core/schemas/analyticalReports';
import { resolveColumnLabel } from '@core/lib/reportLabels';
import { toCsv } from '@core/lib/csv';
import '@ui/styles/print-report.css';
import { timeAgo, RELATIVE_DATE_SHORTCUTS } from '@core/lib/dateUtils';
import { stagger, fadeUp } from '@core/lib/animations';
import ReportSharePanel from '../components/reports/ReportSharePanel';
import ReportSchedulePanel from '../components/reports/ReportSchedulePanel';

export default function ReportViewerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user?.role === 'doctor' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';

  const [report, setReport] = useState(null);
  const [version, setVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [filterArgs, setFilterArgs] = useState({});
  const [viewingOldVersion, setViewingOldVersion] = useState(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Recent-runs ledger. `runsTick` is bumped after each run so the panel
  // refreshes once the fire-and-forget ledger write has had a moment to land.
  const [runs, setRuns] = useState([]);
  const [runsTick, setRunsTick] = useState(0);

  // Archive
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Sharing
  const [showShare, setShowShare] = useState(false);

  // PDF export
  const [exportingPdf, setExportingPdf] = useState(false);

  // Scheduling
  const [showSchedule, setShowSchedule] = useState(false);

  // Drill-down — each entry is { column, operator, value, label }
  const [drillDownFilters, setDrillDownFilters] = useState([]);

  // Load report + current version on mount.
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [reportRes, versionRes] = await Promise.all([
        analyticalReportService.getById(id),
        analyticalReportService.getCurrentVersion(id),
      ]);
      if (!alive) return;

      if (reportRes.error) {
        setError(reportRes.error);
        setLoading(false);
        return;
      }
      if (versionRes.error) {
        setError(versionRes.error);
        setLoading(false);
        return;
      }
      setReport(reportRes.data);
      setVersion(versionRes.data);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [id]);

  // When `viewingOldVersion` is set the page previews a past version;
  // otherwise it shows the current published version.
  const activeVersion = viewingOldVersion || version;
  const definition = activeVersion?.definition || null;
  const isOwner = Boolean(report?.created_by) && report.created_by === user?.id;

  // Bound filters from the definition — the only ones we expose as a UI
  // filter strip. Inline (non-bound) filters are part of the saved report
  // and not user-editable.
  const boundFilters = useMemo(() => {
    if (!definition?.filters) return [];
    return definition.filters.filter((f) => typeof f.bind === 'string' && f.bind.length > 0);
  }, [definition]);

  // ── Drill-down ──────────────────────────────────────────────────────
  const handleDrillDown = useCallback(({ column, value, dataSource }) => {
    if (running) return; // skip if a run is already in progress
    const label = resolveColumnLabel(dataSource, column);
    // Avoid duplicate drill-down on the same column + value
    if (drillDownFilters.some((f) => f.column === column && f.value === value)) return;
    const next = [...drillDownFilters, { column, operator: 'eq', value, label }];
    setDrillDownFilters(next);
    void runWithDrillDown(next);
  }, [drillDownFilters, running]);

  function handleRemoveDrillDown(index) {
    if (running) return;
    const next = drillDownFilters.filter((_, i) => i !== index);
    setDrillDownFilters(next);
    if (next.length > 0) void runWithDrillDown(next);
    else void runReport();
  }

  function handleClearDrillDown() {
    if (running) return;
    setDrillDownFilters([]);
    void runReport();
  }

  // ── Print ───────────────────────────────────────────────────────────
  function handlePrint() {
    window.print();
  }

  // ── Run (original report, no drill-down) ────────────────────────────
  async function runReport(overrides, { forceCurrent = false } = {}) {
    if (!report?.id || !user?.id) return;
    const args = overrides ?? filterArgs;
    setRunning(true);
    setError('');
    // Previewing a past version: run that definition ad-hoc, no ledger entry.
    if (viewingOldVersion && !forceCurrent) {
      const { data, error: err } = await analyticalReportService.runDefinition(
        viewingOldVersion.definition,
        args || {},
      );
      if (err) {
        setError(err);
        setRows([]);
      } else {
        setRows(data?.rows || []);
      }
      setRunning(false);
      return;
    }
    const { data, error: err } = await analyticalReportService.runByReport(
      report.id,
      args || {},
      { requestedBy: user.id },
    );
    if (err) {
      setError(err);
      setRows([]);
    } else {
      setRows(data?.rows || []);
    }
    setRunning(false);
    setRunsTick((t) => t + 1);
  }

  // ── Run with drill-down filters ─────────────────────────────────────
  // Clones the definition, appends drill-down eq filters, and calls
  // runDefinition (no ledger entry — drill-down is exploratory).
  async function runWithDrillDown(ddFilters) {
    if (!definition) return;
    setRunning(true);
    setError('');
    const modifiedDef = {
      ...definition,
      filters: [
        ...(definition.filters || []),
        ...ddFilters.map((f) => ({ column: f.column, operator: f.operator, value: f.value })),
      ],
    };
    const { data, error: err } = await analyticalReportService.runDefinition(
      modifiedDef,
      filterArgs || {},
    );
    if (err) {
      setError(err);
      setRows([]);
    } else {
      setRows(data?.rows || []);
    }
    setRunning(false);
    // Drill-down runs are exploratory — no ledger entry needed.
  }

  // Auto-run once the report + version are loaded.
  useEffect(() => {
    if (report?.id && version?.id && user?.id) {
      void (async () => {
        setRunning(true);
        setError('');
        const { data, error: err } = await analyticalReportService.runByReport(
          report.id,
          {},
          { requestedBy: user.id },
        );
        if (err) {
          setError(err);
          setRows([]);
        } else {
          setRows(data?.rows || []);
        }
        setRunning(false);
        setRunsTick((t) => t + 1);
      })();
    }
  }, [report?.id, version?.id, user?.id]);

  // Load the recent-runs ledger whenever the report changes or a run fires.
  useEffect(() => {
    if (!report?.id) return undefined;
    let alive = true;
    (async () => {
      const { data } = await analyticalReportService.listMyRuns({
        reportId: report.id, page: 1, pageSize: 8,
      });
      if (alive && Array.isArray(data)) setRuns(data);
    })();
    return () => { alive = false; };
  }, [report?.id, runsTick]);

  // ── CSV export ──
  function handleExportCsv() {
    const headerMap = definition?.dataSource
      ? Object.fromEntries(
          Object.keys(rows[0] || {}).map((k) => [k, resolveColumnLabel(definition.dataSource, k)])
        )
      : null;
    const csv = toCsv(rows, headerMap);
    if (!csv) return;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${(report?.name || 'report').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  // ── PDF export ──
  // Hands the displayed rows + definition to the render Edge Function and
  // downloads the returned PDF. Matches exactly what the viewer shows.
  async function handleExportPdf() {
    if (!definition || rows.length === 0) return;
    setExportingPdf(true);
    setError('');
    const columnLabels = Object.fromEntries(
      Object.keys(rows[0] || {}).map((k) => [k, resolveColumnLabel(definition.dataSource, k)]),
    );
    const { data, error: err } = await analyticalReportService.exportReportPdf({
      reportName: report?.name || definition?.header?.title || 'Analytical report',
      definition,
      rows,
      columnLabels,
    });
    setExportingPdf(false);
    if (err) {
      setError(err);
      return;
    }
    const bytes = Uint8Array.from(atob(data.pdfBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = data.filename || 'report.pdf';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  // ── Archive ──
  async function handleArchive() {
    if (!user?.id) return;
    setArchiving(true);
    const { error: err } = await analyticalReportService.archive(id, user.id);
    setArchiving(false);
    setShowArchiveConfirm(false);
    if (err) {
      // Default reports are protected by a DB trigger — the message
      // ("Cannot archive a default analytical report…") surfaces here.
      setError(err);
      return;
    }
    navigate('/reports');
  }

  // ── Version history ──────────────────────────────────────────────────
  async function loadVersions() {
    if (!report?.id) return;
    setVersionsLoading(true);
    const { data } = await analyticalReportService.listVersions(report.id, {
      page: 1, pageSize: 50,
    });
    if (Array.isArray(data)) setVersions(data);
    setVersionsLoading(false);
  }

  function toggleVersionHistory() {
    const next = !showVersionHistory;
    setShowVersionHistory(next);
    if (next && versions.length === 0) void loadVersions();
  }

  // Preview a past version read-only — runs that version's definition
  // ad-hoc (no ledger entry) and switches the page into old-version mode.
  async function handleViewVersion(v) {
    if (running || !v?.definition) return;
    setViewingOldVersion(v);
    setDrillDownFilters([]);
    setFilterArgs({});
    setRunning(true);
    setError('');
    const { data, error: err } = await analyticalReportService.runDefinition(v.definition, {});
    if (err) {
      setError(err);
      setRows([]);
    } else {
      setRows(data?.rows || []);
    }
    setRunning(false);
  }

  // Leave old-version mode and re-run the current published version.
  function handleBackToCurrent() {
    if (running) return;
    setViewingOldVersion(null);
    setDrillDownFilters([]);
    setFilterArgs({});
    void runReport({}, { forceCurrent: true });
  }

  // Restore = publish a NEW version carrying the old definition. Existing
  // versions stay immutable; the auto-run effect re-renders once `version`
  // updates to the freshly-published row.
  async function handleRestoreVersion() {
    if (!viewingOldVersion || !user?.id) return;
    setRestoring(true);
    const { error: err } = await analyticalReportService.publishNewVersion(
      report.id,
      viewingOldVersion.definition,
      { publishedBy: user.id },
    );
    setRestoring(false);
    setShowRestoreConfirm(false);
    if (err) {
      setError(err);
      return;
    }
    setViewingOldVersion(null);
    setDrillDownFilters([]);
    setFilterArgs({});
    const versionRes = await analyticalReportService.getCurrentVersion(report.id);
    if (!versionRes.error) setVersion(versionRes.data);
    await loadVersions();
  }

  if (loading) {
    return (
      <DashboardLayout role="doctor">
        <div className="p-6"><LoadingSkeleton rows={10} /></div>
      </DashboardLayout>
    );
  }

  if (error && !report) {
    return (
      <DashboardLayout role="doctor">
        <div className="p-6">
          <EmptyState icon="error" title="Failed to load report" subtitle={error} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="doctor">
      <a href="#report-content" className="skip-link">Skip to report content</a>
      <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-6 p-6 print-area">
        <motion.div variants={fadeUp} className="no-print">
          <PageHeader
            title={report?.name || definition?.header?.title || 'Report'}
            subtitle={report?.description || definition?.header?.subtitle}
            actions={
              <div className="flex items-center gap-3">
                {rows.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    aria-label="Export report data as CSV"
                  >
                    Export CSV
                  </button>
                )}
                {rows.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    disabled={exportingPdf}
                    className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    aria-label="Export report as PDF"
                  >
                    {exportingPdf ? 'Exporting…' : 'Export PDF'}
                  </button>
                )}
                {rows.length > 0 && (
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    aria-label="Print this report"
                  >
                    🖶 Print
                  </button>
                )}
                {(isOwner || isAdmin) && (
                  <button
                    type="button"
                    onClick={() => setShowShare(true)}
                    className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    aria-label="Share this report"
                  >
                    Share
                  </button>
                )}
                {(isOwner || isAdmin) && (
                  <button
                    type="button"
                    onClick={() => setShowSchedule(true)}
                    className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    aria-label="Schedule this report"
                  >
                    Schedule
                  </button>
                )}
                {canManage && (
                  <button
                    type="button"
                    onClick={() => navigate(`/reports/${id}/edit`)}
                    className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    aria-label="Edit this report"
                  >
                    Edit
                  </button>
                )}
                {canManage && !report?.is_default && (
                  <button
                    type="button"
                    onClick={() => setShowArchiveConfirm(true)}
                    className="inline-flex items-center px-3 py-2 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50"
                    aria-label="Archive this report"
                  >
                    Archive
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (running) { setShowBackConfirm(true); } else { navigate('/reports'); }
                  }}
                  className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  aria-label="Back to reports library"
                >
                  ← Back to library
                </button>
              </div>
            }
          />
        </motion.div>

        {/* Viewing-a-past-version banner */}
        {viewingOldVersion && (
          <motion.div variants={fadeUp} className="rounded-xl border border-amber-300 bg-amber-50 p-4 no-print" role="status">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-amber-800">
                <span className="font-semibold">Viewing version {viewingOldVersion.version_number}</span>
                {' — a past snapshot. It is not the current report.'}
              </p>
              <div className="flex items-center gap-2">
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setShowRestoreConfirm(true)}
                    disabled={running || restoring}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
                  >
                    Restore this version
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleBackToCurrent}
                  disabled={running}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg border border-amber-300 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                >
                  Back to current
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Filter strip — only rendered when the definition has bound filters */}
        {boundFilters.length > 0 && definition?.header?.showFilters !== false && (
          <motion.div variants={fadeUp} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 no-print" role="region" aria-label="Report filters">
            <h3 className="text-sm font-semibold text-slate-700">Filters</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {boundFilters.map((f) => {
                const colType = (REPORT_DATA_SOURCE_COLUMN_TYPES[definition.dataSource] || {})[f.column]?.type;
                const isDateCol = colType === 'timestamp' || colType === 'date';
                const enumVals = (REPORT_DATA_SOURCE_COLUMN_TYPES[definition.dataSource] || {})[f.column]?.values;
                const isEnumCol = Boolean(enumVals);
                const colLabel = resolveColumnLabel(definition.dataSource, f.column) || f.bind;

                if (isDateCol) {
                  return (
                    <div key={f.bind} className="space-y-1.5">
                      <DatePickerInput
                        label={colLabel}
                        name={f.bind}
                        value={filterArgs[f.bind] ?? ''}
                        onChange={(e) => setFilterArgs((prev) => ({ ...prev, [f.bind]: e.target.value }))}
                      />
                      <div className="flex flex-wrap gap-1">
                        {RELATIVE_DATE_SHORTCUTS.map(({ label, getValue }) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => setFilterArgs((prev) => ({ ...prev, [f.bind]: getValue() }))}
                            className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }

                if (isEnumCol) {
                  return (
                    <FormField
                      key={f.bind}
                      name={f.bind}
                      label={colLabel}
                      type="select"
                      value={filterArgs[f.bind] ?? ''}
                      onChange={(v) => setFilterArgs((prev) => ({ ...prev, [f.bind]: v }))}
                      options={[{ value: '', label: `— pick ${colLabel} —` }, ...enumVals.map((v) => ({ value: v, label: v }))]}
                      aria-label={`Filter: ${colLabel}`}
                    />
                  );
                }

                return (
                  <FormField
                    key={f.bind}
                    name={f.bind}
                    label={colLabel}
                    value={filterArgs[f.bind] ?? ''}
                    onChange={(v) => setFilterArgs((prev) => ({ ...prev, [f.bind]: v }))}
                    aria-label={`Filter: ${colLabel}`}
                  />
                );
              })}
            </div>
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => runReport()}
                disabled={running}
                className="inline-flex items-center px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                aria-label="Run report with current filters"
              >
                {running ? 'Running…' : 'Run'}
              </button>
            </div>
          </motion.div>
        )}

        {/* Drill-down filter chips — shows active drill-down filters with remove/clear */}
        {drillDownFilters.length > 0 && (
          <motion.div variants={fadeUp} className="rounded-xl border border-blue-200 bg-blue-50 p-3 no-print" role="region" aria-label="Drill-down filters">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-blue-800">
                Drill-down filters ({drillDownFilters.length})
              </h3>
              <button
                type="button"
                onClick={handleClearDrillDown}
                disabled={running}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                aria-label="Clear all drill-down filters"
              >
                Clear all
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2" role="group" aria-label="Active drill-down filter chips">
              {drillDownFilters.map((f, i) => (
                <span
                  key={`${f.column}-${f.value}`}
                  className="inline-flex items-center gap-1 rounded-full bg-white border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700"
                  role="status"
                >
                  {f.label} = {String(f.value)}
                  <button
                    type="button"
                    onClick={() => handleRemoveDrillDown(i)}
                    disabled={running}
                    className="text-blue-400 hover:text-blue-700 ml-0.5 disabled:opacity-50"
                    title="Remove this filter"
                    aria-label={`Remove drill-down filter: ${f.label} = ${f.value}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <p className="text-xs text-blue-600 mt-2">
              Click any chart element to drill down. These filters narrow the results further.
            </p>
          </motion.div>
        )}

        {error && (
          <motion.div variants={fadeUp} className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700" role="alert" aria-live="polite">
            {error}
          </motion.div>
        )}

        <div aria-live="polite" className="sr-only">
          {running ? 'Running report...' : error ? `Report failed: ${error}` : rows.length > 0 ? `Report completed with ${rows.length} results` : ''}
        </div>

        {/* Chart */}
        <motion.div id="report-content" variants={fadeUp} className="rounded-xl border border-slate-200 bg-white p-5" role="region" aria-label="Report chart" aria-busy={running || undefined}>
          {running ? (
            <LoadingSkeleton rows={6} />
          ) : (
            <ChartErrorBoundary>
              <ChartRenderer
                definition={definition}
                rows={rows}
                onDrillDown={handleDrillDown}
              />
            </ChartErrorBoundary>
          )}
        </motion.div>

        {/* Detail table */}
        {rows.length > 0 && definition?.visualization?.type !== 'table' && (
          <motion.div variants={fadeUp} className="rounded-xl border border-slate-200 bg-white p-5 print-break" role="region" aria-label="Report detail table">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Detail rows</h3>
            <ChartErrorBoundary>
              <ChartRenderer
                definition={{ ...(definition || {}), visualization: { type: 'table' } }}
                rows={rows}
                onDrillDown={handleDrillDown}
              />
            </ChartErrorBoundary>
          </motion.div>
        )}

        {/* Recent runs — the requester-scoped run ledger */}
        {runs.length > 0 && (
          <motion.div variants={fadeUp} className="rounded-xl border border-slate-200 bg-white p-5 no-print">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Your recent runs</h3>
            <div className="space-y-2">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <StatusBadge status={run.status} size="sm" />
                    <span className="text-slate-600">{timeAgo(run.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-4 text-slate-500">
                    {run.result_row_count != null && (
                      <span title="Rows returned">{run.result_row_count} results</span>
                    )}
                    {run.latency_ms != null && (
                      <span title="Execution time">{run.latency_ms} ms</span>
                    )}
                    {run.scanned_row_estimate != null && (
                      <span title="Rows scanned">{run.scanned_row_estimate} scanned</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Version history */}
        <motion.div variants={fadeUp} className="rounded-xl border border-slate-200 bg-white no-print">
          <button
            type="button"
            onClick={toggleVersionHistory}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
            aria-expanded={showVersionHistory}
          >
            <h3 className="text-sm font-semibold text-slate-700">Version history</h3>
            <span className="text-sm text-slate-400" aria-hidden="true">{showVersionHistory ? '▲' : '▼'}</span>
          </button>
          {showVersionHistory && (
            <div className="border-t border-slate-100 px-5 py-4">
              {versionsLoading ? (
                <LoadingSkeleton rows={3} />
              ) : versions.length === 0 ? (
                <p className="text-sm text-slate-500">No versions found for this report.</p>
              ) : (
                <ul className="space-y-2">
                  {versions.map((v) => {
                    const isViewing = viewingOldVersion?.id === v.id;
                    return (
                      <li
                        key={v.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"
                      >
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-slate-700">v{v.version_number}</span>
                          <StatusBadge status={v.status} size="sm" />
                          {v.is_current && (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                              Current
                            </span>
                          )}
                          <span className="text-xs text-slate-500">
                            {timeAgo(v.published_at || v.created_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {v.is_current ? (
                            viewingOldVersion ? (
                              <button
                                type="button"
                                onClick={handleBackToCurrent}
                                disabled={running}
                                className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                              >
                                Back to current
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">Showing now</span>
                            )
                          ) : isViewing ? (
                            <span className="text-xs font-medium text-amber-600">Viewing</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleViewVersion(v)}
                              disabled={running}
                              className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                              aria-label={`View version ${v.version_number}`}
                            >
                              View this version
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>

      <ConfirmDialog
        isOpen={showArchiveConfirm}
        title="Archive this report?"
        message="The report will be removed from the library. Saved run history is kept. This can be reversed by an admin."
        confirmLabel={archiving ? 'Archiving…' : 'Archive'}
        cancelLabel="Keep it"
        variant="danger"
        onConfirm={handleArchive}
        onCancel={() => setShowArchiveConfirm(false)}
      />

      {/* Back confirmation — warns when a report is still running */}
      <ConfirmDialog
        isOpen={showBackConfirm}
        title="Leave while report is running?"
        message="The report is still executing. Leaving now will not cancel the run, but you will not see the results."
        confirmLabel="Leave anyway"
        cancelLabel="Stay here"
        variant="warning"
        onConfirm={() => { setShowBackConfirm(false); navigate('/reports'); }}
        onCancel={() => setShowBackConfirm(false)}
      />

      {/* Restore confirmation — publishes the old definition as a new version */}
      <ConfirmDialog
        isOpen={showRestoreConfirm}
        title="Restore this version?"
        message={`Version ${viewingOldVersion?.version_number ?? ''} will be published as a new current version. Existing versions are kept unchanged.`}
        confirmLabel={restoring ? 'Restoring…' : 'Restore'}
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={handleRestoreVersion}
        onCancel={() => setShowRestoreConfirm(false)}
      />

      {showShare && report && (
        <ReportSharePanel
          report={report}
          currentUserId={user?.id}
          isAdmin={isAdmin}
          onClose={() => setShowShare(false)}
          onOwnershipChanged={(updated) => setReport(updated)}
        />
      )}

      {showSchedule && report && (
        <ReportSchedulePanel
          report={report}
          currentUserId={user?.id}
          isAdmin={isAdmin}
          onClose={() => setShowSchedule(false)}
        />
      )}
    </DashboardLayout>
  );
}
