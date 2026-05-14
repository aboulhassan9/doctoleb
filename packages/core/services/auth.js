import { supabase } from '../lib/supabase.js';
import { getProfileForSessionUser, buildSessionUser } from '../lib/authIdentity.js';
import {
  authOtpRequestSchema,
  authOtpVerifySchema,
  authSignInSchema,
  authSignUpSchema,
  forgotPasswordSchema,
  parseWithSchema,
  resetPasswordSchema,
  sessionUserResponseSchema,
} from '../schemas/index.js';

async function waitForProvisionedProfile(authUser, requireActive = false) {
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const result = await getProfileForSessionUser(supabase, authUser, { requireActive });
    if (result.data || !result.error?.includes?.('not linked')) {
      return result;
    }

    await new Promise(resolve => window.setTimeout(resolve, 250 * (attempt + 1)));
  }

  return { data: null, error: 'Account created, but profile provisioning is still pending. Please try again in a moment.' };
}

async function buildSessionUserOrSignOut(profile) {
  const result = await buildSessionUser(supabase, profile);
  if (result.error || !result.data) {
    await supabase.auth.signOut();
    return result;
  }

  // F3: validate the session user shape before handing it to the AuthContext.
  // An unexpected role or missing id signals upstream contract drift — fail
  // closed with a sign-out instead of letting the UI render in a broken state.
  const validation = parseWithSchema(sessionUserResponseSchema, result.data);
  if (validation.error) {
    await supabase.auth.signOut();
    return { data: null, error: 'Sign-in returned an unexpected user shape.' };
  }
  return result;
}

function getCurrentPageRedirectTo() {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}${window.location.pathname}`;
}

function getOtpAuthErrorMessage(authError) {
  if (!authError) return null;

  if (authError.status === 429 || authError.code === 'over_email_send_rate_limit') {
    return 'Email login is temporarily rate limited. Please try again in a few minutes.';
  }

  if (authError.status === 400 || authError.code === 'otp_disabled') {
    return 'Email code login is not available for this clinic yet.';
  }

  return 'Could not verify this email code.';
}

export const authService = {
  setUserSession() {
    // Compatibility no-op. Supabase Auth is the only session source of truth.
  },

  async signIn(email, password) {
    const { error: validationError } = parseWithSchema(authSignInSchema, { email, password });
    if (validationError) return { data: null, error: validationError };

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) return { data: null, error: 'Invalid email or password' };

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      await supabase.auth.signOut();
      return { data: null, error: 'Authenticated session could not be established.' };
    }

    const { data: profile, error: profileError } = await getProfileForSessionUser(supabase, session.user, { requireActive: true });
    if (profileError || !profile) {
      await supabase.auth.signOut();
      return { data: null, error: 'User profile not found or account is inactive' };
    }

    return buildSessionUserOrSignOut(profile);
  },

  async requestEmailOtp(email) {
    const { data: payload, error: validationError } = parseWithSchema(authOtpRequestSchema, { email });
    if (validationError) return { data: null, error: validationError };

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: payload.email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: getCurrentPageRedirectTo(),
      },
    });

    if (authError) {
      return { data: null, error: getOtpAuthErrorMessage(authError) };
    }

    return { data: { email: payload.email }, error: null };
  },

  async verifyEmailOtp(email, token) {
    const { data: payload, error: validationError } = parseWithSchema(authOtpVerifySchema, { email, token });
    if (validationError) return { data: null, error: validationError };

    const { error: authError } = await supabase.auth.verifyOtp({
      email: payload.email,
      token: payload.token,
      type: 'email',
    });
    if (authError) return { data: null, error: getOtpAuthErrorMessage(authError) };

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      await supabase.auth.signOut();
      return { data: null, error: 'Authenticated session could not be established.' };
    }

    const { data: profile, error: profileError } = await getProfileForSessionUser(supabase, session.user, { requireActive: true });
    if (profileError || !profile) {
      await supabase.auth.signOut();
      return { data: null, error: 'User profile not found or account is inactive' };
    }

    return buildSessionUserOrSignOut(profile);
  },

  async signUp(email, password, firstName, lastName) {
    const { data: payload, error: validationError } = parseWithSchema(authSignUpSchema, { email, password, firstName, lastName });
    if (validationError) return { data: null, error: validationError };

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          first_name: payload.firstName,
          last_name: payload.lastName,
        },
      },
    });
    if (authError) return { data: null, error: authError.message };

    const authUser = authData?.user;
    if (!authUser) {
      return { data: null, error: 'Account created, but no user session was returned.' };
    }

    if (!authData?.session) {
      return {
        data: {
          email: payload.email,
          pendingConfirmation: true,
        },
        error: null,
      };
    }

    const { data: existingProfile, error: existingProfileError } = await waitForProvisionedProfile(authUser, false);
    if (existingProfileError) {
      await supabase.auth.signOut();
      return { data: null, error: existingProfileError };
    }

    if (existingProfile) {
      return buildSessionUserOrSignOut(existingProfile);
    }

    await supabase.auth.signOut();
    return { data: null, error: 'Account created, but profile provisioning did not complete.' };
  },

  async getCurrentUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { data: null, error: 'No active session' };

    const { data: profile, error } = await getProfileForSessionUser(supabase, session.user, { requireActive: true });
    if (error || !profile) return { data: null, error: 'User not found' };

    return buildSessionUser(supabase, profile);
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    return { data: null, error: error?.message || null };
  },

  async requestPasswordReset(email) {
    const { data, error: validationError } = parseWithSchema(forgotPasswordSchema, { email });
    if (validationError) return { data: null, error: validationError };

    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    return { data: error ? null : true, error: error?.message || null };
  },

  async resetPassword(password, confirmPassword = password) {
    const { data, error: validationError } = parseWithSchema(resetPasswordSchema, { password, confirmPassword });
    if (validationError) return { data: null, error: validationError };

    const { error } = await supabase.auth.updateUser({ password: data.password });
    if (error) {
      return { data: null, error: error.message };
    }

    return this.getCurrentUser();
  },
};
