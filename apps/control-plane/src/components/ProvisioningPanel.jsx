import { useState } from 'react'
import { DEFAULT_BRANDING, PLAN_OPTIONS } from '../data/saasCatalog'
import { controlPlaneApi } from '../lib/controlPlaneApi'
import { buildTenantBrandingDraft } from '../lib/tenantBrandingDrafts'
import {
  buildPendingTenantDomains,
  createClientRequestId,
  deriveTenantSlug,
  normalizeFirstDoctorAdminDraft,
  normalizeTenantSlug,
  validateFirstDoctorAdminDraft,
  validateProvisioningDraft,
} from '../lib/provisioningDrafts'
import {
  AUTOMATION_MODE_OPTIONS,
  filterAutomatableConnections,
  validateProvisioningProviderSelection,
} from '../lib/providerConnectionDrafts'
import {
  getNextProvisioningWizardStepId,
  getPreviousProvisioningWizardStepId,
  getProvisioningWizardStep,
  isLastProvisioningWizardStep,
} from '../lib/provisioningWizard'
import BrandPreviewCard from './BrandPreviewCard'
import ProvisioningWizardStepNav from './ProvisioningWizardStepNav'

const INPUT_CLASS = 'rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300'
const SECONDARY_BUTTON_CLASS = 'rounded-2xl border border-white/15 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50'
const PRIMARY_BUTTON_CLASS = 'rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50'

function WizardField({ label, children, help }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-200">
      <span>{label}</span>
      {children}
      {help ? <span className="text-xs text-slate-400">{help}</span> : null}
    </label>
  )
}

