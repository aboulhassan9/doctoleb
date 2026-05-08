/**
 * TenantBootstrap — Resolves the tenant Supabase connection at runtime, then
 * renders the rest of the app.
 *
 * Bootstrap order (per ADR-004):
 *   1. classify the current hostname into a surface
 *   2. call tenantResolverService.resolve({ host, surface })
 *   3. configureSupabaseClient({ url, anonKey })
 *   4. render children (which then mount AuthProvider/BrandProvider)
 *
 * Surfaces and how they map:
 *   - appSurface="patient-web" -> resolver surface "patient"
 *   - appSurface="clinic-ops"  -> resolver surface "ops"
 *
 * In DEV (`VITE_DEV_TENANT_SLUG` set, no resolver endpoint): the resolver
 * service synthesizes a connection from existing env vars and the bootstrap
 * is effectively transparent.
 *
 * @see docs/decisions/ADR-004-domain-routing-and-control-plane-contract.md
 */

import { useEffect, useState } from 'react';
import { configureSupabaseClient } from '@/lib/supabase';
import {
  classifyCurrentLocation,
  resolverSurfaceFor,
  SURFACES,
} from '@/lib/hostnameSurface';
import { tenantResolverService, RESOLVER_ERRORS } from '@/services/tenantResolver';

const APP_SURFACE_TO_RESOLVER = Object.freeze({
  'patient-web': 'patient',
  'clinic-ops': 'ops',
});

const ERROR_COPY = Object.freeze({
  [RESOLVER_ERRORS.TENANT_NOT_FOUND]: {
    title: 'Clinic not found',
    body: 'This address is not connected to any DoctoLeb clinic. Check the URL or contact the clinic owner.',
  },
  [RESOLVER_ERRORS.SURFACE_MISMATCH]: {
    title: 'Wrong portal',
    body: 'This address belongs to a different DoctoLeb portal. Visit the correct patient or staff URL.',
  },
  [RESOLVER_ERRORS.TENANT_INACTIVE]: {
    title: 'Clinic temporarily unavailable',
    body: 'This clinic is paused or in maintenance mode. Please check back soon.',
  },
  [RESOLVER_ERRORS.TENANT_RESOLVER_DOWN]: {
    title: 'Service temporarily unavailable',
    body: 'We could not reach the DoctoLeb routing service. Please try again in a moment.',
  },
  [RESOLVER_ERRORS.RESOLVER_NOT_CONFIGURED]: {
    title: 'Configuration error',
    body: 'The tenant resolver is not configured for this environment. Set VITE_TENANT_RESOLVER_URL or VITE_DEV_TENANT_SLUG.',
  },
  [RESOLVER_ERRORS.INVALID_REQUEST]: {
    title: 'Invalid request',
    body: 'The portal could not classify this hostname. Contact support.',
  },
});

function getSurfaceForApp(appSurface, classification) {
  // Trust the classification first (it knows ops-tenant vs patient-tenant).
  const fromClassification = resolverSurfaceFor(classification.surface);
  if (fromClassification) return fromClassification;
  // Fall back to the explicit prop (e.g. unified dev shell defaults to patient-web).
  return APP_SURFACE_TO_RESOLVER[appSurface] || null;
}

function ResolvingTenantSplash() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#f8fafc',
        color: '#0f172a',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        padding: '24px',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: '48px',
            height: '48px',
            border: '3px solid #e2e8f0',
            borderTopColor: '#0891b2',
            borderRadius: '50%',
            margin: '0 auto 16px',
            animation: 'doctoleb-spin 0.8s linear infinite',
          }}
        />
        <p style={{ margin: 0, fontSize: '14px', color: '#475569' }}>Connecting to your clinic…</p>
        <style>{`@keyframes doctoleb-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

function TenantUnavailable({ errorCode, classification }) {
  const copy = ERROR_COPY[errorCode] || ERROR_COPY[RESOLVER_ERRORS.TENANT_RESOLVER_DOWN];
  const showHostHint = classification?.isCustomDomain || classification?.surface === SURFACES.unknown;

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#f8fafc',
        color: '#0f172a',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        padding: '24px',
      }}
    >
      <div
        style={{
          maxWidth: '480px',
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '32px',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
        }}
      >
        <h1 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 600 }}>
          {copy.title}
        </h1>
        <p style={{ margin: '0 0 16px', fontSize: '14px', lineHeight: 1.5, color: '#475569' }}>
          {copy.body}
        </p>
        {showHostHint && classification?.host ? (
          <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', fontFamily: 'IBM Plex Mono, monospace' }}>
            Host: {classification.host}
          </p>
        ) : null}
        <p style={{ margin: '16px 0 0', fontSize: '12px', color: '#94a3b8', fontFamily: 'IBM Plex Mono, monospace' }}>
          Code: {errorCode}
        </p>
      </div>
    </div>
  );
}

/**
 * Wrap the app shell. Resolves the tenant connection before rendering
 * children, so AuthProvider/BrandProvider can call services synchronously.
 *
 * @param {{
 *   appSurface: 'patient-web' | 'clinic-ops',
 *   children: import('react').ReactNode,
 *   FallbackSplash?: import('react').ComponentType,
 *   FallbackError?: import('react').ComponentType<{ errorCode: string }>,
 * }} props
 */
export function TenantBootstrap({ appSurface, children, FallbackSplash, FallbackError }) {
  const [state, setState] = useState({ status: 'resolving' });

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    async function bootstrap() {
      const classification = classifyCurrentLocation();
      const resolverSurface = getSurfaceForApp(appSurface, classification);

      if (!resolverSurface) {
        if (isMounted) {
          setState({
            status: 'error',
            errorCode: RESOLVER_ERRORS.INVALID_REQUEST,
            classification,
          });
        }
        return;
      }

      const { data, error } = await tenantResolverService.resolve({
        host: classification.host,
        surface: resolverSurface,
        signal: controller.signal,
      });

      if (!isMounted) return;

      if (error || !data) {
        setState({
          status: 'error',
          errorCode: error || RESOLVER_ERRORS.TENANT_RESOLVER_DOWN,
          classification,
        });
        return;
      }

      try {
        configureSupabaseClient({
          url: data.supabaseUrl,
          anonKey: data.supabaseAnonKey,
        });
      } catch (configError) {
        setState({
          status: 'error',
          errorCode: RESOLVER_ERRORS.INVALID_REQUEST,
          classification,
          configErrorMessage: configError?.message,
        });
        return;
      }

      setState({
        status: 'ready',
        tenant: data,
        classification,
      });
    }

    void bootstrap();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [appSurface]);

  if (state.status === 'resolving') {
    const Splash = FallbackSplash || ResolvingTenantSplash;
    return <Splash />;
  }

  if (state.status === 'error') {
    const ErrorView = FallbackError || TenantUnavailable;
    return <ErrorView errorCode={state.errorCode} classification={state.classification} />;
  }

  return <>{children}</>;
}
