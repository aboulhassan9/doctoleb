import { z } from 'zod';
import { nullableTrimmedString } from './helpers.js';

export const doctorInsuranceContractSchema = z.object({
  doctor_id: z.string().uuid(),
  provider_id: z.string().uuid(),
  doctor_provider_code: nullableTrimmedString(120).optional(),
  contract_number: nullableTrimmedString(120).optional(),
  valid_from: z.string().optional().nullable(),
  valid_to: z.string().optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

export const patientInsurancePolicySchema = z.object({
  patient_id: z.string().uuid(),
  provider_id: z.string().uuid(),
  policy_number: z.string().trim().min(1).max(160),
  policyholder_name: nullableTrimmedString(240).optional(),
  valid_from: z.string().optional().nullable(),
  valid_to: z.string().optional().nullable(),
  is_primary: z.boolean().optional().default(false),
});

export const insuranceClaimSchema = z.object({
  encounter_id: z.string().uuid().optional().nullable(),
  patient_id: z.string().uuid(),
  doctor_id: z.string().uuid(),
  policy_id: z.string().uuid().optional().nullable(),
  template_id: z.string().uuid().optional().nullable(),
  amount: z.coerce.number().nonnegative(),
  amount_paid_by_insurer: z.coerce.number().nonnegative().optional().default(0),
  amount_paid_by_patient: z.coerce.number().nonnegative().optional().default(0),
  diagnosis_code: nullableTrimmedString(80).optional(),
  claim_form_pdf_url: nullableTrimmedString(2000).optional(),
  status: z.enum(['draft', 'printed', 'submitted', 'paid', 'rejected']).optional().default('draft'),
  printed_at: z.string().datetime().optional().nullable(),
  submitted_at: z.string().datetime().optional().nullable(),
  paid_at: z.string().datetime().optional().nullable(),
  created_by: z.string().uuid().optional().nullable(),
});
