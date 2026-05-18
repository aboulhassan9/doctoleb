import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  getProvisioningWizardStepIndex,
  getNextProvisioningWizardStepId,
  getPreviousProvisioningWizardStepId,
  getProvisioningWizardStep,
  isLastProvisioningWizardStep,
} from '../lib/provisioningWizard'
import ProvisioningClinicStep from './provisioning/ProvisioningClinicStep'
import ProvisioningDoctorStep from './provisioning/ProvisioningDoctorStep'
import ProvisioningHostingStep from './provisioning/ProvisioningHostingStep'
import ProvisioningReviewStep from './provisioning/ProvisioningReviewStep'
import ProvisioningWizardStepNav from './ProvisioningWizardStepNav'
import { Button, FormMessage } from './ui'

export default function ProvisioningPanel({ providerConnections = [], onCreated }) {
  const [activeWizardStep, setActiveWizardStep] = useState('clinic')
  const [unlockedWizardStepIndex, setUnlockedWizardStepIndex] = useState(0)
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
      return validateFirstDoctorAdminDraft(
        normalizeFirstDoctorAdminDraft({
          displayName: firstDoctorDisplayName,
          email: firstDoctorEmail,
          phone: firstDoctorPhone,
        }),
      )
    }

    if (stepId === 'hosting') {
      return validateProvisioningProviderSelection({ automationMode, supabaseConnectionId, vercelConnectionId })
    }

    return (
      validateProvisioningDraft({ requestedSlug, requestedDisplayName, clientRequestId }) ||
      validateFirstDoctorAdminDraft(
        normalizeFirstDoctorAdminDraft({
          displayName: firstDoctorDisplayName,
          email: firstDoctorEmail,
          phone: firstDoctorPhone,
        }),
      ) ||
      validateProvisioningProviderSelection({ automationMode, supabaseConnectionId, vercelConnectionId })
    )
  }

  function goNext() {
    const validationError = validateStep(activeWizardStep)
    if (validationError) {
      setMessage(validationError)
      return
    }

    setMessage('')
    const nextStepId = getNextProvisioningWizardStepId(activeWizardStep)
    setUnlockedWizardStepIndex((current) => Math.max(current, getProvisioningWizardStepIndex(nextStepId)))
    setActiveWizardStep(nextStepId)
  }

  function goBack() {
    setMessage('')
    setActiveWizardStep(getPreviousProvisioningWizardStepId(activeWizardStep))
  }

  function goToUnlockedStep(stepId) {
    const requestedIndex = getProvisioningWizardStepIndex(stepId)
    if (requestedIndex > unlockedWizardStepIndex) {
      setMessage('Complete previous steps before opening this step.')
      return
    }

    setMessage('')
    setActiveWizardStep(stepId)
  }

  async function createJob() {
    const firstDoctorAdmin = normalizeFirstDoctorAdminDraft({
      displayName: firstDoctorDisplayName,
      email: firstDoctorEmail,
      phone: firstDoctorPhone,
    })
    const validationError =
      validateProvisioningDraft({ requestedSlug, requestedDisplayName, clientRequestId }) ||
      validateFirstDoctorAdminDraft(firstDoctorAdmin) ||
      validateProvisioningProviderSelection({ automationMode, supabaseConnectionId, vercelConnectionId })
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
      setUnlockedWizardStepIndex(0)
      setClientRequestId(createClientRequestId())
      onCreated(result.data)
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-900">
      <div className="border-b border-slate-800 bg-slate-950 px-6 py-7 md:px-8">
        <h2 className="text-xl font-semibold tracking-tight text-white">Guided tenant launch</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
          Create the SaaS tenant draft one decision group at a time. After creation, the console moves you to the
          readiness checklist until patient web, doctor web, and the future Flutter path are prepared.
        </p>
      </div>

      <div className="p-6 md:p-8">
        <ProvisioningWizardStepNav
          activeStepId={activeWizardStep}
          unlockedStepIndex={unlockedWizardStepIndex}
          onStepChange={goToUnlockedStep}
        />

        <div
          role="region"
          id={`tenant-wizard-step-${activeStep.id}`}
          aria-labelledby={`tenant-wizard-heading-${activeStep.id}`}
          className="mt-8"
        >
          <div className="mb-5">
            <h3 id={`tenant-wizard-heading-${activeStep.id}`} className="text-base font-semibold tracking-tight text-slate-900">
              {activeStep.title}
            </h3>
            <p className="mt-1 text-sm text-slate-500">{activeStep.description}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeWizardStep}
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              >
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
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
        <div>
          {activeWizardStep !== 'clinic' ? (
            <Button variant="secondary" onClick={goBack}>
              Back
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {message ? (
            <FormMessage tone={message.includes('created') ? 'success' : 'error'}>{message}</FormMessage>
          ) : null}
          {!isLastStep ? (
            <Button onClick={goNext}>Next Step</Button>
          ) : (
            <Button onClick={createJob} disabled={saving}>
              {saving ? 'Creating...' : 'Create Tenant Draft'}
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
