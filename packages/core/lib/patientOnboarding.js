export const PATIENT_ONBOARDING_CUSTOM_FIELD_PREFIX = 'custom.';
export const PATIENT_ONBOARDING_CUSTOM_FIELD_KEY_PATTERN = /^custom\.[a-z0-9_]{2,60}$/;
export const PATIENT_ONBOARDING_LOCKED_REQUIRED_KEYS = Object.freeze([
  'first_name',
  'last_name',
  'date_of_birth',
  'sex',
]);

export const PATIENT_ONBOARDING_SECTIONS = Object.freeze([
  {
    id: 'identity',
    eyebrow: 'Step 1',
    title: 'Clinical identity',
    shortTitle: 'Identity',
    icon: 'id-card',
    description: 'The clinic needs these basics before any safe appointment or document workflow.',
  },
  {
    id: 'safety',
    eyebrow: 'Step 2',
    title: 'Safety notes',
    shortTitle: 'Safety',
    icon: 'shield-alert',
    description: 'Tell the care team what they should know before your first visit.',
  },
  {
    id: 'support',
    eyebrow: 'Step 3',
    title: 'Contact and coverage',
    shortTitle: 'Support',
    icon: 'life-buoy',
    description: 'Add backup contact and insurance details if you have them.',
  },
]);

export const PATIENT_ONBOARDING_FIELD_REGISTRY = Object.freeze([
  {
    key: 'first_name',
    section: 'identity',
    order: 10,
    label: 'First name',
    type: 'text',
    autoComplete: 'given-name',
    target: 'profile',
    required: true,
    placeholder: 'First name',
    icon: 'user',
    configGroup: 'patient_identity',
  },
  {
    key: 'last_name',
    section: 'identity',
    order: 20,
    label: 'Last name',
    type: 'text',
    autoComplete: 'family-name',
    target: 'profile',
    required: true,
    placeholder: 'Family name',
    icon: 'user-round',
    configGroup: 'patient_identity',
  },
  {
    key: 'phone',
    section: 'identity',
    order: 30,
    label: 'Phone number',
    type: 'tel',
    autoComplete: 'tel',
    target: 'profile',
    required: false,
    placeholder: '+961 71 234 567',
    icon: 'phone',
    configGroup: 'contact',
  },
  {
    key: 'date_of_birth',
    section: 'identity',
    order: 40,
    label: 'Date of birth',
    type: 'date',
    target: 'profile',
    required: true,
    icon: 'calendar-days',
    configGroup: 'clinical_identity',
  },
  {
    key: 'sex',
    section: 'identity',
    order: 50,
    label: 'Sex at birth / clinical sex',
    type: 'select',
    target: 'profile',
    required: true,
    icon: 'badge-help',
    configGroup: 'clinical_identity',
    options: [
      { value: 'female', label: 'Female' },
      { value: 'male', label: 'Male' },
      { value: 'intersex', label: 'Intersex' },
      { value: 'prefer_not_to_say', label: 'Prefer not to say' },
    ],
  },
  {
    key: 'blood_type',
    section: 'identity',
    order: 60,
    label: 'Blood type, if known',
    type: 'select',
    target: 'profile',
    required: false,
    icon: 'droplets',
    configGroup: 'clinical_identity',
    options: [
      { value: 'O+', label: 'O+' },
      { value: 'O-', label: 'O-' },
      { value: 'A+', label: 'A+' },
      { value: 'A-', label: 'A-' },
      { value: 'B+', label: 'B+' },
      { value: 'B-', label: 'B-' },
      { value: 'AB+', label: 'AB+' },
      { value: 'AB-', label: 'AB-' },
      { value: 'unknown', label: 'I do not know' },
    ],
  },
  {
    key: 'allergies',
    section: 'safety',
    order: 10,
    label: 'Known allergies',
    type: 'textarea',
    target: 'profile_and_intake',
    required: false,
    rows: 3,
    placeholder: 'Example: Penicillin, peanuts, latex. Write "None known" if applicable.',
    icon: 'shield-alert',
    configGroup: 'clinical_safety',
  },
  {
    key: 'current_medications',
    section: 'safety',
    order: 20,
    label: 'Current medications',
    type: 'textarea',
    target: 'intake',
    required: false,
    rows: 3,
    placeholder: 'Medication, dose, and frequency if you know them.',
    icon: 'pill',
    configGroup: 'clinical_safety',
  },
  {
    key: 'medical_history',
    section: 'safety',
    order: 30,
    label: 'Medical history summary',
    type: 'textarea',
    target: 'profile_and_intake',
    required: false,
    rows: 4,
    placeholder: 'Past conditions, surgeries, chronic illnesses, or anything the doctor should know.',
    icon: 'clipboard-plus',
    configGroup: 'clinical_safety',
  },
  {
    key: 'emergency_contact',
    section: 'support',
    order: 10,
    label: 'Emergency contact',
    type: 'text',
    autoComplete: 'name',
    target: 'profile',
    required: false,
    placeholder: 'Full name',
    icon: 'contact-round',
    configGroup: 'emergency_contact',
  },
  {
    key: 'emergency_phone',
    section: 'support',
    order: 20,
    label: 'Emergency contact phone',
    type: 'tel',
    autoComplete: 'tel',
    target: 'profile',
    required: false,
    placeholder: '+961 70 000 000',
    icon: 'phone-call',
    configGroup: 'emergency_contact',
  },
  {
    key: 'insurance_id',
    section: 'support',
    order: 30,
    label: 'Insurance ID',
    type: 'text',
    target: 'profile',
    required: false,
    placeholder: 'Policy or member number',
    icon: 'badge-dollar-sign',
    configGroup: 'coverage',
  },
]);

