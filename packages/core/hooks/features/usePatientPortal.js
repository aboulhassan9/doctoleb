import { useEffect, useState } from 'react';
import { patientPortalService } from '../../services/patientPortal.js';

export function usePatientPortal(user) {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(Boolean(user?.id));
  const [error, setError] = useState(null);

  const load = async () => {
    if (!user?.id) {
      setOverview(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const result = await patientPortalService.getDashboardOverview({ user });
    setOverview(result.data || null);
    setError(result.error || null);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!user?.id) {
        if (!cancelled) {
          setOverview(null);
          setLoading(false);
          setError(null);
        }
        return;
      }

      setLoading(true);
      const result = await patientPortalService.getDashboardOverview({ user });
      if (cancelled) return;
      setOverview(result.data || null);
      setError(result.error || null);
      setLoading(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return {
    overview,
    loading,
    error,
    reload: load,
  };
}
