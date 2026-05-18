#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';

import { configureSupabaseClient, supabase } from '../packages/core/lib/supabase.js';
import { clinicService } from '../packages/core/services/clinics.js';
import { patientService } from '../packages/core/services/patients.js';
import { slotService } from '../packages/core/services/slots.js';
import { scheduleService } from '../packages/core/services/schedules.js';
import { appointmentService } from '../packages/core/services/appointments.js';
import { precheckService } from '../packages/core/services/prechecks.js';
import { intakeService } from '../packages/core/services/intakes.js';
import { clinicalService } from '../packages/core/services/clinical.js';
import { documentService } from '../packages/core/services/documents.js';
import { messagingService } from '../packages/core/services/messaging.js';
import { paymentService } from '../packages/core/services/payments.js';
import { insuranceService } from '../packages/core/services/insurance.js';
import { notificationCoreService } from '../packages/core/services/notificationCore.js';
import { tenantConfigService } from '../packages/core/services/tenantConfig.js';
import { analyticalReportService } from '../packages/core/services/analyticalReports.js';
import {
  OPTIONAL_ANALYTICS_TABLES,
  REQUIRED_OPERATIONAL_TABLES,
  SEED_DUPLICATE_CHECKS,
  assertRuntimeConfig,
  buildSeedPlan,
  buildSeedRuntimeConfig,
  maskEmail,
  printHelp,
  redactRuntimeConfig,
  renderSeedTemplate,
  safeErrorMessage,
  seedEmail,
} from './lib/tenant-operational-seed.mjs';

const FIRST_NAMES = [
  'Maya', 'Karim', 'Nour', 'Ali', 'Lina', 'Hassan', 'Rana', 'Omar',
  'Sara', 'Youssef', 'Layal', 'Tarek', 'Mariam', 'Fadi', 'Jana', 'Rami',
  'Lea', 'Nadine', 'Samir', 'Zeina',
];

const LAST_NAMES = [
  'Haddad', 'Khoury', 'Mansour', 'Saad', 'Nasser', 'Karam', 'Farah', 'Sayegh',
  'Aoun', 'Saliba', 'Hassan', 'Ibrahim', 'Maalouf', 'Daoud', 'Rahme', 'Najjar',
];

const CHIEF_COMPLAINTS = [
  'Persistent cough and fatigue for one week',
  'Follow-up for hypertension control',
  'Migraine episodes with nausea',
  'Abdominal discomfort after meals',
  'Medication review and refill',
  'Seasonal allergy flare-up',
  'Lower back pain after exercise',
  'Routine chronic disease follow-up',
];

const DIAGNOSES = [
  'Upper respiratory tract infection',
  'Essential hypertension',
  'Migraine without aura',
  'Gastroesophageal reflux disease',
  'Seasonal allergic rhinitis',
  'Mechanical lower back pain',
  'Type 2 diabetes mellitus follow-up',
  'Vitamin D deficiency',
];

const MEDICATIONS = [
  ['Amoxicillin', '500 mg', 'oral', 'three times daily', '7 days'],
  ['Paracetamol', '1 g', 'oral', 'as needed', '3 days'],
  ['Amlodipine', '5 mg', 'oral', 'once daily', '30 days'],
  ['Omeprazole', '20 mg', 'oral', 'once daily before breakfast', '14 days'],
  ['Loratadine', '10 mg', 'oral', 'once daily', '10 days'],
  ['Metformin', '500 mg', 'oral', 'twice daily with meals', '30 days'],
];

const SEED_OPERATOR_ROLES = Object.freeze(['admin', 'secretary']);

function log(message, details = null) {
  if (details === null || details === undefined) {
    console.log(`[tenant-seed] ${message}`);
    return;
  }
  console.log(`[tenant-seed] ${message}`, details);
}

function unwrap(result, context) {
  if (result?.error) {
    throw new Error(`${context}: ${safeErrorMessage(result.error)}`);
  }
  return result?.data;
}

function firstRow(value) {
  return Array.isArray(value) ? value[0] : value;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function hhmm(date) {
  return date.toISOString().slice(11, 16);
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86_400_000);
}

function seededName(index) {
  return {
    firstName: FIRST_NAMES[index % FIRST_NAMES.length],
    lastName: LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length],
  };
}

function patientDemographics(index) {
  const year = 1955 + (index % 48);
  const month = String((index % 12) + 1).padStart(2, '0');
  const day = String((index % 27) + 1).padStart(2, '0');
  const bloodTypes = ['A+', 'A-', 'B+', 'O+', 'O-', 'AB+'];
  return {
    date_of_birth: `${year}-${month}-${day}`,
    sex: index % 2 === 0 ? 'female' : 'male',
    blood_type: bloodTypes[index % bloodTypes.length],
    allergies: index % 5 === 0 ? 'Penicillin allergy reported.' : null,
    medical_history: index % 4 === 0 ? 'Chronic condition follow-up documented in seed workload.' : null,
    emergency_contact: `Seed relative ${index + 1}`,
    emergency_phone: `+9617000${String(index).padStart(4, '0')}`,
  };
}

function appointmentTimeline(plan, now = new Date()) {
  const rows = [];
  const pastTotal = plan.rows.completedAppointments + plan.rows.cancelledAppointments + plan.rows.noShowAppointments;
  const futureTotal = plan.rows.futureAppointments;

  for (let i = 0; i < plan.rows.completedAppointments; i++) {
    rows.push({ outcome: 'completed', sequence: i });
  }
  for (let i = 0; i < plan.rows.cancelledAppointments; i++) {
    rows.push({ outcome: 'cancelled', sequence: plan.rows.completedAppointments + i });
  }
  for (let i = 0; i < plan.rows.noShowAppointments; i++) {
    rows.push({ outcome: 'no_show', sequence: plan.rows.completedAppointments + plan.rows.cancelledAppointments + i });
  }
  for (let i = 0; i < futureTotal; i++) {
    rows.push({ outcome: i % 2 === 0 ? 'confirmed_future' : 'scheduled_future', sequence: pastTotal + i });
  }

  return rows.map((row, index) => {
    const isFuture = row.outcome.endsWith('_future');
    const dayOffset = isFuture
      ? 1 + (index % 30)
      : -180 + Math.floor((Math.max(0, index) / Math.max(1, pastTotal)) * 175);
    const slotNumber = index % 12;
    const hour = 8 + Math.floor(slotNumber / 2);
    const minute = slotNumber % 2 === 0 ? 0 : 30;
    const base = addDays(now, dayOffset);
    base.setUTCHours(hour, minute, 0, 0);

    return {
      ...row,
      index,
      start: base,
      end: addMinutes(base, 30),
    };
  });
}

async function tableProbe(tableName) {
  const { error } = await supabase
    .from(tableName)
    .select('id', { count: 'exact', head: true })
    .limit(1);
  return { tableName, ok: !error, error: error ? safeErrorMessage(error) : null };
}

async function selectProbe(tableName, columns) {
  const { error } = await supabase
    .from(tableName)
    .select(columns)
    .limit(1);
  return { tableName, columns, ok: !error, error: error ? safeErrorMessage(error) : null };
}

function applyDuplicateFilter(query, check, seedTag) {
  const value = renderSeedTemplate(check.value, seedTag);
  if (check.operator === 'eq') return query.eq(check.column, value);
  if (check.operator === 'ilike') return query.ilike(check.column, value);
  throw new Error(`Unsupported duplicate check operator: ${check.operator}`);
}

async function duplicateProbe(check, seedTag) {
  const { count, error } = await applyDuplicateFilter(
    supabase.from(check.table).select('id', { count: 'exact', head: true }),
    check,
    seedTag,
  );
  return {
    ...check,
    count: count || 0,
    ok: !error,
    error: error ? safeErrorMessage(error) : null,
  };
}

