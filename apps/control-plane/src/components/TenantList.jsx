import { StatusPill } from './ui';

export default function TenantList({ tenants, selectedTenantId, isCreatingTenant = false, onCreateTenant, onSelect }) {
  return (
    <aside className="rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4 grid gap-3 px-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Existing tenants</h2>
            <p className="mt-1 text-xs font-semibold text-slate-400">Open one to edit its tabs. New tenant creation is separate.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{tenants.length}</span>
        </div>
        <button
          type="button"
          onClick={onCreateTenant}
          aria-pressed={isCreatingTenant}
          className={[
            'w-full rounded-2xl px-4 py-3 text-left text-sm font-black transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2',
            isCreatingTenant
              ? 'bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-900/10'
              : 'bg-slate-950 text-white shadow-lg shadow-slate-950/10 hover:-translate-y-0.5',
          ].join(' ')}
        >
          + New tenant
          <span className="mt-1 block text-xs font-semibold opacity-70">Start a separate tenant creation workspace.</span>
        </button>
      </div>
      <div className="grid gap-2">
        <div className="px-2 pb-1">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Open tenant</p>
        </div>
        {tenants.map((tenant) => (
          <button
            key={tenant.id}
            onClick={() => onSelect(tenant)}
            aria-label={`Open existing tenant ${tenant.display_name}`}
            className={`rounded-2xl p-4 text-left transition ${
              selectedTenantId === tenant.id
                ? 'bg-slate-950 text-white shadow-lg shadow-slate-950/15'
                : 'bg-slate-50 text-slate-900 hover:bg-cyan-50'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-black">{tenant.display_name}</p>
              <StatusPill value={tenant.status} />
            </div>
            <p className={`mt-1 text-sm ${selectedTenantId === tenant.id ? 'text-slate-300' : 'text-slate-500'}`}>
              Open tenant · {tenant.slug} - {tenant.plan || 'starter'}
            </p>
          </button>
        ))}
      </div>
    </aside>
  );
}
