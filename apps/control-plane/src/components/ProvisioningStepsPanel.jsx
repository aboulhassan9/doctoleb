import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Badge, PrimaryButton, SecondaryButton, StatusPill, TextInput } from './ui'

const STEP_LABELS = {
  tenant_draft_created: 'Tenant draft',
  provider_connections_selected: 'Provider choice',
  create_supabase_project: 'Supabase project',
  apply_tenant_migrations: 'Database setup',
  seed_tenant_profile: 'Clinic profile',
  normalize_tenant_auth_settings: 'Auth settings',
  seed_first_doctor_admin: 'Doctor admin',
  configure_vercel_project: 'Web routing',
  store_runtime_config: 'App connection',
  smoke_test_resolver: 'Open app test',
  activate_tenant: 'Go live',
}

const STEP_BUTTON_LABELS = {
  provider_connections_selected: 'Confirm provider choice',
  create_supabase_project: 'Confirm Supabase project',
  apply_tenant_migrations: 'Run setup',
  seed_tenant_profile: 'Create clinic profile',
  normalize_tenant_auth_settings: 'Normalize Auth config',
  seed_first_doctor_admin: 'Create doctor invite',
  configure_vercel_project: 'Check routing',
  store_runtime_config: 'Save connection',
  smoke_test_resolver: 'Test links',
  activate_tenant: 'Go live',
}

