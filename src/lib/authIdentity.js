import { USER_PUBLIC_FIELDS } from './selects';

const AUTH_LINK_COLUMN = 'auth_user_id';

export function buildInitials(firstName, lastName) {
  return `${firstName?.trim()?.[0] || ''}${lastName?.trim()?.[0] || ''}`.toUpperCase();
}

export function isMissingAuthLinkColumnError(error) {
  const message = error?.message || '';
  return error?.code === '42703' || message.includes(AUTH_LINK_COLUMN);
}

async function getProfileByEmail(supabase, email, requireActive) {
  if (!email) return { data: null, error: 'User profile not found' };

  let query = supabase.from('users').select(USER_PUBLIC_FIELDS).eq('email', email);
  if (requireActive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query.maybeSingle();
  return {
    data,
    error: error?.message || null,
  };
}

export async function getProfileForSessionUser(supabase, sessionUser, options = {}) {
  const { requireActive = true } = options;

  if (!sessionUser) {
    return { data: null, error: 'No active session' };
  }

  if (sessionUser.id) {
    try {
      let query = supabase.from('users').select(USER_PUBLIC_FIELDS).eq(AUTH_LINK_COLUMN, sessionUser.id);
      if (requireActive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query.maybeSingle();
      if (error && !isMissingAuthLinkColumnError(error)) {
        return { data: null, error: error.message };
      }
      if (data) {
        return { data, error: null };
      }
    } catch (error) {
      if (!isMissingAuthLinkColumnError(error)) {
        return { data: null, error: error.message || 'Failed to load user profile' };
      }
    }
  }

  return getProfileByEmail(supabase, sessionUser.email, requireActive);
}

export async function getPatientIdForUser(supabase, userId) {
  if (!userId) return { data: null, error: null };

  const { data, error } = await supabase
    .from('patients')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  return {
    data: data?.id || null,
    error: error?.message || null,
  };
}

export async function buildSessionUser(supabase, profile) {
  if (!profile) return { data: null, error: 'User not found' };

  let patientId = null;
  if (profile.role === 'patient') {
    const { data, error } = await getPatientIdForUser(supabase, profile.id);
    if (error) {
      return { data: null, error };
    }
    patientId = data;
  }

  return {
    data: {
      ...profile,
      patient_id: patientId,
    },
    error: null,
  };
}

export async function createFallbackPatientProfile(supabase, payload) {
  const {
    authUserId,
    email,
    firstName,
    lastName,
  } = payload;

  const userPayload = {
    email,
    first_name: firstName,
    last_name: lastName,
    role: 'patient',
    initials: buildInitials(firstName, lastName),
    is_active: true,
  };

  let newUser = null;
  let userError = null;

  if (authUserId) {
    const { data, error } = await supabase
      .from('users')
      .insert([{ ...userPayload, [AUTH_LINK_COLUMN]: authUserId }])
      .select(USER_PUBLIC_FIELDS)
      .single();

    if (!error) {
      newUser = data;
    } else if (!isMissingAuthLinkColumnError(error)) {
      userError = error.message;
    }
  }

  if (!newUser && !userError) {
    const { data, error } = await supabase
      .from('users')
      .insert([userPayload])
      .select(USER_PUBLIC_FIELDS)
      .single();

    if (error) {
      userError = error.message;
    } else {
      newUser = data;
    }
  }

  if (userError || !newUser) {
    return { data: null, error: userError || 'Failed to create user profile' };
  }

  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .insert([{ user_id: newUser.id }])
    .select('id')
    .single();

  if (patientError) {
    // Rollback: delete the orphaned user row to prevent partial-account state.
    // A user without a patient profile would be rejected on next sign-in.
    await supabase.from('users').delete().eq('id', newUser.id);
    return { data: null, error: patientError.message || 'Failed to create patient profile' };
  }

  return {
    data: {
      ...newUser,
      patient_id: patient.id,
    },
    error: null,
  };
}
