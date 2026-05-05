import { supabase } from '../lib/supabase';
import { apiCall } from './api';
import { SECRETARY_SLOT_SELECT_FIELDS } from '../lib/selects';
import { paginateQuery } from '../lib/pagination';

export const slotService = {
  /** Create a single manual slot */
  async createManualSlot(data) {
    return apiCall(
      supabase.from('secretary_slots').insert([data]).select(SECRETARY_SLOT_SELECT_FIELDS).single()
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
      supabase.from('secretary_slots').insert(slots).select(SECRETARY_SLOT_SELECT_FIELDS)
    );
  },

  /** Get all slots (secretary view) */
  async getAll(options = {}) {
    return apiCall(
      paginateQuery(
        supabase
          .from('secretary_slots')
          .select(`${SECRETARY_SLOT_SELECT_FIELDS}, clinics(id, name, address), doctors(id, user_id, users!doctors_user_id_fkey(first_name, last_name))`, { count: 'exact' })
          .order('date', { ascending: true })
          .order('start_time', { ascending: true }),
        options
      )
    );
  },

  /** Get slots for a specific doctor + date (used by patients and doctor view) */
  async getAvailableSlots(doctorId, date) {
    return apiCall(
      supabase.rpc('get_available_slots', {
        p_doctor: doctorId,
        p_date: date,
      })
    );
  },

  /** Get all slots for a doctor (doctor schedule view) */
  async getByDoctor(doctorId, options = {}) {
    return apiCall(
      paginateQuery(
        supabase
          .from('secretary_slots')
          .select(`${SECRETARY_SLOT_SELECT_FIELDS}, clinics(id, name, address)`, { count: 'exact' })
          .eq('doctor_id', doctorId)
          .order('date', { ascending: true })
          .order('start_time', { ascending: true }),
        options
      )
    );
  },

  /** Get slots by date (predoctor schedule view) */
  async getByDate(date, options = {}) {
    return apiCall(
      paginateQuery(
        supabase
          .from('secretary_slots')
          .select(`
            ${SECRETARY_SLOT_SELECT_FIELDS},
            clinics(id, name, address),
            doctors(id, user_id, users!doctors_user_id_fkey(first_name, last_name)),
            appointments(id, status, patient_id, patients(id, user_id, users!patients_user_id_fkey(first_name, last_name)))
          `, { count: 'exact' })
          .eq('date', date)
          .order('start_time', { ascending: true }),
        options
      )
    );
  },

  /** Edit a single slot */
  async editSlot(slotId, data) {
    return apiCall(
      supabase.from('secretary_slots').update(data).eq('id', slotId).select(SECRETARY_SLOT_SELECT_FIELDS).single()
    );
  },

  /** Delete a single slot */
  async deleteSlot(slotId) {
    const { data: appointments, error } = await apiCall(
      supabase
        .from('appointments')
        .select('id')
        .eq('slot_id', slotId)
        .limit(1)
    );

    if (error) return { data: null, count: null, error };
    if (appointments?.length) {
      return { data: null, count: null, error: 'Cannot delete a slot that already has an appointment.' };
    }

    return apiCall(
      supabase.from('secretary_slots').delete().eq('id', slotId)
    );
  },

  /** Delete an entire recurrence group */
  async deleteGroup(groupId) {
    const { data: slots, error: slotError } = await apiCall(
      supabase
        .from('secretary_slots')
        .select('id')
        .eq('recurrence_group_id', groupId)
    );

    if (slotError) return { data: null, count: null, error: slotError };

    const slotIds = (slots || []).map(slot => slot.id);
    if (slotIds.length) {
      const { data: appointments, error: appointmentError } = await apiCall(
        supabase
          .from('appointments')
          .select('id')
          .in('slot_id', slotIds)
          .limit(1)
      );

      if (appointmentError) return { data: null, count: null, error: appointmentError };
      if (appointments?.length) {
        return { data: null, count: null, error: 'Cannot delete a recurrence group that contains booked slots.' };
      }
    }

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
