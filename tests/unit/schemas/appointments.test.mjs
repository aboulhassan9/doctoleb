import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  appointmentBookingSchema,
  parseWithSchema,
} from '../../../packages/core/schemas/index.js';

const validBooking = () => ({
  slotId: '11111111-1111-4111-8111-111111111111',
  patientId: '22222222-2222-4222-8222-222222222222',
  bookedBy: '33333333-3333-4333-8333-333333333333',
  status: 'scheduled',
  reason: 'Routine follow-up visit',
});

describe('appointmentBookingSchema', () => {
  it('accepts a complete booking payload', () => {
    const { data, error } = parseWithSchema(appointmentBookingSchema, validBooking());
    assert.equal(error, null);
    assert.equal(data.status, 'scheduled');
    assert.equal(data.reason, 'Routine follow-up visit');
  });

  it('trims whitespace in the reason', () => {
    const { data, error } = parseWithSchema(appointmentBookingSchema, {
      ...validBooking(),
      reason: '   leading and trailing whitespace   ',
    });
    assert.equal(error, null);
    assert.equal(data.reason, 'leading and trailing whitespace');
  });

  it('rejects a non-UUID slotId', () => {
    const { error } = parseWithSchema(appointmentBookingSchema, {
      ...validBooking(),
      slotId: 'not-a-uuid',
    });
    assert.notEqual(error, null);
  });

  it('rejects a missing patientId', () => {
    const payload = validBooking();
    delete payload.patientId;
    const { error } = parseWithSchema(appointmentBookingSchema, payload);
    assert.notEqual(error, null);
  });

  it('rejects an empty reason', () => {
    const { error } = parseWithSchema(appointmentBookingSchema, {
      ...validBooking(),
      reason: '',
    });
    assert.notEqual(error, null);
  });

  it('rejects a status outside the appointments status enum', () => {
    const { error } = parseWithSchema(appointmentBookingSchema, {
      ...validBooking(),
      status: 'totally-made-up',
    });
    assert.notEqual(error, null);
  });

  it('accepts the visitTypeId as optional', () => {
    const { data, error } = parseWithSchema(appointmentBookingSchema, {
      ...validBooking(),
      visitTypeId: '44444444-4444-4444-8444-444444444444',
    });
    assert.equal(error, null);
    assert.equal(data.visitTypeId, '44444444-4444-4444-8444-444444444444');
  });

  it('accepts no visitTypeId at all (optional field omitted)', () => {
    const payload = validBooking();
    const { error } = parseWithSchema(appointmentBookingSchema, payload);
    assert.equal(error, null);
  });
});
