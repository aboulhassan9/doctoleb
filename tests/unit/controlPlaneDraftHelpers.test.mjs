import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPendingTenantDomains,
  createClientRequestId,
  deriveTenantSlug,
  normalizeFirstDoctorAdminDraft,
  normalizeTenantSlug,
  validateFirstDoctorAdminDraft,
  validateProvisioningDraft,
} from '../../apps/control-plane/src/lib/provisioningDrafts.js';
import {
  getNextProvisioningWizardStepId,
  getPreviousProvisioningWizardStepId,
  PROVISIONING_WIZARD_STEPS,
} from '../../apps/control-plane/src/lib/provisioningWizard.js';
import {
  buildSupabaseUrl,
  normalizeSupabaseProjectRef,
  normalizeSupabaseUrl,
  validateRuntimeConfigDraft,
} from '../../apps/control-plane/src/lib/runtimeConfigDrafts.js';
import {
  connectionCanAutomate,
  normalizeProviderConnectionDraft,
  validateProviderConnectionDraft,
  validateProvisioningProviderSelection,
} from '../../apps/control-plane/src/lib/providerConnectionDrafts.js';
import {
  buildTenantReadinessItems,
  summarizeTenantReadiness,
} from '../../apps/control-plane/src/lib/tenantReadiness.js';
import { buildNoDomainTenantAccess } from '../../apps/control-plane/src/lib/noDomainAccess.js';
import {
  buildTenantBrandingDraft,
  updateTenantBrandingDraft,
} from '../../apps/control-plane/src/lib/tenantBrandingDrafts.js';
import {
  buildManualEntitlementSyncPayload,
  resolveEffectiveEntitlementState,
  resolvePlanEntitlementState,
} from '../../apps/control-plane/src/lib/entitlementDrafts.js';

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

  it('normalizes and validates the first doctor admin draft before tenant creation', () => {
    const draft = normalizeFirstDoctorAdminDraft({
      displayName: '  Dr. Layla Haddad  ',
      email: '  DOCTOR@Clinic.test  ',
      phone: '  +961 70 000 000  ',
    });

    assert.deepEqual(draft, {
      displayName: 'Dr. Layla Haddad',
      email: 'doctor@clinic.test',
      phone: '+961 70 000 000',
    });
    assert.equal(validateFirstDoctorAdminDraft(draft), '');
    assert.match(validateFirstDoctorAdminDraft({ ...draft, displayName: '' }), /doctor name/i);
    assert.match(validateFirstDoctorAdminDraft({ ...draft, email: 'not-email' }), /doctor email/i);
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

  it('orders new tenant creation as a step-by-step wizard', () => {
    assert.deepEqual(PROVISIONING_WIZARD_STEPS.map((step) => step.id), [
      'clinic',
      'doctor',
      'hosting',
      'review',
    ]);
    assert.equal(getNextProvisioningWizardStepId('clinic'), 'doctor');
    assert.equal(getNextProvisioningWizardStepId('hosting'), 'review');
    assert.equal(getNextProvisioningWizardStepId('review'), 'review');
    assert.equal(getPreviousProvisioningWizardStepId('review'), 'hosting');
    assert.equal(getPreviousProvisioningWizardStepId('clinic'), 'clinic');
  });
});

