export const apiCall = async (fn) => {
  try {
    const { data, error } = await fn;
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error?.message || 'An unexpected error occurred' };
  }
};

const normalizePaginationOptions = ({ page = 1, pageSize = 25, maxPageSize = 100 } = {}) => {
  const normalizedPage = Math.max(1, Number.parseInt(page, 10) || 1);
  const requestedPageSize = Number.parseInt(pageSize, 10) || 25;
  const normalizedPageSize = Math.min(Math.max(1, requestedPageSize), maxPageSize);

  return {
    page: normalizedPage,
    pageSize: normalizedPageSize,
    from: (normalizedPage - 1) * normalizedPageSize,
    to: normalizedPage * normalizedPageSize - 1,
  };
};

export const apiPaged = async (query, options = {}) => {
  const { page, pageSize, from, to } = normalizePaginationOptions(options);

  try {
    const { data, error, count } = await query.range(from, to);
    if (error) throw error;

    const totalItems = typeof count === 'number' ? count : data?.length ?? 0;
    const totalPages = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 0;

    return {
      data: data ?? [],
      meta: {
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages,
        },
      },
      error: null,
    };
  } catch (error) {
    return {
      data: [],
      meta: {
        pagination: {
          page,
          pageSize,
          totalItems: 0,
          totalPages: 0,
        },
      },
      error: error?.message || 'An unexpected error occurred',
    };
  }
};
