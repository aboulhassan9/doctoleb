export function getErrorMessage(error, fallback = 'An unexpected error occurred') {
  if (typeof error === 'string') {
    const message = error.trim();
    return message || fallback;
  }

  if (error && typeof error === 'object') {
    if (typeof error.message === 'string') {
      const message = error.message.trim();
      if (message) return message;
    }
    if (typeof error.error === 'string') {
      const message = error.error.trim();
      if (message) return message;
    }
    if (typeof error.code === 'string') {
      const message = error.code.trim();
      if (message) return message;
    }
  }

  return fallback;
}
