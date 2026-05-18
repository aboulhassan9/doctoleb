import { useState, useEffect, useCallback } from 'react';
import { doctorService } from '@/services/doctors';
import { useAuth } from '@/contexts/AuthContext';
import { logError } from '@/lib/logger';

/**
 * useDoctorProfile — Resolve the current doctor's profile from auth user.
 *
 * Extracted from DoctorDashboardPage, DoctorAppointmentsPage, etc.
 *
 * @returns {{ doctor: object|null, doctorId: string|null, loading: boolean, error: string|null }}
 */
export function useDoctorProfile() {
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const userId = user?.id || null;

  const fetch = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const { data, error: err } = await doctorService.getByUserId(userId);
      if (err || !data?.id) throw new Error('Unable to resolve doctor profile');
      setDoctor(data);
    } catch (err) {
      logError('useDoctorProfile.fetch', err);
      setError(err?.message || 'Failed to load doctor profile');
    } finally {
      setLoading(false);
    }
    // Depend on the stable doctor identity, not the user object reference,
    // which AuthProvider replaces on every SIGNED_IN / token-refresh event.
  }, [userId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { doctor, doctorId: doctor?.id || null, loading, error };
}
