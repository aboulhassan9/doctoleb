export const CONTROL_PLANE_SECTIONS = Object.freeze([
  {
    id: 'tenant',
    label: 'Tenant',
    eyebrow: 'Core controls',
    description: 'Status, plan, and runtime routing metadata.',
  },
  {
    id: 'domains',
    label: 'Domains',
    eyebrow: 'Routing',
    description: 'Placeholder-safe host, DNS, and SSL readiness.',
  },
  {
    id: 'provisioning',
    label: 'Provisioning',
    eyebrow: 'Readiness',
    description: 'Run, retry, cancel, and compensate tenant setup steps.',
  },
  {
    id: 'branding',
    label: 'Branding',
    eyebrow: 'Theme',
    description: 'Tenant name, logo, colors, and support identity.',
  },
  {
    id: 'features',
    label: 'Features',
    eyebrow: 'Entitlements',
    description: 'Plan-based feature access and manual overrides.',
  },
  {
    id: 'audit',
    label: 'Audit',
    eyebrow: 'History',
    description: 'Recent zero-PHI SaaS events for this tenant.',
  },
])

export function getControlPlaneSection(sectionId) {
  return CONTROL_PLANE_SECTIONS.find((section) => section.id === sectionId) || CONTROL_PLANE_SECTIONS[0]
}

export default function ConsoleWorkspaceTabs({ activeSection, onSectionChange }) {
  return (
    <nav
      aria-label="Control plane workspace sections"
      className="sticky top-[73px] z-20 border-b border-slate-200/70 bg-[#eef5f2]/95 py-3 backdrop-blur-xl"
    >
      <div role="tablist" aria-label="Control plane sections" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        {CONTROL_PLANE_SECTIONS.map((section) => {
          const isActive = section.id === activeSection

          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`control-plane-section-${section.id}`}
              id={`control-plane-tab-${section.id}`}
              onClick={() => onSectionChange(section.id)}
              className={[
                'rounded-2xl px-3 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2',
                isActive
                  ? 'bg-slate-950 text-white shadow-lg shadow-slate-950/10'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-950',
              ].join(' ')}
            >
              <span className="block text-[11px] font-black uppercase tracking-[0.22em] opacity-70">{section.eyebrow}</span>
              <span className="mt-1 block text-sm font-black">{section.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
