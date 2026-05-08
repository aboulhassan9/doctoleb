import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPendingTenantDomains,
  createClientRequestId,
  deriveTenantSlug,
  normalizeTenantSlug,
  validateProvisioningDraft,
} from '../../apps/control-plane/src/lib/provisioningDrafts.js';
import {
  buildSupabaseUrl,
  normalizeSupabaseProjectRef,
  normalizeSupabaseUrl,
  validateRuntimeConfigDraft,
} from '../../apps/control-plane/src/lib/runtimeConfigDrafts.js';

describe('control-plane tenant draft helpers', () => {
  it('normalizes doctor tenant slugs without preserving unsafe characters', () => {
    assert.equal(deriveTenantSlug('Dr. Hassan Clinic!'), 'dr-hassan-clinic');
    assert.equal(normalizeTenantSlug('  North---Beirut___Clinic  '), 'north-beirut-clinic');
  });

  it('builds placeholder pending domains from the canonical primary domain', () => {
    assert.deepEqual(buildPendingTenantDomains('north-beirut'), [
      { hostname: 'north-beirut.doctoleb.com', surface: 'patient' },
      { hostname: 'north-beirut.ops.doctoleb.com', surface: 'ops' },
    ]);
  });

  it('validates draft creation preconditions before the Edge Function call', () => {
    assert.equal(validateProvisioningDraft({
      requestedSlug: 'north-beirut',
      requestedDisplayName: 'North Beirut Clinic',
      clientRequestId: '00000000-0000-4000-8000-000000000000',
    }), '');
    assert.match(validateProvisioningDraft({
      requestedSlug: '',
      requestedDisplayName: 'North Beirut Clinic',
      clientRequestId: '00000000-0000-4000-8000-000000000000',
    }), /slug/i);
    assert.match(validateProvisioningDraft({
      requestedSlug: 'north-beirut',
      requestedDisplayName: '',
      clientRequestId: '00000000-0000-4000-8000-000000000000',
    }), /Clinic name/i);
  });

  it('creates idempotency keys with randomUUID or getRandomValues', () => {
    assert.equal(createClientRequestId({ randomUUID: () => '00000000-0000-4000-8000-000000000000' }), '00000000-0000-4000-8000-000000000000');

    const generated = createClientRequestId({
      getRandomValues(bytes) {
        bytes.fill(1);
        return bytes;
      },
    });

    assert.match(generated, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('control-plane runtime config helpers', () => {
  it('normalizes Supabase project refs and URLs', () => {
    assert.equal(normalizeSupabaseProjectRef(' GEZMFMSKHMJGNQUOYOSQ '), 'gezmfmskhmjgnquoyosq');
    assert.equal(buildSupabaseUrl('gezmfmskhmjgnquoyosq'), 'https://gezmfmskhmjgnquoyosq.supabase.co');
    assert.equal(normalizeSupabaseUrl('https://gezmfmskhmjgnquoyosq.supabase.co/dashboard'), 'https://gezmfmskhmjgnquoyosq.supabase.co');
  });

  it('validates runtime config before saving public resolver metadata', () => {
    assert.equal(validateRuntimeConfigDraft({
      projectRef: 'gezmfmskhmjgnquoyosq',
      supabaseUrl: 'https://gezmfmskhmjgnquoyosq.supabase.co',
      supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    }), '');
    assert.match(validateRuntimeConfigDraft({
      projectRef: 'short',
      supabaseUrl: 'https://gezmfmskhmjgnquoyosq.supabase.co',
      supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    }), /project ref/i);
    assert.match(validateRuntimeConfigDraft({
      projectRef: 'gezmfmskhmjgnquoyosq',
      supabaseUrl: 'https://xouqxgwccewvbtkqming.supabase.co',
      supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    }), /URL/i);
    assert.match(validateRuntimeConfigDraft({
      projectRef: 'gezmfmskhmjgnquoyosq',
      supabaseUrl: 'https://gezmfmskhmjgnquoyosq.supabase.co',
      supabaseAnonKey: 'not enough',
    }), /anon key/i);
  });
});
