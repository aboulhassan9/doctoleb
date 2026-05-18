import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseMock } from './__helpers__/supabaseMock.mjs';
import { __setSupabaseClientForTest } from '../../../packages/core/lib/supabase.js';
import { patientFormConfigService } from '../../../packages/core/services/patientFormConfig.js';

const DOCTOR_ID = '11111111-1111-4111-8111-111111111111';
const ROW_ID = '22222222-2222-4222-8222-222222222222';

let mock;
let previousClient;

beforeEach(() => {
  mock = createSupabaseMock();
  previousClient = __setSupabaseClientForTest(mock.client);
});

afterEach(() => {
  __setSupabaseClientForTest(previousClient);
});

describe('patientFormConfigService.list', () => {
  it('loads scoped patient form config rows through the core service', async () => {
    mock.onFrom('patient_form_field_config', () => ({
      data: [{ id: ROW_ID, field_key: 'symptoms' }],
      error: null,
    }));

    const result = await patientFormConfigService.list({
      context: 'check_in',
      scope: 'doctor',
      doctorId: DOCTOR_ID,
    });

    assert.equal(result.error, null);
    assert.equal(result.data[0].field_key, 'symptoms');
    assert.equal(mock.calls.from[0].table, 'patient_form_field_config');
    assert.deepEqual(
      mock.calls.from[0].modifiers.filter((modifier) => modifier.method === 'eq').map((modifier) => modifier.args),
      [
        ['form_context', 'check_in'],
        ['scope', 'doctor'],
        ['doctor_id', DOCTOR_ID],
      ]
    );
  });
});

describe('patientFormConfigService.save', () => {
  it('rejects non-registry base fields before the database boundary', async () => {
    const result = await patientFormConfigService.save({
      context: 'check_in',
      scope: 'doctor',
      doctorId: DOCTOR_ID,
      fieldKind: 'base',
      fieldKey: 'raw_database_column',
    });

    assert.equal(result.data, null);
    assert.match(result.error, /allowlisted/);
    assert.equal(mock.calls.from.length, 0);
  });

  it('saves an allowlisted doctor override with normalized payload', async () => {
    mock.onFrom('patient_form_field_config', () => ({
      data: { id: ROW_ID, field_key: 'symptoms', is_required: false },
      error: null,
    }));

    const result = await patientFormConfigService.save({
      id: ROW_ID,
      context: 'check_in',
      scope: 'doctor',
      doctorId: DOCTOR_ID,
      fieldKind: 'base',
      fieldKey: 'symptoms',
      required: false,
      visible: true,
      label: 'Visit symptoms',
    });

    assert.equal(result.error, null);
    const update = mock.calls.from[0].modifiers.find((modifier) => modifier.method === 'update');
    assert.equal(update.args[0].form_context, 'check_in');
    assert.equal(update.args[0].field_key, 'symptoms');
    assert.equal(update.args[0].field_type, 'textarea');
    assert.equal(update.args[0].is_required, false);
  });
});
