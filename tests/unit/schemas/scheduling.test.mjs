import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  manualSlotSchema,
  recurringSlotsSchema,
  doctorScheduleTemplateSchema,
  parseWithSchema,
} from '../../../packages/core/schemas/index.js';

const validManualSlot = () => ({
  doctor_id: '11111111-1111-4111-8111-111111111111',
  clinic_id: '22222222-2222-4222-8222-222222222222',
  date: '2026-05-14',
  start_time: '09:00',
  end_time: '09:30',
  created_by: '33333333-3333-4333-8333-333333333333',
});

const validRecurringSlots = () => ({
  doctor_id: '11111111-1111-4111-8111-111111111111',
  clinic_id: '22222222-2222-4222-8222-222222222222',
  start_time: '09:00',
  end_time: '17:00',
  weekdays: [1, 2, 3, 4, 5],
  occurrences: 12,
  created_by: '33333333-3333-4333-8333-333333333333',
});

const validTemplate = () => ({
  doctor_id: '11111111-1111-4111-8111-111111111111',
  clinic_id: '22222222-2222-4222-8222-222222222222',
  weekday: 1,
  start_time: '09:00',
  end_time: '17:00',
});

describe('manualSlotSchema', () => {
  it('accepts a valid slot', () => {
    const { error } = parseWithSchema(manualSlotSchema, validManualSlot());
    assert.equal(error, null);
  });

  it('rejects end_time before start_time (refine)', () => {
    const { error } = parseWithSchema(manualSlotSchema, {
      ...validManualSlot(),
      start_time: '10:00',
      end_time: '09:00',
    });
    assert.match(String(error), /end time must be after start time/i);
  });

  it('rejects an invalid date format', () => {
    const { error } = parseWithSchema(manualSlotSchema, {
      ...validManualSlot(),
      date: '14/05/2026',
    });
    assert.notEqual(error, null);
  });

  it('rejects a non-UUID doctor_id', () => {
    const { error } = parseWithSchema(manualSlotSchema, {
      ...validManualSlot(),
      doctor_id: 'doctor-one',
    });
    assert.notEqual(error, null);
  });
});

describe('recurringSlotsSchema', () => {
  it('accepts a valid recurring spec', () => {
    const { error } = parseWithSchema(recurringSlotsSchema, validRecurringSlots());
    assert.equal(error, null);
  });

  it('coerces numeric weekdays from string input', () => {
    const { data, error } = parseWithSchema(recurringSlotsSchema, {
      ...validRecurringSlots(),
      weekdays: ['1', '2', '3'],
    });
    assert.equal(error, null);
    assert.deepEqual(data.weekdays, [1, 2, 3]);
  });

  it('rejects an empty weekdays array', () => {
    const { error } = parseWithSchema(recurringSlotsSchema, {
      ...validRecurringSlots(),
      weekdays: [],
    });
    assert.notEqual(error, null);
  });

  it('rejects weekdays outside the 0-6 range', () => {
    const { error } = parseWithSchema(recurringSlotsSchema, {
      ...validRecurringSlots(),
      weekdays: [7],
    });
    assert.notEqual(error, null);
  });

  it('rejects more than 730 occurrences', () => {
    const { error } = parseWithSchema(recurringSlotsSchema, {
      ...validRecurringSlots(),
      occurrences: 1000,
    });
    assert.notEqual(error, null);
  });

  it('rejects zero occurrences', () => {
    const { error } = parseWithSchema(recurringSlotsSchema, {
      ...validRecurringSlots(),
      occurrences: 0,
    });
    assert.notEqual(error, null);
  });
});

describe('doctorScheduleTemplateSchema', () => {
  it('accepts a valid template', () => {
    const { error } = parseWithSchema(doctorScheduleTemplateSchema, validTemplate());
    assert.equal(error, null);
  });

  it('defaults slot_duration_minutes to 30', () => {
    const { data, error } = parseWithSchema(doctorScheduleTemplateSchema, validTemplate());
    assert.equal(error, null);
    assert.equal(data.slot_duration_minutes, 30);
  });

  it('rejects slot_duration_minutes below 5', () => {
    const { error } = parseWithSchema(doctorScheduleTemplateSchema, {
      ...validTemplate(),
      slot_duration_minutes: 2,
    });
    assert.notEqual(error, null);
  });

  it('rejects weekday outside 0-6', () => {
    const { error } = parseWithSchema(doctorScheduleTemplateSchema, {
      ...validTemplate(),
      weekday: 7,
    });
    assert.notEqual(error, null);
  });
});
