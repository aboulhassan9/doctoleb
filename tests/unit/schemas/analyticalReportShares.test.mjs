/**
 * Unit tests for the analytical-report share grant schema (review FEAT-3).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyticalReportShareCreateSchema } from '../../../packages/core/schemas/analyticalReports.js';

const UUID = '11111111-1111-4111-8111-111111111111';

test('analyticalReportShareCreateSchema accepts a valid grant', () => {
  const r = analyticalReportShareCreateSchema.safeParse({
    report_id: UUID,
    shared_with_user_id: UUID,
    permission_level: 'edit',
    granted_by: UUID,
  });
  assert.equal(r.success, true);
});

test('analyticalReportShareCreateSchema defaults permission_level to edit', () => {
  const r = analyticalReportShareCreateSchema.safeParse({
    report_id: UUID,
    shared_with_user_id: UUID,
    granted_by: UUID,
  });
  assert.equal(r.success, true);
  assert.equal(r.data.permission_level, 'edit');
});

test('analyticalReportShareCreateSchema rejects an unknown permission level', () => {
  const r = analyticalReportShareCreateSchema.safeParse({
    report_id: UUID,
    shared_with_user_id: UUID,
    permission_level: 'admin',
    granted_by: UUID,
  });
  assert.equal(r.success, false);
});

test('analyticalReportShareCreateSchema rejects a non-uuid report id', () => {
  const r = analyticalReportShareCreateSchema.safeParse({
    report_id: 'not-a-uuid',
    shared_with_user_id: UUID,
    granted_by: UUID,
  });
  assert.equal(r.success, false);
});

test('analyticalReportShareCreateSchema rejects unknown keys', () => {
  const r = analyticalReportShareCreateSchema.safeParse({
    report_id: UUID,
    shared_with_user_id: UUID,
    granted_by: UUID,
    note: 'extra',
  });
  assert.equal(r.success, false);
});
