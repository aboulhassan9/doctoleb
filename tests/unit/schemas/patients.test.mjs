import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  walkInPatientSchema,
  patientProfileUpdateSchema,
  parseWithSchema,
} from '../../../packages/core/schemas/index.js';

describe('walkInPatientSchema', () => {
  it('accepts a minimal walk-in (full_name only)', () => {
    const { data, error } = parseWithSchema(walkInPatientSchema, {
      full_name: 'Maya Haddad',
    });
    assert.equal(error, null);
    assert.equal(data.full_name, 'Maya Haddad');
  });

  it('trims whitespace and rejects empty names', () => {
    const { error: errEmpty } = parseWithSchema(walkInPatientSchema, { full_name: '   ' });
    assert.notEqual(errEmpty, null);
  });

  it('accepts a fully populated walk-in', () => {
    const { data, error } = parseWithSchema(walkInPatientSchema, {
      full_name: 'Maya Haddad',
      phone: '+961 71 234 567',
      email: 'maya@example.com',
      date_of_birth: '1990-05-13',
    });
    assert.equal(error, null);
    assert.equal(data.email, 'maya@example.com');
  });

  it('rejects a malformed phone number', () => {
    const { error } = parseWithSchema(walkInPatientSchema, {
      full_name: 'Maya Haddad',
      phone: 'this-is-not-a-phone-number',
    });
    assert.notEqual(error, null);
  });

  it('rejects a malformed email', () => {
    const { error } = parseWithSchema(walkInPatientSchema, {
      full_name: 'Maya Haddad',
      email: 'not-an-email',
    });
    assert.notEqual(error, null);
  });

  it('treats blank phone as null (preprocess via nullablePhone)', () => {
    const { data, error } = parseWithSchema(walkInPatientSchema, {
      full_name: 'Maya Haddad',
      phone: '',
    });
    assert.equal(error, null);
    assert.equal(data.phone, null);
  });
});

describe('patientProfileUpdateSchema', () => {
  it('accepts a full profile update', () => {
    const { data, error } = parseWithSchema(patientProfileUpdateSchema, {
      first_name: 'Maya',
      last_name: 'Haddad',
      phone: '+961 71 234 567',
      date_of_birth: '1990-05-13',
      sex: 'female',
      blood_type: 'A+',
      allergies: 'Penicillin',
      insurance_id: 'INS-12345',
      emergency_contact: 'Sami Haddad',
      emergency_phone: '+961 71 999 888',
      medical_history: 'Asthma',
    });
    assert.equal(error, null);
    assert.equal(data.first_name, 'Maya');
  });

  it('rejects a missing first_name', () => {
    const { error } = parseWithSchema(patientProfileUpdateSchema, {
      last_name: 'Haddad',
      phone: '+961 71 234 567',
      date_of_birth: '1990-05-13',
      sex: null,
      blood_type: null,
      allergies: null,
      insurance_id: null,
      emergency_contact: null,
      emergency_phone: null,
      medical_history: null,
    });
    assert.notEqual(error, null);
  });

  it('caps medical_history at 8000 characters', () => {
    const longText = 'a'.repeat(9000);
    const { error } = parseWithSchema(patientProfileUpdateSchema, {
      first_name: 'Maya',
      last_name: 'Haddad',
      phone: '+961 71 234 567',
      date_of_birth: '1990-05-13',
      sex: null,
      blood_type: null,
      allergies: null,
      insurance_id: null,
      emergency_contact: null,
      emergency_phone: null,
      medical_history: longText,
    });
    assert.notEqual(error, null);
  });

  it('treats blank optional fields as null', () => {
    const { data, error } = parseWithSchema(patientProfileUpdateSchema, {
      first_name: 'Maya',
      last_name: 'Haddad',
      phone: '+961 71 234 567',
      date_of_birth: '1990-05-13',
      sex: '',
      blood_type: '',
      allergies: '',
      insurance_id: '',
      emergency_contact: '',
      emergency_phone: '',
      medical_history: '',
    });
    assert.equal(error, null);
    assert.equal(data.sex, null);
    assert.equal(data.blood_type, null);
    assert.equal(data.emergency_phone, null);
  });
});
