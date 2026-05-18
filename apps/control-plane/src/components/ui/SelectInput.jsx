import React from 'react';
import { cn } from '@ui/lib/utils';

const SelectInput = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={cn(
        'h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors',
        'focus:border-teal-600 focus:ring-1 focus:ring-teal-600/20',
        'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
        className,
      )}
      {...props}
    />
  );
});
SelectInput.displayName = 'SelectInput';

export default SelectInput;
