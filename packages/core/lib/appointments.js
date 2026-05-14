import { isFutureClinicDateTime } from './time.js';

export const APPOINTMENT_STATUS = Object.freeze({
  SCHEDULED: 'scheduled',
  CONFIRMED: 'confirmed',
  PRE_CHECK: 'pre_check',
  IN_CONSULTATION: 'in_consultation',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
});

export const APPOINTMENT_STATUS_STEPS = [
  APPOINTMENT_STATUS.SCHEDULED,
  APPOINTMENT_STATUS.PRE_CHECK,
  APPOINTMENT_STATUS.IN_CONSULTATION,
  APPOINTMENT_STATUS.COMPLETED,
];

export const APPOINTMENT_STATUS_LABELS = Object.freeze({
  [APPOINTMENT_STATUS.SCHEDULED]: 'Scheduled',
  [APPOINTMENT_STATUS.CONFIRMED]: 'Confirmed',
  [APPOINTMENT_STATUS.PRE_CHECK]: 'Pre-Check',
  [APPOINTMENT_STATUS.IN_CONSULTATION]: 'Consultation',
  [APPOINTMENT_STATUS.COMPLETED]: 'Completed',
  [APPOINTMENT_STATUS.CANCELLED]: 'Cancelled',
  [APPOINTMENT_STATUS.NO_SHOW]: 'No Show',
});

const STATUS_ALIASES = Object.freeze({
  'no-show': APPOINTMENT_STATUS.NO_SHOW,
  no_show: APPOINTMENT_STATUS.NO_SHOW,
  'in-progress': 'in_progress',
  inprogress: 'in_progress',
  in_consultation: APPOINTMENT_STATUS.IN_CONSULTATION,
});

export function normalizeAppointmentStatus(status) {
  if (!status) return APPOINTMENT_STATUS.SCHEDULED;

  const normalized = String(status).trim().toLowerCase().replace(/\s+/g, '_');
  return STATUS_ALIASES[normalized] || normalized;
}

export function getAppointmentStatusLabel(status) {
  const normalizedStatus = normalizeAppointmentStatus(status);
  return APPOINTMENT_STATUS_LABELS[normalizedStatus] || normalizedStatus;
}

export function normalizeAppointment(record = {}) {
  const patientUser = record?.patients?.users || record?.patient?.users || null;
  const doctorUser = record?.doctors?.users || record?.doctor?.users || null;
  const scheduledAt = record.scheduled_at || record.appointment_time || null;
  const normalizedStatus = normalizeAppointmentStatus(record.status);
  const reason = record.reason || record.reason_for_visit || 'Consultation';
  const patientName = patientUser
    ? `${patientUser.first_name || ''} ${patientUser.last_name || ''}`.trim()
    : record.patient_name || 'Unknown Patient';

  return {
    ...record,
    appointment_time: scheduledAt,
    scheduled_at: scheduledAt,
    duration_minutes: record.duration_minutes || 30,
    patientInitials: `${patientUser?.first_name?.[0] || ''}${patientUser?.last_name?.[0] || ''}`.toUpperCase(),
    patientName,
    patientPhone: patientUser?.phone || null,
    doctorDepartment: record?.doctors?.department || record?.doctor?.department || null,
    doctorName: doctorUser
      ? `${doctorUser.first_name || ''} ${doctorUser.last_name || ''}`.trim()
      : record.doctor_name || 'Doctor',
    isCancelled: normalizedStatus === APPOINTMENT_STATUS.CANCELLED,
    isUpcoming: scheduledAt ? isFutureClinicDateTime(scheduledAt) : false,
    reason,
    reason_for_visit: reason,
    status: normalizedStatus,
    statusLabel: getAppointmentStatusLabel(normalizedStatus),
  };
}

export function normalizeAppointments(records = []) {
  return records.map(normalizeAppointment);
}

export function canTransitionAppointmentStatus(currentStatus, nextStatus) {
  const current = normalizeAppointmentStatus(currentStatus);
  const next = normalizeAppointmentStatus(nextStatus);

  const transitions = {
    [APPOINTMENT_STATUS.SCHEDULED]: [
      APPOINTMENT_STATUS.CONFIRMED,
      APPOINTMENT_STATUS.PRE_CHECK,
      APPOINTMENT_STATUS.CANCELLED,
      APPOINTMENT_STATUS.NO_SHOW,
    ],
    [APPOINTMENT_STATUS.CONFIRMED]: [
      APPOINTMENT_STATUS.PRE_CHECK,
      APPOINTMENT_STATUS.CANCELLED,
      APPOINTMENT_STATUS.NO_SHOW,
    ],
    [APPOINTMENT_STATUS.PRE_CHECK]: [
      APPOINTMENT_STATUS.IN_CONSULTATION,
      APPOINTMENT_STATUS.CANCELLED,
    ],
    [APPOINTMENT_STATUS.IN_CONSULTATION]: [
      APPOINTMENT_STATUS.COMPLETED,
      APPOINTMENT_STATUS.CANCELLED,
    ],
    [APPOINTMENT_STATUS.COMPLETED]: [],
    [APPOINTMENT_STATUS.CANCELLED]: [],
    [APPOINTMENT_STATUS.NO_SHOW]: [],
  };

  return transitions[current]?.includes(next) || false;
}
