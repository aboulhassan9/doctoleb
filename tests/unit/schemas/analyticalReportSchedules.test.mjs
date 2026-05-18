/**
 * Unit tests for the analytical-report schedule schema (review FEAT-4).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyticalReportScheduleCreateSchema } from '../../../packages/core/schemas/analyticalReports.js';

const UUID = '11111111-1111-4111-8111-111111111111';

test('a daily schedule is valid without day fields', () => {
  const r = analyticalReportScheduleCreateSchema.safeParse({
    report_id: UUID, frequency: 'daily', hour: 8, created_by: UUID,
  });
  assert.equal(r.success, true);
});

test('hour / timezone / is_active default when omitted', () => {
  const r = analyticalReportScheduleCreateSchema.safeParse({
    report_id: UUID, frequency: 'daily', created_by: UUID,
  });
  assert.equal(r.success, true);
  assert.equal(r.data.hour, 8);
  assert.equal(r.data.timezone, 'UTC');
  assert.equal(r.data.is_active, true);
});

test('a weekly schedule requires a day of week', () => {
  const r = analyticalReportScheduleCreateSchema.safeParse({
    report_id: UUID, frequency: 'weekly', hour: 9, created_by: UUID,
  });
  assert.equal(r.success, false);
});

test('a weekly schedule with a day of week is valid', () => {
  const r = analyticalReportScheduleCreateSchema.safeParse({
    report_id: UUID, frequency: 'weekly', hour: 9, day_of_week: 3, created_by: UUID,
  });
  assert.equal(r.success, true);
});

test('a monthly schedule requires a day of month', () => {
  const r = analyticalReportScheduleCreateSchema.safeParse({
    report_id: UUID, frequency: 'monthly', hour: 9, created_by: UUID,
  });
  assert.equal(r.success, false);
});

test('rejects an out-of-range hour', () => {
  const r = analyticalReportScheduleCreateSchema.safeParse({
    report_id: UUID, frequency: 'daily', hour: 25, created_by: UUID,
  });
  assert.equal(r.success, false);
});

test('rejects a day of month past 28', () => {
  const r = analyticalReportScheduleCreateSchema.safeParse({
    report_id: UUID, frequency: 'monthly', day_of_month: 31, created_by: UUID,
  });
  assert.equal(r.success, false);
});
