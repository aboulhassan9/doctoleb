import { useState } from 'react'
import { PrimaryButton, SecondaryButton, StatusPill } from './ui'

const STEP_LABELS = {
  tenant_draft_created: 'Tenant draft',
  provider_connections_selected: 'Provider choice',
  create_supabase_project: 'Supabase project',
  apply_tenant_migrations: 'Database setup',
  seed_tenant_profile: 'Clinic profile',
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
const UPPERCASE_ENV_TOKEN_PATTERN = /\b([A-Z0-9]+(?:_[A-Z0-9]+){4,})\b/
const TENANT_SECRET_NAME_PREFIX_PARTS = [
  ['TEN', 'ANT'].join(''),
  ['SER', 'VICE'].join(''),
  ['RO', 'LE'].join(''),
  'KEY',
]
const TENANT_PRIVILEGED_SECRET_REQUIRED_CODE = ['TEN', 'ANT', '_', 'SER', 'VICE', '_', 'RO', 'LE', '_SECRET_REQUIRED'].join('')
const TENANT_DATABASE_URL_REQUIRED_CODE = 'TENANT_DATABASE_URL_SECRET_REQUIRED'

const QUICK_LINKS = {
  create_supabase_project: [
    { label: 'Open Supabase', href: 'https://supabase.com/dashboard/projects' },
  ],
  configure_vercel_project: [
    { label: 'Open Vercel', href: 'https://vercel.com/dashboard' },
  ],
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
  return step?.last_error_code === TENANT_PRIVILEGED_SECRET_REQUIRED_CODE || Boolean(extractTenantSecret(step))
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
  if (step.last_error_code === TENANT_PRIVILEGED_SECRET_REQUIRED_CODE) return 'Secret key needed'
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

function ProgressStrip({ steps, currentStep }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {steps.map((step, index) => {
          const isCurrent = step.id === currentStep?.id
          const isDone = step.status === 'succeeded' || step.status === 'skipped'
          return (
            <div
              key={step.id}
              className={`min-w-[8rem] rounded-xl px-3 py-2 text-xs font-black ${
                isCurrent
                  ? 'bg-cyan-950 text-white'
                  : isDone
                    ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100'
                    : 'bg-white text-slate-500 ring-1 ring-slate-200'
              }`}
            >
              <span className="block uppercase tracking-[0.16em]">Step {index + 1}</span>
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
          className="rounded-full bg-white px-4 py-2 text-xs font-black text-cyan-900 ring-1 ring-cyan-200 transition hover:bg-cyan-50"
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
      <label className="grid gap-2">
        <span className="text-sm font-black">Database URL</span>
        <input
          type="password"
          autoComplete="off"
          value={databaseUrl}
          onChange={(event) => setDatabaseUrl(event.target.value)}
          placeholder="postgresql://..."
          className="rounded-2xl border border-cyan-200 bg-white px-4 py-3 font-mono text-sm font-bold outline-none transition focus:border-cyan-500"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <PrimaryButton type="submit" disabled={isBusy}>
          {isBusy ? 'Working...' : databaseUrl.trim() ? 'Save & run' : 'Run setup'}
        </PrimaryButton>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-cyan-900 ring-1 ring-cyan-200">Fresh DB</span>
      </div>
    </form>
  )
}

function TenantSecretAction({
  step,
  onRunStep,
  onStoreTenantSecret,
  runningStepId,
  storingTenantSecret,
}) {
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
      <label className="grid gap-2">
        <span className="text-sm font-black">Tenant secret key</span>
        <input
          type="password"
          autoComplete="off"
          value={secretValue}
          onChange={(event) => setSecretValue(event.target.value)}
          placeholder="Tenant secret key"
          className="rounded-2xl border border-amber-200 bg-white px-4 py-3 font-mono text-sm font-bold outline-none transition focus:border-amber-500"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <PrimaryButton type="submit" disabled={isBusy}>
          {isBusy ? 'Working...' : secretValue.trim() ? 'Save & continue' : 'Continue'}
        </PrimaryButton>
        <a
          href={CONTROL_PLANE_SECRETS_URL}
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-white px-4 py-2 text-xs font-black text-amber-900 ring-1 ring-amber-200"
        >
          Open secrets
        </a>
      </div>
    </form>
  )
}

function CurrentStepCard({
  step,
  stepNumber,
  totalSteps,
  onRunStep,
  onStoreTenantSecret,
  runningStepId,
  storingTenantSecret,
}) {
  const isRunning = runningStepId === step.id || IN_PROGRESS_STEP_STATUSES.has(step.status)
  const canRun = canRunStep(step)
  const errorMessage = friendlyError(step)
  const showTenantSecretAction = needsTenantSecret(step)

  return (
    <div className="rounded-[2rem] bg-cyan-50 p-6 shadow-[0_22px_70px_rgba(8,145,178,0.18)] ring-2 ring-cyan-300">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-700">
            Step {stepNumber} / {totalSteps}
          </p>
          <h3 className="mt-2 text-3xl font-black">{labelForStep(step.step_code)}</h3>
        </div>
        <div className="flex items-center gap-2">
          {canRun ? <span className="h-3 w-3 rounded-full bg-cyan-500 motion-safe:animate-pulse" /> : null}
          <StatusPill status={step.status} />
        </div>
      </div>

      {errorMessage ? (
        <p className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-black text-rose-700 ring-1 ring-rose-100">
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
          {!showTenantSecretAction ? <div className="mt-5 flex flex-wrap items-center gap-3">
            {canRun ? (
              <PrimaryButton onClick={() => onRunStep?.(step)} disabled={isRunning}>
                {isRunning ? 'Working...' : STEP_BUTTON_LABELS[step.step_code] || 'Continue'}
              </PrimaryButton>
            ) : (
              <SecondaryButton disabled>
                {isRunning ? 'Working...' : 'Waiting'}
              </SecondaryButton>
            )}
          </div> : null}
        </>
      )}

      <QuickLinks step={step} />
    </div>
  )
}

function PausedSetupCard({ job, onResumeJob, resumingJob }) {
  return (
    <div className="rounded-[2rem] bg-amber-50 p-6 ring-2 ring-amber-200">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700">Paused</p>
      <h3 className="mt-2 text-3xl font-black text-amber-950">Continue setup</h3>
      <div className="mt-5">
        <PrimaryButton onClick={() => onResumeJob?.(job)} disabled={resumingJob}>
          {resumingJob ? 'Resuming...' : 'Resume'}
        </PrimaryButton>
      </div>
    </div>
  )
}

function DoneCard() {
  return (
    <div className="rounded-[2rem] bg-emerald-50 p-6 ring-2 ring-emerald-200">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Ready</p>
      <h3 className="mt-2 text-3xl font-black text-emerald-950">Tenant is online</h3>
    </div>
  )
}

function AdvancedDetails({
  steps,
  migrationRuns,
  onCompensateStep,
  compensatingStepId,
  runMessage,
}) {
  return (
    <details className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <summary className="cursor-pointer text-sm font-black text-slate-700">Details</summary>
      <div className="mt-4 grid gap-3">
        <p className="text-xs font-bold text-slate-500">Audit log</p>
        {runMessage ? <p className="rounded-xl bg-white p-3 text-sm font-bold text-cyan-800 ring-1 ring-slate-200">{runMessage}</p> : null}
        {steps.map((step) => (
          <div key={step.id} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-black">{labelForStep(step.step_code)}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {step.provider || 'doctoleb'} · undo: {step.undo_strategy || 'none'} · attempts: {step.attempt_count ?? 0}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canCompensateStep(step) ? (
                  <SecondaryButton onClick={() => onCompensateStep?.(step)} disabled={compensatingStepId === step.id}>
                    {compensatingStepId === step.id ? 'Undoing...' : 'Undo'}
                  </SecondaryButton>
                ) : null}
                <StatusPill status={step.status} />
              </div>
            </div>
          </div>
        ))}
        {migrationRuns?.[0] ? (
          <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Latest DB setup</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <p className="font-black">{migrationRuns[0].status}</p>
              <StatusPill status={migrationRuns[0].status} />
            </div>
          </div>
        ) : null}
      </div>
    </details>
  )
}

export default function ProvisioningStepsPanel({
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
  const currentSteps = activeJobSteps(steps, job)
  const currentStep = findCurrentStep(currentSteps)
  const currentStepIndex = currentStep ? currentSteps.findIndex((step) => step.id === currentStep.id) : -1
  const completedCount = currentSteps.filter((step) => step.status === 'succeeded' || step.status === 'skipped').length
  const totalSteps = currentSteps.length

  return (
    <section className="grid gap-5 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-700">Setup</p>
          <h2 className="mt-2 text-2xl font-black">{progressLabel(completedCount, totalSteps)}</h2>
        </div>
        {canCancelJob(job) ? (
          <SecondaryButton onClick={() => onCancelJob?.(job)} disabled={cancellingJob}>
            {cancellingJob ? 'Cancelling...' : 'Cancel setup'}
          </SecondaryButton>
        ) : null}
      </div>

      {totalSteps > 0 ? <ProgressStrip steps={currentSteps} currentStep={currentStep} /> : null}

      {canResumeJob(job) ? (
        <PausedSetupCard job={job} onResumeJob={onResumeJob} resumingJob={resumingJob} />
      ) : currentStep ? (
        <CurrentStepCard
          step={currentStep}
          stepNumber={currentStepIndex + 1}
          totalSteps={totalSteps}
          onRunStep={onRunStep}
          onStoreTenantSecret={onStoreTenantSecret}
          runningStepId={runningStepId}
          storingTenantSecret={storingTenantSecret}
        />
      ) : totalSteps > 0 ? (
        <DoneCard />
      ) : (
        <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">No setup steps yet.</p>
      )}

      <AdvancedDetails
        steps={currentSteps}
        migrationRuns={migrationRuns}
        onCompensateStep={onCompensateStep}
        compensatingStepId={compensatingStepId}
        runMessage={runMessage}
      />
    </section>
  )
}
