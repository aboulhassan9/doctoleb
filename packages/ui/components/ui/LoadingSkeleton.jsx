/**
 * LoadingSkeleton — Animated skeleton screen for loading states.
 *
 * Replaces 5 different loading patterns (text, shimmer, spinner, empty, conditional).
 * Uses CSS animation for a subtle pulse effect.
 *
 * @param {{ rows?: number, columns?: number, variant?: 'table'|'cards'|'list'|'page', className?: string }} props
 */
export default function LoadingSkeleton({ rows = 5, columns = 4, variant = 'table', className = '' }) {
  if (variant === 'cards') {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse">
            <div className="w-10 h-10 bg-slate-200 rounded-xl mb-4" />
            <div className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
            <div className="h-6 bg-slate-200 rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 animate-pulse">
            <div className="w-10 h-10 bg-slate-200 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 rounded w-1/3" />
              <div className="h-3 bg-slate-200 rounded w-1/2" />
            </div>
            <div className="h-6 bg-slate-200 rounded-full w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'page') {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-8 bg-slate-200 rounded w-1/3 mb-2" />
        <div className="h-4 bg-slate-200 rounded w-1/2 mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="w-10 h-10 bg-slate-200 rounded-xl mb-4" />
              <div className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
              <div className="h-6 bg-slate-200 rounded w-1/3" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="h-4 bg-slate-200 rounded w-1/4 mb-4" />
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-slate-100 last:border-0">
              <div className="h-4 bg-slate-200 rounded w-1/4" />
              <div className="h-4 bg-slate-200 rounded w-1/3" />
              <div className="h-4 bg-slate-200 rounded w-1/6" />
              <div className="h-6 bg-slate-200 rounded-full w-16 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default: table skeleton
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 overflow-hidden ${className}`}>
      {/* Table header */}
      <div className="flex items-center gap-4 p-4 border-b border-slate-200 bg-slate-50">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-3 bg-slate-200 rounded flex-1 animate-pulse" />
        ))}
      </div>
      {/* Table rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 border-b border-slate-100 last:border-0 animate-pulse">
          {Array.from({ length: columns }).map((_, j) => (
            <div key={j} className={`h-4 bg-slate-200 rounded flex-1 ${j === 0 ? 'max-w-[200px]' : ''}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
