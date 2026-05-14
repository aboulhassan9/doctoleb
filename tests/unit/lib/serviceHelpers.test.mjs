import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  validationError,
  parse,
} from '../../../packages/core/lib/serviceHelpers.js';

describe('validationError', () => {
  it('returns the standard envelope shape', () => {
    const result = validationError('Email is required');
    assert.deepEqual(result, { data: null, error: 'Email is required' });
  });
});

describe('parse', () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().int().min(0),
  });

  it('returns { data } on a successful parse', () => {
    const result = parse(schema, { name: 'Maya', age: 30 });
    assert.equal(result.error, undefined);
    assert.deepEqual(result.data, { name: 'Maya', age: 30 });
  });

  it('returns { error } on a failed parse', () => {
    const result = parse(schema, { name: '', age: 30 });
    assert.equal(result.data, undefined);
    assert.notEqual(result.error, undefined);
    assert.match(String(result.error), /Too small|String must contain|smaller/i);
  });

  it('returns { error } when fields are the wrong type', () => {
    const result = parse(schema, { name: 'Maya', age: 'thirty' });
    assert.equal(result.data, undefined);
    assert.notEqual(result.error, undefined);
  });
});
