/**
 * compositeTextField.test.mjs
 *
 * Schema tests for the `composite_text` template field — the doctor-built
 * custom-field primitive. Asserts the closed-binding invariant (a doctor
 * cannot reference an autofill key that doesn't exist) and the per-type
 * exclusivity rules (only composite_text may carry a template string).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  templateFieldSchema,
  TEMPLATE_AUTOFILL_KEYS,
  extractCompositeBindings,
} from '../../../packages/core/schemas/documentTemplates.js';

const BASE_FIELD = Object.freeze({
  key: 'composed',
  label: 'Composed',
  required: false,
});

describe('composite_text field — schema invariants', () => {
  it('accepts a valid composite template referencing known bindings', () => {
    const result = templateFieldSchema.safeParse({
      ...BASE_FIELD,
      type: 'composite_text',
      template: '{{patient.full_name}} — born {{patient.date_of_birth}}',
    });
    assert.equal(result.success, true);
  });

  it('rejects a composite template with an unknown binding', () => {
    const result = templateFieldSchema.safeParse({
      ...BASE_FIELD,
      type: 'composite_text',
      template: '{{patient.full_name}} / {{patient.unknown_field}}',
    });
    assert.equal(result.success, false);
    assert.ok(
      result.error.issues.some((i) => /unknown binding/i.test(i.message)),
      'expected an unknown-binding error',
    );
  });

  it('rejects an empty composite template', () => {
    const result = templateFieldSchema.safeParse({
      ...BASE_FIELD,
      type: 'composite_text',
      template: '   ',
    });
    assert.equal(result.success, false);
  });

  it('tolerates whitespace inside the placeholder braces', () => {
    const result = templateFieldSchema.safeParse({
      ...BASE_FIELD,
      type: 'composite_text',
      template: '{{ patient.full_name }}',
    });
    assert.equal(result.success, true);
  });

  it('rejects a template string on a non-composite field type', () => {
    const result = templateFieldSchema.safeParse({
      ...BASE_FIELD,
      type: 'text',
      template: '{{patient.full_name}}',
    });
    assert.equal(result.success, false);
    assert.ok(
      result.error.issues.some((i) =>
        /Only composite_text fields may carry a template string/.test(i.message),
      ),
      'expected an exclusivity error',
    );
  });

  it('still accepts non-composite fields with template omitted', () => {
    const result = templateFieldSchema.safeParse({
      ...BASE_FIELD,
      type: 'text',
    });
    assert.equal(result.success, true);
  });

  it('keeps the legacy patient.gender alias usable inside composites', () => {
    assert.ok(TEMPLATE_AUTOFILL_KEYS.includes('patient.gender'));
    const result = templateFieldSchema.safeParse({
      ...BASE_FIELD,
      type: 'composite_text',
      template: 'Sex: {{patient.gender}}',
    });
    assert.equal(result.success, true);
  });
});

describe('extractCompositeBindings — helper', () => {
  it('returns the bindings in document order, duplicates included', () => {
    const bindings = extractCompositeBindings(
      '{{patient.full_name}} ({{patient.full_name}}) — {{doctor.full_name}}',
    );
    assert.deepEqual(bindings, [
      'patient.full_name',
      'patient.full_name',
      'doctor.full_name',
    ]);
  });

  it('returns an empty array on non-string input', () => {
    assert.deepEqual(extractCompositeBindings(null), []);
    assert.deepEqual(extractCompositeBindings(undefined), []);
    assert.deepEqual(extractCompositeBindings(42), []);
  });

  it('does not match malformed placeholders', () => {
    assert.deepEqual(extractCompositeBindings('{patient.full_name}'), []);
    assert.deepEqual(extractCompositeBindings('{{ Bad-Name }}'), []);
  });
});
