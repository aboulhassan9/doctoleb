/**
 * ErrorState — Error display with retry button.
 *
 * Used when a data fetch fails. Provides user-facing error message
 * and an optional retry action.
 *
 * @param {{ message?: string, onRetry?: () => void, className?: string }} props
 */
export default function ErrorState({
  message = 'Something went wrong. Please try again.',
  onRetry,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-3xl text-red-400">error_outline</span>
      </div>
      <h3 className="text-lg font-semibold text-slate-700 mb-1">Failed to load</h3>
      <p className="text-sm text-slate-500 max-w-sm mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-medium transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">refresh</span>
          Try again
        </button>
      )}
    </div>
  );
}
