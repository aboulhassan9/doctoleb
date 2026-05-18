import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPrecheckSubmissionPayload,
  parseOptionalPrecheckNumber,
} from '../../packages/core/lib/precheckPayload.js';

describe('precheck payload coercion', () => {
  it('coerces numeric vital strings into service-schema numbers', () => {
    const payload = buildPrecheckSubmissionPayload({
      patientId: '11111111-1111-4111-8111-111111111111',
      vitals: {
        bloodPressure: ' 120/80 ',
        temperature: '36.8',
        heartRate: '72',
        respiratoryRate: '16',
        weight: '68.5',
        height: '168',
      },
      allergies: [' Penicillin ', '', 'Dust'],
      medications: [' Amoxicillin 500mg ', ''],
      observations: { symptoms: ' cough ', reports: ' no distress ' },
      fileNames: ['cbc.pdf'],
    });

    assert.equal(payload.bloodPressure, '120/80');
    assert.equal(payload.temperature, 36.8);
    assert.equal(payload.heartRate, 72);
    assert.equal(payload.respiratoryRate, 16);
    assert.equal(payload.weight, 68.5);
    assert.equal(payload.allergies, 'Penicillin, Dust');
    assert.equal(payload.currentMedications, 'Amoxicillin 500mg');
    assert.match(payload.symptoms, /cough/);
    assert.match(payload.symptoms, /Attached reports: cbc\.pdf/);
  });

  it('returns null for optional blanks and rejects malformed numbers', () => {
    assert.equal(parseOptionalPrecheckNumber('', 'Weight'), null);
    assert.equal(parseOptionalPrecheckNumber('   ', 'Weight'), null);
    assert.throws(
      () => parseOptionalPrecheckNumber('abc', 'Temperature'),
      /Temperature must be a valid number/
    );
  });
});
