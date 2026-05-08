import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readControlPlaneFunctionSources() {
  const functionsDir = path.join(root, 'supabase-control-plane/functions');
  return fs
    .readdirSync(functionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const sourcePath = path.join(functionsDir, entry.name, 'index.ts');
      return fs.existsSync(sourcePath) ? [fs.readFileSync(sourcePath, 'utf8')] : [];
    })
    .join('\n');
}

describe('SaaS foundation contracts', () => {
  it('control-plane migration adds plans, entitlements, provisioning jobs, and role-aware super admins', () => {
    const source = read('supabase-control-plane/migrations/00010000000003_saas_foundation.sql');

    assert.match(source, /create table if not exists public\.plans/);
    assert.match(source, /create table if not exists public\.plan_entitlements/);
    assert.match(source, /create table if not exists public\.tenant_entitlements/);
    assert.match(source, /create table if not exists public\.tenant_provisioning_jobs/);
    assert.match(source, /alter table public\.super_admins\s+add column if not exists role/);
    assert.match(source, /check \(role in \('owner','operator','support','billing_admin'\)\)/);
    assert.match(source, /alter table public\.plans enable row level security/);
    assert.match(source, /public\.has_super_admin_role/);
  });

  it('admin edge functions verify super-admin RBAC before service-role work', () => {
    const source = read('supabase-control-plane/functions/_shared/admin.ts');

    assert.match(source, /requireSuperAdmin/);
    assert.match(source, /auth\.getUser\(token\)/);
    assert.match(source, /from\('super_admins'\)/);
    assert.match(source, /allowedRoles/);
    assert.match(source, /SERVICE_ROLE/);
  });

  it('tenant config and entitlement sync require tenant service-role secrets server-side', () => {
    const configSync = read('supabase-control-plane/functions/admin-sync-tenant-config/index.ts');
    const entitlementSync = read('supabase-control-plane/functions/admin-sync-entitlements/index.ts');

    assert.match(configSync, /TENANT_SERVICE_ROLE_KEY_/);
    assert.match(configSync, /tenant_app_config/);
    assert.match(configSync, /tenant_config\.sync/);
    assert.match(configSync, /TENANT_PROFILE_SELECT/);
    assert.match(configSync, /previousSnapshot/);
    assert.match(configSync, /currentSnapshot/);
    assert.match(configSync, /tenant_config\.sync_started/);
    assert.match(entitlementSync, /TENANT_SERVICE_ROLE_KEY_/);
    assert.match(entitlementSync, /feature_flags/);
    assert.match(entitlementSync, /tenant_entitlements\.sync/);
    assert.match(entitlementSync, /insurance_billing/);
  });

  it('control-plane browser app uses control-plane env names and never references service-role keys', () => {
    const client = read('apps/control-plane/src/lib/controlPlaneClient.js');
    const api = read('apps/control-plane/src/lib/controlPlaneApi.js');

    assert.match(client, /VITE_CONTROL_PLANE_SUPABASE_URL/);
    assert.match(client, /VITE_CONTROL_PLANE_SUPABASE_ANON_KEY/);
    assert.doesNotMatch(client, /SERVICE_ROLE/i);
    assert.doesNotMatch(api, /SERVICE_ROLE/i);
  });

  it('patient app bypasses tenant bootstrap for marketing hostnames', () => {
    const source = read('apps/patient-web/src/App.jsx');

    assert.match(source, /MarketingShell/);
    assert.match(source, /SURFACES\.marketing/);
    assert.match(source, /TenantPortalShell/);
    assert.match(source, /classifyCurrentLocation/);
  });

  it('patient-web root landing page is doctor-facing SaaS marketing, not patient-buying copy', () => {
    const app = read('apps/patient-web/src/App.jsx');
    const landing = read('apps/patient-web/src/pages/LandingPage.jsx');
    const tenantMarketing = read('apps/patient-web/src/pages/MarketingPage.jsx');

    assert.match(app, /classification\.surface === SURFACES\.marketing/);
    assert.match(app, /<Route path="\/" element=\{<LandingPage \/>/);
    assert.match(landing, /Clinic SaaS for doctors/);
    assert.match(landing, /For doctors who want the clinic app/);
    assert.match(landing, /Book a demo/);
    assert.doesNotMatch(landing, /Patient Registration/);
    assert.match(tenantMarketing, /Patient Portal/);
  });

  it('Vercel serves direct SPA routes through the app shell', () => {
    const config = JSON.parse(read('vercel.json'));

    assert.equal(config.git.deploymentEnabled, false);
    assert.deepEqual(config.rewrites, [
      {
        source: '/(.*)',
        destination: '/index.html',
      },
    ]);
  });

  it('all standalone Vite apps use the shared Tailwind PostCSS config', () => {
    for (const app of ['patient-web', 'clinic-ops', 'control-plane']) {
      const source = read(`apps/${app}/postcss.config.js`);

      assert.match(source, /tailwind\.config\.js/);
      assert.match(source, /autoprefixer/);
    }
  });

  it('Vercel production deploys queue and wait explicitly inside GitHub Actions', () => {
    const workflow = read('.github/workflows/ci.yml');

    assert.match(workflow, /timeout-minutes: 45/);
    assert.match(workflow, /github\.event_name == 'push' \|\| github\.event_name == 'workflow_dispatch'/);
    assert.match(
      workflow,
      /vercel@\$\{VERCEL_CLI_VERSION\} deploy --prebuilt --prod --yes --no-wait --token="\$VERCEL_TOKEN"/,
    );
    assert.match(workflow, /grep -Eo 'https:\/\/\[a-z0-9\.-\]\+\\\.vercel\\\.app'/);
    assert.match(
      workflow,
      /vercel@\$\{VERCEL_CLI_VERSION\} inspect "\$deployment_url" --wait --timeout 35m --token="\$VERCEL_TOKEN"/,
    );
  });

  it('control-plane edge functions use explicit select lists', () => {
    const source = readControlPlaneFunctionSources();

    assert.doesNotMatch(source, /\.select\s*\(\s*['"`]\*['"`]\s*\)/);
    assert.doesNotMatch(source, /\.select\s*\(\s*\)/);
    assert.match(read('supabase-control-plane/functions/_shared/selects.ts'), /CONTROL_PLANE_PLAN_SELECT/);
    assert.match(read('supabase-control-plane/functions/_shared/selects.ts'), /TENANT_FEATURE_FLAG_SELECT/);
  });

  it('control-plane DB forces mutations through Edge Functions and enforces provisioning transitions', () => {
    const source = read('supabase-control-plane/migrations/00010000000006_control_plane_write_boundaries_and_job_transitions.sql');

    assert.match(source, /drop policy if exists tenants_super_admin_update/);
    assert.match(source, /drop policy if exists tenant_domains_super_admin_delete/);
    assert.match(source, /drop policy if exists tenant_provisioning_jobs_operator_delete/);
    assert.match(source, /add constraint tenant_provisioning_jobs_status_check/);
    assert.match(source, /'failed'/);
    assert.match(source, /'archived'/);
    assert.match(source, /enforce_tenant_provisioning_job_transition/);
    assert.match(source, /INVALID_PROVISIONING_JOB_STATUS_TRANSITION/);
    assert.match(source, /new\.completed_at = now\(\)/);
  });

  it('provisioning job creation is idempotent by client request id', () => {
    const idempotencyMigration = read('supabase-control-plane/migrations/00010000000007_control_plane_provisioning_job_idempotency.sql');
    const draftMigration = read('supabase-control-plane/migrations/00010000000011_control_plane_tenant_draft_creation.sql');
    const source = read('supabase-control-plane/functions/admin-create-provisioning-job/index.ts');
    const panel = read('apps/control-plane/src/components/ProvisioningPanel.jsx');
    const helpers = read('apps/control-plane/src/lib/provisioningDrafts.js');

    assert.match(idempotencyMigration, /add column if not exists client_request_id text/);
    assert.match(idempotencyMigration, /tenant_provisioning_jobs_client_request_id_check/);
    assert.match(idempotencyMigration, /create unique index if not exists tenant_provisioning_jobs_client_request_id_key/);
    assert.match(draftMigration, /admin_create_tenant_draft_atomic/);
    assert.match(draftMigration, /alter column supabase_project_ref drop not null/);
    assert.match(draftMigration, /tenants_active_runtime_config_required/);
    assert.match(draftMigration, /tenant\.draft_created/);
    assert.match(draftMigration, /grant execute on function public\.admin_create_tenant_draft_atomic[\s\S]*to service_role/);
    assert.match(source, /normalizeClientRequestId/);
    assert.match(source, /\.rpc\('admin_create_tenant_draft_atomic'/);
    assert.match(source, /TENANT_SLUG_TAKEN/);
    assert.match(source, /DOMAIN_TAKEN/);
    assert.doesNotMatch(source, /from\('tenant_provisioning_jobs'\)[\s\S]*\.insert/);
    assert.match(panel, /createClientRequestId/);
    assert.match(panel, /buildPendingTenantDomains/);
    assert.match(panel, /clientRequestId/);
    assert.match(helpers, /cryptoSource\?\.randomUUID/);
  });

  it('tenant runtime config is saved through an authenticated service-role RPC only', () => {
    const migration = read('supabase-control-plane/migrations/00010000000012_control_plane_tenant_runtime_config.sql');
    const source = read('supabase-control-plane/functions/admin-set-tenant-runtime-config/index.ts');
    const api = read('apps/control-plane/src/lib/controlPlaneApi.js');
    const panel = read('apps/control-plane/src/components/RuntimeConfigPanel.jsx');

    assert.match(migration, /admin_set_tenant_runtime_config_atomic/);
    assert.match(migration, /supabase_project_ref = v_project_ref/);
    assert.match(migration, /supabase_anon_key = v_anon_key/);
    assert.match(migration, /storeTenantRuntimeConfig/);
    assert.match(migration, /tenant\.runtime_config_set/);
    assert.match(migration, /storesServiceRoleKey', false/);
    assert.match(migration, /grant execute on function public\.admin_set_tenant_runtime_config_atomic[\s\S]*to service_role/);
    assert.match(source, /requireSuperAdmin\(req, \['operator'\]\)/);
    assert.match(source, /\.rpc\('admin_set_tenant_runtime_config_atomic'/);
    assert.match(source, /normalizeAnonKey/);
    assert.doesNotMatch(source, /SERVICE_ROLE_KEY_/);
    assert.match(api, /admin-set-tenant-runtime-config/);
    assert.match(panel, /Tenant service-role keys stay/);
  });

  it('draft tenants cannot sync runtime branding or feature flags before runtime config exists', () => {
    const admin = read('supabase-control-plane/functions/_shared/admin.ts');
    const configSync = read('supabase-control-plane/functions/admin-sync-tenant-config/index.ts');
    const entitlementSync = read('supabase-control-plane/functions/admin-sync-entitlements/index.ts');
    const brandingPanel = read('apps/control-plane/src/components/BrandingPanel.jsx');
    const entitlementsPanel = read('apps/control-plane/src/components/EntitlementsPanel.jsx');

    assert.match(admin, /TENANT_SERVICE_ROLE_KEY_UNCONFIGURED/);
    assert.match(configSync, /TENANT_RUNTIME_NOT_CONFIGURED/);
    assert.match(configSync, /tenant_runtime_not_configured/);
    assert.match(entitlementSync, /TENANT_RUNTIME_NOT_CONFIGURED/);
    assert.match(entitlementSync, /tenant_runtime_not_configured/);
    assert.match(brandingPanel, /Runtime connection required first/);
    assert.match(entitlementsPanel, /Runtime connection required first/);
  });

  it('admin tenant updates validate activation and domain ownership before mutation', () => {
    const source = read('supabase-control-plane/functions/admin-update-tenant/index.ts');
    const migration = read('supabase-control-plane/migrations/00010000000009_control_plane_atomic_tenant_update.sql');

    assert.match(migration, /create or replace function public\.admin_update_tenant_atomic/);
    assert.match(migration, /select status\s+into v_existing_status[\s\S]*for update/);
    assert.match(migration, /DOMAIN_TAKEN/);
    assert.match(migration, /TENANT_ACTIVATION_BLOCKED/);
    assert.match(migration, /insert into public\.tenant_events/);
    assert.match(migration, /revoke execute on function public\.admin_update_tenant_atomic/);
    assert.match(migration, /grant execute on function public\.admin_update_tenant_atomic[\s\S]*to service_role/);
    assert.match(source, /TENANT_NOT_FOUND/);
    assert.match(source, /INVALID_TENANT_STATUS_TRANSITION/);
    assert.match(source, /\.rpc\('admin_update_tenant_atomic'/);
    assert.doesNotMatch(source, /from\('tenant_domains'\)\.insert/);
    assert.doesNotMatch(source, /from\('tenant_domains'\)\.update/);
    assert.doesNotMatch(source, /from\('tenants'\)\.update/);
  });

  it('tenant lifecycle supports reversible documented states with guarded activation', () => {
    const migration = read('supabase-control-plane/migrations/00010000000008_control_plane_tenant_lifecycle_transitions.sql');
    const adminUpdate = read('supabase-control-plane/functions/admin-update-tenant/index.ts');
    const catalog = read('apps/control-plane/src/data/saasCatalog.js');

    assert.match(migration, /'draft'/);
    assert.match(migration, /'archived'/);
    assert.match(migration, /enforce_tenant_status_transition/);
    assert.match(migration, /INVALID_TENANT_INITIAL_STATUS/);
    assert.match(migration, /TENANT_ACTIVATION_REQUIRES_ACTIVE_DOMAIN/);
    assert.match(migration, /INVALID_TENANT_STATUS_TRANSITION/);
    assert.match(migration, /old\.status = 'archived'/);
    assert.match(adminUpdate, /INVALID_TENANT_STATUS_TRANSITION/);
    assert.match(adminUpdate, /canTransitionTenantStatus/);
    assert.match(adminUpdate, /TENANT_ACTIVATION_BLOCKED/);
    assert.match(catalog, /code: 'draft'/);
    assert.match(catalog, /code: 'archived'/);
  });

  it('insurance payments are entitlement-gated and do not use mock coverage math', () => {
    const page = read('apps/clinic-ops/src/pages/CreateBillPage.jsx');
    const payments = read('packages/core/services/payments.js');
    const billingEntitlements = read('packages/core/lib/billingEntitlements.js');
    const catalog = read('apps/control-plane/src/data/saasCatalog.js');

    assert.match(page, /useEntitlements/);
    assert.match(page, /hasPaymentMethodAccess/);
    assert.match(page, /paymentService\.create\(invoiceData, \{ entitlements \}\)/);
    assert.doesNotMatch(page, /Mock coverage|Eligibility Active|copay|insuranceCoverage/);
    assert.match(payments, /requirePaymentMethodAccess\(options\.entitlements, data\.payment_method\)/);
    assert.match(billingEntitlements, /ENTITLEMENT_FEATURES\.insuranceBilling/);
    assert.match(catalog, /code: 'insurance_billing'/);
  });

  it('clinics use reversible archive semantics instead of browser hard delete', () => {
    const service = read('packages/core/services/clinics.js');
    const selects = read('packages/core/lib/selects.js');
    const migration = read('supabase/migrations/20260508145542_clinic_soft_archive.sql');

    assert.doesNotMatch(service, /from\('clinics'\)\.delete\(/);
    assert.match(service, /async archive\(id, archivedBy = null\)/);
    assert.match(service, /is_archived: true/);
    assert.match(service, /archived_at: new Date\(\)\.toISOString\(\)/);
    assert.match(service, /archived_by: archivePayload\.archivedBy \?\? null/);
    assert.match(service, /async delete\(id, archivedBy = null\)[\s\S]*return clinicService\.archive\(id, archivedBy\)/);
    assert.match(service, /\.eq\('is_archived', false\)/);
    assert.match(selects, /'is_archived'/);
    assert.match(selects, /'archived_at'/);
    assert.match(selects, /'archived_by'/);
    assert.match(migration, /add column if not exists is_archived boolean not null default false/);
    assert.match(migration, /add column if not exists archived_at timestamptz/);
    assert.match(migration, /add column if not exists archived_by uuid references public\.users\(id\)/);
    assert.match(migration, /create index if not exists idx_clinics_active_name/);
    assert.match(migration, /drop policy if exists clinics_staff_delete on public\.clinics/);
  });
});
