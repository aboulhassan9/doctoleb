import { z } from 'zod';

export const EMAIL_OTP_CODE_LENGTH = 8;

export const authSignInSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const authOtpRequestSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
});

export const authOtpVerifySchema = authOtpRequestSchema.extend({
  token: z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${EMAIL_OTP_CODE_LENGTH}}$`), `Enter the ${EMAIL_OTP_CODE_LENGTH}-digit login code.`),
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
