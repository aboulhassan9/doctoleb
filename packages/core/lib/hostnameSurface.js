/**
 * hostnameSurface.js — Pure-function classifier for hostnames.
 *
 * Maps `window.location.hostname[:port]` to one of seven surface types and
 * extracts the tenant slug when present. `classifyHostname` is a pure function;
 * `classifyCurrentLocation` layers in runtime env host allowlists for
 * deployment platforms such as Vercel.
 *
 * @see docs/decisions/ADR-004-domain-routing-and-control-plane-contract.md
 *
 * Classification table (default primaryDomain = 'doctoleb.com'):
 *   doctoleb.com / www.doctoleb.com   -> marketing
 *   console.doctoleb.com              -> control-plane
 *   {slug}.doctoleb.com               -> patient-tenant, tenantSlug = slug
 *   {slug}.ops.doctoleb.com           -> ops-tenant, tenantSlug = slug
 *   localhost:3001 / 127.0.0.1:3001   -> local-patient
 *   localhost:3002 / 127.0.0.1:3002   -> local-ops
 *   localhost (other ports / no port) -> local-unknown
 *   configured deployment hosts         -> explicit marketing/control/tenant surface
 *   anything else                      -> custom-domain (surface inferred from `ops.` prefix; resolver lookup required)
 */

import { readRuntimeEnv } from './env.js';

// ── Constants ──

export const SURFACES = Object.freeze({
  marketing: 'marketing',
  controlPlane: 'control-plane',
  patientTenant: 'patient-tenant',
  opsTenant: 'ops-tenant',
  customDomain: 'custom-domain',
  customDomainOps: 'custom-domain-ops',
  localPatient: 'local-patient',
  localOps: 'local-ops',
  localUnknown: 'local-unknown',
  unknown: 'unknown',
});

export const DEFAULT_PRIMARY_DOMAIN = 'doctoleb.com';

const DEPLOYMENT_HOST_ENV = Object.freeze({
  primaryDomain: 'VITE_PUBLIC_PRIMARY_DOMAIN',
  marketingHosts: 'VITE_MARKETING_HOSTS',
  controlPlaneHosts: 'VITE_CONTROL_PLANE_HOSTS',
  patientTenantHosts: 'VITE_PATIENT_TENANT_HOSTS',
  opsTenantHosts: 'VITE_OPS_TENANT_HOSTS',
});

const RESERVED_TENANT_SLUGS = Object.freeze(new Set([
  'www',
  'console',
  'admin',
  'api',
  'app',
  'ops',
  'mail',
  'docs',
  'status',
]));

