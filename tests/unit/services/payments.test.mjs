// paymentService unit tests.
//
// Why this file is detailed: paymentService encodes three real
// production-bug magnets. Each gets its own describe block here.
//
//   1. The no-`cancelled` rule — the DB enum has only
//      pending | completed | failed | refunded. `archive()` MUST map
//      pending → failed and completed → refunded, never 'cancelled'.
//      CLAUDE.md "Things that look wrong but aren't" calls this out.
//
//   2. The state machine is one-way:
//        pending   → completed | failed
//        completed → refunded
//        failed    → (terminal)
//        refunded  → (terminal)
//      `update({ status })` MUST consult assertTransition.
//
//   3. payment_method = 'insurance' requires the insurance_billing
//      entitlement. Other methods (cash, card) MUST NOT gate.

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseMock } from './__helpers__/supabaseMock.mjs';
import { __setSupabaseClientForTest } from '../../../packages/core/lib/supabase.js';
import { paymentService } from '../../../packages/core/services/payments.js';
import { EntitlementError } from '../../../packages/core/lib/entitlements.js';

// ── Fixtures ────────────────────────────────────────────────────────────

const PAYMENT_ID    = '11111111-1111-4111-8111-111111111111';
const PATIENT_ID    = '22222222-2222-4222-8222-222222222222';
const DOCTOR_ID     = '33333333-3333-4333-8333-333333333333';
const APPOINTMENT_ID = '44444444-4444-4444-8444-444444444444';

const VALID_CREATE_PAYLOAD = {
  patient_id: PATIENT_ID,
  doctor_id: DOCTOR_ID,
  appointment_id: APPOINTMENT_ID,
  amount: 75.5,
  currency: 'USD',
  status: 'pending',
  payment_method: 'cash',
  transaction_id: null,
};

const paymentRowWith = (status, overrides = {}) => ({
  id: PAYMENT_ID,
  patient_id: PATIENT_ID,
  doctor_id: DOCTOR_ID,
  appointment_id: APPOINTMENT_ID,
  amount: 75.5,
  currency: 'USD',
  status,
  payment_method: 'cash',
  ...overrides,
});

// Entitlement maps consumed by requirePaymentMethodAccess. Shape matches
// what resolveEntitlementMap()/featureFlagsToEntitlementMap() return.
const ENTITLEMENT_INSURANCE_ENABLED  = { insurance_billing: { isEnabled: true } };
const ENTITLEMENT_INSURANCE_DISABLED = { insurance_billing: { isEnabled: false } };

let mock;
let previousClient;

beforeEach(() => {
  mock = createSupabaseMock();
  previousClient = __setSupabaseClientForTest(mock.client);
});

afterEach(() => {
  __setSupabaseClientForTest(previousClient);
});

// Small helper: record the row passed to .update() and return the canned
// "after update" row. Used heavily by archive tests.
function captureLastUpdate(table, afterRow) {
  let captured = null;
  mock.onFrom(table, ({ callEntry }) => {
    const updateMod = callEntry.modifiers.find((m) => m.method === 'update');
    if (updateMod) captured = updateMod.args[0];
    return { data: afterRow, error: null };
  });
  return () => captured;
}

// ── getById ────────────────────────────────────────────────────────────

describe('paymentService.getById', () => {
  it('returns the row when found', async () => {
    mock.onFrom('payments', () => ({ data: paymentRowWith('pending'), error: null }));
    const result = await paymentService.getById(PAYMENT_ID);
    assert.equal(result.error, null);
    assert.equal(result.data.id, PAYMENT_ID);
    assert.equal(result.data.status, 'pending');
  });

  it('returns the supabase error when the row is missing', async () => {
    mock.onFrom('payments', () => ({ data: null, error: { message: 'No payment row' } }));
    const result = await paymentService.getById(PAYMENT_ID);
    assert.equal(result.data, null);
    assert.equal(result.error, 'No payment row');
  });
});

// ── create — input validation ───────────────────────────────────────────

describe('paymentService.create — input validation', () => {
  it('rejects amount = 0 (must be positive)', async () => {
    const result = await paymentService.create({ ...VALID_CREATE_PAYLOAD, amount: 0 });
    assert.equal(result.data, null);
    assert.match(String(result.error), /Amount must be greater than zero/);
    assert.equal(mock.calls.from.length, 0);
  });

  it('rejects a negative amount', async () => {
    const result = await paymentService.create({ ...VALID_CREATE_PAYLOAD, amount: -10 });
    assert.equal(result.data, null);
    assert.equal(mock.calls.from.length, 0);
  });

  it('rejects a status outside the DB enum (no "cancelled" allowed)', async () => {
    const result = await paymentService.create({ ...VALID_CREATE_PAYLOAD, status: 'cancelled' });
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    assert.equal(mock.calls.from.length, 0);
  });

  it('rejects a non-UUID patient_id', async () => {
    const result = await paymentService.create({ ...VALID_CREATE_PAYLOAD, patient_id: 'not-a-uuid' });
    assert.equal(result.data, null);
    assert.equal(mock.calls.from.length, 0);
  });
});

