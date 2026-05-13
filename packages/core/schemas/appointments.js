import { z } from 'zod';
import { nullableTrimmedString } from './helpers.js';

export const appointmentBookingSchema = z.object({
  slotId: z.string().uuid(),
  patientId: z.string().uuid(),
  bookedBy: z.string().uuid(),
  visitTypeId: z.string().uuid().nullable().optional(),
  reason: z.string().trim().min(1).max(1000),
  durationMinutes: z.number().int().min(5).max(240).default(30),
  status: z.literal('scheduled').optional().default('scheduled'),
});

export const appointmentCancelSchema = z.object({
  appointmentId: z.string().uuid(),
  reason: nullableTrimmedString(1000).optional(),
});
