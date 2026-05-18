import { motion } from 'framer-motion';
import { BadgeHelp, CheckCircle2, ClipboardPlus, IdCard, LifeBuoy, ShieldAlert } from 'lucide-react';
import { patientEase } from '../../styles/patientMotion.js';

const ICONS = {
  'badge-help': BadgeHelp,
  'clipboard-plus': ClipboardPlus,
  'id-card': IdCard,
  'life-buoy': LifeBuoy,
  'shield-alert': ShieldAlert,
};

export function PatientOnboardingStepper({
  sections = [],
  activeSection = 'identity',
  sectionProgressById = {},
  onSelectSection,
}) {
  const activeIndex = Math.max(0, sections.findIndex((section) => section.id === activeSection));

  return (
    <ol className="grid gap-3" aria-label="Patient onboarding steps">
      {sections.map((section, index) => {
        const Icon = ICONS[section.icon] || BadgeHelp;
        const isActive = section.id === activeSection;
        const isDone = index < activeIndex;
        const progress = sectionProgressById[section.id];
        const completed = progress?.completedRequiredCount ?? 0;
        const total = progress?.requiredCount ?? 0;
        const percent = total ? Math.round((completed / total) * 100) : isDone ? 100 : 0;

        return (
          <li key={section.id}>
            <button
              type="button"
              onClick={() => onSelectSection?.(index)}
              disabled={!onSelectSection}
              className={`patient-focus group relative w-full overflow-hidden rounded-[18px_4px_18px_4px] border p-4 text-left transition duration-300 disabled:cursor-default ${
                isActive
                  ? 'border-[color-mix(in_srgb,var(--patient-sage)_40%,transparent)] bg-[var(--patient-surface)] text-[var(--patient-ink)] shadow-sm'
                  : isDone
                    ? 'border-[color-mix(in_srgb,var(--patient-sage)_32%,var(--patient-surface))] bg-[color-mix(in_srgb,var(--patient-success)_70%,transparent)] text-[var(--patient-sage)]'
                    : 'border-[color-mix(in_srgb,var(--patient-outline)_70%,transparent)] bg-[color-mix(in_srgb,var(--patient-surface)_70%,transparent)] text-[var(--patient-muted)] hover:bg-[var(--patient-surface)]'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[16px_4px_16px_4px] transition ${
                  isActive
                    ? 'bg-[var(--patient-sage)] text-white'
                    : isDone
                      ? 'bg-[var(--patient-sage)] text-white'
                      : 'bg-[var(--patient-wash)] text-[var(--patient-muted)] group-hover:text-[var(--patient-sage)]'
                }`}>
                  {isDone ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-black uppercase tracking-[0.18em]">{section.eyebrow}</span>
                  <span className="patient-display mt-1 block text-xl font-medium tracking-tight">{section.shortTitle || section.title}</span>
                  {total > 0 && (
                    <span className="mt-2 block text-xs font-bold text-[color-mix(in_srgb,var(--patient-muted)_75%,transparent)]">
                      {completed}/{total} required fields
                    </span>
                  )}
                </span>
              </div>

              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--patient-disabled)]">
                <motion.div
                  className={`h-full rounded-full ${isDone || percent === 100 ? 'bg-[var(--patient-sage)]' : 'bg-[var(--patient-clay)]'}`}
                  initial={false}
                  animate={{ width: `${percent}%` }}
                  transition={{ duration: 0.45, ease: patientEase }}
                />
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
