import { motion } from 'framer-motion'

export const CONTROL_PLANE_SECTIONS = Object.freeze([
  {
    id: 'tenant',
    label: 'Tenant',
    eyebrow: 'Core',
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
      className="sticky top-0 z-10 mb-8 border-b border-slate-200 bg-white"
    >
      <div className="flex items-center gap-1 overflow-x-auto" role="tablist">
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
              className={`relative flex flex-col gap-0.5 whitespace-nowrap px-4 py-3 text-left transition-colors focus:outline-none ${
                isActive ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span
                className={`font-mono text-[10px] uppercase tracking-wide transition-colors ${
                  isActive ? 'text-teal-600' : 'text-slate-400'
                }`}
              >
                {section.eyebrow}
              </span>
              <span className="text-sm font-semibold">{section.label}</span>
              {isActive && (
                <motion.span
                  layoutId="workspaceTabMarker"
                  transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                  className="absolute inset-x-0 bottom-[-1px] h-0.5 bg-teal-600"
                />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
