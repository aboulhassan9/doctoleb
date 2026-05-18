export const VOLUME_PRESETS = Object.freeze({
  tiny: Object.freeze({
    patients: 5,
    appointments: 18,
    conversations: 3,
    maxMessagesPerConversation: 4,
  }),
  small: Object.freeze({
    patients: 16,
    appointments: 80,
    conversations: 10,
    maxMessagesPerConversation: 6,
  }),
  medium: Object.freeze({
    patients: 45,
    appointments: 240,
    conversations: 26,
    maxMessagesPerConversation: 8,
  }),
  large: Object.freeze({
    patients: 80,
    appointments: 520,
    conversations: 50,
    maxMessagesPerConversation: 10,
  }),
});

export const REQUIRED_OPERATIONAL_TABLES = Object.freeze([
  'users',
  'doctors',
  'patients',
  'clinics',
  'visit_types',
  'secretary_slots',
  'doctor_schedule_templates',
  'appointments',
  'medical_intake',
  'patient_diseases',
  'patient_vaccinations',
  'patient_surgeries',
  'patient_family_history',
  'precheck_forms',
  'encounters',
  'clinical_notes',
  'diagnoses',
  'prescriptions',
  'lab_orders',
  'imaging_orders',
  'clinical_documents',
  'care_tasks',
  'conversations',
  'conversation_participants',
  'messages',
  'message_read_receipts',
  'payments',
  'insurance_providers',
  'doctor_insurance_contracts',
  'patient_insurance_policies',
  'insurance_claims',
  'consent_documents',
  'patient_consents',
  'notification_events',
  'notification_deliveries',
]);

export const OPTIONAL_ANALYTICS_TABLES = Object.freeze([
  'analytical_reports',
  'analytical_report_versions',
  'analytical_report_runs',
  'analytical_report_shares',
  'analytical_report_schedules',
]);

export const SEED_DUPLICATE_CHECKS = Object.freeze([
  { label: 'seed users', table: 'users', column: 'email', operator: 'ilike', value: 'seed.{seedTag}.%@example.invalid' },
  { label: 'seed clinic', table: 'clinics', column: 'name', operator: 'eq', value: 'DoctoLeb Seed Clinic ({seedTag})' },
  { label: 'seed appointments', table: 'appointments', column: 'reason', operator: 'ilike', value: '%[seed:{seedTag}]%' },
  { label: 'seed prechecks', table: 'precheck_forms', column: 'symptoms', operator: 'ilike', value: '%[seed:{seedTag}]%' },
  { label: 'seed medical intake', table: 'medical_intake', column: 'notes', operator: 'ilike', value: '%[seed:{seedTag}]%' },
  { label: 'seed patient diseases', table: 'patient_diseases', column: 'notes', operator: 'ilike', value: '%[seed:{seedTag}]%' },
  { label: 'seed patient vaccinations', table: 'patient_vaccinations', column: 'notes', operator: 'ilike', value: '%[seed:{seedTag}]%' },
  { label: 'seed patient surgeries', table: 'patient_surgeries', column: 'notes', operator: 'ilike', value: '%[seed:{seedTag}]%' },
  { label: 'seed patient family history', table: 'patient_family_history', column: 'notes', operator: 'ilike', value: '%[seed:{seedTag}]%' },
  { label: 'seed clinical notes', table: 'clinical_notes', column: 'content', operator: 'ilike', value: '%[seed:{seedTag}]%' },
  { label: 'seed diagnoses', table: 'diagnoses', column: 'notes', operator: 'ilike', value: '%[seed:{seedTag}]%' },
  { label: 'seed prescriptions', table: 'prescriptions', column: 'instructions', operator: 'ilike', value: '%[seed:{seedTag}]%' },
  { label: 'seed lab orders', table: 'lab_orders', column: 'instructions', operator: 'ilike', value: '%[seed:{seedTag}]%' },
  { label: 'seed imaging orders', table: 'imaging_orders', column: 'instructions', operator: 'ilike', value: '%[seed:{seedTag}]%' },
  { label: 'seed clinical documents', table: 'clinical_documents', column: 'title', operator: 'ilike', value: '%Seed%{seedTag}%' },
  { label: 'seed care tasks', table: 'care_tasks', column: 'description', operator: 'ilike', value: '%[seed:{seedTag}]%' },
  { label: 'seed conversations', table: 'conversations', column: 'subject', operator: 'ilike', value: '%[seed:{seedTag}]%' },
  { label: 'seed messages', table: 'messages', column: 'body', operator: 'ilike', value: '%[seed:{seedTag}]%' },
  { label: 'seed payments', table: 'payments', column: 'transaction_id', operator: 'ilike', value: '{seedTag}-%' },
  { label: 'seed insurance contracts', table: 'doctor_insurance_contracts', column: 'contract_number', operator: 'ilike', value: '%{seedTag}%' },
  { label: 'seed insurance policies', table: 'patient_insurance_policies', column: 'policy_number', operator: 'ilike', value: '%{seedTag}%' },
  { label: 'seed notifications', table: 'notification_events', column: 'body', operator: 'ilike', value: '%[seed:{seedTag}]%' },
  { label: 'seed analytical reports', table: 'analytical_reports', column: 'name', operator: 'ilike', value: '%({seedTag})%', optional: true },
]);