describe('control-plane tenant readiness helpers', () => {
  const readyNoDomainTenant = {
    slug: 'dev',
    display_name: 'DoctoLeb Dev Tenant',
    status: 'active',
    supabase_project_ref: 'gezmfmskhmjgnquoyosq',
    supabase_url: 'https://gezmfmskhmjgnquoyosq.supabase.co',
    tenant_domains: [
      { hostname: 'dev.doctoleb.com', surface: 'patient', status: 'pending', dns_status: 'pending', ssl_status: 'pending' },
      { hostname: 'dev.ops.doctoleb.com', surface: 'ops', status: 'pending', dns_status: 'pending', ssl_status: 'pending' },
      { hostname: 'doctoleb-patient-web.vercel.app', surface: 'patient', status: 'active', dns_status: 'verified', ssl_status: 'issued' },
      { hostname: 'doctoleb-clinic-ops.vercel.app', surface: 'ops', status: 'active', dns_status: 'verified', ssl_status: 'issued' },
    ],
  };

  it('marks the current first tenant ready on Vercel aliases while real domains stay pending', () => {
    const summary = summarizeTenantReadiness(readyNoDomainTenant);
    const items = buildTenantReadinessItems(readyNoDomainTenant);

    assert.equal(summary.status, 'ready');
    assert.equal(summary.blockers.length, 0);
    assert.equal(items.find((item) => item.id === 'patient_web')?.status, 'ready');
    assert.equal(items.find((item) => item.id === 'ops_web')?.status, 'ready');
    assert.equal(items.find((item) => item.id === 'future_domain')?.status, 'pending');
    assert.equal(items.find((item) => item.id === 'flutter_path')?.status, 'prepared');
  });

  it('builds no-domain access URLs from the tenant slug', () => {
    const access = buildNoDomainTenantAccess({ slug: 'assad' });

    assert.equal(access.available, true);
    assert.equal(access.patientUrl, 'https://doctoleb-patient-web.vercel.app/t/assad');
    assert.equal(access.opsUrl, 'https://doctoleb-clinic-ops.vercel.app/t/assad');
  });

  it('treats path routing as online proof when runtime config exists', () => {
    const summary = summarizeTenantReadiness({
      ...readyNoDomainTenant,
      tenant_domains: [
        { hostname: 'assad.doctoleb.com', surface: 'patient', status: 'pending', dns_status: 'pending', ssl_status: 'pending' },
        { hostname: 'assad.ops.doctoleb.com', surface: 'ops', status: 'pending', dns_status: 'pending', ssl_status: 'pending' },
      ],
    });

    assert.equal(summary.status, 'ready');
    assert.equal(summary.blockers.length, 0);
  });

  it('does not treat localhost-only domains as online proof without runtime config', () => {
    const summary = summarizeTenantReadiness({
      ...readyNoDomainTenant,
      supabase_project_ref: '',
      supabase_url: '',
      tenant_domains: [
        { hostname: 'localhost:3001', surface: 'patient', status: 'active', dns_status: null, ssl_status: null },
        { hostname: 'localhost:3002', surface: 'ops', status: 'active', dns_status: null, ssl_status: null },
      ],
    });

    assert.equal(summary.status, 'needs_work');
    assert.match(summary.blockers.map((item) => item.id).join(','), /patient_web/);
    assert.match(summary.blockers.map((item) => item.id).join(','), /ops_web/);
  });
});

describe('control-plane tenant branding draft helpers', () => {
  it('loads editable branding from tenant runtime config before SaaS fallback names', () => {
    const draft = buildTenantBrandingDraft({
      tenant: { display_name: 'DoctoLeb Dev Tenant' },
      runtimeBranding: {
        profile: { display_name: 'Cedar Family Clinic' },
        appConfig: {
          app_name: 'Cedar Clinic',
          app_tagline: 'Family medicine in Beirut',
          primary_color: '#0ea5e9',
          secondary_color: '#111827',
          support_email: 'hello@cedar.example',
          enabled_locales: ['en', 'ar'],
        },
      },
    });

    assert.equal(draft.display_name, 'Cedar Family Clinic');
    assert.equal(draft.app_name, 'Cedar Clinic');
    assert.equal(draft.app_tagline, 'Family medicine in Beirut');
    assert.equal(draft.primary_color, '#0ea5e9');
    assert.deepEqual(draft.enabled_locales, ['en', 'ar']);
  });

  it('keeps visible app name aligned when the practice name is the same value', () => {
    const current = buildTenantBrandingDraft({
      tenant: { display_name: 'Clinic Portal' },
      runtimeBranding: {
        profile: { display_name: 'Clinic Portal' },
        appConfig: { app_name: 'Clinic Portal' },
      },
    });

    const next = updateTenantBrandingDraft(current, 'display_name', 'North Beirut Clinic');

    assert.equal(next.display_name, 'North Beirut Clinic');
    assert.equal(next.app_name, 'North Beirut Clinic');
  });

  it('does not overwrite a deliberately different patient/staff app name', () => {
    const next = updateTenantBrandingDraft({
      display_name: 'North Beirut Clinic LLC',
      app_name: 'North Beirut Clinic',
    }, 'display_name', 'North Beirut Clinic Group');

    assert.equal(next.display_name, 'North Beirut Clinic Group');
    assert.equal(next.app_name, 'North Beirut Clinic');
  });
});

