import { supabase } from '../lib/supabase.js';
import { apiCall, apiPaged } from './api.js';
import { BILLABLE_SERVICE_FIELDS, PAYMENT_SELECT_FIELDS, USER_CONTACT_FIELDS } from '../lib/selects.js';
import { EntitlementError } from '../lib/entitlements.js';
import { requirePaymentMethodAccess } from '../lib/billingEntitlements.js';
import { assertTransition } from '../lib/stateMachines.js';
import { parseWithSchema, paymentCreateSchema, paymentUpdateSchema } from '../schemas/index.js';

export const paymentService = {
  async getAll(options = {}) {
    const query = supabase
      .from('payments')
      .select(`${PAYMENT_SELECT_FIELDS}, patients(id, user_id, users!patients_user_id_fkey(${USER_CONTACT_FIELDS}))`, { count: 'exact' })
      .order('created_at', { ascending: false });

    return apiPaged(query, options);
  },

  async getById(id) {
    return apiCall(
      supabase
        .from('payments')
        .select(PAYMENT_SELECT_FIELDS)
        .eq('id', id)
        .single()
    );
  },

  async getBillableServices() {
    return apiCall(
      supabase
        .from('billable_services')
        .select(BILLABLE_SERVICE_FIELDS)
        .eq('is_active', true)
        .order('name')
    );
  },

  async create(rawData, options = {}) {
    const { data, error: validationError } = parseWithSchema(paymentCreateSchema, rawData);
    if (validationError) return { data: null, error: validationError };

    try {
      requirePaymentMethodAccess(options.entitlements, data.payment_method);
    } catch (error) {
      if (error instanceof EntitlementError) return { data: null, error };
      throw error;
    }

    return apiCall(
      supabase
        .from('payments')
        .insert([data])
        .select(PAYMENT_SELECT_FIELDS)
        .single()
    );
  },

  async update(id, rawUpdates) {
    const { data: updates, error: validationError } = parseWithSchema(paymentUpdateSchema, rawUpdates);
    if (validationError) return { data: null, error: validationError };

    if (updates?.status) {
      const { data: current, error } = await this.getById(id);
      if (error || !current) return { data: null, error: error || 'Payment not found' };

      try {
        assertTransition('payment', current.status, updates.status);
      } catch (transitionError) {
        return { data: null, error: transitionError.message };
      }
    }

    return apiCall(
      supabase
        .from('payments')
        .update(updates)
        .eq('id', id)
        .select(PAYMENT_SELECT_FIELDS)
        .single()
    );
  },

  // Financial rows are retained; live DB has no archive columns and no "cancelled" status.
  async archive(id) {
    const { data: current, error } = await this.getById(id);
    if (error || !current) return { data: null, error: error || 'Payment not found' };

    if (current.status === 'failed' || current.status === 'refunded') {
      return { data: current, error: null };
    }

    const archivedStatus = current.status === 'completed' ? 'refunded' : 'failed';
    return this.update(id, { status: archivedStatus });
  },
};
