import { useState } from 'react'
import { controlPlaneApi } from '../lib/controlPlaneApi'
import {
  AUTH_METHOD_OPTIONS,
  CONNECTION_STATUS_OPTIONS,
  OWNER_SCOPE_OPTIONS,
  PROVIDER_OPTIONS,
  SECRET_STORAGE_OPTIONS,
  normalizeProviderConnectionDraft,
  validateProviderConnectionDraft,
} from '../lib/providerConnectionDrafts'
import { Field, PrimaryButton, SecondaryButton, SelectInput, StatusPill, TextInput } from './ui'

const EMPTY_DRAFT = {
  provider: 'supabase',
  displayName: '',
  ownerScope: 'doctoleb',
  authMethod: 'oauth',
  status: 'pending_authorization',
  isAutomationEnabled: false,
  externalAccountSlug: '',
  externalTeamId: '',
  externalOrgId: '',
  secretStorage: 'edge_function_secret',
  secretRef: '',
}

export default function ProviderConnectionsPanel({
  connections,
  loading,
  onChanged,
}) {
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [archivingId, setArchivingId] = useState('')

  function updateDraft(field, value) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function saveConnection() {
    const validationError = validateProviderConnectionDraft(draft)
    if (validationError) {
      setMessage(validationError)
      return
    }

    setSaving(true)
    const result = await controlPlaneApi.upsertProviderConnection(normalizeProviderConnectionDraft(draft))
    setSaving(false)
    setMessage(result.error || 'Provider connection metadata saved.')
    if (!result.error) {
      setDraft(EMPTY_DRAFT)
      onChanged()
    }
  }

  async function archiveConnection(connectionId) {
    setArchivingId(connectionId)
    const result = await controlPlaneApi.archiveProviderConnection({ connectionId })
    setArchivingId('')
    setMessage(result.error || 'Provider connection archived.')
    if (!result.error) onChanged()
  }

  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-700">Provider accounts</p>
      <h2 className="mt-2 text-2xl font-black">Supabase and Vercel access</h2>
      <p className="mt-2 text-sm text-slate-500">
        Store account metadata and secret references only. Raw provider tokens, service-role keys, and management keys never enter the browser response.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-4">
        <Field label="Provider">
          <SelectInput value={draft.provider} onChange={(event) => updateDraft('provider', event.target.value)}>
            {PROVIDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </SelectInput>
        </Field>
        <Field label="Display name">
          <TextInput value={draft.displayName} onChange={(event) => updateDraft('displayName', event.target.value)} />
        </Field>
        <Field label="Owner">
          <SelectInput value={draft.ownerScope} onChange={(event) => updateDraft('ownerScope', event.target.value)}>
            {OWNER_SCOPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </SelectInput>
        </Field>
        <Field label="Auth method">
          <SelectInput value={draft.authMethod} onChange={(event) => updateDraft('authMethod', event.target.value)}>
            {AUTH_METHOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </SelectInput>
        </Field>
        <Field label="Status">
          <SelectInput value={draft.status} onChange={(event) => updateDraft('status', event.target.value)}>
            {CONNECTION_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </SelectInput>
        </Field>
        <Field label="External account slug">
          <TextInput value={draft.externalAccountSlug} onChange={(event) => updateDraft('externalAccountSlug', event.target.value)} />
        </Field>
        <Field label="External team id">
          <TextInput value={draft.externalTeamId} onChange={(event) => updateDraft('externalTeamId', event.target.value)} />
        </Field>
        <Field label="External org id">
          <TextInput value={draft.externalOrgId} onChange={(event) => updateDraft('externalOrgId', event.target.value)} />
        </Field>
        <Field label="Secret storage">
          <SelectInput value={draft.secretStorage} onChange={(event) => updateDraft('secretStorage', event.target.value)}>
            {SECRET_STORAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </SelectInput>
        </Field>
        <Field label="Secret reference">
          <TextInput
            autoComplete="off"
            value={draft.secretRef}
            onChange={(event) => updateDraft('secretRef', event.target.value)}
            placeholder="Example: vault:/providers/vercel/main"
          />
        </Field>
        <label className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 lg:col-span-2">
          <input
            type="checkbox"
            checked={draft.isAutomationEnabled}
            onChange={(event) => updateDraft('isAutomationEnabled', event.target.checked)}
            className="h-5 w-5 rounded border-slate-300 text-cyan-700"
          />
          Enable this connection for assisted or automatic tenant provisioning.
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={saveConnection} disabled={saving}>{saving ? 'Saving...' : 'Save provider connection'}</PrimaryButton>
        {message ? <p className="text-sm font-semibold text-slate-500">{message}</p> : null}
      </div>

      <div className="mt-6 grid gap-3">
        {loading ? <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">Loading provider connections...</p> : null}
        {(connections || []).map((connection) => (
          <div key={connection.id} className="grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-black">{connection.display_name}</p>
                <StatusPill status={connection.status} />
                {connection.is_automation_enabled ? <StatusPill status="automation enabled" /> : null}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {connection.provider} · {connection.owner_scope} · {connection.auth_method} · secret ref: {connection.has_secret_ref ? 'stored server-side' : 'not configured'}
              </p>
            </div>
            <SecondaryButton onClick={() => archiveConnection(connection.id)} disabled={archivingId === connection.id}>
              {archivingId === connection.id ? 'Archiving...' : 'Archive'}
            </SecondaryButton>
          </div>
        ))}
        {!loading && (connections || []).length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No provider connections yet.</p>
        ) : null}
      </div>
    </section>
  )
}
