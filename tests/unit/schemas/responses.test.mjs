import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  appointmentBookFromSlotResponseSchema,
  walkInPatientCreateResponseSchema,
  sessionUserResponseSchema,
  parseWithSchema,
} from '../../../packages/core/schemas/index.js';

describe('appointmentBookFromSlotResponseSchema (F3)', () => {
  it('accepts a partial response (id only)', () => {
    const { error } = parseWithSchema(appointmentBookFromSlotResponseSchema, {
      id: '11111111-1111-4111-8111-111111111111',
    });
    assert.equal(error, null);
  });

  it('accepts a fully normalized appointment', () => {
    const { error } = parseWithSchema(appointmentBookFromSlotResponseSchema, {
      id: '11111111-1111-4111-8111-111111111111',
      status: 'scheduled',
      scheduled_at: '2026-05-14T09:00:00Z',
      reason: 'Visit',
      doctorName: 'Dr. Maya Haddad',
    });
    assert.equal(error, null);
  });

  it('rejects a non-UUID id', () => {
    const { error } = parseWithSchema(appointmentBookFromSlotResponseSchema, {
      id: 'not-a-uuid',
    });
    assert.notEqual(error, null);
  });

  it('rejects a missing id', () => {
    const { error } = parseWithSchema(appointmentBookFromSlotResponseSchema, {
      status: 'scheduled',
    });
    assert.notEqual(error, null);
  });
});

describe('walkInPatientCreateResponseSchema (F3)', () => {
  it('accepts a valid walk-in response', () => {
    const { error } = parseWithSchema(walkInPatientCreateResponseSchema, {
      id: '11111111-1111-4111-8111-111111111111',
      users: { id: '22222222-2222-4222-8222-222222222222' },
      full_name: 'Maya Haddad',
    });
    assert.equal(error, null);
  });

  it('rejects a missing nested users.id', () => {
    const { error } = parseWithSchema(walkInPatientCreateResponseSchema, {
      id: '11111111-1111-4111-8111-111111111111',
      users: {},
      full_name: 'Maya Haddad',
    });
    assert.notEqual(error, null);
  });

  it('rejects when users is missing entirely', () => {
    const { error } = parseWithSchema(walkInPatientCreateResponseSchema, {
      id: '11111111-1111-4111-8111-111111111111',
      full_name: 'Maya Haddad',
    });
    assert.notEqual(error, null);
  });

  it('passes through extra columns (passthrough mode)', () => {
    const { data, error } = parseWithSchema(walkInPatientCreateResponseSchema, {
      id: '11111111-1111-4111-8111-111111111111',
      users: { id: '22222222-2222-4222-8222-222222222222' },
      date_of_birth: '1990-05-13',
      sex: 'female',
    });
    assert.equal(error, null);
    assert.equal(data.date_of_birth, '1990-05-13');
    assert.equal(data.sex, 'female');
  });
});

describe('sessionUserResponseSchema (F3)', () => {
  it('accepts a doctor session user', () => {
    const { error } = parseWithSchema(sessionUserResponseSchema, {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'doctor@clinic.com',
      role: 'doctor',
    });
    assert.equal(error, null);
  });

  it('accepts each valid role', () => {
    for (const role of ['doctor', 'secretary', 'patient', 'predoctor', 'admin']) {
      const { error } = parseWithSchema(sessionUserResponseSchema, {
        id: '11111111-1111-4111-8111-111111111111',
        role,
      });
      assert.equal(error, null, `role ${role} should validate`);
    }
  });

  it('rejects an unknown role', () => {
    const { error } = parseWithSchema(sessionUserResponseSchema, {
      id: '11111111-1111-4111-8111-111111111111',
      role: 'janitor',
    });
    assert.notEqual(error, null);
  });

  it('rejects a non-UUID id', () => {
    const { error } = parseWithSchema(sessionUserResponseSchema, {
      id: 'not-a-uuid',
      role: 'doctor',
    });
    assert.notEqual(error, null);
  });

  it('allows missing or null email (optional + nullable)', () => {
    const { error: err1 } = parseWithSchema(sessionUserResponseSchema, {
      id: '11111111-1111-4111-8111-111111111111',
      role: 'doctor',
    });
    assert.equal(err1, null);

    const { error: err2 } = parseWithSchema(sessionUserResponseSchema, {
      id: '11111111-1111-4111-8111-111111111111',
      email: null,
      role: 'doctor',
    });
    assert.equal(err2, null);
  });
});
