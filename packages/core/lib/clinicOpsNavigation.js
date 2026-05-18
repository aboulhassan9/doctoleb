import {
  appendClinicOpsQuery,
  getClinicOpsAppointmentsRoute,
  getClinicOpsHomeRoute,
  getClinicOpsPatientsRoute,
  normalizeClinicOpsAppointmentView,
  normalizeClinicOpsRelatedType,
  normalizeClinicOpsRole,
} from './clinicOpsRoutes.js';

export { normalizeClinicOpsAppointmentView } from './clinicOpsRoutes.js';

export function getClinicOpsSearchTarget(query, role = 'secretary') {
  const trimmed = String(query || '').trim();
  const base = getClinicOpsPatientsRoute(role);
  return appendClinicOpsQuery(base, { q: trimmed });
}

export function getClinicOpsAppointmentTarget(appointmentId, role = 'secretary', options = {}) {
  const base = getClinicOpsAppointmentsRoute(role);
  return appendClinicOpsQuery(base, {
    view: normalizeClinicOpsAppointmentView(options.view || 'day'),
    date: options.date || null,
    appointmentId,
  });
}

export function getClinicOpsPatientTarget(patientId, role = 'secretary') {
  const normalizedRole = normalizeClinicOpsRole(role);
  if (patientId && normalizedRole === 'doctor') return `/doctor-patient/${encodeURIComponent(patientId)}`;
  if (patientId) return `/patient-profile/${encodeURIComponent(patientId)}`;
  return getClinicOpsPatientsRoute(normalizedRole);
}

export function getClinicOpsNotificationTarget(notification = {}, role = 'secretary') {
  const normalizedRole = normalizeClinicOpsRole(role);
  const relatedType = normalizeClinicOpsRelatedType(notification.related_type || notification.relatedType || notification.type);
  const relatedId = notification.related_id || notification.relatedId;

  if (relatedType.includes('appointment') || relatedType === 'precheck') {
    return getClinicOpsAppointmentTarget(relatedId, normalizedRole);
  }

  if (relatedType.includes('patient')) {
    return getClinicOpsPatientTarget(relatedId, normalizedRole);
  }

  if (relatedType.includes('conversation') || relatedType.includes('message')) {
    return appendClinicOpsQuery('/staff-messages', { conversationId: relatedId });
  }

  if (relatedType.includes('report') || relatedType.includes('analytical')) {
    return relatedId ? `/reports/${encodeURIComponent(relatedId)}` : '/reports';
  }

  if (relatedType.includes('document')) {
    return normalizedRole === 'doctor' ? '/doctor-reports' : getClinicOpsHomeRoute(normalizedRole);
  }

  return getClinicOpsHomeRoute(normalizedRole);
}

export function isUnreadNotification(notification = {}) {
  if (typeof notification.is_read === 'boolean') return !notification.is_read;
  if (typeof notification.read_at === 'string') return notification.read_at.trim() === '';
  return notification.read_at == null;
}
