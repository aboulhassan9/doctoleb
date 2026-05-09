export const PROVISIONING_WIZARD_STEPS = Object.freeze([
  {
    id: 'clinic',
    number: 1,
    label: 'Clinic',
    title: 'Clinic identity',
    description: 'Name the tenant, choose the plan, and confirm the generated slug.',
  },
  {
    id: 'doctor',
    number: 2,
    label: 'Doctor',
    title: 'First doctor setup',
    description: 'Capture the first doctor account that will own the clinic workspace.',
  },
  {
    id: 'hosting',
    number: 3,
    label: 'Hosting',
    title: 'No-domain hosting path',
    description: 'Use shared Vercel/free-host routing now; real domains remain pending until purchased.',
  },
  {
    id: 'review',
    number: 4,
    label: 'Review',
    title: 'Create tenant draft',
    description: 'Create the reversible draft and move to the readiness checklist.',
  },
])

export function getProvisioningWizardStepIndex(stepId) {
  const index = PROVISIONING_WIZARD_STEPS.findIndex((step) => step.id === stepId)
  return index >= 0 ? index : 0
}

export function getProvisioningWizardStep(stepId) {
  return PROVISIONING_WIZARD_STEPS[getProvisioningWizardStepIndex(stepId)]
}

export function getNextProvisioningWizardStepId(stepId) {
  const index = getProvisioningWizardStepIndex(stepId)
  return PROVISIONING_WIZARD_STEPS[Math.min(index + 1, PROVISIONING_WIZARD_STEPS.length - 1)].id
}

export function getPreviousProvisioningWizardStepId(stepId) {
  const index = getProvisioningWizardStepIndex(stepId)
  return PROVISIONING_WIZARD_STEPS[Math.max(index - 1, 0)].id
}

export function isLastProvisioningWizardStep(stepId) {
  return getProvisioningWizardStepIndex(stepId) === PROVISIONING_WIZARD_STEPS.length - 1
}
