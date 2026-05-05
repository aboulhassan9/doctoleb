export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export function normalizePagination(options = {}) {
  const page = Math.max(0, Number(options.page) || 0);
  const requestedPageSize = Number(options.pageSize) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requestedPageSize));

  return { page, pageSize };
}

export function paginateQuery(query, options = {}) {
  const { page, pageSize } = normalizePagination(options);
  const from = page * pageSize;
  const to = from + pageSize - 1;

  return query.range(from, to);
}
