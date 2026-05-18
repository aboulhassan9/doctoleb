import { AUTOMATION_MODE_OPTIONS } from '../../lib/providerConnectionDrafts'
import { SelectInput } from '../ui'
import WizardField from './WizardField'

export default function ProvisioningHostingStep({
  automationMode,
  supabaseConnectionId,
  vercelConnectionId,
  supabaseConnections,
  vercelConnections,
  onAutomationModeChange,
  onSupabaseConnectionChange,
  onVercelConnectionChange,
}) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <WizardField
          label="Automation mode"
          help="Manual checklist works now without provider tokens or a purchased domain."
        >
          <SelectInput value={automationMode} onChange={(event) => onAutomationModeChange(event.target.value)}>
            {AUTOMATION_MODE_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </SelectInput>
        </WizardField>
        <WizardField label="Supabase provider" help="Required only for assisted or automatic provisioning.">
          <SelectInput
            value={supabaseConnectionId}
            onChange={(event) => onSupabaseConnectionChange(event.target.value)}
          >
            <option value="">Manual / choose later</option>
            {supabaseConnections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.display_name}
              </option>
            ))}
          </SelectInput>
        </WizardField>
        <WizardField label="Vercel provider" help="Shared DoctoLeb apps are valid until custom domains are purchased.">
          <SelectInput value={vercelConnectionId} onChange={(event) => onVercelConnectionChange(event.target.value)}>
            <option value="">Shared DoctoLeb apps / choose later</option>
            {vercelConnections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.display_name}
              </option>
            ))}
          </SelectInput>
        </WizardField>
      </div>
      <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">No purchased domain required now</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          The tenant can go online through Vercel/free-host aliases and the shared patient/ops apps. Real DoctoLeb or
          clinic-owned domains stay pending until ownership, DNS, and SSL are verified.
        </p>
      </div>
    </>
  )
}