export default function ProvisioningPanel({ providerConnections = [], onCreated }) {
  const [activeWizardStep, setActiveWizardStep] = useState('clinic')
  const [requestedSlug, setRequestedSlug] = useState('')
  const [requestedDisplayName, setRequestedDisplayName] = useState('')
  const [firstDoctorDisplayName, setFirstDoctorDisplayName] = useState('')
  const [firstDoctorEmail, setFirstDoctorEmail] = useState('')
  const [firstDoctorPhone, setFirstDoctorPhone] = useState('')
  const [requestedPlan, setRequestedPlan] = useState('starter')
  const [automationMode, setAutomationMode] = useState('manual')
  const [supabaseConnectionId, setSupabaseConnectionId] = useState('')
  const [vercelConnectionId, setVercelConnectionId] = useState('')
  const [clientRequestId, setClientRequestId] = useState(() => createClientRequestId())
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const supabaseConnections = filterAutomatableConnections(providerConnections, 'supabase')
  const vercelConnections = filterAutomatableConnections(providerConnections, 'vercel')
  const activeStep = getProvisioningWizardStep(activeWizardStep)
  const isLastStep = isLastProvisioningWizardStep(activeWizardStep)
  const previewBranding = buildTenantBrandingDraft({
    tenant: { display_name: requestedDisplayName || DEFAULT_BRANDING.display_name },
    runtimeBranding: {
      appConfig: {
        app_name: requestedDisplayName || DEFAULT_BRANDING.app_name,
        app_tagline: DEFAULT_BRANDING.app_tagline,
        primary_color: DEFAULT_BRANDING.primary_color,
        secondary_color: DEFAULT_BRANDING.secondary_color,
      },
    },
  })

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

  function validateStep(stepId) {
    if (stepId === 'clinic') {
      return validateProvisioningDraft({ requestedSlug, requestedDisplayName, clientRequestId })
    }

    if (stepId === 'doctor') {
      return validateFirstDoctorAdminDraft(normalizeFirstDoctorAdminDraft({
        displayName: firstDoctorDisplayName,
        email: firstDoctorEmail,
        phone: firstDoctorPhone,
      }))
    }

    if (stepId === 'hosting') {
      return validateProvisioningProviderSelection({ automationMode, supabaseConnectionId, vercelConnectionId })
    }

    return validateProvisioningDraft({ requestedSlug, requestedDisplayName, clientRequestId })
      || validateFirstDoctorAdminDraft(normalizeFirstDoctorAdminDraft({
        displayName: firstDoctorDisplayName,
        email: firstDoctorEmail,
        phone: firstDoctorPhone,
      }))
      || validateProvisioningProviderSelection({ automationMode, supabaseConnectionId, vercelConnectionId })
  }

  function goNext() {
    const validationError = validateStep(activeWizardStep)
    if (validationError) {
      setMessage(validationError)
      return
    }

    setMessage('')
    setActiveWizardStep(getNextProvisioningWizardStepId(activeWizardStep))
  }

  function goBack() {
    setMessage('')
    setActiveWizardStep(getPreviousProvisioningWizardStepId(activeWizardStep))
  }

  async function createJob() {
    const firstDoctorAdmin = normalizeFirstDoctorAdminDraft({
      displayName: firstDoctorDisplayName,
      email: firstDoctorEmail,
      phone: firstDoctorPhone,
    })
    const validationError = validateProvisioningDraft({ requestedSlug, requestedDisplayName, clientRequestId })
      || validateFirstDoctorAdminDraft(firstDoctorAdmin)
      || validateProvisioningProviderSelection({ automationMode, supabaseConnectionId, vercelConnectionId })
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
      automationMode,
      supabaseConnectionId: supabaseConnectionId || null,
      vercelConnectionId: vercelConnectionId || null,
      firstDoctorAdmin,
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
      setFirstDoctorDisplayName('')
      setFirstDoctorEmail('')
      setFirstDoctorPhone('')
      setAutomationMode('manual')
      setSupabaseConnectionId('')
      setVercelConnectionId('')
      setActiveWizardStep('clinic')
      setClientRequestId(createClientRequestId())
      onCreated(result.data)
    }
  }

  function renderClinicStep() {
    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
          <WizardField label="Clinic name" help="Shown in the SaaS console and tenant app branding seed.">
            <input value={requestedDisplayName} onChange={(event) => updateDisplayName(event.target.value)} className={INPUT_CLASS} />
          </WizardField>
          <WizardField label="Slug" help="Used for future domains and tenant resolver identity.">
            <input value={requestedSlug} onChange={(event) => updateSlug(event.target.value)} className={INPUT_CLASS} />
          </WizardField>
          <WizardField label="Plan" help="Feature defaults can be adjusted later from the Features tab.">
            <select value={requestedPlan} onChange={(event) => updatePlan(event.target.value)} className={INPUT_CLASS}>
              {PLAN_OPTIONS.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
            </select>
          </WizardField>
        </div>
        <BrandPreviewCard branding={previewBranding} doctorName={firstDoctorDisplayName} />
      </div>
    )
  }

  function renderDoctorStep() {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <WizardField label="First doctor admin" help="This person owns the first clinic workspace login.">
          <input value={firstDoctorDisplayName} onChange={(event) => setFirstDoctorDisplayName(event.target.value)} className={INPUT_CLASS} />
        </WizardField>
        <WizardField label="First doctor email" help="Used for the first doctor/admin invite and login.">
          <input value={firstDoctorEmail} onChange={(event) => setFirstDoctorEmail(event.target.value)} className={INPUT_CLASS} />
        </WizardField>
        <WizardField label="First doctor phone" help="Optional. Keep PHI out of the control plane.">
          <input value={firstDoctorPhone} onChange={(event) => setFirstDoctorPhone(event.target.value)} className={INPUT_CLASS} />
        </WizardField>
      </div>
    )
  }

  function renderHostingStep() {
    return (
      <>
        <div className="grid gap-4 md:grid-cols-3">
          <WizardField label="Automation mode" help="Manual checklist works now without provider tokens or a purchased domain.">
            <select value={automationMode} onChange={(event) => setAutomationMode(event.target.value)} className={INPUT_CLASS}>
              {AUTOMATION_MODE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </WizardField>
          <WizardField label="Supabase provider" help="Required only for assisted or automatic provisioning.">
            <select value={supabaseConnectionId} onChange={(event) => setSupabaseConnectionId(event.target.value)} className={INPUT_CLASS}>
              <option value="">Manual / choose later</option>
              {supabaseConnections.map((connection) => (
                <option key={connection.id} value={connection.id}>{connection.display_name}</option>
              ))}
            </select>
          </WizardField>
          <WizardField label="Vercel provider" help="Shared DoctoLeb apps are valid until custom domains are purchased.">
            <select value={vercelConnectionId} onChange={(event) => setVercelConnectionId(event.target.value)} className={INPUT_CLASS}>
              <option value="">Shared DoctoLeb apps / choose later</option>
              {vercelConnections.map((connection) => (
                <option key={connection.id} value={connection.id}>{connection.display_name}</option>
              ))}
            </select>
          </WizardField>
        </div>
        <div className="mt-4 rounded-2xl bg-white/10 p-4 text-sm text-slate-300">
          <p className="font-black text-white">No purchased domain required now</p>
          <p className="mt-1 text-slate-400">
            The tenant can go online through Vercel/free-host aliases and the shared patient/ops apps. Real DoctoLeb or clinic-owned domains stay pending until ownership, DNS, and SSL are verified.
          </p>
        </div>
      </>
    )
  }

  function renderReviewStep() {
    const domains = buildPendingTenantDomains(requestedSlug)
    const firstDoctorAdmin = normalizeFirstDoctorAdminDraft({
      displayName: firstDoctorDisplayName,
      email: firstDoctorEmail,
      phone: firstDoctorPhone,
    })

    return (
      <div className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Tenant</p>
            <p className="mt-2 font-black text-white">{requestedDisplayName || 'Missing clinic name'}</p>
            <p className="text-sm text-slate-400">{requestedSlug || 'missing-slug'} · {requestedPlan}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">First doctor</p>
            <p className="mt-2 font-black text-white">{firstDoctorAdmin.displayName || 'Missing doctor name'}</p>
            <p className="text-sm text-slate-400">{firstDoctorAdmin.email || 'missing email'}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Mode</p>
            <p className="mt-2 font-black text-white">{automationMode}</p>
            <p className="text-sm text-slate-400">Undoable provisioning ledger will be created.</p>
          </div>
        </div>
        <BrandPreviewCard branding={previewBranding} doctorName={firstDoctorAdmin.displayName} />
        {domains.length > 0 ? (
          <div className="rounded-2xl bg-white/10 p-4 text-sm text-slate-300">
            <p className="font-black text-white">Pending routing rows</p>
            <p className="mb-2 text-xs text-slate-400">These are placeholders. They do not block Vercel/free-host launch.</p>
            {domains.map((domain) => (
              <p key={`${domain.surface}:${domain.hostname}`}>{domain.hostname} - {domain.surface}</p>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <section className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-sm">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">New doctor tenant</p>
      <h2 className="mt-2 text-2xl font-black">Guided tenant launch</h2>
      <p className="mt-2 text-sm text-slate-400">
        Create the SaaS tenant draft one decision group at a time. After creation, the console moves you to the readiness checklist until patient web, doctor web, and the future Flutter path are prepared.
      </p>
      <div className="mt-4 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-4 text-sm text-cyan-50">
        <p className="font-black">Separate from current tenant editing</p>
        <p className="mt-1 text-cyan-100/80">
          These steps create a new tenant draft only. Existing tenants are changed from the Tenant, Domains, Branding, Features, and Provisioning tabs.
        </p>
      </div>

      <ProvisioningWizardStepNav activeStepId={activeWizardStep} onStepChange={(stepId) => { setMessage(''); setActiveWizardStep(stepId) }} />

      <div
        role="tabpanel"
        id={`tenant-wizard-step-${activeStep.id}`}
        aria-labelledby={`tenant-wizard-tab-${activeStep.id}`}
        className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5"
      >
        <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Step {activeStep.number}</p>
        <h3 className="mt-2 text-xl font-black">{activeStep.title}</h3>
        <p className="mt-1 text-sm text-slate-400">{activeStep.description}</p>
        <div className="mt-5">
          {activeWizardStep === 'clinic' ? renderClinicStep() : null}
          {activeWizardStep === 'doctor' ? renderDoctorStep() : null}
          {activeWizardStep === 'hosting' ? renderHostingStep() : null}
          {activeWizardStep === 'review' ? renderReviewStep() : null}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {activeWizardStep !== 'clinic' ? <button type="button" onClick={goBack} className={SECONDARY_BUTTON_CLASS}>Back</button> : null}
        {!isLastStep ? (
          <button type="button" onClick={goNext} className={PRIMARY_BUTTON_CLASS}>Next step</button>
        ) : (
          <button type="button" onClick={createJob} disabled={saving} className={PRIMARY_BUTTON_CLASS}>
            {saving ? 'Creating...' : 'Create tenant draft'}
          </button>
        )}
        {message ? <p className="text-sm font-semibold text-slate-300">{message}</p> : null}
      </div>
    </section>
  )
}
