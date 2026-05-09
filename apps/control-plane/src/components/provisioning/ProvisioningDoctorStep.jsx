import { INPUT_CLASS } from './styles'
import WizardField from './WizardField'

export default function ProvisioningDoctorStep({
  firstDoctorDisplayName,
  firstDoctorEmail,
  firstDoctorPhone,
  onFirstDoctorDisplayNameChange,
  onFirstDoctorEmailChange,
  onFirstDoctorPhoneChange,
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <WizardField label="First doctor admin" help="This person owns the first clinic workspace login.">
        <input value={firstDoctorDisplayName} onChange={(event) => onFirstDoctorDisplayNameChange(event.target.value)} className={INPUT_CLASS} />
      </WizardField>
      <WizardField label="First doctor email" help="Used for the first doctor/admin invite and login.">
        <input value={firstDoctorEmail} onChange={(event) => onFirstDoctorEmailChange(event.target.value)} className={INPUT_CLASS} />
      </WizardField>
      <WizardField label="First doctor phone" help="Optional. Keep PHI out of the control plane.">
        <input value={firstDoctorPhone} onChange={(event) => onFirstDoctorPhoneChange(event.target.value)} className={INPUT_CLASS} />
      </WizardField>
    </div>
  )
}
