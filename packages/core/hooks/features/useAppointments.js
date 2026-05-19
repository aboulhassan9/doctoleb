import { useState, useEffect, useCallback } from 'react';
import { appointmentService } from '@/services/appointments';
import { doctorService } from '@/services/doctors';
import { normalizeAppointments } from '@/lib/appointments';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { logError } from '@/lib/logger';

/**
 * useAppointments — Fetch appointments for current doctor or all (secretary).
 *
 * Extracted from DoctorAppointmentsPage, AppointmentsPage, PreDoctorAppointmentsPage.
 *
 * @param {{ doctorId?: string, mode?: 'doctor'|'all' }} options
 * @returns {{ appointments: Array, raw: Array, loading: boolean, error: string|null, refresh: () => Promise<void> }}
 */
export function useAppointments({ doctorId: explicitDoctorId, mode = 'doctor' } = {}) {
  const [appointments, setAppointments] = useState([]);
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const userId = user?.id || null;
  const { showToast } = useToast();

  // Key on the stable user id, not the user object reference, which
  // AuthProvider replaces on every SIGNED_IN / token-refresh event.
  const fetch = useCallback(async () => {
    if (mode !== 'all' && !explicitDoctorId && !userId) {
      setRaw([]);
      setAppointments([]);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (mode === 'all') {
        const { data, error: err } = await appointmentService.getAll();
        if (err) throw new Error(err.message || 'Failed to load appointments');
        const normalized = normalizeAppointments(data || []);
        setRaw(data || []);
        setAppointments(normalized);
        return;
      }

      // Doctor mode: resolve doctor ID from auth user
      let dId = explicitDoctorId;
      if (!dId && userId) {
        const { data: doctor, error: dErr } = await doctorService.getByUserId(userId);
        if (dErr || !doctor?.id) throw new Error('Unable to resolve doctor profile');
        dId = doctor.id;
      }
      if (!dId) throw new Error('No doctor ID available');

      const { data, error: err } = await appointmentService.getByDoctorId(dId);
      if (err) throw new Error(err.message || 'Failed to load appointments');
      const normalized = normalizeAppointments(data || []);
      setRaw(data || []);
      setAppointments(normalized);
    } catch (err) {
      const msg = err?.message || 'Failed to load appointments';
      logError('useAppointments.fetch', err);
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [explicitDoctorId, mode, userId, showToast]);

  useEffect(() => { fetch(); }, [fetch]);

  return { appointments, raw, loading, error, refresh: fetch };
}