// ── create — entitlement gating for insurance ───────────────────────────

describe('paymentService.create — entitlement gating', () => {
  it('inserts when payment_method is cash regardless of entitlements (no gating)', async () => {
    mock.onFrom('payments', () => ({ data: paymentRowWith('pending'), error: null }));
    const result = await paymentService.create(
      { ...VALID_CREATE_PAYLOAD, payment_method: 'cash' },
      { entitlements: {} },  // empty entitlements — should still go through
    );
    assert.equal(result.error, null);
    assert.equal(result.data.status, 'pending');
  });

  it('rejects payment_method = insurance when insurance_billing is disabled', async () => {
    const result = await paymentService.create(
      { ...VALID_CREATE_PAYLOAD, payment_method: 'insurance' },
      { entitlements: ENTITLEMENT_INSURANCE_DISABLED },
    );
    assert.equal(result.data, null);
    // The service returns the EntitlementError instance as `error`.
    assert.ok(result.error instanceof EntitlementError);
    assert.equal(result.error.code, 'FEATURE_NOT_ENABLED');
    assert.equal(result.error.featureCode, 'insurance_billing');
    // No insert happened because the entitlement check failed first.
    assert.equal(mock.calls.from.length, 0);
  });

  it('allows payment_method = insurance when insurance_billing is enabled', async () => {
    mock.onFrom('payments', () => ({ data: paymentRowWith('pending', { payment_method: 'insurance' }), error: null }));
    const result = await paymentService.create(
      { ...VALID_CREATE_PAYLOAD, payment_method: 'insurance' },
      { entitlements: ENTITLEMENT_INSURANCE_ENABLED },
    );
    assert.equal(result.error, null);
    assert.equal(result.data.payment_method, 'insurance');
  });

  it('treats payment method matching case-insensitively (Insurance still gated)', async () => {
    const result = await paymentService.create(
      { ...VALID_CREATE_PAYLOAD, payment_method: 'Insurance' },
      { entitlements: ENTITLEMENT_INSURANCE_DISABLED },
    );
    assert.equal(result.data, null);
    assert.ok(result.error instanceof EntitlementError);
  });
});

// ── update — non-status path ────────────────────────────────────────────

describe('paymentService.update — non-status updates', () => {
  it('does NOT consult the transition guard or fetch current row when status is absent', async () => {
    mock.onFrom('payments', () => ({ data: paymentRowWith('pending', { amount: 99.99 }), error: null }));

    const result = await paymentService.update(PAYMENT_ID, { amount: 99.99 });
    assert.equal(result.error, null);
    assert.equal(result.data.amount, 99.99);
    // Only ONE payments-table call — no `select.eq.single` getById prefetch.
    const calls = mock.calls.from.filter((c) => c.table === 'payments');
    assert.equal(calls.length, 1);
    assert.ok(calls[0].modifiers.some((m) => m.method === 'update'));
  });
});

// ── update — status transition matrix ───────────────────────────────────

describe('paymentService.update — status transition matrix', () => {
  // Each entry: from -> { allowedTargets: [...], forbiddenTargets: [...] }
  // Mirrors lib/stateMachines.js exactly.
  const matrix = [
    { from: 'pending',   allowed: ['completed', 'failed'],          forbidden: ['refunded'] },
    { from: 'completed', allowed: ['refunded'],                     forbidden: ['pending', 'failed'] },
    { from: 'failed',    allowed: [],                               forbidden: ['pending', 'completed', 'refunded'] },
    { from: 'refunded',  allowed: [],                               forbidden: ['pending', 'completed', 'failed'] },
  ];

  for (const { from, allowed, forbidden } of matrix) {
    for (const target of allowed) {
      it(`allows ${from} → ${target}`, async () => {
        let callIndex = 0;
        mock.onFrom('payments', () => {
          callIndex += 1;
          // First call (getById prefetch) sees the current status.
          // Second call (the update) returns the new row.
          if (callIndex === 1) return { data: paymentRowWith(from), error: null };
          return { data: paymentRowWith(target), error: null };
        });
        const result = await paymentService.update(PAYMENT_ID, { status: target });
        assert.equal(result.error, null, `expected ${from} → ${target} to succeed`);
        assert.equal(result.data.status, target);
      });
    }

    for (const target of forbidden) {
      it(`rejects ${from} → ${target}`, async () => {
        let callIndex = 0;
        mock.onFrom('payments', () => {
          callIndex += 1;
          return { data: paymentRowWith(from), error: null };
        });
        const result = await paymentService.update(PAYMENT_ID, { status: target });
        assert.equal(result.data, null, `expected ${from} → ${target} to be rejected`);
        assert.notEqual(result.error, null);
        // Exactly one call (the getById prefetch). No update should have followed.
        assert.equal(callIndex, 1);
      });
    }
  }
});

