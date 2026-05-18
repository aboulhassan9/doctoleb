const VITAL_NUMBER_FIELDS = Object.freeze({
  temperature: 'Temperature',
  heartRate: 'Heart rate',
  respiratoryRate: 'Respiratory rate',
  weight: 'Weight',
  height: 'Height',
});

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseOptionalPrecheckNumber(value, label = 'Value') {
  if (value === null || value === undefined || value === '') return null;
  const normalized = typeof value === 'string' ? value.trim() : value;
  if (normalized === '') return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid number.`);
  }
  return parsed;
}

export function buildPrecheckSubmissionPayload({
  patientId,
  predoctorId = null,
  vitals = {},
  allergies = [],
  medications = [],
  observations = {},
  fileNames = [],
  isUrgent = false,
}) {
  const parsedVitals = {};

  for (const [field, label] of Object.entries(VITAL_NUMBER_FIELDS)) {
    parsedVitals[field] = parseOptionalPrecheckNumber(vitals[field], label);
  }

  return {
    patientId,
    predoctorId,
    bloodPressure: cleanString(vitals.bloodPressure) || null,
    heartRate: parsedVitals.heartRate,
    temperature: parsedVitals.temperature,
    weight: parsedVitals.weight,
    height: parsedVitals.height,
    currentMedications: medications.map(cleanString).filter(Boolean).join('\n') || null,
    allergies: allergies.map(cleanString).filter(Boolean).join(', ') || null,
    symptoms: [
      cleanString(observations.symptoms),
      cleanString(observations.reports),
      fileNames.length ? `Attached reports: ${fileNames.map(cleanString).filter(Boolean).join(', ')}` : '',
    ].filter(Boolean).join('\n\n') || null,
    isUrgent: Boolean(isUrgent),
  };
}