const LOCAL_PATIENT_PORTS = Object.freeze(new Set(['3001']));
const LOCAL_OPS_PORTS = Object.freeze(new Set(['3002']));
const LOCAL_HOSTS = Object.freeze(new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']));

// ── Helpers ──

function splitHostnameAndPort(input) {
  if (typeof input !== 'string' || input.length === 0) {
    return { hostname: '', port: '' };
  }

  // IPv6 form: [::1]:3001
  if (input.startsWith('[')) {
    const closeIdx = input.indexOf(']');
    if (closeIdx === -1) return { hostname: input, port: '' };
    const hostname = input.slice(1, closeIdx);
    const rest = input.slice(closeIdx + 1);
    const port = rest.startsWith(':') ? rest.slice(1) : '';
    return { hostname, port };
  }

  // Strip protocol if accidentally included
  let normalized = input.toLowerCase();
  if (normalized.startsWith('http://')) normalized = normalized.slice(7);
  else if (normalized.startsWith('https://')) normalized = normalized.slice(8);

  // Strip pathname/query/hash
  const pathIdx = normalized.search(/[/?#]/);
  if (pathIdx !== -1) normalized = normalized.slice(0, pathIdx);

  const lastColon = normalized.lastIndexOf(':');
  if (lastColon === -1) return { hostname: normalized, port: '' };

  const portCandidate = normalized.slice(lastColon + 1);
  if (/^\d+$/.test(portCandidate)) {
    return { hostname: normalized.slice(0, lastColon), port: portCandidate };
  }

  return { hostname: normalized, port: '' };
}

function normalizeConfiguredHost(input) {
  const value = String(input || '')
    .replace(/\\[rn]/g, '')
    .trim();
  if (!value) return '';

  const { hostname, port } = splitHostnameAndPort(value);
  if (!hostname) return '';

  return port ? `${hostname}:${port}` : hostname;
}

function normalizePrimaryDomain(input) {
  const value = String(input || '').trim();
  if (!value) return DEFAULT_PRIMARY_DOMAIN;

  const { hostname } = splitHostnameAndPort(value);
  return hostname || DEFAULT_PRIMARY_DOMAIN;
}

function appendConfiguredHosts(input, hosts) {
  if (!input) return;

  if (Array.isArray(input) || input instanceof Set) {
    for (const value of input) {
      appendConfiguredHosts(value, hosts);
    }
    return;
  }

  if (typeof input === 'string') {
    for (const value of input.split(',')) {
      const host = normalizeConfiguredHost(value);
      if (host) hosts.add(host);
    }
    return;
  }

  const host = normalizeConfiguredHost(input);
  if (host) hosts.add(host);
}

function configuredHostSet(...inputs) {
  const hosts = new Set();
  for (const input of inputs) {
    appendConfiguredHosts(input, hosts);
  }
  return hosts;
}

function configuredHostMatches(hosts, hostname, port) {
  if (!hosts || hosts.size === 0 || !hostname) return false;
  if (hosts.has(hostname)) return true;
  if (port && hosts.has(`${hostname}:${port}`)) return true;
  return false;
}

function currentLocationOptions(options) {
  return {
    ...options,
    primaryDomain: options.primaryDomain
      || readRuntimeEnv(DEPLOYMENT_HOST_ENV.primaryDomain)
      || DEFAULT_PRIMARY_DOMAIN,
    marketingHosts: [
      readRuntimeEnv(DEPLOYMENT_HOST_ENV.marketingHosts),
      options.marketingHosts,
    ],
    controlPlaneHosts: [
      readRuntimeEnv(DEPLOYMENT_HOST_ENV.controlPlaneHosts),
      options.controlPlaneHosts,
    ],
    patientTenantHosts: [
      readRuntimeEnv(DEPLOYMENT_HOST_ENV.patientTenantHosts),
      options.patientTenantHosts,
    ],
    opsTenantHosts: [
      readRuntimeEnv(DEPLOYMENT_HOST_ENV.opsTenantHosts),
      options.opsTenantHosts,
    ],
  };
}

function isLocalHostname(hostname) {
  if (!hostname) return false;
  if (LOCAL_HOSTS.has(hostname)) return true;
  if (hostname.endsWith('.local')) return true;
  if (hostname.endsWith('.localhost')) return true;
  return false;
}

function endsWithDomain(hostname, primaryDomain) {
  if (!hostname || !primaryDomain) return false;
  return hostname === primaryDomain || hostname.endsWith(`.${primaryDomain}`);
}

function stripPrimaryDomain(hostname, primaryDomain) {
  if (hostname === primaryDomain) return '';
  if (hostname.endsWith(`.${primaryDomain}`)) {
    return hostname.slice(0, -1 * (primaryDomain.length + 1));
  }
  return null;
}

function isValidTenantSlug(slug) {
  if (typeof slug !== 'string') return false;
  if (slug.length === 0 || slug.length > 63) return false;
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) return false;
  if (RESERVED_TENANT_SLUGS.has(slug)) return false;
  return true;
}

// ── Public API ──

/**
 * Classify a browser hostname (with optional port) into a surface descriptor.
 *
 * @param {string} hostnameWithPort — e.g. `dr-hassan.doctoleb.com`, `localhost:3001`
 * @param {object} [options]
 * @param {string} [options.primaryDomain='doctoleb.com'] — DoctoLeb's canonical apex.
 * @param {string|string[]} [options.marketingHosts] — exact deploy hosts that serve the doctor marketing site.
 * @param {string|string[]} [options.controlPlaneHosts] — exact deploy hosts that serve the SaaS console.
 * @param {string|string[]} [options.patientTenantHosts] — exact deploy hosts that must resolve as patient tenant traffic.
 * @param {string|string[]} [options.opsTenantHosts] — exact deploy hosts that must resolve as clinic-ops tenant traffic.
 * @returns {{
 *   surface: string,
 *   tenantSlug: string|null,
 *   isLocal: boolean,
 *   isCustomDomain: boolean,
 *   hostname: string,
 *   port: string,
 *   primaryDomain: string,
 * }}
 */
export function classifyHostname(hostnameWithPort, options = {}) {
  const primaryDomain = normalizePrimaryDomain(options.primaryDomain || DEFAULT_PRIMARY_DOMAIN);
  const { hostname, port } = splitHostnameAndPort(hostnameWithPort);

  if (!hostname) {
    return {
      surface: SURFACES.unknown,
      tenantSlug: null,
      isLocal: false,
      isCustomDomain: false,
      hostname: '',
      port: '',
      primaryDomain,
    };
  }

  const marketingHosts = configuredHostSet(options.marketingHosts);
  const controlPlaneHosts = configuredHostSet(options.controlPlaneHosts);
  const patientTenantHosts = configuredHostSet(options.patientTenantHosts);
  const opsTenantHosts = configuredHostSet(options.opsTenantHosts);
  const isLocal = isLocalHostname(hostname);

  if (configuredHostMatches(marketingHosts, hostname, port)) {
    return {
      surface: SURFACES.marketing,
      tenantSlug: null,
      isLocal,
      isCustomDomain: false,
      hostname,
      port,
      primaryDomain,
    };
  }

  if (configuredHostMatches(controlPlaneHosts, hostname, port)) {
    return {
      surface: SURFACES.controlPlane,
      tenantSlug: null,
      isLocal,
      isCustomDomain: false,
      hostname,
      port,
      primaryDomain,
    };
  }

  if (configuredHostMatches(patientTenantHosts, hostname, port)) {
    return {
      surface: SURFACES.customDomain,
      tenantSlug: null,
      isLocal,
      isCustomDomain: true,
      hostname,
      port,
      primaryDomain,
    };
  }

  if (configuredHostMatches(opsTenantHosts, hostname, port)) {
    return {
      surface: SURFACES.customDomainOps,
      tenantSlug: null,
      isLocal,
      isCustomDomain: true,
      hostname,
      port,
      primaryDomain,
    };
  }

  // Local hosts
  if (isLocal) {
    let surface = SURFACES.localUnknown;
    if (LOCAL_PATIENT_PORTS.has(port)) surface = SURFACES.localPatient;
    else if (LOCAL_OPS_PORTS.has(port)) surface = SURFACES.localOps;

    return {
      surface,
      tenantSlug: null,
      isLocal: true,
      isCustomDomain: false,
      hostname,
      port,
      primaryDomain,
    };
  }

  // Primary domain family
  if (endsWithDomain(hostname, primaryDomain)) {
    const subdomain = stripPrimaryDomain(hostname, primaryDomain);

    // doctoleb.com or www.doctoleb.com -> marketing
    if (subdomain === '' || subdomain === 'www') {
      return {
        surface: SURFACES.marketing,
        tenantSlug: null,
        isLocal: false,
        isCustomDomain: false,
        hostname,
        port,
        primaryDomain,
      };
    }

    // console.doctoleb.com -> control-plane
    if (subdomain === 'console') {
      return {
        surface: SURFACES.controlPlane,
        tenantSlug: null,
        isLocal: false,
        isCustomDomain: false,
        hostname,
        port,
        primaryDomain,
      };
    }

    // {slug}.ops.doctoleb.com -> ops-tenant
    if (subdomain.endsWith('.ops')) {
      const slug = subdomain.slice(0, subdomain.length - '.ops'.length);
      if (isValidTenantSlug(slug)) {
        return {
          surface: SURFACES.opsTenant,
          tenantSlug: slug,
          isLocal: false,
          isCustomDomain: false,
          hostname,
          port,
          primaryDomain,
        };
      }
    }

    // {slug}.doctoleb.com -> patient-tenant (single label only)
    if (!subdomain.includes('.') && isValidTenantSlug(subdomain)) {
      return {
        surface: SURFACES.patientTenant,
        tenantSlug: subdomain,
        isLocal: false,
        isCustomDomain: false,
        hostname,
        port,
        primaryDomain,
      };
    }

    // Anything else under primaryDomain (e.g. status.doctoleb.com) -> unknown
    return {
      surface: SURFACES.unknown,
      tenantSlug: null,
      isLocal: false,
      isCustomDomain: false,
      hostname,
      port,
      primaryDomain,
    };
  }

  // Custom domain — surface determined by `ops.` prefix; resolver lookup required for tenantSlug
  const isOpsCustom = hostname.startsWith('ops.');
  return {
    surface: isOpsCustom ? SURFACES.customDomainOps : SURFACES.customDomain,
    tenantSlug: null,
    isLocal: false,
    isCustomDomain: true,
    hostname,
    port,
    primaryDomain,
  };
}

/**
 * Map a classified surface to the simple two-value surface that the resolver
 * endpoint understands. Marketing/control-plane/unknown return null because
 * those surfaces never call the tenant resolver.
 *
 * @param {string} surface — value from SURFACES
 * @returns {'patient' | 'ops' | null}
 */
export function resolverSurfaceFor(surface) {
  switch (surface) {
    case SURFACES.patientTenant:
    case SURFACES.localPatient:
    case SURFACES.customDomain:
      return 'patient';
    case SURFACES.opsTenant:
    case SURFACES.localOps:
    case SURFACES.customDomainOps:
      return 'ops';
    default:
      return null;
  }
}

/**
 * Convenience: returns true when the surface needs the resolver to load a
 * tenant Supabase client. Marketing/control-plane do not.
 */
export function needsTenantResolution(surface) {
  return resolverSurfaceFor(surface) !== null;
}

/**
 * Convenience: classify the current browser location. Returns the same shape
 * as classifyHostname plus a synthesized `host` field suitable for passing
 * straight to the resolver endpoint.
 *
 * @param {object} [options] — same as classifyHostname
 * @returns same shape as classifyHostname plus { host }
 */
export function classifyCurrentLocation(options = {}) {
  const runtimeOptions = currentLocationOptions(options);

  if (typeof window === 'undefined' || !window.location) {
    return {
      ...classifyHostname('', runtimeOptions),
      host: '',
    };
  }
  const host = window.location.host;
  return {
    ...classifyHostname(host, runtimeOptions),
    host,
  };
}
