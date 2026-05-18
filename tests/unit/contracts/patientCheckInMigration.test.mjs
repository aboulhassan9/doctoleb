import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync('supabase/migrations/20260518200000_patient_self_check_in_rpc.sql', 'utf8');

describe('patient self check-in migration contract', () => {
  it('adds appointment-scoped precheck fields needed by patient check-in', () => {
    assert.match(sql, /add column if not exists appointment_id/);
    assert.match(sql, /add column if not exists respiratory_rate/);
    assert.match(sql, /add column if not exists custom_answers jsonb/);
    assert.match(sql, /idx_precheck_forms_appointment_id/);
  });

  it('writes check-in through an ownership RPC, not direct browser table writes', () => {
    assert.match(sql, /create or replace function public\.submit_patient_check_in/);
    assert.match(sql, /public\.current_domain_user_id\(\)/);
    assert.match(sql, /APPOINTMENT_NOT_FOUND_OR_FORBIDDEN/);
    assert.match(sql, /APPOINTMENT_NOT_CHECK_IN_ELIGIBLE/);
    assert.match(sql, /CUSTOM_ANSWER_NOT_ALLOWED/);
    assert.match(sql, /grant execute on function public\.submit_patient_check_in/);
    assert.doesNotMatch(sql, /grant insert, update on public\.precheck_forms to authenticated/);
  });
});
