import { AUTOMATION_MODE_OPTIONS } from '../../lib/providerConnectionDrafts'
import { INPUT_CLASS } from './styles'
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
        <WizardField label="Automation mode" help="Manual checklist works now without provider tokens or a purchased domain.">
          <select value={automationMode} onChange={(event) => onAutomationModeChange(event.target.value)} className={INPUT_CLASS}>
            {AUTOMATION_MODE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </WizardField>
        <WizardField label="Supabase provider" help="Required only for assisted or automatic provisioning.">
          <select value={supabaseConnectionId} onChange={(event) => onSupabaseConnectionChange(event.target.value)} className={INPUT_CLASS}>
            <option value="">Manual / choose later</option>
            {supabaseConnections.map((connection) => (
              <option key={connection.id} value={connection.id}>{connection.display_name}</option>
            ))}
          </select>
        </WizardField>
        <WizardField label="Vercel provider" help="Shared DoctoLeb apps are valid until custom domains are purchased.">
          <select value={vercelConnectionId} onChange={(event) => onVercelConnectionChange(event.target.value)} className={INPUT_CLASS}>
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
