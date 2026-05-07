import { useState } from 'react';

/**
 * usePagination — Page/size/range state for list views.
 *
 * Returns page, pageSize, Supabase-compatible from/to range,
 * and a setPage function.
 *
 * @param {number} defaultSize - Items per page (default 25)
 * @returns {{ page: number, pageSize: number, from: number, to: number, setPage: (p: number) => void, reset: () => void }}
 */
export function usePagination(defaultSize = 25) {
  const [page, setPage] = useState(0);
  const [pageSize] = useState(defaultSize);

  const from = page * pageSize;
  const to = from + pageSize - 1;

  const reset = () => setPage(0);

  return { page, pageSize, from, to, setPage, reset };
}
