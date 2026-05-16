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
  StatusBadge, ConfirmDialog,
} from '@ui/components/ui';
import { useAuth } from '@ui/contexts/AuthContext';
import { analyticalReportService } from '@core/services/analyticalReports';
import { resolveColumnLabel } from '@core/lib/reportLabels';
import { toCsv } from '@core/lib/csv';
import '@ui/styles/print-report.css';
import { timeAgo } from '@core/lib/dateUtils';
import { stagger, fadeUp } from '@core/lib/animations';

export default function ReportViewerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user?.role === 'doctor' || user?.role === 'admin';

  const [report, setReport] = useState(null);
  const [version, setVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [filterArgs, setFilterArgs] = useState({});

  // Recent-runs ledger. `runsTick` is bumped after each run so the panel
  // refreshes once the fire-and-forget ledger write has had a moment to land.
  const [runs, setRuns] = useState([]);
  const [runsTick, setRunsTick] = useState(0);

  // Archive
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);

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

  const definition = version?.definition || null;

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
  async function runReport(overrides) {
    if (!report?.id || !user?.id) return;
    const args = overrides ?? filterArgs;
    setRunning(true);
    setError('');
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
                    onClick={handlePrint}
                    className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    aria-label="Print this report"
                  >
                    🖶 Print
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

        {/* Filter strip — only rendered when the definition has bound filters */}
        {boundFilters.length > 0 && definition?.header?.showFilters !== false && (
          <motion.div variants={fadeUp} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 no-print" role="region" aria-label="Report filters">
            <h3 className="text-sm font-semibold text-slate-700">Filters</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {boundFilters.map((f) => (
                <FormField
                  key={f.bind}
                  label={resolveColumnLabel(definition.dataSource, f.column) || f.bind}
                  value={filterArgs[f.bind] ?? ''}
                  onChange={(v) => setFilterArgs((prev) => ({ ...prev, [f.bind]: v }))}
                  aria-label={`Filter: ${resolveColumnLabel(definition.dataSource, f.column) || f.bind}`}
                />
              ))}
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
          <motion.div variants={fadeUp} className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </motion.div>
        )}

        {/* Chart */}
        <motion.div variants={fadeUp} className="rounded-xl border border-slate-200 bg-white p-5" role="region" aria-label="Report chart">
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
    </DashboardLayout>
  );
}
