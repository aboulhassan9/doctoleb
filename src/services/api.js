export const apiCall = async (fn) => {
  try {
    const { data, error } = await fn;
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error?.message || 'An unexpected error occurred' };
  }
};
