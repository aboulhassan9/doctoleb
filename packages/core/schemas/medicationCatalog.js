/**
 * Medication catalog schemas.
 *
 * Lived in `documentTemplates.js` during slice 2 — moved to its own file
 * to restore cohesion: templates and medications are distinct domains and
 * a refactor on one should not force a re-read of the other.
 *
 * The exports here are re-exported from `schemas/index.js` so existing
 * consumers using the barrel import keep working.
 */

import { z } from 'zod';
import { nullableTrimmedString } from './helpers.js';

export const medicationCatalogCreateSchema = z.object({
  name: z.string().trim().min(1).max(240),
  generic_name: nullableTrimmedString(240).optional(),
  dosage_forms: z.array(z.string().trim().min(1).max(240)).optional().default([]),
  common_dosages: z.array(z.string().trim().min(1).max(240)).optional().default([]),
  notes: nullableTrimmedString(4000).optional(),
});

export const medicationCatalogUpdateSchema = z.object({
  name: z.string().trim().min(1).max(240).optional(),
  generic_name: nullableTrimmedString(240).optional(),
  dosage_forms: z.array(z.string().trim().min(1).max(240)).optional(),
  common_dosages: z.array(z.string().trim().min(1).max(240)).optional(),
  notes: nullableTrimmedString(4000).optional(),
});
