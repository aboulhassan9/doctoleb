/**
 * ReportsPage — Library of saved analytical reports.
 *
 * Lists every report visible to the current user (RLS scopes the read).
 * Doctors / admins get a "New report" button; secretaries / predoctors see
 * read-run only. The feature flag `analytical_reports` controls whether
 * the page is even reachable via the sidebar.
 *
 * Why not split into a chart-per-card preview here:
 *   Each card running its own report on mount would multiply DB load by
 *   the catalog size on every page visit. Cards stay metadata-only; users
 *   click through to the viewer to see live data.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import DashboardLayout from '@ui/components/layouts/DashboardLayout';
import { PageHeader, LoadingSkeleton, EmptyState } from '@ui/components/ui';
import { useAuth } from '@ui/contexts/AuthContext';
import { analyticalReportService } from '@core/services/analyticalReports';
import { stagger, fadeUp } from '@core/lib/animations';

const CATEGORY_LABELS = Object.freeze({
  clinical_activity: 'Clinical activity',
  medication_usage: 'Medications',
  lab_workflow: 'Lab workflow',
  financial: 'Financial',
  operational: 'Operational',
  custom: 'Custom',
});

const CATEGORY_ORDER = [
  'clinical_activity',
  'medication_usage',
  'lab_workflow',
  'financial',
  'operational',
  'custom',
];

export default function ReportsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canAuthor = user?.role === 'doctor' || user?.role === 'admin';

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 12;

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data, meta, error: err } = await analyticalReportService.list({
        category: activeCategory,
        page,
        pageSize: PAGE_SIZE,
      });
      if (!alive) return;
      if (err) {
        setError(err);
        setReports([]);
        setTotalPages(0);
        setTotalCount(0);
      } else {
        setReports(data || []);
        setTotalPages(meta?.pagination?.totalPages ?? 0);
        setTotalCount(meta?.pagination?.totalItems ?? 0);
        setError('');
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [activeCategory, page]);

  /** Reset to page 1 when category filter changes. */
  const handleCategoryChange = (cat) => {
    setActiveCategory(cat);
    setPage(1);
  };

  // Group reports by category for the library layout (matches doctor's
  // mental model better than a flat list once the catalog grows).
  const grouped = reports.reduce((acc, r) => {
    (acc[r.category] = acc[r.category] || []).push(r);
    return acc;
  }, {});

  return (
    <DashboardLayout role="doctor">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="space-y-6 p-6"
      >
        <motion.div variants={fadeUp}>
          <PageHeader
            title="Reports"
            subtitle="Saved analytical reports — counts, sums, trends across your clinic."
            actions={canAuthor ? (
              <button
                type="button"
                onClick={() => navigate('/reports/new')}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              >
                New report
              </button>
            ) : null}
          />
        </motion.div>

        {/* Category filter row */}
        <motion.div variants={fadeUp} role="tablist" aria-label="Report categories" className="flex flex-wrap gap-2">
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === null}
            onClick={() => handleCategoryChange(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              activeCategory === null
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All
          </button>
          {CATEGORY_ORDER.map((cat) => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={activeCategory === cat}
              onClick={() => handleCategoryChange(cat)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                activeCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </motion.div>

        {error && (
          <motion.div
            variants={fadeUp}
            className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700"
          >
            {error}
          </motion.div>
        )}

        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : reports.length === 0 ? (
          <EmptyState
            icon="analytics"
            title="No reports yet"
            subtitle={canAuthor
              ? 'Create the first one with the New report button.'
              : 'Ask a doctor or admin to set up the first saved report.'}
          />
        ) : (
          <>
            <motion.div variants={fadeUp} className="space-y-8">
              {CATEGORY_ORDER.filter((c) => grouped[c]?.length).map((cat) => (
                <section key={cat} className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    {CATEGORY_LABELS[cat]}
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {grouped[cat].map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => navigate(`/reports/${r.id}`)}
                        className={`rounded-xl border bg-white p-4 text-left hover:shadow-sm transition ${
                          r.is_default
                            ? 'border-blue-200 border-l-4 hover:border-blue-300'
                            : 'border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-slate-900">{r.name}</h3>
                          {r.is_default ? (
                            <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                              Built-in
                            </span>
                          ) : (
                            <span className="rounded bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">
                              Custom
                            </span>
                          )}
                        </div>
                        {r.description && (
                          <p className="mt-2 line-clamp-2 text-xs text-slate-500">{r.description}</p>
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </motion.div>

            {totalPages > 1 && (
              <motion.div variants={fadeUp} className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-600">
                  Page {page} of {totalPages} · {totalCount} reports
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </motion.div>
            )}
          </>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
