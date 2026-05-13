import { z } from 'zod';

export const doctorScheduleTemplateSchema = z.object({
  doctor_id: z.string().uuid(),
  clinic_id: z.string().uuid(),
  weekday: z.coerce.number().int().min(0).max(6),
  start_time: z.string().trim().min(4).max(12),
  end_time: z.string().trim().min(4).max(12),
  slot_duration_minutes: z.coerce.number().int().min(5).max(480).optional().default(30),
  is_active: z.boolean().optional().default(true),
  effective_from: z.string().optional().nullable(),
  effective_to: z.string().optional().nullable(),
}).refine(
  ({ start_time: startTime, end_time: endTime }) => endTime > startTime,
  { message: 'Schedule end time must be after start time.' }
);

export const manualSlotSchema = z.object({
  doctor_id: z.string().uuid(),
  clinic_id: z.string().uuid(),
  schedule_template_id: z.string().uuid().optional().nullable(),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}/),
  start_time: z.string().trim().min(4).max(12),
  end_time: z.string().trim().min(4).max(12),
  is_active: z.boolean().optional().default(true),
  created_by: z.string().uuid(),
  recurrence_group_id: z.string().uuid().optional().nullable(),
}).refine(
  ({ start_time: startTime, end_time: endTime }) => endTime > startTime,
  { message: 'Slot end time must be after start time.' }
);

export const recurringSlotsSchema = z.object({
  doctor_id: z.string().uuid(),
  clinic_id: z.string().uuid(),
  start_time: z.string().trim().min(4).max(12),
  end_time: z.string().trim().min(4).max(12),
  weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1).max(7),
  occurrences: z.coerce.number().int().min(1).max(730),
  created_by: z.string().uuid(),
}).refine(
  ({ start_time: startTime, end_time: endTime }) => endTime > startTime,
  { message: 'Recurring slot end time must be after start time.' }
);
