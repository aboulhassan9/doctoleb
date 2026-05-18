import {
  PATIENT_ONBOARDING_CUSTOM_FIELD_KEY_PATTERN,
  PATIENT_ONBOARDING_CUSTOM_FIELD_PREFIX,
  PATIENT_ONBOARDING_FIELD_REGISTRY,
} from './patientOnboarding.js';

export const PATIENT_FORM_CONTEXTS = Object.freeze({
  onboarding: 'patient_onboarding',
  profile: 'profile',
  appointmentBooking: 'appointment_booking',
  billingContact: 'billing_contact',
  checkIn: 'check_in',
});

export const PATIENT_FORM_SECTIONS = Object.freeze({
  patient_onboarding: [
    { id: 'identity', title: 'Clinical identity' },
    { id: 'safety', title: 'Safety notes' },
    { id: 'support', title: 'Contact and coverage' },
  ],
  profile: [
    { id: 'identity', title: 'Identity' },
    { id: 'support', title: 'Support' },
    { id: 'coverage', title: 'Coverage' },
  ],
  appointment_booking: [
    { id: 'visit', title: 'Visit intent' },
    { id: 'booking', title: 'Booking preferences' },
  ],
  billing_contact: [
    { id: 'billing', title: 'Billing contact' },
    { id: 'payment', title: 'Receipt delivery' },
  ],
  check_in: [
    { id: 'vitals', title: 'Vitals' },
    { id: 'safety', title: 'Safety notes' },
    { id: 'symptoms', title: 'Symptoms' },
  ],
});

export const PATIENT_BOOKING_FIELD_REGISTRY = Object.freeze([
  {
    key: 'visit_reason',
    section: 'visit',
    order: 10,
    label: 'Reason for visit',
    type: 'textarea',
    target: 'appointment_reason',
    required: true,
    rows: 3,
    placeholder: 'Briefly tell the clinic what you need help with.',
    icon: 'stethoscope',
  },
  {
    key: 'visit_priority',
    section: 'visit',
    order: 20,
    label: 'How soon do you need care?',
    type: 'select',
    target: 'appointment_answer',
    required: false,
    icon: 'timer',
    options: [
      { value: 'routine', label: 'Routine' },
      { value: 'soon', label: 'Soon' },
      { value: 'urgent', label: 'Urgent, but not an emergency' },
    ],
  },
  {
    key: 'visit_modality',
    section: 'booking',
    order: 30,
    label: 'Preferred visit style',
    type: 'select',
    target: 'appointment_answer',
    required: false,
    icon: 'calendar-days',
    options: [
      { value: 'in_person', label: 'In person' },
      { value: 'telehealth', label: 'Telehealth if available' },
      { value: 'clinic_decides', label: 'Let the clinic decide' },
    ],
  },
  {
    key: 'preferred_contact_method',
    section: 'booking',
    order: 40,
    label: 'Best way to reach you',
    type: 'select',
    target: 'appointment_answer',
    required: false,
    icon: 'message-circle',
    options: [
      { value: 'portal', label: 'Patient portal' },
      { value: 'phone', label: 'Phone' },
      { value: 'email', label: 'Email' },
    ],
  },
]);

export const PATIENT_BILLING_CONTACT_FIELD_REGISTRY = Object.freeze([
  {
    key: 'billing_email',
    section: 'billing',
    order: 10,
    label: 'Billing email',
    type: 'email',
    target: 'billing_contact',
    required: false,
    placeholder: 'name@example.com',
    icon: 'mail',
  },
  {
    key: 'billing_phone',
    section: 'billing',
    order: 20,
    label: 'Billing phone',
    type: 'tel',
    target: 'billing_contact',
    required: false,
    placeholder: '+961 70 000 000',
    icon: 'phone',
  },
  {
    key: 'receipt_delivery',
    section: 'payment',
    order: 30,
    label: 'Receipt delivery',
    type: 'select',
    target: 'billing_contact',
    required: false,
    icon: 'receipt',
    options: [
      { value: 'portal', label: 'Portal only' },
      { value: 'email', label: 'Email and portal' },
    ],
  },
]);

