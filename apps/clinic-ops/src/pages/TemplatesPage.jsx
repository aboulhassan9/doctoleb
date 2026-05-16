import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import DashboardLayout from '@ui/components/layouts/DashboardLayout';
import { PageHeader, DataTable, EmptyState, ConfirmDialog, StatusBadge, LoadingSkeleton } from '@ui/components/ui';
import { useTemplates } from '@core/hooks/features/useTemplates';
import { useAuth } from '@ui/contexts/AuthContext';
import { stagger, fadeUp } from '@core/lib/animations';
import { TEMPLATE_TYPES, TEMPLATE_TYPE_LABELS } from '@core/schemas/documentTemplates';

export default function TemplatesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [includeArchived, setIncludeArchived] = useState(false);
  const [typeFilter, setTypeFilter] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiveError, setArchiveError] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { templates, pagination, loading, error, fetchAll, archive } = useTemplates({
    templateType: typeFilter,
    includeArchived,
    page,
    pageSize,
  });

  async function handleArchive(template) {
    setArchiveError('');
    const result = await archive(template.id, user?.id);
    if (result.error) {
      setArchiveError(result.error);
    } else {
      setArchiveTarget(null);
      await fetchAll();
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900">{row.name}</span>
          {row.is_default && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
              Default
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'template_type',
      label: 'Type',
      sortable: true,
      render: (row) => (
        <StatusBadge status={row.template_type} size="sm" />
      ),
    },
    {
      key: 'is_archived',
      label: 'Status',
      render: (row) => (
        <StatusBadge status={row.is_archived ? 'archived' : 'active'} size="sm" />
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="flex items-center gap-2">
          {!row.is_archived && (
            <button
              type="button"
              onClick={() => navigate(`/templates/${row.id}/generate`)}
              className="text-sm text-emerald-600 hover:text-emerald-800 font-medium"
            >
              Generate
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate(`/templates/${row.id}`)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Edit
          </button>
          {!row.is_default && !row.is_archived && (
            <button
              type="button"
              onClick={() => setArchiveTarget(row)}
              className="text-sm text-red-600 hover:text-red-800 font-medium"
            >
              Archive
            </button>
          )}
          {row.is_default && !row.is_archived && (
            <span className="text-xs text-slate-400 italic" title="Default templates cannot be archived">
              Archive disabled
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout role="doctor">
      <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-6 p-6">
        <motion.div variants={fadeUp}>
          <PageHeader
            title="Document Templates"
            subtitle="Create, edit, and manage clinical document templates. Default templates are protected from archival."
            actions={
              <button
                type="button"
                onClick={() => navigate('/templates/new')}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                + New Template
              </button>
            }
          />
        </motion.div>

        {/* Filters */}
        <motion.div variants={fadeUp} className="flex items-center gap-4">
          <select
            value={typeFilter || ''}
            onChange={(e) => setTypeFilter(e.target.value || null)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All types</option>
            {TEMPLATE_TYPES.map((t) => (
              <option key={t} value={t}>{TEMPLATE_TYPE_LABELS[t] || t}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="rounded border-slate-300"
            />
            Show archived
          </label>
        </motion.div>

        {/* Archive error */}
        {archiveError && (
          <motion.div variants={fadeUp} className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {archiveError}
          </motion.div>
        )}

        {/* Table */}
        <motion.div variants={fadeUp}>
          {loading ? (
            <LoadingSkeleton rows={6} />
          ) : error ? (
            <EmptyState icon="error" title="Failed to load templates" subtitle={error} />
          ) : templates.length === 0 ? (
            <EmptyState
              icon="article"
              title="No templates yet"
              subtitle="Create your first document template to get started."
              action={
                <button
                  type="button"
                  onClick={() => navigate('/templates/new')}
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                >
                  + New Template
                </button>
              }
            />
          ) : (
            <DataTable
              columns={columns}
              data={templates}
              onRowClick={(row) => navigate(`/templates/${row.id}`)}
            />
          )}
        </motion.div>

        {/* Pagination */}
        {pagination.total > pageSize && (
          <motion.div variants={fadeUp} className="flex items-center justify-between pt-4">
            <span className="text-sm text-slate-600">
              Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, pagination.total)} of {pagination.total}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page * pageSize >= pagination.total}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </motion.div>
        )}

        {/* Archive confirmation */}
        {archiveTarget && (
          <ConfirmDialog
            open={true}
            title="Archive template?"
            message={`Are you sure you want to archive "${archiveTarget.name}"? Archived templates are hidden from the active list but can be restored later.`}
            variant="warning"
            onConfirm={() => handleArchive(archiveTarget)}
            onCancel={() => setArchiveTarget(null)}
          />
        )}
      </motion.div>
    </DashboardLayout>
  );
}