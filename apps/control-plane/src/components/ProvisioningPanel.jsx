import { useState } from 'react'
import { DEFAULT_BRANDING } from '../data/saasCatalog'
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
  filterAutomatableConnections,
  validateProvisioningProviderSelection,
} from '../lib/providerConnectionDrafts'
import {
  getNextProvisioningWizardStepId,
  getPreviousProvisioningWizardStepId,
  getProvisioningWizardStep,
  isLastProvisioningWizardStep,
} from '../lib/provisioningWizard'
import ProvisioningClinicStep from './provisioning/ProvisioningClinicStep'
import ProvisioningDoctorStep from './provisioning/ProvisioningDoctorStep'
import ProvisioningHostingStep from './provisioning/ProvisioningHostingStep'
import ProvisioningReviewStep from './provisioning/ProvisioningReviewStep'
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from './provisioning/styles'
import ProvisioningWizardStepNav from './ProvisioningWizardStepNav'

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
          {activeWizardStep === 'clinic' ? (
            <ProvisioningClinicStep
              requestedDisplayName={requestedDisplayName}
              requestedSlug={requestedSlug}
              requestedPlan={requestedPlan}
              firstDoctorDisplayName={firstDoctorDisplayName}
              previewBranding={previewBranding}
              onDisplayNameChange={updateDisplayName}
              onSlugChange={updateSlug}
              onPlanChange={updatePlan}
            />
          ) : null}
          {activeWizardStep === 'doctor' ? (
            <ProvisioningDoctorStep
              firstDoctorDisplayName={firstDoctorDisplayName}
              firstDoctorEmail={firstDoctorEmail}
              firstDoctorPhone={firstDoctorPhone}
              onFirstDoctorDisplayNameChange={setFirstDoctorDisplayName}
              onFirstDoctorEmailChange={setFirstDoctorEmail}
              onFirstDoctorPhoneChange={setFirstDoctorPhone}
            />
          ) : null}
          {activeWizardStep === 'hosting' ? (
            <ProvisioningHostingStep
              automationMode={automationMode}
              supabaseConnectionId={supabaseConnectionId}
              vercelConnectionId={vercelConnectionId}
              supabaseConnections={supabaseConnections}
              vercelConnections={vercelConnections}
              onAutomationModeChange={setAutomationMode}
              onSupabaseConnectionChange={setSupabaseConnectionId}
              onVercelConnectionChange={setVercelConnectionId}
            />
          ) : null}
          {activeWizardStep === 'review' ? (
            <ProvisioningReviewStep
              requestedSlug={requestedSlug}
              requestedDisplayName={requestedDisplayName}
              requestedPlan={requestedPlan}
              automationMode={automationMode}
              firstDoctorDisplayName={firstDoctorDisplayName}
              firstDoctorEmail={firstDoctorEmail}
              firstDoctorPhone={firstDoctorPhone}
              previewBranding={previewBranding}
            />
          ) : null}
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
