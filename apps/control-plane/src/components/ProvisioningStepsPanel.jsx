import { SecondaryButton, StatusPill } from './ui'

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
const FINAL_JOB_STATUSES = new Set(['completed', 'cancelled', 'archived'])
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
      href: 'https://supabase.com/dashboard/project/xouqxgwccewvbtkqming/functions/secrets',
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
  const orderedSteps = [...(steps || [])].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))

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
        {orderedSteps.map((step) => (
          <div key={step.id} className="rounded-2xl bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-black">{labelForStep(step.step_code)}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {step.provider || 'doctoleb'} · undo: {step.undo_strategy || 'none'} · attempts: {step.attempt_count ?? 0}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canRunStep(step) ? (
                  <SecondaryButton onClick={() => onRunStep?.(step)} disabled={runningStepId === step.id}>
                    {runningStepId === step.id ? 'Running...' : 'Run safe check'}
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
            {step.last_error_summary ? (
              <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{step.last_error_summary}</p>
            ) : null}
            <StepExternalActions step={step} />
          </div>
        ))}
        {orderedSteps.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No provisioning steps recorded yet.</p>
        ) : null}
      </div>
      {runMessage ? <p className="mt-4 rounded-2xl bg-cyan-50 p-4 text-sm font-bold text-cyan-800">{runMessage}</p> : null}
    </section>
  )
}
