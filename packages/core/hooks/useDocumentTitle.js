import { useEffect } from 'react';

/**
 * useDocumentTitle — Set the page <title> tag.
 *
 * Automatically restores the previous title on unmount.
 *
 * @param {string} title - The page title to set.
 * @param {string} [appName] - The brand/application name appended. Pass
 *   `useBrand().displayName` from callers; falls back to a neutral
 *   'Clinic Portal' label so the hook never hardcodes a tenant identity.
 */
export function useDocumentTitle(title, appName) {
  useEffect(() => {
    const brand = (typeof appName === 'string' && appName.length > 0) ? appName : 'Clinic Portal';
    const prev = document.title;
    document.title = title ? `${title} | ${brand}` : brand;
    return () => { document.title = prev; };
  }, [appName, title]);
}
