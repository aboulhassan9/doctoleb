import { z } from 'zod';
import { nullableTrimmedString, optionalClientRequestId } from './helpers.js';

export const notificationEventSchema = z.object({
  user_id: z.string().uuid().optional().nullable(),
  patient_id: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1).max(240),
  body: z.string().trim().min(1).max(2000),
  event_type: z.string().trim().min(1).max(120),
  related_type: nullableTrimmedString(120).optional(),
  related_id: z.string().uuid().optional().nullable(),
  severity: z.enum(['info', 'success', 'warning', 'urgent']).optional().default('info'),
  status: z.enum(['queued', 'sent', 'failed', 'cancelled']).optional().default('queued'),
  scheduled_for: z.string().datetime().optional().nullable(),
  created_by: z.string().uuid().optional().nullable(),
  source: z.enum(['user', 'system']).optional().default('user'),
  client_request_id: optionalClientRequestId,
}).refine(
  ({ user_id: userId, patient_id: patientId }) => Boolean(userId || patientId),
  { message: 'Notification event must target a user or patient.' }
).refine(
  ({ source, created_by: createdBy }) => source === 'system' || Boolean(createdBy),
  { message: 'User-originated notification events must include created_by.' }
);

export const notificationDeliverySchema = z.object({
  event_id: z.string().uuid(),
  user_id: z.string().uuid().optional().nullable(),
  device_id: z.string().uuid().optional().nullable(),
  channel: z.enum(['in_app', 'push', 'email', 'sms']),
  status: z.enum(['queued', 'sent', 'failed', 'read', 'cancelled']).optional().default('queued'),
  provider_message_id: nullableTrimmedString(240).optional(),
  error_message: nullableTrimmedString(2000).optional(),
  sent_at: z.string().datetime().optional().nullable(),
  read_at: z.string().datetime().optional().nullable(),
  client_request_id: optionalClientRequestId,
});

export const notificationDeliveryUpdateSchema = notificationDeliverySchema.partial().omit({
  event_id: true,
});
