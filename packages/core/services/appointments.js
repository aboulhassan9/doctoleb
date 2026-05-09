import { supabase } from '@/lib/supabase';
import { apiCall, apiPaged } from './api';
import { APPOINTMENT_SELECT_FIELDS } from '@/lib/selects';
import { normalizeAppointment } from '@/lib/appointments';
import { assertTransition } from '@/lib/stateMachines';
import { appointmentBookingSchema, appointmentCancelSchema, parseWithSchema } from '@/schemas';
import { bookSlot } from './slots';
import { notificationCoreService } from './notificationCore';

export const appointmentService = {
  async getAll(options = {}) {
    const query = supabase
      .from('appointments')
      .select(APPOINTMENT_SELECT_FIELDS, { count: 'exact' })
      .order('scheduled_at', { ascending: true });

    return apiPaged(query, options);
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

  async getByDoctorId(doctorId, options = {}) {
    const query = supabase
      .from('appointments')
      .select(APPOINTMENT_SELECT_FIELDS, { count: 'exact' })
      .eq('doctor_id', doctorId)
      .order('scheduled_at', { ascending: true });

    return apiPaged(query, options);
  },

  async getByPatientId(patientId, options = {}) {
    const query = supabase
      .from('appointments')
      .select(APPOINTMENT_SELECT_FIELDS, { count: 'exact' })
      .eq('patient_id', patientId)
      .order('scheduled_at', { ascending: true });

    return apiPaged(query, options);
  },

  async getByStatus(status, options = {}) {
    const query = supabase
      .from('appointments')
      .select(APPOINTMENT_SELECT_FIELDS, { count: 'exact' })
      .eq('status', status)
      .order('scheduled_at', { ascending: true });

    return apiPaged(query, options);
  },

  async getUpcoming(options = {}) {
    const query = supabase
      .from('appointments')
      .select(APPOINTMENT_SELECT_FIELDS, { count: 'exact' })
      .in('status', ['scheduled', 'confirmed', 'pre_check', 'in_consultation'])
      .gt('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true });

    return apiPaged(query, options);
  },

  async create(data) {
    if (data?.slot_id && data?.patient_id && data?.booked_by) {
      return this.bookFromSlot({
        slotId: data.slot_id,
        patientId: data.patient_id,
        bookedBy: data.booked_by,
        visitTypeId: data.visit_type_id || null,
        reason: data.reason || data.notes || 'Appointment',
        durationMinutes: data.duration_minutes || 30,
        status: data.status || 'scheduled',
      });
    }

    return {
      data: null,
      error: 'Appointments must be created from an available slot.',
    };
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
      visitTypeId: data.visitTypeId || null,
    });

    if (bookingError) {
      const message = bookingError.message || 'Failed to book appointment';
      if (message.includes('INTAKE_REQUIRED')) {
        return {
          data: null,
          error: 'This patient must complete medical intake before booking another appointment.',
        };
      }

      return { data: null, error: message };
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
      notificationCoreService.notifyRole('doctor', {
        title: 'Appointment Booked',
        message: `${patientName} booked an appointment for ${scheduledAt}.`,
        type: 'appointment',
        related_id: normalizedAppointment.id,
      }),
      notificationCoreService.notifyRole('predoctor', {
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

  async checkAvailability(doctorId, date) {
    // date should be an ISO string or a Date object representing the day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return apiCall(
      supabase
        .from('appointments')
        .select('id, scheduled_at, duration_minutes, status')
        .eq('doctor_id', doctorId)
        .in('status', ['scheduled', 'confirmed', 'pre_check', 'in_consultation'])
        .gte('scheduled_at', startOfDay.toISOString())
        .lte('scheduled_at', endOfDay.toISOString())
    );
  },

  async update(id, data) {
    if (data?.status) {
      const { data: current, error } = await this.getById(id);
      if (error || !current) return { data: null, error: error || 'Appointment not found' };

      try {
        assertTransition('appointment', current.status, data.status);
      } catch (transitionError) {
        return { data: null, error: transitionError.message };
      }
    }

    return apiCall(
      supabase
        .from('appointments')
        .update(data)
        .eq('id', id)
        .select(APPOINTMENT_SELECT_FIELDS)
    );
  },

  async cancel(id, reason = null) {
    const { data: payload, error: validationError } = parseWithSchema(appointmentCancelSchema, {
      appointmentId: id,
      reason,
    });
    if (validationError) {
      return { data: null, error: validationError };
    }

    const { error: cancellationError } = await apiCall(
      supabase.rpc('cancel_appointment', {
        appointment_id: payload.appointmentId,
        cancellation_reason: payload.reason,
      })
    );
    if (cancellationError) {
      return { data: null, error: cancellationError };
    }

    const { data: cancelledAppointment, error: fetchError } = await this.getById(payload.appointmentId);
    if (fetchError || !cancelledAppointment) {
      return {
        data: { id: payload.appointmentId, status: 'cancelled' },
        error: null,
      };
    }

    return {
      data: normalizeAppointment(cancelledAppointment),
      error: null,
    };
  },

  async markCompleted(id) {
    const { data: current, error } = await this.getById(id);
    if (error || !current) return { data: null, error: error || 'Appointment not found' };

    try {
      assertTransition('appointment', current.status, 'completed');
    } catch (transitionError) {
      return { data: null, error: transitionError.message };
    }

    return apiCall(
      supabase
        .from('appointments')
        .update({ status: 'completed' })
        .eq('id', id)
        .select(APPOINTMENT_SELECT_FIELDS)
    );
  },

  async markPreChecked(id) {
    const { data: current, error } = await this.getById(id);
    if (error || !current) return { data: null, error: error || 'Appointment not found' };

    if (current.status === 'pre_check') {
      return { data: current, error: null };
    }

    let working = current;
    if (working.status === 'scheduled') {
      const { data: confirmed, error: confirmError } = await this.update(id, { status: 'confirmed' });
      if (confirmError) return { data: null, error: confirmError };
      working = Array.isArray(confirmed) ? confirmed[0] : confirmed;
    }

    if (!working?.status) {
      const refreshed = await this.getById(id);
      if (refreshed.error || !refreshed.data) {
        return { data: null, error: refreshed.error || 'Appointment not found after confirmation' };
      }
      working = refreshed.data;
    }

    try {
      assertTransition('appointment', working.status, 'pre_check');
    } catch (transitionError) {
      return { data: null, error: transitionError.message };
    }

    return apiCall(
      supabase
        .from('appointments')
        .update({ status: 'pre_check' })
        .eq('id', id)
        .select(APPOINTMENT_SELECT_FIELDS)
    );
  },

  async archive(id, reason = 'Appointment archived') {
    return this.cancel(id, reason);
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
