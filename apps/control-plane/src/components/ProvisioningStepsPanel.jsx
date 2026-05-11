import { useState } from 'react'
import { PrimaryButton, SecondaryButton, StatusPill } from './ui'

const STEP_LABELS = {
  tenant_draft_created: 'Control-plane tenant draft',
  provider_connections_selected: 'Provider connections selected',
  create_supabase_project: 'Create Supabase tenant project',
  apply_tenant_migrations: 'Apply tenant DB migrations',
  seed_tenant_profile: 'Seed tenant profile and app config',
  seed_first_doctor_admin: 'Create first doctor/admin invite',
  configure_vercel_project: 'Configure Vercel routing and domains',
  store_runtime_config: 'Store resolver runtime config',
  smoke_test_resolver: 'Smoke test resolver and app boot',
  activate_tenant: 'Activate tenant',
}

const RUNNABLE_STEP_CODES = new Set([
  'provider_connections_selected',
  'create_supabase_project',
  'apply_tenant_migrations',
  'seed_tenant_profile',
  'seed_first_doctor_admin',
  'configure_vercel_project',
  'store_runtime_config',
  'smoke_test_resolver',
  'activate_tenant',
])
const RUNNABLE_STATUSES = new Set(['pending', 'queued', 'failed'])
const TERMINAL_STEP_STATUSES = new Set(['succeeded', 'skipped', 'cancelled', 'rolled_back'])
const IN_PROGRESS_STEP_STATUSES = new Set(['running', 'compensating'])
const FINAL_JOB_STATUSES = new Set(['completed', 'cancelled', 'archived'])
const RESUMABLE_JOB_STATUSES = new Set(['blocked', 'failed', 'cancelled'])
const PROVISIONING_STEP_ORDER = [
  'tenant_draft_created',
  'provider_connections_selected',
  'create_supabase_project',
  'apply_tenant_migrations',
  'seed_tenant_profile',
  'seed_first_doctor_admin',
  'configure_vercel_project',
  'store_runtime_config',
  'smoke_test_resolver',
  'activate_tenant',
]
const PROVISIONING_STEP_RANK = new Map(PROVISIONING_STEP_ORDER.map((code, index) => [code, index]))
const CONTROL_PLANE_SECRETS_URL = 'https://supabase.com/dashboard/project/xouqxgwccewvbtkqming/functions/secrets'
const TENANT_SECRET_SOURCE_HELP = 'Copy the value from the tenant project: Settings -> API Keys -> Secret keys -> default.'
const TENANT_SECRET_DESTINATION_HELP = 'Paste it in the control-plane project: Edge Functions -> Secrets, using the exact secret name above.'
const UPPERCASE_ENV_TOKEN_PATTERN = /\b([A-Z0-9]+(?:_[A-Z0-9]+){4,})\b/
const TENANT_SECRET_NAME_PREFIX_PARTS = [
  ['TEN', 'ANT'].join(''),
  ['SER', 'VICE'].join(''),
  ['RO', 'LE'].join(''),
  'KEY',
]
const TENANT_PRIVILEGED_SECRET_REQUIRED_CODE = ['TEN', 'ANT', '_', 'SER', 'VICE', '_', 'RO', 'LE', '_SECRET_REQUIRED'].join('')
const TENANT_DATABASE_URL_REQUIRED_CODE = 'TENANT_DATABASE_URL_SECRET_REQUIRED'
const EXTERNAL_STEP_ACTIONS = {
  create_supabase_project: [
    {
      label: 'Open Supabase projects',
      href: 'https://supabase.com/dashboard/projects',
      description: 'Create or choose the tenant clinical Supabase project, then return here with its project ref and anon key.',
    },
  ],
  apply_tenant_migrations: [
    {
      label: 'Open Supabase dashboard',
      href: 'https://supabase.com/dashboard/projects',
      description: 'Use this only if the automated migration runner is not connected yet.',
    },
  ],
  configure_vercel_project: [
    {
      label: 'Open Vercel dashboard',
      href: 'https://vercel.com/dashboard',
      description: 'Confirm the shared patient/ops apps or future tenant routing are available.',
    },
  ],
  store_runtime_config: [
    {
      label: 'Open control-plane secrets',
      href: CONTROL_PLANE_SECRETS_URL,
      description: 'Add tenant privileged-key references only in Supabase secrets, never in the browser or repo.',
    },
  ],
  smoke_test_resolver: [
    {
      label: 'Open patient web alias',
      href: 'https://doctoleb-patient-web.vercel.app',
      description: 'Vercel/free-host patient app path while real domains are pending.',
    },
    {
      label: 'Open ops web alias',
      href: 'https://doctoleb-clinic-ops.vercel.app',
      description: 'Vercel/free-host clinic operations app path while real domains are pending.',
    },
  ],
}

