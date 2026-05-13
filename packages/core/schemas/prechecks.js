import { z } from 'zod';
import { nullableNumber, nullableTrimmedString } from './helpers.js';

export const precheckDraftSchema = z.object({
  patientId: z.string().uuid(),
  predoctorId: z.string().uuid().nullable().optional(),
  bloodPressure: nullableTrimmedString(40),
  heartRate: nullableNumber({ integer: true, min: 1, max: 300 }),
  temperature: nullableNumber({ min: 20, max: 50 }),
  weight: nullableNumber({ min: 1, max: 1000 }),
  height: nullableNumber({ min: 1, max: 300 }),
  currentMedications: nullableTrimmedString(4000),
  allergies: nullableTrimmedString(4000),
  symptoms: nullableTrimmedString(4000),
  isUrgent: z.boolean().optional().default(false),
});

export const precheckSubmitSchema = precheckDraftSchema.extend({
  bloodPressure: z.string().trim().min(1, 'Blood pressure is required.').max(40),
  heartRate: z.number().int().min(1).max(300),
  temperature: z.number().min(20).max(50),
});
