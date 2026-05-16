import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { toCsv } from '../../packages/core/lib/csv.js';

describe('toCsv', () => {
  it('uses display labels for mapped header keys and keeps unmapped keys raw', () => {
    const csv = toCsv(
      [
        { doctor_name: 'Dr. Assad', visits: 7, status: 'active' },
      ],
      {
        doctor_name: 'Doctor',
        visits: 'Visits',
      }
    );

    assert.equal(csv, 'Doctor,Visits,status\r\nDr. Assad,7,active');
  });

  it('escapes mapped header labels the same way as row values', () => {
    const csv = toCsv(
      [{ patient_name: 'A, B' }],
      { patient_name: 'Patient, name' }
    );

    assert.equal(csv, '"Patient, name"\r\n"A, B"');
  });
});
