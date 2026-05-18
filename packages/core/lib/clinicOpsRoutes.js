const ROLE_HOME = Object.freeze({
  doctor: '/doctor-dashboard',
  secretary: '/dashboard',
  predoctor: '/predoctor-dashboard',
  pre_doctor: '/predoctor-dashboard',
  staff: '/dashboard',
});

const ROLE_APPOINTMENTS = Object.freeze({
  doctor: '/doctor-appointments',
  secretary: '/appointments',
  predoctor: '/predoctor-appointments',
  pre_doctor: '/predoctor-appointments',
  staff: '/appointments',
});

const ROLE_PATIENTS = Object.freeze({
  doctor: '/doctor-patients',
  secretary: '/patients',
  predoctor: '/predoctor-patients',
  pre_doctor: '/predoctor-patients',
  staff: '/patients',
});

const VIEW_ALIASES = Object.freeze({
  daily: 'day',
  day: 'day',
  weekly: 'week',
  week: 'week',
  monthly: 'month',
  month: 'month',
});

export function normalizeClinicOpsRole(role) {
  const normalized = String(role || 'secretary').trim().toLowerCase().replace(/-/g, '_');
  return ROLE_HOME[normalized] ? normalized : 'secretary';
}

export function normalizeClinicOpsRelatedType(type) {
  return String(type || '').trim().toLowerCase().replace(/-/g, '_');
}

export function normalizeClinicOpsAppointmentView(view, fallback = 'day') {
  const normalized = String(view || fallback).trim().toLowerCase().replace(/-/g, '_');
  return VIEW_ALIASES[normalized] || VIEW_ALIASES[fallback] || 'day';
}

export function appendClinicOpsQuery(path, params = {}) {
  const query = Object.entries(params)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  return query ? `${path}?${query}` : path;
}

export function getClinicOpsHomeRoute(role = 'secretary') {
  return ROLE_HOME[normalizeClinicOpsRole(role)];
}

export function getClinicOpsAppointmentsRoute(role = 'secretary') {
  return ROLE_APPOINTMENTS[normalizeClinicOpsRole(role)];
}

export function getClinicOpsPatientsRoute(role = 'secretary') {
  return ROLE_PATIENTS[normalizeClinicOpsRole(role)];
}
