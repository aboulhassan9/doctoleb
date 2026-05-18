import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  assertRuntimeConfig,
  buildSeedPlan,
  buildSeedRuntimeConfig,
  defaultSeedTag,
  maskEmail,
  parseSeedArgs,
  redactRuntimeConfig,
  REQUIRED_OPERATIONAL_TABLES,
  SEED_DUPLICATE_CHECKS,
  renderSeedTemplate,
  safeErrorMessage,
  seedEmail,
} from '../../../scripts/lib/tenant-operational-seed.mjs';

describe('tenant operational seed configuration', () => {
  it('defaults to dry-run small volume and a dated namespace', () => {
    const now = new Date('2026-05-17T10:00:00.000Z');
    const config = buildSeedRuntimeConfig({}, [], now);

    assert.equal(config.dryRun, true);
    assert.equal(config.write, false);
    assert.equal(config.volume, 'small');
    assert.equal(config.seedTag, 'ops_seed_20260517');
  });

  it('requires an explicit write flag before mutation mode is enabled', () => {
    const options = parseSeedArgs([
      '--write',
      '--volume=medium',
      '--target-doctor-email=Owner@Example.com',
      '--operator-email=Secretary@Example.com',
    ]);

    assert.equal(options.write, true);
    assert.equal(options.dryRun, false);
    assert.equal(options.volume, 'medium');
    assert.equal(options.targetDoctorEmail, 'owner@example.com');
    assert.equal(options.operatorEmail, 'secretary@example.com');
  });

  it('rejects unknown volumes and unsafe seed tags', () => {
    assert.throws(() => parseSeedArgs(['--volume=huge']), /Invalid --volume/);
    assert.throws(() => parseSeedArgs(['--seed-tag=Bad Tag!']), /Invalid --seed-tag/);
  });

  it('builds a plan whose appointment outcomes sum to the requested volume', () => {
    const config = buildSeedRuntimeConfig({ SEED_TAG: 'ops_seed_test' }, ['--volume=tiny']);
    const plan = buildSeedPlan(config, new Date('2026-05-17T10:00:00.000Z'));

    const outcomeTotal = plan.rows.completedAppointments
      + plan.rows.cancelledAppointments
      + plan.rows.noShowAppointments
      + plan.rows.futureAppointments;

    assert.equal(plan.rows.patients, 5);
    assert.equal(outcomeTotal, plan.rows.appointments);
    assert.equal(plan.sixMonthWindowDays, 180);
  });

  it('plans the advanced seed surfaces that make dashboards meaningful', () => {
    const config = buildSeedRuntimeConfig({ SEED_TAG: 'ops_seed_test' }, ['--volume=tiny']);
    const plan = buildSeedPlan(config, new Date('2026-05-17T10:00:00.000Z'));

    assert.equal(plan.rows.scheduleTemplates, 3);
    assert.ok(plan.rows.patientHistoryRecords > plan.rows.patients);
    assert.ok(plan.rows.referralDocuments > 0);
    assert.ok(plan.rows.certificateDocuments > 0);
    assert.ok(plan.rows.labRequestDocuments > 0);
    assert.equal(plan.rows.labOrders, 4);
    assert.equal(plan.rows.messages, 12);
    assert.ok(plan.rows.insurancePolicies > 0);
    assert.ok(plan.rows.insuranceClaims > 0);
    assert.ok(plan.rows.notifications > 0);
    assert.equal(plan.rows.analyticsReports, 2);
    assert.equal(plan.rows.analyticsSchedules, 2);
  });

  it('preflights all non-optional tables used by the professional seed phases', () => {
    for (const tableName of [
      'doctor_schedule_templates',
      'patient_diseases',
      'patient_vaccinations',
      'patient_surgeries',
      'patient_family_history',
      'insurance_providers',
      'doctor_insurance_contracts',
      'patient_insurance_policies',
      'insurance_claims',
      'consent_documents',
      'patient_consents',
      'notification_events',
      'notification_deliveries',
    ]) {
      assert.ok(REQUIRED_OPERATIONAL_TABLES.includes(tableName), `${tableName} should be preflighted`);
    }
  });

  it('declares duplicate guards for every seed-owned write surface that carries the seed tag', () => {
    const duplicateTables = new Set(SEED_DUPLICATE_CHECKS.map((check) => check.table));

    for (const tableName of [
      'users',
      'clinics',
      'appointments',
      'precheck_forms',
      'medical_intake',
      'clinical_notes',
      'diagnoses',
      'prescriptions',
      'lab_orders',
      'imaging_orders',
      'clinical_documents',
      'care_tasks',
      'conversations',
      'messages',
      'payments',
      'patient_diseases',
      'patient_vaccinations',
      'patient_surgeries',
      'patient_family_history',
      'doctor_insurance_contracts',
      'patient_insurance_policies',
      'notification_events',
    ]) {
      assert.ok(duplicateTables.has(tableName), `${tableName} should have a duplicate guard`);
    }
  });

  it('renders duplicate-check seed templates without exposing broad wildcards by default', () => {
    assert.equal(
      renderSeedTemplate('seed.{seedTag}.%@example.invalid', 'ops_seed_test'),
      'seed.ops_seed_test.%@example.invalid',
    );
    assert.equal(
      renderSeedTemplate('SEED-{seedTag12}', 'ops_seed_20260517'),
      'SEED-ops_seed_202',
    );
  });

  it('does not expose keys in redacted runtime output', () => {
    const config = buildSeedRuntimeConfig({
      TENANT_SUPABASE_URL: 'https://example.supabase.co',
      TENANT_SUPABASE_ANON_KEY: 'anon-secret',
      TENANT_SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
      SEED_TARGET_DOCTOR_PASSWORD: 'doctor-password',
      SEED_TARGET_DOCTOR_EMAIL: 'owner@example.com',
      SEED_OPERATOR_PASSWORD: 'operator-password',
      SEED_OPERATOR_EMAIL: 'secretary@example.com',
      SEED_TAG: 'ops_seed_test',
    });

    const redacted = redactRuntimeConfig(config);

    assert.equal(redacted.tenantUrl, 'https://example.supabase.co');
    assert.equal(redacted.anonKey, '[redacted]');
    assert.equal(redacted.serviceRoleKey, '[redacted]');
    assert.equal(redacted.doctorPassword, '[redacted]');
    assert.equal(redacted.operatorPassword, '[redacted]');
    assert.equal(redacted.targetDoctorEmail, 'or***@example.com');
    assert.equal(redacted.operatorEmail, 'sy***@example.com');
    assert.equal(JSON.stringify(redacted).includes('service-role-secret'), false);
    assert.equal(JSON.stringify(redacted).includes('doctor-password'), false);
    assert.equal(JSON.stringify(redacted).includes('operator-password'), false);
    assert.equal(JSON.stringify(redacted).includes('owner@example.com'), false);
    assert.equal(JSON.stringify(redacted).includes('secretary@example.com'), false);
  });

  it('fails fast when live tenant credentials are missing', () => {
    const config = buildSeedRuntimeConfig({ SEED_TAG: 'ops_seed_test' });

    assert.throws(() => assertRuntimeConfig(config), /TENANT_SUPABASE_URL/);
    assert.throws(() => assertRuntimeConfig(config), /TENANT_SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('rejects malformed tenant URLs before any seed preflight runs', () => {
    const config = buildSeedRuntimeConfig({
      TENANT_SUPABASE_URL: 'not-a-url',
      TENANT_SUPABASE_ANON_KEY: 'anon-secret',
      TENANT_SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
      SEED_TAG: 'ops_seed_test',
    });

    assert.throws(() => assertRuntimeConfig(config), /valid HTTP\(S\) URL/);
  });
});

describe('tenant operational seed helpers', () => {
  it('uses deterministic example.invalid addresses per seed namespace', () => {
    assert.equal(
      seedEmail('ops_seed_test', 'patient', 7),
      'seed.ops_seed_test.patient007@example.invalid',
    );
  });

  it('masks human email identifiers for logs', () => {
    assert.equal(maskEmail('owner@example.com'), 'or***@example.com');
    assert.equal(maskEmail('a@example.com'), 'a***@example.com');
  });

  it('builds the expected default seed tag from UTC date', () => {
    assert.equal(defaultSeedTag(new Date('2026-01-02T23:59:59.000Z')), 'ops_seed_20260102');
  });

  it('redacts jwt-looking, service-role-looking, and Supabase secret strings from error output', () => {
    const serviceRoleLike = ['service', 'role', 'abc'].join('_');
    const supabaseSecretLike = ['sb', 'secret', 'abc123'].join('_');
    const jwtLike = ['eyJhbGciOiabc', 'def', 'ghi'].join('.');
    const message = safeErrorMessage(
      new Error(`bad key owner@example.com ${serviceRoleLike} ${supabaseSecretLike} ${jwtLike}`),
    );

    assert.equal(message.includes('owner@example.com'), false);
    assert.equal(message.includes(serviceRoleLike), false);
    assert.equal(message.includes(supabaseSecretLike), false);
    assert.equal(message.includes('eyJhbGciOiabc'), false);
    assert.match(message, /\[service-role-redacted\]/);
    assert.match(message, /\[supabase-secret-redacted\]/);
    assert.match(message, /\[email-redacted\]/);
    assert.match(message, /\[jwt-redacted\]/);
  });
});
