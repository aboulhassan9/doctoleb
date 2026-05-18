import { PROVISIONING_WIZARD_STEPS } from '../lib/provisioningWizard'

export default function ProvisioningWizardStepNav({ activeStepId, unlockedStepIndex = 0, onStepChange }) {
  return (
    <nav aria-label="New tenant creation steps">
      <ol className="grid gap-2 md:grid-cols-4">
        {PROVISIONING_WIZARD_STEPS.map((step, index) => {
          const isActive = step.id === activeStepId
          const isLocked = index > unlockedStepIndex

          return (
            <li key={step.id}>
              <button
                type="button"
                aria-current={isActive ? 'step' : undefined}
                aria-disabled={isLocked}
                disabled={isLocked}
                onClick={() => onStepChange(step.id)}
                className={[
                  'min-h-full w-full rounded-md border px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40',
                  isActive
                    ? 'border-teal-600 bg-teal-50 text-slate-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
                  isLocked ? 'cursor-not-allowed bg-slate-50 text-slate-400 opacity-70 hover:border-slate-200 hover:bg-slate-50' : '',
                ].join(' ')}
              >
                <span
                  className={`block font-mono text-[10px] uppercase tracking-wide ${
                    isActive ? 'text-teal-600' : 'text-slate-400'
                  }`}
                >
                  Step {step.number}
                </span>
                <span className="mt-1 block text-sm font-semibold">{step.label}</span>
                {isLocked ? (
                  <span className="mt-1 block text-xs text-slate-400">Complete previous steps first.</span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
