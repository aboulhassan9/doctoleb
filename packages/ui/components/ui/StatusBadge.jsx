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

  // Blue — in progress / invited
  in_consultation: 'bg-blue-50 text-blue-700 ring-blue-200',
  in_progress: 'bg-blue-50 text-blue-700 ring-blue-200',
  confirmed: 'bg-blue-50 text-blue-700 ring-blue-200',
  ordered: 'bg-blue-50 text-blue-700 ring-blue-200',
  invited: 'bg-blue-50 text-blue-700 ring-blue-200',

  // Amber — waiting / pending / suspended
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  waiting: 'bg-amber-50 text-amber-700 ring-amber-200',
  checked_in: 'bg-amber-50 text-amber-700 ring-amber-200',
  pre_checked: 'bg-amber-50 text-amber-700 ring-amber-200',
  planned: 'bg-amber-50 text-amber-700 ring-amber-200',
  open: 'bg-amber-50 text-amber-700 ring-amber-200',
  suspended: 'bg-amber-50 text-amber-700 ring-amber-200',
  overdue: 'bg-amber-50 text-amber-700 ring-amber-200',
  partial: 'bg-amber-50 text-amber-700 ring-amber-200',

  // Red — negative / cancelled / expired / disabled
  cancelled: 'bg-red-50 text-red-700 ring-red-200',
  rejected: 'bg-red-50 text-red-700 ring-red-200',
  failed: 'bg-red-50 text-red-700 ring-red-200',
  no_show: 'bg-red-50 text-red-700 ring-red-200',
  entered_in_error: 'bg-red-50 text-red-700 ring-red-200',
  void: 'bg-red-50 text-red-700 ring-red-200',
  expired: 'bg-red-50 text-red-700 ring-red-200',
  disabled: 'bg-red-50 text-red-700 ring-red-200',
  refunded: 'bg-red-50 text-red-700 ring-red-200',

  // Slate — neutral / draft / not started
  draft: 'bg-slate-100 text-slate-600 ring-slate-200',
  scheduled: 'bg-slate-100 text-slate-600 ring-slate-200',
  superseded: 'bg-slate-100 text-slate-600 ring-slate-200',
  none: 'bg-slate-100 text-slate-600 ring-slate-200',
};

const SIZE_CLASSES = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
};

// Display-name overrides for statuses where humanize() produces an awkward
// label. Keys must match the keys in STATUS_STYLES. If a status is not listed
// here, humanize() is used.
const STATUS_LABELS = {
  none: 'Not Invited',
  in_consultation: 'In Consultation',
  in_progress: 'In Progress',
  no_show: 'No Show',
  entered_in_error: 'Entered in Error',
  pre_checked: 'Pre-Checked',
  checked_in: 'Checked In',
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
  const label = STATUS_LABELS[status] || humanize(String(status ?? ''));

  return (
    <span
      data-status={status}
      className={`inline-flex items-center font-label font-bold uppercase tracking-wider rounded-none border-2 border-black ${style} ${sizeClass} ${className}`}
    >
      {label}
    </span>
  );
}
