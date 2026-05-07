/**
 * PageHeader — Consistent page title area across all pages.
 *
 * Replaces 30+ hand-rolled header sections. Provides:
 * - Title + optional subtitle
 * - Optional right-aligned action buttons
 * - Consistent spacing and typography
 *
 * @param {{ title: string, subtitle?: string, actions?: React.ReactNode, className?: string }} props
 */
export default function PageHeader({ title, subtitle, actions, className = '' }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 ${className}`}>
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-3 flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
