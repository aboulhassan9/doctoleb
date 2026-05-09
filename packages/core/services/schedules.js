import { supabase } from '@/lib/supabase';
import { DOCTOR_SCHEDULE_TEMPLATE_SELECT_FIELDS, SECRETARY_SLOT_SELECT_FIELDS } from '@/lib/selects';
import { doctorScheduleTemplateSchema, parseWithSchema } from '@/schemas';
import { apiCall, apiPaged } from './api';

function toDateKey(date) {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    return date.slice(0, 10);
  }

  const value = date ? new Date(date) : new Date();
  if (Number.isNaN(value.getTime())) return null;
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function timeToMinutes(time) {
  const [hours = '0', minutes = '0'] = String(time || '').split(':');
  return Number(hours) * 60 + Number(minutes);
}

function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
}

function isTemplateEffectiveForDate(template, dateKey) {
  if (template.effective_from && dateKey < template.effective_from) return false;
  if (template.effective_to && dateKey > template.effective_to) return false;
  return true;
}

function getSlotKey(slot) {
  return [
    slot.schedule_template_id,
    slot.date,
    String(slot.start_time || '').slice(0, 5),
    String(slot.end_time || '').slice(0, 5),
  ].join('|');
}

function validationError(error) {
  return { data: null, error };
}

function parse(schema, payload) {
  const result = parseWithSchema(schema, payload);
  if (result.error) return { error: result.error };
  return { data: result.data };
}

export const scheduleService = {
  async getTemplates({ activeOnly = true, page = 1, pageSize = 100 } = {}) {
    let query = supabase
      .from('doctor_schedule_templates')
      .select(DOCTOR_SCHEDULE_TEMPLATE_SELECT_FIELDS, { count: 'exact' })
      .order('weekday', { ascending: true })
      .order('start_time', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    return apiPaged(query, { page, pageSize });
  },

  async getTemplatesByDoctor(doctorId, { activeOnly = true, page = 1, pageSize = 100 } = {}) {
    let query = supabase
      .from('doctor_schedule_templates')
      .select(DOCTOR_SCHEDULE_TEMPLATE_SELECT_FIELDS, { count: 'exact' })
      .eq('doctor_id', doctorId)
      .order('weekday', { ascending: true })
      .order('start_time', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    return apiPaged(query, { page, pageSize });
  },

  async createTemplate(payload) {
    const parsed = parse(doctorScheduleTemplateSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('doctor_schedule_templates')
        .insert([parsed.data])
        .select(DOCTOR_SCHEDULE_TEMPLATE_SELECT_FIELDS)
        .single()
    );
  },

  async updateTemplate(id, payload) {
    const parsed = parse(doctorScheduleTemplateSchema.partial(), payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('doctor_schedule_templates')
        .update(parsed.data)
        .eq('id', id)
        .select(DOCTOR_SCHEDULE_TEMPLATE_SELECT_FIELDS)
        .single()
    );
  },

  async deactivateTemplate(id) {
    return this.updateTemplate(id, { is_active: false });
  },

  async deleteTemplate(id) {
    const todayKey = toDateKey();
    const { data: futureSlots, error: slotError } = await apiCall(
      supabase
        .from('secretary_slots')
        .select('id, date')
        .eq('schedule_template_id', id)
        .gte('date', todayKey)
    );

    if (slotError) return { data: null, error: slotError };

    const slotIds = (futureSlots || []).map(slot => slot.id);
    if (slotIds.length) {
      const { data: appointments, error: appointmentError } = await apiCall(
        supabase
          .from('appointments')
          .select('id')
          .in('slot_id', slotIds)
          .limit(1)
      );

      if (appointmentError) return { data: null, error: appointmentError };
      if (appointments?.length) {
        return {
          data: null,
          error: 'Cannot delete a schedule template that has booked future slots. Deactivate it instead.',
        };
      }

      const { error: deactivateSlotError } = await apiCall(
        supabase
          .from('secretary_slots')
          .update({ is_active: false })
          .in('id', slotIds)
      );

      if (deactivateSlotError) return { data: null, error: deactivateSlotError };
    }

    return this.deactivateTemplate(id);
  },

  async getSlotsForTemplate(templateId, { page = 1, pageSize = 100 } = {}) {
    const query = supabase
      .from('secretary_slots')
      .select(SECRETARY_SLOT_SELECT_FIELDS, { count: 'exact' })
      .eq('schedule_template_id', templateId)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });

    return apiPaged(query, { page, pageSize });
  },

  async materializeUpToDate(targetDate, { doctorId = null, createdBy } = {}) {
    const startKey = toDateKey();
    const endKey = toDateKey(targetDate);

    if (!endKey) {
      return { data: null, error: 'Target date is invalid.' };
    }
    if (endKey < startKey) {
      return { data: [], error: null };
    }
    if (!createdBy) {
      return { data: null, error: 'Missing staff user for schedule materialization.' };
    }

    const { data: templates, error: templateError } = doctorId
      ? await this.getTemplatesByDoctor(doctorId)
      : await this.getTemplates();

    if (templateError) return { data: null, error: templateError };
    if (!templates?.length) return { data: [], error: null };

    let existingQuery = supabase
      .from('secretary_slots')
      .select('id, schedule_template_id, date, start_time, end_time')
      .not('schedule_template_id', 'is', null)
      .gte('date', startKey)
      .lte('date', endKey);

    if (doctorId) existingQuery = existingQuery.eq('doctor_id', doctorId);

    const { data: existingSlots, error: existingError } = await apiCall(existingQuery);
    if (existingError) return { data: null, error: existingError };

    const existingKeys = new Set((existingSlots || []).map(getSlotKey));
    const rows = [];
    const startDate = new Date(`${startKey}T00:00:00`);
    const endDate = new Date(`${endKey}T00:00:00`);

    for (let cursor = startDate; cursor <= endDate; cursor = addDays(cursor, 1)) {
      const dateKey = toDateKey(cursor);
      const weekday = cursor.getDay();

      for (const template of templates) {
        if (Number(template.weekday) !== weekday) continue;
        if (!isTemplateEffectiveForDate(template, dateKey)) continue;

        const slotDuration = Number(template.slot_duration_minutes || 30);
        const dayStart = timeToMinutes(template.start_time);
        const dayEnd = timeToMinutes(template.end_time);

        if (!slotDuration || slotDuration <= 0 || dayEnd <= dayStart) continue;

        for (let start = dayStart; start + slotDuration <= dayEnd; start += slotDuration) {
          const startTime = minutesToTime(start);
          const endTime = minutesToTime(start + slotDuration);
          const slot = {
            doctor_id: template.doctor_id,
            clinic_id: template.clinic_id,
            schedule_template_id: template.id,
            date: dateKey,
            start_time: startTime,
            end_time: endTime,
            is_active: true,
            created_by: createdBy,
          };

          const key = getSlotKey(slot);
          if (existingKeys.has(key)) continue;
          existingKeys.add(key);
          rows.push(slot);
        }
      }
    }

    if (!rows.length) return { data: [], error: null };

    return apiCall(
      supabase
        .from('secretary_slots')
        .insert(rows)
        .select(SECRETARY_SLOT_SELECT_FIELDS)
    );
  },
};
