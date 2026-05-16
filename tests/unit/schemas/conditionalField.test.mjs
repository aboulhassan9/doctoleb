/**
 * conditionalField.test.mjs
 *
 * Covers the `show_if` conditional-display predicate on templateFieldSchema.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  templateFieldSchema,
  TEMPLATE_AUTOFILL_KEYS,
} from '../../../packages/core/schemas/documentTemplates.js';

const BASE = Object.freeze({
  key: 'gestational_age',
  label: 'Gestational age',
  type: 'text',
  required: false,
});

describe('show_if — conditional field display', () => {
  it('accepts a valid show_if predicate', () => {
    const r = templateFieldSchema.safeParse({
      ...BASE,
      show_if: { binding: 'patient.sex', equals: 'Female' },
    });
    assert.equal(r.success, true);
  });

  it('rejects show_if with an unknown binding', () => {
    const r = templateFieldSchema.safeParse({
      ...BASE,
      show_if: { binding: 'patient.unknown', equals: 'x' },
    });
    assert.equal(r.success, false);
  });

  it('rejects show_if with an empty equals value', () => {
    const r = templateFieldSchema.safeParse({
      ...BASE,
      show_if: { binding: 'patient.sex', equals: '   ' },
    });
    assert.equal(r.success, false);
  });

  it('rejects show_if with extra unrecognized properties (strict)', () => {
    const r = templateFieldSchema.safeParse({
      ...BASE,
      show_if: { binding: 'patient.sex', equals: 'Female', regex: '.*' },
    });
    assert.equal(r.success, false);
  });

  it('treats missing show_if as "always show" (no rejection)', () => {
    assert.equal(templateFieldSchema.safeParse(BASE).success, true);
    assert.equal(
      templateFieldSchema.safeParse({ ...BASE, show_if: null }).success,
      true,
    );
  });

  it('every TEMPLATE_AUTOFILL_KEYS entry is acceptable as a binding', () => {
    for (const k of TEMPLATE_AUTOFILL_KEYS) {
      const r = templateFieldSchema.safeParse({
        ...BASE,
        show_if: { binding: k, equals: 'x' },
      });
      assert.equal(r.success, true, `binding ${k} should be valid`);
    }
  });
});