const SAFE_TAG_RE = /^[a-z0-9][a-z0-9_-]{2,48}$/;

export function renderSeedTemplate(template, seedTag) {
  return String(template)
    .replaceAll('{seedTag12}', seedTag.slice(0, 12))
    .replaceAll('{seedTag}', seedTag);
}

export function parseSeedArgs(argv = []) {
  const options = {
    write: false,
    dryRun: true,
    volume: 'small',
    seedTag: null,
    targetDoctorEmail: null,
    operatorEmail: null,
    allowDuplicates: false,
    backdate: true,
    analyticsMode: 'auto',
    help: false,
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--write') {
      options.write = true;
      options.dryRun = false;
    } else if (arg === '--dry-run') {
      options.write = false;
      options.dryRun = true;
    } else if (arg === '--allow-duplicates') {
      options.allowDuplicates = true;
    } else if (arg === '--no-backdate') {
      options.backdate = false;
    } else if (arg === '--require-analytics') {
      options.analyticsMode = 'require';
    } else if (arg === '--skip-analytics') {
      options.analyticsMode = 'skip';
    } else if (arg.startsWith('--volume=')) {
      options.volume = arg.slice('--volume='.length).trim();
    } else if (arg.startsWith('--seed-tag=')) {
      options.seedTag = arg.slice('--seed-tag='.length).trim();
    } else if (arg.startsWith('--target-doctor-email=')) {
      options.targetDoctorEmail = arg.slice('--target-doctor-email='.length).trim().toLowerCase();
    } else if (arg.startsWith('--operator-email=')) {
      options.operatorEmail = arg.slice('--operator-email='.length).trim().toLowerCase();
    } else {
      throw new Error(`Unknown seed option: ${arg}`);
    }
  }

  if (!Object.prototype.hasOwnProperty.call(VOLUME_PRESETS, options.volume)) {
    throw new Error(`Invalid --volume="${options.volume}". Use one of: ${Object.keys(VOLUME_PRESETS).join(', ')}.`);
  }

  if (options.seedTag && !SAFE_TAG_RE.test(options.seedTag)) {
    throw new Error('Invalid --seed-tag. Use 3-49 chars: lowercase letters, numbers, underscore, dash.');
  }

  return options;
}

export function defaultSeedTag(now = new Date()) {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `ops_seed_${yyyy}${mm}${dd}`;
}

