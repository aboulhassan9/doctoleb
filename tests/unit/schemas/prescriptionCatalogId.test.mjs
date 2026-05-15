import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { prescriptionSchema } from '../../../packages/core/schemas/clinical.js';

const VALID_PRESCRIPTION = {
  encounter_id: '11111111-1111-4111-8111-111111111111',
  patient_id: '22222222-2222-4222-8222-222222222222',
  doctor_id: '33333333-3333-4333-8333-333333333333',
  medication_name: 'Amoxicillin',
  dosage: '500mg',
  route: 'oral',
  frequency: 'TID',
  duration: '7 days',
  instructions: 'Take with food.',
  prescribed_by: '33333333-3333-4333-8333-333333333333',
};

const CATALOG_ID = '44444444-4444-4444-8444-444444444444';

// --- AT-2.4: prescriptionSchema accepts medication_catalog_id ---
describe('prescriptionSchema — medication_catalog_id extension (AT-2.4)', () => {
  it('accepts a valid prescription WITHOUT medication_catalog_id (backward-compatible)', () => {
    const result = prescriptionSchema.safeParse(VALID_PRESCRIPTION);
    assert.equal(result.success, true, `Expected success, got: ${JSON.stringify(result.error?.issues)}`);
    // medication_catalog_id should default to undefined (not in the output).
    assert.equal(result.data.medication_catalog_id, undefined);
  });

  it('accepts a valid prescription WITH medication_catalog_id = a UUID', () => {
    const result = prescriptionSchema.safeParse({
      ...VALID_PRESCRIPTION,
      medication_catalog_id: CATALOG_ID,
    });
    assert.equal(result.success, true, `Expected success, got: ${JSON.stringify(result.error?.issues)}`);
    assert.equal(result.data.medication_catalog_id, CATALOG_ID);
  });

  it('accepts medication_catalog_id = null', () => {
    const result = prescriptionSchema.safeParse({
      ...VALID_PRESCRIPTION,
      medication_catalog_id: null,
    });
    assert.equal(result.success, true, `Expected success, got: ${JSON.stringify(result.error?.issues)}`);
    assert.equal(result.data.medication_catalog_id, null);
  });

  it('rejects medication_catalog_id = a non-UUID string', () => {
    const result = prescriptionSchema.safeParse({
      ...VALID_PRESCRIPTION,
      medication_catalog_id: 'not-a-uuid',
    });
    assert.equal(result.success, false);
  });

  it('still rejects a prescription missing required fields', () => {
    const { medication_name: _omit, ...missing } = VALID_PRESCRIPTION;
    const result = prescriptionSchema.safeParse(missing);
    assert.equal(result.success, false);
  });
});
