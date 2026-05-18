import { buildPendingTenantDomains, normalizeFirstDoctorAdminDraft } from '../../lib/provisioningDrafts'
import BrandPreviewCard from '../BrandPreviewCard'

function SummaryCard({ label, primary, secondary }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <p className="font-mono text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{primary}</p>
      <p className="mt-1 text-xs leading-snug text-slate-500">{secondary}</p>
    </div>
  )
}

export default function ProvisioningReviewStep({
  requestedSlug,
  requestedDisplayName,
  requestedPlan,
  automationMode,
  firstDoctorDisplayName,
  firstDoctorEmail,
  firstDoctorPhone,
  previewBranding,
}) {
  const domains = buildPendingTenantDomains(requestedSlug)
  const firstDoctorAdmin = normalizeFirstDoctorAdminDraft({
    displayName: firstDoctorDisplayName,
    email: firstDoctorEmail,
    phone: firstDoctorPhone,
  })

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard
          label="Tenant"
          primary={requestedDisplayName || 'Missing clinic name'}
          secondary={`${requestedSlug || 'missing-slug'} · ${requestedPlan}`}
        />
        <SummaryCard
          label="First doctor"
          primary={firstDoctorAdmin.displayName || 'Missing doctor name'}
          secondary={firstDoctorAdmin.email || 'missing email'}
        />
        <SummaryCard
          label="Mode"
          primary={automationMode.replaceAll('_', ' ')}
          secondary="Undoable provisioning ledger will be created."
        />
      </div>

      <BrandPreviewCard branding={previewBranding} doctorName={firstDoctorAdmin.displayName} />

      {domains.length > 0 ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Pending routing rows</p>
          <p className="mb-3 text-xs text-slate-500">
            These are placeholders. They do not block Vercel/free-host launch.
          </p>
          <ul className="flex flex-col gap-1">
            {domains.map((domain) => (
              <li key={`${domain.surface}:${domain.hostname}`} className="text-sm">
                <span className="font-mono font-medium text-slate-900">{domain.hostname}</span>{' '}
                <span className="text-slate-500">&mdash; {domain.surface}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