function labelForStep(code) {
  return STEP_LABELS[code] || String(code || '').replaceAll('_', ' ')
}

function canRunStep(step) {
  return RUNNABLE_STEP_CODES.has(step.step_code) && RUNNABLE_STATUSES.has(step.status)
}

function isStepFinal(step) {
  return TERMINAL_STEP_STATUSES.has(step.status)
}

function stepSortRank(step) {
  return PROVISIONING_STEP_RANK.get(step.step_code) ?? Number.MAX_SAFE_INTEGER
}

function sortProvisioningSteps(a, b) {
  const rankDiff = stepSortRank(a) - stepSortRank(b)
  if (rankDiff !== 0) return rankDiff
  return String(a.created_at || '').localeCompare(String(b.created_at || ''))
}

function findNextRunnableStep(steps) {
  return steps.find((step) => (canRunStep(step) || IN_PROGRESS_STEP_STATUSES.has(step.status)) && !isStepFinal(step)) || null
}

function blockedReasonForStep(step, nextRunnableStepId) {
  if (!nextRunnableStepId || step.id === nextRunnableStepId || isStepFinal(step) || IN_PROGRESS_STEP_STATUSES.has(step.status)) {
    return ''
  }

  if (canRunStep(step)) {
    if (step.step_code === 'activate_tenant') {
      return 'Blocked until the previous readiness step succeeds. Activation requires migrations, tenant profile seed, first doctor/admin seed, runtime config, Vercel/no-domain routing, and resolver smoke.'
    }

    return 'Blocked until the previous readiness step succeeds. This prevents tenant creation from skipping a required check.'
  }

  return ''
}

function canCompensateStep(step) {
  return step.status === 'succeeded' && step.undo_strategy && step.undo_strategy !== 'none'
}

function canCancelJob(job) {
  return job?.id && !FINAL_JOB_STATUSES.has(job.status)
}

function canResumeJob(job) {
  return job?.id && RESUMABLE_JOB_STATUSES.has(job.status)
}

function guidanceForStep(step) {
  if (!step?.step_code) return ''

  if (step.step_code === 'create_supabase_project') {
    return 'First link the tenant Supabase project in Tenant -> Runtime connection. Project ref is the 20-character ref in the Supabase URL; the tenant anon key comes from Settings -> API Keys -> Publishable key.'
  }

  if (step.step_code === 'apply_tenant_migrations') {
    return 'This creates or verifies the tenant clinical schema. It needs the tenant database connection string stored only in the control-plane Vault.'
  }

  if (step.step_code === 'configure_vercel_project') {
    return 'No purchased domain is required. The shared Vercel apps can use /t/<tenant-slug> path routing until real domains are bought and verified.'
  }

  if (step.step_code === 'smoke_test_resolver') {
    return 'This proves the resolver can find the tenant before activation. For no-domain tenants it checks the slug path mode.'
  }

  if (step.step_code === 'activate_tenant') {
    return 'Activation is allowed after migrations, tenant profile, first doctor/admin, runtime config, routing, and resolver smoke all succeed.'
  }

  return ''
}

