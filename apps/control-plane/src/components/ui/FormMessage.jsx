import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { cn } from '@ui/lib/utils';

const TONES = {
  success: { cls: 'text-emerald-700', Icon: CheckCircle2 },
  error: { cls: 'text-rose-700', Icon: AlertCircle },
  warning: { cls: 'text-amber-700', Icon: AlertCircle },
  info: { cls: 'text-slate-500', Icon: Info },
};

export default function FormMessage({ tone = 'info', icon = true, children, className }) {
  if (!children) return null;
  const { cls, Icon } = TONES[tone] || TONES.info;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm', cls, className)}>
      {icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
      {children}
    </span>
  );
}
