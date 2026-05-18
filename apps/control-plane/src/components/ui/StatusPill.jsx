import { cn } from '@ui/lib/utils';

/* Lifecycle values collapse to four tones — success, warning, danger, neutral.
   One hue per meaning; no decorative color. */
const TONE_BY_VALUE = {
  active: 'success', verified: 'success', issued: 'success', ready: 'success',
  healthy: 'success', completed: 'success', 'path-ready': 'success', enabled: 'success', live: 'success',
  pending: 'warning', provisioning: 'warning', unverified: 'warning', maintenance: 'warning', running: 'warning',
  suspended: 'danger', failed: 'danger', error: 'danger', blocked: 'danger', cancelled: 'danger',
  draft: 'neutral', inactive: 'neutral', disabled: 'neutral', archived: 'neutral', unknown: 'neutral',
};

const TONE_CLASS = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  warning: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  danger: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-500/15',
};

export default function StatusPill({ value, status }) {
  const label = value ?? status;
  const tone = TONE_BY_VALUE[String(label || '').toLowerCase()] || 'neutral';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide ring-1 ring-inset',
        TONE_CLASS[tone],
      )}
    >
      {label || 'unknown'}
    </span>
  );
}