export function buildSeedRuntimeConfig(env = process.env, argv = [], now = new Date()) {
  const options = parseSeedArgs(argv);
  const seedTag = options.seedTag || env.SEED_TAG || defaultSeedTag(now);
  if (!SAFE_TAG_RE.test(seedTag)) {
    throw new Error('Invalid SEED_TAG. Use 3-49 chars: lowercase letters, numbers, underscore, dash.');
  }

  return {
    ...options,
    seedTag,
    tenantUrl: env.TENANT_SUPABASE_URL || env.VITE_SUPABASE_URL || '',
    anonKey: env.TENANT_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '',
    serviceRoleKey: env.TENANT_SUPABASE_SERVICE_ROLE_KEY || '',
    doctorPassword: env.SEED_TARGET_DOCTOR_PASSWORD || '',
    operatorPassword: env.SEED_OPERATOR_PASSWORD || '',
    targetDoctorEmail: options.targetDoctorEmail || (env.SEED_TARGET_DOCTOR_EMAIL || '').trim().toLowerCase() || null,
    operatorEmail: options.operatorEmail || (env.SEED_OPERATOR_EMAIL || '').trim().toLowerCase() || null,
  };
}

export function assertRuntimeConfig(config) {
  const missing = [];
  if (!config.tenantUrl) missing.push('TENANT_SUPABASE_URL');
  if (!config.anonKey) missing.push('TENANT_SUPABASE_ANON_KEY');
  if (!config.serviceRoleKey) missing.push('TENANT_SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length) {
    throw new Error(`Missing required seed environment: ${missing.join(', ')}`);
  }

  try {
    const tenantUrl = new URL(config.tenantUrl);
    if (!['http:', 'https:'].includes(tenantUrl.protocol)) {
      throw new Error('invalid protocol');
    }
  } catch {
    throw new Error('TENANT_SUPABASE_URL must be a valid HTTP(S) URL.');
  }
}

export function redactRuntimeConfig(config) {
  return {
    tenantUrl: config.tenantUrl ? new URL(config.tenantUrl).origin : '',
    anonKey: config.anonKey ? '[redacted]' : '',
    serviceRoleKey: config.serviceRoleKey ? '[redacted]' : '',
    doctorPassword: config.doctorPassword ? '[redacted]' : '',
    operatorPassword: config.operatorPassword ? '[redacted]' : '',
    seedTag: config.seedTag,
    volume: config.volume,
    dryRun: config.dryRun,
    write: config.write,
    targetDoctorEmail: config.targetDoctorEmail ? maskEmail(config.targetDoctorEmail) : null,
    operatorEmail: config.operatorEmail ? maskEmail(config.operatorEmail) : null,
    allowDuplicates: config.allowDuplicates,
    backdate: config.backdate,
    analyticsMode: config.analyticsMode,
  };
}

export function buildSeedPlan(config, now = new Date()) {
  const preset = VOLUME_PRESETS[config.volume];
  const completed = Math.round(preset.appointments * 0.68);
  const cancelled = Math.max(1, Math.round(preset.appointments * 0.1));
  const noShow = Math.max(1, Math.round(preset.appointments * 0.05));
  const future = Math.max(1, preset.appointments - completed - cancelled - noShow);
  const messageRows = preset.conversations * preset.maxMessagesPerConversation;
  const reportDocuments = Math.ceil(completed / 2);
  const referralDocuments = Math.ceil(completed / 4);
  const certificateDocuments = Math.ceil(completed / 6);
  const labRequestDocuments = Math.ceil(completed / 3);

  return {
    seedTag: config.seedTag,
    generatedAt: now.toISOString(),
    volume: config.volume,
    sixMonthWindowDays: 180,
    rows: {
      patients: preset.patients,
      appointments: preset.appointments,
      completedAppointments: completed,
      cancelledAppointments: cancelled,
      noShowAppointments: noShow,
      futureAppointments: future,
      scheduleTemplates: 3,
      prechecks: completed,
      encounters: completed,
      clinicalNotes: completed,
      diagnoses: completed,
      prescriptions: Math.round(completed * 0.72),
      labOrders: Math.ceil(completed / 3),
      imagingOrders: Math.round(completed * 0.18),
      reportDocuments,
      referralDocuments,
      certificateDocuments,
      labRequestDocuments,
      clinicalDocuments: reportDocuments + referralDocuments + certificateDocuments + labRequestDocuments,
      careTasks: Math.round(completed * 0.28),
      payments: Math.round(completed * 0.86),
      patientHistoryRecords: preset.patients * 2 + Math.ceil(preset.patients / 2),
      patientConsents: Math.ceil(preset.patients * 0.4),
      insurancePolicies: Math.ceil(preset.patients * 0.35),
      insuranceClaims: Math.ceil(completed * 0.12),
      notifications: Math.ceil(completed * 0.25),
      conversations: preset.conversations,
      messages: messageRows,
      analyticsReports: 2,
      analyticsRuns: 2,
      analyticsSchedules: 2,
    },
    dashboardEffects: [
      'Appointment calendar: historical completed visits, cancelled/no-show visits, and future scheduled/confirmed visits.',
      'Clinical workspace: encounters, notes, diagnoses, prescriptions, lab/imaging orders, documents, and care tasks.',
      'Patient workspace: realistic demographics, completed intake, medical history, consents, appointment history, documents, messages, and payments.',
      'Billing and operations: insurance contracts, patient policies, claims, notifications, and schedule templates are exercised when tenant migrations/catalogs are ready.',
      'Reports/BI: if analytical report migrations exist, saved report definitions, run previews, schedules, and shares are seeded; otherwise the seeder reports the missing tables.',
    ],
  };
}

