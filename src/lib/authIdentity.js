import { USER_PUBLIC_FIELDS } from './selects';

const AUTH_LINK_COLUMN = 'auth_user_id';

export function buildInitials(firstName, lastName) {
  return `${firstName?.trim()?.[0] || ''}${lastName?.trim()?.[0] || ''}`.toUpperCase();
}

export function isMissingAuthLinkColumnError(error) {
  const message = error?.message || '';
  return error?.code === '42703' || message.includes(AUTH_LINK_COLUMN);
}

export async function getProfileForSessionUser(supabase, sessionUser, options = {}) {
  const { requireActive = true } = options;

  if (!sessionUser?.id) {
    return { data: null, error: 'No active authenticated session' };
  }

  try {
    let query = supabase.from('users').select(USER_PUBLIC_FIELDS).eq(AUTH_LINK_COLUMN, sessionUser.id);
    if (requireActive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      if (isMissingAuthLinkColumnError(error)) {
        return { data: null, error: 'The database is missing the auth user link migration.' };
      }

      return { data: null, error: error.message };
    }

    if (!data) {
      return { data: null, error: 'User profile is not linked to this authenticated account.' };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: error.message || 'Failed to load user profile' };
  }
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

export async function getDoctorIdForUser(supabase, userId) {
  if (!userId) return { data: null, error: null };

  const { data, error } = await supabase
    .from('doctors')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  return {
    data: data?.id || null,
    error: error?.message || null,
  };
}

async function getStaffDoctorIdForUser(supabase, userId) {
  if (!userId) return { data: null, error: null };

  const { data, error } = await supabase
    .from('staff_members')
    .select('doctor_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    const isMissingStaffTable = error.code === '42P01' || error.message?.includes('staff_members');
    return { data: null, error: isMissingStaffTable ? null : error.message };
  }

  return {
    data: data?.doctor_id || null,
    error: null,
  };
}

async function getFirstDoctorId(supabase) {
  const { data, error } = await supabase
    .from('doctors')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return {
    data: data?.id || null,
    error: error?.message || null,
  };
}

export async function buildSessionUser(supabase, profile) {
  if (!profile) return { data: null, error: 'User not found' };

  let patientId = null;
  let doctorId = null;

  if (profile.role === 'patient') {
    const { data, error } = await getPatientIdForUser(supabase, profile.id);
    if (error) {
      return { data: null, error };
    }
    patientId = data;
  }

  if (profile.role === 'doctor') {
    const { data, error } = await getDoctorIdForUser(supabase, profile.id);
    if (error) {
      return { data: null, error };
    }
    doctorId = data;
  }

  if (['secretary', 'predoctor', 'admin'].includes(profile.role)) {
    const { data, error } = await getStaffDoctorIdForUser(supabase, profile.id);
    if (error) {
      return { data: null, error };
    }
    doctorId = data;

    if (!doctorId) {
      const fallback = await getFirstDoctorId(supabase);
      if (fallback.error) {
        return { data: null, error: fallback.error };
      }
      doctorId = fallback.data;
    }
  }

  return {
    data: {
      ...profile,
      patient_id: patientId,
      doctor_id: doctorId,
    },
    error: null,
  };
}
