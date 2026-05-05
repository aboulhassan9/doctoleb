import { supabase } from '../lib/supabase';
import { apiCall } from './api';
import {
  CONSULTATION_SELECT_FIELDS,
  CONSULTATION_WITH_RELATIONS,
  DOCTOR_SELECT_FIELDS,
  PATIENT_SELECT_FIELDS,
} from '../lib/selects';
import { paginateQuery } from '../lib/pagination';
import { assertTransition } from '../lib/stateMachines';
import {
  consultationCompleteSchema,
  consultationCreateSchema,
  parseWithSchema,
} from '../schemas';
import { appointmentService } from './appointments';

export const consultationService = {
  async getAll(options = {}) {
    return apiCall(
      paginateQuery(
        supabase
          .from('consultations')
          .select(CONSULTATION_WITH_RELATIONS, { count: 'exact' })
          .order('created_at', { ascending: false }),
        options
      )
    );
  },

  async getById(id) {
    return apiCall(
      supabase
        .from('consultations')
        .select(CONSULTATION_WITH_RELATIONS)
        .eq('id', id)
        .single()
    );
  },

  async getByDoctorId(doctorId, options = {}) {
    return apiCall(
      paginateQuery(
        supabase
          .from('consultations')
          .select(`${CONSULTATION_SELECT_FIELDS}, doctors(id, user_id), patients(${PATIENT_SELECT_FIELDS})`, { count: 'exact' })
          .eq('doctor_id', doctorId)
          .order('created_at', { ascending: false }),
        options
      )
    );
  },

  async getByPatientId(patientId, options = {}) {
    return apiCall(
      paginateQuery(
        supabase
          .from('consultations')
          .select(`${CONSULTATION_SELECT_FIELDS}, doctors(${DOCTOR_SELECT_FIELDS}), patients(id, user_id)`, { count: 'exact' })
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false }),
        options
      )
    );
  },

  async getByAppointmentId(appointmentId) {
    return apiCall(
      supabase
        .from('consultations')
        .select(CONSULTATION_SELECT_FIELDS)
        .eq('appointment_id', appointmentId)
        .single()
    );
  },

  async getByStatus(status) {
    return apiCall(
      supabase
        .from('consultations')
        .select(CONSULTATION_WITH_RELATIONS)
        .eq('status', status)
        .order('created_at', { ascending: false })
    );
  },

  async create(rawData) {
    const { data, error: validationError } = parseWithSchema(consultationCreateSchema, rawData);
    if (validationError) return { data: null, count: null, error: validationError };

    const { data: appointment, error: appointmentError } = await appointmentService.getById(data.appointment_id);
    if (appointmentError || !appointment) {
      return { data: null, count: null, error: appointmentError || 'Appointment not found' };
    }

    if (appointment.status !== 'in_consultation') {
      return { data: null, count: null, error: 'Appointment must be in consultation before saving consultation notes.' };
    }

    const consultationData = {
      ...data,
      doctor_id: data.doctor_id || appointment?.doctor_id,
      patient_id: data.patient_id || appointment?.patient_id,
    };

    return apiCall(
      supabase
        .from('consultations')
        .insert([{ ...consultationData, status: 'in_progress', session_start: new Date().toISOString() }])
        .select(CONSULTATION_SELECT_FIELDS)
    );
  },

  async update(id, data) {
    if (data?.status) {
      const { data: current, error } = await this.getById(id);
      if (error || !current) return { data: null, count: null, error: error || 'Consultation not found' };

      try {
        assertTransition('consultation', current.status, data.status);
      } catch (transitionError) {
        return { data: null, count: null, error: transitionError.message };
      }
    }

    return apiCall(
      supabase
        .from('consultations')
        .update(data)
        .eq('id', id)
        .select(CONSULTATION_SELECT_FIELDS)
    );
  },

  async complete(id, rawData) {
    const { data, error: validationError } = parseWithSchema(consultationCompleteSchema, rawData);
    if (validationError) return { data: null, count: null, error: validationError };

    const { data: current, error } = await this.getById(id);
    if (error || !current) return { data: null, count: null, error: error || 'Consultation not found' };

    try {
      assertTransition('consultation', current.status, 'completed');
    } catch (transitionError) {
      return { data: null, count: null, error: transitionError.message };
    }

    return apiCall(
      supabase
        .from('consultations')
        .update({ ...data, status: 'completed', session_end: new Date().toISOString() })
        .eq('id', id)
        .select(CONSULTATION_SELECT_FIELDS)
    );
  },

  async addMedications(consultationId, medications) {
    const { data: existing, error } = await this.getById(consultationId);
    if (error || !existing) return { data: null, count: null, error: error || 'Consultation not found' };

    const currentMedications = Array.isArray(existing.medications) ? existing.medications : [];
    const nextMedications = Array.isArray(medications) ? medications : [medications];

    return apiCall(
      supabase
        .from('consultations')
        .update({ medications: [...currentMedications, ...nextMedications] })
        .eq('id', consultationId)
        .select(CONSULTATION_SELECT_FIELDS)
    );
  },

  subscribeToConsultation(consultationId, callback) {
    return supabase
      .channel(`consultation:${consultationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'consultations', filter: `id=eq.${consultationId}` },
        payload => callback(payload)
      )
      .subscribe();
  },
};
