import { DEFAULT_BRANDING } from '../data/saasCatalog'

function safeBranding(branding = {}) {
  return {
    ...DEFAULT_BRANDING,
    ...branding,
    display_name: branding.display_name || DEFAULT_BRANDING.display_name,
    app_name: branding.app_name || branding.display_name || DEFAULT_BRANDING.app_name,
    app_tagline: branding.app_tagline || DEFAULT_BRANDING.app_tagline,
    primary_color: branding.primary_color || DEFAULT_BRANDING.primary_color,
    secondary_color: branding.secondary_color || DEFAULT_BRANDING.secondary_color,
  }
}

function LogoMark({ branding }) {
  const initials =
    branding.app_name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'DL'

  if (branding.splash_logo_url) {
    return (
      <img
        src={branding.splash_logo_url}
        alt={`${branding.app_name} logo preview`}
        className="h-10 w-10 rounded-md object-cover ring-1 ring-black/10"
      />
    )
  }

  return (
    <div
      className="grid h-10 w-10 place-items-center rounded-md text-sm font-semibold text-white"
      style={{ backgroundColor: branding.primary_color }}
      aria-label={`${branding.app_name} logo initials preview`}
    >
      {initials}
    </div>
  )
}

export default function BrandPreviewCard({ branding: inputBranding, doctorName = '', className = '' }) {
  const branding = safeBranding(inputBranding)
  const visibleDoctorName = doctorName || branding.display_name

  return (
    <aside className={`rounded-lg border border-slate-200 bg-white p-5 text-slate-900 ${className}`}>
      <p className="font-mono text-[10px] font-medium uppercase tracking-wide text-slate-400">Tenant app preview</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-md border border-slate-200">
          <div className="p-4" style={{ backgroundColor: branding.secondary_color }}>
            <div className="flex items-center gap-3">
              <LogoMark branding={branding} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{branding.app_name}</p>
                <p className="truncate text-xs text-white/80">Patient portal preview</p>
              </div>
            </div>
            <h3 className="mt-5 text-lg font-semibold leading-tight text-white">
              Book care with {visibleDoctorName}
            </h3>
            <p className="mt-1.5 text-sm leading-snug text-white/80">{branding.app_tagline}</p>
          </div>
          <div className="grid gap-2 p-4 text-sm font-medium">
            <div className="rounded-md bg-slate-100 px-3 py-2 text-slate-700">Appointments</div>
            <div className="rounded-md bg-slate-100 px-3 py-2 text-slate-700">Messages</div>
            <div className="rounded-md bg-slate-100 px-3 py-2 text-slate-700">Clinic documents</div>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-slate-200">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <LogoMark branding={branding} />
              <div>
                <p className="text-sm font-semibold text-slate-900">{branding.display_name}</p>
                <p className="text-xs text-slate-500">Doctor workspace preview</p>
              </div>
            </div>
            <span
              className="rounded-md px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-white"
              style={{ backgroundColor: branding.primary_color }}
            >
              Live
            </span>
          </div>
          <div className="grid gap-3 p-4">
            {['Today schedule', 'Patient queue', 'Clinical notes'].map((label) => (
              <div key={label} className="rounded-md border border-slate-200 p-3">
                <div className="h-1.5 w-16 rounded-full" style={{ backgroundColor: branding.primary_color }} />
                <p className="mt-2 text-sm font-semibold text-slate-900">{label}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">Runtime brand applies without redeploy.</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}