async function resolveTargetDoctor(config) {
  if (config.targetDoctorEmail) {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role')
      .eq('email', config.targetDoctorEmail)
      .maybeSingle();
    if (userError) throw new Error(`Target doctor user lookup failed: ${safeErrorMessage(userError)}`);
    if (!user) throw new Error(`No tenant user found for SEED_TARGET_DOCTOR_EMAIL=${maskEmail(config.targetDoctorEmail)}`);

    const { data: doctor, error: doctorError } = await supabase
      .from('doctors')
      .select('id, user_id, consultation_fee, users!doctors_user_id_fkey(id, email, first_name, last_name, role)')
      .eq('user_id', user.id)
      .maybeSingle();
    if (doctorError) throw new Error(`Target doctor profile lookup failed: ${safeErrorMessage(doctorError)}`);
    if (!doctor) throw new Error(`User ${maskEmail(config.targetDoctorEmail)} exists but has no doctors row.`);
    return doctor;
  }

  const { data, error } = await supabase
    .from('doctors')
    .select('id, user_id, consultation_fee, users!doctors_user_id_fkey(id, email, first_name, last_name, role)')
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) throw new Error(`Doctor lookup failed: ${safeErrorMessage(error)}`);
  if (!data?.[0]) throw new Error('No doctor row exists in this tenant. Run SaaS provisioning first.');
  return data[0];
}

async function resolveSeedOperator(config) {
  const select = 'id, email, first_name, last_name, role, is_active, auth_user_id';

  if (config.operatorEmail) {
    const { data: user, error } = await supabase
      .from('users')
      .select(select)
      .eq('email', config.operatorEmail)
      .maybeSingle();
    if (error) throw new Error(`Seed operator lookup failed: ${safeErrorMessage(error)}`);
    if (!user) {
      return {
        operator: null,
        blocker: `No tenant operator user found for SEED_OPERATOR_EMAIL=${maskEmail(config.operatorEmail)}.`,
      };
    }
    if (user.is_active === false) {
      return {
        operator: null,
        blocker: `Seed operator ${maskEmail(user.email)} is inactive.`,
      };
    }
    if (!SEED_OPERATOR_ROLES.includes(user.role)) {
      return {
        operator: null,
        blocker: `Seed operator ${maskEmail(user.email)} has role "${user.role}", but the seed requires ${SEED_OPERATOR_ROLES.join(' or ')} because clinics, schedules, slots, intake, and bookings are protected by staff RLS.`,
      };
    }
    return { operator: user, blocker: null };
  }

  const { data, error } = await supabase
    .from('users')
    .select(select)
    .in('role', SEED_OPERATOR_ROLES)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(20);
  if (error) throw new Error(`Seed operator lookup failed: ${safeErrorMessage(error)}`);

  const operator = (data || []).find((user) => user.role === 'admin') || data?.[0] || null;
  if (!operator) {
    return {
      operator: null,
      blocker: 'No active admin/secretary operator user exists in this tenant. Run SaaS provisioning/staff setup first or pass --operator-email for an existing admin/secretary account.',
    };
  }
  return { operator, blocker: null };
}

async function authenticateUserSession(config, adminClient, user, { password = '', label = 'seed operator' } = {}) {
  const email = user?.email;
  if (!email) {
    throw new Error(`Selected ${label} does not include an email. Cannot create an authenticated seed session.`);
  }

  const client = configureSupabaseClient({
    url: config.tenantUrl,
    anonKey: config.anonKey,
    options: {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  });

  if (password) {
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw new Error(`${label} password sign-in failed: ${safeErrorMessage(error)}`);
    if (!data?.session?.access_token || !data?.session?.refresh_token || !data?.user?.id) {
      throw new Error(`${label} password sign-in did not return a complete session.`);
    }
    return { authUser: data.user, session: data.session };
  }

  const generated = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (generated.error) {
    throw new Error(`${label} admin magic-link generation failed: ${safeErrorMessage(generated.error)}`);
  }

  const tokenHash = generated.data?.properties?.hashed_token;
  const emailOtp = generated.data?.properties?.email_otp;
  const verifyPayload = tokenHash
    ? { type: 'magiclink', token_hash: tokenHash }
    : { type: 'magiclink', email, token: emailOtp };

  const { data, error } = await client.auth.verifyOtp(verifyPayload);
  if (error) {
    throw new Error(`${label} seed session failed. Set SEED_OPERATOR_PASSWORD if this project cannot verify admin-generated magic links. ${safeErrorMessage(error)}`);
  }
  if (!data?.user?.id) {
    throw new Error(`${label} seed session did not return an authenticated user.`);
  }
  if (!data?.session?.access_token || !data?.session?.refresh_token) {
    throw new Error(`${label} seed session did not return complete session tokens.`);
  }

  return { authUser: data.user, session: data.session };
}

async function activateUserSession(config, authSession, expectedPublicUser, label) {
  const client = configureSupabaseClient({
    url: config.tenantUrl,
    anonKey: config.anonKey,
    options: {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  });
  if (!authSession?.session?.access_token || !authSession.session.refresh_token) {
    throw new Error(`${label} session is missing tokens.`);
  }

  const { data: sessionData, error: sessionError } = await client.auth.setSession({
    access_token: authSession.session.access_token,
    refresh_token: authSession.session.refresh_token,
  });
  if (sessionError) {
    throw new Error(`${label} session activation failed: ${safeErrorMessage(sessionError)}`);
  }
  if (sessionData?.user?.id !== authSession.authUser.id) {
    throw new Error(`${label} activated auth user does not match the cached session.`);
  }

  const { data: sessionPublicUser, error: sessionPublicUserError } = await supabase
    .from('users')
    .select('id, email, role, auth_user_id')
    .eq('auth_user_id', authSession.authUser.id)
    .maybeSingle();
  if (sessionPublicUserError) {
    throw new Error(`${label} public user verification failed: ${safeErrorMessage(sessionPublicUserError)}`);
  }
  if (sessionPublicUser?.id !== expectedPublicUser.id) {
    throw new Error(`${label} session user did not match the expected public user.`);
  }

  return sessionPublicUser;
}

async function fetchCatalogRows(tableName, columns = 'id, code, name') {
  const { data, error } = await supabase
    .from(tableName)
    .select(columns)
    .limit(50);
  if (error) {
    log(`catalog ${tableName} unavailable`, safeErrorMessage(error));
    return [];
  }
  return data || [];
}

async function resolvePredoctorForSeed(doctorId) {
  const { data, error } = await supabase
    .from('predoctors')
    .select('id, user_id, supervisor_id, status')
    .eq('supervisor_id', doctorId)
    .limit(1);
  if (error) {
    log('predoctor lookup skipped', safeErrorMessage(error));
    return null;
  }
  return data?.[0] || null;
}

async function preflight(config, plan) {
  const requiredTableResults = [];
  for (const tableName of REQUIRED_OPERATIONAL_TABLES) {
    requiredTableResults.push(await tableProbe(tableName));
  }

  const optionalAnalyticsResults = [];
  if (config.analyticsMode !== 'skip') {
    for (const tableName of OPTIONAL_ANALYTICS_TABLES) {
      optionalAnalyticsResults.push(await tableProbe(tableName));
    }
  }

  const criticalSelects = [
    await selectProbe('clinical_documents', 'id, template_id, finalized_by, voided_at, voided_by, void_reason, client_request_id'),
    await selectProbe('care_tasks', 'id, client_request_id'),
    await selectProbe('appointments', 'id, scheduled_at, duration_minutes, visit_type_id, booked_by'),
  ];

  const missingRequired = requiredTableResults.filter((r) => !r.ok);
  const missingAnalytics = optionalAnalyticsResults.filter((r) => !r.ok);
  const selectFailures = criticalSelects.filter((r) => !r.ok);
  const readyTables = new Set([
    ...requiredTableResults.filter((r) => r.ok).map((r) => r.tableName),
    ...optionalAnalyticsResults.filter((r) => r.ok).map((r) => r.tableName),
  ]);
  const duplicateResults = [];
  for (const check of SEED_DUPLICATE_CHECKS) {
    if (!readyTables.has(check.table)) continue;
    if (check.optional && config.analyticsMode === 'skip') continue;
    duplicateResults.push(await duplicateProbe(check, plan.seedTag));
  }
  const duplicateSeedRows = duplicateResults.filter((r) => r.ok && r.count > 0);
  const duplicateProbeFailures = duplicateResults.filter((r) => !r.ok && !r.optional);
  const doctor = await resolveTargetDoctor(config);
  const { operator, blocker: operatorBlocker } = await resolveSeedOperator(config);

  const { count: duplicateCount, error: duplicateError } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('doctor_id', doctor.id)
    .ilike('reason', `%[seed:${plan.seedTag}]%`);
  if (duplicateError) {
    throw new Error(`Duplicate seed check failed: ${safeErrorMessage(duplicateError)}`);
  }

  const blockers = [
    ...missingRequired.map((r) => `Missing required table ${r.tableName}: ${r.error}`),
    ...selectFailures.map((r) => `Critical select failed on ${r.tableName}: ${r.error}`),
    ...duplicateProbeFailures.map((r) => `Duplicate seed probe failed for ${r.table}: ${r.error}`),
  ];
  if (operatorBlocker) {
    blockers.push(operatorBlocker);
  }
  if (!doctor.users?.email) {
    blockers.push('Target doctor row does not include an email, so the seed cannot execute doctor-scoped precheck and clinical service calls through RLS.');
  }
  if (config.analyticsMode === 'require') {
    blockers.push(...missingAnalytics.map((r) => `Missing analytics table ${r.tableName}: ${r.error}`));
  }
  if ((duplicateCount > 0 || duplicateSeedRows.length > 0) && !config.allowDuplicates) {
    const duplicateSummary = duplicateSeedRows
      .map((r) => `${r.label}: ${r.count}`)
      .join(', ');
    blockers.push(`Seed tag "${plan.seedTag}" already exists (${duplicateSummary || `${duplicateCount} appointment(s)`}). Use --allow-duplicates to intentionally resume/append or choose a new --seed-tag.`);
  }

  return {
    doctor,
    operator,
    duplicateCount: duplicateCount || 0,
    duplicateResults,
    requiredTableResults,
    optionalAnalyticsResults,
    criticalSelects,
    analyticsAvailable: optionalAnalyticsResults.length > 0 && optionalAnalyticsResults.every((r) => r.ok),
    blockers,
  };
}

async function waitForPublicUser(dbClient, email) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const { data, error } = await dbClient
      .from('users')
      .select('id, email, first_name, last_name, phone, role, is_active')
      .eq('email', email)
      .maybeSingle();
    if (error) throw new Error(`Public user lookup failed for ${email}: ${safeErrorMessage(error)}`);
    if (data) return data;
    await delay(250);
  }
  throw new Error(`Auth trigger did not create public.users row for ${email}.`);
}

