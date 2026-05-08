import { useCallback, useEffect, useState } from 'react';
import { featureFlagsToEntitlementMap } from '../../lib/entitlements';
import { tenantConfigService } from '../../services/tenantConfig';

async function loadEntitlementMap(audience) {
  const result = await tenantConfigService.getFeatureFlags({ audience, pageSize: 100 });
  if (result.error) return { entitlements: {}, error: result.error };
  return { entitlements: featureFlagsToEntitlementMap(result.data), error: '' };
}

export function useEntitlements({ audience = 'staff' } = {}) {
  const [entitlements, setEntitlements] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await loadEntitlementMap(audience);
    setEntitlements(result.entitlements);
    setError(result.error);
    setLoading(false);
  }, [audience]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      const result = await loadEntitlementMap(audience);
      if (!isMounted) return;
      setEntitlements(result.entitlements);
      setError(result.error);
      setLoading(false);
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [audience]);

  return { entitlements, loading, error, reload };
}
