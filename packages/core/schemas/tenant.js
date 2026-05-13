import { z } from 'zod';
import { blankToNull, nullablePhone, nullableTrimmedString } from './helpers.js';

export const tenantProfileUpdateSchema = z.object({
  tenant_slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  display_name: z.string().trim().min(1).max(160).optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  default_locale: z.string().trim().min(2).max(20).optional(),
  status: z.enum(['active', 'maintenance', 'disabled']).optional(),
  schema_version: z.string().trim().min(1).max(80).optional(),
});

export const tenantAppConfigUpdateSchema = z.object({
  app_name: z.string().trim().min(1).max(160).optional(),
  app_tagline: nullableTrimmedString(240).optional(),
  splash_logo_url: nullableTrimmedString(2000).optional(),
  icon_url: nullableTrimmedString(2000).optional(),
  primary_color: nullableTrimmedString(20).optional(),
  secondary_color: nullableTrimmedString(20).optional(),
  maintenance_message: nullableTrimmedString(1000).optional(),
  min_supported_version: nullableTrimmedString(80).optional(),
  force_update_version: nullableTrimmedString(80).optional(),
  enabled_locales: z.array(z.string().trim().min(2).max(20)).optional(),
  support_phone: nullablePhone.optional(),
  support_email: z.preprocess(blankToNull, z.string().trim().email().nullable()).optional(),
});
