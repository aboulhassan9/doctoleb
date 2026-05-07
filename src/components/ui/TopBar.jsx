import { SearchInput } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';

/**
 * TopBar — Shared sticky header for all dashboard pages.
 *
 * Replaces the 10-line header block copy-pasted across 20+ pages.
 *
 * @param {{ searchPlaceholder?: string, onSearch?: (q: string) => void, searchValue?: string, children?: React.ReactNode }} props
 */
export default function TopBar({ searchPlaceholder, onSearch, searchValue, children }) {
  const { user } = useAuth();

  const initials = user?.first_name
    ? `${user.first_name[0]}${(user.last_name || '')[0] || ''}`.toUpperCase()
    : 'U';

  return (
    <header className="sticky top-0 z-20 h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
      {/* Left: search or custom content */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        {onSearch ? (
          <SearchInput
            value={searchValue || ''}
            onChange={onSearch}
            placeholder={searchPlaceholder || 'Search...'}
            className="w-full"
          />
        ) : children ? (
          children
        ) : (
          <div />
        )}
      </div>

      {/* Right: status + user */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Status:</span>
          <span className="h-2 w-2 rounded-full bg-success/100" />
          <span className="text-xs font-medium text-success">Online</span>
        </div>
        <div className="h-8 w-px bg-slate-200 mx-2" />
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-900">{user?.first_name} {user?.last_name}</p>
            <p className="text-[10px] text-slate-500 capitalize">{user?.role || 'Staff'}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-xs">
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}
