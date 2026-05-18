import { cn } from '@ui/lib/utils';

export function Card({ className, ...props }) {
  return <div className={cn('rounded-lg border border-slate-200 bg-white', className)} {...props} />;
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('flex flex-col gap-1 border-b border-slate-100 px-5 py-4', className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn('text-base font-semibold tracking-tight text-slate-900', className)} {...props} />;
}

export function CardDescription({ className, ...props }) {
  return <p className={cn('text-sm text-slate-500', className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn('px-5 py-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }) {
  return (
    <div
      className={cn('flex items-center gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4', className)}
      {...props}
    />
  );
}