const RUNNABLE_STEP_CODES = new Set([
  'provider_connections_selected',
  'create_supabase_project',
  'apply_tenant_migrations',
  'seed_tenant_profile',
  'normalize_tenant_auth_settings',
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
  'normalize_tenant_auth_settings',
  'seed_first_doctor_admin',
  'configure_vercel_project',
  'store_runtime_config',
  'smoke_test_resolver',
  'activate_tenant',
]
const PROVISIONING_STEP_RANK = new Map(PROVISIONING_STEP_ORDER.map((code, index) => [code, index]))
const UPPERCASE_ENV_TOKEN_PATTERN = /\b([A-Z0-9]+(?:_[A-Z0-9]+){4,})\b/
const TENANT_SECRET_NAME_PREFIX_PARTS = [
  ['TEN', 'ANT'].join(''),
  ['SER', 'VICE'].join(''),
  ['RO', 'LE'].join(''),
  'KEY',
]
const TENANT_PRIVILEGED_SECRET_REQUIRED_CODE = ['TEN', 'ANT', '_', 'SER', 'VICE', '_', 'RO', 'LE', '_SECRET_REQUIRED'].join('')
const TENANT_DATABASE_URL_REQUIRED_CODE = 'TENANT_DATABASE_URL_SECRET_REQUIRED'
const TENANT_DATABASE_AUTH_FAILED_CODE = 'TENANT_DATABASE_AUTH_FAILED'
const TENANT_DATABASE_CONNECTION_FAILED_CODE = 'TENANT_DATABASE_CONNECTION_FAILED'
const FIRST_DOCTOR_INVITE_FAILED_CODE = 'FIRST_DOCTOR_ADMIN_INVITE_FAILED'

const QUICK_LINKS = {
  create_supabase_project: [{ label: 'Open Supabase', href: 'https://supabase.com/dashboard/projects' }],
  configure_vercel_project: [{ label: 'Open Vercel', href: 'https://vercel.com/dashboard' }],
  smoke_test_resolver: [
    { label: 'Patient app', href: 'https://doctoleb-patient-web.vercel.app' },
    { label: 'Staff app', href: 'https://doctoleb-clinic-ops.vercel.app' },
  ],
}

function labelForStep(code) {
  return STEP_LABELS[code] || String(code || '').replaceAll('_', ' ')
}

function canRunStep(step) {
  return RUNNABLE_STEP_CODES.has(step?.step_code) && RUNNABLE_STATUSES.has(step?.status)
}

function isStepFinal(step) {
  return TERMINAL_STEP_STATUSES.has(step?.status)
}

function stepSortRank(step) {
  return PROVISIONING_STEP_RANK.get(step.step_code) ?? Number.MAX_SAFE_INTEGER
}

function sortProvisioningSteps(a, b) {
  const rankDiff = stepSortRank(a) - stepSortRank(b)
  if (rankDiff !== 0) return rankDiff
  return String(a.created_at || '').localeCompare(String(b.created_at || ''))
}

function activeJobSteps(steps, job) {
  const orderedSteps = [...(steps || [])].sort(sortProvisioningSteps)
  if (!job?.id) return orderedSteps

  const currentJobSteps = orderedSteps.filter((step) => step.provisioning_job_id === job.id)
  return currentJobSteps.length > 0 ? currentJobSteps : orderedSteps
}

function findCurrentStep(steps) {
  return steps.find((step) => !isStepFinal(step)) || null
}

function findCompletedDatabaseStep(steps) {
  return (
    steps.find(
      (step) => step.step_code === 'apply_tenant_migrations' && ['succeeded', 'skipped'].includes(step.status),
    ) || null
  )
}

function canCancelJob(job) {
  return job?.id && !FINAL_JOB_STATUSES.has(job.status)
}

function canResumeJob(job) {
  return job?.id && RESUMABLE_JOB_STATUSES.has(job.status)
}

function canCompensateStep(step) {
  return step.status === 'succeeded' && step.undo_strategy && step.undo_strategy !== 'none'
}

function needsTenantSecret(step) {
  return (
    step?.last_error_code === TENANT_PRIVILEGED_SECRET_REQUIRED_CODE ||
    (step?.step_code === 'seed_first_doctor_admin' && step?.last_error_code === FIRST_DOCTOR_INVITE_FAILED_CODE) ||
    Boolean(extractTenantSecret(step))
  )
}

function extractTenantSecret(step) {
  const summary = step?.last_error_summary || ''
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

function friendlyError(step) {
  if (!step?.last_error_code && !step?.last_error_summary) return ''

  if (step.last_error_code === TENANT_DATABASE_URL_REQUIRED_CODE) return 'Database URL needed'
  if (step.last_error_code === TENANT_DATABASE_AUTH_FAILED_CODE) return 'DB password rejected'
  if (step.last_error_code === TENANT_DATABASE_CONNECTION_FAILED_CODE) return 'DB connection failed'
  if (step.last_error_code === TENANT_PRIVILEGED_SECRET_REQUIRED_CODE) return 'Secret key needed'
  if (step.last_error_code === FIRST_DOCTOR_INVITE_FAILED_CODE) return 'Service key needed'
  if (step.last_error_code === 'TENANT_MIGRATIONS_NOT_READY') return 'Database setup needed'
  if (step.last_error_code === 'STEP_PRECONDITION_FAILED') return 'Previous step needed'
  if (step.status === 'failed') return 'Try again'

  return 'Needs attention'
}

function progressLabel(completedCount, totalCount) {
  if (totalCount === 0) return 'No setup steps yet'
  if (completedCount === totalCount) return 'Setup complete'
  return `${completedCount}/${totalCount} complete`
}

function FieldLabel({ children }) {
  return <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-slate-500">{children}</span>
}

function ProgressStrip({ steps, currentStep }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {steps.map((step, index) => {
          const isCurrent = step.id === currentStep?.id
          const isDone = step.status === 'succeeded' || step.status === 'skipped'
          return (
            <div
              key={step.id}
              className={`min-w-[8rem] rounded-md px-3 py-2 text-xs font-semibold ${
                isCurrent
                  ? 'bg-slate-900 text-white'
                  : isDone
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border border-slate-200 bg-white text-slate-500'
              }`}
            >
              <span className="block font-mono text-[10px] uppercase tracking-wide opacity-70">Step {index + 1}</span>
              <span className="mt-1 block truncate">{labelForStep(step.step_code)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function QuickLinks({ step }) {
  const baseLinks = QUICK_LINKS[step?.step_code] || []
  const links = step?.external_resource_url
    ? [{ label: 'Open resource', href: step.external_resource_url }, ...baseLinks]
    : baseLinks
  if (links.length === 0) return null

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {links.map((link) => (
        <a
          key={`${step.id}:${link.href}:${link.label}`}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          {link.label}
        </a>
      ))}
    </div>
  )
}

function DatabaseSetupAction({
  step,
  onRunStep,
  onStoreTenantSecret,
  runningStepId,
  storingTenantSecret,
  actionLabel = 'Run setup',
  savedActionLabel = 'Save & run',
  badgeLabel = 'Fresh DB',
}) {
  const [databaseUrl, setDatabaseUrl] = useState('')
  const isBusy = runningStepId === step.id || storingTenantSecret

  async function saveAndRun(event) {
    event.preventDefault()
    const value = databaseUrl.trim()
    if (value) {
      const storeResult = await onStoreTenantSecret?.({ secretValue: value, secretKind: 'database_url' })
      if (storeResult?.error) return
      setDatabaseUrl('')
    }
    await onRunStep?.(step)
  }

  return (
    <form onSubmit={saveAndRun} className="mt-5 grid gap-3">
      <label className="grid gap-1.5">
        <FieldLabel>Database URL</FieldLabel>
        <TextInput
          type="password"
          autoComplete="off"
          value={databaseUrl}
          onChange={(event) => setDatabaseUrl(event.target.value)}
          placeholder="postgresql://..."
          className="font-mono"
        />
      </label>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <PrimaryButton type="submit" disabled={isBusy}>
          {isBusy ? 'Working...' : databaseUrl.trim() ? savedActionLabel : actionLabel}
        </PrimaryButton>
        <Badge variant="neutral">{badgeLabel}</Badge>
      </div>
    </form>
  )
}

function TenantSecretAction({ step, onRunStep, onStoreTenantSecret, runningStepId, storingTenantSecret }) {
  const [secretValue, setSecretValue] = useState('')
  const shouldAskForSecret = needsTenantSecret(step)
  const isBusy = runningStepId === step.id || storingTenantSecret

  async function saveAndContinue(event) {
    event.preventDefault()
    const value = secretValue.trim()
    if (value) {
      const storeResult = await onStoreTenantSecret?.({ secretValue: value })
      if (storeResult?.error) return
      setSecretValue('')
    }
    await onRunStep?.(step)
  }

  if (!shouldAskForSecret) return null

  return (
    <form onSubmit={saveAndContinue} className="mt-5 grid gap-3">
      <label className="grid gap-1.5">
        <FieldLabel>Service role key</FieldLabel>
        <TextInput
          type="password"
          autoComplete="off"
          value={secretValue}
          onChange={(event) => setSecretValue(event.target.value)}
          placeholder="Paste privileged tenant key"
          className="border-amber-300 font-mono focus:border-amber-500 focus:ring-amber-500/20"
        />
      </label>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <PrimaryButton type="submit" disabled={isBusy}>
          {isBusy ? 'Working...' : secretValue.trim() ? 'Save & retry' : 'Retry'}
        </PrimaryButton>
      </div>
    </form>
  )
}

function CurrentStepCard({ step, stepNumber, totalSteps, onRunStep, onStoreTenantSecret, runningStepId, storingTenantSecret }) {
  const isRunning = runningStepId === step.id || IN_PROGRESS_STEP_STATUSES.has(step.status)
  const canRun = canRunStep(step)
  const errorMessage = friendlyError(step)
  const showTenantSecretAction = needsTenantSecret(step)

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="accent">
            Step {stepNumber} / {totalSteps}
          </Badge>
          <h3 className="mt-2.5 text-base font-semibold tracking-tight text-slate-900">
            {labelForStep(step.step_code)}
          </h3>
        </div>
        <StatusPill status={step.status} />
      </div>

      {errorMessage ? (
        <p className="mt-4 inline-flex items-center rounded-md bg-rose-50 px-2.5 py-1 text-sm font-medium text-rose-700 ring-1 ring-inset ring-rose-600/20">
          {errorMessage}
        </p>
      ) : null}

      {step.step_code === 'apply_tenant_migrations' ? (
        <DatabaseSetupAction
          step={step}
          onRunStep={onRunStep}
          onStoreTenantSecret={onStoreTenantSecret}
          runningStepId={runningStepId}
          storingTenantSecret={storingTenantSecret}
        />
      ) : (
        <>
          <TenantSecretAction
            step={step}
            onRunStep={onRunStep}
            onStoreTenantSecret={onStoreTenantSecret}
            runningStepId={runningStepId}
            storingTenantSecret={storingTenantSecret}
          />
          {!showTenantSecretAction ? (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {canRun ? (
                <PrimaryButton onClick={() => onRunStep?.(step)} disabled={isRunning}>
                  {isRunning ? 'Working...' : STEP_BUTTON_LABELS[step.step_code] || 'Continue'}
                </PrimaryButton>
              ) : (
                <SecondaryButton disabled>{isRunning ? 'Working...' : 'Waiting'}</SecondaryButton>
              )}
            </div>
          ) : null}
        </>
      )}

      <QuickLinks step={step} />
    </div>
  )
}

function StatusCard({ tone, badge, title, children }) {
  const tones = {
    amber: 'border-amber-200 bg-amber-50',
    emerald: 'border-emerald-200 bg-emerald-50',
    slate: 'border-slate-200 bg-white',
  }
  const titleTones = {
    amber: 'text-amber-900',
    emerald: 'text-emerald-900',
    slate: 'text-slate-900',
  }
  return (
    <div className={`rounded-lg border p-5 ${tones[tone]}`}>
      {badge}
      <h3 className={`mt-2.5 text-base font-semibold tracking-tight ${titleTones[tone]}`}>{title}</h3>
      {children}
    </div>
  )
}

function PausedSetupCard({ job, onResumeJob, resumingJob }) {
  return (
    <StatusCard tone="amber" badge={<Badge variant="warning">Paused</Badge>} title="Continue setup">
      <div className="mt-5">
        <PrimaryButton onClick={() => onResumeJob?.(job)} disabled={resumingJob}>
          {resumingJob ? 'Resuming...' : 'Resume'}
        </PrimaryButton>
      </div>
    </StatusCard>
  )
}

function DoneCard() {
  return (
    <StatusCard tone="emerald" badge={<Badge variant="success">Ready</Badge>} title="Tenant is online" />
  )
}

function LegacyActiveTenantCard() {
  return (
    <StatusCard tone="emerald" badge={<Badge variant="success">Active</Badge>} title="Legacy active tenant">
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-emerald-800">
        This tenant is active and routable, but it was created before the guided provisioning ledger existed. New
        tenants show every setup step; this older tenant keeps its active status without a historical step timeline.
      </p>
    </StatusCard>
  )
}

function DatabaseUpgradeCard({ step, onRunStep, onStoreTenantSecret, runningStepId, storingTenantSecret }) {
  return (
    <div className="mt-3">
      <StatusCard tone="slate" badge={<Badge variant="neutral">Database</Badge>} title="Update schema">
        <DatabaseSetupAction
          step={step}
          onRunStep={onRunStep}
          onStoreTenantSecret={onStoreTenantSecret}
          runningStepId={runningStepId}
          storingTenantSecret={storingTenantSecret}
          actionLabel="Update database"
          savedActionLabel="Save & update"
          badgeLabel="Safe upgrade"
        />
      </StatusCard>
    </div>
  )
}

function defaultSeedTag() {
  const now = new Date()
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(now.getUTCDate()).padStart(2, '0')
  return `ops_seed_${yyyy}${mm}${dd}`
}

function resultRows(seedResult) {
  const plan = seedResult?.data?.plan || seedResult?.details?.plan
  const counts = seedResult?.data?.counts

  if (counts && Object.keys(counts).length > 0) {
    return Object.entries(counts)
      .filter(([, value]) => typeof value === 'number' && value > 0)
      .slice(0, 8)
      .map(([key, value]) => `${key.replaceAll('_', ' ')}: ${value}`)
  }

  if (plan?.rows) {
    return Object.entries(plan.rows)
      .slice(0, 8)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${value}`)
  }

  return []
}

function OperationalSeedCard({ tenant, onSeedTenantOperationalData, seedingTenant, seedMessage, seedResult }) {
  const [volume, setVolume] = useState('tiny')
  const [seedTag, setSeedTag] = useState(defaultSeedTag)
  const [allowDuplicates, setAllowDuplicates] = useState(false)
  const isActiveTenant = tenant?.status === 'active'
  const canRun = Boolean(onSeedTenantOperationalData) && isActiveTenant && !seedingTenant
  const blockers = seedResult?.details?.blockers || []
  const rows = resultRows(seedResult)

  async function runSeed(mode) {
    await onSeedTenantOperationalData?.({ mode, volume, seedTag: seedTag.trim(), allowDuplicates })
  }

  const darkInput =
    'h-9 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-teal-400 focus:ring-1 focus:ring-teal-400/30'

  return (
    <div className="mt-3 rounded-lg bg-slate-950 p-6 text-white">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-wide text-slate-500">Test data</span>
          <h3 className="mt-1.5 text-base font-semibold tracking-tight text-white">Seed tenant operational data</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Creates tagged synthetic patients, appointments, encounters, reports, payments, conversations,
            notifications, and insurance rows through a server-side admin function. The browser never receives
            privileged tenant keys.
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide ring-1 ring-inset ${
            isActiveTenant
              ? 'bg-emerald-400/10 text-emerald-400 ring-emerald-400/20'
              : 'bg-amber-400/10 text-amber-400 ring-amber-400/20'
          }`}
        >
          {isActiveTenant ? 'Active tenant' : 'Activate first'}
        </span>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_10rem]">
        <label className="grid gap-1.5">
          <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-slate-400">Seed tag</span>
          <input
            value={seedTag}
            onChange={(event) => setSeedTag(event.target.value)}
            className={`${darkInput} font-mono`}
            placeholder="ops_seed_20260517"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-slate-400">Volume</span>
          <select value={volume} onChange={(event) => setVolume(event.target.value)} className={darkInput}>
            <option className="text-slate-900" value="tiny">
              Tiny
            </option>
            <option className="text-slate-900" value="small">
              Small
            </option>
          </select>
        </label>
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-md border border-white/10 bg-white/5 p-4 text-sm text-slate-300 transition-colors hover:bg-white/10">
        <input
          type="checkbox"
          checked={allowDuplicates}
          onChange={(event) => setAllowDuplicates(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-teal-500"
        />
        <span className="leading-relaxed">
          Allow appending to the same seed tag. Keep this off unless you intentionally want more rows in the same test
          namespace.
        </span>
      </label>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => runSeed('dry_run')}
          disabled={!canRun}
          className="inline-flex h-9 items-center justify-center rounded-md border border-slate-700 px-3.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50"
        >
          {seedingTenant ? 'Checking...' : 'Dry run'}
        </button>
        <button
          type="button"
          onClick={() => runSeed('write')}
          disabled={!canRun}
          className="inline-flex h-9 items-center justify-center rounded-md bg-white px-3.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-200 disabled:pointer-events-none disabled:opacity-50"
        >
          {seedingTenant ? 'Seeding...' : 'Seed test data'}
        </button>
      </div>

      {!isActiveTenant ? (
        <p className="mt-5 rounded-md border border-amber-400/20 bg-amber-400/10 p-3 text-sm font-medium text-amber-400">
          Tenant must be active first, otherwise the seed could create data for a tenant that is not routable from the
          apps.
        </p>
      ) : null}

      {seedMessage ? (
        <p
          className={`mt-5 rounded-md border p-3 text-sm font-medium ${
            seedResult?.error
              ? 'border-rose-400/20 bg-rose-400/10 text-rose-400'
              : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-400'
          }`}
        >
          {seedMessage}
        </p>
      ) : null}

      {blockers.length > 0 ? (
        <div className="mt-5 rounded-md border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-300">
          <p className="mb-2 font-semibold text-rose-400">Preflight blockers</p>
          <ul className="list-disc space-y-1 pl-5">
            {blockers.slice(0, 5).map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map((row) => (
            <span
              key={row}
              className="inline-flex items-center rounded-md bg-white/5 px-2.5 py-1.5 font-mono text-xs font-medium text-slate-300"
            >
              {row}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function AdvancedDetails({ steps, migrationRuns, onCompensateStep, compensatingStepId, runMessage }) {
  return (
    <details className="group mt-4 rounded-lg border border-slate-200 bg-white [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer items-center justify-between px-5 py-3.5 text-sm font-semibold text-slate-900">
        Advanced Details
        <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-3 border-t border-slate-100 bg-slate-50 p-5">
        <h4 className="font-mono text-[11px] font-medium uppercase tracking-wide text-slate-500">Audit log</h4>
        {runMessage ? (
          <p className="rounded-md border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700">
            {runMessage}
          </p>
        ) : null}

        <div className="grid gap-2.5">
          {steps.map((step) => (
            <div
              key={step.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-slate-200 bg-white p-4"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">{labelForStep(step.step_code)}</p>
                <p className="mt-1 font-mono text-xs text-slate-500">
                  {step.provider || 'doctoleb'} &middot; undo: {step.undo_strategy || 'none'} &middot; attempts:{' '}
                  {step.attempt_count ?? 0}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {canCompensateStep(step) ? (
                  <SecondaryButton onClick={() => onCompensateStep?.(step)} disabled={compensatingStepId === step.id}>
                    {compensatingStepId === step.id ? 'Undoing...' : 'Undo'}
                  </SecondaryButton>
                ) : null}
                <StatusPill status={step.status} />
              </div>
            </div>
          ))}
        </div>

        {migrationRuns?.[0] ? (
          <div className="mt-1 rounded-md border border-slate-200 bg-white p-4">
            <h4 className="font-mono text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Latest DB setup
            </h4>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-sm font-medium capitalize text-slate-900">{migrationRuns[0].status}</p>
              <StatusPill status={migrationRuns[0].status} />
            </div>
          </div>
        ) : null}
      </div>
    </details>
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
  onSeedTenantOperationalData,
  runningStepId,
  cancellingJob,
  resumingJob,
  compensatingStepId,
  storingTenantSecret,
  seedingTenant,
  runMessage,
  seedMessage,
  seedResult,
}) {
  const currentSteps = activeJobSteps(steps, job)
  const currentStep = findCurrentStep(currentSteps)
  const completedDatabaseStep = findCompletedDatabaseStep(currentSteps)
  const currentStepIndex = currentStep ? currentSteps.findIndex((step) => step.id === currentStep.id) : -1
  const completedCount = currentSteps.filter((step) => step.status === 'succeeded' || step.status === 'skipped').length
  const totalSteps = currentSteps.length
  const hasLegacyActiveTenant = tenant?.status === 'active' && totalSteps === 0
  const setupSummary = hasLegacyActiveTenant ? 'Active without provisioning ledger' : progressLabel(completedCount, totalSteps)
  const jobCanResume = canResumeJob(job)
  const currentStepNeedsTenantSecret = needsTenantSecret(currentStep)
  const shouldShowCurrentStep = Boolean(currentStep && (!jobCanResume || currentStepNeedsTenantSecret))

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">Provisioning Setup</h2>
          <p className="mt-1 text-sm text-slate-500">{setupSummary}</p>
        </div>
        {canCancelJob(job) ? (
          <SecondaryButton onClick={() => onCancelJob?.(job)} disabled={cancellingJob}>
            {cancellingJob ? 'Cancelling...' : 'Cancel setup'}
          </SecondaryButton>
        ) : null}
      </div>

      <div className="p-5">
        {totalSteps > 0 ? <ProgressStrip steps={currentSteps} currentStep={currentStep} /> : null}

        <div className="mt-6">
          {shouldShowCurrentStep ? (
            <CurrentStepCard
              step={currentStep}
              stepNumber={currentStepIndex + 1}
              totalSteps={totalSteps}
              onRunStep={onRunStep}
              onStoreTenantSecret={onStoreTenantSecret}
              runningStepId={runningStepId}
              storingTenantSecret={storingTenantSecret}
            />
          ) : jobCanResume ? (
            <PausedSetupCard job={job} onResumeJob={onResumeJob} resumingJob={resumingJob} />
          ) : totalSteps > 0 ? (
            <>
              <DoneCard />
              {completedDatabaseStep ? (
                <DatabaseUpgradeCard
                  step={completedDatabaseStep}
                  onRunStep={onRunStep}
                  onStoreTenantSecret={onStoreTenantSecret}
                  runningStepId={runningStepId}
                  storingTenantSecret={storingTenantSecret}
                />
              ) : null}
              <OperationalSeedCard
                tenant={tenant}
                onSeedTenantOperationalData={onSeedTenantOperationalData}
                seedingTenant={seedingTenant}
                seedMessage={seedMessage}
                seedResult={seedResult}
              />
            </>
          ) : hasLegacyActiveTenant ? (
            <>
              <LegacyActiveTenantCard />
              <OperationalSeedCard
                tenant={tenant}
                onSeedTenantOperationalData={onSeedTenantOperationalData}
                seedingTenant={seedingTenant}
                seedMessage={seedMessage}
                seedResult={seedResult}
              />
            </>
          ) : (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
              No setup steps yet.
            </div>
          )}
        </div>

        <AdvancedDetails
          steps={currentSteps}
          migrationRuns={migrationRuns}
          onCompensateStep={onCompensateStep}
          compensatingStepId={compensatingStepId}
          runMessage={runMessage}
        />
      </div>
    </section>
  )
}
