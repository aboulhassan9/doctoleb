/**
 * renderSelectsDrift.test.mjs
 *
 * Contract test: the renderer's narrow PostgREST select strings (used by
 * the Edge Function, which cannot import packages/core at deploy time) must
 * be a subset of the canonical constants in `packages/core/lib/selects.js`.
 *
 * Without this test, a future schema change that updates the canonical
 * select but forgets the renderer mirror would silently 500 the renderer.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  _RENDER_SELECTS_FOR_TEST,
} from '../../../supabase/functions/render-clinical-document/selects.js';

import {
  USER_CONTACT_FIELDS,
  PATIENT_SELECT_FIELDS,
  DOCTOR_SELECT_FIELDS,
  ENCOUNTER_SELECT_FIELDS,
  CLINIC_SELECT_FIELDS,
  CLINICAL_DOCUMENT_SELECT_FIELDS,
  DOCUMENT_TEMPLATE_SELECT_FIELDS,
  TENANT_PROFILE_SELECT_FIELDS,
  TENANT_APP_CONFIG_SELECT_FIELDS,
} from '../../../packages/core/lib/selects.js';

/**
 * Parse a PostgREST select string into:
 *   { columns: Set<string>, joins: Map<joinTag, Set<columns>> }
 *
 * Top-level columns are split on commas that are NOT inside parentheses.
 * A token like `users!patients_user_id_fkey(id, first_name, ...)` becomes
 * one join entry keyed by `users!patients_user_id_fkey`.
 */
function parseSelect(input) {
  const columns = new Set();
  const joins = new Map();

  let buf = '';
  let depth = 0;
  const tokens = [];
  for (const ch of input) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      tokens.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) tokens.push(buf.trim());

  for (const token of tokens) {
    const parenStart = token.indexOf('(');
    if (parenStart === -1) {
      columns.add(token);
      continue;
    }
    const tag = token.slice(0, parenStart).trim();
    const inner = token.slice(parenStart + 1, token.lastIndexOf(')')).trim();
    const innerColumns = new Set(
      inner.split(',').map((c) => c.trim()).filter(Boolean),
    );
    joins.set(tag, innerColumns);
  }

  return { columns, joins };
}

function topLevelColumns(input) {
  return parseSelect(input).columns;
}

function joinColumns(input, tag) {
  const j = parseSelect(input).joins.get(tag);
  return j || new Set();
}

function assertSubset(actual, allowed, message) {
  for (const col of actual) {
    assert.ok(
      allowed.has(col),
      `${message}: "${col}" not present in allowed=[${[...allowed].join(',')}]`,
    );
  }
}

describe('render-clinical-document selects.js — canonical drift', () => {
  it('CLINICAL_DOCUMENT_RENDER_FIELDS ⊆ CLINICAL_DOCUMENT_SELECT_FIELDS', () => {
    const actual = topLevelColumns(
      _RENDER_SELECTS_FOR_TEST.CLINICAL_DOCUMENT_RENDER_FIELDS,
    );
    const allowed = topLevelColumns(CLINICAL_DOCUMENT_SELECT_FIELDS);
    assertSubset(actual, allowed, 'clinical_documents column');
  });

  it('DOCUMENT_TEMPLATE_RENDER_FIELDS ⊆ DOCUMENT_TEMPLATE_SELECT_FIELDS', () => {
    const actual = topLevelColumns(
      _RENDER_SELECTS_FOR_TEST.DOCUMENT_TEMPLATE_RENDER_FIELDS,
    );
    const allowed = topLevelColumns(DOCUMENT_TEMPLATE_SELECT_FIELDS);
    assertSubset(actual, allowed, 'document_templates column');
  });

  it('PATIENT_RENDER_FIELDS top-level ⊆ PATIENT_SELECT_FIELDS top-level', () => {
    const actual = topLevelColumns(_RENDER_SELECTS_FOR_TEST.PATIENT_RENDER_FIELDS);
    const allowed = topLevelColumns(PATIENT_SELECT_FIELDS);
    // Strip the join token from the "actual" side — joins are checked below.
    for (const a of [...actual]) {
      if (a.includes('users!')) actual.delete(a);
    }
    assertSubset(actual, allowed, 'patients column');
  });

  it('PATIENT_RENDER_FIELDS users join ⊆ USER_CONTACT_FIELDS', () => {
    const actual = joinColumns(
      _RENDER_SELECTS_FOR_TEST.PATIENT_RENDER_FIELDS,
      'users!patients_user_id_fkey',
    );
    const allowed = new Set(USER_CONTACT_FIELDS.split(',').map((s) => s.trim()));
    assertSubset(actual, allowed, 'patients.users column');
  });

  it('DOCTOR_RENDER_FIELDS top-level ⊆ DOCTOR_SELECT_FIELDS top-level', () => {
    const actual = topLevelColumns(_RENDER_SELECTS_FOR_TEST.DOCTOR_RENDER_FIELDS);
    const allowed = topLevelColumns(DOCTOR_SELECT_FIELDS);
    for (const a of [...actual]) {
      if (a.includes('users!')) actual.delete(a);
    }
    assertSubset(actual, allowed, 'doctors column');
  });

  it('DOCTOR_RENDER_FIELDS users join ⊆ USER_CONTACT_FIELDS', () => {
    const actual = joinColumns(
      _RENDER_SELECTS_FOR_TEST.DOCTOR_RENDER_FIELDS,
      'users!doctors_user_id_fkey',
    );
    const allowed = new Set(USER_CONTACT_FIELDS.split(',').map((s) => s.trim()));
    assertSubset(actual, allowed, 'doctors.users column');
  });

  it('ENCOUNTER_RENDER_FIELDS ⊆ ENCOUNTER_SELECT_FIELDS top-level', () => {
    const actual = topLevelColumns(_RENDER_SELECTS_FOR_TEST.ENCOUNTER_RENDER_FIELDS);
    const allowed = topLevelColumns(ENCOUNTER_SELECT_FIELDS);
    assertSubset(actual, allowed, 'encounters column');
  });

  it('CLINIC_RENDER_FIELDS ⊆ CLINIC_SELECT_FIELDS', () => {
    const actual = topLevelColumns(_RENDER_SELECTS_FOR_TEST.CLINIC_RENDER_FIELDS);
    const allowed = topLevelColumns(CLINIC_SELECT_FIELDS);
    assertSubset(actual, allowed, 'clinics column');
  });

  it('TENANT_PROFILE_RENDER_FIELDS ⊆ TENANT_PROFILE_SELECT_FIELDS', () => {
    const actual = topLevelColumns(
      _RENDER_SELECTS_FOR_TEST.TENANT_PROFILE_RENDER_FIELDS,
    );
    const allowed = topLevelColumns(TENANT_PROFILE_SELECT_FIELDS);
    assertSubset(actual, allowed, 'tenant_profile column');
  });

  it('TENANT_APP_CONFIG_RENDER_FIELDS ⊆ TENANT_APP_CONFIG_SELECT_FIELDS', () => {
    const actual = topLevelColumns(
      _RENDER_SELECTS_FOR_TEST.TENANT_APP_CONFIG_RENDER_FIELDS,
    );
    const allowed = topLevelColumns(TENANT_APP_CONFIG_SELECT_FIELDS);
    assertSubset(actual, allowed, 'tenant_app_config column');
  });
});
