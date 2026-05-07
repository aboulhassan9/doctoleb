/**
 * EmptyState — "No results" pattern with icon, title, subtitle, and optional CTA.
 *
 * @param {{ icon?: string, title: string, subtitle?: string, action?: React.ReactNode, className?: string }} props
 */
export default function EmptyState({
  icon = 'inbox',
  title = 'No results found',
  subtitle,
  action,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-3xl text-slate-400">{icon}</span>
      </div>
      <h3 className="text-lg font-semibold text-slate-700 mb-1">{title}</h3>
      {subtitle && (
        <p className="text-sm text-slate-500 max-w-sm mb-4">{subtitle}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
