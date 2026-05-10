import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getCurrentTenantBasename,
  parseTenantPath,
  withCurrentTenantBasename,
} from '../../packages/core/lib/tenantPath.js';

describe('tenant path parsing', () => {
  it('returns no tenant path for normal app routes', () => {
    const parsed = parseTenantPath('/login');

    assert.equal(parsed.isTenantPath, false);
    assert.equal(parsed.tenantSlug, null);
    assert.equal(parsed.basename, '');
    assert.equal(parsed.appPath, '/login');
  });

  it('extracts /t/:tenantSlug and maps root to app /', () => {
    const parsed = parseTenantPath('/t/assad');

    assert.equal(parsed.isTenantPath, true);
    assert.equal(parsed.tenantSlug, 'assad');
    assert.equal(parsed.basename, '/t/assad');
    assert.equal(parsed.appPath, '/');
    assert.equal(parsed.error, null);
  });

  it('extracts /t/:tenantSlug/* and preserves the inner app route', () => {
    const parsed = parseTenantPath('/t/assad/patient-dashboard');

    assert.equal(parsed.isTenantPath, true);
    assert.equal(parsed.tenantSlug, 'assad');
    assert.equal(parsed.basename, '/t/assad');
    assert.equal(parsed.appPath, '/patient-dashboard');
  });

  it('normalizes uppercase slugs in the path', () => {
    const parsed = parseTenantPath('/t/ASSAD/login');

    assert.equal(parsed.tenantSlug, 'assad');
    assert.equal(parsed.basename, '/t/assad');
    assert.equal(parsed.appPath, '/login');
  });

  it('rejects missing, unsafe, and reserved slugs', () => {
    for (const pathname of ['/t', '/t/', '/t/bad_slug', '/t/-bad', '/t/admin']) {
      const parsed = parseTenantPath(pathname);
      assert.equal(parsed.isTenantPath, true);
      assert.equal(parsed.tenantSlug, null);
      assert.equal(parsed.error, 'INVALID_TENANT_SLUG');
    }
  });

  it('builds a router basename for valid tenant paths only', () => {
    assert.equal(getCurrentTenantBasename('/t/assad/login'), '/t/assad');
    assert.equal(getCurrentTenantBasename('/login'), '');
    assert.equal(getCurrentTenantBasename('/t/admin/login'), '');
  });

  it('prefixes redirects with the current tenant basename when path mode is active', () => {
    assert.equal(withCurrentTenantBasename('/login', '/t/assad/patient-dashboard'), '/t/assad/login');
    assert.equal(withCurrentTenantBasename('/login', '/patient-dashboard'), '/login');
  });
});