export const PATIENT_CHECK_IN_FIELD_REGISTRY = Object.freeze([
  {
    key: 'blood_pressure',
    section: 'vitals',
    order: 10,
    label: 'Blood pressure',
    type: 'text',
    target: 'precheck',
    required: true,
    placeholder: '120/80',
    icon: 'activity',
  },
  {
    key: 'heart_rate',
    section: 'vitals',
    order: 20,
    label: 'Heart rate',
    type: 'number',
    target: 'precheck',
    required: true,
    placeholder: '72',
    icon: 'heart-pulse',
  },
  {
    key: 'temperature',
    section: 'vitals',
    order: 30,
    label: 'Temperature',
    type: 'number',
    target: 'precheck',
    required: true,
    placeholder: '36.8',
    icon: 'thermometer',
  },
  {
    key: 'respiratory_rate',
    section: 'vitals',
    order: 40,
    label: 'Respiratory rate',
    type: 'number',
    target: 'precheck',
    required: false,
    placeholder: '16',
    icon: 'wind',
  },
  {
    key: 'weight',
    section: 'vitals',
    order: 50,
    label: 'Weight',
    type: 'number',
    target: 'precheck',
    required: false,
    placeholder: '68.5',
    icon: 'scale',
  },
  {
    key: 'height',
    section: 'vitals',
    order: 60,
    label: 'Height',
    type: 'number',
    target: 'precheck',
    required: false,
    placeholder: '168',
    icon: 'ruler',
  },
  {
    key: 'allergies',
    section: 'safety',
    order: 70,
    label: 'Known allergies',
    type: 'textarea',
    target: 'precheck',
    required: false,
    rows: 2,
    placeholder: 'Allergies to confirm before the encounter.',
    icon: 'shield-alert',
  },
  {
    key: 'current_medications',
    section: 'safety',
    order: 80,
    label: 'Current medications',
    type: 'textarea',
    target: 'precheck',
    required: false,
    rows: 2,
    placeholder: 'Medication, dose, and frequency if known.',
    icon: 'pill',
  },
  {
    key: 'symptoms',
    section: 'symptoms',
    order: 90,
    label: 'Primary symptoms',
    type: 'textarea',
    target: 'precheck',
    required: true,
    rows: 3,
    placeholder: 'Describe the patient concern in clinical language.',
    icon: 'clipboard-list',
  },
]);

const REGISTRY_BY_CONTEXT = Object.freeze({
  [PATIENT_FORM_CONTEXTS.onboarding]: PATIENT_ONBOARDING_FIELD_REGISTRY,
  [PATIENT_FORM_CONTEXTS.profile]: PATIENT_ONBOARDING_FIELD_REGISTRY.filter((field) => field.target !== 'intake'),
  [PATIENT_FORM_CONTEXTS.appointmentBooking]: PATIENT_BOOKING_FIELD_REGISTRY,
  [PATIENT_FORM_CONTEXTS.billingContact]: PATIENT_BILLING_CONTACT_FIELD_REGISTRY,
  [PATIENT_FORM_CONTEXTS.checkIn]: PATIENT_CHECK_IN_FIELD_REGISTRY,
});

const CUSTOM_TYPES = new Set(['text', 'textarea', 'select']);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value, { max = 240, fallback = undefined } = {}) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : fallback;
}

function normalizeBoolean(value, fallback = undefined) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return fallback;
}

function normalizeInteger(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(-1000, Math.min(2000, Math.trunc(parsed)));
}

function normalizeOptions(options) {
  return asArray(options)
    .map((option) => {
      if (typeof option === 'string') {
        const label = normalizeString(option, { max: 120 });
        return label ? { value: label, label } : null;
      }
      if (!isPlainObject(option)) return null;
      const value = normalizeString(option.value, { max: 120 });
      const label = normalizeString(option.label, { max: 120, fallback: value });
      return value && label ? { value, label } : null;
    })
    .filter(Boolean)
    .slice(0, 24);
}

function getRows(config, kind) {
  if (!isPlainObject(config)) return [];
  const grouped = kind === 'custom'
    ? [...asArray(config.customFields), ...asArray(config.custom_fields)]
    : [...asArray(config.fieldOverrides), ...asArray(config.field_overrides)];
  const mixed = asArray(config.fields).filter((row) => {
    const key = row?.key ?? row?.field_key;
    const fieldKind = row?.fieldKind ?? row?.field_kind ?? row?.kind;
    return kind === 'custom'
      ? fieldKind === 'custom' || PATIENT_ONBOARDING_CUSTOM_FIELD_KEY_PATTERN.test(String(key || ''))
      : fieldKind !== 'custom';
  });
  return [...grouped, ...mixed];
}

function normalizeOverride(row, baseKeys) {
  const key = row?.key ?? row?.field_key;
  if (!baseKeys.has(key)) return null;
  return {
    key,
    visible: normalizeBoolean(row?.visible ?? row?.is_visible),
    required: normalizeBoolean(row?.required ?? row?.is_required),
    section: normalizeString(row?.section, { max: 80 }),
    order: normalizeInteger(row?.order ?? row?.sort_order, undefined),
    label: normalizeString(row?.label, { max: 120 }),
    placeholder: normalizeString(row?.placeholder, { max: 240 }),
    helpText: normalizeString(row?.helpText ?? row?.help_text, { max: 360 }),
    rows: normalizeInteger(row?.rows, undefined),
  };
}

