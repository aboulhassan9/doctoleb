export const CLINICAL_REPORT_PURPOSES = Object.freeze([
  {
    code: 'general',
    label: 'Comprehensive medical report',
    description: 'Full patient summary for clinical or administrative use.',
    requiredSections: ['clinicalFindings', 'diagnosis', 'treatmentPlan'],
  },
  {
    code: 'insurance',
    label: 'Insurance medical report',
    description: 'Structured report for insurance review or claim support.',
    requiredSections: ['medicalHistory', 'clinicalFindings', 'diagnosis', 'treatmentPlan'],
  },
  {
    code: 'specialist',
    label: 'Specialist handoff report',
    description: 'Concise report for another doctor or specialist.',
    requiredSections: ['clinicalFindings', 'diagnosis', 'treatmentPlan', 'recommendations'],
  },
  {
    code: 'follow_up',
    label: 'Follow-up progress report',
    description: 'Progress update compared with previous visits and reports.',
    requiredSections: ['clinicalFindings', 'diagnosis', 'recommendations'],
  },
]);

export const CLINICAL_REPORT_SECTIONS = Object.freeze([
  { key: 'medicalHistory', title: 'Medical History' },
  { key: 'clinicalFindings', title: 'Clinical Findings' },
  { key: 'diagnosis', title: 'Diagnosis' },
  { key: 'treatmentPlan', title: 'Treatment Plan' },
  { key: 'recommendations', title: 'Recommendations' },
]);

const DEFAULT_PURPOSE = CLINICAL_REPORT_PURPOSES[0];

function cleanText(value) {
  return sanitizeClinicalReportText(value).replace(/\s+/g, ' ').trim();
}

export function sanitizeClinicalReportText(value) {
  return String(value || '')
    .replace(/\s*\[seed:[^\]]+\]/gi, '')
    .replace(/\s*\((?:ops_)?seed[_: -][^)]+\)/gi, '')
    .replace(/\bops_seed_[a-z0-9_-]+\b/gi, '')
    .replace(/\bseed workload\b/gi, 'chart history')
    .replace(/\bseeded workload\b/gi, 'chart history')
    .replace(/\bseed data\b/gi, 'chart data')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function getClinicalReportPurpose(code) {
  return CLINICAL_REPORT_PURPOSES.find((purpose) => purpose.code === code) || DEFAULT_PURPOSE;
}

export function getPatientDisplayName(patient) {
  const user = patient?.users || {};
  return cleanText([user.first_name, user.last_name].filter(Boolean).join(' ')) || 'Unnamed patient';
}

export function getPatientAge(dateOfBirth, now = new Date()) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;

  let age = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age >= 0 && age < 140 ? age : null;
}

export function getPatientIdentitySummary(patient, { now = new Date() } = {}) {
  if (!patient) return null;
  const user = patient.users || {};
  const age = getPatientAge(patient.date_of_birth, now);
  return {
    id: patient.id,
    name: getPatientDisplayName(patient),
    phone: user.phone || null,
    email: user.email || null,
    dateOfBirth: patient.date_of_birth || null,
    age,
    sex: patient.sex || null,
    bloodType: patient.blood_type || null,
    allergies: cleanText(patient.allergies) || 'No allergies recorded',
    medicalHistory: cleanText(patient.medical_history),
    initials: user.initials || getPatientDisplayName(patient).split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
  };
}

export function isMeaningfulReportSection(value) {
  const text = cleanText(value);
  if (!text) return false;
  return text.length >= 8 && !/^(n\/?a|none|no|test|asdf|sdgs?d?|dg?sd|zxzc|sdfsd)$/i.test(text);
}

