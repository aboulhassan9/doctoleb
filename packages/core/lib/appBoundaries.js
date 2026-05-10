/**
 * appBoundaries.js — Route ownership constants and role classification helpers.
 *
 * Central source of truth for which routes belong to the patient-web surface
 * and which belong to the clinic-ops surface. Used during the migration period
 * while both surfaces live in the same Vite app.
 *
 * @see FRONTEND_APP_SPLIT_PLAN.md
 * @see APP_SPLIT_AGENT_HANDOFF_PROMPT.md §8
 */

import { isRuntimeDev, readRuntimeEnv } from './env.js';
import { withCurrentTenantBasename } from './tenantPath.js';

// ── App Surface Identifiers ──

export const APP_SURFACES = Object.freeze({
  patientWeb: 'patient-web',
  clinicOps: 'clinic-ops',
});

// ── Role Classification ──

export const PATIENT_WEB_ROLES = Object.freeze(['patient']);

export const CLINIC_OPS_ROLES = Object.freeze([
  'doctor',
  'secretary',
  'predoctor',
  'admin',
]);

function appendPath(baseUrl, path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const normalizedBaseUrl = normalizeConfiguredAppUrl(baseUrl);
  if (!normalizedBaseUrl) return normalizedPath;
  return `${normalizedBaseUrl.replace(/\/$/, '')}${normalizedPath}`;
}

function normalizeConfiguredAppUrl(value) {
  return String(value || '')
    .replace(/\\[rn]/g, '')
    .replace(/[\r\n]/g, '')
    .trim();
}

/**
 * Returns true if the role belongs to the patient-web surface.
 * @param {string} role
 * @returns {boolean}
 */
export function isPatientRole(role) {
  return PATIENT_WEB_ROLES.includes(role);
}

/**
 * Returns true if the role belongs to the clinic-ops surface.
 * @param {string} role
 * @returns {boolean}
 */
export function isClinicOpsRole(role) {
  return CLINIC_OPS_ROLES.includes(role);
}

/**
 * Returns which app surface a role belongs to.
 * @param {string} role
 * @returns {'patient-web'|'clinic-ops'|null}
 */
export function getAppSurfaceForRole(role) {
  if (isPatientRole(role)) return APP_SURFACES.patientWeb;
  if (isClinicOpsRole(role)) return APP_SURFACES.clinicOps;
  return null;
}

/**
 * Returns the appropriate login path for a role.
 * @param {string} role
 * @returns {string}
 */
export function getLoginPathForRole(role) {
  if (isClinicOpsRole(role)) return '/ops/login';
  return '/login';
}

/**
 * Returns the clinic operations login URL for links rendered from patient-web.
 * In production this should be configured as VITE_CLINIC_OPS_URL.
 */
export function getClinicOpsLoginUrl() {
  const loginPath = withCurrentTenantBasename('/login');
  const configuredUrl = readRuntimeEnv('VITE_CLINIC_OPS_URL');
  if (configuredUrl) return appendPath(configuredUrl, loginPath);
  if (isRuntimeDev()) return `http://127.0.0.1:3002${loginPath}`;
  return loginPath;
}

/**
 * Returns the patient-web login URL for links rendered from clinic-ops.
 * In production this should be configured as VITE_PATIENT_WEB_URL.
 */
export function getPatientWebLoginUrl() {
  const loginPath = withCurrentTenantBasename('/login');
  const configuredUrl = readRuntimeEnv('VITE_PATIENT_WEB_URL');
  if (configuredUrl) return appendPath(configuredUrl, loginPath);
  if (isRuntimeDev()) return `http://127.0.0.1:3001${loginPath}`;
  return loginPath;
}

/**
 * Returns the patient-web dashboard URL for controlled cross-surface handoffs.
 */
export function getPatientWebHomeUrl() {
  const homePath = withCurrentTenantBasename('/patient-dashboard');
  const configuredUrl = readRuntimeEnv('VITE_PATIENT_WEB_URL');
  if (configuredUrl) return appendPath(configuredUrl, homePath);
  if (isRuntimeDev()) return `http://127.0.0.1:3001${homePath}`;
  return homePath;
}

// ── Route Ownership Lists ──
// Used for future app-boundary enforcement and code-split verification.

export const PATIENT_WEB_ROUTES = Object.freeze([
  '/',
  '/login',
  '/signup',
  '/marketing',
  '/forgot-password',
  '/reset-password',
  '/patient-dashboard',
  '/patient-profile',
  '/patient-appointments',
  '/patient-history',
  '/patient-messages',
]);

export const CLINIC_OPS_ROUTES = Object.freeze([
  '/ops/login',
  // Secretary
  '/dashboard',
  '/patients',
  '/appointments',
  '/billing',
  '/billing/new',
  '/secretary-slots',
  '/secretary-booking',
  // Pre-doctor
  '/predoctor-dashboard',
  '/predoctor-patients',
  '/predoctor-appointments',
  '/predoctor-new-check',
  '/predoctor-notifications',
  '/predoctor-success',
  '/predoctor-schedule',
  '/patient-profile', // shared staff patient record prefix — includes /:id
  // Doctor
  '/doctor-dashboard',
  '/doctor-patients',
  '/doctor-appointments',
  '/doctor-encounter', // prefix — includes /:appointmentId and -id/:encounterId
  '/doctor-lab-request',
  '/doctor-patient',   // prefix — includes /:id
  '/doctor-patient-history', // prefix — includes /:id
  '/doctor-reports',
  '/doctor-referrals',
  '/doctor-certificates',
  '/staff-messages',
]);