// ── archive — the no-cancelled rule ─────────────────────────────────────

describe('paymentService.archive — status mapping (NEVER cancelled)', () => {
  it('pending → failed (captures the exact update payload)', async () => {
    let callIndex = 0;
    let capturedUpdate = null;
    mock.onFrom('payments', ({ callEntry }) => {
      callIndex += 1;
      // Calls in order:
      //   1. archive's getById      -> returns the pending row
      //   2. update's getById       -> returns the pending row again (for the transition guard)
      //   3. the actual update      -> returns the new row
      if (callIndex === 3) {
        const updateMod = callEntry.modifiers.find((m) => m.method === 'update');
        if (updateMod) capturedUpdate = updateMod.args[0];
        return { data: paymentRowWith('failed'), error: null };
      }
      return { data: paymentRowWith('pending'), error: null };
    });

    const result = await paymentService.archive(PAYMENT_ID);
    assert.equal(result.error, null);
    assert.equal(result.data.status, 'failed');
    // The literal 'cancelled' must NEVER appear in the update payload.
    assert.notEqual(JSON.stringify(capturedUpdate), undefined);
    assert.equal(capturedUpdate.status, 'failed');
    assert.doesNotMatch(JSON.stringify(capturedUpdate), /cancelled/);
  });

  it('completed → refunded (NEVER cancelled)', async () => {
    let callIndex = 0;
    let capturedUpdate = null;
    mock.onFrom('payments', ({ callEntry }) => {
      callIndex += 1;
      if (callIndex === 3) {
        const updateMod = callEntry.modifiers.find((m) => m.method === 'update');
        if (updateMod) capturedUpdate = updateMod.args[0];
        return { data: paymentRowWith('refunded'), error: null };
      }
      return { data: paymentRowWith('completed'), error: null };
    });

    const result = await paymentService.archive(PAYMENT_ID);
    assert.equal(result.error, null);
    assert.equal(result.data.status, 'refunded');
    assert.equal(capturedUpdate.status, 'refunded');
    assert.doesNotMatch(JSON.stringify(capturedUpdate), /cancelled/);
  });

  it('failed → no-op (returns current, issues no update)', async () => {
    mock.onFrom('payments', () => ({ data: paymentRowWith('failed'), error: null }));
    const result = await paymentService.archive(PAYMENT_ID);
    assert.equal(result.error, null);
    assert.equal(result.data.status, 'failed');
    // Only the initial getById was issued. No update modifier should appear.
    const updates = mock.calls.from.filter((c) => c.modifiers.some((m) => m.method === 'update'));
    assert.equal(updates.length, 0);
  });

  it('refunded → no-op (returns current, issues no update)', async () => {
    mock.onFrom('payments', () => ({ data: paymentRowWith('refunded'), error: null }));
    const result = await paymentService.archive(PAYMENT_ID);
    assert.equal(result.error, null);
    assert.equal(result.data.status, 'refunded');
    const updates = mock.calls.from.filter((c) => c.modifiers.some((m) => m.method === 'update'));
    assert.equal(updates.length, 0);
  });

  it('returns the supabase error when the payment row is missing', async () => {
    mock.onFrom('payments', () => ({ data: null, error: { message: 'No payment row' } }));
    const result = await paymentService.archive(PAYMENT_ID);
    assert.equal(result.data, null);
    assert.equal(result.error, 'No payment row');
  });

  it('NEVER writes the literal string "cancelled" — pinned across all archive paths', async () => {
    // Run all four start states through archive and confirm no update
    // payload mentions 'cancelled'. This is the documented DB-constraint
    // invariant.
    for (const startStatus of ['pending', 'completed', 'failed', 'refunded']) {
      mock.reset();
      let updatePayload = null;
      let callIndex = 0;
      mock.onFrom('payments', ({ callEntry }) => {
        callIndex += 1;
        const updateMod = callEntry.modifiers.find((m) => m.method === 'update');
        if (updateMod) updatePayload = updateMod.args[0];
        // Always return the start status so update prefetch sees a stable row.
        return { data: paymentRowWith(startStatus), error: null };
      });
      await paymentService.archive(PAYMENT_ID);
      if (updatePayload) {
        assert.doesNotMatch(JSON.stringify(updatePayload), /cancelled/);
      }
    }
  });
});
