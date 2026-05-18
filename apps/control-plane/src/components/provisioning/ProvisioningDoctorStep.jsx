import { TextInput } from '../ui'
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
        <TextInput
          value={firstDoctorDisplayName}
          onChange={(event) => onFirstDoctorDisplayNameChange(event.target.value)}
        />
      </WizardField>
      <WizardField label="First doctor email" help="Used for the first doctor/admin invite and login.">
        <TextInput
          type="email"
          value={firstDoctorEmail}
          onChange={(event) => onFirstDoctorEmailChange(event.target.value)}
        />
      </WizardField>
      <WizardField label="First doctor phone" help="Optional. Keep PHI out of the control plane.">
        <TextInput value={firstDoctorPhone} onChange={(event) => onFirstDoctorPhoneChange(event.target.value)} />
      </WizardField>
    </div>
  )
}
