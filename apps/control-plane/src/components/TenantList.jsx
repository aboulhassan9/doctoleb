import { StatusPill } from './ui';

export default function TenantList({ tenants, selectedTenantId, onSelect }) {
  return (
    <aside className="rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4 flex items-center justify-between px-2">
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Tenants</h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{tenants.length}</span>
      </div>
      <div className="grid gap-2">
        {tenants.map((tenant) => (
          <button
            key={tenant.id}
            onClick={() => onSelect(tenant)}
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
              {tenant.slug} - {tenant.plan || 'starter'}
            </p>
          </button>
        ))}
      </div>
    </aside>
  );
}
