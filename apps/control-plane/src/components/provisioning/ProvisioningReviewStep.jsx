import { buildPendingTenantDomains, normalizeFirstDoctorAdminDraft } from '../../lib/provisioningDrafts'
import BrandPreviewCard from '../BrandPreviewCard'

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
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-white/10 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Tenant</p>
          <p className="mt-2 font-black text-white">{requestedDisplayName || 'Missing clinic name'}</p>
          <p className="text-sm text-slate-400">{requestedSlug || 'missing-slug'} · {requestedPlan}</p>
        </div>
        <div className="rounded-2xl bg-white/10 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">First doctor</p>
          <p className="mt-2 font-black text-white">{firstDoctorAdmin.displayName || 'Missing doctor name'}</p>
          <p className="text-sm text-slate-400">{firstDoctorAdmin.email || 'missing email'}</p>
        </div>
        <div className="rounded-2xl bg-white/10 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Mode</p>
          <p className="mt-2 font-black text-white">{automationMode}</p>
          <p className="text-sm text-slate-400">Undoable provisioning ledger will be created.</p>
        </div>
      </div>
      <BrandPreviewCard branding={previewBranding} doctorName={firstDoctorAdmin.displayName} />
      {domains.length > 0 ? (
        <div className="rounded-2xl bg-white/10 p-4 text-sm text-slate-300">
          <p className="font-black text-white">Pending routing rows</p>
          <p className="mb-2 text-xs text-slate-400">These are placeholders. They do not block Vercel/free-host launch.</p>
          {domains.map((domain) => (
            <p key={`${domain.surface}:${domain.hostname}`}>{domain.hostname} - {domain.surface}</p>
          ))}
        </div>
      ) : null}
    </div>
  )
}
