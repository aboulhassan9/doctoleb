import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { patientEase } from '../../styles/patientMotion.js';

function formatMissingLabel(field, status) {
  const itemLabel = status?.readinessItems?.find((item) => item.key === field)?.label;
  if (itemLabel) return itemLabel;

  const labels = {
    date_of_birth: 'Date of birth',
    sex: 'Clinical sex',
    intake: 'First-visit intake',
  };
  return labels[field] || field.replace(/_/g, ' ');
}

function ReadinessSkeleton() {
  return (
    <section className="patient-paper patient-surface overflow-hidden p-6" aria-busy="true">
      <div className="h-3 w-36 animate-pulse rounded-full bg-slate-200" />
      <div className="mt-5 h-8 w-2/3 animate-pulse rounded-full bg-slate-200" />
      <div className="mt-4 h-3 w-full animate-pulse rounded-full bg-slate-100" />
      <div className="mt-2 h-3 w-4/5 animate-pulse rounded-full bg-slate-100" />
    </section>
  );
}

export function PatientReadinessCard({ status, loading = false, onContinue, onBook }) {
  if (loading) return <ReadinessSkeleton />;

  const complete = Boolean(status?.isComplete);
  const missing = status?.missingRequiredFields || [];
  const percent = status?.completionPercent ?? (complete ? 100 : 0);
  const Icon = complete ? CheckCircle2 : AlertTriangle;
  const primaryAction = complete ? onBook : onContinue;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: patientEase }}
      className={`patient-paper patient-surface group relative isolate overflow-hidden p-6 transition duration-300 hover:-translate-y-0.5 ${
        complete
          ? 'bg-[linear-gradient(135deg,var(--patient-success),color-mix(in_srgb,var(--patient-surface)_92%,transparent))]'
          : 'bg-[linear-gradient(135deg,var(--patient-warning),color-mix(in_srgb,var(--patient-surface)_92%,transparent))]'
      }`}
    >
      <div
        aria-hidden="true"
        className={`absolute -right-20 -top-24 h-56 w-56 rounded-full blur-3xl transition duration-500 group-hover:scale-110 ${
          complete ? 'bg-[color-mix(in_srgb,var(--patient-sage)_18%,transparent)]' : 'bg-[color-mix(in_srgb,var(--patient-warning)_50%,transparent)]'
        }`}
      />

      <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`grid h-11 w-11 place-items-center rounded-[16px_4px_16px_4px] ${
              complete ? 'bg-[var(--patient-sage)] text-white' : 'bg-[var(--patient-clay)] text-white'
            }`}>
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className={`text-[11px] font-black uppercase tracking-[0.18em] ${
                complete ? 'text-[var(--patient-sage)]' : 'text-[var(--patient-clay)]'
              }`}>
                First-visit readiness
              </p>
              <h2 className="patient-display mt-1 text-3xl font-medium tracking-tight text-[var(--patient-ink)]">
                {complete ? 'Your care profile is ready.' : 'Finish the safety basics before booking.'}
              </h2>
            </div>
          </div>

          <div className="mt-5 max-w-3xl">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-bold text-[var(--patient-muted)]">
                {complete
                  ? 'Doctors and predoctors can see the essentials they need before your visit.'
                  : 'This protects the booking flow from missing clinical identity or first-visit safety notes.'}
              </p>
              <span className="shrink-0 font-mono text-xs font-black tabular-nums text-[var(--patient-muted)]">{percent}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--patient-disabled)]">
              <motion.div
                className={`h-full rounded-full ${complete ? 'bg-[var(--patient-sage)]' : 'bg-[var(--patient-clay)]'}`}
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.7, ease: patientEase }}
              />
            </div>
          </div>

          {missing.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {missing.map((field) => (
                <span
                  key={field}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--patient-clay)_32%,var(--patient-surface))] bg-[color-mix(in_srgb,var(--patient-surface)_75%,transparent)] px-3 py-1.5 text-xs font-black text-[var(--patient-clay)]"
                >
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  {formatMissingLabel(field, status)}
                </span>
              ))}
            </div>
          ) : (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--patient-sage)_32%,var(--patient-surface))] bg-[color-mix(in_srgb,var(--patient-surface)_75%,transparent)] px-3 py-1.5 text-xs font-black text-[var(--patient-sage)]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Ready for online booking
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={primaryAction}
          className={`patient-button-primary px-5 py-3 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            complete
              ? 'focus:ring-[color-mix(in_srgb,var(--patient-sage)_40%,transparent)]'
              : '!bg-[var(--patient-clay)] focus:ring-[color-mix(in_srgb,var(--patient-clay)_30%,transparent)]'
          }`}
        >
          {complete ? 'Book appointment' : 'Complete intake'}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </button>
      </div>
    </motion.section>
  );
}
