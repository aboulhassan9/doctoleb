import { useState, useEffect } from 'react';

/**
 * useSearch — Debounced search state.
 *
 * Returns the raw query (for controlled input) and a debounced version
 * for triggering API calls or expensive filtering.
 *
 * @param {number} debounceMs - Debounce delay in milliseconds
 * @returns {{ query: string, debouncedQuery: string, setQuery: (q: string) => void }}
 */
export function useSearch(debounceMs = 300) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), debounceMs);
    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  return { query, debouncedQuery, setQuery };
}