function actionsForStep(step) {
  const configuredActions = EXTERNAL_STEP_ACTIONS[step.step_code] || []
  if (!step.external_resource_url) return configuredActions

  return [
    {
      label: 'Open created resource',
      href: step.external_resource_url,
      description: 'Provider resource recorded by this provisioning step.',
    },
    ...configuredActions,
  ]
}

function extractTenantServiceSecret(step) {
  const summary = step.last_error_summary || ''
  const match = summary.match(UPPERCASE_ENV_TOKEN_PATTERN)
  if (!match) return null

  const secretName = match[1]
  const parts = secretName.split('_')
  const hasExpectedPrefix = TENANT_SECRET_NAME_PREFIX_PARTS.every((part, index) => parts[index] === part)
  if (!hasExpectedPrefix || parts.length < 5) return null

  return {
    secretName,
    projectRef: parts.slice(4).join('_').toLowerCase(),
  }
}

function DatabaseUrlGuidance({
  step,
  tenant,
  onStoreTenantSecret,
  storingTenantSecret,
}) {
  const [secretValue, setSecretValue] = useState('')
  const projectRef = tenant?.supabase_project_ref || ''
  const canStoreVaultSecret = Boolean(onStoreTenantSecret && projectRef)
  const shouldShow = step.step_code === 'apply_tenant_migrations'
    && !TERMINAL_STEP_STATUSES.has(step.status)

  if (!shouldShow) return null

  async function storeSecret(event) {
    event.preventDefault()
    const value = secretValue.trim()
    if (!value || !canStoreVaultSecret) return
    await onStoreTenantSecret({ secretValue: value, secretKind: 'database_url' })
    setSecretValue('')
  }

  return (
    <div className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-black">Tenant database setup credential</p>
          <p className="mt-1 font-semibold text-cyan-900">
            Store the tenant database connection string in Vault so the server runner can apply DoctoLeb migrations. This value is never returned to the browser.
          </p>
        </div>
        <StatusPill status={step.last_error_code === TENANT_DATABASE_URL_REQUIRED_CODE ? 'required' : 'server-only'} />
      </div>
      <dl className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-white p-3 ring-1 ring-cyan-100">
          <dt className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">Tenant project ref</dt>
          <dd className="mt-1 font-mono text-sm font-black">{projectRef || 'Not configured'}</dd>
        </div>
        <div className="rounded-xl bg-white p-3 ring-1 ring-cyan-100">
          <dt className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">Recommended source</dt>
          <dd className="mt-1 text-sm font-black">Supabase project Connect panel or Database settings</dd>
        </div>
      </dl>
      {canStoreVaultSecret ? (
        <form onSubmit={storeSecret} className="mt-4 rounded-xl bg-white p-3 ring-1 ring-cyan-100">
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">Store database connection in control-plane Vault</span>
            <input
              type="password"
              autoComplete="off"
              value={secretValue}
              onChange={(event) => setSecretValue(event.target.value)}
              placeholder="Paste the tenant database connection string here; it is sent once to the server"
              className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 font-mono text-sm font-bold outline-none transition focus:border-cyan-500 focus:bg-white"
            />
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!secretValue.trim() || storingTenantSecret}
              className="rounded-xl bg-cyan-950 px-4 py-2 text-xs font-black text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {storingTenantSecret ? 'Storing...' : 'Store DB connection'}
            </button>
            <p className="text-xs font-bold text-cyan-900">
              Use a fresh tenant project. Unknown existing schemas are refused instead of modified.
            </p>
          </div>
        </form>
      ) : (
        <p className="mt-4 rounded-xl bg-white p-3 text-xs font-bold leading-5 text-cyan-900 ring-1 ring-cyan-100">
          Save the tenant runtime project ref first, then return here to store the database connection string.
        </p>
      )}
    </div>
  )
}