export function seedEmail(seedTag, kind, index) {
  const padded = String(index).padStart(3, '0');
  return `seed.${seedTag}.${kind}${padded}@example.invalid`;
}

export function maskEmail(email) {
  const value = String(email || '').trim();
  const at = value.indexOf('@');
  if (at <= 0) return value ? '[email-redacted]' : '';
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const visible = local.length <= 2 ? local[0] : `${local[0]}${local.at(-1)}`;
  return `${visible}***@${domain}`;
}

export function safeErrorMessage(error) {
  if (!error) return 'Unknown error';
  const raw = typeof error === 'string'
    ? error
    : error.message || error.error_description || JSON.stringify(error);
  return String(raw)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email-redacted]')
    .replace(/eyJ[a-zA-Z0-9._-]+/g, '[jwt-redacted]')
    .replace(/sb_secret_[a-zA-Z0-9._-]+/g, '[supabase-secret-redacted]')
    .replace(/service[_-]?role[a-zA-Z0-9._-]*/gi, '[service-role-redacted]')
    .slice(0, 1000);
}

export function printHelp() {
  return `Tenant operational seed

Usage:
  npm run seed:tenant:ops -- --dry-run --volume=small
  npm run seed:tenant:ops -- --write --volume=medium --target-doctor-email=doctor@example.com

Required environment:
  TENANT_SUPABASE_URL
  TENANT_SUPABASE_ANON_KEY
  TENANT_SUPABASE_SERVICE_ROLE_KEY

Optional environment:
  SEED_TARGET_DOCTOR_EMAIL   Existing tenant doctor/admin email to attach all data to.
  SEED_TARGET_DOCTOR_PASSWORD Optional password for the target doctor. If omitted, a server-side one-time link is generated and verified.
  SEED_OPERATOR_EMAIL        Existing tenant admin/secretary email used to execute RLS-protected staff workflows.
  SEED_OPERATOR_PASSWORD     Optional password for SEED_OPERATOR_EMAIL. If omitted, a server-side one-time link is generated and verified.
  SEED_TAG                   Idempotency namespace, default ops_seed_YYYYMMDD.

Options:
  --dry-run                  Preflight only. Does not write. Default.
  --write                    Execute the seed.
  --volume=tiny|small|medium|large
  --target-doctor-email=...
  --operator-email=...
  --seed-tag=...
  --allow-duplicates         Allow another run with the same seed tag.
  --no-backdate              Do not run the controlled admin timestamp backfill.
  --skip-analytics           Do not seed analytical report definitions.
  --require-analytics        Fail if analytical report migrations are missing.
`;
}
