import { supabase } from '../lib/supabase';
import { getProfileForSessionUser, buildSessionUser, createFallbackPatientProfile } from '../lib/authIdentity';
import { authSignInSchema, authSignUpSchema, forgotPasswordSchema, parseWithSchema, resetPasswordSchema } from '../schemas';

export const authService = {
  async signIn(email, password) {
    const { data: credentials, error: validationError } = parseWithSchema(authSignInSchema, { email, password });
    if (validationError) return { data: null, error: validationError };

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) return { data: null, error: 'Invalid email or password' };

    const { data: { session } } = await supabase.auth.getSession();
    const { data: profile, error: profileError } = await getProfileForSessionUser(supabase, session?.user || credentials, { requireActive: true });
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

    const { data: existingProfile, error: existingProfileError } = await getProfileForSessionUser(supabase, authUser, { requireActive: false });
    if (existingProfileError) {
      return { data: null, error: existingProfileError };
    }

    if (existingProfile) {
      return buildSessionUser(supabase, existingProfile);
    }

    return createFallbackPatientProfile(supabase, {
      authUserId: authUser.id,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
    });
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

  // localStorage is no longer used for session tracking as we rely on Supabase Auth and AuthContext
  setUserSession(email, role, _patientId = null) {
    // No-op - session handled by Supabase
  },

  getUserSession() {
    // Return empty placeholders if called before AuthContext takes over
    return {
      email: null,
      role: null,
      patientId: null,
    };
  },

  isAuthenticated() {
    // Rely on Supabase session or AuthContext instead
    return false;
  },
};