describe('control-plane entitlement draft helpers', () => {
  const features = [
    { code: 'messaging' },
    { code: 'advanced_reports' },
    { code: 'insurance_billing' },
  ];
  const planEntitlements = [
    { plan_code: 'starter', feature_code: 'messaging', is_enabled: true, limits: {} },
    { plan_code: 'starter', feature_code: 'advanced_reports', is_enabled: false, limits: {} },
    { plan_code: 'starter', feature_code: 'insurance_billing', is_enabled: false, limits: {} },
  ];

  it('shows effective feature state from plan defaults plus tenant overrides', () => {
    const state = resolveEffectiveEntitlementState({
      planCode: 'starter',
      planEntitlements,
      tenantEntitlements: [
        { feature_code: 'advanced_reports', source: 'manual_override', is_enabled: true, limits: {} },
      ],
      features,
    });

    assert.deepEqual(state, {
      messaging: true,
      advanced_reports: true,
      insurance_billing: false,
    });
  });

  it('syncs only manual differences from plan defaults', () => {
    const planState = resolvePlanEntitlementState({ planCode: 'starter', planEntitlements, features });
    const payload = buildManualEntitlementSyncPayload({
      desiredState: {
        messaging: true,
        advanced_reports: true,
        insurance_billing: false,
      },
      planState,
      tenantEntitlements: [],
      features,
    });

    assert.deepEqual(payload.entitlements, [
      {
        feature_code: 'advanced_reports',
        source: 'manual_override',
        is_enabled: true,
        limits: {},
        reason: 'Console toggle',
      },
    ]);
    assert.deepEqual(payload.resetFeatureCodes, []);
  });

  it('resets stale manual overrides when the desired value matches the plan again', () => {
    const planState = resolvePlanEntitlementState({ planCode: 'starter', planEntitlements, features });
    const payload = buildManualEntitlementSyncPayload({
      desiredState: {
        messaging: true,
        advanced_reports: false,
        insurance_billing: false,
      },
      planState,
      tenantEntitlements: [
        { feature_code: 'advanced_reports', source: 'manual_override', is_enabled: true, limits: {} },
      ],
      features,
    });

    assert.deepEqual(payload.entitlements, []);
    assert.deepEqual(payload.resetFeatureCodes, ['advanced_reports']);
  });
});

describe('control-plane provider connection helpers', () => {
  it('allows automation only for active connections with server-side secret references', () => {
    assert.equal(connectionCanAutomate({
      provider: 'supabase',
      status: 'active',
      is_automation_enabled: true,
      has_secret_ref: true,
    }, 'supabase'), true);
    assert.equal(connectionCanAutomate({
      provider: 'supabase',
      status: 'pending_authorization',
      is_automation_enabled: true,
      has_secret_ref: true,
    }, 'supabase'), false);
  });

  it('requires provider connections before assisted or automatic draft creation', () => {
    assert.equal(validateProvisioningProviderSelection({
      automationMode: 'manual',
      supabaseConnectionId: '',
      vercelConnectionId: '',
    }), '');
    assert.match(validateProvisioningProviderSelection({
      automationMode: 'automatic',
      supabaseConnectionId: '',
      vercelConnectionId: '00000000-0000-4000-8000-000000000000',
    }), /Supabase provider connection/i);
    assert.equal(validateProvisioningProviderSelection({
      automationMode: 'assisted',
      supabaseConnectionId: '00000000-0000-4000-8000-000000000000',
      vercelConnectionId: '00000000-0000-4000-8000-000000000001',
    }), '');
  });

  it('rejects raw provider tokens in provider connection drafts', () => {
    const draft = normalizeProviderConnectionDraft({
      provider: 'vercel',
      displayName: 'Customer Vercel',
      status: 'active',
      isAutomationEnabled: true,
      secretStorage: 'edge_function_secret',
      secretRef: 'vcp_should-not-enter-browser',
    });

    assert.match(validateProviderConnectionDraft(draft), /secret reference only/i);
    assert.equal(validateProviderConnectionDraft({
      ...draft,
      secretRef: 'VERCEL_CUSTOMER_A_TOKEN',
    }), '');
  });

  it('requires automation secret references to match the current runner storage contract', () => {
    const baseDraft = {
      provider: 'supabase',
      displayName: 'Customer Supabase',
      status: 'active',
      isAutomationEnabled: true,
    };

    assert.match(validateProviderConnectionDraft({
      ...baseDraft,
      secretStorage: 'edge_function_secret',
      secretRef: 'vault:/providers/supabase/customer-a',
    }), /Edge Function secret name/i);

    assert.match(validateProviderConnectionDraft({
      ...baseDraft,
      secretStorage: 'supabase_vault',
      secretRef: 'vault:/providers/supabase/customer-a',
    }), /Edge Function secret reference/i);

    assert.equal(validateProviderConnectionDraft({
      ...baseDraft,
      secretStorage: 'edge_function_secret',
      secretRef: 'SUPABASE_CUSTOMER_A_TOKEN',
    }), '');
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
