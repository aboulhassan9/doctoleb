import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransition,
  assertTransition,
  normalizeStatus,
  STATE_MACHINES,
  APPOINTMENT_STATUSES,
  ENCOUNTER_STATUSES,
} from '../../../packages/core/lib/stateMachines.js';

describe('normalizeStatus', () => {
  it('lowercases and collapses spaces to underscores', () => {
    assert.equal(normalizeStatus('Pre Check'), 'pre_check');
    assert.equal(normalizeStatus('PRE-CHECK'), 'pre_check');
    assert.equal(normalizeStatus('  in_consultation  '), 'in_consultation');
  });

  it('returns empty string for falsy input', () => {
    assert.equal(normalizeStatus(null), '');
    assert.equal(normalizeStatus(undefined), '');
    assert.equal(normalizeStatus(''), '');
  });
});

describe('canTransition — appointments', () => {
  it('allows scheduled → confirmed', () => {
    assert.equal(canTransition('appointment', 'scheduled', 'confirmed'), true);
  });

  it('allows confirmed → pre_check, but not scheduled → pre_check', () => {
    assert.equal(canTransition('appointment', 'confirmed', 'pre_check'), true);
    assert.equal(canTransition('appointment', 'scheduled', 'pre_check'), false);
  });

  it('treats identical from/to as a valid no-op', () => {
    assert.equal(canTransition('appointment', 'scheduled', 'scheduled'), true);
  });

  it('rejects transitions from terminal states', () => {
    assert.equal(canTransition('appointment', 'completed', 'scheduled'), false);
    assert.equal(canTransition('appointment', 'cancelled', 'scheduled'), false);
    assert.equal(canTransition('appointment', 'no_show', 'scheduled'), false);
  });

  it('rejects an unknown target status', () => {
    assert.equal(canTransition('appointment', 'scheduled', 'paid'), false);
  });

  it('rejects an unknown entity', () => {
    assert.equal(canTransition('imaginary', 'scheduled', 'completed'), false);
  });
});

describe('canTransition — encounters', () => {
  it('allows planned → in_progress → completed', () => {
    assert.equal(canTransition('encounter', 'planned', 'in_progress'), true);
    assert.equal(canTransition('encounter', 'in_progress', 'completed'), true);
  });

  it('rejects planned → completed (must pass through in_progress)', () => {
    assert.equal(canTransition('encounter', 'planned', 'completed'), false);
  });

  it('allows escape hatch to entered_in_error from non-terminal states', () => {
    assert.equal(canTransition('encounter', 'planned', 'entered_in_error'), true);
    assert.equal(canTransition('encounter', 'in_progress', 'entered_in_error'), true);
  });
});

describe('canTransition — orders + prescriptions', () => {
  it('orders: draft → ordered → in_progress → resulted', () => {
    assert.equal(canTransition('order', 'draft', 'ordered'), true);
    assert.equal(canTransition('order', 'ordered', 'in_progress'), true);
    assert.equal(canTransition('order', 'in_progress', 'resulted'), true);
  });

  it('prescriptions: cannot reactivate a completed prescription', () => {
    assert.equal(canTransition('prescription', 'completed', 'active'), false);
  });
});

describe('assertTransition', () => {
  it('returns null on a valid transition', () => {
    assert.equal(assertTransition('appointment', 'scheduled', 'confirmed'), null);
  });

  it('throws a descriptive error on an invalid transition', () => {
    assert.throws(
      () => assertTransition('appointment', 'completed', 'scheduled'),
      /Invalid appointment transition.*"completed".*"scheduled".*Allowed: \[none\]/,
    );
  });

  it('lists the allowed next states in the error message', () => {
    assert.throws(
      () => assertTransition('appointment', 'scheduled', 'completed'),
      /Allowed: \[confirmed, cancelled, no_show\]/,
    );
  });

  it('does not throw on a valid transition that returns null', () => {
    // Sanity: scheduled → no_show is in the allowed list for 'scheduled'.
    assert.equal(assertTransition('appointment', 'scheduled', 'no_show'), null);
  });

  it('throws for unknown entity', () => {
    assert.throws(() => assertTransition('madeup', 'a', 'b'), /Invalid madeup transition/);
  });
});

describe('exported status lists', () => {
  it('APPOINTMENT_STATUSES matches the keys of the appointment state machine', () => {
    assert.deepEqual([...APPOINTMENT_STATUSES].sort(), Object.keys(STATE_MACHINES.appointment).sort());
  });

  it('ENCOUNTER_STATUSES matches the keys of the encounter state machine', () => {
    assert.deepEqual([...ENCOUNTER_STATUSES].sort(), Object.keys(STATE_MACHINES.encounter).sort());
  });
});
