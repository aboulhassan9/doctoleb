import { buildTenantReadinessItems, summarizeTenantReadiness } from '../lib/tenantReadiness'

const TONE_MAP = {
  ready: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  prepared: 'bg-teal-50 text-teal-700 ring-teal-600/20',
  pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  needs_work: 'bg-rose-50 text-rose-700 ring-rose-600/20',
}

function ReadinessPill({ status }) {
  const tone = TONE_MAP[status] || TONE_MAP.needs_work
  const label = String(status || 'needs_work').replaceAll('_', ' ')

  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide ring-1 ring-inset ${tone}`}
    >
      {label}
    </span>
  )
}

export default function TenantReadinessPanel({ tenant }) {
  const summary = summarizeTenantReadiness(tenant)
  const items = buildTenantReadinessItems(tenant)

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">
            Readiness Proof: {summary.label}
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
            Zero-PHI SaaS checks for whether this tenant can boot today on the shared web apps without buying the real
            domain yet.
          </p>
        </div>
        <ReadinessPill status={summary.status} />
      </div>

      <div className="grid gap-3 p-5 md:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start justify-between gap-4 rounded-md border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900">{item.label}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{item.detail}</p>
            </div>
            <ReadinessPill status={item.status} />
          </div>
        ))}
      </div>
    </section>
  )
}
