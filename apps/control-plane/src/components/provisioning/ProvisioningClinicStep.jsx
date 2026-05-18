import { PLAN_OPTIONS } from '../../data/saasCatalog'
import BrandPreviewCard from '../BrandPreviewCard'
import { SelectInput, TextInput } from '../ui'
import WizardField from './WizardField'

export default function ProvisioningClinicStep({
  requestedDisplayName,
  requestedSlug,
  requestedPlan,
  firstDoctorDisplayName,
  previewBranding,
  onDisplayNameChange,
  onSlugChange,
  onPlanChange,
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
        <WizardField label="Clinic name" help="Shown in the SaaS console and tenant app branding seed.">
          <TextInput value={requestedDisplayName} onChange={(event) => onDisplayNameChange(event.target.value)} />
        </WizardField>
        <WizardField label="Slug" help="Used for future domains and tenant resolver identity.">
          <TextInput
            value={requestedSlug}
            onChange={(event) => onSlugChange(event.target.value)}
            className="font-mono"
          />
        </WizardField>
        <WizardField label="Plan" help="Feature defaults can be adjusted later from the Features tab.">
          <SelectInput value={requestedPlan} onChange={(event) => onPlanChange(event.target.value)}>
            {PLAN_OPTIONS.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </SelectInput>
        </WizardField>
      </div>
      <BrandPreviewCard branding={previewBranding} doctorName={firstDoctorDisplayName} />
    </div>
  )
}
