export const CLINICAL_REPORT_PURPOSES = Object.freeze([
  {
    code: 'general',
    label: 'Doctor clinical summary',
    audience: 'Doctor / specialist',
    documentTitle: 'Doctor Clinical Summary',
    description: 'Clinician-facing summary for safe handoff, second opinion, or continuity of care.',
    useCase: 'Helps another doctor quickly understand what happened, what is suspected, and what should happen next.',
    requiredSections: ['clinicalFindings', 'diagnosis', 'treatmentPlan', 'recommendations'],
    sectionGuidance: {
      medicalHistory: 'Relevant chronic conditions, allergies, prior surgery, and important risk factors.',
      clinicalFindings: 'Current symptoms, exam findings, vitals, and meaningful changes from baseline.',
      diagnosis: 'Confirmed or working diagnosis with uncertainty clearly stated.',
      treatmentPlan: 'Medication changes, procedures, follow-up plan, and clinical reasoning.',
      recommendations: 'What the receiving doctor should review, monitor, or decide next.',
    },
  },
  {
    code: 'insurance',
    label: 'Insurance medical report',
    audience: 'Insurance reviewer',
    documentTitle: 'Insurance Medical Necessity Report',
    description: 'Structured medical necessity report for insurance approval, claim review, or reimbursement.',
    useCase: 'Shows why the service, test, procedure, medication, or follow-up is medically justified.',
    requiredSections: ['medicalHistory', 'clinicalFindings', 'diagnosis', 'treatmentPlan'],
    sectionGuidance: {
      medicalHistory: 'Conditions and prior treatment relevant to the claim or authorization request.',
      clinicalFindings: 'Objective findings that justify medical necessity.',
      diagnosis: 'Diagnosis, severity, and any supporting coded terminology if available.',
      treatmentPlan: 'Requested service, medication, procedure, duration, and why alternatives are insufficient.',
      recommendations: 'Coverage notes, follow-up requirements, or supporting attachments.',
    },
  },
  {
    code: 'staff',
    label: 'Clinic staff handoff',
    audience: 'Clinic staff / nurse / secretary',
    documentTitle: 'Clinic Staff Action Handoff',
    description: 'Action-focused handoff so staff know what to book, prepare, call, collect, or monitor.',
    useCase: 'Turns the doctor plan into concrete operational tasks for the clinic team.',
    requiredSections: ['clinicalFindings', 'treatmentPlan', 'recommendations'],
    sectionGuidance: {
      medicalHistory: 'Only safety-relevant history staff must know, such as allergies or mobility needs.',
      clinicalFindings: 'Current operational context: urgency, symptoms to watch, and clinic risk flags.',
      diagnosis: 'Diagnosis only if staff need it to schedule, triage, or explain next steps.',
      treatmentPlan: 'Tasks: appointments, calls, documents, billing prep, sample pickup, or room preparation.',
      recommendations: 'Clear staff checklist with owner, timing, escalation trigger, and patient communication.',
    },
  },
  {
    code: 'patient',
    label: 'Patient after-visit summary',
    audience: 'Patient / caregiver',
    documentTitle: 'Patient After-Visit Summary',
    description: 'Plain-language summary the patient can understand and follow after leaving the clinic.',
    useCase: 'Gives the patient what happened, what to do, warning signs, and when to come back.',
    requiredSections: ['clinicalFindings', 'diagnosis', 'treatmentPlan', 'recommendations'],
    sectionGuidance: {
      medicalHistory: 'Patient-friendly background only when it helps explain the plan.',
      clinicalFindings: 'Explain what was found today in simple, non-alarming language.',
      diagnosis: 'Use plain language, avoid unexplained abbreviations, and mention uncertainty honestly.',
      treatmentPlan: 'Medicines, care instructions, lifestyle advice, and what the patient should do at home.',
      recommendations: 'Return date, warning signs, emergency advice, and how to contact the clinic.',
    },
  },
  {
    code: 'laboratory',
    label: 'Laboratory clinical context',
    audience: 'Laboratory / diagnostics',
    documentTitle: 'Laboratory Clinical Context',
    description: 'Focused context for requested lab work, sample priority, and result routing.',
    useCase: 'Helps the lab understand the clinical indication, urgency, specimen notes, and reporting path.',
    requiredSections: ['clinicalFindings', 'diagnosis', 'treatmentPlan', 'recommendations'],
    sectionGuidance: {
      medicalHistory: 'Relevant history affecting interpretation or sample handling, including allergies if relevant.',
      clinicalFindings: 'Clinical indication, symptoms, exposure, pregnancy status if relevant, or abnormal findings.',
      diagnosis: 'Working diagnosis or rule-out condition that explains why the test is requested.',
      treatmentPlan: 'Requested tests, specimen/source, timing, fasting needs, or medication context.',
      recommendations: 'Urgency, critical-result contact path, and where results should be sent.',
    },
  },
  {
    code: 'specialist',
    label: 'Specialist referral handoff',
    audience: 'Specialist doctor',
    documentTitle: 'Specialist Referral Handoff',
    description: 'Concise specialist-facing referral note with decision question and supporting context.',
    useCase: 'Clarifies why the patient is being referred and what clinical question needs an answer.',
    requiredSections: ['clinicalFindings', 'diagnosis', 'treatmentPlan', 'recommendations'],
    sectionGuidance: {
      medicalHistory: 'Only history that affects the specialist decision.',
      clinicalFindings: 'Key findings and timeline leading to referral.',
      diagnosis: 'Working diagnosis, differential, and uncertainty.',
      treatmentPlan: 'Treatment already tried and response so far.',
      recommendations: 'Specific question for the specialist and requested urgency.',
    },
  },
  {
    code: 'follow_up',
    label: 'Follow-up progress report',
    audience: 'Doctor / patient record',
    documentTitle: 'Follow-Up Progress Report',
    description: 'Progress update compared with previous visits and reports.',
    useCase: 'Documents whether the patient is improving, stable, or worsening, and what changes next.',
    requiredSections: ['clinicalFindings', 'diagnosis', 'recommendations'],
    sectionGuidance: {
      medicalHistory: 'Changes since the previous visit only.',
      clinicalFindings: 'Progress, new symptoms, objective change, and response to treatment.',
      diagnosis: 'Updated diagnosis or status of previous diagnosis.',
      treatmentPlan: 'What remains unchanged and what changed today.',
      recommendations: 'Next follow-up timing, monitoring plan, and escalation criteria.',
    },
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

export function getReportSectionPresentation(sectionKey, purposeCode = 'general') {
  const section = CLINICAL_REPORT_SECTIONS.find((item) => item.key === sectionKey);
  const purpose = getClinicalReportPurpose(purposeCode);
  const guidance = purpose.sectionGuidance?.[sectionKey] || '';
  return {
    key: sectionKey,
    title: section?.title || sectionKey,
    guidance,
    placeholder: guidance ? `${guidance}\n\nWrite clear, verified clinical text. Avoid abbreviations that the recipient may not understand.` : '',
    required: purpose.requiredSections.includes(sectionKey),
  };
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
    .map((section) => {
      const presentation = getReportSectionPresentation(section.key, purposeCode);
      return {
        id: section.key,
        label: `${presentation.title} completed`,
        complete: isMeaningfulReportSection(sections[section.key]),
        blocking: true,
      };
    });

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
    purpose.audience ? `Prepared for: ${purpose.audience}` : null,
    purpose.useCase ? `Document use: ${purpose.useCase}` : null,
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
