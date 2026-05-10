import { isValidTenantSlug } from './hostnameSurface.js';

export const TENANT_PATH_PREFIX = '/t';

function normalizePathname(pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith('/')) return '/';
  return pathname;
}

export function parseTenantPath(pathname) {
  const normalized = normalizePathname(pathname);
  const segments = normalized.split('/').filter(Boolean);

  if (segments[0] !== 't') {
    return {
      isTenantPath: false,
      tenantSlug: null,
      basename: '',
      appPath: normalized,
      error: null,
    };
  }

  const tenantSlug = String(segments[1] || '').toLowerCase();
  if (!isValidTenantSlug(tenantSlug)) {
    return {
      isTenantPath: true,
      tenantSlug: null,
      basename: '',
      appPath: '/',
      error: 'INVALID_TENANT_SLUG',
    };
  }

  const rest = segments.slice(2);
  const appPath = rest.length > 0 ? `/${rest.join('/')}` : '/';

  return {
    isTenantPath: true,
    tenantSlug,
    basename: `${TENANT_PATH_PREFIX}/${tenantSlug}`,
    appPath,
    error: null,
  };
}

export function getCurrentTenantPath(pathname = null) {
  if (typeof pathname === 'string') return parseTenantPath(pathname);
  if (typeof window === 'undefined' || !window.location) return parseTenantPath('/');
  return parseTenantPath(window.location.pathname);
}

export function getCurrentTenantBasename(pathname = null) {
  const parsed = getCurrentTenantPath(pathname);
  return parsed.isTenantPath && !parsed.error ? parsed.basename : '';
}

export function withCurrentTenantBasename(path, pathname = null) {
  const parsed = getCurrentTenantPath(pathname);
  const normalizedPath = typeof path === 'string' && path.startsWith('/') ? path : `/${path || ''}`;
  return parsed.isTenantPath && !parsed.error ? `${parsed.basename}${normalizedPath}` : normalizedPath;
}
