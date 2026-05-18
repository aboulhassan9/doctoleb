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
import {
  Card,
  CardContent,
  CardFooter,
  Field,
  FormMessage,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  StatusPill,
  TextInput,
} from './ui'

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

export default function ProviderConnectionsPanel({ connections, loading, onChanged }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [archivingId, setArchivingId] = useState('')
  const [storingSecretId, setStoringSecretId] = useState('')
  const [enablingId, setEnablingId] = useState('')
  const [secretDrafts, setSecretDrafts] = useState({})

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
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

  async function storeProviderSecret(connectionId) {
    const secretValue = String(secretDrafts[connectionId] || '').trim()
    if (!secretValue) {
      setMessage('Paste the provider token or key before storing it in Vault.')
      return
    }

    setStoringSecretId(connectionId)
    const result = await controlPlaneApi.storeProviderSecret({ connectionId, secretValue })
    setStoringSecretId('')
    setMessage(result.error || 'Provider secret stored in Vault.')
    if (!result.error) {
      setSecretDrafts((current) => ({ ...current, [connectionId]: '' }))
      onChanged()
    }
  }

  async function enableAutomation(connectionId) {
    setEnablingId(connectionId)
    const result = await controlPlaneApi.upsertProviderConnection({
      connectionId,
      status: 'active',
      isAutomationEnabled: true,
    })
    setEnablingId('')
    setMessage(result.error || 'Provider automation enabled.')
    if (!result.error) onChanged()
  }

  const isError = message.includes('error') || message.includes('Paste')

  return (
    <div className="grid gap-6">
      <Card>
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold tracking-tight text-slate-900">Provider Accounts</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
            Store account metadata and secret references only. Raw provider tokens, privileged database keys, and
            management keys never enter the browser response.
          </p>
        </div>

        <CardContent>
          <div className="grid gap-5 lg:grid-cols-4">
            <Field label="Provider">
              <SelectInput value={draft.provider} onChange={(event) => updateDraft('provider', event.target.value)}>
                {PROVIDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Display name">
              <TextInput
                value={draft.displayName}
                onChange={(event) => updateDraft('displayName', event.target.value)}
              />
            </Field>
            <Field label="Owner">
              <SelectInput value={draft.ownerScope} onChange={(event) => updateDraft('ownerScope', event.target.value)}>
                {OWNER_SCOPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Auth method">
              <SelectInput value={draft.authMethod} onChange={(event) => updateDraft('authMethod', event.target.value)}>
                {AUTH_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Status">
              <SelectInput value={draft.status} onChange={(event) => updateDraft('status', event.target.value)}>
                {CONNECTION_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="External account slug">
              <TextInput
                value={draft.externalAccountSlug}
                onChange={(event) => updateDraft('externalAccountSlug', event.target.value)}
              />
            </Field>
            <Field label="External team id">
              <TextInput
                value={draft.externalTeamId}
                onChange={(event) => updateDraft('externalTeamId', event.target.value)}
              />
            </Field>
            <Field label="External org id">
              <TextInput
                value={draft.externalOrgId}
                onChange={(event) => updateDraft('externalOrgId', event.target.value)}
              />
            </Field>
            <Field label="Secret storage">
              <SelectInput
                value={draft.secretStorage}
                onChange={(event) => updateDraft('secretStorage', event.target.value)}
              >
                {SECRET_STORAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Secret reference">
              <TextInput
                autoComplete="off"
                value={draft.secretRef}
                onChange={(event) => updateDraft('secretRef', event.target.value)}
                placeholder="Example: vault:/providers/vercel/main"
                className="font-mono"
              />
            </Field>
            <div className="lg:col-span-2">
              <label className="flex h-full cursor-pointer items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={draft.isAutomationEnabled}
                  onChange={(event) => updateDraft('isAutomationEnabled', event.target.checked)}
                  className="h-4 w-4 accent-teal-600"
                />
                Enable this connection for assisted or automatic tenant provisioning.
              </label>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex-wrap gap-3">
          <PrimaryButton onClick={saveConnection} disabled={saving}>
            {saving ? 'Saving...' : 'Save Provider Connection'}
          </PrimaryButton>
          {message && <FormMessage tone={isError ? 'error' : 'info'}>{message}</FormMessage>}
        </CardFooter>
      </Card>

      <div className="grid gap-3">
        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">
            Loading provider connections...
          </div>
        ) : null}

        {(connections || []).map((connection) => (
          <Card key={connection.id}>
            <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4 md:flex-row md:items-center">
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{connection.display_name}</h3>
                  <StatusPill status={connection.status} />
                  {connection.is_automation_enabled ? <StatusPill status="automation enabled" /> : null}
                </div>
                <p className="font-mono text-xs text-slate-500">
                  {connection.provider} &middot; {connection.owner_scope} &middot; {connection.auth_method} &middot;
                  secret ref:{' '}
                  <span className={connection.has_secret_ref ? 'text-emerald-600' : 'text-amber-600'}>
                    {connection.has_secret_ref ? 'stored server-side' : 'not configured'}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                {connection.has_secret_ref && !connection.is_automation_enabled ? (
                  <SecondaryButton
                    onClick={() => enableAutomation(connection.id)}
                    disabled={enablingId === connection.id}
                  >
                    {enablingId === connection.id ? 'Enabling...' : 'Enable Automation'}
                  </SecondaryButton>
                ) : null}
                <SecondaryButton
                  onClick={() => archiveConnection(connection.id)}
                  disabled={archivingId === connection.id}
                >
                  {archivingId === connection.id ? 'Archiving...' : 'Archive'}
                </SecondaryButton>
              </div>
            </div>
            <CardContent>
              <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Store or rotate provider secret in Vault
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <TextInput
                  type="password"
                  autoComplete="off"
                  value={secretDrafts[connection.id] || ''}
                  onChange={(event) =>
                    setSecretDrafts((current) => ({ ...current, [connection.id]: event.target.value }))
                  }
                  placeholder="Paste provider token once; the API never returns it"
                  className="sm:flex-1"
                />
                <SecondaryButton
                  onClick={() => storeProviderSecret(connection.id)}
                  disabled={storingSecretId === connection.id || !String(secretDrafts[connection.id] || '').trim()}
                >
                  {storingSecretId === connection.id ? 'Storing...' : 'Store Vault Secret'}
                </SecondaryButton>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Use this for Supabase/Vercel automation. Raw values are sent once to the server and kept out of
                metadata tables.
              </p>
            </CardContent>
          </Card>
        ))}

        {!loading && (connections || []).length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
            No provider connections yet.
          </div>
        ) : null}
      </div>
    </div>
  )
}
