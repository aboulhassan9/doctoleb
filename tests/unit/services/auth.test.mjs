import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseMock } from './__helpers__/supabaseMock.mjs';
import { __setSupabaseClientForTest } from '../../../packages/core/lib/supabase.js';
import { authService } from '../../../packages/core/services/auth.js';

// Standard happy-path Supabase responses reused across tests. F3 response-
// shape validation on sessionUserResponseSchema requires real UUIDs for `id`.
const AUTH_USER_ID = '11111111-1111-4111-8111-111111111111';
const PROFILE_ID = '22222222-2222-4222-8222-222222222222';
const DOCTOR_ID = '33333333-3333-4333-8333-333333333333';
const SESSION_USER = { id: AUTH_USER_ID, email: 'maya@example.com' };
const DOCTOR_PROFILE = {
  id: PROFILE_ID,
  email: 'maya@example.com',
  first_name: 'Maya',
  last_name: 'Haddad',
  role: 'doctor',
  phone: '+961 71 234 567',
  is_active: true,
};

let mock;
let previousClient;

beforeEach(() => {
  mock = createSupabaseMock();
  previousClient = __setSupabaseClientForTest(mock.client);
});

afterEach(() => {
  __setSupabaseClientForTest(previousClient);
});

describe('authService.signIn — input validation', () => {
  it('rejects an empty email without calling Supabase', async () => {
    const result = await authService.signIn('', 'longenoughpassword');
    assert.equal(result.data, null);
    assert.match(String(result.error), /email/i);
    assert.equal(mock.calls.auth.length, 0);
  });

  it('rejects a missing password without calling Supabase', async () => {
    const result = await authService.signIn('maya@example.com', '');
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    assert.equal(mock.calls.auth.length, 0);
  });
});

describe('authService.signIn — Supabase rejection', () => {
  it('returns a generic credentials error when signInWithPassword fails', async () => {
    mock.onAuth('signInWithPassword', () => ({ data: null, error: { message: 'Invalid login credentials' } }));
    const result = await authService.signIn('maya@example.com', 'longenoughpassword');
    assert.equal(result.data, null);
    assert.equal(result.error, 'Invalid email or password');
  });

  it('returns the session-not-established error when no session comes back', async () => {
    mock.onAuth('signInWithPassword', () => ({ data: { user: SESSION_USER }, error: null }));
    mock.onAuth('getSession', () => ({ data: { session: null }, error: null }));
    mock.onAuth('signOut', () => ({ error: null }));
    const result = await authService.signIn('maya@example.com', 'longenoughpassword');
    assert.equal(result.data, null);
    assert.match(String(result.error), /session could not be established/i);
    // Should have called signOut to clear any partial session state.
    assert.ok(mock.calls.auth.some((c) => c.method === 'signOut'));
  });
});

describe('authService.signIn — profile resolution', () => {
  it('returns a friendly error when the auth user has no linked profile', async () => {
    mock.onAuth('signInWithPassword', () => ({ data: { user: SESSION_USER }, error: null }));
    mock.onAuth('getSession', () => ({ data: { session: { user: SESSION_USER } }, error: null }));
    mock.onAuth('signOut', () => ({ error: null }));
    // No row found in users for this auth_user_id.
    mock.onFrom('users', () => ({ data: null, error: null }));
    const result = await authService.signIn('maya@example.com', 'longenoughpassword');
    assert.equal(result.data, null);
    assert.match(String(result.error), /profile not found|account is inactive/i);
    assert.ok(mock.calls.auth.some((c) => c.method === 'signOut'));
  });

  it('returns the session user when profile loads cleanly', async () => {
    mock.onAuth('signInWithPassword', () => ({ data: { user: SESSION_USER }, error: null }));
    mock.onAuth('getSession', () => ({ data: { session: { user: SESSION_USER } }, error: null }));
    mock.onFrom('users', () => ({ data: DOCTOR_PROFILE, error: null }));
    mock.onFrom('doctors', () => ({ data: { id: DOCTOR_ID }, error: null }));
    // No patient row for a doctor account.
    mock.onFrom('patients', () => ({ data: null, error: null }));

    const result = await authService.signIn('maya@example.com', 'longenoughpassword');
    assert.equal(result.error, null);
    assert.ok(result.data);
    assert.equal(result.data.id, DOCTOR_PROFILE.id);
    assert.equal(result.data.role, 'doctor');
    assert.equal(result.data.email, 'maya@example.com');
    assert.equal(result.data.doctor_id, DOCTOR_ID);
  });
});

describe('authService.requestEmailOtp', () => {
  it('rejects an obviously-invalid email without calling Supabase', async () => {
    const result = await authService.requestEmailOtp('not-an-email');
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    assert.equal(mock.calls.auth.length, 0);
  });

  it('returns success with the normalized email on a clean send', async () => {
    mock.onAuth('signInWithOtp', () => ({ data: {}, error: null }));
    const result = await authService.requestEmailOtp('  Maya@Example.com  ');
    assert.equal(result.error, null);
    assert.equal(result.data.email, 'maya@example.com');
    // Make sure shouldCreateUser=false was passed through.
    const call = mock.calls.auth.find((c) => c.method === 'signInWithOtp');
    assert.equal(call.args[0].options.shouldCreateUser, false);
  });

  it('returns the friendly rate-limit message when Supabase returns 429', async () => {
    mock.onAuth('signInWithOtp', () => ({ data: null, error: { status: 429, code: 'over_email_send_rate_limit', message: 'over limit' } }));
    const result = await authService.requestEmailOtp('maya@example.com');
    assert.equal(result.data, null);
    assert.match(String(result.error), /rate limited/i);
  });

  it('returns the friendly otp-disabled message when Supabase returns 400', async () => {
    mock.onAuth('signInWithOtp', () => ({ data: null, error: { status: 400, code: 'otp_disabled', message: 'disabled' } }));
    const result = await authService.requestEmailOtp('maya@example.com');
    assert.equal(result.data, null);
    assert.match(String(result.error), /not available/i);
  });
});

describe('authService.verifyEmailOtp', () => {
  it('rejects when token is too short for the schema', async () => {
    const result = await authService.verifyEmailOtp('maya@example.com', '12');
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    assert.equal(mock.calls.auth.length, 0);
  });

  it('returns the user on a successful verification', async () => {
    mock.onAuth('verifyOtp', () => ({ data: { user: SESSION_USER }, error: null }));
    mock.onAuth('getSession', () => ({ data: { session: { user: SESSION_USER } }, error: null }));
    mock.onFrom('users', () => ({ data: DOCTOR_PROFILE, error: null }));
    mock.onFrom('doctors', () => ({ data: { id: DOCTOR_ID }, error: null }));
    mock.onFrom('patients', () => ({ data: null, error: null }));

    const result = await authService.verifyEmailOtp('maya@example.com', '123456');
    assert.equal(result.error, null);
    assert.equal(result.data.id, PROFILE_ID);
    assert.equal(result.data.role, 'doctor');
  });

  it('signs out and returns an error if Supabase rejects the token', async () => {
    mock.onAuth('verifyOtp', () => ({ data: null, error: { message: 'invalid token' } }));
    const result = await authService.verifyEmailOtp('maya@example.com', '999999');
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
  });
});
