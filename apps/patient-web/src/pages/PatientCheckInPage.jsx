import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, CheckCircle2, HeartPulse, ShieldAlert, Stethoscope } from 'lucide-react';
import { useAuth } from '@ui/contexts/AuthContext';
import { useToast } from '@ui/contexts/ToastContext';
import { formatClinicDate, formatClinicTime } from '@core/lib/time';
import { patientCheckInService } from '@core/services/patientCheckIn';
import { usePatientPortal } from '@core/hooks/features/usePatientPortal';
import { PATIENT_FORM_CONTEXTS, resolvePatientFormDefinition } from '@core/lib/patientForms';
import { PatientPortalShell } from '@ui/components/patient/PatientPortalShell';
import { PatientIntakeField } from '@ui/components/patient/PatientIntakeField';
import { PatientReadinessCard } from '@ui/components/patient/PatientReadinessCard';
import { patientFadeRise, patientStagger } from '@ui/styles/patientMotion';

function AppointmentCheckInCard({ appointment }) {
  if (!appointment) {
    return (
      <section className="patient-paper patient-surface p-6">
        <CalendarDays className="h-6 w-6 text-[var(--patient-clay)]" />
        <h2 className="patient-display mt-4 text-3xl font-medium tracking-tight text-[var(--patient-ink)]">
          No upcoming appointment is ready for check-in.
        </h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-[var(--patient-muted)]">
          Check-in appears here after a visit is scheduled and your first-visit readiness is complete.
        </p>
      </section>
    );
  }

  return (
    <section className="patient-paper-strong patient-surface p-6">
      <p className="patient-kicker">Selected visit</p>
      <h2 className="patient-display mt-3 text-3xl font-medium tracking-tight text-[var(--patient-ink)]">
        {appointment.reason || 'Clinic visit'}
      </h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="patient-inset p-4">
          <CalendarDays className="h-4 w-4 text-[var(--patient-sage)]" />
          <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-[color-mix(in_srgb,var(--patient-muted)_70%,transparent)]">Date</p>
          <p className="mt-1 text-sm font-black text-[var(--patient-ink)]">
            {formatClinicDate(appointment.scheduled_at, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="patient-inset p-4">
          <HeartPulse className="h-4 w-4 text-[var(--patient-sage)]" />
          <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-[color-mix(in_srgb,var(--patient-muted)_70%,transparent)]">Time</p>
          <p className="mt-1 text-sm font-black text-[var(--patient-ink)]">{formatClinicTime(appointment.scheduled_at)}</p>
        </div>
      </div>
    </section>
  );
}

function CheckInReceipt({ receipt }) {
  if (!receipt) return null;

  return (
    <motion.div
      variants={patientFadeRise}
      initial="hidden"
      animate="visible"
      className="patient-inset-success p-5"
      role="status"
    >
      <CheckCircle2 className="h-5 w-5" />
      <p className="mt-3 text-sm font-black">Check-in submitted.</p>
      <p className="mt-1 text-sm font-semibold leading-6">
        Your pre-check is attached to this appointment and visible to the clinical team.
      </p>
    </motion.div>
  );
}

export default function PatientCheckInPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { overview, loading, error, reload } = usePatientPortal(user);
  const nextAppointment = overview?.nextAppointment || null;
  const readinessStatus = overview?.readiness?.status || null;
  const [definition, setDefinition] = useState(() => resolvePatientFormDefinition({ context: PATIENT_FORM_CONTEXTS.checkIn }));
  const [form, setForm] = useState(() => patientCheckInService.getInitialForm(definition));
  const [configWarning, setConfigWarning] = useState('');
  const [definitionLoading, setDefinitionLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const visibleFields = useMemo(
    () => (definition.fields || []).filter((field) => field.visible !== false),
    [definition.fields]
  );

  useEffect(() => {
    let cancelled = false;

    const loadDefinition = async () => {
      if (!nextAppointment?.id) return;
      setDefinitionLoading(true);
      const result = await patientCheckInService.getDefinition({
        patientId: nextAppointment.patient_id,
        doctorId: nextAppointment.doctor_id,
        visitTypeId: nextAppointment.visit_type_id,
      });
      if (cancelled) return;
      const nextDefinition = result.data || resolvePatientFormDefinition({ context: PATIENT_FORM_CONTEXTS.checkIn });
      setDefinition(nextDefinition);
      setForm(patientCheckInService.getInitialForm(nextDefinition));
      setConfigWarning(result.configError || '');
      setDefinitionLoading(false);
    };

    void loadDefinition();
    return () => {
      cancelled = true;
    };
  }, [nextAppointment?.id, nextAppointment?.patient_id, nextAppointment?.doctor_id, nextAppointment?.visit_type_id]);

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setReceipt(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!nextAppointment?.id) {
      showToast('Book an appointment before check-in.', 'error');
      return;
    }
    if (!readinessStatus?.isComplete) {
      showToast('Complete first-visit readiness before check-in.', 'error');
      navigate('/patient-onboarding?next=/patient-check-in');
      return;
    }

    setSubmitting(true);
    const result = await patientCheckInService.submit({
      appointmentId: nextAppointment.id,
      definition,
      form,
    });
    setSubmitting(false);

    if (result.error) {
      showToast(result.error, 'error');
      return;
    }

    setReceipt(result.data);
    showToast('Check-in submitted', 'success');
    await reload();
  };

  return (
    <PatientPortalShell title="Check-In" subtitle="Vitals, symptoms, and visit readiness">
      <motion.section
        variants={patientStagger}
        initial="hidden"
        animate="visible"
        className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr]"
      >
        <aside className="space-y-5 lg:sticky lg:top-40 lg:self-start">
          <AppointmentCheckInCard appointment={nextAppointment} />
          <PatientReadinessCard
            status={readinessStatus}
            loading={loading}
            onContinue={() => navigate('/patient-onboarding?next=/patient-check-in')}
            onBook={() => navigate('/patient-appointments')}
          />
          <CheckInReceipt receipt={receipt} />
        </aside>

        <motion.form
          variants={patientFadeRise}
          onSubmit={handleSubmit}
          className="patient-paper-strong patient-surface overflow-hidden"
          aria-busy={loading || definitionLoading || submitting}
        >
          <div className="patient-hero-band rounded-none p-6">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--patient-warning)]">
              Arrival readiness
            </p>
            <h1 className="patient-display mt-2 text-4xl font-medium tracking-tight">
              Tell the clinical team what changed before you arrive.
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/75">
              These fields are allowlisted and configurable by clinic or doctor. They become pre-check data, not loose notes in the UI.
            </p>
          </div>

          <div className="p-6">
            {error ? (
              <div role="alert" className="mb-5 rounded-[18px_4px_18px_4px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            ) : null}

            {configWarning ? (
              <div className="patient-inset-warning mb-5 p-4 text-sm font-black">
                {configWarning}
              </div>
            ) : null}

            {!nextAppointment ? (
              <div className="patient-inset p-8 text-center">
                <Stethoscope className="mx-auto h-10 w-10 text-[var(--patient-sage)]" />
                <h2 className="patient-display mt-4 text-3xl font-medium tracking-tight text-[var(--patient-ink)]">
                  Nothing to check in for yet.
                </h2>
                <p className="mx-auto mt-3 max-w-md text-sm font-semibold leading-6 text-[var(--patient-muted)]">
                  Book a visit first, then this page will prepare the predoctor and doctor handoff.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/patient-appointments')}
                  className="patient-button-primary mt-6 px-5 py-3"
                >
                  Open appointments
                </button>
              </div>
            ) : !readinessStatus?.isComplete ? (
              <div className="patient-inset-warning p-5">
                <ShieldAlert className="h-5 w-5" />
                <h2 className="patient-display mt-3 text-2xl font-medium tracking-tight">
                  First-visit readiness comes first.
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6">
                  Complete the identity and safety basics before appointment check-in.
                </p>
              </div>
            ) : definitionLoading ? (
              <div className="space-y-3" role="status">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="h-24 animate-pulse rounded-[18px_4px_18px_4px] bg-[var(--patient-wash)]" />
                ))}
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {visibleFields.map((field) => (
                  <div key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                    <PatientIntakeField
                      field={field}
                      value={form[field.key]}
                      onChange={updateField}
                      disabled={submitting}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="patient-divider mt-8 flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-md text-xs font-semibold leading-5 text-[var(--patient-muted)]">
                If symptoms are urgent or severe, contact emergency services or call the clinic directly instead of waiting for portal review.
              </p>
              <button
                type="submit"
                disabled={!nextAppointment || !readinessStatus?.isComplete || loading || definitionLoading || submitting}
                className="patient-button-primary px-6 py-3 disabled:cursor-not-allowed disabled:bg-[var(--patient-disabled)]"
              >
                {submitting ? 'Submitting...' : 'Submit check-in'}
              </button>
            </div>
          </div>
        </motion.form>
      </motion.section>
    </PatientPortalShell>
  );
}
