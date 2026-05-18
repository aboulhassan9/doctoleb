import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Clock3, History, Loader2, Stethoscope, Timer, XCircle } from 'lucide-react';
import { AppointmentCancelInlineConfirm } from '@ui/components/appointments/AppointmentCancelInlineConfirm';
import { logError } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { appointmentService } from '@/services/appointments';
import { patientBookingService } from '@core/services/patientBooking';
import { catalogService } from '@/services/catalogs';
import { doctorService } from '@/services/doctors';
import { slotService } from '@/services/slots';
import { DEFAULT_PATIENT_BOOKING_DEFINITION } from '@core/lib/patientForms';
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_STEPS, normalizeAppointments } from '@/lib/appointments';
import { getErrorMessage } from '@/lib/errors';
import { usePatientOnboarding } from '@core/hooks/features/usePatientOnboarding';
import { PatientPortalShell } from '@ui/components/patient/PatientPortalShell';
import { PatientIntakeField } from '@ui/components/patient/PatientIntakeField';
import { PatientReadinessCard } from '@ui/components/patient/PatientReadinessCard';
import {
  canLoadPatientBookingSlots,
  normalizeBookingDoctorOptions,
  resolveInitialBookingDoctorId,
} from '@/lib/patientAppointmentBooking';
import { formatClinicDate, formatClinicTime, isFutureClinicDateTime, normalizeTimeValue } from '@/lib/time';
import { patientEase, patientFadeRise, patientStagger } from '@ui/styles/patientMotion';

const TAB_ITEMS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'book', label: 'Book new' },
];

