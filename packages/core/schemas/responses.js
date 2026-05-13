import { z } from 'zod';

/**
 * Response-shape schemas for critical service boundaries.
 *
 * F3: validate what the backend returned before handing it to UI code so an
 * unexpected backend response (renamed column, missing field, wrong type)
 * fails fast with a clear error instead of crashing the UI later.
 *
 * Keep these schemas LOOSE on shape: only assert the fields the UI actually
 * relies on. Don't mirror the full DB row — that would force every column
 * addition to update a schema for no real safety win.
 */

const uuid = z.string().uuid();

export const appointmentBookFromSlotResponseSchema = z.object({
  id: uuid,
  status: z.string().optional(),
  scheduled_at: z.string().optional(),
}).passthrough();

export const walkInPatientCreateResponseSchema = z.object({
  id: uuid,
  users: z.object({
    id: uuid,
  }).passthrough(),
  full_name: z.string().optional(),
}).passthrough();

export const sessionUserResponseSchema = z.object({
  id: uuid,
  email: z.string().email().optional().nullable(),
  role: z.enum(['doctor', 'secretary', 'patient', 'predoctor', 'admin']),
}).passthrough();
