import { useEffect } from 'react';

/**
 * useDocumentTitle — Set the page <title> tag.
 *
 * Automatically restores the previous title on unmount.
 *
 * @param {string} title - The title to set (will be appended with " | DoctoLeb")
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} | DoctoLeb` : 'DoctoLeb';
    return () => { document.title = prev; };
  }, [title]);
}
