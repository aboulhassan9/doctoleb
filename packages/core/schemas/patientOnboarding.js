import { z } from 'zod';
import { nullableTrimmedString } from './helpers.js';
import { PATIENT_ONBOARDING_CUSTOM_FIELD_KEY_PATTERN } from '../lib/patientOnboarding.js';

const fieldConfigVersionSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === '') return 1;
    const numericValue = Number(value);
    return Number.isNaN(numericValue) ? value : numericValue;
  },
  z.number().int().min(1).max(1000)
);

const customAnswersSchema = z.preprocess(
  (value) => (value === undefined || value === null ? {} : value),
  z.record(
    z.string().regex(PATIENT_ONBOARDING_CUSTOM_FIELD_KEY_PATTERN, 'Custom field keys must use the custom.* allowlist namespace.'),
    nullableTrimmedString(4000)
  )
);

export const patientSelfIntakeSchema = z.object({
  patient_id: z.string().uuid(),
  allergies_text: nullableTrimmedString(4000).optional(),
  current_medications_text: nullableTrimmedString(4000).optional(),
  notes: nullableTrimmedString(8000).optional(),
  field_config_version: fieldConfigVersionSchema.optional().default(1),
  custom_answers: customAnswersSchema.optional().default({}),
});
