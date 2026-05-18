import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  'supabase/migrations/20260518120000_patient_self_intake_rpc.sql'
);

describe('patient onboarding configurable intake migration contract', () => {
  it('adds config-versioned custom answer storage to medical_intake', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    assert.match(sql, /add column if not exists field_config_version integer not null default 1/);
    assert.match(sql, /add column if not exists custom_answers jsonb not null default '\{\}'::jsonb/);
    assert.match(sql, /medical_intake_custom_answers_object_check/);
  });

  it('creates a zero-PHI field configuration table for tenant and doctor scopes', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    assert.match(sql, /create table if not exists public\.patient_form_field_config/);
    assert.match(sql, /form_context = any \(array\['patient_onboarding', 'appointment_booking'\]\)/);
    assert.match(sql, /scope = any \(array\['tenant', 'doctor'\]\)/);
    assert.match(sql, /field_kind = any \(array\['base', 'custom'\]\)/);
    assert.match(sql, /patient_form_field_config_active_scope_key_idx/);
    assert.match(sql, /patient_form_field_config_set_updated_at/);
    assert.match(sql, /alter table public\.patient_form_field_config enable row level security/);
  });

  it('keeps custom fields namespaced and base fields allowlisted at the DB boundary', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    assert.match(sql, /field_kind = 'base'/);
    assert.match(sql, /'date_of_birth'/);
    assert.match(sql, /'current_medications'/);
    assert.match(sql, /field_kind = 'custom'/);
    assert.match(sql, /field_key ~ '\^custom\\\.\[a-z0-9_\]\{2,60\}\$'/);
  });

  it('returns a scoped patient onboarding definition without PHI values', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    const definitionFunctionSql = sql
      .split('create or replace function public.get_patient_onboarding_definition')[1]
      .split('drop function if exists public.submit_patient_self_intake')[0];

    assert.match(sql, /create or replace function public\.get_patient_onboarding_definition/);
    assert.match(sql, /returns jsonb/);
    assert.match(sql, /fieldOverrides/);
    assert.match(sql, /customFields/);
    assert.doesNotMatch(definitionFunctionSql, /custom_answers/);
  });

  it('submits patient self-intake only through ownership and active custom field checks', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    assert.match(sql, /create or replace function public\.submit_patient_self_intake/);
    assert.match(sql, /PATIENT_NOT_FOUND_OR_FORBIDDEN/);
    assert.match(sql, /jsonb_typeof\(v_custom_answers\) <> 'object'/);
    assert.match(sql, /CUSTOM_FIELD_NOT_ALLOWED/);
    assert.match(sql, /char_length\(coalesce\(answer\.field_value #>> '\{\}', ''\)\) > 4000/);
    assert.match(sql, /config\.field_type = 'select'/);
  });
});