function normalizeCustomField(row) {
  const key = row?.key ?? row?.field_key;
  if (!PATIENT_ONBOARDING_CUSTOM_FIELD_KEY_PATTERN.test(String(key || ''))) return null;

  const visible = normalizeBoolean(row?.visible ?? row?.is_visible, true);
  if (!visible) return null;

  const label = normalizeString(row?.label, { max: 120 });
  const section = normalizeString(row?.section, { max: 80 });
  const type = row?.type ?? row?.field_type ?? 'text';
  if (!label || !section || !CUSTOM_TYPES.has(type)) return null;

  const options = type === 'select' ? normalizeOptions(row?.options) : undefined;
  if (type === 'select' && (!options || options.length === 0)) return null;

  return {
    key,
    section,
    order: normalizeInteger(row?.order ?? row?.sort_order, 500),
    label,
    type,
    target: 'custom',
    required: normalizeBoolean(row?.required ?? row?.is_required, false),
    placeholder: normalizeString(row?.placeholder, { max: 240 }),
    helpText: normalizeString(row?.helpText ?? row?.help_text, { max: 360 }),
    rows: type === 'textarea' ? normalizeInteger(row?.rows, 3) : undefined,
    icon: normalizeString(row?.icon, { max: 80, fallback: 'badge-help' }),
    source: 'config',
    visible: true,
    options,
  };
}

export function resolvePatientFormDefinition({ context, config = null } = {}) {
  const formContext = Object.values(PATIENT_FORM_CONTEXTS).includes(context)
    ? context
    : PATIENT_FORM_CONTEXTS.onboarding;
  const baseRegistry = REGISTRY_BY_CONTEXT[formContext] || [];
  const baseKeys = new Set(baseRegistry.map((field) => field.key));
  const overrides = new Map();

  for (const row of getRows(config, 'base')) {
    const override = normalizeOverride(row, baseKeys);
    if (override) overrides.set(override.key, override);
  }

  const fields = baseRegistry
    .map((field, index) => {
      const override = overrides.get(field.key);
      const next = {
        ...field,
        source: 'registry',
        visible: true,
        order: field.order ?? index * 10,
      };
      if (!override) return next;
      if (override.visible === false) next.visible = false;
      if (typeof override.required === 'boolean') next.required = override.required;
      if (override.section) next.section = override.section;
      if (typeof override.order === 'number') next.order = override.order;
      if (override.label) next.label = override.label;
      if (override.placeholder) next.placeholder = override.placeholder;
      if (override.helpText) next.helpText = override.helpText;
      if (typeof override.rows === 'number' && next.type === 'textarea') next.rows = override.rows;
      return next;
    })
    .filter((field) => field.visible !== false);

  const customFields = [];
  const customKeys = new Set();
  for (const row of getRows(config, 'custom')) {
    if (customFields.length >= 20) break;
    const field = normalizeCustomField(row);
    if (!field || customKeys.has(field.key) || baseKeys.has(field.key)) continue;
    customKeys.add(field.key);
    customFields.push(field);
  }

  const resolvedFields = [...fields, ...customFields]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.label.localeCompare(b.label));

  return {
    version: normalizeInteger(config?.version, 1),
    formContext,
    source: normalizeString(config?.source, { max: 80, fallback: config ? 'configured' : 'default' }),
    sections: PATIENT_FORM_SECTIONS[formContext] || [],
    fields: resolvedFields,
    requiredKeys: resolvedFields.filter((field) => field.required).map((field) => field.key),
    customFieldKeys: customFields.map((field) => field.key),
    answerFieldKeys: resolvedFields
      .filter((field) => field.target === 'appointment_answer' || field.target === 'custom')
      .map((field) => field.key),
    contract: {
      mode: 'scoped_allowlist',
      customFieldPrefix: PATIENT_ONBOARDING_CUSTOM_FIELD_PREFIX,
      maxCustomFields: 20,
    },
  };
}

export function getPatientFormRegistry(context) {
  const formContext = Object.values(PATIENT_FORM_CONTEXTS).includes(context)
    ? context
    : PATIENT_FORM_CONTEXTS.onboarding;
  return REGISTRY_BY_CONTEXT[formContext] || [];
}

export function collectPatientFormCustomAnswers({ definition, form = {} } = {}) {
  const answers = {};
  const answerKeys = definition?.answerFieldKeys || definition?.customFieldKeys || [];
  for (const key of answerKeys) {
    if (!(key in form)) continue;
    answers[key] = form[key] === undefined || form[key] === '' ? null : String(form[key]);
  }
  return answers;
}

export const DEFAULT_PATIENT_BOOKING_DEFINITION = resolvePatientFormDefinition({
  context: PATIENT_FORM_CONTEXTS.appointmentBooking,
});
