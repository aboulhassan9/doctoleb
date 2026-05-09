import { buildTenantReadinessItems, summarizeTenantReadiness } from '../lib/tenantReadiness'

const TONE_MAP = {
  ready: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  prepared: 'bg-cyan-100 text-cyan-800 ring-cyan-200',
  pending: 'bg-amber-100 text-amber-800 ring-amber-200',
  needs_work: 'bg-rose-100 text-rose-800 ring-rose-200',
}

function ReadinessPill({ status }) {
  const tone = TONE_MAP[status] || TONE_MAP.needs_work
  const label = String(status || 'needs_work').replaceAll('_', ' ')

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black capitalize ring-1 ${tone}`}>
      {label}
    </span>
  )
}

export default function TenantReadinessPanel({ tenant }) {
  const summary = summarizeTenantReadiness(tenant)
  const items = buildTenantReadinessItems(tenant)

  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-700">Readiness proof</p>
          <h2 className="mt-2 text-2xl font-black">{summary.label}</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Zero-PHI SaaS checks for whether this tenant can boot today on the shared web apps without buying the real domain yet.
          </p>
        </div>
        <ReadinessPill status={summary.status} />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-black">{item.label}</p>
                <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
              </div>
              <ReadinessPill status={item.status} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
