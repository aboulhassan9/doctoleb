import { z } from 'zod';
import { blankToNull, nullablePhone, nullableTrimmedString, optionalClientRequestId } from './helpers.js';
import { SUPPORTED_STAFF_MEMBER_ROLES } from '../lib/roles.js';

export const staffMemberSchema = z.object({
  user_id: z.string().uuid().optional().nullable(),
  doctor_id: z.string().uuid(),
  role: z.enum(SUPPORTED_STAFF_MEMBER_ROLES),
  display_name: z.string().trim().min(1).max(160),
  phone: nullablePhone.optional(),
  email: z.preprocess(blankToNull, z.string().trim().email().nullable()).optional(),
  invite_status: z.enum(['none', 'invited', 'accepted', 'disabled']).optional().default('none'),
  reports_to: z.string().uuid().optional().nullable(),
  hire_date: z.string().optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

export const staffInviteSchema = z.object({
  role: z.enum(SUPPORTED_STAFF_MEMBER_ROLES),
  display_name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  phone: nullablePhone.optional(),
  hire_date: z.string().optional().nullable(),
  client_request_id: optionalClientRequestId,
});

export const staffMemberUpdateSchema = z.object({
  display_name: z.string().trim().min(1).max(160).optional(),
  phone: nullablePhone.optional(),
  hire_date: z.string().optional().nullable(),
});

export const staffMemberDisableSchema = z.object({
  staff_member_id: z.string().uuid(),
});

export const staffInviteResendSchema = z.object({
  staff_member_id: z.string().uuid(),
  client_request_id: z.string().uuid(),
});

export const staffInviteReissueSchema = z.object({
  staff_member_id: z.string().uuid(),
  client_request_id: z.string().uuid(),
});

export const staffMemberReactivateSchema = z.object({
  staff_member_id: z.string().uuid(),
});