export const PATIENT_ONBOARDING_CONFIG_CONTRACT = Object.freeze({
  version: 2,
  mode: 'scoped_allowlist',
  owner: 'packages/core/lib/patientOnboarding.js',
  scopes: ['doctor', 'tenant', 'default'],
  formContexts: ['patient_onboarding', 'profile', 'appointment_booking', 'billing_contact', 'check_in'],
  baseFieldOverrideAllowlist: [
    'visible',
    'required',
    'section',
    'order',
    'label',
    'placeholder',
    'helpText',
    'rows',
  ],
  lockedForSafety: [
    'key',
    'target',
    'type',
    'options',
    'configGroup',
    'profileColumn',
    'intakeColumn',
  ],
  lockedRequiredKeys: PATIENT_ONBOARDING_LOCKED_REQUIRED_KEYS,
  customFieldPolicy: {
    keyPrefix: PATIENT_ONBOARDING_CUSTOM_FIELD_PREFIX,
    target: 'intake_custom',
    maxActiveFields: 20,
    maxAnswerLength: 4000,
    allowedTypes: ['text', 'textarea', 'select'],
  },
  futureAdminShape: 'Doctors/admins choose visible/required/order/copy from this registry, plus custom fields under custom.* only.',
});

const SECTION_IDS = new Set(PATIENT_ONBOARDING_SECTIONS.map((section) => section.id));
const SECTION_ORDER = new Map(PATIENT_ONBOARDING_SECTIONS.map((section, index) => [section.id, index]));
const BASE_FIELD_KEYS = new Set(PATIENT_ONBOARDING_FIELD_REGISTRY.map((field) => field.key));
const LOCKED_REQUIRED_KEYS = new Set(PATIENT_ONBOARDING_LOCKED_REQUIRED_KEYS);
const CUSTOM_FIELD_TYPES = new Set(PATIENT_ONBOARDING_CONFIG_CONTRACT.customFieldPolicy.allowedTypes);

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function readConfigValue(row, camelKey, snakeKey = camelKey) {
  if (!isPlainObject(row)) return undefined;
  return row[camelKey] ?? row[snakeKey];
}

function normalizeBoolean(value, fallback = undefined) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

function normalizeInteger(value, fallback = 0, { min = -1000, max = 1000 } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function normalizeString(value, { max = 240, fallback = undefined } = {}) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, max);
}

