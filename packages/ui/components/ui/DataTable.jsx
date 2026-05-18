import { useState, useMemo } from 'react';
import LoadingSkeleton from './LoadingSkeleton';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';

/**
 * DataTable — Sortable, paginated table with built-in loading/empty/error states.
 *
 * Replaces 7+ hand-rolled table implementations.
 * Each list page can now just pass columns, data, and lifecycle props.
 *
 * @param {{
 *   columns: Array<{ key: string, label: string, render?: (row: any) => React.ReactNode, sortable?: boolean, className?: string }>,
 *   data: Array<any>,
 *   loading?: boolean,
 *   error?: string|null,
 *   emptyMessage?: string,
 *   emptyIcon?: string,
 *   emptyAction?: React.ReactNode,
 *   onRetry?: () => void,
 *   sortable?: boolean,
 *   pagination?: { page: number, pageSize: number, total: number, onPageChange: (page: number) => void },
 *   onRowClick?: (row: any) => void,
 *   rowKey?: string,
 *   className?: string,
 * }} props
 */
export default function DataTable({
  columns,
  data,
  loading = false,
  error = null,
  emptyMessage = 'No results found',
  emptyIcon = 'inbox',
  emptyAction,
  onRetry,
  sortable = false,
  pagination,
  onRowClick,
  rowKey = 'id',
  className = '',
}) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Sort logic
  const sortedData = useMemo(() => {
    if (!sortable || !sortConfig.key) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig, sortable]);

  const handleSort = (key) => {
    if (!sortable) return;
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  // Lifecycle states
  if (loading) return <LoadingSkeleton variant="table" rows={6} columns={columns.length} className={className} />;
  if (error) return <ErrorState message={error} onRetry={onRetry} className={className} />;
  if (!data || data.length === 0) {
    return <EmptyState icon={emptyIcon} title={emptyMessage} action={emptyAction} className={className} />;
  }

  const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 0;

  return (
    <div className={`bg-white rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b-2 border-black">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left font-label text-[11px] font-bold text-black uppercase tracking-wider ${
                    sortable && col.sortable !== false ? 'cursor-pointer hover:bg-slate-200 select-none' : ''
                  } ${col.className || ''}`}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {sortable && col.sortable !== false && sortConfig.key === col.key && (
                      <span className="material-symbols-outlined text-sm">
                        {sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedData.map((row, idx) => (
              <tr
                key={row[rowKey] || idx}
                className={`transition-colors ${
                  onRowClick
                    ? 'cursor-pointer hover:bg-slate-50'
                    : ''
                }`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3.5 text-sm text-slate-700 ${col.className || ''}`}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t-2 border-black bg-slate-50">
          <p className="font-label text-[13px] text-slate-700">
            Showing {pagination.page * pagination.pageSize + 1}–
            {Math.min((pagination.page + 1) * pagination.pageSize, pagination.total)} of {pagination.total}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page === 0}
              className="p-1.5 rounded-none border-2 border-transparent hover:border-black hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <span className="material-symbols-outlined text-lg">chevron_left</span>
            </button>
            <span className="font-label text-[13px] font-bold text-black px-2">
              {pagination.page + 1} / {totalPages}
            </span>
            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= totalPages - 1}
              className="p-1.5 rounded-none border-2 border-transparent hover:border-black hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <span className="material-symbols-outlined text-lg">chevron_right</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
