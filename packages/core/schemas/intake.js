import { z } from 'zod';
import { nullableNumber, nullableTrimmedString } from './helpers.js';

export const medicalIntakeDraftSchema = z.object({
  patient_id: z.string().uuid(),
  status: z.enum(['draft', 'completed', 'reopened']).optional().default('draft'),
  collected_by: z.string().uuid().optional().nullable(),
  occupation_id: z.string().uuid().optional().nullable(),
  occupation_other: nullableTrimmedString(240).optional(),
  blood_group_id: nullableNumber({ integer: true, min: 1 }).optional(),
  marital_status: z.enum(['single', 'married', 'divorced', 'widowed', 'other']).optional().nullable(),
  living_with: nullableTrimmedString(240).optional(),
  smoking_status: z.enum(['never', 'former', 'current_light', 'current_heavy', 'unknown']).optional().nullable(),
  alcohol_use: z.enum(['none', 'occasional', 'moderate', 'heavy']).optional().nullable(),
  exercise_frequency: z.enum(['none', 'rare', 'weekly', 'daily']).optional().nullable(),
  allergies_text: nullableTrimmedString(4000).optional(),
  current_medications_text: nullableTrimmedString(4000).optional(),
  notes: nullableTrimmedString(8000).optional(),
});

export const medicalIntakeCompletionSchema = z.object({
  patientId: z.string().uuid(),
  completedBy: z.string().uuid(),
});

export const medicalIntakeReopenSchema = z.object({
  patientId: z.string().uuid(),
  reopenedBy: z.string().uuid(),
  reason: nullableTrimmedString(1000).optional(),
});

export const patientVaccinationSchema = z.object({
  patient_id: z.string().uuid(),
  vaccine_id: z.string().uuid(),
  status: z.enum(['received', 'scheduled', 'overdue', 'declined', 'unknown']).optional().default('unknown'),
  given_at: z.string().optional().nullable(),
  due_at: z.string().optional().nullable(),
  dose_number: nullableNumber({ integer: true, min: 1, max: 20 }).optional(),
  lot_number: nullableTrimmedString(120).optional(),
  administered_by: nullableTrimmedString(240).optional(),
  notes: nullableTrimmedString(4000).optional(),
  recorded_by: z.string().uuid().optional().nullable(),
});

export const patientSurgerySchema = z.object({
  patient_id: z.string().uuid(),
  surgery_type_id: z.string().uuid(),
  performed_at: z.string().optional().nullable(),
  hospital_name: nullableTrimmedString(240).optional(),
  surgeon_name: nullableTrimmedString(240).optional(),
  notes: nullableTrimmedString(4000).optional(),
  recorded_by: z.string().uuid().optional().nullable(),
});

export const patientDiseaseSchema = z.object({
  patient_id: z.string().uuid(),
  disease_id: z.string().uuid(),
  status: z.enum(['active', 'resolved', 'chronic', 'in_remission', 'suspected']).optional().default('active'),
  severity: z.enum(['mild', 'moderate', 'severe']).optional().nullable(),
  diagnosed_at: z.string().optional().nullable(),
  notes: nullableTrimmedString(4000).optional(),
  recorded_by: z.string().uuid().optional().nullable(),
});

export const patientFamilyHistorySchema = z.object({
  patient_id: z.string().uuid(),
  relation_id: nullableNumber({ integer: true, min: 1 }).optional(),
  disease_id: z.string().uuid().optional().nullable(),
  condition_text: nullableTrimmedString(240).optional(),
  age_at_onset: nullableNumber({ integer: true, min: 0, max: 130 }).optional(),
  is_deceased: z.boolean().optional().default(false),
  death_cause_disease_id: z.string().uuid().optional().nullable(),
  death_cause_text: nullableTrimmedString(240).optional(),
  notes: nullableTrimmedString(4000).optional(),
  recorded_by: z.string().uuid().optional().nullable(),
}).refine(
  ({ disease_id: diseaseId, condition_text: conditionText }) => Boolean(diseaseId || conditionText),
  { message: 'Family history must include a catalog disease or condition text.' }
);

export const patientHistorySchemas = {
  vaccinations: patientVaccinationSchema,
  surgeries: patientSurgerySchema,
  diseases: patientDiseaseSchema,
  family_history: patientFamilyHistorySchema,
};
