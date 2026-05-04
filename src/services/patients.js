import { supabase } from '../lib/supabase';
import { apiCall } from './api';
import { buildInitials } from '../lib/authIdentity';
import { PATIENT_SELECT_FIELDS, USER_PUBLIC_FIELDS } from '../lib/selects';
import { parseWithSchema, patientProfileUpdateSchema } from '../schemas';

function isMissingFunctionError(error, functionName) {
  return error?.code === 'PGRST202' || error?.message?.includes(functionName);
}

export const patientService = {
  async getAll() {
    return apiCall(
      supabase
        .from('patients')
        .select(PATIENT_SELECT_FIELDS)
        .order('created_at', { ascending: false })
    );
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
    return apiCall(
      supabase
        .from('patients')
        .insert([data])
        .select(PATIENT_SELECT_FIELDS)
    );
  },

  async update(id, data) {
    return apiCall(
      supabase
        .from('patients')
        .update(data)
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
    // Step 1: find matching user IDs
    const { data: matchingUsers } = await supabase
      .from('users')
      .select('id')
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`);

    if (!matchingUsers || matchingUsers.length === 0) {
      return { data: [], error: null };
    }

    const userIds = matchingUsers.map(u => u.id);

    // Step 2: fetch patients whose user_id is in that list
    return apiCall(
      supabase
        .from('patients')
        .select(PATIENT_SELECT_FIELDS)
        .in('user_id', userIds)
    );
  },

  /**
   * Create a walk-in patient profile (no auth account required).
   * Creates a user record first with a generated email if none provided,
   * then creates the linked patient profile.
   */
  async createWalkIn({ full_name, phone, email, date_of_birth }) {
    try {
      const names = (full_name || '').trim().split(' ');
      const firstName = names[0] || 'Unknown';
      const lastName = names.length > 1 ? names.slice(1).join(' ') : '';
      const dummyEmail = email || `walkin_${Date.now()}_${crypto.randomUUID()}@clinic.local`;

      // 1. Create user record
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert([{
          email: dummyEmail,
          first_name: firstName,
          last_name: lastName,
          phone: phone || null,
          role: 'patient',
          initials: buildInitials(firstName, lastName),
          is_active: true
        }])
        .select(USER_PUBLIC_FIELDS)
        .single();

      if (userError) throw userError;

      // 2. Create patient record
      const { data: newPatient, error: patientError } = await supabase
        .from('patients')
        .insert([{
          user_id: newUser.id,
          date_of_birth: date_of_birth || null,
        }])
        .select(PATIENT_SELECT_FIELDS)
        .single();

      if (patientError) throw patientError;

      // Return combined object expected by the UI
      return { data: { ...newPatient, users: newUser, full_name }, error: null };
    } catch (error) {
      console.error('Walk-in creation error:', error);
      return { data: null, error: { message: error.message || 'Database error occurred' } };
    }
  },

  async getPatientsByDoctor(doctorId) {
    return apiCall(
      supabase
        .from('patients')
        .select(PATIENT_SELECT_FIELDS)
        .in('id',
          supabase
            .from('appointments')
            .select('patient_id')
            .select('patient_id')
            .eq('doctor_id', doctorId)
        )
    );
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
};
