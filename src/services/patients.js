import { supabase } from '../lib/supabase';
import { apiCall } from './api';

export const patientService = {
  async getAll() {
    return apiCall(
      supabase
        .from('patients')
        .select('id, user_id, date_of_birth, sex, blood_type, allergies, medical_history, insurance_id, users(id, email, first_name, last_name, phone, initials)')
        .order('created_at', { ascending: false })
    );
  },

  async getById(id) {
    return apiCall(
      supabase
        .from('patients')
        .select('*, users(*)')
        .eq('id', id)
        .single()
    );
  },

  async getByUserId(userId) {
    return apiCall(
      supabase
        .from('patients')
        .select('*')
        .eq('user_id', userId)
        .single()
    );
  },

  async create(data) {
    return apiCall(
      supabase
        .from('patients')
        .insert([data])
        .select('*, users(*)')
    );
  },

  async update(id, data) {
    return apiCall(
      supabase
        .from('patients')
        .update(data)
        .eq('id', id)
        .select('*, users(*)')
    );
  },

  async updateUserInfo(userId, { firstName, lastName, phone }) {
    const initials = ((firstName?.[0] || '') + (lastName?.[0] || '')).toUpperCase();
    return apiCall(
      supabase
        .from('users')
        .update({ first_name: firstName, last_name: lastName, phone: phone || null, initials })
        .eq('id', userId)
    );
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
        .select('id, user_id, date_of_birth, sex, blood_type, allergies, medical_history, insurance_id, users(id, email, first_name, last_name, phone, initials)')
        .in('user_id', userIds)
    );
  },

  /**
   * Create a walk-in patient profile (no auth account required).
   * Creates a user record first with a generated email if none provided,
   * then creates the linked patient profile.
   */
  async createWalkIn({ full_name, phone, email, date_of_birth, created_by }) {
    try {
      const names = (full_name || '').trim().split(' ');
      const firstName = names[0] || 'Unknown';
      const lastName = names.length > 1 ? names.slice(1).join(' ') : '';
      const dummyEmail = email || `walkin_${Date.now()}@clinic.local`;

      // 1. Create user record
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert([{
          email: dummyEmail,
          password_hash: `walkin_${crypto.randomUUID()}`,
          first_name: firstName,
          last_name: lastName,
          phone: phone || null,
          role: 'patient',
          initials: (firstName.charAt(0) + (lastName.charAt(0) || '')).toUpperCase(),
          is_active: true
        }])
        .select('id, email, first_name, last_name, phone, initials')
        .single();

      if (userError) throw userError;

      // 2. Create patient record
      const { data: newPatient, error: patientError } = await supabase
        .from('patients')
        .insert([{
          user_id: newUser.id,
          date_of_birth: date_of_birth || null,
        }])
        .select('id, user_id, date_of_birth, sex, blood_type, allergies, medical_history, insurance_id')
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
        .select('id, user_id, date_of_birth, sex, blood_type, medical_history, users(id, first_name, last_name, phone, initials, email)')
        .in('id',
          supabase
            .from('appointments')
            .select('patient_id')
            .eq('doctor_id', doctorId)
        )
    );
  },

  async delete(id) {
    return apiCall(
      supabase
        .from('patients')
        .delete()
        .eq('id', id)
    );
  },
};
