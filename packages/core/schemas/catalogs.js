import { z } from 'zod';
import { nullableNumber, nullablePhone, nullableTrimmedString } from './helpers.js';

export const catalogEntrySchema = z.object({
  code: z.string().trim().min(1).max(120).optional(),
  name: z.string().trim().min(1).max(240),
  description: nullableTrimmedString(2000).optional(),
  is_active: z.boolean().optional().default(true),
  is_system: z.boolean().optional(),
  country: nullableTrimmedString(120).optional(),
  category: nullableTrimmedString(120).optional(),
  icd10_code: nullableTrimmedString(40).optional(),
  body_system: nullableTrimmedString(120).optional(),
  typical_doses: nullableNumber({ integer: true, min: 0, max: 20 }).optional(),
  default_duration_minutes: nullableNumber({ integer: true, min: 5, max: 480 }).optional(),
  default_fee: nullableNumber({ min: 0 }).optional(),
  requires_intake: z.boolean().optional(),
  billable_service_id: z.string().uuid().optional().nullable(),
});

export const clinicSchema = z.object({
  name: z.string().trim().min(1).max(240),
  address: nullableTrimmedString(1000).optional(),
  location_type: z.enum(['hospital', 'medical_group', 'private_clinic', 'other']).optional().default('private_clinic'),
  city_id: z.string().uuid().optional().nullable(),
  phone: nullablePhone.optional(),
  working_hours: z.record(z.string(), z.unknown()).optional().nullable(),
  is_primary: z.boolean().optional().default(false),
  notes: nullableTrimmedString(2000).optional(),
  latitude: nullableNumber().optional(),
  longitude: nullableNumber().optional(),
  map_url: nullableTrimmedString(2000).optional(),
  floor: nullableTrimmedString(80).optional(),
  room: nullableTrimmedString(80).optional(),
});

export const archiveMutationSchema = z.object({
  archivedBy: z.string().uuid(),
});