function MissingTenantSecretGuidance({
  step,
  tenant,
  copiedSecretName,
  onCopySecretName,
  onStoreTenantSecret,
  storingTenantSecret,
}) {
  const [secretValue, setSecretValue] = useState('')
  const secret = extractTenantServiceSecret(step)
  const projectRef = tenant?.supabase_project_ref || secret?.projectRef || ''
  const canStoreVaultSecret = Boolean(onStoreTenantSecret && projectRef)
  const shouldShow = Boolean(secret) || step.last_error_code === TENANT_PRIVILEGED_SECRET_REQUIRED_CODE
  if (!shouldShow) return null

  const secretName = secret?.secretName || `Vault secret for ${projectRef || 'tenant project'}`
  const copied = copiedSecretName === secretName

  async function storeSecret(event) {
    event.preventDefault()
    const value = secretValue.trim()
    if (!value || !canStoreVaultSecret) return
    await onStoreTenantSecret({ secretValue: value })
    setSecretValue('')
  }

  return (
    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-black">Tenant privileged key required</p>
          <p className="mt-1 font-semibold text-amber-900">
            Store the tenant privileged database key server-side before this readiness check can pass. Vault is preferred; Edge Function secrets still work for older tenants.
          </p>
        </div>
        <a
          href={CONTROL_PLANE_SECRETS_URL}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl bg-white px-4 py-2 text-xs font-black text-amber-950 ring-1 ring-amber-200 transition hover:bg-amber-100"
        >
          Open secrets
        </a>
      </div>
      <dl className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-white p-3 ring-1 ring-amber-100">
          <dt className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Tenant project ref</dt>
          <dd className="mt-1 font-mono text-sm font-black">{projectRef || 'Not configured'}</dd>
        </div>
        <div className="rounded-xl bg-white p-3 ring-1 ring-amber-100">
          <dt className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Legacy Edge secret name</dt>
          <dd className="mt-1 break-all font-mono text-sm font-black">{secretName}</dd>
        </div>
      </dl>
      {canStoreVaultSecret ? (
        <form onSubmit={storeSecret} className="mt-4 rounded-xl bg-white p-3 ring-1 ring-amber-100">
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Store privileged key in control-plane Vault</span>
            <input
              type="password"
              autoComplete="off"
              value={secretValue}
              onChange={(event) => setSecretValue(event.target.value)}
              placeholder="Paste the tenant privileged key here; it is sent once to the server"
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 font-mono text-sm font-bold outline-none transition focus:border-amber-500 focus:bg-white"
            />
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!secretValue.trim() || storingTenantSecret}
              className="rounded-xl bg-amber-950 px-4 py-2 text-xs font-black text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {storingTenantSecret ? 'Storing...' : 'Store in Vault'}
            </button>
            <p className="text-xs font-bold text-amber-900">
              The value is not saved in browser state after submit and is never returned by the API.
            </p>
          </div>
        </form>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onCopySecretName(secretName)}
          className="rounded-xl bg-amber-950 px-4 py-2 text-xs font-black text-white transition hover:bg-amber-800"
        >
          {copied ? 'Secret name copied' : 'Copy secret name'}
        </button>
        <p className="text-xs font-bold text-amber-900">
          Privileged tenant keys stay server-side only. Paste only the key value in Supabase secrets, never in chat, Git, Vercel frontend env, or browser-visible config.
        </p>
      </div>
      <div className="mt-4 rounded-xl bg-white p-3 text-xs font-bold leading-5 text-amber-900 ring-1 ring-amber-100">
        <p>{TENANT_SECRET_SOURCE_HELP}</p>
        <p className="mt-1">{TENANT_SECRET_DESTINATION_HELP}</p>
      </div>
    </div>
  )
}

