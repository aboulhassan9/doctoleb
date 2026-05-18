import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseMock } from './__helpers__/supabaseMock.mjs';
import { __setSupabaseClientForTest } from '../../../packages/core/lib/supabase.js';
import { patientBillingService } from '../../../packages/core/services/patientBilling.js';

const PAYMENT_ID = '11111111-1111-4111-8111-111111111111';
const PATIENT_ID = '22222222-2222-4222-8222-222222222222';

let mock;
let previousClient;

beforeEach(() => {
  mock = createSupabaseMock();
  previousClient = __setSupabaseClientForTest(mock.client);
});

afterEach(() => {
  __setSupabaseClientForTest(previousClient);
});

describe('patientBillingService.getOverview', () => {
  it('loads and normalizes the patient billing overview RPC', async () => {
    mock.onRpc('get_patient_billing_overview', () => ({
      data: {
        patientId: PATIENT_ID,
        currency: 'USD',
        summary: {
          pendingTotal: '50.25',
          paidTotal: 120,
          refundedTotal: 0,
          hasBalanceDue: true,
        },
        payments: [
          {
            id: PAYMENT_ID,
            amount: '50.25',
            currency: 'USD',
            status: 'pending',
            canPay: true,
          },
        ],
      },
      error: null,
    }));

    const result = await patientBillingService.getOverview();

    assert.equal(result.error, null);
    assert.equal(result.data.summary.pendingTotal, 50.25);
    assert.equal(result.data.payments[0].canPay, true);
    assert.equal(mock.calls.rpc[0].name, 'get_patient_billing_overview');
  });

  it('rejects an unexpected billing status shape', async () => {
    mock.onRpc('get_patient_billing_overview', () => ({
      data: {
        patientId: PATIENT_ID,
        summary: {},
        payments: [{ id: PAYMENT_ID, amount: 10, currency: 'USD', status: 'cancelled' }],
      },
      error: null,
    }));

    const result = await patientBillingService.getOverview();

    assert.equal(result.data, null);
    assert.match(result.error, /Invalid|Expected|received/i);
  });
});

describe('patientBillingService.startCheckout', () => {
  it('validates the payment id before calling the Edge Function', async () => {
    const result = await patientBillingService.startCheckout('not-a-uuid');

    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    assert.equal(mock.calls.functions.length, 0);
  });

  it('invokes the patient checkout Edge Function with the allowlisted body', async () => {
    mock.onFunction('patient-create-payment-session', () => ({
      data: {
        data: {
          checkoutUrl: 'https://checkout.stripe.com/c/pay/session',
          sessionId: 'cs_test_123',
          paymentId: PAYMENT_ID,
          expiresAt: '2026-05-18T12:00:00Z',
        },
        error: null,
      },
      error: null,
    }));

    const result = await patientBillingService.startCheckout(PAYMENT_ID);

    assert.equal(result.error, null);
    assert.equal(result.data.sessionId, 'cs_test_123');
    assert.equal(mock.calls.functions[0].name, 'patient-create-payment-session');
    assert.deepEqual(mock.calls.functions[0].options.body, { payment_id: PAYMENT_ID });
  });

  it('normalizes Edge Function errors', async () => {
    mock.onFunction('patient-create-payment-session', () => ({
      data: { data: null, error: 'PATIENT_PAYMENTS_NOT_CONFIGURED' },
      error: null,
    }));

    const result = await patientBillingService.startCheckout(PAYMENT_ID);

    assert.equal(result.data, null);
    assert.equal(result.error, 'PATIENT_PAYMENTS_NOT_CONFIGURED');
  });
});

describe('patientBillingService.getReceipt', () => {
  it('loads a patient-owned receipt by RPC', async () => {
    mock.onRpc('get_patient_payment_receipt', () => ({
      data: { id: PAYMENT_ID, amount: 75, status: 'completed' },
      error: null,
    }));

    const result = await patientBillingService.getReceipt(PAYMENT_ID);

    assert.equal(result.error, null);
    assert.equal(result.data.id, PAYMENT_ID);
    assert.deepEqual(mock.calls.rpc[0].args, { p_payment_id: PAYMENT_ID });
  });
});
