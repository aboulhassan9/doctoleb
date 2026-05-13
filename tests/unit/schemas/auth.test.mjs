import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  authSignInSchema,
  authOtpRequestSchema,
  authOtpVerifySchema,
  authSignUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  parseWithSchema,
} from '../../../packages/core/schemas/index.js';

describe('auth schemas', () => {
  describe('authSignInSchema', () => {
    it('accepts a valid email + password', () => {
      const { data, error } = parseWithSchema(authSignInSchema, {
        email: 'doctor@clinic.com',
        password: 'a-real-password',
      });
      assert.equal(error, null);
      assert.equal(data.email, 'doctor@clinic.com');
    });

    it('rejects an invalid email', () => {
      const { error } = parseWithSchema(authSignInSchema, {
        email: 'not-an-email',
        password: 'whatever',
      });
      assert.match(String(error), /email/i);
    });

    it('rejects an empty password', () => {
      const { error } = parseWithSchema(authSignInSchema, {
        email: 'doctor@clinic.com',
        password: '',
      });
      assert.notEqual(error, null);
    });
  });

  describe('authOtpRequestSchema', () => {
    it('accepts a valid email', () => {
      const { data, error } = parseWithSchema(authOtpRequestSchema, { email: 'doctor@clinic.com' });
      assert.equal(error, null);
      assert.equal(data.email, 'doctor@clinic.com');
    });

    it('rejects a missing email', () => {
      const { error } = parseWithSchema(authOtpRequestSchema, {});
      assert.notEqual(error, null);
    });

    it('rejects a malformed email', () => {
      const { error } = parseWithSchema(authOtpRequestSchema, { email: 'doctor@' });
      assert.notEqual(error, null);
    });
  });

  describe('authOtpVerifySchema', () => {
    it('accepts a 6-digit token paired with an email', () => {
      const { data, error } = parseWithSchema(authOtpVerifySchema, {
        email: 'doctor@clinic.com',
        token: '123456',
      });
      assert.equal(error, null);
      assert.equal(data.token, '123456');
    });

    it('rejects a token that is too short', () => {
      const { error } = parseWithSchema(authOtpVerifySchema, {
        email: 'doctor@clinic.com',
        token: '123',
      });
      assert.notEqual(error, null);
    });

    it('rejects a non-numeric token', () => {
      const { error } = parseWithSchema(authOtpVerifySchema, {
        email: 'doctor@clinic.com',
        token: 'abcdef',
      });
      assert.notEqual(error, null);
    });
  });

  describe('authSignUpSchema', () => {
    it('accepts a valid signup payload', () => {
      const { data, error } = parseWithSchema(authSignUpSchema, {
        email: 'patient@example.com',
        password: 'a-strong-password',
        firstName: 'Maya',
        lastName: 'Haddad',
      });
      assert.equal(error, null);
      assert.equal(data.firstName, 'Maya');
    });

    it('rejects a missing firstName', () => {
      const { error } = parseWithSchema(authSignUpSchema, {
        email: 'patient@example.com',
        password: 'a-strong-password',
        lastName: 'Haddad',
      });
      assert.notEqual(error, null);
    });
  });

  describe('forgotPasswordSchema', () => {
    it('accepts a valid email', () => {
      const { error } = parseWithSchema(forgotPasswordSchema, { email: 'doctor@clinic.com' });
      assert.equal(error, null);
    });

    it('rejects a malformed email', () => {
      const { error } = parseWithSchema(forgotPasswordSchema, { email: '@' });
      assert.notEqual(error, null);
    });
  });

  describe('resetPasswordSchema', () => {
    it('accepts a matched password + confirmation', () => {
      const { error } = parseWithSchema(resetPasswordSchema, {
        password: 'a-new-strong-pw',
        confirmPassword: 'a-new-strong-pw',
      });
      assert.equal(error, null);
    });

    it('rejects a short password', () => {
      const { error } = parseWithSchema(resetPasswordSchema, {
        password: '1',
        confirmPassword: '1',
      });
      assert.notEqual(error, null);
    });

    it('rejects mismatched password and confirmation', () => {
      const { error } = parseWithSchema(resetPasswordSchema, {
        password: 'a-new-strong-pw',
        confirmPassword: 'a-different-pw',
      });
      assert.notEqual(error, null);
    });
  });
});
