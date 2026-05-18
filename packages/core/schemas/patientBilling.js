import { z } from 'zod';

const paymentStatusSchema = z.enum(['pending', 'completed', 'failed', 'refunded']);

export const patientPaymentIdSchema = z.object({
  paymentId: z.string().uuid(),
});

export const patientCheckoutStartSchema = z.object({
  payment_id: z.string().uuid(),
});

export const patientBillingPaymentSchema = z.object({
  id: z.string().uuid(),
  amount: z.coerce.number().nonnegative(),
  currency: z.string().trim().min(1).max(10).default('USD'),
  status: paymentStatusSchema,
  paymentMethod: z.string().nullable().optional(),
  transactionId: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
  canPay: z.boolean().default(false),
  appointment: z.unknown().nullable().optional(),
  doctor: z.unknown().nullable().optional(),
  checkoutSession: z.unknown().nullable().optional(),
});

export const patientBillingOverviewSchema = z.object({
  patientId: z.string().uuid().nullable().optional(),
  currency: z.string().trim().min(1).max(10).default('USD'),
  summary: z.object({
    pendingTotal: z.coerce.number().nonnegative().default(0),
    paidTotal: z.coerce.number().nonnegative().default(0),
    refundedTotal: z.coerce.number().nonnegative().default(0),
    hasBalanceDue: z.boolean().default(false),
  }).default({
    pendingTotal: 0,
    paidTotal: 0,
    refundedTotal: 0,
    hasBalanceDue: false,
  }),
  payments: z.array(patientBillingPaymentSchema).default([]),
});

export const patientCheckoutSessionResponseSchema = z.object({
  checkoutUrl: z.string().url(),
  sessionId: z.string().trim().min(1),
  paymentId: z.string().uuid(),
  expiresAt: z.string().nullable().optional(),
});
