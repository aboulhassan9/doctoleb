import { supabase } from '../lib/supabase';

export const authService = {
  async signIn(email, password) {
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) return { data: null, error: 'Invalid email or password' };

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role, initials, is_active')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      return { data: null, error: 'User profile not found or account is inactive' };
    }

    let patient_id = null;
    if (profile.role === 'patient') {
      const { data: patientData } = await supabase
        .from('patients')
        .select('id')
        .eq('user_id', profile.id)
        .single();
      patient_id = patientData?.id;
    }

    return {
      data: {
        id: profile.id,
        email: profile.email,
        first_name: profile.first_name,
        last_name: profile.last_name,
        role: profile.role,
        initials: profile.initials,
        patient_id,
      },
      error: null,
    };
  },

  async signUp(email, password, firstName, lastName) {
    const { error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) return { data: null, error: authError.message };

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) return { data: null, error: 'Email already registered' };

    const initials = (firstName?.charAt(0) || '') + (lastName?.charAt(0) || '');

    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert([{
        email,
        password_hash: `supabase_auth_${crypto.randomUUID()}`,
        first_name: firstName,
        last_name: lastName,
        role: 'patient',
        initials,
        is_active: true,
      }])
      .select('id, email, first_name, last_name, role, initials')
      .single();

    if (userError || !newUser) {
      return { data: null, error: userError?.message || 'Failed to create account' };
    }

    const { data: patientData, error: patientError } = await supabase
      .from('patients')
      .insert([{ user_id: newUser.id }])
      .select('id')
      .single();

    if (patientError) return { data: null, error: 'Failed to create patient record' };

    return { data: { ...newUser, patient_id: patientData.id }, error: null };
  },

  async getCurrentUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { data: null, error: 'No active session' };

    const { data, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role, initials')
      .eq('email', session.user.email)
      .single();

    if (error || !data) return { data: null, error: 'User not found' };

    let patient_id = null;
    if (data.role === 'patient') {
      const { data: patientData } = await supabase
        .from('patients')
        .select('id')
        .eq('user_id', data.id)
        .single();
      patient_id = patientData?.id;
    }

    return { data: { ...data, patient_id }, error: null };
  },

  async logout() {
    await supabase.auth.signOut();
  },

  // localStorage is no longer used for session tracking as we rely on Supabase Auth and AuthContext
  setUserSession(email, role, patientId = null) {
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
