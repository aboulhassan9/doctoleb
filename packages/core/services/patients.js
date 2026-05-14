import { supabase } from '../lib/supabase.js';
import { apiCall, apiPaged } from './api.js';
import { buildInitials } from '../lib/authIdentity.js';
import { logWarn } from '../lib/logger.js';
import { PATIENT_SELECT_FIELDS, USER_PUBLIC_FIELDS } from '../lib/selects.js';
import { parseWithSchema, patientCreateSchema, patientProfileUpdateSchema, walkInPatientCreateResponseSchema, walkInPatientSchema } from '../schemas/index.js';

function isMissingFunctionError(error, functionName) {
  return error?.code === 'PGRST202' || error?.message?.includes(functionName);
}

function sanitizeSearchTerm(query) {
  return String(query || '').replace(/[%,.()]/g, '').trim();
}

export const patientService = {
  async getAll(options = {}) {
    const query = supabase
      .from('patients')
      .select(PATIENT_SELECT_FIELDS, { count: 'exact' })
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    return apiPaged(query, options);
  },

  async getById(id) {
    return apiCall(
      supabase
        .from('patients')
        .select(PATIENT_SELECT_FIELDS)
        .eq('id', id)
        .single()
    );
  },

  async getByUserId(userId) {
    return apiCall(
      supabase
        .from('patients')
        .select(PATIENT_SELECT_FIELDS)
        .eq('user_id', userId)
        .single()
    );
  },

  async create(data) {
    const { data: patient, error: validationError } = parseWithSchema(patientCreateSchema, data);
    if (validationError) return { data: null, error: validationError };

    return apiCall(
      supabase
        .from('patients')
        .insert([patient])
        .select(PATIENT_SELECT_FIELDS)
    );
  },

  async update(id, data) {
    const { data: updates, error: validationError } = parseWithSchema(patientCreateSchema.partial(), data);
    if (validationError) return { data: null, error: validationError };

    return apiCall(
      supabase
        .from('patients')
        .update(updates)
        .eq('id', id)
        .select(PATIENT_SELECT_FIELDS)
    );
  },

  async updateUserInfo(userId, { firstName, lastName, phone }) {
    const initials = buildInitials(firstName, lastName);
    return apiCall(
      supabase
        .from('users')
        .update({ first_name: firstName, last_name: lastName, phone: phone || null, initials })
        .eq('id', userId)
    );
  },

  async updateOwnProfile({ userId, patientId, profile }) {
    const { data, error: validationError } = parseWithSchema(patientProfileUpdateSchema, profile);
    if (validationError) {
      return { data: null, error: validationError };
    }

    const rpcPayload = {
      p_user_id: userId,
      p_patient_id: patientId,
      p_first_name: data.first_name,
      p_last_name: data.last_name,
      p_phone: data.phone,
      p_date_of_birth: data.date_of_birth,
      p_sex: data.sex,
      p_blood_type: data.blood_type,
      p_allergies: data.allergies,
      p_insurance_id: data.insurance_id,
      p_emergency_contact: data.emergency_contact,
      p_emergency_phone: data.emergency_phone,
      p_medical_history: data.medical_history,
    };

    const { data: rpcData, error: rpcError } = await supabase.rpc('update_patient_profile', rpcPayload);
    if (!rpcError) {
      return { data: rpcData, error: null };
    }

    if (!isMissingFunctionError(rpcError, 'update_patient_profile')) {
      return { data: null, error: rpcError.message || 'Failed to update profile' };
    }

    try {
      const initials = buildInitials(data.first_name, data.last_name);
      const [
        { error: userError },
        { error: patientError },
      ] = await Promise.all([
        supabase
          .from('users')
          .update({
            first_name: data.first_name,
            last_name: data.last_name,
            phone: data.phone,
            initials,
          })
          .eq('id', userId),
        supabase
          .from('patients')
          .update({
            date_of_birth: data.date_of_birth,
            sex: data.sex,
            blood_type: data.blood_type,
            allergies: data.allergies,
            insurance_id: data.insurance_id,
            emergency_contact: data.emergency_contact,
            emergency_phone: data.emergency_phone,
            medical_history: data.medical_history,
          })
          .eq('id', patientId),
      ]);

      if (userError || patientError) {
        return { data: null, error: userError?.message || patientError?.message || 'Failed to update profile' };
      }

      const profileResult = await supabase
        .from('patients')
        .select(PATIENT_SELECT_FIELDS)
        .eq('id', patientId)
        .single();

      return {
        data: profileResult.data,
        error: profileResult.error?.message || null,
      };
    } catch (error) {
      return { data: null, error: error.message || 'Failed to update profile' };
    }
  },

  async search(query) {
    const sanitizedQuery = sanitizeSearchTerm(query);
    if (!sanitizedQuery) {
      return { data: [], meta: { pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } }, error: null };
    }

    // Step 1: find matching user IDs
    const { data: matchingUsers, error: userError } = await apiCall(
      supabase
        .from('users')
        .select('id')
        .or(`first_name.ilike.%${sanitizedQuery}%,last_name.ilike.%${sanitizedQuery}%,email.ilike.%${sanitizedQuery}%,phone.ilike.%${sanitizedQuery}%`)
    );

    if (userError) {
      return { data: null, meta: null, error: userError };
    }

    if (!matchingUsers || matchingUsers.length === 0) {
      return { data: [], meta: { pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } }, error: null };
    }

    const userIds = matchingUsers.map(u => u.id);

    // Step 2: fetch patients whose user_id is in that list
    const patientsQuery = supabase
      .from('patients')
      .select(PATIENT_SELECT_FIELDS, { count: 'exact' })
      .in('user_id', userIds);

    return apiPaged(patientsQuery, { page: 1, pageSize: 100 });
  },

  /**
   * Create a walk-in patient profile (no auth account required).
   * Creates a user record first with a generated email if none provided,
   * then creates the linked patient profile.
   */
  async createWalkIn({ full_name, phone, email, date_of_birth }) {
    const { data: walkIn, error: validationError } = parseWithSchema(walkInPatientSchema, { full_name, phone, email, date_of_birth });
    if (validationError) return { data: null, error: { message: validationError } };

    let newUserId = null;

    try {
      const names = walkIn.full_name.trim().split(' ');
      const firstName = names[0] || 'Unknown';
      const lastName = names.length > 1 ? names.slice(1).join(' ') : '';
      const dummyEmail = walkIn.email || `walkin_${Date.now()}_${crypto.randomUUID()}@clinic.local`;

      // 1. Create user record
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert([{
          email: dummyEmail,
          first_name: firstName,
          last_name: lastName,
          phone: walkIn.phone || null,
          role: 'patient',
          initials: buildInitials(firstName, lastName),
          is_active: true
        }])
        .select(USER_PUBLIC_FIELDS)
        .single();

      if (userError) throw userError;
      newUserId = newUser.id;

      // 2. Create patient record
      const { data: newPatient, error: patientError } = await supabase
        .from('patients')
        .insert([{
          user_id: newUser.id,
          date_of_birth: walkIn.date_of_birth || null,
        }])
        .select(PATIENT_SELECT_FIELDS)
        .single();

      if (patientError) throw patientError;

      // Return combined object expected by the UI.
      // F3: validate the response shape so a missing id / users surfaces as a
      // clean error here instead of crashing the calling form later.
      const responseData = { ...newPatient, users: newUser, full_name: walkIn.full_name };
      const responseValidation = parseWithSchema(walkInPatientCreateResponseSchema, responseData);
      if (responseValidation.error) {
        logWarn('walkin_response_shape_invalid', responseValidation.error);
        return { data: null, error: { message: 'Walk-in patient creation returned an unexpected response shape.' } };
      }
      return { data: responseData, error: null };
    } catch (error) {
      if (newUserId) {
        const { error: compensationError } = await supabase
          .from('users')
          .update({ is_active: false })
          .eq('id', newUserId);

        if (compensationError) {
          logWarn('walkin_compensation_failed', 'Failed to disable orphan walk-in user after patient creation failure');
        }
      }

      return { data: null, error: { message: error.message || 'Database error occurred' } };
    }
  },

  async getPatientsByDoctor(doctorId, options = {}) {
    const { data: appointmentRows, error } = await apiCall(
      supabase
        .from('appointments')
        .select('patient_id')
        .eq('doctor_id', doctorId)
    );

    if (error) return { data: null, error };

    const patientIds = [...new Set((appointmentRows || []).map(row => row.patient_id).filter(Boolean))];
    if (!patientIds.length) {
      return { data: [], meta: { pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } }, error: null };
    }

    const query = supabase
      .from('patients')
      .select(PATIENT_SELECT_FIELDS, { count: 'exact' })
      .eq('is_archived', false)
      .in('id', patientIds);

    return apiPaged(query, options);
  },

  // RULE 1: Medical data is sacred — use soft-delete
  async archive(id, archivedBy) {
    return apiCall(
      supabase
        .from('patients')
        .update({ is_archived: true, archived_at: new Date().toISOString(), archived_by: archivedBy })
        .eq('id', id)
        .select(PATIENT_SELECT_FIELDS)
    );
  },

  async delete(id, archivedBy) {
    return this.archive(id, archivedBy);
  },
};
