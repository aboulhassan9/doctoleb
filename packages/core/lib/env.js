/**
 * Runtime env helpers shared by browser bundles and Node unit tests.
 *
 * Vite exposes `import.meta.env`; Node tests expose `process.env`. Keeping
 * this bridge in one place prevents every boundary module from inventing its
 * own slightly different env reader.
 */

function readBrowserEnv(key) {
  try {
    switch (key) {
      case 'DEV':
        return import.meta.env.DEV;
      case 'PROD':
        return import.meta.env.PROD;
      case 'MODE':
        return import.meta.env.MODE;
      case 'VITE_TENANT_RESOLVER_URL':
        return import.meta.env.VITE_TENANT_RESOLVER_URL;
      case 'VITE_TENANT_RESOLVER_TIMEOUT_MS':
        return import.meta.env.VITE_TENANT_RESOLVER_TIMEOUT_MS;
      case 'VITE_PUBLIC_PRIMARY_DOMAIN':
        return import.meta.env.VITE_PUBLIC_PRIMARY_DOMAIN;
      case 'VITE_MARKETING_HOSTS':
        return import.meta.env.VITE_MARKETING_HOSTS;
      case 'VITE_CONTROL_PLANE_HOSTS':
        return import.meta.env.VITE_CONTROL_PLANE_HOSTS;
      case 'VITE_PATIENT_TENANT_HOSTS':
        return import.meta.env.VITE_PATIENT_TENANT_HOSTS;
      case 'VITE_OPS_TENANT_HOSTS':
        return import.meta.env.VITE_OPS_TENANT_HOSTS;
      case 'VITE_CLINIC_OPS_URL':
        return import.meta.env.VITE_CLINIC_OPS_URL;
      case 'VITE_PATIENT_WEB_URL':
        return import.meta.env.VITE_PATIENT_WEB_URL;
      case 'VITE_SUPABASE_URL':
        if (import.meta.env.DEV) return import.meta.env.VITE_SUPABASE_URL;
        return undefined;
      case 'VITE_SUPABASE_ANON_KEY':
        if (import.meta.env.DEV) return import.meta.env.VITE_SUPABASE_ANON_KEY;
        return undefined;
      case 'VITE_DEV_TENANT_SLUG':
        if (import.meta.env.DEV) return import.meta.env.VITE_DEV_TENANT_SLUG;
        return undefined;
      case 'VITE_DEV_SCHEMA_VERSION':
        if (import.meta.env.DEV) return import.meta.env.VITE_DEV_SCHEMA_VERSION;
        return undefined;
      default:
        return undefined;
    }
  } catch (_envError) {
    // Test/Node environments do not always expose import.meta.env.
    return undefined;
  }
}

export function readRuntimeEnv(key) {
  const browserValue = readBrowserEnv(key);
  if (browserValue !== undefined) return browserValue;

  const nodeProcess = (typeof globalThis !== 'undefined' && globalThis.process) || null;
  return nodeProcess?.env?.[key];
}

export function isRuntimeDev() {
  return Boolean(readRuntimeEnv('DEV'))
    || readRuntimeEnv('MODE') === 'development'
    || readRuntimeEnv('NODE_ENV') === 'development';
}

export function isRuntimeProd() {
  return Boolean(readRuntimeEnv('PROD'))
    || readRuntimeEnv('MODE') === 'production'
    || readRuntimeEnv('NODE_ENV') === 'production';
}