function StatusTimeline({ status }) {
  const current = APPOINTMENT_STATUS_STEPS.indexOf(status);

  return (
    <div className="mt-4 grid gap-2 sm:flex sm:items-center">
      {APPOINTMENT_STATUS_STEPS.map((step, index) => {
        const done = index <= current;
        return (
          <div key={step} className="flex items-center gap-2 sm:flex-1">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full border-2 ${
              done ? 'border-[var(--patient-sage)] bg-[var(--patient-sage)]' : 'border-[var(--patient-outline)] bg-[var(--patient-surface)]'
            }`}
            />
            <span className={`text-[10px] font-black uppercase tracking-[0.12em] ${
              done ? 'text-[var(--patient-sage)]' : 'text-[color-mix(in_srgb,var(--patient-muted)_55%,transparent)]'
            }`}>
              {APPOINTMENT_STATUS_LABELS[step]}
            </span>
            {index < APPOINTMENT_STATUS_STEPS.length - 1 && (
              <span className={`hidden h-px flex-1 sm:block ${done && index < current ? 'bg-[var(--patient-sage)]' : 'bg-[var(--patient-outline)]'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function AppointmentSurface({
  title,
  eyebrow,
  appointments,
  emptyTitle,
  emptyCopy,
  onBook,
  cancelConfirmId,
  cancelReason,
  submitting,
  onOpenCancel,
  onKeepAppointment,
  onReasonChange,
  onConfirm,
  showCancel,
}) {
  return (
    <motion.section
      variants={patientFadeRise}
      initial="hidden"
      animate="visible"
      className="patient-paper-strong patient-surface p-6"
    >
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--patient-sage)]">{eyebrow}</p>
      <h2 className="patient-display mt-2 text-3xl font-medium tracking-tight text-[var(--patient-ink)]">{title}</h2>

      {appointments.length > 0 ? (
        <div className="mt-6 space-y-4">
          {appointments.map((appointment) => {
            const isCancelled = appointment.status === 'cancelled';
            return (
              <article
                key={appointment.id}
                className="patient-inset group p-4 transition hover:-translate-y-0.5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${
                        isCancelled ? 'bg-red-50 text-red-600' : 'patient-status-sage'
                      }`}>
                        {isCancelled ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        {appointment.status || 'scheduled'}
                      </span>
                      {appointment.duration_minutes ? (
                        <span className="patient-status-muted">
                          <Timer className="h-3.5 w-3.5" />
                          {appointment.duration_minutes} min
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-3 text-lg font-black text-[var(--patient-ink)]">{appointment.reason || 'Clinic visit'}</h3>
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--patient-muted)]">
                      <CalendarDays className="h-4 w-4 text-[var(--patient-sage)]" />
                      {formatClinicDate(appointment.scheduled_at, { weekday: 'short', month: 'short', day: 'numeric' })}
                      <span aria-hidden="true">·</span>
                      <Clock3 className="h-4 w-4 text-[var(--patient-sage)]" />
                      {formatClinicTime(appointment.scheduled_at)}
                    </p>
                    <StatusTimeline status={appointment.status || 'scheduled'} />
                  </div>

                  {showCancel ? (
                    <AppointmentCancelInlineConfirm
                      appointmentId={appointment.id}
                      isConfirming={cancelConfirmId === appointment.id}
                      reason={cancelConfirmId === appointment.id ? cancelReason : ''}
                      submitting={submitting}
                      onOpen={onOpenCancel}
                      onKeep={onKeepAppointment}
                      onReasonChange={onReasonChange}
                      onConfirm={onConfirm}
                    />
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="patient-inset mt-8 border border-dashed border-[var(--patient-outline)] p-8 text-center">
          <CalendarDays className="mx-auto h-10 w-10 text-[var(--patient-sage)]" />
          <h3 className="patient-display mt-4 text-2xl font-medium tracking-tight text-[var(--patient-ink)]">{emptyTitle}</h3>
          <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-[var(--patient-muted)]">{emptyCopy}</p>
          {onBook ? (
            <button
              type="button"
              onClick={onBook}
              className="patient-button-primary mt-6 px-5 py-3"
            >
              Book an appointment
            </button>
          ) : null}
        </div>
      )}
    </motion.section>
  );
}

function BookingReceipt({ receipt }) {
  if (!receipt) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: patientEase }}
      className="patient-inset-success p-5"
      role="status"
    >
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--patient-sage)]">Booking receipt</p>
      <p className="mt-2 text-sm font-black text-[var(--patient-ink)]">
        Your appointment was saved. The clinic schedule now includes this visit.
      </p>
      <p className="mt-2 text-sm font-semibold text-[var(--patient-muted)]">
        {receipt.visitType?.name || 'Visit'} at {normalizeTimeValue(receipt.slot?.start_time) || 'the selected time'}.
      </p>
      {receipt.answersSaved === false ? (
        <p className="mt-2 text-xs font-black uppercase tracking-wide text-[var(--patient-clay)]">
          Appointment saved; extra booking answers need staff review.
        </p>
      ) : null}
    </motion.div>
  );
}

export default function PatientAppointmentsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [visitTypes, setVisitTypes] = useState([]);
  const [selectedVisitTypeId, setSelectedVisitTypeId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingDefinition, setBookingDefinition] = useState(DEFAULT_PATIENT_BOOKING_DEFINITION);
  const [bookingForm, setBookingForm] = useState({});
  const [bookingConfigWarning, setBookingConfigWarning] = useState('');
  const [bookingReceipt, setBookingReceipt] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [cancelConfirmId, setCancelConfirmId] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const { status: onboardingStatus, loading: onboardingLoading } = usePatientOnboarding(user);

  useEffect(() => {
    void fetchAppointments();
  }, [user?.patient_id]);

  useEffect(() => {
    void fetchBookingDoctors();
  }, [user?.doctor_id]);

  useEffect(() => {
    void fetchVisitTypes();
  }, []);

  useEffect(() => {
    void fetchBookingDefinition();
  }, [user?.patient_id, selectedDoctorId, selectedVisitTypeId]);

  useEffect(() => {
    setSelectedSlot(null);

    if (canLoadPatientBookingSlots({ selectedDoctorId, selectedDate })) {
      void fetchAvailableSlots();
    } else {
      setAvailableSlots([]);
    }
  }, [selectedDoctorId, selectedDate]);

  async function fetchAppointments() {
    if (!user?.patient_id) {
      setAppointments([]);
      return;
    }

    try {
      const { data, error } = await appointmentService.getByPatientId(user.patient_id);
      if (error) {
        showToast(getErrorMessage(error, 'Failed to load appointments'), 'error');
        return;
      }

      setAppointments(normalizeAppointments(data || []));
    } catch (err) {
      logError('PatientAppointmentsPage.fetchAppointments', err);
      showToast('Failed to load appointments', 'error');
    }
  }

  async function fetchBookingDoctors() {
    try {
      setDoctorsLoading(true);
      const { data, error } = await doctorService.getAll({ page: 1, pageSize: 100 });
      if (error) {
        setDoctors([]);
        showToast(getErrorMessage(error, 'Failed to load doctors for booking'), 'error');
        return;
      }

      const nextDoctors = data || [];
      setDoctors(nextDoctors);
      setSelectedDoctorId((current) => current || resolveInitialBookingDoctorId({
        sessionDoctorId: user?.doctor_id,
        doctors: nextDoctors,
      }));
    } catch (err) {
      logError('PatientAppointmentsPage.fetchBookingDoctors', err);
      showToast('Failed to load doctors for booking', 'error');
    } finally {
      setDoctorsLoading(false);
    }
  }

  async function fetchVisitTypes() {
    const { data, error } = await catalogService.getAll('visit_types');
    if (error) {
      showToast(getErrorMessage(error, 'Failed to load visit types'), 'error');
      return;
    }
    setVisitTypes(data || []);
  }

  async function fetchBookingDefinition() {
    const { data, error, configError } = await patientBookingService.getBookingDefinition({
      patientId: user?.patient_id || null,
      doctorId: selectedDoctorId || null,
      visitTypeId: selectedVisitTypeId || null,
    });

    if (error) {
      setBookingDefinition(DEFAULT_PATIENT_BOOKING_DEFINITION);
      setBookingConfigWarning(getErrorMessage(error, 'Using the default booking questions.'));
      return;
    }

    const nextDefinition = data || DEFAULT_PATIENT_BOOKING_DEFINITION;
    setBookingDefinition(nextDefinition);
    setBookingConfigWarning(configError || '');
    setBookingForm((current) => {
      const next = {};
      for (const field of nextDefinition.fields || []) {
        next[field.key] = current[field.key] || '';
      }
      return next;
    });
  }

  async function fetchAvailableSlots() {
    try {
      if (!canLoadPatientBookingSlots({ selectedDoctorId, selectedDate })) {
        setAvailableSlots([]);
        return;
      }

      const { data: slots, error } = await slotService.getAvailableSlots(selectedDoctorId, selectedDate);
      if (error) {
        showToast(getErrorMessage(error, 'Failed to load available slots'), 'error');
        setAvailableSlots([]);
        return;
      }

      setAvailableSlots(slots || []);
    } catch (err) {
      logError('PatientAppointmentsPage.fetchAvailableSlots', err);
    }
  }

  const updateBookingField = (key, value) => {
    setBookingForm((current) => ({ ...current, [key]: value }));
  };

  const doctorOptions = normalizeBookingDoctorOptions(doctors);
  const selectedDoctor = doctorOptions.find((doctor) => doctor.id === selectedDoctorId);
  const selectedVisitType = visitTypes.find((visitType) => visitType.id === selectedVisitTypeId);
  const selectedDuration = selectedVisitType?.default_duration_minutes ||
    selectedSlot?.duration_minutes ||
    selectedSlot?.duration ||
    null;
  const visitTypeRequired = visitTypes.length > 0;
  const bookingReason = String(bookingForm.visit_reason || '').trim();
  const bookingRequiredComplete = (bookingDefinition.requiredKeys || []).every((key) => (
    String(bookingForm[key] || '').trim().length > 0
  ));
  const canSubmitBooking = Boolean(
    onboardingStatus?.isComplete &&
    selectedDoctorId &&
    selectedDate &&
    selectedSlot?.id &&
    bookingReason &&
    bookingRequiredComplete &&
    selectedDuration &&
    (!visitTypeRequired || selectedVisitTypeId)
  );

  const handleBookAppointment = async (event) => {
    event.preventDefault();

    if (!onboardingStatus?.isComplete) {
      showToast('Please complete your first-visit intake before booking.', 'error');
      navigate('/patient-onboarding?next=/patient-appointments');
      return;
    }

    if (!selectedDoctorId || !selectedDate || !selectedSlot?.id || !bookingReason) {
      showToast('Choose a doctor, date, slot, and reason before booking.', 'error');
      return;
    }

    if (!bookingRequiredComplete) {
      showToast('Complete the required booking questions before saving.', 'error');
      return;
    }

    if (visitTypeRequired && !selectedVisitTypeId) {
      showToast('Choose the visit type so the clinic receives the correct duration.', 'error');
      return;
    }

    if (!selectedDuration) {
      showToast('This booking needs a configured visit duration before it can be saved.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const { data, error } = await patientBookingService.bookVisit({
        booking: {
          slotId: selectedSlot.id,
          patientId: user?.patient_id,
          bookedBy: user?.id,
          reason: bookingReason,
          visitTypeId: selectedVisitTypeId || null,
          durationMinutes: selectedDuration,
          status: 'scheduled',
        },
        definition: bookingDefinition,
        form: bookingForm,
      });

      if (data?.appointment) {
        showToast(error ? 'Appointment booked. Some extra questions could not be saved.' : 'Appointment booked successfully.', error ? 'info' : 'success');
        setBookingReceipt({
          appointment: data.appointment,
          slot: selectedSlot,
          visitType: selectedVisitType || null,
          answersSaved: data.partialSuccess?.bookingAnswersSaved !== false,
        });
        await fetchAppointments();
        setSelectedDate('');
        setSelectedSlot(null);
        setSelectedVisitTypeId('');
        setBookingForm(Object.fromEntries((bookingDefinition.fields || []).map((field) => [field.key, ''])));
      } else {
        showToast(getErrorMessage(error, 'Failed to book appointment'), 'error');
      }
    } catch (err) {
      logError('PatientAppointmentsPage.handleBookAppointment', err);
      showToast('An error occurred while booking', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelAppointment = async (appointmentId, cancellationReason) => {
    if (!cancellationReason?.trim()) {
      showToast('Please add a cancellation reason', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await appointmentService.cancel(appointmentId, cancellationReason.trim());
      if (!error) {
        await fetchAppointments();
        showToast('Appointment cancelled', 'success');
      } else {
        showToast(getErrorMessage(error, 'Failed to cancel appointment'), 'error');
      }
    } catch (err) {
      logError('PatientAppointmentsPage.handleCancelAppointment', err);
    } finally {
      setSubmitting(false);
      setCancelConfirmId(null);
      setCancelReason('');
    }
  };

  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  const upcomingAppointments = appointments.filter((appointment) => (
    appointment.status !== 'cancelled' && isFutureClinicDateTime(appointment.scheduled_at)
  ));
  const pastAppointments = appointments.filter((appointment) => (
    appointment.status === 'cancelled' || !isFutureClinicDateTime(appointment.scheduled_at)
  ));
  const bookingDisabled = submitting || !onboardingStatus?.isComplete;

  return (
    <PatientPortalShell title="Appointments" subtitle="Book, review, and cancel visits">
        <motion.section
          variants={patientStagger}
          initial="hidden"
          animate="visible"
          className="mb-8 grid gap-6 lg:grid-cols-[1fr_auto]"
        >
          <motion.div variants={patientFadeRise}>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--patient-sage)]">Appointments</p>
            <h1 className="patient-display mt-3 max-w-3xl text-5xl font-medium leading-[0.98] tracking-tight text-[var(--patient-ink)]">
              Appointments
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-[var(--patient-muted)]">
              Choose care without losing the clinical context. Online booking now checks readiness first and keeps visit
              type, duration, doctor, date, and reason visible.
            </p>
          </motion.div>

          <motion.nav variants={patientFadeRise} className="flex flex-wrap items-end gap-2 lg:justify-end" aria-label="Appointment tabs">
            {TAB_ITEMS.map((tab) => {
              const count = tab.id === 'upcoming'
                ? upcomingAppointments.length
                : tab.id === 'past'
                  ? pastAppointments.length
                  : null;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`patient-focus rounded-full px-5 py-3 text-sm font-black transition ${
                    active
                      ? 'bg-[var(--patient-sage)] text-white shadow-sm'
                      : 'border border-[var(--patient-outline)] bg-[color-mix(in_srgb,var(--patient-surface)_80%,transparent)] text-[var(--patient-muted)] hover:border-[color-mix(in_srgb,var(--patient-sage)_40%,transparent)] hover:text-[var(--patient-ink)]'
                  }`}
                >
                  {tab.label}
                  {count !== null ? ` (${count})` : ''}
                </button>
              );
            })}
          </motion.nav>
        </motion.section>

        {activeTab === 'upcoming' && (
          <AppointmentSurface
            title="Upcoming visits"
            eyebrow="Scheduled care"
            appointments={upcomingAppointments}
            emptyTitle="No upcoming appointments"
            emptyCopy="When your intake is ready, you can choose a visit type, doctor, and open slot."
            onBook={() => setActiveTab('book')}
            cancelConfirmId={cancelConfirmId}
            cancelReason={cancelReason}
            submitting={submitting}
            onOpenCancel={(id) => {
              setCancelConfirmId(id);
              setCancelReason('');
            }}
            onKeepAppointment={() => {
              setCancelConfirmId(null);
              setCancelReason('');
            }}
            onReasonChange={setCancelReason}
            onConfirm={handleCancelAppointment}
            showCancel
          />
        )}

        {activeTab === 'past' && (
          <AppointmentSurface
            title="Past appointments"
            eyebrow="Visit history"
            appointments={pastAppointments}
            emptyTitle="No past appointments"
            emptyCopy="Completed and cancelled visits will collect here after your first appointment."
          />
        )}

        {activeTab === 'book' && (
          <motion.section
            variants={patientStagger}
            initial="hidden"
            animate="visible"
            className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]"
          >
            <div className="space-y-5">
              <PatientReadinessCard
                status={onboardingStatus}
                loading={onboardingLoading}
                onContinue={() => navigate('/patient-onboarding?next=/patient-appointments')}
                onBook={() => document.getElementById('patient-booking-visit-type')?.focus()}
              />
              <BookingReceipt receipt={bookingReceipt} />

              <motion.aside variants={patientFadeRise} className="patient-paper patient-surface p-6">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--patient-clay)]">Booking statement</p>
                <h2 className="patient-display mt-3 text-3xl font-medium tracking-tight text-[var(--patient-ink)]">
                  I need to see {selectedDoctor?.label || 'a doctor'}
                  {selectedVisitType?.name ? ` for ${selectedVisitType.name.toLowerCase()}` : ''}
                  {selectedDate ? ` on ${formatClinicDate(selectedDate, { month: 'short', day: 'numeric' })}` : ''}.
                </h2>
                <div className="mt-5 grid gap-3 text-sm font-semibold text-[var(--patient-muted)]">
                  <p className="flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-[var(--patient-sage)]" />
                    {selectedDoctor?.specialization || 'Doctor specialty appears after selection'}
                  </p>
                  <p className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-[var(--patient-sage)]" />
                    {selectedDuration ? `${selectedDuration} minute visit` : 'Duration comes from visit type or slot'}
                  </p>
                </div>
              </motion.aside>
            </div>

            <motion.form
              variants={patientFadeRise}
              onSubmit={handleBookAppointment}
              className="patient-paper-strong patient-surface p-6"
            >
              <div className="flex flex-col gap-3 border-b border-[color-mix(in_srgb,var(--patient-outline)_60%,transparent)] pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--patient-sage)]">Seek care</p>
                  <h2 className="patient-display mt-2 text-4xl font-medium tracking-tight text-[var(--patient-ink)]">
                    Book a visit
                  </h2>
                </div>
                {!onboardingStatus?.isComplete && (
                  <span className="patient-status-clay">
                    Intake required
                  </span>
                )}
              </div>

              <div className="mt-6 grid gap-5">
                <div>
                  <label htmlFor="patient-booking-visit-type" className="block text-sm font-black text-[var(--patient-ink)]">
                    Visit type
                  </label>
                  <select
                    id="patient-booking-visit-type"
                    value={selectedVisitTypeId}
                    onChange={(event) => setSelectedVisitTypeId(event.target.value)}
                    disabled={bookingDisabled || visitTypes.length === 0}
                    required={visitTypeRequired}
                    className="patient-field-input mt-2 px-4 py-3 disabled:bg-[var(--patient-disabled)] disabled:text-[color-mix(in_srgb,var(--patient-muted)_55%,transparent)]"
                  >
                    <option value="">{visitTypes.length ? 'Select visit type' : 'No visit types configured'}</option>
                    {visitTypes.map((visitType) => (
                      <option key={visitType.id} value={visitType.id}>
                        {visitType.name}
                        {visitType.default_duration_minutes ? ` - ${visitType.default_duration_minutes} min` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="patient-booking-doctor" className="block text-sm font-black text-[var(--patient-ink)]">
                    Doctor
                  </label>
                  <select
                    id="patient-booking-doctor"
                    value={selectedDoctorId}
                    onChange={(event) => {
                      setSelectedDoctorId(event.target.value);
                      setSelectedSlot(null);
                      setAvailableSlots([]);
                    }}
                    required
                    disabled={bookingDisabled || doctorsLoading || doctorOptions.length === 0}
                    className="patient-field-input mt-2 px-4 py-3 disabled:bg-[var(--patient-disabled)] disabled:text-[color-mix(in_srgb,var(--patient-muted)_55%,transparent)]"
                  >
                    <option value="">{doctorsLoading ? 'Loading doctors...' : 'Select a doctor'}</option>
                    {doctorOptions.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        {doctor.label}{doctor.specialization ? ` - ${doctor.specialization}` : ''}
                      </option>
                    ))}
                  </select>
                  {!doctorsLoading && doctorOptions.length === 0 ? (
                    <p className="mt-2 text-sm font-bold text-red-600">
                      Online booking is not ready yet. Please contact the clinic.
                    </p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor="patient-booking-date" className="block text-sm font-black text-[var(--patient-ink)]">
                    Appointment date
                  </label>
                  <input
                    id="patient-booking-date"
                    type="date"
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                    min={getMinDate()}
                    required
                    disabled={!selectedDoctorId || bookingDisabled}
                    className="patient-field-input mt-2 px-4 py-3 disabled:bg-[var(--patient-disabled)] disabled:text-[color-mix(in_srgb,var(--patient-muted)_55%,transparent)]"
                  />
                </div>

                {selectedDoctorId && selectedDate && availableSlots.length > 0 && (
                  <div>
                    <p className="block text-sm font-black text-[var(--patient-ink)]">Available time slots</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {availableSlots.map((slot) => {
                        const selected = selectedSlot?.id === slot.id;
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => setSelectedSlot(slot)}
                            disabled={bookingDisabled}
                            className={`patient-focus relative overflow-hidden rounded-[18px_4px_18px_4px] border px-4 py-3 text-left transition disabled:opacity-50 ${
                              selected
                                ? 'border-[var(--patient-sage)] bg-[var(--patient-success)] text-[var(--patient-ink)]'
                                : 'border-[color-mix(in_srgb,var(--patient-outline)_70%,transparent)] bg-[color-mix(in_srgb,var(--patient-surface)_75%,transparent)] text-[var(--patient-muted)] hover:border-[color-mix(in_srgb,var(--patient-sage)_40%,transparent)]'
                            }`}
                          >
                            <span className={`absolute bottom-0 left-0 top-0 w-1 ${selected ? 'bg-[var(--patient-sage)]' : 'bg-[var(--patient-warning)]'}`} />
                            <span className="ml-2 block text-sm font-black">{normalizeTimeValue(slot.start_time)}</span>
                            {slot.end_time ? (
                              <span className="ml-2 mt-1 block text-xs font-semibold">
                                Ends {normalizeTimeValue(slot.end_time)}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedDoctorId && selectedDate && availableSlots.length === 0 ? (
                  <p className="patient-inset px-4 py-3 text-sm font-semibold text-[var(--patient-muted)]">
                    No available slots for this doctor on the selected date.
                  </p>
                ) : null}

                {bookingConfigWarning ? (
                  <p className="patient-inset-warning px-4 py-3 text-sm font-black">
                    {bookingConfigWarning}
                  </p>
                ) : null}

                <div className="patient-inset p-4">
                  <div className="mb-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--patient-sage)]">
                      Doctor questions
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-[var(--patient-muted)]">
                      These fields come from an allowlisted booking definition, ready for tenant and doctor overrides.
                    </p>
                  </div>
                  <div className="grid gap-5 md:grid-cols-2">
                    {(bookingDefinition.fields || []).map((field) => (
                      <div key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                        <PatientIntakeField
                          field={field}
                          value={bookingForm[field.key]}
                          onChange={updateBookingField}
                          disabled={bookingDisabled}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {!selectedDuration && selectedSlot?.id ? (
                  <p className="patient-inset-warning px-4 py-3 text-sm font-black">
                    This slot needs a visit duration from a configured visit type before booking can be saved.
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting || !canSubmitBooking}
                  className="patient-button-primary w-full px-5 py-3 disabled:cursor-not-allowed disabled:bg-[var(--patient-outline)]"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Booking...
                    </>
                  ) : (
                    <>
                      <CalendarDays className="h-4 w-4" />
                      Book appointment
                    </>
                  )}
                </button>
              </div>
            </motion.form>
          </motion.section>
        )}

        <motion.div variants={patientFadeRise} initial="hidden" animate="visible" className="mt-8 flex items-center gap-2 text-xs font-bold text-[color-mix(in_srgb,var(--patient-muted)_70%,transparent)]">
          <History className="h-4 w-4" />
          Cancellations require a reason so clinic staff can understand the change without guessing.
        </motion.div>
    </PatientPortalShell>
  );
}
