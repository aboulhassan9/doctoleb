import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  DEFAULT_PATIENT_ONBOARDING_DEFINITION,
  getPatientOnboardingFieldsForSection,
  getPatientOnboardingInitialForm,
  getPatientOnboardingSectionProgress,
} from '@core/lib/patientOnboarding';
import { usePatientOnboarding } from '@core/hooks/features/usePatientOnboarding';
import { PatientPortalShell } from '@ui/components/patient/PatientPortalShell';
import { PatientIntakeField } from '@ui/components/patient/PatientIntakeField';
import { PatientOnboardingStepper } from '@ui/components/patient/PatientOnboardingStepper';
import { patientEase, patientFadeRise, patientStagger } from '@ui/styles/patientMotion';

function normalizeNextRoute(value) {
  if (!value || !value.startsWith('/patient-')) return '/patient-dashboard';
  return value;
}

export default function PatientOnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { patient, intake, definition, loading, saving, error, saveGuidedIntake } = usePatientOnboarding(user);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeDefinition = definition || DEFAULT_PATIENT_ONBOARDING_DEFINITION;
  const sections = activeDefinition.sections || DEFAULT_PATIENT_ONBOARDING_DEFINITION.sections;
  const [form, setForm] = useState(() => getPatientOnboardingInitialForm({ user, definition: activeDefinition }));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loading) {
      setForm(getPatientOnboardingInitialForm({ user, patient, intake, definition: activeDefinition }));
    }
  }, [loading, user, patient, intake, activeDefinition]);

  const activeSection = sections[activeIndex] || sections[0];
  const activeFields = getPatientOnboardingFieldsForSection({
    definition: activeDefinition,
    sectionId: activeSection.id,
  });
  const isLastStep = activeIndex === sections.length - 1;
  const nextRoute = normalizeNextRoute(searchParams.get('next'));
  const sectionProgressById = Object.fromEntries(
    sections.map((section) => [
      section.id,
      getPatientOnboardingSectionProgress({ form, sectionId: section.id, definition: activeDefinition }),
    ])
  );
  const activeProgress = sectionProgressById[activeSection.id];
  const totalRequired = sections.reduce((sum, section) => {
    return sum + (sectionProgressById[section.id]?.requiredCount || 0);
  }, 0);
  const completedRequired = sections.reduce((sum, section) => {
    return sum + (sectionProgressById[section.id]?.completedRequiredCount || 0);
  }, 0);
  const totalPercent = totalRequired ? Math.round((completedRequired / totalRequired) * 100) : 0;

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSelectSection = (index) => {
    if (index <= activeIndex) {
      setActiveIndex(index);
      return;
    }

    if (index === activeIndex + 1 && activeProgress?.isRequiredComplete) {
      setActiveIndex(index);
      return;
    }

    showToast('Complete the required fields in this section before moving ahead.', 'error');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isLastStep) {
      setActiveIndex((index) => Math.min(index + 1, sections.length - 1));
      return;
    }

    const result = await saveGuidedIntake(form);
    if (result.error) {
      showToast(result.error, 'error');
      return;
    }

    setSaved(true);
    showToast('Your care profile is ready.', 'success');
  };

  if (saved) {
    return (
      <PatientPortalShell title="First-Visit Intake" subtitle="Your care profile is ready" width="narrow">
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: patientEase }}
            className="patient-paper-strong patient-surface relative overflow-hidden p-8"
          >
            <div aria-hidden="true" className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[color-mix(in_srgb,var(--patient-sage)_16%,transparent)] blur-3xl" />
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--patient-sage)]">Saved</p>
            <h1 className="patient-display mt-3 text-4xl font-medium tracking-tight text-[var(--patient-ink)]">
              Your clinic has the basics.
            </h1>
            <p className="mt-4 text-base leading-7 text-[var(--patient-muted)]">
              Doctors and predoctors can now see your clinical identity and first-visit safety notes before your appointment.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate(nextRoute)}
                className="patient-button-primary px-6 py-3"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={() => navigate('/patient-appointments')}
                className="patient-button-secondary px-6 py-3"
              >
                Book appointment
              </button>
            </div>
          </motion.section>
      </PatientPortalShell>
    );
  }

  return (
    <PatientPortalShell
      title="First-Visit Intake"
      subtitle="A guided profile for safer care"
      mainClassName="grid gap-8 lg:grid-cols-[0.85fr_1.4fr]"
    >
        <aside className="space-y-5 lg:sticky lg:top-40 lg:self-start">
          <motion.section
            variants={patientStagger}
            initial="hidden"
            animate="visible"
            className="patient-paper-strong patient-surface relative overflow-hidden p-6"
          >
            <motion.div variants={patientFadeRise}>
              <p className="patient-kicker">Care readiness</p>
              <h1 className="patient-display mt-3 text-4xl font-medium tracking-tight text-[var(--patient-ink)]">
                Build a profile the doctor can trust.
              </h1>
              <p className="mt-4 text-sm leading-6 text-[var(--patient-muted)]">
                One guided flow collects only the first-visit essentials. Later, each clinic can configure the same allowlisted fields without rewriting patient UI.
              </p>
            </motion.div>

            <motion.div variants={patientFadeRise} className="patient-hero-band mt-6 p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-white/60">Required progress</span>
                <span className="font-mono text-sm font-black tabular-nums">{totalPercent}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-[var(--patient-warning)]"
                  initial={false}
                  animate={{ width: `${totalPercent}%` }}
                  transition={{ duration: 0.65, ease: patientEase }}
                />
              </div>
              <p className="mt-3 text-xs font-semibold text-white/70">
                {completedRequired}/{totalRequired} required fields ready for booking.
              </p>
            </motion.div>
          </motion.section>

          <PatientOnboardingStepper
            sections={sections}
            activeSection={activeSection.id}
            sectionProgressById={sectionProgressById}
            onSelectSection={handleSelectSection}
          />
        </aside>

        <AnimatePresence mode="wait">
          <motion.form
            key={activeSection.id}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.42, ease: patientEase }}
            onSubmit={handleSubmit}
            className="patient-paper-strong patient-surface overflow-hidden"
          >
            <div className="patient-hero-band rounded-none p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--patient-warning)]">{activeSection.eyebrow}</p>
                  <h2 className="patient-display mt-2 text-4xl font-medium tracking-tight">{activeSection.title}</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">{activeSection.description}</p>
                </div>
                <div className="rounded-[18px_4px_18px_4px] border border-white/10 bg-white/5 px-4 py-3">
                  <p className="font-mono text-2xl font-black tabular-nums">{activeProgress?.completedRequiredCount || 0}/{activeProgress?.requiredCount || 0}</p>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50">required</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {error && (
                <div role="alert" className="mb-5 rounded-[18px_4px_18px_4px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {error}
                </div>
              )}

              {loading ? (
                <p className="patient-inset px-4 py-6 text-sm font-semibold text-[var(--patient-muted)]">Loading your profile...</p>
              ) : (
                <motion.div variants={patientStagger} initial="hidden" animate="visible" className="grid gap-5 md:grid-cols-2">
                  {activeFields.map((field) => (
                    <motion.div key={field.key} variants={patientFadeRise} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                      <PatientIntakeField
                        field={field}
                        value={form[field.key]}
                        onChange={updateField}
                        disabled={saving}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              )}

              <div className="patient-divider mt-8 flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-between">
                <button
                  type="button"
                  onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
                  disabled={activeIndex === 0 || saving}
                  className="patient-button-secondary px-5 py-3 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || saving}
                  className="patient-button-primary px-6 py-3 disabled:cursor-not-allowed disabled:bg-[var(--patient-disabled)]"
                >
                  {saving ? 'Saving...' : isLastStep ? 'Save care profile' : 'Continue'}
                </button>
              </div>
            </div>
          </motion.form>
        </AnimatePresence>
    </PatientPortalShell>
  );
}
