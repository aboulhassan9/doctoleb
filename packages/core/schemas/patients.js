import { z } from 'zod';
import { blankToNull, nullablePhone, nullableTrimmedString } from './helpers.js';

export const patientProfileUpdateSchema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  phone: nullablePhone,
  date_of_birth: z.preprocess(blankToNull, z.string().trim().nullable()),
  sex: nullableTrimmedString(40),
  blood_type: nullableTrimmedString(10),
  allergies: nullableTrimmedString(4000),
  insurance_id: nullableTrimmedString(120),
  emergency_contact: nullableTrimmedString(120),
  emergency_phone: nullablePhone,
  medical_history: nullableTrimmedString(8000),
});

export const patientCreateSchema = z.object({
  user_id: z.string().uuid(),
  date_of_birth: z.preprocess(blankToNull, z.string().trim().nullable()).optional(),
  sex: nullableTrimmedString(40).optional(),
  blood_type: nullableTrimmedString(10).optional(),
  allergies: nullableTrimmedString(4000).optional(),
  medical_history: nullableTrimmedString(8000).optional(),
  insurance_id: nullableTrimmedString(120).optional(),
  emergency_contact: nullableTrimmedString(120).optional(),
  emergency_phone: nullablePhone.optional(),
});

export const walkInPatientSchema = z.object({
  full_name: z.string().trim().min(1).max(160),
  phone: nullablePhone.optional(),
  email: z.preprocess(blankToNull, z.string().trim().email().nullable()).optional(),
  date_of_birth: z.preprocess(blankToNull, z.string().trim().nullable()).optional(),
});

export const patientConsentSchema = z.object({
  patient_id: z.string().uuid(),
  consent_document_id: z.string().uuid(),
  accepted_by_user_id: z.string().uuid(),
  acceptance_method: z.enum(['patient_self', 'staff_assisted', 'kiosk']).optional().default('patient_self'),
  accepted_at: z.string().datetime().optional(),
  revoked_at: z.string().datetime().optional().nullable(),
});

export const patientDeviceSchema = z.object({
  patient_id: z.string().uuid(),
  user_id: z.string().uuid(),
  platform: z.enum(['ios', 'android', 'web']),
  push_token: z.string().trim().min(16).max(4096),
  device_label: nullableTrimmedString(240).optional(),
  app_version: nullableTrimmedString(80).optional(),
  locale: nullableTrimmedString(20).optional(),
  timezone: nullableTrimmedString(80).optional(),
  is_active: z.boolean().optional().default(true),
  last_seen_at: z.string().datetime().optional().nullable(),
});
