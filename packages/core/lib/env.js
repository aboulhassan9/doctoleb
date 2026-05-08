/**
 * Runtime env helpers shared by browser bundles and Node unit tests.
 *
 * Vite exposes `import.meta.env`; Node tests expose `process.env`. Keeping
 * this bridge in one place prevents every boundary module from inventing its
 * own slightly different env reader.
 */

export function readRuntimeEnv(key) {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env[key];
    }
  } catch (_envError) {
    // Test/Node environments do not always expose import.meta.env.
  }

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
