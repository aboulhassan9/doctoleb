/**
 * composite.test.mjs
 *
 * Pure-helper coverage for the composite_text substitution engine. These
 * are the rules the editor preview and the Edge Function renderer both
 * have to honor — keeping them locked here prevents drift.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  COMPOSITE_PLACEHOLDER_RE,
  extractCompositeBindings,
  renderCompositeTemplate,
} from '../../../packages/core/lib/composite.js';
import { TEMPLATE_AUTOFILL_KEYS } from '../../../packages/core/schemas/documentTemplates.js';

const SAMPLE = {
  'patient.full_name': 'Sample Patient',
  'patient.date_of_birth': '1990-01-01',
};

describe('extractCompositeBindings', () => {
  it('returns bindings in document order with duplicates preserved', () => {
    const result = extractCompositeBindings(
      '{{patient.full_name}} ({{patient.full_name}}) — {{doctor.full_name}}',
    );
    assert.deepEqual(result, [
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

  it('regex resets its lastIndex between calls', () => {
    extractCompositeBindings('{{patient.full_name}}');
    assert.equal(COMPOSITE_PLACEHOLDER_RE.lastIndex, 0);
  });
});

describe('renderCompositeTemplate', () => {
  it('substitutes known bindings with their resolved values', () => {
    const out = renderCompositeTemplate(
      '{{patient.full_name}} — born {{patient.date_of_birth}}',
      SAMPLE,
      TEMPLATE_AUTOFILL_KEYS,
    );
    assert.equal(out, 'Sample Patient — born 1990-01-01');
  });

  it('renders a known-but-empty binding as empty string', () => {
    const out = renderCompositeTemplate(
      'Phone: {{patient.phone}}',
      SAMPLE, // patient.phone is NOT in SAMPLE
      TEMPLATE_AUTOFILL_KEYS,
    );
    assert.equal(out, 'Phone: ');
  });

  it('renders an UNKNOWN binding as literal [binding.key]', () => {
    const out = renderCompositeTemplate(
      'Bogus: {{patient.middle_name}}',
      SAMPLE,
      TEMPLATE_AUTOFILL_KEYS, // does not include middle_name
    );
    assert.equal(out, 'Bogus: [patient.middle_name]');
  });

  it('tolerates whitespace inside the placeholder braces', () => {
    const out = renderCompositeTemplate(
      '{{ patient.full_name }}',
      SAMPLE,
      TEMPLATE_AUTOFILL_KEYS,
    );
    assert.equal(out, 'Sample Patient');
  });

  it('returns empty string for an empty / non-string template', () => {
    assert.equal(renderCompositeTemplate('', SAMPLE, TEMPLATE_AUTOFILL_KEYS), '');
    assert.equal(renderCompositeTemplate(null, SAMPLE, TEMPLATE_AUTOFILL_KEYS), '');
    assert.equal(renderCompositeTemplate(undefined, SAMPLE, TEMPLATE_AUTOFILL_KEYS), '');
  });

  it('is deterministic — same input → same output across calls', () => {
    const tpl = '{{patient.full_name}} / {{patient.date_of_birth}}';
    const a = renderCompositeTemplate(tpl, SAMPLE, TEMPLATE_AUTOFILL_KEYS);
    const b = renderCompositeTemplate(tpl, SAMPLE, TEMPLATE_AUTOFILL_KEYS);
    assert.equal(a, b);
  });

  it('accepts either an Iterable or a Set for knownKeys', () => {
    const tpl = '{{patient.full_name}}';
    const asSet = renderCompositeTemplate(tpl, SAMPLE, new Set(TEMPLATE_AUTOFILL_KEYS));
    const asArr = renderCompositeTemplate(tpl, SAMPLE, TEMPLATE_AUTOFILL_KEYS);
    assert.equal(asSet, asArr);
  });
});
