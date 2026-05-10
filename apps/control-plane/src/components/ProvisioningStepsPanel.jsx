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
      description: 'Add tenant service-role references only in Supabase secrets, never in the browser or repo.',
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

function MissingTenantSecretGuidance({ step, copiedSecretName, onCopySecretName }) {
  const secret = extractTenantServiceSecret(step)
  if (!secret) return null

  const copied = copiedSecretName === secret.secretName

  return (
    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-black">Tenant service secret required</p>
          <p className="mt-1 font-semibold text-amber-900">
            Add the server-only tenant key to the control-plane Edge Function secrets before this readiness check can pass.
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
          <dd className="mt-1 font-mono text-sm font-black">{secret.projectRef}</dd>
        </div>
        <div className="rounded-xl bg-white p-3 ring-1 ring-amber-100">
          <dt className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Secret name</dt>
          <dd className="mt-1 break-all font-mono text-sm font-black">{secret.secretName}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onCopySecretName(secret.secretName)}
          className="rounded-xl bg-amber-950 px-4 py-2 text-xs font-black text-white transition hover:bg-amber-800"
        >
          {copied ? 'Secret name copied' : 'Copy secret name'}
        </button>
        <p className="text-xs font-bold text-amber-900">
          Privileged tenant keys stay server-side only. Paste only the key value in Supabase secrets, never in chat, Git, Vercel frontend env, or browser-visible config.
        </p>
      </div>
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
  steps,
  job,
  onRunStep,
  onCancelJob,
  onCompensateStep,
  runningStepId,
  cancellingJob,
  compensatingStepId,
  runMessage,
}) {
  const [copiedSecretName, setCopiedSecretName] = useState('')
  const orderedSteps = [...(steps || [])].sort(sortProvisioningSteps)
  const nextRunnableStepId = findNextRunnableStep(orderedSteps)?.id || null

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

      <div className="mt-5 grid gap-3">
        {orderedSteps.map((step) => {
          const isNextStep = step.id === nextRunnableStepId
          const isBlocked = Boolean(blockedReasonForStep(step, nextRunnableStepId))

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
                copiedSecretName={copiedSecretName}
                onCopySecretName={copySecretName}
              />
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
