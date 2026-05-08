import { useState } from 'react'
import { DEFAULT_BRANDING, PLAN_OPTIONS } from '../data/saasCatalog'
import { controlPlaneApi } from '../lib/controlPlaneApi'
import {
  buildPendingTenantDomains,
  createClientRequestId,
  deriveTenantSlug,
  normalizeTenantSlug,
  validateProvisioningDraft,
} from '../lib/provisioningDrafts'

export default function ProvisioningPanel({ onCreated }) {
  const [requestedSlug, setRequestedSlug] = useState('')
  const [requestedDisplayName, setRequestedDisplayName] = useState('')
  const [requestedPlan, setRequestedPlan] = useState('starter')
  const [clientRequestId, setClientRequestId] = useState(() => createClientRequestId())
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  function updateSlug(value) {
    setRequestedSlug(normalizeTenantSlug(value))
    setClientRequestId(createClientRequestId())
  }

  function updateDisplayName(value) {
    setRequestedDisplayName(value)
    if (!requestedSlug) setRequestedSlug(deriveTenantSlug(value))
    setClientRequestId(createClientRequestId())
  }

  function updatePlan(value) {
    setRequestedPlan(value)
    setClientRequestId(createClientRequestId())
  }

  async function createJob() {
    const validationError = validateProvisioningDraft({ requestedSlug, requestedDisplayName, clientRequestId })
    if (validationError) {
      setMessage(validationError)
      return
    }

    setSaving(true)
    const domains = buildPendingTenantDomains(requestedSlug)
    const result = await controlPlaneApi.createProvisioningJob({
      clientRequestId,
      requestedSlug,
      requestedDisplayName,
      requestedPlan,
      requestedDomains: domains,
      initialBranding: {
        display_name: requestedDisplayName,
        app_name: requestedDisplayName,
        primary_color: DEFAULT_BRANDING.primary_color,
        secondary_color: DEFAULT_BRANDING.secondary_color,
      },
    })
    setSaving(false)
    setMessage(result.error || 'Tenant draft, pending domains, plan, and checklist created.')
    if (!result.error) {
      setRequestedSlug('')
      setRequestedDisplayName('')
      setClientRequestId(createClientRequestId())
      onCreated(result.data)
    }
  }

  return (
    <section className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-sm">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">New doctor tenant</p>
      <h2 className="mt-2 text-2xl font-black">One-click tenant draft</h2>
      <p className="mt-2 text-sm text-slate-400">
        Creates the SaaS tenant draft, placeholder pending domain rows, plan, and provisioning checklist. No per-tenant app deploy is needed.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          <span>Slug</span>
          <input value={requestedSlug} onChange={(event) => updateSlug(event.target.value)} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          <span>Clinic name</span>
          <input value={requestedDisplayName} onChange={(event) => updateDisplayName(event.target.value)} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          <span>Plan</span>
          <select value={requestedPlan} onChange={(event) => updatePlan(event.target.value)} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300">
            {PLAN_OPTIONS.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
          </select>
        </label>
      </div>
      {requestedSlug ? (
        <div className="mt-4 rounded-2xl bg-white/10 p-4 text-sm text-slate-300">
          <p className="font-black text-white">Pending routing rows</p>
          <p className="mb-2 text-xs text-slate-400">These stay pending until DoctoLeb owns the domain, or until you add verified Vercel/free-domain aliases in the domain panel.</p>
          {buildPendingTenantDomains(requestedSlug).map((domain) => (
            <p key={`${domain.surface}:${domain.hostname}`}>{domain.hostname} - {domain.surface}</p>
          ))}
        </div>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button onClick={createJob} disabled={saving} className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 disabled:opacity-50">
          {saving ? 'Creating...' : 'Create tenant draft'}
        </button>
        {message ? <p className="text-sm font-semibold text-slate-300">{message}</p> : null}
      </div>
    </section>
  )
}
