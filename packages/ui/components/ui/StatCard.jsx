import CountUp from '@/components/CountUp';

/**
 * StatCard — Dashboard metric card with icon, label, value, and optional trend.
 *
 * Replaces 4+ duplicated stat card renderers across dashboard pages.
 *
 * @param {{ icon: string, label: string, value: number|string, trend?: string, trendUp?: boolean, color?: string, className?: string }} props
 */
export default function StatCard({
  icon,
  label,
  value,
  trend,
  trendUp,
  color = 'primary',
  className = '',
}) {
  const colorMap = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-emerald-50 text-emerald-600',
    warning: 'bg-amber-50 text-amber-600',
    danger: 'bg-red-50 text-red-600',
    info: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  const iconColor = colorMap[color] || colorMap.primary;

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow ${className}`}>
      <div className="flex items-start justify-between">
        <div className={`w-12 h-12 rounded-xl ${iconColor} flex items-center justify-center`}>
          <span className="material-symbols-outlined text-2xl">{icon}</span>
        </div>
        {trend && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${trendUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            {trendUp ? '↑' : '↓'} {trend}
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-sm text-slate-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-1">
          {typeof value === 'number' ? (
            <CountUp from={0} to={value} duration={1.5} separator="," />
          ) : (
            value
          )}
        </p>
      </div>
    </div>
  );
}
