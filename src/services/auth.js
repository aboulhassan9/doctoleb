import { supabase } from '@/lib/supabase';
import { getProfileForSessionUser, buildSessionUser } from '@/lib/authIdentity';
import { authSignInSchema, authSignUpSchema, forgotPasswordSchema, parseWithSchema, resetPasswordSchema } from '@/schemas';

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

    return buildSessionUser(supabase, profile);
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
      return { data: null, error: existingProfileError };
    }

    if (existingProfile) {
      return buildSessionUser(supabase, existingProfile);
    }

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
