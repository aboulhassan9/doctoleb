import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function extractCurrentUserErrorBranch(source) {
  const branchStart = source.indexOf('if (currentUserError) {', source.indexOf("event === 'SIGNED_IN'"));
  const branchEnd = source.indexOf('if (data) {', branchStart);

  assert.ok(branchStart > -1, 'SIGNED_IN profile error branch should exist');
  assert.ok(branchEnd > branchStart, 'SIGNED_IN data branch should follow profile error branch');

  return source.slice(branchStart, branchEnd);
}

describe('auth security contracts', () => {
  it('staff identity resolution does not fall back to an unrelated first doctor', () => {
    const source = read('packages/core/lib/authIdentity.js');

    assert.doesNotMatch(source, /getFirstDoctorId/);
    assert.doesNotMatch(source, /\.order\('created_at', \{ ascending: true \}\)[\s\S]*\.limit\(1\)/);
    assert.match(source, /STAFF_ASSIGNMENT_REQUIRED_ERROR/);
  });

  it('auth state changes fail closed when the linked app profile cannot be loaded', () => {
    const source = read('packages/ui/contexts/AuthContext.jsx');
    const profileErrorBranch = extractCurrentUserErrorBranch(source);

    assert.match(profileErrorBranch, /await authService\.logout\(\)/);
    assert.match(profileErrorBranch, /setUser\(null\)/);
    assert.match(profileErrorBranch, /setError\(logoutError \|\| currentUserError\)/);
    assert.match(profileErrorBranch, /return/);
  });

  it('auth service clears Supabase sessions when app identity construction fails', () => {
    const source = read('packages/core/services/auth.js');

    assert.match(source, /async function buildSessionUserOrSignOut\(profile\)/);
    assert.match(source, /const result = await buildSessionUser\(supabase, profile\)/);
    assert.match(source, /if \(result\.error \|\| !result\.data\) \{[\s\S]*await supabase\.auth\.signOut\(\);[\s\S]*\}/);
    assert.match(source, /return buildSessionUserOrSignOut\(profile\)/);
    assert.match(source, /return buildSessionUserOrSignOut\(existingProfile\)/);
  });

  it('clinic ops supports email OTP without creating unknown auth users', () => {
    const authService = read('packages/core/services/auth.js');
    const authContext = read('packages/ui/contexts/AuthContext.jsx');
    const opsLogin = read('apps/clinic-ops/src/pages/OpsLoginPage.jsx');
    const schemas = read('packages/core/schemas/index.js');

    assert.match(schemas, /export const authOtpRequestSchema/);
    assert.match(schemas, /export const authOtpVerifySchema/);
    assert.match(authService, /requestEmailOtp/);
    assert.match(authService, /signInWithOtp/);
    assert.match(authService, /shouldCreateUser:\s*false/);
    assert.match(authService, /verifyEmailOtp/);
    assert.match(authService, /verifyOtp/);
    assert.match(authService, /type:\s*'email'/);
    assert.match(authService, /getProfileForSessionUser\(supabase, session\.user, \{ requireActive: true \}\)/);
    assert.match(authContext, /requestEmailOtp/);
    assert.match(authContext, /verifyEmailOtp/);
    assert.match(opsLogin, /loginMode/);
    assert.match(opsLogin, /clinic-ops:pending-otp/);
    assert.match(opsLogin, /sessionStorage\.setItem/);
    assert.match(opsLogin, /sessionStorage\.removeItem/);
    assert.match(opsLogin, /Enter login code/);
    assert.match(opsLogin, /Code sent/);
    assert.match(opsLogin, /Email code/);
    assert.match(opsLogin, /Send login code/);
    assert.match(opsLogin, /Verify code/);
  });
});