async function ensureAuthBackedUser(adminClient, { email, role, firstName, lastName, phone }) {
  const { data: existing, error: existingError } = await adminClient
    .from('users')
    .select('id, email, first_name, last_name, phone, role, is_active')
    .eq('email', email)
    .maybeSingle();
  if (existingError) throw new Error(`Existing user lookup failed for ${email}: ${safeErrorMessage(existingError)}`);
  if (existing && existing.role !== role) {
    throw new Error(`Seed email ${email} already belongs to role "${existing.role}", expected "${role}". Use a different SEED_TAG.`);
  }

  if (!existing) {
    const password = `Seed-${randomUUID()}-DoctoLeb!`;
    const { error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role,
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`,
        phone,
      },
    });
    if (createError) throw new Error(`Auth user creation failed for ${email}: ${safeErrorMessage(createError)}`);
  }

  return existing || await waitForPublicUser(adminClient, email);
}

async function ensureSeedPatient(adminClient, config, index, actorUserId) {
  const { firstName, lastName } = seededName(index);
  const phone = `+961710${String(index).padStart(5, '0')}`;
  const email = seedEmail(config.seedTag, 'patient', index + 1);
  const user = await ensureAuthBackedUser(adminClient, {
    email,
    role: 'patient',
    firstName,
    lastName,
    phone,
  });

  let { data: patient, error: patientLookupError } = await supabase
    .from('patients')
    .select('id, user_id, intake_completed_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (patientLookupError) throw new Error(`Patient lookup failed for ${email}: ${safeErrorMessage(patientLookupError)}`);

  const demographics = patientDemographics(index);
  if (!patient) {
    const created = unwrap(await patientService.create({
      user_id: user.id,
      ...demographics,
    }), `patientService.create(${email})`);
    patient = firstRow(created);
  }

  unwrap(await patientService.updateUserInfo(user.id, {
    firstName,
    lastName,
    phone,
  }), `patientService.updateUserInfo(${email})`);
  const updatedPatient = firstRow(unwrap(await patientService.update(patient.id, demographics), `patientService.update(${email})`));

  unwrap(await intakeService.saveDraft({
    patient_id: patient.id,
    collected_by: actorUserId,
    marital_status: index % 3 === 0 ? 'married' : 'single',
    living_with: index % 2 === 0 ? 'Family' : 'Alone',
    smoking_status: index % 5 === 0 ? 'former' : 'never',
    alcohol_use: 'none',
    exercise_frequency: index % 4 === 0 ? 'weekly' : 'rare',
    allergies_text: demographics.allergies,
    current_medications_text: index % 4 === 0 ? 'Long-term medication documented in seed intake.' : null,
    notes: `[seed:${config.seedTag}] Completed synthetic intake for dashboard testing.`,
  }), `intakeService.saveDraft(${email})`);

  unwrap(await intakeService.markCompleted(patient.id, actorUserId), `intakeService.markCompleted(${email})`);

  return {
    user,
    patient: updatedPatient || patient,
    displayName: `${firstName} ${lastName}`,
  };
}

async function ensureSeedClinic(config) {
  const clinicName = `DoctoLeb Seed Clinic (${config.seedTag})`;
  const existing = unwrap(await clinicService.getAll({ includeArchived: true, page: 1, pageSize: 200 }), 'clinicService.getAll');
  const match = existing.find((clinic) => clinic.name === clinicName);
  if (match) return match;

  return unwrap(await clinicService.create({
    name: clinicName,
    address: 'Seeded operational data location, Beirut',
    location_type: 'private_clinic',
    phone: '+96171000000',
    is_primary: false,
    notes: `[seed:${config.seedTag}] Synthetic clinic for dashboard workload testing.`,
    working_hours: {
      monday: ['08:00', '17:00'],
      tuesday: ['08:00', '17:00'],
      wednesday: ['08:00', '17:00'],
      thursday: ['08:00', '17:00'],
      friday: ['08:00', '14:00'],
    },
  }), 'clinicService.create');
}

async function ensureSeedScheduleTemplates({ config, doctor, clinic }) {
  const existing = unwrap(
    await scheduleService.getTemplatesByDoctor(doctor.id, { activeOnly: true, page: 1, pageSize: 200 }),
    'scheduleService.getTemplatesByDoctor',
  );
  const templateSpecs = [
    { weekday: 1, start_time: '08:00', end_time: '12:00', slot_duration_minutes: 30 },
    { weekday: 3, start_time: '13:00', end_time: '17:00', slot_duration_minutes: 30 },
    { weekday: 5, start_time: '09:00', end_time: '14:00', slot_duration_minutes: 30 },
  ];

  let created = 0;
  for (const spec of templateSpecs) {
    const exists = existing.some((template) => (
      template.clinic_id === clinic.id
      && template.weekday === spec.weekday
      && String(template.start_time).slice(0, 5) === spec.start_time
      && String(template.end_time).slice(0, 5) === spec.end_time
    ));
    if (exists) continue;

    unwrap(await scheduleService.createTemplate({
      doctor_id: doctor.id,
      clinic_id: clinic.id,
      ...spec,
      is_active: true,
      effective_from: isoDate(addDays(new Date(), -180)),
    }), `scheduleService.createTemplate(${config.seedTag}:${spec.weekday})`);
    created++;
  }
  log(`schedule templates ready, created=${created}`);
}

async function backdate(dbClient, tableName, id, patch, warnings) {
  const { error } = await dbClient
    .from(tableName)
    .update(patch)
    .eq('id', id);
  if (error) {
    warnings.push(`Backdate skipped for ${tableName}.${id}: ${safeErrorMessage(error)}`);
  }
}

async function resolveEncounterFromStart(appointmentId, startedData) {
  if (startedData?.id) return startedData;
  if (typeof startedData === 'string') {
    const byId = unwrap(await clinicalService.getEncounterById(startedData), 'clinicalService.getEncounterById');
    if (byId) return byId;
  }
  const byAppointment = unwrap(await clinicalService.getEncounterByAppointmentId(appointmentId), 'clinicalService.getEncounterByAppointmentId');
  if (!byAppointment) throw new Error(`Encounter was not found after start_encounter for appointment ${appointmentId}`);
  return byAppointment;
}

async function createFinalizedDocument({ config, payload, context, at, warnings, adminClient }) {
  const document = firstRow(unwrap(await context.create(payload), context.label));
  if (!document?.id) return null;

  unwrap(await documentService.finalize(document.id), `${context.label}.finalize`);
  if (config.backdate) {
    await backdate(adminClient, 'clinical_documents', document.id, {
      created_at: at.toISOString(),
      finalized_at: addMinutes(at, 20).toISOString(),
      updated_at: addMinutes(at, 20).toISOString(),
    }, warnings);
  }
  return document;
}

async function seedClinicalVisit({ config, doctor, patient, appointment, encounter, actorUserId, index, catalogs, warnings, at, adminClient }) {
  const complaint = CHIEF_COMPLAINTS[index % CHIEF_COMPLAINTS.length];
  const diagnosisText = DIAGNOSES[index % DIAGNOSES.length];
  const disease = catalogs.diseases[index % Math.max(1, catalogs.diseases.length)];

  const note = unwrap(await clinicalService.addNote({
    encounter_id: encounter.id,
    patient_id: patient.patient.id,
    doctor_id: doctor.id,
    author_user_id: actorUserId,
    note_type: 'general',
    content: `[seed:${config.seedTag}] ${complaint}. Vitals stable. Patient advised on follow-up and warning signs.`,
    visibility: 'clinical',
  }), 'clinicalService.addNote');

  unwrap(await clinicalService.addDiagnosis({
    encounter_id: encounter.id,
    patient_id: patient.patient.id,
    doctor_id: doctor.id,
    disease_id: disease?.id || null,
    diagnosis_text: diagnosisText,
    diagnosis_type: 'primary',
    status: index % 7 === 0 ? 'resolved' : 'active',
    onset_date: isoDate(addDays(at, -3)),
    notes: `[seed:${config.seedTag}] Diagnosis generated for operational dashboard testing.`,
    recorded_by: actorUserId,
  }), 'clinicalService.addDiagnosis');

  if (index % 4 !== 0) {
    const [name, dosage, route, frequency, duration] = MEDICATIONS[index % MEDICATIONS.length];
    unwrap(await clinicalService.addPrescription({
      encounter_id: encounter.id,
      patient_id: patient.patient.id,
      doctor_id: doctor.id,
      medication_name: name,
      dosage,
      route,
      frequency,
      duration,
      instructions: `[seed:${config.seedTag}] Take as prescribed. Review if symptoms worsen.`,
      start_date: isoDate(at),
      status: 'active',
      prescribed_by: actorUserId,
    }), 'clinicalService.addPrescription');
  }

  if (index % 3 === 0) {
    unwrap(await clinicalService.createOrder('lab', {
      encounter_id: encounter.id,
      patient_id: patient.patient.id,
      doctor_id: doctor.id,
      title: index % 2 === 0 ? 'CBC with differential' : 'Basic metabolic panel',
      instructions: `[seed:${config.seedTag}] Routine lab follow-up.`,
      status: 'ordered',
      ordered_at: at.toISOString(),
      ordered_by: actorUserId,
    }), 'clinicalService.createOrder(lab)');
  }

  if (index % 7 === 0) {
    unwrap(await clinicalService.createOrder('imaging', {
      encounter_id: encounter.id,
      patient_id: patient.patient.id,
      doctor_id: doctor.id,
      imaging_type: 'Ultrasound',
      body_area: 'Abdomen',
      instructions: `[seed:${config.seedTag}] Imaging requested after clinical assessment.`,
      status: 'ordered',
      ordered_at: at.toISOString(),
      ordered_by: actorUserId,
    }), 'clinicalService.createOrder(imaging)');
  }

  if (index % 2 === 0) {
    await createFinalizedDocument({
      config,
      context: { label: 'documentService.createReport', create: (payload) => documentService.createReport(payload) },
      at,
      warnings,
      adminClient,
      payload: {
        patient_id: patient.patient.id,
        encounter_id: encounter.id,
        doctor_id: doctor.id,
        title: `Seed Medical Report ${index + 1} (${config.seedTag})`,
        content: `[seed:${config.seedTag}] Medical report for ${patient.displayName}. Main assessment: ${diagnosisText}.`,
        created_by: actorUserId,
        client_request_id: randomUUID(),
      },
    });
  }

  if (index % 4 === 0) {
    await createFinalizedDocument({
      config,
      context: { label: 'documentService.createReferral', create: (payload) => documentService.createReferral(payload) },
      at: addMinutes(at, 3),
      warnings,
      adminClient,
      payload: {
        patient_id: patient.patient.id,
        encounter_id: encounter.id,
        doctor_id: doctor.id,
        title: `Seed Referral Letter ${index + 1} (${config.seedTag})`,
        referring_to: 'Cardiology specialist',
        reason: `[seed:${config.seedTag}] Referral for specialist review after ${diagnosisText.toLowerCase()}.`,
        patient_status: index % 8 === 0 ? 'urgent' : 'routine',
        clinical_findings: complaint,
        treatment_plan: 'Continue current care plan until specialist review.',
        created_by: actorUserId,
        client_request_id: randomUUID(),
      },
    });
  }

  if (index % 6 === 0) {
    await createFinalizedDocument({
      config,
      context: { label: 'documentService.createCertificate', create: (payload) => documentService.createCertificate(payload) },
      at: addMinutes(at, 6),
      warnings,
      adminClient,
      payload: {
        patient_id: patient.patient.id,
        encounter_id: encounter.id,
        doctor_id: doctor.id,
        title: `Seed Medical Certificate ${index + 1} (${config.seedTag})`,
        diagnosis: diagnosisText,
        treatment: 'Outpatient treatment and rest advised.',
        recommendations: 'Avoid strenuous activity and follow up if symptoms persist.',
        start_date: isoDate(at),
        end_date: isoDate(addDays(at, 2)),
        issuer: doctor.users?.first_name ? `Dr. ${doctor.users.first_name}` : 'Seed doctor',
        created_by: actorUserId,
        client_request_id: randomUUID(),
      },
    });
  }

  if (index % 3 === 0) {
    await createFinalizedDocument({
      config,
      context: { label: 'documentService.createLabRequest', create: (payload) => documentService.createLabRequest(payload) },
      at: addMinutes(at, 9),
      warnings,
      adminClient,
      payload: {
      patient_id: patient.patient.id,
      encounter_id: encounter.id,
      doctor_id: doctor.id,
        title: `Seed Lab Request ${index + 1} (${config.seedTag})`,
        content: `[seed:${config.seedTag}] Requested tests: CBC, basic metabolic panel. Clinical reason: ${complaint}.`,
      created_by: actorUserId,
      client_request_id: randomUUID(),
      },
    });
  }

  if (index % 5 === 0) {
    const task = unwrap(await clinicalService.createCareTask({
      patient_id: patient.patient.id,
      encounter_id: encounter.id,
      appointment_id: appointment.id,
      assigned_to: actorUserId,
      created_by: actorUserId,
      task_type: 'follow_up',
      title: `Follow up with ${patient.displayName}`,
      description: `[seed:${config.seedTag}] Call patient to review symptoms and lab readiness.`,
      due_at: addDays(at, 7).toISOString(),
      priority: index % 10 === 0 ? 'high' : 'normal',
      status: 'open',
      client_request_id: randomUUID(),
    }), 'clinicalService.createCareTask');
    if (task?.id && index % 10 !== 0) {
      unwrap(await clinicalService.transitionCareTask(task.id, 'done', {
        completed_at: addDays(at, 1).toISOString(),
      }), 'clinicalService.transitionCareTask(done)');
    }
    if (config.backdate && task?.id) {
      await backdate(adminClient, 'care_tasks', task.id, {
        created_at: at.toISOString(),
        updated_at: addDays(at, 1).toISOString(),
      }, warnings);
    }
  }

  if (config.backdate && note?.id) {
    await backdate(adminClient, 'clinical_notes', note.id, {
      created_at: addMinutes(at, 8).toISOString(),
      updated_at: addMinutes(at, 8).toISOString(),
    }, warnings);
  }
}

async function seedAppointmentFlow({
  config,
  doctor,
  clinic,
  patient,
  operatorUserId,
  clinicalUserId,
  operatorSession,
  doctorSession,
  operator,
  doctorUser,
  predoctorId,
  visitType,
  catalogs,
  timeline,
  warnings,
  adminClient,
}) {
  await activateUserSession(config, operatorSession, operator, 'seed operator');
  const slot = unwrap(await slotService.createManualSlot({
    doctor_id: doctor.id,
    clinic_id: clinic.id,
    date: isoDate(timeline.start),
    start_time: hhmm(timeline.start),
    end_time: hhmm(timeline.end),
    is_active: true,
    created_by: operatorUserId,
  }), 'slotService.createManualSlot');

  const booked = unwrap(await appointmentService.bookFromSlot({
    slotId: slot.id,
    patientId: patient.patient.id,
    bookedBy: operatorUserId,
    visitTypeId: visitType?.id || null,
    reason: `[seed:${config.seedTag}] ${CHIEF_COMPLAINTS[timeline.index % CHIEF_COMPLAINTS.length]}`,
    durationMinutes: 30,
  }), 'appointmentService.bookFromSlot');
  const appointment = firstRow(booked);

  if (timeline.outcome === 'cancelled') {
    unwrap(await appointmentService.cancel(appointment.id, `[seed:${config.seedTag}] Patient requested another date.`), 'appointmentService.cancel');
    return { appointmentId: appointment.id, outcome: 'cancelled' };
  }

  if (timeline.outcome === 'no_show') {
    unwrap(await appointmentService.update(appointment.id, { status: 'no_show' }), 'appointmentService.update(no_show)');
    return { appointmentId: appointment.id, outcome: 'no_show' };
  }

  if (timeline.outcome === 'scheduled_future') {
    return { appointmentId: appointment.id, outcome: 'scheduled_future' };
  }

  unwrap(await appointmentService.update(appointment.id, { status: 'confirmed' }), 'appointmentService.update(confirmed)');
  if (timeline.outcome === 'confirmed_future') {
    return { appointmentId: appointment.id, outcome: 'confirmed_future' };
  }

  unwrap(await appointmentService.markPreChecked(appointment.id), 'appointmentService.markPreChecked');
  await activateUserSession(config, doctorSession, doctorUser, 'target doctor');
  unwrap(await precheckService.submit({
    patientId: patient.patient.id,
    predoctorId: timeline.index % 2 === 0 ? predoctorId : null,
    bloodPressure: `${110 + (timeline.index % 20)}/${70 + (timeline.index % 15)}`,
    heartRate: 64 + (timeline.index % 28),
    temperature: 36.4 + ((timeline.index % 6) / 10),
    weight: 58 + (timeline.index % 35),
    height: 155 + (timeline.index % 35),
    currentMedications: timeline.index % 4 === 0 ? 'Existing chronic medication documented.' : 'None reported.',
    allergies: patient.patient.allergies || 'No known allergies.',
    symptoms: `[seed:${config.seedTag}] ${CHIEF_COMPLAINTS[timeline.index % CHIEF_COMPLAINTS.length]}`,
    isUrgent: timeline.index % 17 === 0,
  }), 'precheckService.submit');

  unwrap(await appointmentService.update(appointment.id, { status: 'in_consultation' }), 'appointmentService.update(in_consultation)');
  const started = unwrap(await clinicalService.startEncounter(appointment.id, {
    chiefComplaint: CHIEF_COMPLAINTS[timeline.index % CHIEF_COMPLAINTS.length],
  }), 'clinicalService.startEncounter');
  const encounter = await resolveEncounterFromStart(appointment.id, started);

  if (config.backdate) {
    await backdate(adminClient, 'encounters', encounter.id, {
      started_at: addMinutes(timeline.start, 5).toISOString(),
      created_at: addMinutes(timeline.start, 5).toISOString(),
      updated_at: addMinutes(timeline.start, 5).toISOString(),
    }, warnings);
  }

  await seedClinicalVisit({
    config,
    doctor,
    patient,
    appointment,
    encounter,
    actorUserId: clinicalUserId,
    index: timeline.index,
    catalogs,
    warnings,
    at: timeline.start,
    adminClient,
  });

  unwrap(await clinicalService.completeEncounter(encounter.id, {
    summary: `[seed:${config.seedTag}] Visit completed. Follow-up plan communicated to patient.`,
  }), 'clinicalService.completeEncounter');
  unwrap(await appointmentService.markCompleted(appointment.id), 'appointmentService.markCompleted');

  if (config.backdate) {
    await backdate(adminClient, 'encounters', encounter.id, {
      ended_at: addMinutes(timeline.start, 25).toISOString(),
      updated_at: addMinutes(timeline.start, 25).toISOString(),
    }, warnings);
  }

  if (timeline.index % 6 !== 0) {
    const payment = unwrap(await paymentService.create({
      patient_id: patient.patient.id,
      doctor_id: doctor.id,
      appointment_id: appointment.id,
      amount: Number(doctor.consultation_fee || 45) + (timeline.index % 4) * 5,
      currency: 'USD',
      payment_method: 'cash',
      transaction_id: `${config.seedTag}-${String(timeline.index + 1).padStart(4, '0')}`,
    }), 'paymentService.create');
    unwrap(await paymentService.update(payment.id, { status: 'completed' }), 'paymentService.update(completed)');
    if (config.backdate) {
      await backdate(adminClient, 'payments', payment.id, {
        created_at: addMinutes(timeline.start, 30).toISOString(),
        updated_at: addMinutes(timeline.start, 35).toISOString(),
      }, warnings);
    }
  }

  return {
    appointmentId: appointment.id,
    encounterId: encounter.id,
    outcome: 'completed',
    appointment,
    encounter,
    patient,
    at: timeline.start,
  };
}

async function seedConversations({
  config,
  plan,
  patients,
  operatorUserId,
  operator,
  operatorSession,
  warnings,
  adminClient,
}) {
  const count = Math.min(plan.rows.conversations, patients.length);
  const patientSessions = new Map();
  let messages = 0;
  const getPatientSession = async (patient) => {
    if (!patientSessions.has(patient.user.id)) {
      patientSessions.set(
        patient.user.id,
        await authenticateUserSession(config, adminClient, patient.user, {
          label: 'seed patient',
        }),
      );
    }
    return patientSessions.get(patient.user.id);
  };

  for (let i = 0; i < count; i++) {
    await activateUserSession(config, operatorSession, operator, 'seed operator');
    const patient = patients[i % patients.length];
    const conversation = unwrap(await messagingService.createConversation({
      patient_id: patient.patient.id,
      subject: `[seed:${config.seedTag}] Follow-up conversation ${i + 1}`,
      conversation_type: 'patient_staff',
      created_by: operatorUserId,
    }), 'messagingService.createConversation');

    await unwrap(await messagingService.addParticipant({
      conversation_id: conversation.id,
      user_id: operatorUserId,
      role: operator.role,
    }), 'messagingService.addParticipant(operator)');
    await unwrap(await messagingService.addParticipant({
      conversation_id: conversation.id,
      user_id: patient.user.id,
      patient_id: patient.patient.id,
      role: 'patient',
    }), 'messagingService.addParticipant(patient)');

    const baseMessages = Math.floor(plan.rows.messages / Math.max(1, count));
    const extraMessages = plan.rows.messages % Math.max(1, count);
    const messageCount = Math.max(2, baseMessages + (i < extraMessages ? 1 : 0));
    for (let m = 0; m < messageCount; m++) {
      const fromPatient = m % 2 === 0;
      if (fromPatient) {
        const patientSession = await getPatientSession(patient);
        await activateUserSession(config, patientSession, patient.user, 'seed patient');
      } else {
        await activateUserSession(config, operatorSession, operator, 'seed operator');
      }
      const message = unwrap(await messagingService.sendMessage({
        conversation_id: conversation.id,
        sender_user_id: fromPatient ? patient.user.id : operatorUserId,
        sender_patient_id: fromPatient ? patient.patient.id : null,
        body: fromPatient
          ? `[seed:${config.seedTag}] Hello doctor, I have a question about my follow-up instructions.`
          : `[seed:${config.seedTag}] Thank you ${patient.displayName}. Please monitor symptoms and contact us if they worsen.`,
        message_type: 'text',
        is_internal: false,
        client_request_id: randomUUID(),
      }), 'messagingService.sendMessage');
      messages++;
      if (!fromPatient && message?.id) {
        const patientSession = await getPatientSession(patient);
        await activateUserSession(config, patientSession, patient.user, 'seed patient');
        await unwrap(await messagingService.markRead(message.id, patient.user.id), 'messagingService.markRead');
      }
      if (config.backdate && message?.id) {
        await backdate(adminClient, 'messages', message.id, {
          created_at: addDays(new Date(), -Math.max(1, count - i)).toISOString(),
          updated_at: addDays(new Date(), -Math.max(1, count - i)).toISOString(),
        }, warnings);
      }
    }
  }
  log(`seeded conversations=${count}, messages=${messages}`);
}

async function seedPatientHistories({ config, patients, catalogs, actorUserId }) {
  let records = 0;
  for (let i = 0; i < patients.length; i++) {
    const patient = patients[i];
    const disease = catalogs.diseases[i % Math.max(1, catalogs.diseases.length)];
    const vaccine = catalogs.vaccines[i % Math.max(1, catalogs.vaccines.length)];
    const surgeryType = catalogs.surgeryTypes[i % Math.max(1, catalogs.surgeryTypes.length)];
    const relation = catalogs.familyRelations[i % Math.max(1, catalogs.familyRelations.length)];

    if (disease?.id) {
      unwrap(await intakeService.addHistory('diseases', {
        patient_id: patient.patient.id,
        disease_id: disease.id,
        status: i % 4 === 0 ? 'chronic' : 'resolved',
        severity: ['mild', 'moderate', 'severe'][i % 3],
        diagnosed_at: isoDate(addDays(new Date(), -90 - i)),
        notes: `[seed:${config.seedTag}] Medical history disease record for dashboard testing.`,
        recorded_by: actorUserId,
      }), 'intakeService.addHistory(diseases)');
      records++;
    }

    if (vaccine?.id && i % 2 === 0) {
      unwrap(await intakeService.addHistory('vaccinations', {
        patient_id: patient.patient.id,
        vaccine_id: vaccine.id,
        status: 'received',
        given_at: isoDate(addDays(new Date(), -30 - i)),
        dose_number: 1 + (i % 3),
        administered_by: 'Seed clinic nurse',
        notes: `[seed:${config.seedTag}] Vaccination history generated for operational testing.`,
        recorded_by: actorUserId,
      }), 'intakeService.addHistory(vaccinations)');
      records++;
    }

    if (surgeryType?.id && i % 5 === 0) {
      unwrap(await intakeService.addHistory('surgeries', {
        patient_id: patient.patient.id,
        surgery_type_id: surgeryType.id,
        performed_at: isoDate(addDays(new Date(), -600 - i)),
        hospital_name: 'Seed General Hospital',
        surgeon_name: 'Dr. Seed Surgeon',
        notes: `[seed:${config.seedTag}] Historical surgery record for chart completeness.`,
        recorded_by: actorUserId,
      }), 'intakeService.addHistory(surgeries)');
      records++;
    }

    if (i % 3 === 0) {
      unwrap(await intakeService.addHistory('family_history', {
        patient_id: patient.patient.id,
        relation_id: relation?.id || null,
        disease_id: disease?.id || null,
        condition_text: disease?.id ? null : 'Family cardiovascular history',
        age_at_onset: 45 + (i % 30),
        is_deceased: i % 9 === 0,
        notes: `[seed:${config.seedTag}] Family history entry for risk context.`,
        recorded_by: actorUserId,
      }), 'intakeService.addHistory(family_history)');
      records++;
    }
  }
  log(`seeded patient history records=${records}`);
}

async function seedPatientConsents({ config, patients, actorUserId }) {
  const documents = unwrap(
    await tenantConfigService.getConsentDocuments({ activeOnly: true, audience: 'patient', page: 1, pageSize: 20 }),
    'tenantConfigService.getConsentDocuments',
  );
  if (!documents.length) {
    log('patient consent seed skipped because no active patient consent documents exist');
    return;
  }

  let accepted = 0;
  const patientLimit = Math.min(patients.length, Math.ceil(patients.length * 0.4));
  for (const patient of patients.slice(0, patientLimit)) {
    for (const document of documents.slice(0, 2)) {
      unwrap(await tenantConfigService.acceptConsent({
        patient_id: patient.patient.id,
        consent_document_id: document.id,
        accepted_by_user_id: actorUserId,
        acceptance_method: 'staff_assisted',
      }), 'tenantConfigService.acceptConsent');
      accepted++;
    }
  }
  log(`seeded patient consents=${accepted}`);
}

async function seedInsurance({ config, plan, doctor, patients, completedVisits, actorUserId, warnings, adminClient }) {
  const providers = unwrap(
    await insuranceService.getProviders({ activeOnly: true, page: 1, pageSize: 20 }),
    'insuranceService.getProviders',
  );
  if (!providers.length) {
    log('insurance seed skipped because no active insurance providers exist');
    return;
  }

  for (const provider of providers.slice(0, 2)) {
    unwrap(await insuranceService.saveDoctorContract({
      doctor_id: doctor.id,
      provider_id: provider.id,
      doctor_provider_code: `SEED-${config.seedTag.slice(0, 12)}`,
      contract_number: `CN-${config.seedTag}-${provider.code || provider.id.slice(0, 6)}`,
      valid_from: isoDate(addDays(new Date(), -180)),
      valid_to: isoDate(addDays(new Date(), 365)),
      is_active: true,
    }), 'insuranceService.saveDoctorContract');
  }

  const policyByPatientId = new Map();
  const policyCount = Math.min(plan.rows.insurancePolicies, patients.length);
  for (let i = 0; i < policyCount; i++) {
    const patient = patients[i];
    const provider = providers[i % providers.length];
    const policy = unwrap(await insuranceService.savePatientPolicy({
      patient_id: patient.patient.id,
      provider_id: provider.id,
      policy_number: `POL-${config.seedTag}-${String(i + 1).padStart(3, '0')}`,
      policyholder_name: patient.displayName,
      valid_from: isoDate(addDays(new Date(), -90)),
      valid_to: isoDate(addDays(new Date(), 365)),
      is_primary: true,
    }), 'insuranceService.savePatientPolicy');
    policyByPatientId.set(patient.patient.id, policy);
  }

  let claims = 0;
  for (const visit of completedVisits.slice(0, plan.rows.insuranceClaims)) {
    const policy = policyByPatientId.get(visit.patient.patient.id);
    if (!policy) continue;
    const claim = unwrap(await insuranceService.createClaim({
      encounter_id: visit.encounterId,
      patient_id: visit.patient.patient.id,
      doctor_id: doctor.id,
      policy_id: policy.id,
      amount: 45 + (claims % 4) * 10,
      amount_paid_by_insurer: claims % 3 === 0 ? 0 : 30,
      amount_paid_by_patient: claims % 3 === 0 ? 0 : 15,
      diagnosis_code: 'SEED',
      status: claims % 3 === 0 ? 'submitted' : 'paid',
      submitted_at: addMinutes(visit.at, 60).toISOString(),
      paid_at: claims % 3 === 0 ? null : addDays(visit.at, 10).toISOString(),
      created_by: actorUserId,
    }), 'insuranceService.createClaim');
    if (config.backdate && claim?.id) {
      await backdate(adminClient, 'insurance_claims', claim.id, {
        created_at: addMinutes(visit.at, 55).toISOString(),
        updated_at: addDays(visit.at, claims % 3 === 0 ? 1 : 10).toISOString(),
      }, warnings);
    }
    claims++;
  }
  log(`seeded insurance policies=${policyByPatientId.size}, claims=${claims}`);
}

async function seedNotifications({ config, plan, completedVisits, actorUserId, warnings, adminClient }) {
  let notifications = 0;
  for (const visit of completedVisits.slice(0, plan.rows.notifications)) {
    const event = unwrap(await notificationCoreService.createEvent({
      user_id: visit.patient.user.id,
      patient_id: visit.patient.patient.id,
      title: 'Visit follow-up ready',
      body: `[seed:${config.seedTag}] Your visit summary and care instructions are ready.`,
      event_type: 'appointment_follow_up',
      related_type: 'appointment',
      related_id: visit.appointmentId,
      severity: notifications % 5 === 0 ? 'warning' : 'info',
      status: 'sent',
      created_by: actorUserId,
      client_request_id: randomUUID(),
    }), 'notificationCoreService.createEvent');

    const delivery = unwrap(await notificationCoreService.createDelivery({
      event_id: event.id,
      user_id: visit.patient.user.id,
      channel: 'in_app',
      status: notifications % 3 === 0 ? 'read' : 'sent',
      sent_at: addMinutes(visit.at, 45).toISOString(),
      read_at: notifications % 3 === 0 ? addMinutes(visit.at, 60).toISOString() : null,
      client_request_id: randomUUID(),
    }), 'notificationCoreService.createDelivery');

    if (config.backdate) {
      await backdate(adminClient, 'notification_events', event.id, {
        created_at: addMinutes(visit.at, 40).toISOString(),
        updated_at: addMinutes(visit.at, 40).toISOString(),
      }, warnings);
      await backdate(adminClient, 'notification_deliveries', delivery.id, {
        created_at: addMinutes(visit.at, 45).toISOString(),
        updated_at: addMinutes(visit.at, 60).toISOString(),
      }, warnings);
    }
    notifications++;
  }
  log(`seeded notifications=${notifications}`);
}

function reportDefinitions() {
  return [
    {
      name: 'Seed Completed Visits by Doctor',
      description: 'Synthetic operational report seeded to verify appointment activity dashboards.',
      category: 'clinical_activity',
      definition: {
        schemaVersion: '1',
        dataSource: 'appointments',
        groupBy: [{ column: 'doctor_id' }],
        aggregations: [{ fn: 'count', as: 'visits' }],
        filters: [{ column: 'status', operator: 'eq', value: 'completed' }],
        orderBy: [{ ref: 'visits', dir: 'desc' }],
        limit: 20,
        visualization: { type: 'bar' },
        header: { title: 'Completed visits by doctor', showFilters: true },
      },
    },
    {
      name: 'Seed Revenue by Payment Status',
      description: 'Synthetic payment report seeded to verify financial dashboard data.',
      category: 'financial',
      definition: {
        schemaVersion: '1',
        dataSource: 'payments',
        groupBy: [{ column: 'status' }],
        aggregations: [{ fn: 'sum', column: 'amount', as: 'amount' }],
        filters: [],
        orderBy: [{ ref: 'amount', dir: 'desc' }],
        limit: 20,
        visualization: { type: 'bar' },
        header: { title: 'Revenue by payment status', showFilters: true },
      },
    },
  ];
}

async function resolveAnalyticsShareTarget(actorUserId) {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, role')
    .neq('id', actorUserId)
    .in('role', ['admin', 'secretary', 'predoctor'])
    .limit(1);
  if (error) return null;
  return data?.[0] || null;
}

async function seedAnalyticalReports({ config, preflightResult, actorUserId }) {
  if (config.analyticsMode === 'skip') {
    log('analytics seed skipped by --skip-analytics');
    return;
  }
  if (!preflightResult.analyticsAvailable) {
    log('analytics seed skipped because analytical report tables are not fully present');
    return;
  }

  const shareTarget = await resolveAnalyticsShareTarget(actorUserId);
  let reports = 0;
  let runs = 0;
  let schedules = 0;
  let shares = 0;
  for (const reportDef of reportDefinitions()) {
    const created = unwrap(await analyticalReportService.create({
      name: `${reportDef.name} (${config.seedTag})`,
      description: reportDef.description,
      category: reportDef.category,
      audience: 'staff',
      is_default: false,
      created_by: actorUserId,
    }), `analyticalReportService.create(${reportDef.name})`);
    unwrap(await analyticalReportService.publishNewVersion(created.id, reportDef.definition, {
      publishedBy: actorUserId,
    }), `analyticalReportService.publishNewVersion(${reportDef.name})`);
    reports++;

    unwrap(await analyticalReportService.queueRun({
      report_id: created.id,
      filter_args: {},
      requested_by: actorUserId,
    }), `analyticalReportService.queueRun(${reportDef.name})`);
    runs++;

    unwrap(await analyticalReportService.runByReport(created.id, {}, {
      requestedBy: actorUserId,
    }), `analyticalReportService.runByReport(${reportDef.name})`);

    unwrap(await analyticalReportService.createSchedule({
      report_id: created.id,
      frequency: schedules % 2 === 0 ? 'weekly' : 'daily',
      hour: 8 + schedules,
      day_of_week: schedules % 2 === 0 ? 1 : null,
      timezone: 'Asia/Beirut',
      is_active: true,
      created_by: actorUserId,
    }), `analyticalReportService.createSchedule(${reportDef.name})`);
    schedules++;

    if (shareTarget) {
      unwrap(await analyticalReportService.share({
        report_id: created.id,
        shared_with_user_id: shareTarget.id,
        permission_level: 'view',
        granted_by: actorUserId,
      }), `analyticalReportService.share(${reportDef.name})`);
      shares++;
    }
  }
  log(`seeded analytical reports=${reports}, runs=${runs}, schedules=${schedules}, shares=${shares}`);
}

async function executeSeed({ config, plan, preflightResult, adminClient }) {
  const doctor = preflightResult.doctor;
  const operator = preflightResult.operator;
  const operatorUserId = operator?.id;
  const doctorUser = {
    id: doctor.user_id,
    email: doctor.users?.email,
    role: doctor.users?.role || 'doctor',
  };
  const clinicalUserId = doctor.user_id;
  const warnings = [];
  if (!operator || !operatorUserId) {
    throw new Error('Seed operator is missing after preflight. Re-run dry-run to inspect blockers.');
  }

  const operatorSession = await authenticateUserSession(config, adminClient, operator, {
    password: config.operatorPassword,
    label: 'seed operator',
  });
  const doctorSession = await authenticateUserSession(config, adminClient, doctorUser, {
    password: config.doctorPassword,
    label: 'target doctor',
  });
  const activeOperator = await activateUserSession(config, operatorSession, operator, 'seed operator');
  log(`authenticated as ${activeOperator.role} seed operator for setup and scheduling workflows`);

  const [visitTypes, diseases, vaccines, surgeryTypes, familyRelations] = await Promise.all([
    fetchCatalogRows('visit_types', 'id, code, name, default_duration_minutes'),
    fetchCatalogRows('diseases', 'id, code, name, icd10_code'),
    fetchCatalogRows('vaccines', 'id, code, name'),
    fetchCatalogRows('surgery_types', 'id, code, name'),
    fetchCatalogRows('family_relations', 'id, code, name'),
  ]);
  const catalogs = { visitTypes, diseases, vaccines, surgeryTypes, familyRelations };
  const visitType = visitTypes[0] || null;

  log(`target doctor=${maskEmail(doctor.users?.email) || doctor.user_id}, doctor_id=${doctor.id}`);
  log(`seed operator=${maskEmail(operator.email)}, role=${operator.role}`);
  const clinic = await ensureSeedClinic(config);
  log(`clinic ready=${clinic.name}`);
  await ensureSeedScheduleTemplates({ config, doctor, clinic });

  const patients = [];
  for (let i = 0; i < plan.rows.patients; i++) {
    patients.push(await ensureSeedPatient(adminClient, config, i, operatorUserId));
    if ((i + 1) % 10 === 0 || i + 1 === plan.rows.patients) {
      log(`patients ready ${i + 1}/${plan.rows.patients}`);
    }
  }
  await seedPatientHistories({ config, patients, catalogs, actorUserId: operatorUserId });
  await seedPatientConsents({ config, patients, actorUserId: operatorUserId });
  const predoctor = await resolvePredoctorForSeed(doctor.id);
  log(predoctor ? `predoctor prechecks enabled, predoctor_id=${predoctor.id}` : 'predoctor prechecks skipped because no supervised predoctor exists');

  const outcomes = {};
  const completedVisits = [];
  const timeline = appointmentTimeline(plan);
  for (let i = 0; i < timeline.length; i++) {
    const result = await seedAppointmentFlow({
      config,
      doctor,
      clinic,
      patient: patients[i % patients.length],
      operatorUserId,
      clinicalUserId,
      operatorSession,
      doctorSession,
      operator,
      doctorUser,
      predoctorId: predoctor?.id || null,
      visitType,
      catalogs,
      timeline: timeline[i],
      warnings,
      adminClient,
    });
    outcomes[result.outcome] = (outcomes[result.outcome] || 0) + 1;
    if (result.outcome === 'completed') {
      completedVisits.push(result);
    }
    if ((i + 1) % 25 === 0 || i + 1 === timeline.length) {
      log(`appointments processed ${i + 1}/${timeline.length}`, outcomes);
    }
  }

  await activateUserSession(config, operatorSession, operator, 'seed operator');
  await seedConversations({
    config,
    plan,
    patients,
    operatorUserId,
    operator,
    operatorSession,
    adminClient,
    warnings,
  });
  await activateUserSession(config, operatorSession, operator, 'seed operator');
  await seedInsurance({ config, plan, doctor, patients, completedVisits, actorUserId: operatorUserId, warnings, adminClient });
  await activateUserSession(config, operatorSession, operator, 'seed operator');
  await seedNotifications({ config, plan, completedVisits, actorUserId: operatorUserId, warnings, adminClient });
  await activateUserSession(config, operatorSession, operator, 'seed operator');
  await seedAnalyticalReports({ config, preflightResult, actorUserId: operatorUserId });

  return { outcomes, warnings };
}

export async function runSeed(argv = process.argv.slice(2), env = process.env) {
  const config = buildSeedRuntimeConfig(env, argv);
  if (config.help) {
    console.log(printHelp());
    return { code: 0 };
  }

  assertRuntimeConfig(config);
  const plan = buildSeedPlan(config);
  log('runtime', redactRuntimeConfig(config));
  log('plan', plan.rows);

  const adminClient = createClient(config.tenantUrl, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Preflight runs with service-role because it checks migration readiness
  // across tables that tenant RLS may intentionally hide. The write path
  // switches this runtime singleton to an admin/secretary operator before
  // operational service calls, so workflow mutations still exercise app
  // services, RPCs, and tenant RLS instead of becoming privileged direct writes.
  configureSupabaseClient({
    url: config.tenantUrl,
    anonKey: config.serviceRoleKey,
    options: {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  });

  const preflightResult = await preflight(config, plan);
  log('preflight required tables', {
    ok: preflightResult.requiredTableResults.filter((r) => r.ok).length,
    total: preflightResult.requiredTableResults.length,
  });
  if (preflightResult.optionalAnalyticsResults.length) {
    log('preflight analytics tables', {
      ok: preflightResult.optionalAnalyticsResults.filter((r) => r.ok).length,
      total: preflightResult.optionalAnalyticsResults.length,
    });
  }
  log('preflight duplicate seed rows', preflightResult.duplicateCount);

  if (preflightResult.blockers.length) {
    for (const blocker of preflightResult.blockers) {
      log(`BLOCKER: ${blocker}`);
    }
    return { code: 1, blockers: preflightResult.blockers };
  }

  if (config.dryRun) {
    log('dry-run complete. Add --write to seed the tenant.');
    return { code: 0, plan, preflightResult };
  }

  const result = await executeSeed({ config, plan, preflightResult, adminClient });
  log('seed complete', result.outcomes);
  if (result.warnings.length) {
    log('non-fatal warnings');
    for (const warning of result.warnings.slice(0, 25)) {
      log(`warning: ${warning}`);
    }
    if (result.warnings.length > 25) {
      log(`${result.warnings.length - 25} additional warning(s) suppressed`);
    }
  }

  return { code: 0, result };
}

const entry = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (entry) {
  runSeed().then(({ code }) => {
    process.exitCode = code;
  }).catch((error) => {
    console.error(`[tenant-seed] fatal: ${safeErrorMessage(error)}`);
    process.exitCode = 1;
  });
}
