import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getErrorMessage } from '../../packages/core/lib/errors.js';

describe('getErrorMessage', () => {
  it('keeps string service errors visible', () => {
    assert.equal(getErrorMessage('Slot already booked', 'Fallback'), 'Slot already booked');
  });

  it('uses object message values from Supabase-style errors', () => {
    assert.equal(getErrorMessage({ message: 'Database unavailable' }, 'Fallback'), 'Database unavailable');
  });

  it('falls back for empty or unknown error shapes', () => {
    assert.equal(getErrorMessage('', 'Fallback'), 'Fallback');
    assert.equal(getErrorMessage(null, 'Fallback'), 'Fallback');
    assert.equal(getErrorMessage({ message: '' }, 'Fallback'), 'Fallback');
  });
});
