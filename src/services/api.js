export const apiCall = async (fn) => {
  try {
    const { data, error, count } = await fn;
    if (error) throw error;
    return { data, count: count ?? null, error: null };
  } catch (error) {
    return { data: null, count: null, error: error?.message || 'An unexpected error occurred' };
  }
};
