import {
  APPOINTMENT_STATUS,
  getAppointmentStatusLabel,
  normalizeAppointment,
  normalizeAppointmentStatus,
} from './appointments.js';

const TERMINAL_STATUSES = new Set([
  APPOINTMENT_STATUS.COMPLETED,
  APPOINTMENT_STATUS.CANCELLED,
  APPOINTMENT_STATUS.NO_SHOW,
]);

const ENCOUNTER_STATUSES = new Set([
  APPOINTMENT_STATUS.SCHEDULED,
  APPOINTMENT_STATUS.CONFIRMED,
  APPOINTMENT_STATUS.PRE_CHECK,
  APPOINTMENT_STATUS.IN_CONSULTATION,
]);

function normalizeRole(role) {
  return String(role || 'secretary').trim().toLowerCase().replace(/-/g, '_');
}

function joinName(user) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
}

function patientFromAppointment(appointment) {
  const user = appointment?.patients?.users || appointment?.patient?.users || null;
  const name = appointment.patientName || joinName(user) || appointment.patient_name || 'Unknown Patient';
  return {
    id: appointment.patient_id || appointment.patient?.id || appointment.patients?.id || null,
    name,
    initials: appointment.patientInitials || name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?',
    phone: appointment.patientPhone || user?.phone || null,
  };
}

function doctorFromAppointment(appointment) {
  const user = appointment?.doctors?.users || appointment?.doctor?.users || null;
  const name = appointment.doctorName || joinName(user) || appointment.doctor_name || 'Assigned doctor';
  return {
    id: appointment.doctor_id || appointment.doctor?.id || appointment.doctors?.id || null,
    name,
    department: appointment.doctorDepartment || appointment?.doctors?.department || appointment?.doctor?.department || null,
  };
}

function clinicFromAppointment(appointment) {
  const clinic = appointment.clinics || appointment.clinic || {};
  const locationParts = [
    clinic.name,
    clinic.room || clinic.room_number,
    clinic.floor ? `Floor ${clinic.floor}` : null,
  ].filter(Boolean);

  return {
    id: appointment.clinic_id || clinic.id || null,
    name: clinic.name || null,
    room: clinic.room || clinic.room_number || null,
    label: locationParts.join(' · ') || 'Clinic location not assigned',
  };
}

function disabled(reason) {
  return { enabled: false, reason };
}

function enabled(label) {
  return { enabled: true, label };
}

export function getAppointmentAllowedActions(record = {}, { role = 'secretary' } = {}) {
  const appointment = normalizeAppointment(record);
  const status = normalizeAppointmentStatus(appointment.status);
  const normalizedRole = normalizeRole(role);
  const terminal = TERMINAL_STATUSES.has(status);
  const hasPatient = Boolean(appointment.patient_id || appointment.patient?.id || appointment.patients?.id);

  return {
    viewPatient: hasPatient ? enabled('View patient') : disabled('No patient record is linked to this appointment.'),
    cancel: terminal ? disabled('Terminal appointments cannot be cancelled.') : enabled('Cancel appointment'),
    markPreChecked: ['predoctor', 'pre_doctor'].includes(normalizedRole) && [APPOINTMENT_STATUS.SCHEDULED, APPOINTMENT_STATUS.CONFIRMED].includes(status)
      ? enabled('Mark patient ready')
      : disabled('Patient-ready handoff is only available to predoctor users before consultation.'),
    openEncounter: normalizedRole === 'doctor' && ENCOUNTER_STATUSES.has(status)
      ? enabled(status === APPOINTMENT_STATUS.IN_CONSULTATION ? 'Continue encounter' : 'Open encounter')
      : disabled(`Encounter is not available for ${getAppointmentStatusLabel(status).toLowerCase()} appointments.`),
    complete: normalizedRole === 'doctor' && status === APPOINTMENT_STATUS.IN_CONSULTATION
      ? enabled('Complete appointment')
      : disabled('Completion is only available during an active consultation.'),
    markNoShow: [APPOINTMENT_STATUS.SCHEDULED, APPOINTMENT_STATUS.CONFIRMED].includes(status)
      ? enabled('Mark no-show')
      : disabled('No-show is only available before the clinical workflow starts.'),
  };
}

export function normalizeAppointmentViewModel(record = {}, options = {}) {
  const appointment = normalizeAppointment(record);
  const patient = patientFromAppointment(appointment);
  const doctor = doctorFromAppointment(appointment);
  const clinic = clinicFromAppointment(appointment);
  const scheduledAt = appointment.scheduled_at || appointment.appointment_time || null;
  const status = normalizeAppointmentStatus(appointment.status);

  return {
    ...appointment,
    id: appointment.id,
    patient,
    doctor,
    clinic,
    slot: {
      id: appointment.slot_id || appointment.slot?.id || null,
    },
    scheduledAt,
    scheduled_at: scheduledAt,
    status,
    statusLabel: getAppointmentStatusLabel(status),
    reason: appointment.reason || appointment.reason_for_visit || 'Consultation',
    visitType: appointment.visit_type || appointment.visitType || appointment.visit_types || null,
    duration: appointment.duration_minutes || 30,
    duration_minutes: appointment.duration_minutes || 30,
    allowedActions: getAppointmentAllowedActions(appointment, options),
  };
}

export function normalizeAppointmentViewModels(records = [], options = {}) {
  return records.map(record => normalizeAppointmentViewModel(record, options));
}
