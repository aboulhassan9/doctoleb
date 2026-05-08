import { useState } from 'react'
import { DEFAULT_BRANDING, PLAN_OPTIONS } from '../data/saasCatalog'
import { controlPlaneApi } from '../lib/controlPlaneApi'

function createClientRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  if (!globalThis.crypto?.getRandomValues) return null

  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-')
}

export default function ProvisioningPanel({ onCreated }) {
  const [requestedSlug, setRequestedSlug] = useState('')
  const [requestedDisplayName, setRequestedDisplayName] = useState('')
  const [requestedPlan, setRequestedPlan] = useState('starter')
  const [clientRequestId, setClientRequestId] = useState(() => createClientRequestId())
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  function updateDraft(setter, value) {
    setter(value)
    setClientRequestId(createClientRequestId())
  }

  async function createJob() {
    setSaving(true)
    const domains = requestedSlug
      ? [
        { hostname: `${requestedSlug}.doctoleb.com`, surface: 'patient' },
        { hostname: `${requestedSlug}.ops.doctoleb.com`, surface: 'ops' },
      ]
      : []
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
    setMessage(result.error || 'Provisioning checklist created.')
    if (!result.error) {
      setRequestedSlug('')
      setRequestedDisplayName('')
      setClientRequestId(createClientRequestId())
      onCreated()
    }
  }

  return (
    <section className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-sm">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">New doctor tenant</p>
      <h2 className="mt-2 text-2xl font-black">Manual-assisted provisioning</h2>
      <p className="mt-2 text-sm text-slate-400">Creates the checklist only. Domains remain pending until the real domain is owned and verified.</p>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          <span>Slug</span>
          <input value={requestedSlug} onChange={(event) => updateDraft(setRequestedSlug, event.target.value)} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          <span>Clinic name</span>
          <input value={requestedDisplayName} onChange={(event) => updateDraft(setRequestedDisplayName, event.target.value)} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          <span>Plan</span>
          <select value={requestedPlan} onChange={(event) => updateDraft(setRequestedPlan, event.target.value)} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300">
            {PLAN_OPTIONS.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button onClick={createJob} disabled={saving} className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 disabled:opacity-50">
          {saving ? 'Creating...' : 'Create checklist'}
        </button>
        {message ? <p className="text-sm font-semibold text-slate-300">{message}</p> : null}
      </div>
    </section>
  )
}
