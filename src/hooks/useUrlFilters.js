import { useSearchParams } from 'react-router-dom';
import { useCallback } from 'react';

/**
 * useUrlFilters — URL-driven filter state for list pages.
 *
 * Stores filters and pagination in URL search params so that:
 * - Users can bookmark filtered views
 * - Back button works correctly
 * - Links can be shared with specific filter state
 *
 * Automatically resets page to 0 when other filters change.
 *
 * @param {Record<string, string>} defaults - Default values for filters
 * @returns {{ filters: Record<string, string|number>, setFilter: (key: string, value: string) => void, resetFilters: () => void }}
 */
export function useUrlFilters(defaults = {}) {
  const [params, setParams] = useSearchParams();

  const filters = {
    status: params.get('status') || defaults.status || 'all',
    page: parseInt(params.get('page') || '0', 10),
    q: params.get('q') || '',
    sort: params.get('sort') || defaults.sort || '',
    tab: params.get('tab') || defaults.tab || '',
  };

  const setFilter = useCallback((key, value) => {
    const next = new URLSearchParams(params);

    if (value === defaults[key] || !value || value === 'all') {
      next.delete(key);
    } else {
      next.set(key, String(value));
    }

    // Reset page when changing any filter other than page itself
    if (key !== 'page') {
      next.delete('page');
    }

    setParams(next, { replace: true });
  }, [params, setParams, defaults]);

  const resetFilters = useCallback(() => {
    setParams({}, { replace: true });
  }, [setParams]);

  return { filters, setFilter, resetFilters };
}
