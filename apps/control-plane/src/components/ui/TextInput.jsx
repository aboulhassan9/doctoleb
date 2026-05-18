import { cn } from '@ui/lib/utils';

export default function TextInput({ className, ...props }) {
  return (
    <input
      {...props}
      className={cn(
        'h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400',
        'focus:border-teal-600 focus:ring-1 focus:ring-teal-600/20',
        'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
        className,
      )}
    />
  );
}
