/**
 * Unit tests for packages/core/services/tenantResolver.js
 *
 * Run via: npm run test:unit
 * Uses Node's built-in test runner. Mocks globalThis.fetch and process.env
 * to exercise both the HTTP path and the DEV fallback.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  tenantResolverService,
  clearResolverCache,
  RESOLVER_ERRORS,
} from '../../packages/core/services/tenantResolver.js';

// ── Test helpers ──

const ENV_KEYS = [
  'NODE_ENV',
  'MODE',
  'DEV',
  'PROD',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_DEV_TENANT_SLUG',
  'VITE_DEV_SCHEMA_VERSION',
  'VITE_TENANT_RESOLVER_URL',
  'VITE_TENANT_RESOLVER_TIMEOUT_MS',
];

function snapshotEnv() {
  const snap = {};
  for (const k of ENV_KEYS) snap[k] = process.env[k];
  return snap;
}

function restoreEnv(snap) {
  for (const k of ENV_KEYS) {
    if (snap[k] === undefined) delete process.env[k];
    else process.env[k] = snap[k];
  }
}

function setDevEnv() {
  process.env.NODE_ENV = 'development';
  process.env.VITE_SUPABASE_URL = 'https://devtenantref01234567.supabase.co';
  process.env.VITE_SUPABASE_ANON_KEY = 'dev-anon-key-aaaaaa';
}

function setProdEnv() {
  process.env.NODE_ENV = 'production';
  delete process.env.VITE_SUPABASE_URL;
  delete process.env.VITE_SUPABASE_ANON_KEY;
}

function mockFetch(handler) {
  globalThis.fetch = async (url, init) => handler(url, init);
}

function mockFetchOk(payload) {
  mockFetch(async () => new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }));
}

function mockFetchStatus(status, payload) {
  mockFetch(async () => new Response(JSON.stringify(payload ?? { data: null, error: 'X' }), {
    status,
    headers: { 'content-type': 'application/json' },
  }));
}

function mockFetchNetworkError() {
  mockFetch(async () => { throw new TypeError('network error'); });
}

let envSnap;
let originalFetch;

beforeEach(() => {
  envSnap = snapshotEnv();
  originalFetch = globalThis.fetch;
  clearResolverCache();
});

afterEach(() => {
  restoreEnv(envSnap);
  globalThis.fetch = originalFetch;
  clearResolverCache();
});

// ── Validation ──

describe('tenantResolverService.resolve — validation', () => {
  it('missing host → INVALID_REQUEST', async () => {
    const r = await tenantResolverService.resolve({ surface: 'patient' });
    assert.equal(r.error, RESOLVER_ERRORS.INVALID_REQUEST);
    assert.equal(r.data, null);
  });

  it('empty host → INVALID_REQUEST', async () => {
    const r = await tenantResolverService.resolve({ host: '', surface: 'patient' });
    assert.equal(r.error, RESOLVER_ERRORS.INVALID_REQUEST);
  });

  it('invalid surface → INVALID_REQUEST', async () => {
    const r = await tenantResolverService.resolve({ host: 'x.com', surface: 'admin' });
    assert.equal(r.error, RESOLVER_ERRORS.INVALID_REQUEST);
  });

  it('null surface → INVALID_REQUEST', async () => {
    const r = await tenantResolverService.resolve({ host: 'x.com', surface: null });
    assert.equal(r.error, RESOLVER_ERRORS.INVALID_REQUEST);
  });

  it('invalid slug → INVALID_REQUEST', async () => {
    const r = await tenantResolverService.resolve({ host: 'x.com', surface: 'patient', slug: 'bad_slug' });
    assert.equal(r.error, RESOLVER_ERRORS.INVALID_REQUEST);
  });
});

// ── DEV fallback ──

describe('tenantResolverService.resolve — DEV fallback', () => {
  it('synthesizes tenant from env when no resolver URL configured', async () => {
    setDevEnv();
    delete process.env.VITE_TENANT_RESOLVER_URL;

    const r = await tenantResolverService.resolve({
      host: 'localhost:3001',
      surface: 'patient',
    });

    assert.equal(r.error, null);
    assert.ok(r.data);
    assert.equal(r.data.surface, 'patient');
    assert.equal(r.data.supabaseUrl, 'https://devtenantref01234567.supabase.co');
    assert.equal(r.data.supabaseAnonKey, 'dev-anon-key-aaaaaa');
    assert.equal(r.data.slug, 'dev'); // default when VITE_DEV_TENANT_SLUG unset
    assert.ok(r.data.tenantId.startsWith('dev-'));
  });

  it('uses VITE_DEV_TENANT_SLUG when set', async () => {
    setDevEnv();
    process.env.VITE_DEV_TENANT_SLUG = 'dr-custom';
    delete process.env.VITE_TENANT_RESOLVER_URL;

    const r = await tenantResolverService.resolve({
      host: 'dr-custom.localhost',
      surface: 'ops',
    });

    assert.equal(r.error, null);
    assert.equal(r.data.slug, 'dr-custom');
    assert.equal(r.data.tenantId, 'dev-dr-custom');
    assert.equal(r.data.surface, 'ops');
  });

  it('uses the requested path slug for DEV fallback when provided', async () => {
    setDevEnv();
    process.env.VITE_DEV_TENANT_SLUG = 'ignored-env-slug';
    delete process.env.VITE_TENANT_RESOLVER_URL;

    const r = await tenantResolverService.resolve({
      host: 'localhost:3001',
      surface: 'patient',
      slug: 'assad',
    });

    assert.equal(r.error, null);
    assert.equal(r.data.slug, 'assad');
    assert.equal(r.data.tenantId, 'dev-assad');
  });

  it('returns RESOLVER_NOT_CONFIGURED when env is missing in dev', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.VITE_SUPABASE_ANON_KEY;
    delete process.env.VITE_TENANT_RESOLVER_URL;

    const r = await tenantResolverService.resolve({
      host: 'x.com',
      surface: 'patient',
    });

    assert.equal(r.data, null);
    assert.equal(r.error, RESOLVER_ERRORS.RESOLVER_NOT_CONFIGURED);
  });
});

// ── PROD fail-closed ──

describe('tenantResolverService.resolve — PROD fail-closed', () => {
  it('PROD without resolver URL and without DEV env → RESOLVER_NOT_CONFIGURED', async () => {
    setProdEnv();
    delete process.env.VITE_TENANT_RESOLVER_URL;

    const r = await tenantResolverService.resolve({
      host: 'dr-x.doctoleb.com',
      surface: 'patient',
    });

    assert.equal(r.data, null);
    assert.equal(r.error, RESOLVER_ERRORS.RESOLVER_NOT_CONFIGURED);
  });

  it('PROD with env vars present should NOT use them as fallback', async () => {
    setProdEnv();
    process.env.VITE_SUPABASE_URL = 'https://leakedinprod01234567.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'leaked-anon';
    delete process.env.VITE_TENANT_RESOLVER_URL;

    const r = await tenantResolverService.resolve({
      host: 'dr-x.doctoleb.com',
      surface: 'patient',
    });

    // PROD must NOT invoke the env fallback even when env vars exist.
    assert.equal(r.data, null);
    assert.equal(r.error, RESOLVER_ERRORS.RESOLVER_NOT_CONFIGURED);
  });
});

// ── HTTP success path ──

describe('tenantResolverService.resolve — HTTP success', () => {
  const sampleData = {
    tenantId: 'tenant-uuid-1',
    slug: 'dr-hassan',
    surface: 'patient',
    status: 'active',
    supabaseUrl: 'https://hassantenantref0123.supabase.co',
    supabaseAnonKey: 'hassan-anon-key',
    schemaVersion: '20260507',
    canonicalHost: 'dr-hassan.doctoleb.com',
  };

  it('200 with envelope → returns data', async () => {
    setProdEnv();
    process.env.VITE_TENANT_RESOLVER_URL = 'https://control.example.com/tenant-resolve';
    mockFetchOk({ data: sampleData, error: null });

    const r = await tenantResolverService.resolve({
      host: 'dr-hassan.doctoleb.com',
      surface: 'patient',
    });

    assert.equal(r.error, null);
    assert.deepEqual(r.data, sampleData);
  });

  it('200 with flat-object payload (legacy) is tolerated', async () => {
    setProdEnv();
    process.env.VITE_TENANT_RESOLVER_URL = 'https://control.example.com/tenant-resolve';
    mockFetchOk(sampleData);

    const r = await tenantResolverService.resolve({
      host: 'dr-hassan.doctoleb.com',
      surface: 'patient',
    });

    assert.equal(r.error, null);
    assert.equal(r.data.tenantId, 'tenant-uuid-1');
  });

  it('builds the resolver URL correctly', async () => {
    setProdEnv();
    process.env.VITE_TENANT_RESOLVER_URL = 'https://control.example.com/tenant-resolve/';
    let calledUrl = null;
    mockFetch(async (url) => {
      calledUrl = String(url);
      return new Response(JSON.stringify({ data: sampleData, error: null }), { status: 200 });
    });

    await tenantResolverService.resolve({
      host: 'dr-hassan.doctoleb.com',
      surface: 'ops',
    });

    assert.ok(calledUrl);
    const parsed = new URL(calledUrl);
    assert.equal(parsed.searchParams.get('host'), 'dr-hassan.doctoleb.com');
    assert.equal(parsed.searchParams.get('surface'), 'ops');
    assert.equal(parsed.pathname, '/tenant-resolve');
  });

  it('adds slug to the resolver URL for no-domain tenant path routing', async () => {
    setProdEnv();
    process.env.VITE_TENANT_RESOLVER_URL = 'https://control.example.com/tenant-resolve/';
    let calledUrl = null;
    mockFetch(async (url) => {
      calledUrl = String(url);
      return new Response(JSON.stringify({ data: sampleData, error: null }), { status: 200 });
    });

    await tenantResolverService.resolve({
      host: 'doctoleb-patient-web.vercel.app',
      surface: 'patient',
      slug: 'dr-hassan',
    });

    assert.ok(calledUrl);
    const parsed = new URL(calledUrl);
    assert.equal(parsed.searchParams.get('host'), 'doctoleb-patient-web.vercel.app');
    assert.equal(parsed.searchParams.get('surface'), 'patient');
    assert.equal(parsed.searchParams.get('slug'), 'dr-hassan');
    assert.equal(parsed.pathname, '/tenant-resolve');
  });

  it('uses an abort signal for resolver timeout protection', async () => {
    setProdEnv();
    process.env.VITE_TENANT_RESOLVER_URL = 'https://control.example.com/tenant-resolve';
    process.env.VITE_TENANT_RESOLVER_TIMEOUT_MS = '1500';

    let fetchSignal = null;
    mockFetch(async (_url, init) => {
      fetchSignal = init.signal;
      return new Response(JSON.stringify({ data: sampleData, error: null }), { status: 200 });
    });

    const r = await tenantResolverService.resolve({
      host: 'dr-hassan.doctoleb.com',
      surface: 'patient',
    });

    assert.equal(r.error, null);
    assert.ok(fetchSignal);
    assert.equal(fetchSignal.aborted, false);
  });
});

// ── HTTP error mapping ──

describe('tenantResolverService.resolve — HTTP error mapping', () => {
  it('404 → TENANT_NOT_FOUND', async () => {
    setProdEnv();
    process.env.VITE_TENANT_RESOLVER_URL = 'https://control.example.com/tenant-resolve';
    mockFetchStatus(404, { data: null, error: 'TENANT_NOT_FOUND' });

    const r = await tenantResolverService.resolve({ host: 'nope.com', surface: 'patient' });
    assert.equal(r.error, RESOLVER_ERRORS.TENANT_NOT_FOUND);
    assert.equal(r.data, null);
  });

  it('403 → SURFACE_MISMATCH', async () => {
    setProdEnv();
    process.env.VITE_TENANT_RESOLVER_URL = 'https://control.example.com/tenant-resolve';
    mockFetchStatus(403);

    const r = await tenantResolverService.resolve({ host: 'x.com', surface: 'patient' });
    assert.equal(r.error, RESOLVER_ERRORS.SURFACE_MISMATCH);
  });

  it('423 → TENANT_INACTIVE', async () => {
    setProdEnv();
    process.env.VITE_TENANT_RESOLVER_URL = 'https://control.example.com/tenant-resolve';
    mockFetchStatus(423);

    const r = await tenantResolverService.resolve({ host: 'x.com', surface: 'patient' });
    assert.equal(r.error, RESOLVER_ERRORS.TENANT_INACTIVE);
  });

  it('503 → TENANT_RESOLVER_DOWN', async () => {
    setProdEnv();
    process.env.VITE_TENANT_RESOLVER_URL = 'https://control.example.com/tenant-resolve';
    mockFetchStatus(503);

    const r = await tenantResolverService.resolve({ host: 'x.com', surface: 'patient' });
    assert.equal(r.error, RESOLVER_ERRORS.TENANT_RESOLVER_DOWN);
  });

  it('network exception → TENANT_RESOLVER_DOWN', async () => {
    setProdEnv();
    process.env.VITE_TENANT_RESOLVER_URL = 'https://control.example.com/tenant-resolve';
    mockFetchNetworkError();

    const r = await tenantResolverService.resolve({ host: 'x.com', surface: 'patient' });
    assert.equal(r.error, RESOLVER_ERRORS.TENANT_RESOLVER_DOWN);
  });

  it('unparseable JSON → TENANT_RESOLVER_DOWN', async () => {
    setProdEnv();
    process.env.VITE_TENANT_RESOLVER_URL = 'https://control.example.com/tenant-resolve';
    mockFetch(async () => new Response('<html>nope</html>', { status: 200, headers: { 'content-type': 'text/html' } }));

    const r = await tenantResolverService.resolve({ host: 'x.com', surface: 'patient' });
    assert.equal(r.error, RESOLVER_ERRORS.TENANT_RESOLVER_DOWN);
  });
});

// ── Cache behavior ──

describe('tenantResolverService.resolve — cache', () => {
  const sampleData = {
    tenantId: 'tenant-1',
    slug: 'dr-x',
    surface: 'patient',
    status: 'active',
    supabaseUrl: 'https://xtenantref01234567aa.supabase.co',
    supabaseAnonKey: 'x-anon',
    schemaVersion: '20260507',
    canonicalHost: 'dr-x.doctoleb.com',
  };

  it('successful resolution is cached (no second fetch)', async () => {
    setProdEnv();
    process.env.VITE_TENANT_RESOLVER_URL = 'https://control.example.com/tenant-resolve';

    let callCount = 0;
    mockFetch(async () => {
      callCount += 1;
      return new Response(JSON.stringify({ data: sampleData, error: null }), { status: 200 });
    });

    await tenantResolverService.resolve({ host: 'dr-x.doctoleb.com', surface: 'patient' });
    await tenantResolverService.resolve({ host: 'dr-x.doctoleb.com', surface: 'patient' });
    await tenantResolverService.resolve({ host: 'dr-x.doctoleb.com', surface: 'patient' });

    assert.equal(callCount, 1);
  });

  it('different (host, surface) tuples have independent cache entries', async () => {
    setProdEnv();
    process.env.VITE_TENANT_RESOLVER_URL = 'https://control.example.com/tenant-resolve';

    let callCount = 0;
    mockFetch(async () => {
      callCount += 1;
      return new Response(JSON.stringify({ data: sampleData, error: null }), { status: 200 });
    });

    await tenantResolverService.resolve({ host: 'dr-x.doctoleb.com', surface: 'patient' });
    await tenantResolverService.resolve({ host: 'dr-x.doctoleb.com', surface: 'ops' });
    await tenantResolverService.resolve({ host: 'dr-y.doctoleb.com', surface: 'patient' });

    assert.equal(callCount, 3);
  });

  it('host routing and path slug routing have independent cache entries', async () => {
    setProdEnv();
    process.env.VITE_TENANT_RESOLVER_URL = 'https://control.example.com/tenant-resolve';

    let callCount = 0;
    mockFetch(async () => {
      callCount += 1;
      return new Response(JSON.stringify({ data: sampleData, error: null }), { status: 200 });
    });

    await tenantResolverService.resolve({ host: 'doctoleb-patient-web.vercel.app', surface: 'patient' });
    await tenantResolverService.resolve({ host: 'doctoleb-patient-web.vercel.app', surface: 'patient', slug: 'dr-x' });
    await tenantResolverService.resolve({ host: 'doctoleb-patient-web.vercel.app', surface: 'patient', slug: 'dr-x' });

    assert.equal(callCount, 2);
  });

  it('clearResolverCache forces a re-fetch', async () => {
    setProdEnv();
    process.env.VITE_TENANT_RESOLVER_URL = 'https://control.example.com/tenant-resolve';

    let callCount = 0;
    mockFetch(async () => {
      callCount += 1;
      return new Response(JSON.stringify({ data: sampleData, error: null }), { status: 200 });
    });

    await tenantResolverService.resolve({ host: 'dr-x.doctoleb.com', surface: 'patient' });
    clearResolverCache();
    await tenantResolverService.resolve({ host: 'dr-x.doctoleb.com', surface: 'patient' });

    assert.equal(callCount, 2);
  });
});

// ── Response shape validation ──

describe('tenantResolverService.resolve — response shape validation', () => {
  it('missing supabaseUrl in response → falls through to RESOLVER_NOT_CONFIGURED in PROD', async () => {
    setProdEnv();
    process.env.VITE_TENANT_RESOLVER_URL = 'https://control.example.com/tenant-resolve';
    mockFetchOk({ data: { tenantId: 'x', slug: 'y' /* no url/key */ }, error: null });

    const r = await tenantResolverService.resolve({ host: 'x.com', surface: 'patient' });
    // Shape failed; PROD has no DEV fallback, so we end up at NOT_CONFIGURED.
    assert.equal(r.data, null);
    assert.equal(r.error, RESOLVER_ERRORS.RESOLVER_NOT_CONFIGURED);
  });

  it('mismatched response surface → SURFACE_MISMATCH', async () => {
    setProdEnv();
    process.env.VITE_TENANT_RESOLVER_URL = 'https://control.example.com/tenant-resolve';
    mockFetchOk({
      data: {
        tenantId: 'tenant-1',
        slug: 'dev',
        surface: 'ops',
        status: 'active',
        supabaseUrl: 'https://devtenantref01234567.supabase.co',
        supabaseAnonKey: 'anon-key',
      },
      error: null,
    });

    const r = await tenantResolverService.resolve({ host: 'dev.localhost', surface: 'patient' });
    assert.equal(r.data, null);
    assert.equal(r.error, RESOLVER_ERRORS.SURFACE_MISMATCH);
  });

  it('non-active response status → TENANT_INACTIVE', async () => {
    setProdEnv();
    process.env.VITE_TENANT_RESOLVER_URL = 'https://control.example.com/tenant-resolve';
    mockFetchOk({
      data: {
        tenantId: 'tenant-1',
        slug: 'dev',
        surface: 'patient',
        status: 'maintenance',
        supabaseUrl: 'https://devtenantref01234567.supabase.co',
        supabaseAnonKey: 'anon-key',
      },
      error: null,
    });

    const r = await tenantResolverService.resolve({ host: 'dev.localhost', surface: 'patient' });
    assert.equal(r.data, null);
    assert.equal(r.error, RESOLVER_ERRORS.TENANT_INACTIVE);
  });
});
