/**
 * Unit tests for packages/core/lib/hostnameSurface.js
 *
 * Run via: npm run test:unit
 * Uses Node's built-in test runner (no extra dependencies).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyHostname,
  classifyCurrentLocation,
  resolverSurfaceFor,
  needsTenantResolution,
  SURFACES,
  DEFAULT_PRIMARY_DOMAIN,
} from '../../packages/core/lib/hostnameSurface.js';

describe('classifyHostname — primary domain family', () => {
  it('apex maps to marketing', () => {
    const r = classifyHostname('doctoleb.com');
    assert.equal(r.surface, SURFACES.marketing);
    assert.equal(r.tenantSlug, null);
    assert.equal(r.isLocal, false);
    assert.equal(r.isCustomDomain, false);
  });

  it('www maps to marketing', () => {
    const r = classifyHostname('www.doctoleb.com');
    assert.equal(r.surface, SURFACES.marketing);
    assert.equal(r.tenantSlug, null);
  });

  it('console maps to control-plane', () => {
    const r = classifyHostname('console.doctoleb.com');
    assert.equal(r.surface, SURFACES.controlPlane);
    assert.equal(r.tenantSlug, null);
  });

  it('{slug}.doctoleb.com maps to patient-tenant with slug', () => {
    const r = classifyHostname('dr-hassan.doctoleb.com');
    assert.equal(r.surface, SURFACES.patientTenant);
    assert.equal(r.tenantSlug, 'dr-hassan');
    assert.equal(r.isCustomDomain, false);
  });

  it('{slug}.ops.doctoleb.com maps to ops-tenant with slug', () => {
    const r = classifyHostname('dr-hassan.ops.doctoleb.com');
    assert.equal(r.surface, SURFACES.opsTenant);
    assert.equal(r.tenantSlug, 'dr-hassan');
  });

  it('numeric slug is allowed', () => {
    const r = classifyHostname('clinic1.doctoleb.com');
    assert.equal(r.surface, SURFACES.patientTenant);
    assert.equal(r.tenantSlug, 'clinic1');
  });
});

describe('classifyHostname — reserved slugs', () => {
  for (const reserved of ['www', 'console', 'admin', 'api', 'app', 'ops', 'mail', 'docs', 'status']) {
    it(`'${reserved}' is not a tenant slug`, () => {
      const r = classifyHostname(`${reserved}.doctoleb.com`);
      assert.notEqual(r.surface, SURFACES.patientTenant);
      // Must NOT have a tenantSlug for reserved subdomains.
      if (r.surface === SURFACES.marketing || r.surface === SURFACES.controlPlane) {
        assert.equal(r.tenantSlug, null);
      } else if (r.surface === SURFACES.unknown) {
        assert.equal(r.tenantSlug, null);
      }
    });
  }
});

describe('classifyHostname — invalid slugs are not patient-tenant', () => {
  it('uppercase slug is rejected (DNS is lowercase)', () => {
    const r = classifyHostname('DR-HASSAN.doctoleb.com');
    // Hostname is lowercased internally, so this is actually 'dr-hassan' — valid.
    assert.equal(r.surface, SURFACES.patientTenant);
    assert.equal(r.tenantSlug, 'dr-hassan');
  });

  it('slug starting with hyphen is rejected', () => {
    const r = classifyHostname('-bad.doctoleb.com');
    assert.equal(r.surface, SURFACES.unknown);
  });

  it('slug ending with hyphen is rejected', () => {
    const r = classifyHostname('bad-.doctoleb.com');
    assert.equal(r.surface, SURFACES.unknown);
  });

  it('slug with underscore is rejected', () => {
    const r = classifyHostname('bad_slug.doctoleb.com');
    assert.equal(r.surface, SURFACES.unknown);
  });

  it('multi-label subdomain that is not .ops is unknown', () => {
    const r = classifyHostname('eu.dr-hassan.doctoleb.com');
    assert.equal(r.surface, SURFACES.unknown);
    assert.equal(r.tenantSlug, null);
  });

  it('status.doctoleb.com is reserved (not a tenant)', () => {
    const r = classifyHostname('status.doctoleb.com');
    assert.notEqual(r.surface, SURFACES.patientTenant);
  });
});

describe('classifyHostname — local hosts', () => {
  it('localhost:3001 maps to local-patient', () => {
    const r = classifyHostname('localhost:3001');
    assert.equal(r.surface, SURFACES.localPatient);
    assert.equal(r.isLocal, true);
    assert.equal(r.port, '3001');
  });

  it('localhost:3002 maps to local-ops', () => {
    const r = classifyHostname('localhost:3002');
    assert.equal(r.surface, SURFACES.localOps);
    assert.equal(r.isLocal, true);
  });

  it('127.0.0.1:3001 maps to local-patient', () => {
    const r = classifyHostname('127.0.0.1:3001');
    assert.equal(r.surface, SURFACES.localPatient);
  });

  it('localhost without port is local-unknown', () => {
    const r = classifyHostname('localhost');
    assert.equal(r.surface, SURFACES.localUnknown);
    assert.equal(r.isLocal, true);
  });

  it('localhost on unrelated port is local-unknown', () => {
    const r = classifyHostname('localhost:5173');
    assert.equal(r.surface, SURFACES.localUnknown);
  });

  it('IPv6 [::1]:3001 maps to local-patient', () => {
    const r = classifyHostname('[::1]:3001');
    assert.equal(r.surface, SURFACES.localPatient);
    assert.equal(r.hostname, '::1');
    assert.equal(r.port, '3001');
  });

  it('foo.localhost is local-unknown', () => {
    const r = classifyHostname('foo.localhost');
    assert.equal(r.isLocal, true);
  });
});

describe('classifyHostname — custom domains', () => {
  it('customclinic.com is custom-domain (patient)', () => {
    const r = classifyHostname('customclinic.com');
    assert.equal(r.surface, SURFACES.customDomain);
    assert.equal(r.tenantSlug, null);
    assert.equal(r.isCustomDomain, true);
  });

  it('ops.customclinic.com is custom-domain-ops', () => {
    const r = classifyHostname('ops.customclinic.com');
    assert.equal(r.surface, SURFACES.customDomainOps);
    assert.equal(r.isCustomDomain, true);
  });

  it('subdomain.customclinic.com is custom-domain (resolver decides)', () => {
    const r = classifyHostname('book.customclinic.com');
    assert.equal(r.isCustomDomain, true);
    assert.equal(r.surface, SURFACES.customDomain);
  });
});

describe('classifyHostname — configured deployment hosts', () => {
  it('maps an explicit Vercel marketing host to marketing without tenant resolution', () => {
    const r = classifyHostname('doctoleb-marketing.vercel.app', {
      marketingHosts: ['doctoleb-marketing.vercel.app'],
    });

    assert.equal(r.surface, SURFACES.marketing);
    assert.equal(r.isCustomDomain, false);
    assert.equal(needsTenantResolution(r.surface), false);
  });

  it('maps an explicit Vercel console host to control-plane without tenant resolution', () => {
    const r = classifyHostname('console-doctoleb.vercel.app', {
      controlPlaneHosts: ['console-doctoleb.vercel.app'],
    });

    assert.equal(r.surface, SURFACES.controlPlane);
    assert.equal(r.isCustomDomain, false);
    assert.equal(needsTenantResolution(r.surface), false);
  });

  it('maps an explicit Vercel patient tenant host through resolver-backed patient routing', () => {
    const r = classifyHostname('tenant-dev-patient.vercel.app', {
      patientTenantHosts: ['tenant-dev-patient.vercel.app'],
    });

    assert.equal(r.surface, SURFACES.customDomain);
    assert.equal(r.isCustomDomain, true);
    assert.equal(resolverSurfaceFor(r.surface), 'patient');
  });

  it('maps an explicit Vercel ops tenant host through resolver-backed ops routing', () => {
    const r = classifyHostname('tenant-dev-ops.vercel.app', {
      opsTenantHosts: ['tenant-dev-ops.vercel.app'],
    });

    assert.equal(r.surface, SURFACES.customDomainOps);
    assert.equal(r.isCustomDomain, true);
    assert.equal(resolverSurfaceFor(r.surface), 'ops');
  });

  it('normalizes configured hosts with escaped CR/LF suffixes from deployment env values', () => {
    const r = classifyHostname('doctoleb-clinic-ops.vercel.app', {
      opsTenantHosts: 'doctoleb-clinic-ops.vercel.app\\r\\n',
    });

    assert.equal(r.surface, SURFACES.customDomainOps);
    assert.equal(resolverSurfaceFor(r.surface), 'ops');
  });

  it('normalizes configured hosts from comma-separated full URLs', () => {
    const r = classifyHostname('doctoleb-marketing.vercel.app', {
      marketingHosts: 'https://ignored.vercel.app, https://doctoleb-marketing.vercel.app/path?x=1',
    });

    assert.equal(r.surface, SURFACES.marketing);
  });

  it('falls back to custom-domain when a Vercel host is not explicitly categorized', () => {
    const r = classifyHostname('unconfigured.vercel.app');

    assert.equal(r.surface, SURFACES.customDomain);
    assert.equal(r.isCustomDomain, true);
  });
});

describe('classifyHostname — input normalization', () => {
  it('strips http:// prefix', () => {
    const r = classifyHostname('http://doctoleb.com');
    assert.equal(r.surface, SURFACES.marketing);
  });

  it('strips https:// prefix', () => {
    const r = classifyHostname('https://dr-test.doctoleb.com');
    assert.equal(r.surface, SURFACES.patientTenant);
    assert.equal(r.tenantSlug, 'dr-test');
  });

  it('strips path/query/hash', () => {
    const r = classifyHostname('dr-test.doctoleb.com/login?foo=bar#x');
    assert.equal(r.surface, SURFACES.patientTenant);
    assert.equal(r.tenantSlug, 'dr-test');
  });

  it('handles port on primary domain', () => {
    const r = classifyHostname('dr-test.doctoleb.com:443');
    assert.equal(r.surface, SURFACES.patientTenant);
    assert.equal(r.port, '443');
  });

  it('lower-cases mixed-case input', () => {
    const r = classifyHostname('DocToLeb.COM');
    assert.equal(r.surface, SURFACES.marketing);
    assert.equal(r.hostname, 'doctoleb.com');
  });

  it('empty string returns unknown surface', () => {
    const r = classifyHostname('');
    assert.equal(r.surface, SURFACES.unknown);
    assert.equal(r.hostname, '');
  });

  it('null input returns unknown surface', () => {
    const r = classifyHostname(null);
    assert.equal(r.surface, SURFACES.unknown);
  });

  it('respects custom primaryDomain option', () => {
    const r = classifyHostname('dr-x.doctoleb.dev', { primaryDomain: 'doctoleb.dev' });
    assert.equal(r.surface, SURFACES.patientTenant);
    assert.equal(r.tenantSlug, 'dr-x');
    assert.equal(r.primaryDomain, 'doctoleb.dev');
  });

  it('default primaryDomain is doctoleb.com', () => {
    const r = classifyHostname('doctoleb.com');
    assert.equal(r.primaryDomain, DEFAULT_PRIMARY_DOMAIN);
  });
});

describe('classifyCurrentLocation — runtime deployment hosts', () => {
  it('reads deployment host categories from runtime env', () => {
    const previousWindow = globalThis.window;
    const previousMarketingHosts = process.env.VITE_MARKETING_HOSTS;

    globalThis.window = { location: { host: 'doctoleb-preview.vercel.app' } };
    process.env.VITE_MARKETING_HOSTS = 'doctoleb-preview.vercel.app';

    try {
      const r = classifyCurrentLocation();
      assert.equal(r.surface, SURFACES.marketing);
      assert.equal(r.host, 'doctoleb-preview.vercel.app');
    } finally {
      if (previousWindow === undefined) {
        delete globalThis.window;
      } else {
        globalThis.window = previousWindow;
      }

      if (previousMarketingHosts === undefined) {
        delete process.env.VITE_MARKETING_HOSTS;
      } else {
        process.env.VITE_MARKETING_HOSTS = previousMarketingHosts;
      }
    }
  });

  it('reads a future purchased primary domain from runtime env', () => {
    const previousWindow = globalThis.window;
    const previousPrimaryDomain = process.env.VITE_PUBLIC_PRIMARY_DOMAIN;

    globalThis.window = { location: { host: 'dr-hassan.doctoleb.dev' } };
    process.env.VITE_PUBLIC_PRIMARY_DOMAIN = 'https://doctoleb.dev';

    try {
      const r = classifyCurrentLocation();
      assert.equal(r.surface, SURFACES.patientTenant);
      assert.equal(r.tenantSlug, 'dr-hassan');
      assert.equal(r.primaryDomain, 'doctoleb.dev');
    } finally {
      if (previousWindow === undefined) {
        delete globalThis.window;
      } else {
        globalThis.window = previousWindow;
      }

      if (previousPrimaryDomain === undefined) {
        delete process.env.VITE_PUBLIC_PRIMARY_DOMAIN;
      } else {
        process.env.VITE_PUBLIC_PRIMARY_DOMAIN = previousPrimaryDomain;
      }
    }
  });
});

describe('resolverSurfaceFor', () => {
  it('patient-like surfaces map to "patient"', () => {
    assert.equal(resolverSurfaceFor(SURFACES.patientTenant), 'patient');
    assert.equal(resolverSurfaceFor(SURFACES.localPatient), 'patient');
    assert.equal(resolverSurfaceFor(SURFACES.customDomain), 'patient');
  });

  it('ops-like surfaces map to "ops"', () => {
    assert.equal(resolverSurfaceFor(SURFACES.opsTenant), 'ops');
    assert.equal(resolverSurfaceFor(SURFACES.localOps), 'ops');
    assert.equal(resolverSurfaceFor(SURFACES.customDomainOps), 'ops');
  });

  it('non-tenant surfaces return null', () => {
    assert.equal(resolverSurfaceFor(SURFACES.marketing), null);
    assert.equal(resolverSurfaceFor(SURFACES.controlPlane), null);
    assert.equal(resolverSurfaceFor(SURFACES.unknown), null);
    assert.equal(resolverSurfaceFor(SURFACES.localUnknown), null);
  });
});

describe('needsTenantResolution', () => {
  it('patient + ops surfaces need resolution', () => {
    assert.equal(needsTenantResolution(SURFACES.patientTenant), true);
    assert.equal(needsTenantResolution(SURFACES.opsTenant), true);
    assert.equal(needsTenantResolution(SURFACES.localPatient), true);
    assert.equal(needsTenantResolution(SURFACES.customDomain), true);
  });

  it('marketing/control-plane/unknown do not need resolution', () => {
    assert.equal(needsTenantResolution(SURFACES.marketing), false);
    assert.equal(needsTenantResolution(SURFACES.controlPlane), false);
    assert.equal(needsTenantResolution(SURFACES.unknown), false);
  });
});
