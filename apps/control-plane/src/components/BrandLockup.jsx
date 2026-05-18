import { HeartPulse } from 'lucide-react';

/* The single DoctoLeb brand lockup — used in the sidebar and on login.
   One source of truth so the brand reads identically everywhere. */
export default function BrandLockup({ subtitle = 'Control Plane', tone = 'dark' }) {
  const nameClass = tone === 'dark' ? 'text-white' : 'text-slate-900';
  const subClass = tone === 'dark' ? 'text-slate-500' : 'text-slate-400';

  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-teal-600 text-white">
        <HeartPulse className="h-5 w-5" />
      </span>
      <span className="flex flex-col leading-none">
        <span className={`text-sm font-semibold tracking-tight ${nameClass}`}>DoctoLeb</span>
        <span className={`mt-1 font-mono text-[10px] uppercase tracking-[0.18em] ${subClass}`}>{subtitle}</span>
      </span>
    </div>
  );
}
