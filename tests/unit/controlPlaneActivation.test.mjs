/**
 * Regression checks for the SaaS control-plane activation slice.
 *
 * These are source-contract tests rather than runtime service tests because
 * the affected modules rely on Vite aliases and Supabase clients. They guard
 * the safety-critical contracts that must hold before applying the live
 * control-plane migration.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('SaaS activation contracts', () => {
  it('patient consent gate has a fail-closed retry state', () => {
    const source = read('packages/ui/components/consent/PatientConsentGate.jsx');

    assert.match(source, /const \[loadError, setLoadError\]/);
    assert.match(source, /<ConsentErrorOverlay[\s\S]*onRetry=/);
    assert.match(source, /if \(loadError\)/);
    assert.match(source, /setReloadNonce/);
  });

  it('accepting consent clears any previous revocation marker', () => {
    const source = read('packages/core/services/tenantConfig.js');

    assert.match(source, /accepted_at:\s*new Date\(\)\.toISOString\(\),[\s\S]*revoked_at:\s*null/);
    assert.match(source, /upsert\(parsed\.data,\s*\{\s*onConflict:\s*'patient_id,consent_document_id'/);
  });

  it('message send retries collapse by client_request_id', () => {
    const source = read('packages/core/services/messaging.js');

    assert.match(source, /isDuplicateClientRequestIdError/);
    assert.match(source, /\.eq\('client_request_id', parsed\.data\.client_request_id\)/);
    assert.match(source, /\.maybeSingle\(\)/);
  });

  it('control-plane SQL treats maintenance as inactive and hostnames case-insensitively', () => {
    const source = read('supabase-control-plane/migrations/00010000000000_control_plane_baseline.sql');

    assert.match(source, /tenant_domains_hostname_lower_unique_idx/);
    assert.match(source, /normalize_tenant_domain_hostname/);
    assert.match(source, /tenant_domains_hostname_normalized_chk/);
    assert.match(source, /lower\(hostname\)/);
    assert.match(source, /v_row\.tenant_status <> 'active'/);
    assert.doesNotMatch(source, /not in \('active','maintenance'\)/);
  });

  it('control-plane SQL revokes direct public execute from rls_auto_enable when present', () => {
    const source = read('supabase-control-plane/migrations/00010000000000_control_plane_baseline.sql');

    assert.match(source, /revoke execute on function public\.rls_auto_enable\(\) from public, anon, authenticated/i);
    assert.match(source, /revoke execute on function public\.normalize_tenant_domain_hostname\(\) from public, anon, authenticated/i);
    assert.match(source, /revoke execute on function public\.touch_updated_at\(\) from public, anon, authenticated/i);
  });

  it('resolve_tenant direct RPC is private while tenant-resolve remains the public interface', () => {
    const source = read('supabase-control-plane/migrations/00010000000019_control_plane_resolve_tenant_rpc_private.sql');
    const resolver = read('supabase-control-plane/functions/tenant-resolve/index.ts');

    assert.match(source, /revoke execute on function public\.resolve_tenant\(text, text\) from public, anon, authenticated/i);
    assert.match(source, /grant execute on function public\.resolve_tenant\(text, text\) to service_role/i);
    assert.match(source, /tenant-resolve edge function/i);
    assert.match(resolver, /SERVICE-ROLE key to call resolve_tenant/);
    assert.match(resolver, /verify_jwt=false|--no-verify-jwt/);
  });

  it('no-domain slug resolver is service-role-only and active-tenant-only', () => {
    const source = read('supabase-control-plane/migrations/00010000000021_control_plane_no_domain_slug_resolver.sql');
    const resolver = read('supabase-control-plane/functions/tenant-resolve/index.ts');
    const bootstrap = read('packages/ui/contexts/TenantBootstrap.jsx');

    assert.match(source, /create or replace function public\.resolve_tenant_by_slug/);
    assert.match(source, /v_slug !~ '\^\[a-z0-9\]/);
    assert.match(source, /v_row\.tenant_status <> 'active'/);
    assert.match(source, /grant execute on function public\.resolve_tenant_by_slug\(text, text\) to service_role/i);
    assert.match(source, /revoke execute on function public\.resolve_tenant_by_slug\(text, text\) from public, anon, authenticated/i);
    assert.match(resolver, /url\.searchParams\.get\('slug'\)/);
    assert.match(resolver, /resolve_tenant_by_slug/);
    assert.match(resolver, /slug \? 'tenant_resolve_slug' : 'tenant_resolve'/);
    assert.match(bootstrap, /tenantPath\?\.isTenantPath && !tenantPath\.error/);
    assert.match(bootstrap, /getSurfaceForApp\(appSurface, classification, tenantPath\)/);
  });

  it('tenant resolver edge function validates host and sets production headers', () => {
    const source = read('supabase-control-plane/functions/tenant-resolve/index.ts');

    assert.match(source, /function normalizeHost/);
    assert.match(source, /MAX_HOST_LENGTH/);
    assert.match(source, /X-Content-Type-Options/);
    assert.match(source, /Referrer-Policy/);
    assert.match(source, /stale-while-revalidate/);
    assert.match(source, /normalizePayload/);
  });

  it('tenant resolver logs only safe RPC failure metadata', () => {
    const source = read('supabase-control-plane/functions/tenant-resolve/index.ts');

    assert.match(source, /function safeRpcErrorMetadata/);
    assert.match(source, /errorCode/);
    assert.doesNotMatch(source, /console\.error\('resolve_tenant RPC failed', \{ host, surface, error \}\)/);
    assert.doesNotMatch(source, /\{ host, surface, error \}/);
  });
});
