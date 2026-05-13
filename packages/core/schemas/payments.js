import { z } from 'zod';
import { nullableTrimmedString } from './helpers.js';

export const paymentCreateSchema = z.object({
  patient_id: z.string().uuid(),
  doctor_id: z.string().uuid(),
  appointment_id: z.string().uuid().optional().nullable(),
  amount: z.coerce.number().positive('Amount must be greater than zero.'),
  currency: z.string().trim().min(1).max(10).optional().default('USD'),
  status: z.enum(['pending', 'completed', 'failed', 'refunded']).optional().default('pending'),
  payment_method: nullableTrimmedString(120),
  transaction_id: nullableTrimmedString(240),
});

export const paymentUpdateSchema = z.object({
  patient_id: z.string().uuid().optional(),
  doctor_id: z.string().uuid().optional(),
  appointment_id: z.string().uuid().optional().nullable(),
  amount: z.coerce.number().positive('Amount must be greater than zero.').optional(),
  currency: z.string().trim().min(1).max(10).optional(),
  status: z.enum(['pending', 'completed', 'failed', 'refunded']).optional(),
  payment_method: nullableTrimmedString(120).optional(),
  transaction_id: nullableTrimmedString(240).optional(),
});