function cloneField(field) {
  return {
    ...field,
    options: field.options ? field.options.map((option) => ({ ...option })) : undefined,
  };
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

function getFieldOverrideRows(config) {
  if (!isPlainObject(config)) return [];
  const groupedRows = [
    ...asArray(config.fieldOverrides),
    ...asArray(config.field_overrides),
  ];
  const mixedRows = asArray(config.fields).filter((row) => {
    const kind = readConfigValue(row, 'fieldKind', 'field_kind') || readConfigValue(row, 'kind');
    return kind !== 'custom';
  });
  return [...groupedRows, ...mixedRows];
}

function getCustomFieldRows(config) {
  if (!isPlainObject(config)) return [];
  const groupedRows = [
    ...asArray(config.customFields),
    ...asArray(config.custom_fields),
  ];
  const mixedRows = asArray(config.fields).filter((row) => {
    const key = readConfigValue(row, 'key', 'field_key');
    const kind = readConfigValue(row, 'fieldKind', 'field_kind') || readConfigValue(row, 'kind');
    return kind === 'custom' || PATIENT_ONBOARDING_CUSTOM_FIELD_KEY_PATTERN.test(String(key || ''));
  });
  return [...groupedRows, ...mixedRows];
}

function normalizeBaseOverride(row) {
  const key = readConfigValue(row, 'key', 'field_key');
  if (!BASE_FIELD_KEYS.has(key)) return null;

  const section = readConfigValue(row, 'section');
  const normalizedSection = SECTION_IDS.has(section) ? section : undefined;
  const visible = normalizeBoolean(readConfigValue(row, 'visible', 'is_visible'));
  const required = normalizeBoolean(readConfigValue(row, 'required', 'is_required'));

  return {
    key,
    visible,
    required,
    section: normalizedSection,
    order: normalizeInteger(readConfigValue(row, 'order', 'sort_order'), undefined, { min: -1000, max: 1000 }),
    label: normalizeString(readConfigValue(row, 'label'), { max: 120 }),
    placeholder: normalizeString(readConfigValue(row, 'placeholder'), { max: 240 }),
    helpText: normalizeString(readConfigValue(row, 'helpText', 'help_text'), { max: 360 }),
    rows: normalizeInteger(readConfigValue(row, 'rows'), undefined, { min: 2, max: 8 }),
  };
}

function applyBaseOverride(field, override, index) {
  const nextField = {
    ...cloneField(field),
    source: 'registry',
    visible: true,
    order: field.order ?? index * 10,
  };

  if (!override) return nextField;

  if (override.visible === false && !LOCKED_REQUIRED_KEYS.has(field.key)) {
    nextField.visible = false;
  }

  if (typeof override.required === 'boolean') {
    nextField.required = LOCKED_REQUIRED_KEYS.has(field.key) ? true : override.required;
  }

  if (override.section) nextField.section = override.section;
  if (typeof override.order === 'number') nextField.order = override.order;
  if (override.label) nextField.label = override.label;
  if (override.placeholder) nextField.placeholder = override.placeholder;
  if (override.helpText) nextField.helpText = override.helpText;
  if (typeof override.rows === 'number' && nextField.type === 'textarea') nextField.rows = override.rows;

  if (LOCKED_REQUIRED_KEYS.has(field.key)) {
    nextField.required = true;
    nextField.visible = true;
  }

  return nextField;
}

function normalizeCustomField(row, index) {
  const key = readConfigValue(row, 'key', 'field_key');
  if (!PATIENT_ONBOARDING_CUSTOM_FIELD_KEY_PATTERN.test(String(key || ''))) return null;

  const visible = normalizeBoolean(readConfigValue(row, 'visible', 'is_visible'), true);
  if (!visible) return null;

  const section = readConfigValue(row, 'section');
  if (!SECTION_IDS.has(section)) return null;

  const type = readConfigValue(row, 'type', 'field_type') || 'text';
  if (!CUSTOM_FIELD_TYPES.has(type)) return null;

  const label = normalizeString(readConfigValue(row, 'label'), { max: 120 });
  if (!label) return null;

  const options = type === 'select' ? normalizeOptions(readConfigValue(row, 'options')) : undefined;
  if (type === 'select' && (!options || options.length === 0)) return null;

  return {
    key,
    section,
    order: normalizeInteger(readConfigValue(row, 'order', 'sort_order'), 500 + index * 10, { min: -1000, max: 2000 }),
    label,
    type,
    target: PATIENT_ONBOARDING_CONFIG_CONTRACT.customFieldPolicy.target,
    required: normalizeBoolean(readConfigValue(row, 'required', 'is_required'), false),
    placeholder: normalizeString(readConfigValue(row, 'placeholder'), { max: 240 }),
    helpText: normalizeString(readConfigValue(row, 'helpText', 'help_text'), { max: 360 }),
    rows: type === 'textarea' ? normalizeInteger(readConfigValue(row, 'rows'), 3, { min: 2, max: 8 }) : undefined,
    icon: normalizeString(readConfigValue(row, 'icon'), { max: 80, fallback: 'badge-help' }),
    configGroup: 'custom_intake',
    source: 'config',
    visible: true,
    options,
  };
}

function sortFields(a, b) {
  const sectionDelta = (SECTION_ORDER.get(a.section) ?? 99) - (SECTION_ORDER.get(b.section) ?? 99);
  if (sectionDelta !== 0) return sectionDelta;
  const orderDelta = (a.order ?? 0) - (b.order ?? 0);
  if (orderDelta !== 0) return orderDelta;
  return a.label.localeCompare(b.label);
}

function getResolvedFields(definition) {
  return Array.isArray(definition?.fields)
    ? definition.fields
    : DEFAULT_PATIENT_ONBOARDING_DEFINITION.fields;
}

export function resolvePatientOnboardingDefinition({ config = null } = {}) {
  const overrides = new Map();
  for (const row of getFieldOverrideRows(config)) {
    const override = normalizeBaseOverride(row);
    if (override) overrides.set(override.key, override);
  }

  const baseFields = PATIENT_ONBOARDING_FIELD_REGISTRY
    .map((field, index) => applyBaseOverride(field, overrides.get(field.key), index))
    .filter((field) => field.visible !== false);

  const customFields = [];
  const customKeys = new Set();
  for (const row of getCustomFieldRows(config)) {
    if (customFields.length >= PATIENT_ONBOARDING_CONFIG_CONTRACT.customFieldPolicy.maxActiveFields) break;
    const field = normalizeCustomField(row, customFields.length);
    if (!field || customKeys.has(field.key) || BASE_FIELD_KEYS.has(field.key)) continue;
    customKeys.add(field.key);
    customFields.push(field);
  }

  const fields = [...baseFields, ...customFields].sort(sortFields);
  const version = normalizeInteger(readConfigValue(config, 'version'), PATIENT_ONBOARDING_CONFIG_CONTRACT.version, { min: 1, max: 1000 });
  const source = normalizeString(readConfigValue(config, 'source'), { max: 80, fallback: config ? 'configured' : 'default' });

  return {
    version,
    mode: PATIENT_ONBOARDING_CONFIG_CONTRACT.mode,
    source,
    sections: PATIENT_ONBOARDING_SECTIONS.map((section) => ({ ...section })),
    fields,
    requiredKeys: fields.filter((field) => field.required).map((field) => field.key),
    customFieldKeys: customFields.map((field) => field.key),
    contract: PATIENT_ONBOARDING_CONFIG_CONTRACT,
  };
}

export const DEFAULT_PATIENT_ONBOARDING_DEFINITION = resolvePatientOnboardingDefinition();

function getRequiredReadinessItems({ patient = null, intake = null, definition = DEFAULT_PATIENT_ONBOARDING_DEFINITION } = {}) {
  const intakeCompleted = Boolean(
    patient?.intake_completed_at ||
    intake?.status === 'completed' ||
    intake?.completed_at
  );
  const customAnswers = isPlainObject(intake?.custom_answers) ? intake.custom_answers : {};
  const fields = getResolvedFields(definition);
  const customRequiredItems = fields
    .filter((field) => field.target === 'intake_custom' && field.required)
    .map((field) => ({
      key: field.key,
      label: field.label,
      complete: hasValue(customAnswers[field.key]),
      section: field.section,
    }));

  return [
    {
      key: 'date_of_birth',
      label: 'Date of birth',
      complete: hasValue(patient?.date_of_birth),
      section: 'identity',
    },
    {
      key: 'sex',
      label: 'Clinical sex',
      complete: hasValue(patient?.sex),
      section: 'identity',
    },
    {
      key: 'intake',
      label: 'First-visit intake',
      complete: intakeCompleted,
      section: 'safety',
    },
    ...customRequiredItems,
  ];
}

export function buildPatientOnboardingStatus({ patient = null, intake = null, definition = DEFAULT_PATIENT_ONBOARDING_DEFINITION } = {}) {
  const readinessItems = getRequiredReadinessItems({ patient, intake, definition });
  const completedRequiredCount = readinessItems.filter((item) => item.complete).length;
  const missingRequiredFields = readinessItems
    .filter((item) => !item.complete)
    .map((item) => item.key);
  const completionPercent = readinessItems.length
    ? Math.round((completedRequiredCount / readinessItems.length) * 100)
    : 0;

  return {
    isComplete: missingRequiredFields.length === 0,
    hasClinicalIdentity: !missingRequiredFields.includes('date_of_birth') && !missingRequiredFields.includes('sex'),
    hasCompletedIntake: !missingRequiredFields.includes('intake'),
    missingRequiredFields,
    readinessItems,
    completedRequiredCount,
    totalRequiredCount: readinessItems.length,
    completionPercent,
    nextRoute: missingRequiredFields.length === 0 ? '/patient-dashboard' : '/patient-onboarding',
    completedAt: patient?.intake_completed_at || intake?.completed_at || null,
  };
}

export function getPatientOnboardingFieldsForSection({ definition = DEFAULT_PATIENT_ONBOARDING_DEFINITION, sectionId } = {}) {
  return getResolvedFields(definition).filter((field) => field.section === sectionId);
}

export function getPatientOnboardingSectionProgress({ form = {}, sectionId, definition = DEFAULT_PATIENT_ONBOARDING_DEFINITION } = {}) {
  const fields = getPatientOnboardingFieldsForSection({ definition, sectionId });
  const requiredFields = fields.filter((field) => field.required);
  const completedRequired = requiredFields.filter((field) => hasValue(form[field.key]));
  const completedFields = fields.filter((field) => hasValue(form[field.key]));

  return {
    fieldCount: fields.length,
    completedFieldCount: completedFields.length,
    requiredCount: requiredFields.length,
    completedRequiredCount: completedRequired.length,
    isRequiredComplete: completedRequired.length === requiredFields.length,
  };
}

export function getPatientOnboardingInitialForm({
  user = {},
  patient = {},
  intake = {},
  definition = DEFAULT_PATIENT_ONBOARDING_DEFINITION,
} = {}) {
  const form = {
    first_name: user?.first_name || patient?.users?.first_name || '',
    last_name: user?.last_name || patient?.users?.last_name || '',
    phone: user?.phone || patient?.users?.phone || '',
    date_of_birth: patient?.date_of_birth || '',
    sex: patient?.sex || '',
    blood_type: patient?.blood_type || '',
    allergies: patient?.allergies || intake?.allergies_text || '',
    current_medications: intake?.current_medications_text || '',
    medical_history: patient?.medical_history || intake?.notes || '',
    emergency_contact: patient?.emergency_contact || '',
    emergency_phone: patient?.emergency_phone || '',
    insurance_id: patient?.insurance_id || '',
  };
  const customAnswers = isPlainObject(intake?.custom_answers) ? intake.custom_answers : {};

  for (const field of getResolvedFields(definition)) {
    if (field.target === 'intake_custom') {
      form[field.key] = customAnswers[field.key] || '';
    } else if (!(field.key in form)) {
      form[field.key] = '';
    }
  }

  return form;
}

function collectCustomAnswers({ form = {}, definition = DEFAULT_PATIENT_ONBOARDING_DEFINITION } = {}) {
  const customAnswers = {};
  for (const field of getResolvedFields(definition)) {
    if (field.target !== 'intake_custom') continue;
    customAnswers[field.key] = hasValue(form[field.key]) ? form[field.key] : null;
  }
  return customAnswers;
}

export function buildPatientGuidedIntakePayload({
  form = {},
  userId,
  patientId,
  definition = DEFAULT_PATIENT_ONBOARDING_DEFINITION,
} = {}) {
  const firstName = String(form.first_name || '').trim();
  const lastName = String(form.last_name || '').trim();

  return {
    profile: {
      first_name: firstName,
      last_name: lastName,
      phone: form.phone || null,
      date_of_birth: form.date_of_birth || null,
      sex: form.sex || null,
      blood_type: form.blood_type === 'unknown' ? null : form.blood_type || null,
      allergies: form.allergies || null,
      insurance_id: form.insurance_id || null,
      emergency_contact: form.emergency_contact || null,
      emergency_phone: form.emergency_phone || null,
      medical_history: form.medical_history || null,
    },
    intake: {
      patient_id: patientId,
      allergies_text: form.allergies || null,
      current_medications_text: form.current_medications || null,
      notes: form.medical_history || null,
      field_config_version: definition.version,
      custom_answers: collectCustomAnswers({ form, definition }),
    },
    userId,
    patientId,
  };
}
