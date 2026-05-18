import { ArrowLeft, Search } from 'lucide-react';

const WORKSPACE_TITLES = {
  dashboard: 'Dashboard',
  analytics: 'Analytics',
  settings: 'Settings',
};

export default function ConsoleHeader({
  selectedTenant,
  workspaceMode,
  onBack,
  userEmail,
  tenantQuery = '',
  onTenantQueryChange,
}) {
  const isCreateView = workspaceMode === 'create';
  const showBack = Boolean(selectedTenant) || isCreateView;
  const workspaceTitle = WORKSPACE_TITLES[workspaceMode] || 'Tenants Overview';
  const isListView = !showBack && !WORKSPACE_TITLES[workspaceMode];

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-8">
      <div className="flex items-center gap-2 text-sm">
        {showBack ? (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 font-medium text-slate-500 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Tenants Overview
          </button>
        ) : (
          <span className="font-semibold text-slate-900">{workspaceTitle}</span>
        )}
        {showBack && (
          <>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-900">
              {isCreateView ? 'Create New Tenant' : selectedTenant.display_name}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {isListView && (
          <div className="relative w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={tenantQuery}
              onChange={(event) => onTenantQueryChange?.(event.target.value)}
              placeholder="Search clinics, regions..."
              className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-teal-600 focus:ring-1 focus:ring-teal-600/20"
            />
          </div>
        )}
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white"
          title={userEmail}
        >
          {userEmail?.charAt(0).toUpperCase() || 'A'}
        </span>
      </div>
    </header>
  );
}
