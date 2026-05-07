/**
 * NotificationBell — Badge-enabled notification icon button.
 *
 * Replaces 5+ duplicated bell buttons across PreDoctor pages.
 *
 * @param {{ count?: number, onClick?: () => void, className?: string }} props
 */
export default function NotificationBell({ count = 0, onClick, className = '' }) {
  return (
    <button
      onClick={onClick}
      className={`w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary transition-all relative ${className}`}
      aria-label={count > 0 ? `${count} unread notifications` : 'Notifications'}
    >
      <span className="material-symbols-outlined">notifications</span>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}
