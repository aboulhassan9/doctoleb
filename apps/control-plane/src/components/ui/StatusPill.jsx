const TONE_MAP = {
  draft: 'bg-amber-100 text-amber-800 ring-amber-200',
  active: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  pending: 'bg-amber-100 text-amber-800 ring-amber-200',
  provisioning: 'bg-cyan-100 text-cyan-800 ring-cyan-200',
  maintenance: 'bg-slate-200 text-slate-700 ring-slate-300',
  suspended: 'bg-rose-100 text-rose-700 ring-rose-200',
  inactive: 'bg-slate-100 text-slate-600 ring-slate-200',
  disabled: 'bg-slate-100 text-slate-600 ring-slate-200',
  archived: 'bg-zinc-200 text-zinc-700 ring-zinc-300',
};

export default function StatusPill({ value }) {
  const tone = TONE_MAP[value] || 'bg-slate-100 text-slate-600 ring-slate-200';

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${tone}`}>
      {value || 'unknown'}
    </span>
  );
}
