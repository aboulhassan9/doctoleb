import { supabase } from '../lib/supabase';
import { apiCall } from './api';

export const slotService = {
  /** Create a single manual slot */
  async createManualSlot(data) {
    return apiCall(
      supabase.from('secretary_slots').insert([data]).select().single()
    );
  },

  /**
   * Create recurring slots.
   * @param {Object} params
   * @param {string} params.doctor_id
   * @param {string} params.clinic_id
   * @param {string} params.start_time  e.g. "09:00"
   * @param {string} params.end_time    e.g. "10:00"
   * @param {number[]} params.weekdays  0=Sun,1=Mon,...,6=Sat
   * @param {number} params.occurrences total number of slots to generate
   * @param {string} params.created_by  secretary user id
   */
  async createRecurringSlots({ doctor_id, clinic_id, start_time, end_time, weekdays, occurrences, created_by }) {
    const recurrence_group_id = crypto.randomUUID();
    const slots = [];
    let count = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    while (count < occurrences) {
      if (weekdays.includes(cursor.getDay())) {
        slots.push({
          doctor_id,
          clinic_id,
          date: cursor.toISOString().split('T')[0],
          start_time,
          end_time,
          is_active: true,
          created_by,
          recurrence_group_id,
        });
        count++;
      }
      cursor.setDate(cursor.getDate() + 1);
      if (cursor.getFullYear() > new Date().getFullYear() + 2) break; // safety limit
    }

    return apiCall(
      supabase.from('secretary_slots').insert(slots).select()
    );
  },

  /** Get all slots (secretary view) */
  async getAll() {
    return apiCall(
      supabase
        .from('secretary_slots')
        .select('*, clinics(id, name, address), doctors(id, user_id, users(first_name, last_name))')
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
    );
  },

  /** Get slots for a specific doctor + date (used by patients and doctor view) */
  async getAvailableSlots(doctorId, date) {
    const { data, error } = await supabase.rpc('get_available_slots', {
      p_doctor: doctorId,
      p_date: date,
    });
    return { data, error };
  },

  /** Get all slots for a doctor (doctor schedule view) */
  async getByDoctor(doctorId) {
    return apiCall(
      supabase
        .from('secretary_slots')
        .select('*, clinics(id, name, address)')
        .eq('doctor_id', doctorId)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
    );
  },

  /** Get slots by date (predoctor schedule view) */
  async getByDate(date) {
    return apiCall(
      supabase
        .from('secretary_slots')
        .select(`
          *,
          clinics(id, name, address),
          doctors(id, user_id, users(first_name, last_name)),
          appointments(id, status, patient_id, patients(id, user_id, users(first_name, last_name)))
        `)
        .eq('date', date)
        .order('start_time', { ascending: true })
    );
  },

  /** Edit a single slot */
  async editSlot(slotId, data) {
    return apiCall(
      supabase.from('secretary_slots').update(data).eq('id', slotId).select().single()
    );
  },

  /** Delete a single slot */
  async deleteSlot(slotId) {
    return apiCall(
      supabase.from('secretary_slots').delete().eq('id', slotId)
    );
  },

  /** Delete an entire recurrence group */
  async deleteGroup(groupId) {
    return apiCall(
      supabase.from('secretary_slots').delete().eq('recurrence_group_id', groupId)
    );
  },
};

/** Book a slot via the server-side RPC (race-condition safe, fully atomic) */
export async function bookSlot({ slotId, patientId, bookedBy, status = 'pending', reason = null, durationMinutes = null }) {
  const { data, error } = await supabase.rpc('book_slot', {
    p_slot: slotId,
    p_patient: patientId,
    p_booked_by: bookedBy,
    p_status: status,
    p_reason: reason,
    p_duration_minutes: durationMinutes,
  });
  return { data, error };
}
