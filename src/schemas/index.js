import { z } from 'zod';

const PHONE_REGEX = /^\+?[\d\s-]{8,20}$/;

const blankToNull = (value) => {
  if (value === '' || value === undefined || value === null) {
    return null;
  }

  return value;
};

const nullableTrimmedString = (maxLength = 2000) => z.preprocess(
  blankToNull,
  z.string().trim().max(maxLength).nullable()
);

const nullablePhone = z.preprocess(
  blankToNull,
  z.string().trim().regex(PHONE_REGEX, 'Please enter a valid phone number.').nullable()
);

const nullableNumber = ({ integer = false, min = null, max = null } = {}) => z.preprocess(
  (value) => {
    if (value === '' || value === null || value === undefined) {
      return null;
    }

    const normalizedValue = Number(value);
    return Number.isNaN(normalizedValue) ? value : normalizedValue;
  },
  (() => {
    let schema = integer ? z.number().int() : z.number();
    if (typeof min === 'number') schema = schema.min(min);
    if (typeof max === 'number') schema = schema.max(max);
    return schema.nullable();
  })()
);

export const authSignInSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const authSignUpSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  confirmPassword: z.string().min(8, 'Password confirmation is required.'),
}).refine(
  ({ password, confirmPassword }) => password === confirmPassword,
  {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  }
);

export const appointmentBookingSchema = z.object({
  slotId: z.string().uuid(),
  patientId: z.string().uuid(),
  bookedBy: z.string().uuid(),
  reason: z.string().trim().min(1).max(1000),
  durationMinutes: z.number().int().min(5).max(240).default(30),
  status: z.enum([
    'scheduled',
    'confirmed',
    'pre_check',
    'in_consultation',
    'completed',
    'cancelled',
    'no_show',
  ]).default('scheduled'),
});

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

export function parseWithSchema(schema, payload) {
  const result = schema.safeParse(payload);

  if (!result.success) {
    return {
      data: null,
      error: result.error.issues[0]?.message || 'Invalid request payload.',
    };
  }

  return {
    data: result.data,
    error: null,
  };
}
