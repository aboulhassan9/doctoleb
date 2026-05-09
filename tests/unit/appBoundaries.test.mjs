/**
 * Unit tests for app surface boundaries and cross-app URLs.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  APP_SURFACES,
  CLINIC_OPS_ROLES,
  CLINIC_OPS_ROUTES,
  PATIENT_WEB_ROLES,
  PATIENT_WEB_ROUTES,
  getAppSurfaceForRole,
  getClinicOpsLoginUrl,
  getPatientWebHomeUrl,
  getPatientWebLoginUrl,
  isClinicOpsRole,
  isPatientRole,
} from '../../packages/core/lib/appBoundaries.js';

const ENV_KEYS = ['NODE_ENV', 'MODE', 'DEV', 'PROD', 'VITE_CLINIC_OPS_URL', 'VITE_PATIENT_WEB_URL'];

function snapshotEnv() {
  const snap = {};
  for (const key of ENV_KEYS) snap[key] = process.env[key];
  return snap;
}

function restoreEnv(snap) {
  for (const key of ENV_KEYS) {
    if (snap[key] === undefined) delete process.env[key];
    else process.env[key] = snap[key];
  }
}

let envSnap;

beforeEach(() => {
  envSnap = snapshotEnv();
});

afterEach(() => {
  restoreEnv(envSnap);
});

describe('role surface classification', () => {
  it('classifies patient and clinic-ops roles from one source of truth', () => {
    for (const role of PATIENT_WEB_ROLES) {
      assert.equal(isPatientRole(role), true);
      assert.equal(getAppSurfaceForRole(role), APP_SURFACES.patientWeb);
    }

    for (const role of CLINIC_OPS_ROLES) {
      assert.equal(isClinicOpsRole(role), true);
      assert.equal(getAppSurfaceForRole(role), APP_SURFACES.clinicOps);
    }
  });
});

describe('route inventories', () => {
  it('include messaging routes on the correct app surfaces', () => {
    assert.ok(PATIENT_WEB_ROUTES.includes('/patient-messages'));
    assert.ok(CLINIC_OPS_ROUTES.includes('/staff-messages'));
  });
});

describe('cross-app URLs', () => {
  it('uses configured patient-web and clinic-ops URLs without duplicate slashes', () => {
    process.env.VITE_PATIENT_WEB_URL = 'https://patient.example.com/';
    process.env.VITE_CLINIC_OPS_URL = 'https://ops.example.com/';

    assert.equal(getPatientWebLoginUrl(), 'https://patient.example.com/login');
    assert.equal(getPatientWebHomeUrl(), 'https://patient.example.com/patient-dashboard');
    assert.equal(getClinicOpsLoginUrl(), 'https://ops.example.com/login');
  });

  it('normalizes configured app URLs with literal and escaped line endings', () => {
    process.env.VITE_PATIENT_WEB_URL = 'https://patient.example.com\\r';
    process.env.VITE_CLINIC_OPS_URL = "https://ops.example.com/\r\n";

    assert.equal(getPatientWebLoginUrl(), 'https://patient.example.com/login');
    assert.equal(getPatientWebHomeUrl(), 'https://patient.example.com/patient-dashboard');
    assert.equal(getClinicOpsLoginUrl(), 'https://ops.example.com/login');
  });

  it('uses local development ports when app URLs are not configured', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.VITE_PATIENT_WEB_URL;
    delete process.env.VITE_CLINIC_OPS_URL;

    assert.equal(getPatientWebLoginUrl(), 'http://127.0.0.1:3001/login');
    assert.equal(getPatientWebHomeUrl(), 'http://127.0.0.1:3001/patient-dashboard');
    assert.equal(getClinicOpsLoginUrl(), 'http://127.0.0.1:3002/login');
  });
});
