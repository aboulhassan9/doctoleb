import { PROVISIONING_WIZARD_STEPS } from '../lib/provisioningWizard'

export default function ProvisioningWizardStepNav({ activeStepId, unlockedStepIndex = 0, onStepChange }) {
  return (
    <nav aria-label="New tenant creation steps" className="mt-6">
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
                  'min-h-full w-full rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
                  isActive
                    ? 'border-cyan-300 bg-cyan-300 text-slate-950'
                    : 'border-white/10 bg-white/10 text-slate-300 hover:border-white/25 hover:bg-white/15',
                  isLocked ? 'cursor-not-allowed opacity-45 hover:border-white/10 hover:bg-white/10' : '',
                ].join(' ')}
              >
                <span className="block text-xs font-black uppercase tracking-[0.2em] opacity-70">Step {step.number}</span>
                <span className="mt-1 block text-sm font-black">{step.label}</span>
                {isLocked ? <span className="mt-1 block text-xs font-semibold opacity-75">Complete previous steps first.</span> : null}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
