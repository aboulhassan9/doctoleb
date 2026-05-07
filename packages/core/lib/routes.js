export const OPS_LOGIN_PATH = '/ops/login';
export const PATIENT_LOGIN_PATH = '/login';

export const ROLE_HOME_ROUTES = Object.freeze({
  admin: '/dashboard',
  doctor: '/doctor-dashboard',
  patient: '/patient-dashboard',
  predoctor: '/predoctor-dashboard',
  secretary: '/dashboard',
});

export function getHomeRouteForRole(role) {
  return ROLE_HOME_ROUTES[role] || '/login';
}
