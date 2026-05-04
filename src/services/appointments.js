import { supabase } from '../lib/supabase';
import { apiCall } from './api';
import { APPOINTMENT_SELECT_FIELDS } from '../lib/selects';
import { normalizeAppointment } from '../lib/appointments';
import { appointmentBookingSchema, parseWithSchema } from '../schemas';
import { bookSlot } from './slots';
import { notificationService } from './notifications';

export const appointmentService = {
  async getAll() {
    return apiCall(
      supabase
        .from('appointments')
        .select(APPOINTMENT_SELECT_FIELDS)
        .order('scheduled_at', { ascending: true })
    );
  },

  async getById(id) {
    return apiCall(
      supabase
        .from('appointments')
        .select(APPOINTMENT_SELECT_FIELDS)
        .eq('id', id)
        .single()
    );
  },

  async getByDoctorId(doctorId) {
    return apiCall(
      supabase
        .from('appointments')
        .select(APPOINTMENT_SELECT_FIELDS)
        .eq('doctor_id', doctorId)
        .order('scheduled_at', { ascending: true })
    );
  },

  async getByPatientId(patientId) {
    return apiCall(
      supabase
        .from('appointments')
        .select(APPOINTMENT_SELECT_FIELDS)
        .eq('patient_id', patientId)
        .order('scheduled_at', { ascending: true })
    );
  },

  async getByStatus(status) {
    return apiCall(
      supabase
        .from('appointments')
        .select(APPOINTMENT_SELECT_FIELDS)
        .eq('status', status)
        .order('scheduled_at', { ascending: true })
    );
  },

  async getUpcoming() {
    return apiCall(
      supabase
        .from('appointments')
        .select(APPOINTMENT_SELECT_FIELDS)
        .in('status', ['scheduled', 'confirmed', 'pre_check', 'in_consultation'])
        .gt('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
    );
  },

  async create(data) {
    return apiCall(
      supabase
        .from('appointments')
        .insert([{ ...data, status: data.status || 'scheduled' }])
        .select(APPOINTMENT_SELECT_FIELDS)
    );
  },

  async getBySlotId(slotId) {
    return apiCall(
      supabase
        .from('appointments')
        .select(APPOINTMENT_SELECT_FIELDS)
        .eq('slot_id', slotId)
        .order('created_at', { ascending: false })
        .limit(1)
    );
  },

  async bookFromSlot(payload) {
    const { data, error: validationError } = parseWithSchema(appointmentBookingSchema, payload);
    if (validationError) {
      return { data: null, error: validationError };
    }

    // book_slot RPC is now fully atomic: creates the appointment with all fields
    // and returns the new appointment UUID
    const { data: appointmentId, error: bookingError } = await bookSlot({
      slotId: data.slotId,
      patientId: data.patientId,
      bookedBy: data.bookedBy,
      status: data.status,
      reason: data.reason,
      durationMinutes: data.durationMinutes,
    });

    if (bookingError) {
      return { data: null, error: bookingError.message || 'Failed to book appointment' };
    }

    // Fetch the full appointment record using the returned UUID
    const { data: bookedAppointment, error: fetchError } = await this.getById(appointmentId);

    if (fetchError || !bookedAppointment) {
      // Booking succeeded (slot consumed, appointment created) but fetch failed.
      // Return partial success — never tell the user "booking failed" when it didn't.
      return {
        data: { id: appointmentId },
        error: null,
      };
    }

    const normalizedAppointment = normalizeAppointment(bookedAppointment);
    const patientName = normalizedAppointment.patientName || 'A patient';
    const scheduledAt = normalizedAppointment.scheduled_at || 'the selected time';

    // Fire-and-forget notifications — never block the booking response
    Promise.allSettled([
      notificationService.notifyRole('doctor', {
        title: 'Appointment Booked',
        message: `${patientName} booked an appointment for ${scheduledAt}.`,
        type: 'appointment',
        related_id: normalizedAppointment.id,
      }),
      notificationService.notifyRole('predoctor', {
        title: 'Patient Added to Queue',
        message: `${patientName} booked an appointment for ${scheduledAt}.`,
        type: 'appointment',
        related_id: normalizedAppointment.id,
      }),
    ]).catch(() => {}); // swallow — notifications are non-critical

    return {
      data: normalizedAppointment,
      error: null,
    };
  },

  async delete(id) {
    return apiCall(
      supabase
        .from('appointments')
        .delete()
        .eq('id', id)
    );
  },

  async checkAvailability(doctorId, date) {
    // date should be an ISO string or a Date object representing the day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('appointments')
      .select('id, scheduled_at, duration_minutes, status')
      .eq('doctor_id', doctorId)
      .not('status', 'eq', 'cancelled')
      .gte('scheduled_at', startOfDay.toISOString())
      .lte('scheduled_at', endOfDay.toISOString());

    if (error) {
      console.error('Error checking availability:', error);
      return { data: null, error };
    }

    return { data, error: null };
  },

  async update(id, data) {
    return apiCall(
      supabase
        .from('appointments')
        .update(data)
        .eq('id', id)
        .select()
    );
  },

  async cancel(id, reason = null) {
    const { data: existingAppointment } = await this.getById(id);
    const nextNotes = [existingAppointment?.notes, reason].filter(Boolean).join('\n\n');

    return apiCall(
      supabase
        .from('appointments')
        .update({ status: 'cancelled', notes: nextNotes || existingAppointment?.notes || null })
        .eq('id', id)
        .select(APPOINTMENT_SELECT_FIELDS)
    );
  },

  async markCompleted(id) {
    return apiCall(
      supabase
        .from('appointments')
        .update({ status: 'completed' })
        .eq('id', id)
        .select(APPOINTMENT_SELECT_FIELDS)
    );
  },

  subscribeToAppointments(doctorId, callback) {
    if (doctorId) {
      return supabase
        .channel(`appointments:doctor_id=eq.${doctorId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `doctor_id=eq.${doctorId}` }, payload => callback(payload))
        .subscribe();
    } else {
      return supabase
        .channel('appointments_all')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, payload => callback(payload))
        .subscribe();
    }
  },
};
