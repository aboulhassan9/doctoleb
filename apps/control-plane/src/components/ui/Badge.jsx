import { cn } from '@ui/lib/utils';

const TONES = {
  neutral: 'bg-slate-100 text-slate-600',
  accent: 'bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-600/20',
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
  danger: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20',
  outline: 'text-slate-600 ring-1 ring-inset ring-slate-200',
};

export default function Badge({ variant = 'neutral', className, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide',
        TONES[variant] || TONES.neutral,
        className,
      )}
      {...props}
    />
  );
}