export function getReportReadiness({
  patient,
  doctorId,
  purposeCode = 'general',
  sections = {},
  sourceEncounter = null,
  savedReportId = null,
} = {}) {
  const purpose = getClinicalReportPurpose(purposeCode);
  const requiredSections = new Set(purpose.requiredSections);
  const sectionItems = CLINICAL_REPORT_SECTIONS
    .filter((section) => requiredSections.has(section.key))
    .map((section) => ({
      id: section.key,
      label: `${section.title} completed`,
      complete: isMeaningfulReportSection(sections[section.key]),
      blocking: true,
    }));

  const items = [
    { id: 'patient', label: 'Patient explicitly selected', complete: Boolean(patient?.id), blocking: true },
    { id: 'doctor', label: 'Doctor profile loaded', complete: Boolean(doctorId), blocking: true },
    { id: 'purpose', label: 'Report purpose selected', complete: Boolean(purpose.code), blocking: true },
    { id: 'context', label: 'Visit or source context linked', complete: Boolean(sourceEncounter?.id), blocking: false },
    ...sectionItems,
    { id: 'saved', label: 'Draft saved to clinical documents', complete: Boolean(savedReportId), blocking: false },
  ];

  return {
    purpose,
    items,
    canSave: items.filter((item) => item.blocking).every((item) => item.complete),
    missingRequired: items.filter((item) => item.blocking && !item.complete).map((item) => item.label),
  };
}

export function parseClinicalReportSections(content) {
  const result = {};
  const source = sanitizeClinicalReportText(content).replace(/\r\n/g, '\n');
  for (const section of CLINICAL_REPORT_SECTIONS) {
    const titles = CLINICAL_REPORT_SECTIONS.map((item) => item.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const pattern = new RegExp(`(?:^|\\n)${section.title}\\n([\\s\\S]*?)(?=\\n(?:${titles})\\n|$)`, 'i');
    const match = source.match(pattern);
    if (match?.[1]) result[section.key] = sanitizeClinicalReportText(match[1]);
  }
  return result;
}

export function buildClinicalReportContent({
  patient,
  purposeCode = 'general',
  sections = {},
  sourceEncounter = null,
  generatedAt = new Date(),
} = {}) {
  const identity = getPatientIdentitySummary(patient, { now: generatedAt });
  const purpose = getClinicalReportPurpose(purposeCode);
  const header = [
    `Purpose: ${purpose.label}`,
    identity ? `Patient: ${identity.name}` : null,
    identity?.dateOfBirth ? `Date of birth: ${identity.dateOfBirth}${identity.age !== null ? ` (${identity.age} years)` : ''}` : null,
    identity?.sex ? `Sex: ${identity.sex}` : null,
    sourceEncounter?.id ? `Source encounter: ${sourceEncounter.id}` : null,
    '',
  ].filter((line) => line !== null);

  const body = CLINICAL_REPORT_SECTIONS
    .map((section) => {
      const value = sanitizeClinicalReportText(sections[section.key]);
      return [section.title, value || 'Not documented.'].join('\n');
    })
    .join('\n\n');

  return [...header, body].join('\n');
}

export function buildClinicalSummarySnippets({
  patient,
  diagnoses = [],
  prescriptions = [],
  encounters = [],
  documents = [],
} = {}) {
  const identity = getPatientIdentitySummary(patient);
  const diagnosisText = diagnoses
    .map((item) => cleanText(item.diagnosis_text || item.diseases?.name))
    .filter(Boolean)
    .slice(0, 6)
    .join('; ');
  const medicationText = prescriptions
    .map((item) => cleanText([item.medication_name, item.dosage, item.frequency, item.duration].filter(Boolean).join(' - ')))
    .filter(Boolean)
    .slice(0, 8)
    .join('\n');
  const latestEncounter = encounters[0];
  const latestReport = documents.find((doc) => doc.document_type === 'report');

  return {
    medicalHistory: identity?.medicalHistory || '',
    allergies: identity?.allergies && identity.allergies !== 'No allergies recorded' ? `Allergies: ${identity.allergies}` : '',
    diagnosisSummary: diagnosisText,
    activeMedications: medicationText,
    latestEncounterSummary: cleanText([latestEncounter?.chief_complaint, latestEncounter?.summary].filter(Boolean).join('\n')),
    latestReportSections: parseClinicalReportSections(latestReport?.content),
  };
}
