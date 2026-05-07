import { useEffect } from 'react';

/**
 * useDocumentTitle — Set the page <title> tag.
 *
 * Automatically restores the previous title on unmount.
 *
 * @param {string} title - The page title to set.
 * @param {string} appName - The brand/application name appended to the title.
 */
export function useDocumentTitle(title, appName = 'DoctoLeb') {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} | ${appName}` : appName;
    return () => { document.title = prev; };
  }, [appName, title]);
}
