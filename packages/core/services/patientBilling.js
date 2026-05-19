import { supabase } from '../lib/supabase.js';
import {
  parseWithSchema,
  patientBillingOverviewSchema,
  patientBillingReceiptSchema,
  patientCheckoutSessionResponseSchema,
  patientCheckoutStartSchema,
  patientPaymentIdSchema,
} from '../schemas/index.js';

function getErrorMessage(error, fallback = 'Request failed') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  return error.message || fallback;
}

function normalizeFunctionResponse(response) {
  if (response?.error) {
    return {
      data: null,
      error: getErrorMessage(response.error, 'Payment session failed.'),
    };
  }

  const payload = response?.data;
  if (payload?.error) {
    return {
      data: null,
      error: getErrorMessage(payload.error, 'Payment session failed.'),
    };
  }

  return {
    data: payload?.data || payload,
    error: null,
  };
}

export const patientBillingService = {
  async getOverview() {
    const { data, error } = await supabase.rpc('get_patient_billing_overview');
    if (error) {
      return {
        data: null,
        error: getErrorMessage(error, 'Unable to load billing overview.'),
      };
    }

    const parsed = parseWithSchema(patientBillingOverviewSchema, data || {});
    if (parsed.error) return { data: null, error: parsed.error };

    return { data: parsed.data, error: null };
  },

  async getReceipt(paymentId) {
    const parsedId = parseWithSchema(patientPaymentIdSchema, { paymentId });
    if (parsedId.error) return { data: null, error: parsedId.error };

    const { data, error } = await supabase.rpc('get_patient_payment_receipt', {
      p_payment_id: parsedId.data.paymentId,
    });

    if (error) {
      return {
        data: null,
        error: getErrorMessage(error, 'Unable to load payment receipt.'),
      };
    }

    const parsedReceipt = parseWithSchema(patientBillingReceiptSchema, data || {});
    if (parsedReceipt.error) return { data: null, error: parsedReceipt.error };

    return { data: parsedReceipt.data, error: null };
  },

  async startCheckout(paymentId) {
    const parsed = parseWithSchema(patientCheckoutStartSchema, { payment_id: paymentId });
    if (parsed.error) return { data: null, error: parsed.error };

    if (!supabase.functions?.invoke) {
      return { data: null, error: 'Patient payments are not configured for this environment.' };
    }

    const functionResult = await supabase.functions.invoke('patient-create-payment-session', {
      body: parsed.data,
    });
    const normalized = normalizeFunctionResponse(functionResult);
    if (normalized.error) return normalized;

    const session = parseWithSchema(patientCheckoutSessionResponseSchema, normalized.data);
    if (session.error) return { data: null, error: session.error };

    return { data: session.data, error: null };
  },
};
