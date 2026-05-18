import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildClinicalReportContent,
  buildClinicalSummarySnippets,
  getPatientAge,
  getPatientDisplayName,
  getPatientIdentitySummary,
  getReportReadiness,
  parseClinicalReportSections,
  sanitizeClinicalReportText,
} from '../../../packages/core/lib/clinicalReportBuilder.js';

const PATIENT = {
  id: '33333333-3333-4333-8333-333333333333',
  date_of_birth: '1984-06-20',
  sex: 'female',
  blood_type: 'O+',
  allergies: 'Penicillin',
  medical_history: 'Hypertension since 2020.',
  users: {
    first_name: 'Nour',
    last_name: 'Haddad',
    phone: '+96170000000',
    email: 'nour@example.test',
  },
};

describe('clinical report builder patient identity', () => {
  it('formats patient display name and age without auto-selecting a fake patient', () => {
    assert.equal(getPatientDisplayName(PATIENT), 'Nour Haddad');
    assert.equal(getPatientDisplayName(null), 'Unnamed patient');
    assert.equal(getPatientAge('1984-06-20', new Date('2026-05-18T10:00:00Z')), 41);
  });

  it('returns compact identity context for report headers and selectors', () => {
    const identity = getPatientIdentitySummary(PATIENT, { now: new Date('2026-05-18T10:00:00Z') });
    assert.equal(identity.name, 'Nour Haddad');
    assert.equal(identity.age, 41);
    assert.equal(identity.allergies, 'Penicillin');
    assert.equal(identity.medicalHistory, 'Hypertension since 2020.');
    assert.equal(identity.initials, 'NH');
  });
});

describe('clinical report builder readiness', () => {
  it('blocks save until patient, doctor, and required meaningful sections exist', () => {
    const readiness = getReportReadiness({
      patient: PATIENT,
      doctorId: '44444444-4444-4444-8444-444444444444',
      purposeCode: 'general',
      sections: {
        clinicalFindings: 'sdgsdg',
        diagnosis: 'Acute bronchitis',
        treatmentPlan: 'Oral hydration and follow-up.',
      },
    });

    assert.equal(readiness.canSave, false);
    assert.deepEqual(readiness.missingRequired, ['Clinical Findings completed']);
  });

  it('allows save when the selected purpose has all required clinical content', () => {
    const readiness = getReportReadiness({
      patient: PATIENT,
      doctorId: '44444444-4444-4444-8444-444444444444',
      purposeCode: 'specialist',
      sections: {
        clinicalFindings: 'Persistent cough with mild wheezing.',
        diagnosis: 'Suspected asthma exacerbation.',
        treatmentPlan: 'Start inhaled bronchodilator and monitor peak flow.',
        recommendations: 'Pulmonology review within one week.',
      },
    });

    assert.equal(readiness.canSave, true);
    assert.deepEqual(readiness.missingRequired, []);
  });
});

describe('clinical report builder content reuse', () => {
  it('removes seed and operational metadata from clinical report text', () => {
    assert.equal(
      sanitizeClinicalReportText('Migraine episodes with nausea [seed:ops_seed_20260518] Visit completed.'),
      'Migraine episodes with nausea Visit completed.'
    );
    assert.equal(
      sanitizeClinicalReportText('Chronic condition follow-up documented in seed workload.'),
      'Chronic condition follow-up documented in chart history.'
    );
    assert.equal(
      sanitizeClinicalReportText('Seed Medical Report 11 (ops_seed_20260518)'),
      'Seed Medical Report 11'
    );
  });

  it('builds structured report text that can be parsed back into sections', () => {
    const content = buildClinicalReportContent({
      patient: PATIENT,
      purposeCode: 'insurance',
      generatedAt: new Date('2026-05-18T10:00:00Z'),
      sourceEncounter: { id: '11111111-1111-4111-8111-111111111111' },
      sections: {
        medicalHistory: 'Hypertension. No prior surgeries.',
        clinicalFindings: 'Blood pressure controlled today.',
        diagnosis: 'Essential hypertension.',
        treatmentPlan: 'Continue current medication.',
        recommendations: 'Repeat labs in three months.',
      },
    });

    assert.match(content, /Purpose: Insurance medical report/);
    assert.match(content, /Patient: Nour Haddad/);
    assert.match(content, /Source encounter: 11111111-1111-4111-8111-111111111111/);

    const parsed = parseClinicalReportSections(content);
    assert.equal(parsed.medicalHistory, 'Hypertension. No prior surgeries.');
    assert.equal(parsed.clinicalFindings, 'Blood pressure controlled today.');
    assert.equal(parsed.diagnosis, 'Essential hypertension.');
    assert.equal(parsed.treatmentPlan, 'Continue current medication.');
    assert.equal(parsed.recommendations, 'Repeat labs in three months.');
  });

  it('creates snippets from chart data so the doctor does not retype everything by hand', () => {
    const snippets = buildClinicalSummarySnippets({
      patient: { ...PATIENT, medical_history: 'Chronic condition follow-up documented in seed workload.' },
      diagnoses: [{ diagnosis_text: 'Essential hypertension' }, { diseases: { name: 'Type 2 diabetes' } }],
      prescriptions: [
        { medication_name: 'Amlodipine', dosage: '5 mg', frequency: 'daily', duration: '30 days' },
      ],
      encounters: [{ chief_complaint: 'Headache [seed:ops_seed_20260518]', summary: 'No neurologic deficit.' }],
      documents: [],
    });

    assert.equal(snippets.medicalHistory, 'Chronic condition follow-up documented in chart history.');
    assert.equal(snippets.allergies, 'Allergies: Penicillin');
    assert.equal(snippets.diagnosisSummary, 'Essential hypertension; Type 2 diabetes');
    assert.equal(snippets.activeMedications, 'Amlodipine - 5 mg - daily - 30 days');
    assert.equal(snippets.latestEncounterSummary, 'Headache No neurologic deficit.');
  });

  it('sanitizes copied previous report sections before reuse', () => {
    const parsed = parseClinicalReportSections(`
Medical History
Chronic condition follow-up documented in seed workload.

Clinical Findings
Migraine episodes with nausea [seed:ops_seed_20260518] Visit completed.
`);

    assert.equal(parsed.medicalHistory, 'Chronic condition follow-up documented in chart history.');
    assert.equal(parsed.clinicalFindings, 'Migraine episodes with nausea Visit completed.');
  });
});
