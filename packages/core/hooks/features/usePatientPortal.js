import { useCallback, useEffect, useState } from 'react';
import { patientPortalService } from '../../services/patientPortal.js';

export function usePatientPortal(user) {
  const userId = user?.id || null;
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!userId) {
      setOverview(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const result = await patientPortalService.getDashboardOverview({ user: { id: userId } });
    setOverview(result.data || null);
    setError(result.error || null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!userId) {
        if (!cancelled) {
          setOverview(null);
          setLoading(false);
          setError(null);
        }
        return;
      }

      setLoading(true);
      const result = await patientPortalService.getDashboardOverview({ user: { id: userId } });
      if (cancelled) return;
      setOverview(result.data || null);
      setError(result.error || null);
      setLoading(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
    // Depend on the stable patient identity, not the user object reference,
    // which AuthProvider replaces on every SIGNED_IN / token-refresh event.
  }, [userId]);

  return {
    overview,
    loading,
    error,
    reload: load,
  };
}
