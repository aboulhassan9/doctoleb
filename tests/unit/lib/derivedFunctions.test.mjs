/**
 * derivedFunctions.test.mjs
 *
 * Closed-DSL coverage for the `derived` field type. Locks the function
 * signatures, error-degradation paths, and arg-resolution rules so the
 * renderer and the editor preview never diverge.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateDerivation,
  DERIVATION_FUNCTIONS,
} from '../../../packages/core/lib/composite.js';

const BINDINGS = {
  'patient.full_name': 'Asma Saleh',
  'patient.date_of_birth': '1990-01-01',
  'encounter.started_at': '2026-05-15',
};

// Deterministic clock for age() so the test isn't flaky against real time.
const NOW_ISO = '2026-05-15T12:00:00.000Z';

describe('evaluateDerivation', () => {
  it('exposes the closed function set', () => {
    assert.deepEqual(
      [...DERIVATION_FUNCTIONS].sort(),
      ['age', 'concat', 'lower', 'trim', 'upper', 'years_between'],
    );
  });

  it('age returns whole years to today', () => {
    const out = evaluateDerivation(
      { fn: 'age', args: [{ binding: 'patient.date_of_birth' }] },
      BINDINGS,
      NOW_ISO,
    );
    assert.equal(out, '36');
  });

  it('years_between returns whole years between two bindings', () => {
    const out = evaluateDerivation(
      {
        fn: 'years_between',
        args: [
          { binding: 'patient.date_of_birth' },
          { binding: 'encounter.started_at' },
        ],
      },
      BINDINGS,
      NOW_ISO,
    );
    assert.equal(out, '36');
  });

  it('concat joins strings — mixed bindings + literals', () => {
    const out = evaluateDerivation(
      {
        fn: 'concat',
        args: [
          { binding: 'patient.full_name' },
          { literal: ' — born ' },
          { binding: 'patient.date_of_birth' },
        ],
      },
      BINDINGS,
      NOW_ISO,
    );
    assert.equal(out, 'Asma Saleh — born 1990-01-01');
  });

  it('upper / lower / trim transform their single argument', () => {
    assert.equal(
      evaluateDerivation({ fn: 'upper', args: [{ literal: 'hi' }] }, BINDINGS, NOW_ISO),
      'HI',
    );
    assert.equal(
      evaluateDerivation({ fn: 'lower', args: [{ literal: 'HI' }] }, BINDINGS, NOW_ISO),
      'hi',
    );
    assert.equal(
      evaluateDerivation({ fn: 'trim', args: [{ literal: '  spaced  ' }] }, BINDINGS, NOW_ISO),
      'spaced',
    );
  });

  it('unknown function name returns empty string instead of throwing', () => {
    assert.equal(
      evaluateDerivation({ fn: 'eval', args: [{ literal: 'rm -rf /' }] }, BINDINGS, NOW_ISO),
      '',
    );
  });

  it('missing binding resolves to empty without breaking the function', () => {
    const out = evaluateDerivation(
      { fn: 'concat', args: [{ binding: 'patient.full_name' }, { binding: 'patient.middle_name' }] },
      BINDINGS,
      NOW_ISO,
    );
    // patient.middle_name is not in the closed bindings set; renders empty.
    assert.equal(out, 'Asma Saleh');
  });

  it('unparseable date returns empty for age/years_between', () => {
    assert.equal(
      evaluateDerivation({ fn: 'age', args: [{ literal: 'not-a-date' }] }, BINDINGS, NOW_ISO),
      '',
    );
    assert.equal(
      evaluateDerivation(
        { fn: 'years_between', args: [{ literal: 'a' }, { literal: 'b' }] },
        BINDINGS,
        NOW_ISO,
      ),
      '',
    );
  });

  it('null/undefined derivation returns empty string', () => {
    assert.equal(evaluateDerivation(null, BINDINGS, NOW_ISO), '');
    assert.equal(evaluateDerivation(undefined, BINDINGS, NOW_ISO), '');
    assert.equal(evaluateDerivation({}, BINDINGS, NOW_ISO), '');
  });
});
