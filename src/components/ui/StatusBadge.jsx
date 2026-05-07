/**
 * StatusBadge — Color-coded status chip used across clinical and operational lifecycles.
 *
 * Replaces 15+ inline status chip renderers scattered across pages.
 * Maps status strings to consistent colors and human-readable labels.
 *
 * @param {{ status: string, size?: 'sm'|'md', className?: string }} props
 */

const STATUS_STYLES = {
  // Green — positive / complete
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  accepted: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  done: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  final: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  resulted: 'bg-emerald-50 text-emerald-700 ring-emerald-200',

  // Blue — in progress
  in_consultation: 'bg-blue-50 text-blue-700 ring-blue-200',
  in_progress: 'bg-blue-50 text-blue-700 ring-blue-200',
  confirmed: 'bg-blue-50 text-blue-700 ring-blue-200',
  ordered: 'bg-blue-50 text-blue-700 ring-blue-200',

  // Amber — waiting / pending
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  waiting: 'bg-amber-50 text-amber-700 ring-amber-200',
  checked_in: 'bg-amber-50 text-amber-700 ring-amber-200',
  pre_checked: 'bg-amber-50 text-amber-700 ring-amber-200',
  planned: 'bg-amber-50 text-amber-700 ring-amber-200',
  open: 'bg-amber-50 text-amber-700 ring-amber-200',

  // Red — negative / cancelled
  cancelled: 'bg-red-50 text-red-700 ring-red-200',
  rejected: 'bg-red-50 text-red-700 ring-red-200',
  failed: 'bg-red-50 text-red-700 ring-red-200',
  no_show: 'bg-red-50 text-red-700 ring-red-200',
  entered_in_error: 'bg-red-50 text-red-700 ring-red-200',
  void: 'bg-red-50 text-red-700 ring-red-200',

  // Slate — neutral / draft
  draft: 'bg-slate-100 text-slate-600 ring-slate-200',
  scheduled: 'bg-slate-100 text-slate-600 ring-slate-200',
  superseded: 'bg-slate-100 text-slate-600 ring-slate-200',
};

const SIZE_CLASSES = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
};

/** Convert status_key to "Status Key" */
function humanize(str) {
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function StatusBadge({ status, size = 'md', className = '' }) {
  const style = STATUS_STYLES[status] || 'bg-slate-100 text-slate-600 ring-slate-200';
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full ring-1 ring-inset ${style} ${sizeClass} ${className}`}
    >
      {humanize(status)}
    </span>
  );
}
