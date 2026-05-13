import { z } from 'zod';

export const authSignInSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const authOtpRequestSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
});

export const authOtpVerifySchema = authOtpRequestSchema.extend({
  token: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit login code.'),
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
