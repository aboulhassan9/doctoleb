import { motion } from 'framer-motion';
import { cn } from '@ui/lib/utils';

const VARIANTS = {
  primary: 'bg-slate-900 text-white hover:bg-slate-800',
  secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
};

const SIZES = {
  sm: 'h-8 gap-1.5 px-3 text-xs',
  md: 'h-9 gap-2 px-3.5 text-sm',
};

export default function Button({ variant = 'primary', size = 'md', className = '', ...props }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md font-semibold tracking-tight transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