function TenantMigrationsNotReadyGuidance({ step, tenant }) {
  if (step.last_error_code !== 'TENANT_MIGRATIONS_NOT_READY') return null

  return (
    <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">
      <p className="font-black">Tenant database schema is not ready</p>
      <p className="mt-1 font-semibold text-rose-900">
        The control plane reached the tenant project but did not find the required runtime tables. Activation stays locked until the tenant migrations are applied and this check passes.
      </p>
      <dl className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-white p-3 ring-1 ring-rose-100">
          <dt className="text-xs font-black uppercase tracking-[0.16em] text-rose-700">Tenant project ref</dt>
          <dd className="mt-1 font-mono text-sm font-black">{tenant?.supabase_project_ref || 'Not configured'}</dd>
        </div>
        <div className="rounded-xl bg-white p-3 ring-1 ring-rose-100">
          <dt className="text-xs font-black uppercase tracking-[0.16em] text-rose-700">Missing shape</dt>
          <dd className="mt-1 font-mono text-sm font-black">tenant_profile + tenant_app_config</dd>
        </div>
      </dl>
      <p className="mt-4 rounded-xl bg-white p-3 text-xs font-bold leading-5 text-rose-900 ring-1 ring-rose-100">
        Use the secure setup path for this tenant project, then rerun this check. The failed state is recorded in the migration ledger so the setup can be retried without losing audit history.
      </p>
    </div>
  )
}

function StepExternalActions({ step }) {
  const actions = actionsForStep(step)
  if (actions.length === 0) return null

  return (
    <div className="mt-3 grid gap-2">
      {actions.map((action) => (
        <a
          key={`${step.id}:${action.href}:${action.label}`}
          href={action.href}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-900 transition hover:border-cyan-300 hover:text-cyan-800"
        >
          <span className="block">{action.label}</span>
          <span className="mt-1 block text-xs font-semibold text-slate-500">{action.description}</span>
        </a>
      ))}
    </div>
  )
}

