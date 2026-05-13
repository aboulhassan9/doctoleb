import { z } from 'zod';
import { nullableNumber, nullableTrimmedString, optionalClientRequestId } from './helpers.js';
import {
  SUPPORTED_CONVERSATION_PARTICIPANT_ROLES,
} from '../lib/roles.js';

export const conversationCreateSchema = z.object({
  patient_id: z.string().uuid().optional().nullable(),
  subject: nullableTrimmedString(240).optional(),
  conversation_type: z.enum(['patient_staff', 'internal', 'support']).optional().default('patient_staff'),
  created_by: z.string().uuid().optional().nullable(),
});

export const messageCreateSchema = z.object({
  conversation_id: z.string().uuid(),
  sender_user_id: z.string().uuid().optional().nullable(),
  sender_patient_id: z.string().uuid().optional().nullable(),
  body: z.string().trim().min(1).max(8000),
  message_type: z.enum(['text', 'system']).optional().default('text'),
  is_internal: z.boolean().optional().default(false),
  client_request_id: optionalClientRequestId,
}).refine(
  ({ sender_user_id: senderUserId, sender_patient_id: senderPatientId }) => Boolean(senderUserId || senderPatientId),
  { message: 'Message must include a sender.' }
);

export const conversationParticipantSchema = z.object({
  conversation_id: z.string().uuid(),
  user_id: z.string().uuid().optional().nullable(),
  staff_member_id: z.string().uuid().optional().nullable(),
  patient_id: z.string().uuid().optional().nullable(),
  role: z.enum(SUPPORTED_CONVERSATION_PARTICIPANT_ROLES),
  is_active: z.boolean().optional().default(true),
  last_read_at: z.string().datetime().optional().nullable(),
}).refine(
  ({ user_id: userId, staff_member_id: staffMemberId, patient_id: patientId }) => Boolean(userId || staffMemberId || patientId),
  { message: 'Conversation participant must include a user, staff member, or patient.' }
);

export const messageAttachmentSchema = z.object({
  message_id: z.string().uuid(),
  uploaded_by: z.string().uuid().optional().nullable(),
  file_url: z.string().trim().min(1).max(2000),
  file_name: z.string().trim().min(1).max(240),
  mime_type: nullableTrimmedString(120).optional(),
  file_size_bytes: nullableNumber({ integer: true, min: 0 }).optional(),
  storage_bucket: nullableTrimmedString(120).optional(),
  storage_path: nullableTrimmedString(2000).optional(),
});
