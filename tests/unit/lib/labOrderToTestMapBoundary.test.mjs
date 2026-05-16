/**
 * labOrderToTestMapBoundary.test.mjs
 *
 * Regression coverage for the word-boundary fix in resolveLabTests().
 * The previous version used `.includes(pattern)` and matched any substring,
 * so "salt", "default", "altitude" would all hit the `alt` ALT-SGPT entry.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resolveLabTests } from '../../../packages/core/lib/labOrderToTestMap.js';

describe('resolveLabTests — word boundaries', () => {
  it('matches "alt" as a whole word', () => {
    assert.deepEqual(resolveLabTests('ALT'), ['ALT (SGPT)']);
    assert.deepEqual(resolveLabTests('alt range'), ['ALT (SGPT)']);
    assert.deepEqual(resolveLabTests('Order ALT today'), ['ALT (SGPT)']);
  });

  it('does NOT match "alt" inside other words', () => {
    assert.deepEqual(resolveLabTests('salt'), []);
    assert.deepEqual(resolveLabTests('default'), []);
    assert.deepEqual(resolveLabTests('altitude sickness'), []);
  });

  it('does NOT match "lh" inside other words', () => {
    assert.deepEqual(resolveLabTests('mlhotra'), []);
    // The "Hematology — CBC" entry should not pick up unrelated medical text.
    const noiseResult = resolveLabTests('lhamatology workup');
    assert.equal(noiseResult.includes('LH'), false);
  });

  it('still matches multi-word patterns with their original behavior', () => {
    const result = resolveLabTests('complete blood count + LFT');
    assert.ok(result.includes('CBC'));
    assert.ok(result.includes('ALT (SGPT)'));
  });

  it('handles a Lipid Panel + Thyroid common request', () => {
    const result = resolveLabTests('Lipid Panel and Thyroid Screen');
    assert.ok(result.includes('Lipid Panel'));
    assert.ok(result.includes('TSH'));
  });

  it('does not panic on an empty title', () => {
    assert.deepEqual(resolveLabTests(''), []);
    assert.deepEqual(resolveLabTests('   '), []);
    assert.deepEqual(resolveLabTests(null), []);
  });
});