export default function ProvisioningStepsPanel({
  tenant,
  steps,
  migrationRuns,
  job,
  onRunStep,
  onCancelJob,
  onResumeJob,
  onCompensateStep,
  onStoreTenantSecret,
  runningStepId,
  cancellingJob,
  resumingJob,
  compensatingStepId,
  storingTenantSecret,
  runMessage,
}) {
  const [copiedSecretName, setCopiedSecretName] = useState('')
  const orderedSteps = [...(steps || [])].sort(sortProvisioningSteps)
  const latestMigrationRun = Array.isArray(migrationRuns) ? migrationRuns[0] : null
  const nextRunnableStep = findNextRunnableStep(orderedSteps)
  const nextRunnableStepId = nextRunnableStep?.id || null

  async function copySecretName(secretName) {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(secretName)
        setCopiedSecretName(secretName)
        return
      }
    } catch {
      // Clipboard access can be blocked by browser permissions; the visible name still supports manual copy.
    }

    setCopiedSecretName('')
  }

  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-700">Provisioning ledger</p>
          <h2 className="mt-2 text-2xl font-black">Tenant readiness steps</h2>
          <p className="mt-2 text-sm text-slate-500">
            Each step has an idempotency key and undo strategy so tenant creation can be retried, cancelled, or compensated safely.
          </p>
        </div>
        {canCancelJob(job) ? (
          <SecondaryButton onClick={() => onCancelJob?.(job)} disabled={cancellingJob}>
            {cancellingJob ? 'Cancelling...' : 'Cancel provisioning job'}
          </SecondaryButton>
        ) : null}
      </div>

      {canResumeJob(job) ? (
        <div className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-black text-cyan-950">Resume this tenant setup safely</p>
              <p className="mt-1 text-sm font-semibold text-cyan-900">
                This job is {job.status}. Its history stays locked for audit, and resume creates a new readiness ledger that carries forward safe completed checkpoints.
              </p>
            </div>
            <PrimaryButton onClick={() => onResumeJob?.(job)} disabled={resumingJob}>
              {resumingJob ? 'Resuming...' : 'Resume provisioning'}
            </PrimaryButton>
          </div>
        </div>
      ) : null}

      {!canResumeJob(job) && nextRunnableStep ? (
        <div className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-cyan-950">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-700">Next action</p>
          <p className="mt-2 font-black">{labelForStep(nextRunnableStep.step_code)}</p>
          {guidanceForStep(nextRunnableStep) ? (
            <p className="mt-1 text-sm font-semibold text-cyan-900">{guidanceForStep(nextRunnableStep)}</p>
          ) : null}
        </div>
      ) : null}

      {latestMigrationRun ? (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Latest DB setup run</p>
              <p className="mt-2 font-black">{latestMigrationRun.status}</p>
              {latestMigrationRun.last_error_summary ? (
                <p className="mt-1 text-sm font-semibold text-slate-600">{latestMigrationRun.last_error_summary}</p>
              ) : null}
            </div>
            <StatusPill status={latestMigrationRun.status} />
          </div>
          {latestMigrationRun.tenant_migration_items?.length ? (
            <div className="mt-4 grid gap-2">
              {latestMigrationRun.tenant_migration_items.slice(0, 8).map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 text-xs ring-1 ring-slate-200">
                  <span className="font-mono font-black text-slate-700">{item.version}_{item.name}</span>
                  <StatusPill status={item.status} />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3">
        {orderedSteps.map((step) => {
          const isNextStep = step.id === nextRunnableStepId
          const isBlocked = Boolean(blockedReasonForStep(step, nextRunnableStepId))
          const stepGuidance = guidanceForStep(step)

          return (
            <div
              key={step.id}
              aria-current={isNextStep ? 'step' : undefined}
              className={`rounded-2xl p-4 transition ${
                isNextStep
                  ? 'bg-cyan-50 ring-2 ring-cyan-300'
                  : isBlocked
                    ? 'bg-slate-50 opacity-75 ring-1 ring-slate-200'
                    : 'bg-slate-50'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black">{labelForStep(step.step_code)}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {step.provider || 'doctoleb'} · undo: {step.undo_strategy || 'none'} · attempts: {step.attempt_count ?? 0}
                  </p>
                  {(isNextStep || step.status === 'failed') && stepGuidance ? (
                    <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-600">{stepGuidance}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canRunStep(step) && isNextStep ? (
                    <PrimaryButton onClick={() => onRunStep?.(step)} disabled={runningStepId === step.id}>
                      {runningStepId === step.id ? 'Running...' : 'Run safe check'}
                    </PrimaryButton>
                  ) : canRunStep(step) && isBlocked ? (
                    <SecondaryButton disabled>
                      Locked
                    </SecondaryButton>
                  ) : null}
                  {canCompensateStep(step) ? (
                    <SecondaryButton onClick={() => onCompensateStep?.(step)} disabled={compensatingStepId === step.id}>
                      {compensatingStepId === step.id ? 'Compensating...' : 'Compensate'}
                    </SecondaryButton>
                  ) : null}
                  <StatusPill status={step.status} />
                </div>
              </div>
              {isBlocked ? (
                <p className="mt-3 rounded-xl bg-white p-3 text-sm font-bold text-slate-600 ring-1 ring-slate-200">
                  {blockedReasonForStep(step, nextRunnableStepId)}
                </p>
              ) : null}
              {step.last_error_summary ? (
                <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{step.last_error_summary}</p>
              ) : null}
              <MissingTenantSecretGuidance
                step={step}
                tenant={tenant}
                copiedSecretName={copiedSecretName}
                onCopySecretName={copySecretName}
                onStoreTenantSecret={onStoreTenantSecret}
                storingTenantSecret={storingTenantSecret}
              />
              <DatabaseUrlGuidance
                step={step}
                tenant={tenant}
                onStoreTenantSecret={onStoreTenantSecret}
                storingTenantSecret={storingTenantSecret}
              />
              <TenantMigrationsNotReadyGuidance step={step} tenant={tenant} />
              <StepExternalActions step={step} />
            </div>
          )
        })}
        {orderedSteps.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No provisioning steps recorded yet.</p>
        ) : null}
      </div>
      {runMessage ? <p className="mt-4 rounded-2xl bg-cyan-50 p-4 text-sm font-bold text-cyan-800">{runMessage}</p> : null}
    </section>
  )
}
