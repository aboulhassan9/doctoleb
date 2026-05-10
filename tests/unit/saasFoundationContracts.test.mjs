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

  it('control-plane admin CORS defaults to explicit console origins and rejects unknown browser origins', () => {
    const source = read('supabase-control-plane/functions/_shared/admin.ts');

    assert.match(source, /DEFAULT_CONTROL_PLANE_ALLOWED_ORIGINS/);
    assert.match(source, /https:\/\/doctoleb-control-plane\.vercel\.app/);
    assert.match(source, /http:\/\/localhost:3003/);
    assert.match(source, /http:\/\/127\.0\.0\.1:3003/);
    assert.doesNotMatch(source, /CONTROL_PLANE_ALLOWED_ORIGINS'\)\s*\?\?\s*['"`]\*['"`]/);
    assert.match(source, /origin !== '\*'/);
    assert.match(source, /ORIGIN_NOT_ALLOWED/);
    assert.match(source, /rejectDisallowedOrigin\(req\)/);
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

  it('backend contract audit prevents clinical or PHI-owned tables from entering the control plane', () => {
    const audit = read('scripts/backend-contract-audit.mjs');

    assert.match(audit, /assertNoClinicalDataInControlPlane/);
    assert.match(audit, /supabase-control-plane/);
    assert.match(audit, /clinical_notes/);
    assert.match(audit, /patient_consents/);
    assert.match(audit, /message_attachments/);
    assert.match(audit, /diagnosis_text/);
  });

  it('patient app always boots the tenant-branded patient surface', () => {
    const source = read('apps/patient-web/src/App.jsx');

    assert.match(source, /TenantPortalShell/);
    assert.match(source, /TenantBootstrap appSurface=\{APP_SURFACES\.patientWeb\}/);
    assert.doesNotMatch(source, /MarketingShell/);
    assert.doesNotMatch(source, /classifyCurrentLocation/);
    assert.doesNotMatch(source, /SURFACES\.marketing/);
  });

  it('patient-web root landing page is the clinic-branded patient surface, not DoctoLeb SaaS marketing', () => {
    const app = read('apps/patient-web/src/App.jsx');
    const landing = read('apps/patient-web/src/pages/LandingPage.jsx');

    assert.match(app, /<Route path="\/" element=\{<AuthRedirect intendedSurface="patient-web"><LandingPage \/><\/AuthRedirect>\}/);
    assert.match(app, /<Route path="\/marketing" element=\{<AuthRedirect intendedSurface="patient-web"><LandingPage \/><\/AuthRedirect>\}/);
    assert.match(landing, /useBrand/);
    assert.match(landing, /Doctor-led clinic access/);
    assert.match(landing, /Patient care starts here\./);
    assert.match(landing, /Available patient services/);
    assert.match(landing, /Private patient access/);
    assert.match(landing, /Patient Registration/);
    assert.match(landing, /formatWebsiteHref/);
    assert.match(landing, /\['http:', 'https:'\]\.includes\(parsed\.protocol\)/);
    assert.match(read('packages/ui/contexts/BrandContext.jsx'), /doctor_display_name/);
    assert.doesNotMatch(landing, /Clinic SaaS for doctors/);
    assert.doesNotMatch(landing, /DoctoLeb gives doctors/);
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

  it('GitHub Actions runs real Chromium browser smoke checks after Vercel deploys', () => {
    const workflow = read('.github/workflows/ci.yml');
    const pkg = JSON.parse(read('package.json'));
    const smoke = read('scripts/browser-smoke.mjs');
    const helper = read('scripts/lib/browser-smoke-helpers.mjs');

    assert.equal(pkg.scripts['smoke:browser:deployed'], 'node scripts/browser-smoke.mjs');
    assert.match(workflow, /browser-smoke-vercel:/);
    assert.match(workflow, /needs:\s*\n\s*- deploy-vercel\s*\n\s*- smoke-vercel/);
    assert.match(workflow, /npx playwright install --with-deps chromium/);
    assert.match(workflow, /npm run smoke:browser:deployed/);
    assert.match(workflow, /path: output\/playwright\//);
    assert.match(smoke, /chromium\.launch/);
    assert.match(smoke, /doctoleb-patient-web\.vercel\.app/);
    assert.match(smoke, /doctoleb-clinic-ops\.vercel\.app/);
    assert.match(smoke, /doctoleb-control-plane\.vercel\.app/);
    assert.match(smoke, /Wrong portal/);
    assert.match(smoke, /SURFACE_MISMATCH/);
    assert.match(helper, /net::ERR_ABORTED/);
  });

  it('CI smoke checks deployed control-plane admin CORS preflight behavior', () => {
    const workflow = read('.github/workflows/ci.yml');
    const pkg = JSON.parse(read('package.json'));
    const smoke = read('scripts/control-plane-admin-cors-smoke.mjs');

    assert.equal(pkg.scripts['smoke:control-plane-admin-cors'], 'node scripts/control-plane-admin-cors-smoke.mjs');
    assert.match(workflow, /control-plane-admin-cors-smoke:/);
    assert.match(workflow, /npm run smoke:control-plane-admin-cors/);
    assert.match(smoke, /ORIGIN_NOT_ALLOWED/);
    assert.match(smoke, /https:\/\/doctoleb-control-plane\.vercel\.app/);
    assert.match(smoke, /admin-list-tenants/);
  });

  it('CI smoke checks the public tenant resolver HTTP contract after deploy', () => {
    const workflow = read('.github/workflows/ci.yml');
    const pkg = JSON.parse(read('package.json'));
    const smoke = read('scripts/tenant-resolver-smoke.mjs');

    assert.equal(pkg.scripts['smoke:tenant-resolver'], 'node scripts/tenant-resolver-smoke.mjs');
    assert.match(workflow, /tenant-resolver-smoke:/);
    assert.match(workflow, /npm run smoke:tenant-resolver/);
    assert.match(workflow, /needs:\s*\n\s*- deploy-vercel\s*\n\s*- smoke-vercel/);
    assert.match(smoke, /doctoleb-patient-web\.vercel\.app/);
    assert.match(smoke, /doctoleb-clinic-ops\.vercel\.app/);
    assert.match(smoke, /dev\.doctoleb\.com/);
    assert.match(smoke, /dev\.ops\.doctoleb\.com/);
    assert.match(smoke, /TENANT_NOT_FOUND/);
    assert.match(smoke, /SURFACE_MISMATCH/);
    assert.match(smoke, /TENANT_INACTIVE/);
    assert.match(smoke, /assertNoSecretMarkers/);
    assert.match(smoke, /supabaseAnonKey/);
    assert.match(smoke, /gezmfmskhmjgnquoyosq/);
  });

  it('CI scans every Vercel bundle for secrets and patient/ops fallback leakage', () => {
    const workflow = read('.github/workflows/ci.yml');
    const pkg = JSON.parse(read('package.json'));
    const audit = read('scripts/bundle-secret-audit.mjs');

    assert.equal(pkg.scripts['audit:bundle-secrets'], 'node scripts/bundle-secret-audit.mjs');
    assert.match(workflow, /Guard production bundle against secret leakage/);
    assert.match(workflow, /npm run audit:bundle-secrets/);
    assert.match(workflow, /BUNDLE_APP: \$\{\{ matrix\.app \}\}/);
    assert.match(workflow, /BUNDLE_DIR: \.vercel\/output\/static/);
    assert.doesNotMatch(workflow, /if:\s*matrix\.app != 'control-plane'/);
    assert.match(audit, /GENERAL_SECRET_MARKERS/);
    assert.match(audit, /TENANT_FALLBACK_MARKERS/);
    assert.match(audit, /DEFAULT_BUNDLE_TARGETS/);
    assert.match(audit, /resolveBundleTargets/);
    assert.match(audit, /apps\/patient-web\/dist/);
    assert.match(audit, /apps\/clinic-ops\/dist/);
    assert.match(audit, /apps\/control-plane\/dist/);
    assert.match(audit, /No bundle directories exist/);
    assert.match(audit, /app === 'control-plane'/);
    assert.match(audit, /c2VydmljZV9yb2xl/);
    assert.match(audit, /service\[_-\]\?role\[_-\]\?key/);
    assert.match(audit, /sb_secret_/);
    assert.match(audit, /vcp_/);
    assert.match(audit, /sk_\(live\|test\)_/);
    assert.match(audit, /gezmfmskhmjgnquoyosq/);
    assert.match(audit, /eyJhbGciOiJIUzI1Ni/);
  });

  it('GitHub Actions runs secret-backed auth smoke checks after Vercel deploys', () => {
    const workflow = read('.github/workflows/ci.yml');
    const pkg = JSON.parse(read('package.json'));
    const smoke = read('scripts/auth-login-smoke.mjs');

    assert.equal(pkg.scripts['smoke:auth:deployed'], 'node scripts/auth-login-smoke.mjs');
    assert.match(workflow, /auth-smoke-vercel:/);
    assert.match(workflow, /npm run smoke:auth:deployed/);
    assert.match(workflow, /AUTH_SMOKE_REQUIRED: 'true'/);
    assert.match(workflow, /AUTH_SMOKE_PATIENT_PASSWORD: \$\{\{ secrets\.AUTH_SMOKE_PATIENT_PASSWORD \}\}/);
    assert.match(workflow, /AUTH_SMOKE_CONTROL_OWNER_PASSWORD: \$\{\{ secrets\.AUTH_SMOKE_CONTROL_OWNER_PASSWORD \}\}/);
    assert.match(smoke, /getByLabel\(\/email\/i\)/);
    assert.match(smoke, /getByLabel\(\/\^password\$\/i\)/);
    assert.match(smoke, /verifyPatientBookingEntry/);
    assert.match(smoke, /\/patient-appointments/);
    assert.match(smoke, /getByLabel\('Doctor'\)/);
    assert.match(smoke, /patient-booking-doctor/);
    assert.match(smoke, /Appointment Date/);
    assert.match(smoke, /deployed-auth-login-qa-report\.json/);
    assert.doesNotMatch(smoke, /DEV_LOGIN_CREDENTIALS/);
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
    const providerAwareMigration = read('supabase-control-plane/migrations/00010000000015_control_plane_provider_aware_draft_steps.sql');
    const source = read('supabase-control-plane/functions/admin-create-provisioning-job/index.ts');
    const panel = read('apps/control-plane/src/components/ProvisioningPanel.jsx');
    const helpers = read('apps/control-plane/src/lib/provisioningDrafts.js');
    const idempotency = read('packages/core/lib/idempotency.js');

    assert.match(idempotencyMigration, /add column if not exists client_request_id text/);
    assert.match(idempotencyMigration, /tenant_provisioning_jobs_client_request_id_check/);
    assert.match(idempotencyMigration, /create unique index if not exists tenant_provisioning_jobs_client_request_id_key/);
    assert.match(draftMigration, /admin_create_tenant_draft_atomic/);
    assert.match(draftMigration, /alter column supabase_project_ref drop not null/);
    assert.match(draftMigration, /tenants_active_runtime_config_required/);
    assert.match(draftMigration, /tenant\.draft_created/);
    assert.match(draftMigration, /grant execute on function public\.admin_create_tenant_draft_atomic[\s\S]*to service_role/);
    assert.match(providerAwareMigration, /admin_seed_tenant_provisioning_steps/);
    assert.match(providerAwareMigration, /p_supabase_connection_id uuid default null/);
    assert.match(providerAwareMigration, /p_vercel_connection_id uuid default null/);
    assert.match(providerAwareMigration, /p_automation_mode text default 'manual'/);
    assert.match(providerAwareMigration, /on conflict \(provisioning_job_id, step_code\) do nothing/);
    assert.match(source, /normalizeClientRequestId/);
    assert.match(source, /\.rpc\('admin_create_tenant_draft_atomic'/);
    assert.match(source, /p_supabase_connection_id: supabaseConnectionId/);
    assert.match(source, /p_vercel_connection_id: vercelConnectionId/);
    assert.match(source, /p_automation_mode: automationMode/);
    assert.match(source, /TENANT_SLUG_TAKEN/);
    assert.match(source, /DOMAIN_TAKEN/);
    assert.match(source, /PROVIDER_CONNECTION_REQUIRED/);
    assert.match(source, /PROVIDER_CONNECTION_NOT_READY/);
    assert.doesNotMatch(source, /from\('tenant_provisioning_jobs'\)[\s\S]*\.insert/);
    assert.match(panel, /createClientRequestId/);
    assert.match(panel, /buildPendingTenantDomains/);
    assert.match(panel, /clientRequestId/);
    assert.match(panel, /automationMode/);
    assert.match(panel, /supabaseConnectionId/);
    assert.match(panel, /vercelConnectionId/);
    assert.match(helpers, /createClientRequestId/);
    assert.match(idempotency, /cryptoSource\?\.randomUUID/);
  });

  it('provider-connected provisioning stores secret references and undoable steps, not raw tokens', () => {
    const migration = read('supabase-control-plane/migrations/00010000000013_control_plane_provider_provisioning_backbone.sql');
    const advisorFix = read('supabase-control-plane/migrations/00010000000014_control_plane_provider_provisioning_advisor_fixes.sql');
    const providerAwareMigration = read('supabase-control-plane/migrations/00010000000015_control_plane_provider_aware_draft_steps.sql');
    const selects = read('supabase-control-plane/functions/_shared/selects.ts');
    const adr = read('docs/decisions/ADR-006-provider-connected-tenant-provisioning.md');

    assert.match(migration, /create table if not exists public\.provisioning_provider_connections/);
    assert.match(migration, /provider in \('supabase','vercel'\)/);
    assert.match(migration, /owner_scope in \('doctoleb','customer','partner'\)/);
    assert.match(migration, /secret_ref is null[\s\S]*or secret_ref !~\*/);
    assert.match(migration, /is_automation_enabled = false[\s\S]*secret_storage <> 'none'/);
    assert.match(migration, /add column if not exists supabase_connection_id/);
    assert.match(migration, /add column if not exists vercel_connection_id/);
    assert.match(migration, /automation_mode in \('manual','assisted','automatic'\)/);
    assert.match(migration, /create table if not exists public\.tenant_provisioning_steps/);
    assert.match(migration, /idempotency_key text not null/);
    assert.match(migration, /undo_strategy/);
    assert.match(migration, /undo_payload jsonb not null default '\{\}'::jsonb/);
    assert.match(migration, /alter table public\.provisioning_provider_connections enable row level security/);
    assert.match(migration, /alter table public\.tenant_provisioning_steps enable row level security/);
    assert.doesNotMatch(migration, /default\s+'(eyJ|sbp_|vcp_|sk_live_|sk_test_)/i);
    assert.match(advisorFix, /provisioning_provider_connections_created_by_idx/);
    assert.match(advisorFix, /provisioning_provider_connections_updated_by_idx/);
    assert.match(advisorFix, /alter function public\.enforce_tenant_provisioning_job_transition\(\)[\s\S]*set search_path = public/);
    assert.match(advisorFix, /alter function public\.enforce_tenant_status_transition\(\)[\s\S]*set search_path = public/);
    assert.match(providerAwareMigration, /create or replace function public\.admin_seed_tenant_provisioning_steps/);
    assert.match(providerAwareMigration, /tenant_draft_created/);
    assert.match(providerAwareMigration, /create_supabase_project/);
    assert.match(providerAwareMigration, /apply_tenant_migrations/);
    assert.match(providerAwareMigration, /configure_vercel_project/);
    assert.match(providerAwareMigration, /store_runtime_config/);
    assert.match(providerAwareMigration, /smoke_test_resolver/);
    assert.match(providerAwareMigration, /activate_tenant/);
    assert.match(providerAwareMigration, /undo_strategy/);
    assert.match(providerAwareMigration, /requiresManualApprovalBeforeDelete/);
    assert.match(providerAwareMigration, /runnerImplemented', false/);
    assert.match(selects, /CONTROL_PLANE_PROVIDER_CONNECTION_SELECT/);
    assert.match(selects, /CONTROL_PLANE_PROVISIONING_STEP_SELECT/);
    assert.match(adr, /customer-owned or partner-owned Supabase\/Vercel account/);
    assert.match(adr, /Browser code never receives provider tokens/);
  });

  it('provider connection admin APIs reject raw secrets and use reversible archive semantics', () => {
    const shared = read('supabase-control-plane/functions/_shared/providerConnections.ts');
    const list = read('supabase-control-plane/functions/admin-list-provider-connections/index.ts');
    const upsert = read('supabase-control-plane/functions/admin-upsert-provider-connection/index.ts');
    const archive = read('supabase-control-plane/functions/admin-archive-provider-connection/index.ts');
    const api = read('apps/control-plane/src/lib/controlPlaneApi.js');
    const handoff = read('SAAS_FOUNDATION_PHASE_HANDOFF.md');

    assert.match(shared, /TOKENISH_SECRET = \/\(eyJ\|sbp_\|vcp_\|sk_live_\|sk_test_\)/);
    assert.match(shared, /EDGE_FUNCTION_SECRET_REF/);
    assert.match(shared, /SECRET_INPUT_NOT_ALLOWED/);
    assert.match(shared, /UNSUPPORTED_AUTOMATION_SECRET_STORAGE/);
    assert.match(shared, /INVALID_EDGE_SECRET_REF/);
    assert.match(shared, /containsForbiddenSecretValue/);
    assert.match(shared, /TOKENISH_SECRET\.test\(value\)/);
    assert.match(shared, /delete copy\.secret_ref/);
    assert.match(shared, /has_secret_ref/);
    assert.match(shared, /PROVIDER_IMMUTABLE/);
    assert.match(shared, /USE_ARCHIVE_ENDPOINT/);
    assert.match(list, /requireSuperAdmin\(req\)/);
    assert.match(list, /CONTROL_PLANE_PROVIDER_CONNECTION_SELECT/);
    assert.match(list, /sanitizeProviderConnections/);
    assert.match(upsert, /requireSuperAdmin\(req, \['operator'\]\)/);
    assert.match(upsert, /normalizeProviderConnectionPatch/);
    assert.match(upsert, /provider_connection\.created/);
    assert.match(upsert, /provider_connection\.updated/);
    assert.match(archive, /requireSuperAdmin\(req, \['operator'\]\)/);
    assert.match(archive, /CONNECTION_IN_USE/);
    assert.match(archive, /status: 'archived'/);
    assert.match(archive, /is_automation_enabled: false/);
    assert.match(archive, /provider_connection\.archived/);
    assert.match(api, /admin-list-provider-connections/);
    assert.match(api, /admin-upsert-provider-connection/);
    assert.match(api, /admin-archive-provider-connection/);
    assert.match(handoff, /Provider Connection Metadata APIs/);
  });

  it('control-plane console can select provider connections and render the provisioning step ledger', () => {
    const consoleScreen = read('apps/control-plane/src/components/ConsoleScreen.jsx');
    const tenantCreationWorkspace = read('apps/control-plane/src/components/TenantCreationWorkspace.jsx');
    const tenantList = read('apps/control-plane/src/components/TenantList.jsx');
    const tenantDetailHook = read('apps/control-plane/src/hooks/useTenantDetail.js');
    const workspaceTabs = read('apps/control-plane/src/components/ConsoleWorkspaceTabs.jsx');
    const provisioningPanel = read('apps/control-plane/src/components/ProvisioningPanel.jsx');
    const brandPreviewCard = read('apps/control-plane/src/components/BrandPreviewCard.jsx');
    const provisioningClinicStep = read('apps/control-plane/src/components/provisioning/ProvisioningClinicStep.jsx');
    const provisioningDoctorStep = read('apps/control-plane/src/components/provisioning/ProvisioningDoctorStep.jsx');
    const provisioningHostingStep = read('apps/control-plane/src/components/provisioning/ProvisioningHostingStep.jsx');
    const provisioningReviewStep = read('apps/control-plane/src/components/provisioning/ProvisioningReviewStep.jsx');
    const provisioningWizardField = read('apps/control-plane/src/components/provisioning/WizardField.jsx');
    const provisioningWizard = read('apps/control-plane/src/lib/provisioningWizard.js');
    const provisioningWizardNav = read('apps/control-plane/src/components/ProvisioningWizardStepNav.jsx');
    const tenantReadinessPanel = read('apps/control-plane/src/components/TenantReadinessPanel.jsx');
    const tenantReadiness = read('apps/control-plane/src/lib/tenantReadiness.js');
    const providerPanel = read('apps/control-plane/src/components/ProviderConnectionsPanel.jsx');
    const stepsPanel = read('apps/control-plane/src/components/ProvisioningStepsPanel.jsx');
    const providerHelpers = read('apps/control-plane/src/lib/providerConnectionDrafts.js');
    const hook = read('apps/control-plane/src/hooks/useProviderConnections.js');
    const getTenant = read('supabase-control-plane/functions/admin-get-tenant/index.ts');

    assert.match(consoleScreen, /useProviderConnections/);
    assert.match(consoleScreen, /ProvisioningStepsPanel/);
    assert.match(consoleScreen, /TenantCreationWorkspace/);
    assert.match(consoleScreen, /workspaceMode/);
    assert.match(consoleScreen, /setWorkspaceMode\('create'\)/);
    assert.match(consoleScreen, /setWorkspaceMode\('tenant'\)/);
    assert.match(consoleScreen, /ConsoleWorkspaceTabs/);
    assert.match(consoleScreen, /TenantReadinessPanel/);
    assert.match(consoleScreen, /setActiveSection\('provisioning'\)/);
    assert.match(consoleScreen, /tenantDetailId = workspaceMode === 'tenant' \? selectedTenant\?\.id : null/);
    assert.match(consoleScreen, /useTenantDetail\(tenantDetailId\)/);
    assert.match(tenantDetailHook, /if \(!tenantId\)/);
    assert.match(tenantDetailHook, /setTenantDetail\(null\)/);
    assert.match(tenantDetailHook, /setError\(''\)/);
    assert.doesNotMatch(consoleScreen, /activeSection === 'setup'/);
    assert.doesNotMatch(consoleScreen, /sectionContextLabel/);
    assert.match(tenantList, /\+ New tenant/);
    assert.match(tenantList, /onCreateTenant/);
    assert.match(tenantList, /isCreatingTenant/);
    assert.match(tenantList, /Open tenant/);
    assert.match(tenantCreationWorkspace, /New tenant setup/);
    assert.match(tenantCreationWorkspace, /Back to selected tenant/);
    assert.match(tenantCreationWorkspace, /CREATE_WORKSPACE_PANELS/);
    assert.match(tenantCreationWorkspace, /Create tenant/);
    assert.match(tenantCreationWorkspace, /Provider accounts/);
    assert.match(tenantCreationWorkspace, /activePanel/);
    assert.match(tenantCreationWorkspace, /ProviderConnectionsPanel/);
    assert.match(tenantCreationWorkspace, /ProvisioningPanel/);
    assert.ok(
      tenantCreationWorkspace.indexOf('<ProvisioningPanel') < tenantCreationWorkspace.indexOf('<ProviderConnectionsPanel'),
      'new tenant wizard should remain the default setup experience before optional provider-account setup',
    );
    assert.match(workspaceTabs, /CONTROL_PLANE_SECTIONS/);
    assert.match(workspaceTabs, /role="tablist"/);
    assert.match(workspaceTabs, /role="tab"/);
    assert.doesNotMatch(workspaceTabs, /id: 'setup'/);
    for (const section of ['tenant', 'domains', 'provisioning', 'branding', 'features', 'audit']) {
      assert.match(workspaceTabs, new RegExp(`id: '${section}'`));
      assert.match(consoleScreen, new RegExp(`activeSection === '${section}'`));
    }
    assert.match(provisioningWizard, /PROVISIONING_WIZARD_STEPS/);
    assert.match(provisioningWizard, /id: 'clinic'/);
    assert.match(provisioningWizard, /id: 'doctor'/);
    assert.match(provisioningWizard, /title: 'First doctor setup'/);
    assert.match(provisioningWizard, /id: 'hosting'/);
    assert.match(provisioningWizard, /id: 'review'/);
    assert.match(provisioningWizardNav, /New tenant creation steps/);
    assert.match(provisioningWizardNav, /aria-current=\{isActive \? 'step' : undefined\}/);
    assert.match(provisioningWizardNav, /Complete previous steps first/);
    assert.doesNotMatch(provisioningWizardNav, /role="tablist"/);
    assert.doesNotMatch(provisioningWizardNav, /role="tab"/);
    assert.match(provisioningPanel, /activeWizardStep/);
    assert.match(provisioningPanel, /unlockedWizardStepIndex/);
    assert.match(provisioningPanel, /goToUnlockedStep/);
    assert.match(provisioningPanel, /getProvisioningWizardStepIndex/);
    assert.match(provisioningPanel, /role="region"/);
    assert.doesNotMatch(provisioningPanel, /role="tabpanel"/);
    assert.match(provisioningPanel, /Guided tenant launch/);
    assert.match(provisioningPanel, /Separate from current tenant editing/);
    assert.match(provisioningPanel, /ProvisioningClinicStep/);
    assert.match(provisioningPanel, /ProvisioningDoctorStep/);
    assert.match(provisioningPanel, /ProvisioningHostingStep/);
    assert.match(provisioningPanel, /ProvisioningReviewStep/);
    assert.doesNotMatch(provisioningPanel, /function renderClinicStep/);
    assert.doesNotMatch(provisioningPanel, /function renderDoctorStep/);
    assert.doesNotMatch(provisioningPanel, /function renderHostingStep/);
    assert.doesNotMatch(provisioningPanel, /function renderReviewStep/);
    assert.match(provisioningPanel, /buildTenantBrandingDraft/);
    assert.match(provisioningClinicStep, /BrandPreviewCard/);
    assert.match(provisioningClinicStep, /Clinic name/);
    assert.match(provisioningDoctorStep, /First doctor admin/);
    assert.match(provisioningHostingStep, /No purchased domain required now/);
    assert.match(provisioningReviewStep, /Pending routing rows/);
    assert.match(provisioningWizardField, /grid gap-2/);
    assert.match(brandPreviewCard, /Tenant app preview/);
    assert.match(brandPreviewCard, /Patient portal preview/);
    assert.match(brandPreviewCard, /Doctor workspace preview/);
    assert.match(brandPreviewCard, /branding\.primary_color/);
    assert.match(brandPreviewCard, /branding\.secondary_color/);
    assert.match(provisioningPanel, /getNextProvisioningWizardStepId/);
    assert.match(tenantReadinessPanel, /Readiness proof/);
    assert.match(tenantReadinessPanel, /Zero-PHI SaaS checks/);
    assert.match(tenantReadiness, /Patient web online/);
    assert.match(tenantReadiness, /Doctor\/staff web online/);
    assert.match(tenantReadiness, /Flutter app path prepared/);
    assert.match(provisioningPanel, /filterAutomatableConnections/);
    assert.match(provisioningPanel, /validateProvisioningProviderSelection/);
    assert.match(providerHelpers, /Assisted or automatic provisioning requires/);
    assert.match(providerPanel, /upsertProviderConnection/);
    assert.match(providerPanel, /archiveProviderConnection/);
    assert.match(providerPanel, /Raw provider tokens, service-role keys, and management keys never enter/);
    assert.match(stepsPanel, /idempotency key and undo strategy/);
    assert.match(stepsPanel, /Open Supabase projects/);
    assert.match(stepsPanel, /Open Vercel dashboard/);
    assert.match(stepsPanel, /Open patient web alias/);
    assert.match(stepsPanel, /external_resource_url/);
    assert.match(providerHelpers, /TOKENISH_SECRET/);
    assert.match(providerHelpers, /Automation can be enabled only for an active connection/);
    assert.match(hook, /listProviderConnections/);
    assert.match(getTenant, /CONTROL_PLANE_PROVISIONING_STEP_SELECT/);
    assert.match(getTenant, /provisioningSteps/);
  });

  it('provisioning runner executes only safe server-owned steps and refuses fake external automation', () => {
    const migration = read('supabase-control-plane/migrations/00010000000016_control_plane_provisioning_step_runner.sql');
    const runner = read('supabase-control-plane/functions/admin-run-provisioning-step/index.ts');
    const providerExecution = read('supabase-control-plane/functions/_shared/providerExecution.ts');
    const api = read('apps/control-plane/src/lib/controlPlaneApi.js');
    const consoleScreen = read('apps/control-plane/src/components/ConsoleScreen.jsx');
    const stepsPanel = read('apps/control-plane/src/components/ProvisioningStepsPanel.jsx');

    assert.match(migration, /create or replace function public\.admin_mark_provisioning_step_running/);
    assert.match(migration, /create or replace function public\.admin_record_provisioning_step_result_atomic/);
    assert.match(migration, /for update/);
    assert.match(migration, /tenant\.provisioning_step_started/);
    assert.match(migration, /tenant\.provisioning_step_succeeded/);
    assert.match(migration, /tenant\.provisioning_step_failed/);
    assert.match(migration, /revoke execute on function public\.admin_mark_provisioning_step_running/);
    assert.match(migration, /grant execute on function public\.admin_record_provisioning_step_result_atomic[\s\S]*to service_role/);
    assert.doesNotMatch(migration, /vcp_|sbp_|service_role_key/i);

    assert.match(runner, /requireSuperAdmin\(req, \['operator'\]\)/);
    assert.match(runner, /SAFE_RUNNER_STEPS/);
    assert.match(runner, /provider_connections_selected/);
    assert.match(runner, /create_supabase_project/);
    assert.match(runner, /runCreateSupabaseProject/);
    assert.match(runner, /operator_supplied_project_ref/);
    assert.match(runner, /SUPABASE_PROJECT_RUNTIME_CONFIG_REQUIRED/);
    assert.match(runner, /apply_tenant_migrations/);
    assert.match(runner, /runApplyTenantMigrations/);
    assert.match(runner, /createTenantServiceClient/);
    assert.match(runner, /getTenantServiceRoleKey/);
    assert.match(runner, /tenant_profile/);
    assert.match(runner, /tenant_app_config/);
    assert.match(runner, /TENANT_SERVICE_ROLE_SECRET_REQUIRED/);
    assert.match(runner, /TENANT_MIGRATIONS_NOT_READY/);
    assert.match(runner, /configure_vercel_project/);
    assert.match(runner, /runConfigureVercelProject/);
    assert.match(runner, /VERCEL_ROUTING_DOMAIN_REQUIRED/);
    assert.match(runner, /store_runtime_config/);
    assert.match(runner, /smoke_test_resolver/);
    assert.match(runner, /runSmokeTestResolver/);
    assert.match(runner, /resolve_tenant/);
    assert.match(runner, /activate_tenant/);
    assert.match(runner, /runActivateTenant/);
    assert.match(runner, /admin_update_tenant_atomic/);
    assert.match(runner, /smokePublicResolver/);
    assert.match(runner, /TENANT_ACTIVE_DOMAIN_REQUIRED/);
    assert.match(runner, /STEP_NOT_AUTOMATED/);
    assert.match(runner, /STEP_PRECONDITION_FAILED/);
    assert.match(runner, /\.rpc\('admin_mark_provisioning_step_running'/);
    assert.match(runner, /\.rpc\('admin_record_provisioning_step_result_atomic'/);
    assert.match(runner, /recordFailure/);
    assert.match(runner, /p_external_resource_kind: result\?\.externalResourceKind/);
    assert.match(runner, /externalResourceKind: 'supabase_project'/);
    assert.match(runner, /externalResourceId: tenant\.supabase_project_ref/);
    assert.match(runner, /externalResourceKind: 'vercel_routing'/);
    assert.match(runner, /externalResourceKind: 'control_plane_tenant_status'/);
    assert.match(runner, /CONTROL_PLANE_PROVISIONING_STEP_SELECT/);
    assert.match(runner, /CONTROL_PLANE_DOMAIN_SELECT/);
    assert.match(runner, /CONTROL_PLANE_PROVISIONING_JOB_SELECT/);
    assert.doesNotMatch(runner, /fetch\(['"`]https:\/\/api\.vercel\.com/);
    assert.doesNotMatch(runner, /fetch\(['"`]https:\/\/api\.supabase\.com/);

    assert.match(providerExecution, /verifyProviderCredential/);
    assert.match(providerExecution, /Deno\.env\.get\(secretRef\)/);
    assert.match(providerExecution, /https:\/\/api\.supabase\.com\/v1\/projects/);
    assert.match(providerExecution, /https:\/\/api\.vercel\.com\/v2\/user/);
    assert.match(providerExecution, /Authorization: `Bearer \$\{token\}`/);
    assert.match(providerExecution, /PROVIDER_SECRET_NOT_CONFIGURED/);
    assert.match(providerExecution, /PROVIDER_SECRET_STORAGE_UNSUPPORTED/);
    assert.match(providerExecution, /PROVIDER_AUTH_FAILED/);
    assert.doesNotMatch(providerExecution, /return \{[\s\S]{0,80}token/);

    assert.match(api, /runProvisioningStep/);
    assert.match(api, /admin-run-provisioning-step/);
    assert.match(consoleScreen, /handleRunProvisioningStep/);
    assert.match(consoleScreen, /runningStepId/);
    assert.match(stepsPanel, /Run safe check/);
    assert.match(stepsPanel, /onRunStep/);
    assert.match(stepsPanel, /activate_tenant/);
  });

  it('provisioning jobs can be cancelled and completed steps can be compensated through admin APIs only', () => {
    const migration = read('supabase-control-plane/migrations/00010000000018_control_plane_provisioning_cancel_compensate.sql');
    const cancelFunction = read('supabase-control-plane/functions/admin-cancel-provisioning-job/index.ts');
    const compensateFunction = read('supabase-control-plane/functions/admin-compensate-provisioning-step/index.ts');
    const api = read('apps/control-plane/src/lib/controlPlaneApi.js');
    const consoleScreen = read('apps/control-plane/src/components/ConsoleScreen.jsx');
    const stepsPanel = read('apps/control-plane/src/components/ProvisioningStepsPanel.jsx');

    assert.match(migration, /create or replace function public\.admin_cancel_provisioning_job_atomic/);
    assert.match(migration, /create or replace function public\.admin_mark_provisioning_step_rolled_back_atomic/);
    assert.match(migration, /for update/);
    assert.match(migration, /TENANT_ALREADY_ACTIVE/);
    assert.match(migration, /status = 'cancelled'/);
    assert.match(migration, /status = 'rolled_back'/);
    assert.match(migration, /tenant\.provisioning_job_cancelled/);
    assert.match(migration, /tenant\.provisioning_step_rolled_back/);
    assert.match(migration, /revoke execute on function public\.admin_cancel_provisioning_job_atomic/);
    assert.match(migration, /grant execute on function public\.admin_mark_provisioning_step_rolled_back_atomic[\s\S]*to service_role/);
    assert.doesNotMatch(migration, /delete from public\.(tenants|tenant_provisioning_jobs|tenant_provisioning_steps)/);

    assert.match(cancelFunction, /requireSuperAdmin\(req, \['operator'\]\)/);
    assert.match(cancelFunction, /normalizeUuid/);
    assert.match(cancelFunction, /\.rpc\('admin_cancel_provisioning_job_atomic'/);
    assert.match(cancelFunction, /PROVISIONING_JOB_NOT_CANCELLABLE/);
    assert.match(cancelFunction, /TENANT_ALREADY_ACTIVE/);
    assert.match(cancelFunction, /preflight\(req\)/);

    assert.match(compensateFunction, /requireSuperAdmin\(req, \['operator'\]\)/);
    assert.match(compensateFunction, /CONTROL_PLANE_PROVISIONING_STEP_SELECT/);
    assert.match(compensateFunction, /step\.status !== 'succeeded'/);
    assert.match(compensateFunction, /step\.undo_strategy === 'none'/);
    assert.match(compensateFunction, /admin_update_tenant_atomic/);
    assert.match(compensateFunction, /admin_mark_provisioning_step_rolled_back_atomic/);
    assert.match(compensateFunction, /COMPENSATION_NOT_AUTOMATED/);
    assert.doesNotMatch(compensateFunction, /fetch\(['"`]https:\/\/api\.(vercel|supabase)\.com/);

    assert.match(api, /cancelProvisioningJob/);
    assert.match(api, /admin-cancel-provisioning-job/);
    assert.match(api, /compensateProvisioningStep/);
    assert.match(api, /admin-compensate-provisioning-step/);
    assert.match(consoleScreen, /handleCancelProvisioningJob/);
    assert.match(consoleScreen, /handleCompensateProvisioningStep/);
    assert.match(consoleScreen, /tenant_provisioning_jobs/);
    assert.match(stepsPanel, /Cancel provisioning job/);
    assert.match(stepsPanel, /Compensate/);
    assert.match(stepsPanel, /undo_strategy !== 'none'/);
    assert.doesNotMatch(consoleScreen, /from\('tenant_provisioning_/);
  });

  it('tenant profile seeding is doctor-independent, service-role only, and runner-backed', () => {
    const migration = read('supabase/migrations/20260509022000_tenant_profile_seed_service.sql');
    const runner = read('supabase-control-plane/functions/admin-run-provisioning-step/index.ts');
    const branding = read('supabase-control-plane/functions/_shared/tenantBranding.ts');
    const configSync = read('supabase-control-plane/functions/admin-sync-tenant-config/index.ts');

    assert.match(migration, /alter table public\.tenant_profile\s+alter column doctor_id drop not null/);
    assert.match(migration, /create or replace function public\.service_seed_tenant_profile/);
    assert.match(migration, /on conflict \(tenant_slug\) do update/);
    assert.match(migration, /on conflict \(profile_id\) do update/);
    assert.match(migration, /revoke execute on function public\.service_seed_tenant_profile/);
    assert.match(migration, /grant execute on function public\.service_seed_tenant_profile[\s\S]*to service_role/);
    assert.doesNotMatch(migration, /create table[\s\S]*(branding|brand)/i);
    assert.doesNotMatch(migration, /grant execute on function public\.service_seed_tenant_profile[\s\S]*to anon/i);
    assert.doesNotMatch(migration, /grant execute on function public\.service_seed_tenant_profile[\s\S]*to authenticated/i);

    assert.match(runner, /seed_tenant_profile/);
    assert.match(runner, /runSeedTenantProfile/);
    assert.match(runner, /\.rpc\('service_seed_tenant_profile'/);
    assert.match(runner, /TENANT_PROFILE_SEED_RPC_NOT_READY/);
    assert.match(runner, /TENANT_PROFILE_SEED_FAILED/);
    assert.match(runner, /tenantProfileSeeded: true/);
    assert.match(runner, /tenantAppConfigSeeded: true/);

    assert.match(branding, /normalizeTenantBranding/);
    assert.match(configSync, /normalizeTenantBranding/);
    assert.doesNotMatch(configSync, /const HEX =/);
  });

  it('first doctor admin provisioning is input-backed, Auth-backed, idempotent, and reversible', () => {
    const controlMigration = read('supabase-control-plane/migrations/00010000000017_control_plane_first_doctor_admin_inputs.sql');
    const tenantMigration = read('supabase/migrations/20260509023000_first_doctor_admin_seed_service.sql');
    const createJob = read('supabase-control-plane/functions/admin-create-provisioning-job/index.ts');
    const selects = read('supabase-control-plane/functions/_shared/selects.ts');
    const runner = read('supabase-control-plane/functions/admin-run-provisioning-step/index.ts');
    const panel = read('apps/control-plane/src/components/ProvisioningPanel.jsx');
    const doctorStep = read('apps/control-plane/src/components/provisioning/ProvisioningDoctorStep.jsx');

    assert.match(controlMigration, /first_doctor_email/);
    assert.match(controlMigration, /first_doctor_display_name/);
    assert.match(controlMigration, /admin_set_provisioning_first_doctor_atomic/);
    assert.match(controlMigration, /grant execute on function public\.admin_set_provisioning_first_doctor_atomic[\s\S]*to service_role/);
    assert.doesNotMatch(controlMigration, /grant execute on function public\.admin_set_provisioning_first_doctor_atomic[\s\S]*to anon/i);
    assert.doesNotMatch(controlMigration, /grant execute on function public\.admin_set_provisioning_first_doctor_atomic[\s\S]*to authenticated/i);

    assert.match(tenantMigration, /service_seed_first_doctor_admin/);
    assert.match(tenantMigration, /provisioning_client_request_id/);
    assert.match(tenantMigration, /when v_requested_role in \('doctor', 'secretary', 'predoctor'\)/);
    assert.match(tenantMigration, /on conflict \(user_id\) do update/);
    assert.match(tenantMigration, /grant execute on function public\.service_seed_first_doctor_admin[\s\S]*to service_role/);
    assert.doesNotMatch(tenantMigration, /grant execute on function public\.service_seed_first_doctor_admin[\s\S]*to anon/i);
    assert.doesNotMatch(tenantMigration, /grant execute on function public\.service_seed_first_doctor_admin[\s\S]*to authenticated/i);

    assert.match(createJob, /normalizeFirstDoctorAdmin/);
    assert.match(createJob, /admin_set_provisioning_first_doctor_atomic/);
    assert.match(createJob, /FIRST_DOCTOR_ADMIN_CONFIG_FAILED/);
    assert.match(selects, /first_doctor_email/);
    assert.match(selects, /first_doctor_display_name/);

    assert.match(runner, /seed_first_doctor_admin/);
    assert.match(runner, /runSeedFirstDoctorAdmin/);
    assert.match(runner, /FIRST_DOCTOR_ADMIN_INPUT_REQUIRED/);
    assert.match(runner, /inviteUserByEmail/);
    assert.match(runner, /\.rpc\('service_seed_first_doctor_admin'/);
    assert.match(runner, /deleteUser\(invitedAuthUserId, true\)/);
    assert.match(runner, /firstDoctorAdminInviteCreated: true/);

    assert.match(panel, /ProvisioningDoctorStep/);
    assert.match(doctorStep, /First doctor admin/);
    assert.match(panel, /firstDoctorEmail/);
    assert.match(panel, /firstDoctorDisplayName/);
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
    const getTenant = read('supabase-control-plane/functions/admin-get-tenant/index.ts');
    const configSync = read('supabase-control-plane/functions/admin-sync-tenant-config/index.ts');
    const entitlementSync = read('supabase-control-plane/functions/admin-sync-entitlements/index.ts');
    const brandingPanel = read('apps/control-plane/src/components/BrandingPanel.jsx');
    const brandingDrafts = read('apps/control-plane/src/lib/tenantBrandingDrafts.js');
    const entitlementsPanel = read('apps/control-plane/src/components/EntitlementsPanel.jsx');

    assert.match(admin, /TENANT_SERVICE_ROLE_KEY_UNCONFIGURED/);
    assert.match(getTenant, /readTenantRuntimeBranding/);
    assert.match(getTenant, /getTenantServiceRoleKey/);
    assert.match(getTenant, /runtimeBranding/);
    assert.match(getTenant, /TENANT_SERVICE_ROLE_NOT_CONFIGURED/);
    assert.match(configSync, /TENANT_RUNTIME_NOT_CONFIGURED/);
    assert.match(configSync, /tenant_runtime_not_configured/);
    assert.match(configSync, /nextTenantDisplayName/);
    assert.match(configSync, /TENANT_CONTROL_PLANE_SYNC_FAILED/);
    assert.match(entitlementSync, /TENANT_RUNTIME_NOT_CONFIGURED/);
    assert.match(entitlementSync, /tenant_runtime_not_configured/);
    assert.match(brandingPanel, /Runtime connection required first/);
    assert.match(brandingPanel, /runtimeBranding/);
    assert.match(brandingPanel, /Live tenant brand/);
    assert.match(brandingPanel, /without a redeploy/);
    assert.match(brandingDrafts, /buildTenantBrandingDraft/);
    assert.match(brandingDrafts, /updateTenantBrandingDraft/);
    assert.match(entitlementsPanel, /Runtime connection required first/);
  });

  it('patient and staff apps refresh tenant branding at runtime and do not hardcode doctor identity', () => {
    const brandContext = read('packages/ui/contexts/BrandContext.jsx');
    const migration = read('supabase/migrations/20260509170000_public_tenant_branding_doctor_identity.sql');

    assert.match(brandContext, /window\.addEventListener\('focus', refreshVisibleBrand\)/);
    assert.match(brandContext, /document\.addEventListener\('visibilitychange', refreshVisibleBrand\)/);
    assert.match(migration, /left join public\.doctors as d on d\.id = tp\.doctor_id/);
    assert.match(migration, /left join public\.users as u on u\.id = d\.user_id/);
    assert.match(migration, /nullif\(trim\(concat_ws\(' ', u\.first_name, u\.last_name\)\), ''\)/);
    assert.doesNotMatch(migration, /Dr\. Smith/);
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

  it('tenant app feature visibility is controlled by synced entitlements', () => {
    const tenantConfig = read('packages/core/services/tenantConfig.js');
    const featureVisibility = read('packages/core/lib/featureVisibility.js');
    const featureRoute = read('packages/ui/components/FeatureProtectedRoute.jsx');
    const sidebar = read('packages/ui/components/AppSidebar.jsx');
    const patientApp = read('apps/patient-web/src/App.jsx');
    const opsApp = read('apps/clinic-ops/src/App.jsx');
    const entitlementSync = read('supabase-control-plane/functions/admin-sync-entitlements/index.ts');
    const panel = read('apps/control-plane/src/components/EntitlementsPanel.jsx');
    const drafts = read('apps/control-plane/src/lib/entitlementDrafts.js');

    assert.match(tenantConfig, /\.in\('audience', audiences\)/);
    assert.match(tenantConfig, /'public', normalizedAudience/);
    assert.match(featureVisibility, /\/patient-messages/);
    assert.match(featureVisibility, /\/staff-messages/);
    assert.match(featureVisibility, /\/doctor-staff/);
    assert.match(featureVisibility, /\/doctor-reports/);
    assert.match(featureVisibility, /\/doctor-claims/);
    assert.match(featureRoute, /hasEntitlement/);
    assert.match(featureRoute, /failed closed/);
    assert.match(sidebar, /filterNavigationItemsByEntitlements/);
    assert.match(patientApp, /FeatureProtectedRoute/);
    assert.match(patientApp, /ENTITLEMENT_FEATURES\.messaging/);
    assert.match(opsApp, /ENTITLEMENT_FEATURES\.staffAccounts/);
    assert.match(opsApp, /ENTITLEMENT_FEATURES\.advancedReports/);
    assert.match(opsApp, /ENTITLEMENT_FEATURES\.insuranceBilling/);
    assert.match(entitlementSync, /audience: 'public'/);
    assert.match(entitlementSync, /staff_accounts[\s\S]*audience: 'staff'/);
    assert.match(entitlementSync, /resetFeatureCodes/);
    assert.match(entitlementSync, /\.delete\(\)[\s\S]*source', 'manual_override'/);
    assert.match(panel, /resolveEffectiveEntitlementState/);
    assert.match(drafts, /buildManualEntitlementSyncPayload/);
  });

  it('tenant messaging is also gated at the database boundary', () => {
    const migration = read('supabase/migrations/20260509173000_message_entitlement_gate.sql');

    assert.match(migration, /create or replace function public\.is_feature_enabled/);
    assert.match(migration, /from public\.feature_flags/);
    assert.match(migration, /false/);
    assert.match(migration, /public\.is_feature_enabled\('messaging'\)/);
    assert.match(migration, /create or replace function public\.can_access_conversation/);
    assert.match(migration, /drop policy if exists conversations_staff_insert/);
    assert.match(migration, /drop policy if exists conversation_participants_staff_insert/);
    assert.match(migration, /revoke all on function public\.is_feature_enabled\(text\) from public, anon, authenticated/);
    assert.match(migration, /grant execute on function public\.is_feature_enabled\(text\) to authenticated, service_role/);
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

  it('walk-in patient creation compensates failures without hard-deleting account rows', () => {
    const service = read('packages/core/services/patients.js');

    assert.match(service, /async createWalkIn/);
    assert.match(service, /newUserId/);
    assert.match(service, /is_active:\s*false/);
    assert.match(service, /walkin_compensation_failed/);
    assert.doesNotMatch(service, /from\('users'\)[\s\S]{0,120}\.delete\(\)/);
  });

  it('staff invite statuses match the database constraint', () => {
    const schemas = read('packages/core/schemas/index.js');
    const page = read('apps/clinic-ops/src/pages/DoctorStaffPage.jsx');
    const migration = read('supabase/migrations/202605060001_tier1_doctor_pivot.sql');

    assert.match(migration, /invite_status in \('none', 'invited', 'accepted', 'disabled'\)/);
    assert.match(schemas, /invite_status: z\.enum\(\['none', 'invited', 'accepted', 'disabled'\]\)/);
    assert.match(schemas, /default\('none'\)/);
    assert.match(page, /none: \{ label: 'Not Invited'/);
    assert.doesNotMatch(schemas, /not_invited/);
    assert.doesNotMatch(page, /not_invited/);
  });

  it('staff role creation is constrained to supported v1 app roles', () => {
    const roles = read('packages/core/lib/roles.js');
    const schemas = read('packages/core/schemas/index.js');
    const page = read('apps/clinic-ops/src/pages/DoctorStaffPage.jsx');
    const migration = read('supabase/migrations/20260509011000_staff_roles_v1_scope.sql');

    assert.match(roles, /SUPPORTED_STAFF_MEMBER_ROLES = Object\.freeze\(\[\s*'secretary',\s*'predoctor'/);
    assert.match(roles, /SUPPORTED_CONVERSATION_PARTICIPANT_ROLES = Object\.freeze/);
    assert.match(schemas, /role: z\.enum\(SUPPORTED_STAFF_MEMBER_ROLES\)/);
    assert.match(schemas, /role: z\.enum\(SUPPORTED_CONVERSATION_PARTICIPANT_ROLES\)/);
    assert.match(page, /SUPPORTED_STAFF_MEMBER_ROLES\.map/);
    assert.match(page, /Add supported v1 team members: secretaries and pre-doctors\./);
    assert.match(migration, /drop constraint if exists staff_members_role_check/);
    assert.match(migration, /check \(role in \('secretary', 'predoctor'\)\)/);
    assert.match(migration, /drop constraint if exists conversation_participants_role_check/);
    assert.match(migration, /check \(role in \('patient', 'doctor', 'secretary', 'predoctor', 'admin'\)\)/);
    assert.match(migration, /is_active = false/);
    assert.match(migration, /invite_status = 'disabled'/);
    assert.doesNotMatch(page, /value: 'nurse'/);
    assert.doesNotMatch(page, /value: 'assistant'/);
    assert.doesNotMatch(page, /value: 'junior_doctor'/);
  });

  it('staff onboarding uses the server-side invite lifecycle instead of browser row inserts', () => {
    const service = read('packages/core/services/staff.js');
    const schemas = read('packages/core/schemas/index.js');
    const page = read('apps/clinic-ops/src/pages/DoctorStaffPage.jsx');
    const migration = read('supabase/migrations/20260509012000_staff_invite_lifecycle.sql');
    const disableMigration = read('supabase/migrations/20260509013000_staff_member_disable_lifecycle.sql');
    const authTriggerFix = read('supabase/migrations/20260509014000_staff_invite_auth_trigger_role_fix.sql');
    const triggerRevoke = read('supabase/migrations/20260509015000_staff_lifecycle_trigger_execute_revoke.sql');
    const edgeFunction = read('supabase/functions/staff-invite/index.ts');
    const disableFunction = read('supabase/functions/staff-member-disable/index.ts');
    const ledger = read('BACKEND_CONTRACT_LEDGER.md');

    assert.match(schemas, /export const staffInviteSchema/);
    assert.match(schemas, /export const staffMemberUpdateSchema/);
    assert.match(schemas, /export const staffMemberDisableSchema/);
    assert.match(schemas, /client_request_id: optionalClientRequestId/);
    assert.match(service, /staffInviteSchema/);
    assert.match(service, /supabase\.functions\.invoke\('staff-invite'/);
    assert.match(service, /staffMemberUpdateSchema/);
    assert.match(service, /staffMemberDisableSchema/);
    assert.match(service, /supabase\.functions\.invoke\('staff-member-disable'/);
    assert.doesNotMatch(service, /from\('staff_members'\)[\s\S]{0,120}\.insert\(/);
    assert.doesNotMatch(service, /staffMemberSchema\.partial\(\)/);
    assert.doesNotMatch(service, /invite_status:\s*'disabled'/);
    assert.doesNotMatch(service, /\.update\(\{[\s\S]{0,80}is_active:\s*false/);
    assert.match(page, /staffService\.invite/);
    assert.match(page, /buildStaffUpdatePayload/);
    assert.match(page, /createClientRequestId/);
    assert.doesNotMatch(page, /staffService\.create/);
    assert.doesNotMatch(page, /doctor_id: doctorId/);
    assert.doesNotMatch(page, /updateField\('is_active'/);
    assert.match(migration, /invite_client_request_id uuid/);
    assert.match(migration, /staff_members_invite_client_request_id_key/);
    assert.match(migration, /create or replace function public\.create_staff_invite_domain_identity/);
    assert.match(migration, /security definer/);
    assert.match(migration, /revoke all on function public\.create_staff_invite_domain_identity/);
    assert.match(migration, /grant execute[\s\S]*to service_role/);
    assert.match(edgeFunction, /inviteUserByEmail/);
    assert.match(edgeFunction, /create_staff_invite_domain_identity/);
    assert.match(edgeFunction, /deleteUser\(invitedAuthUserId, true\)/);
    assert.match(edgeFunction, /auth\.getUser\(token\)/);
    assert.match(edgeFunction, /SUPPORTED_ROLES/);
    assert.match(edgeFunction, /ORIGIN_NOT_ALLOWED/);
    assert.match(disableMigration, /disabled_at timestamptz/);
    assert.match(disableMigration, /disabled_by uuid references public\.users\(id\)/);
    assert.match(disableMigration, /create or replace function public\.disable_staff_member_domain_identity/);
    assert.match(disableMigration, /previous_invite_status/);
    assert.match(disableMigration, /staff_invite_cancelled/);
    assert.match(disableMigration, /staff_member_disabled/);
    assert.match(disableMigration, /revoke all on function public\.disable_staff_member_domain_identity/);
    assert.match(disableMigration, /grant execute[\s\S]*to service_role/);
    assert.match(authTriggerFix, /create or replace function public\.handle_auth_user_created/);
    assert.match(authTriggerFix, /new\.raw_user_meta_data ->> 'role'/);
    assert.match(authTriggerFix, /v_requested_role in \('secretary', 'predoctor'\)/);
    assert.match(authTriggerFix, /insert into public\.patients[\s\S]*where v_role = 'patient'/);
    assert.match(authTriggerFix, /delete from public\.patients[\s\S]*where user_id = v_domain_user_id/);
    assert.match(authTriggerFix, /USER_EMAIL_ALREADY_LINKED/);
    assert.match(triggerRevoke, /revoke all on function public\.enforce_staff_members_server_lifecycle\(\)/);
    assert.match(triggerRevoke, /revoke all on function public\.handle_auth_user_created\(\)/);
    assert.match(disableFunction, /disable_staff_member_domain_identity/);
    assert.match(disableFunction, /auth\.getUser\(token\)/);
    assert.match(disableFunction, /previous_invite_status !== 'accepted'/);
    assert.match(disableFunction, /deleteUser\(authUserId, true\)/);
    assert.match(disableFunction, /ORIGIN_NOT_ALLOWED/);
    assert.match(ledger, /staff-invite/);
    assert.match(ledger, /staff-member-disable/);
    assert.equal(fs.existsSync(path.join(root, 'supabase/functions/staff-invite-cancel/index.ts')), false);
  });

  it('staff invite resend is idempotent, auditable, and server-owned', () => {
    const service = read('packages/core/services/staff.js');
    const schemas = read('packages/core/schemas/index.js');
    const selects = read('packages/core/lib/selects.js');
    const page = read('apps/clinic-ops/src/pages/DoctorStaffPage.jsx');
    const migration = read('supabase/migrations/20260509030000_staff_invite_resend_lifecycle.sql');
    const edgeFunction = read('supabase/functions/staff-invite-resend/index.ts');
    const functionsReadme = read('supabase/functions/README.md');
    const ledger = read('BACKEND_CONTRACT_LEDGER.md');
    const gapReview = read('DESIGN_CODE_SECURITY_GAP_REVIEW_20260509.md');

    assert.match(migration, /create table if not exists public\.staff_invite_resend_events/);
    assert.match(migration, /client_request_id uuid not null/);
    assert.match(migration, /staff_invite_resend_events_client_request_id_key/);
    assert.match(migration, /status text not null default 'pending'/);
    assert.match(migration, /status in \('pending', 'sent', 'failed', 'cancelled'\)/);
    assert.match(migration, /alter table public\.staff_invite_resend_events enable row level security/);
    assert.match(migration, /create or replace function public\.create_staff_invite_resend_event/);
    assert.match(migration, /create or replace function public\.finish_staff_invite_resend_event/);
    assert.match(migration, /for update/);
    assert.match(migration, /invite_status <> 'invited'/);
    assert.match(migration, /STAFF_INVITE_NOT_RESENDABLE/);
    assert.match(migration, /STAFF_INVITE_EMAIL_MISSING/);
    assert.match(migration, /revoke all on function public\.create_staff_invite_resend_event/);
    assert.match(migration, /revoke all on function public\.finish_staff_invite_resend_event/);
    assert.match(migration, /grant execute[\s\S]*to service_role/);
    assert.match(migration, /staff_invite_resent/);
    assert.doesNotMatch(migration, /delete from public\.staff_members/);

    assert.match(selects, /invite_resent_at/);
    assert.match(selects, /invite_resend_count/);
    assert.match(schemas, /export const staffInviteResendSchema/);
    assert.match(schemas, /client_request_id: z\.string\(\)\.uuid\(\)/);
    assert.match(service, /staffInviteResendSchema/);
    assert.match(service, /resendInvite/);
    assert.match(service, /supabase\.functions\.invoke\('staff-invite-resend'/);
    assert.doesNotMatch(service, /invite_resend_count:\s*/);
    assert.doesNotMatch(service, /\.update\(\{[\s\S]{0,120}invite_resent_at/);

    assert.match(edgeFunction, /auth\.getUser\(token\)/);
    assert.match(edgeFunction, /create_staff_invite_resend_event/);
    assert.match(edgeFunction, /inviteUserByEmail/);
    assert.match(edgeFunction, /finish_staff_invite_resend_event/);
    assert.match(edgeFunction, /AUTH_INVITE_FAILED/);
    assert.match(edgeFunction, /ORIGIN_NOT_ALLOWED/);
    assert.doesNotMatch(edgeFunction, /serviceRoleKey[^;]*json/);

    assert.match(page, /staffService\.resendInvite/);
    assert.match(page, /invite_status === 'invited'/);
    assert.match(page, /createClientRequestId/);
    assert.match(page, /Resend invite/);
    assert.doesNotMatch(page, /from\('staff_members'\)/);

    assert.match(functionsReadme, /staff-invite-resend/);
    assert.match(ledger, /staffService\.resendInvite/);
    assert.match(ledger, /staff-invite-resend/);
    assert.match(gapReview, /FIX-022/);
    assert.match(gapReview, /Resend invite/);
  });

  it('accepted staff reactivation is an undoable server-owned lifecycle', () => {
    const service = read('packages/core/services/staff.js');
    const schemas = read('packages/core/schemas/index.js');
    const selects = read('packages/core/lib/selects.js');
    const page = read('apps/clinic-ops/src/pages/DoctorStaffPage.jsx');
    const migration = read('supabase/migrations/20260509031000_staff_member_reactivation_lifecycle.sql');
    const edgeFunction = read('supabase/functions/staff-member-reactivate/index.ts');
    const functionsReadme = read('supabase/functions/README.md');
    const ledger = read('BACKEND_CONTRACT_LEDGER.md');
    const gapReview = read('DESIGN_CODE_SECURITY_GAP_REVIEW_20260509.md');

    assert.match(migration, /reactivated_at timestamptz/);
    assert.match(migration, /reactivated_by uuid references public\.users\(id\)/);
    assert.match(migration, /reactivation_count integer not null default 0/);
    assert.match(migration, /create or replace function public\.reactivate_staff_member_domain_identity/);
    assert.match(migration, /for update/);
    assert.match(migration, /coalesce\(v_staff\.disabled_previous_invite_status, ''\) <> 'accepted'/);
    assert.match(migration, /STAFF_MEMBER_NOT_REACTIVATABLE/);
    assert.match(migration, /invite_status = 'accepted'/);
    assert.match(migration, /is_active = true/);
    assert.match(migration, /staff_member_reactivated/);
    assert.match(migration, /revoke all on function public\.reactivate_staff_member_domain_identity/);
    assert.match(migration, /grant execute[\s\S]*to service_role/);
    assert.doesNotMatch(migration, /delete from public\.staff_members/);

    assert.match(selects, /reactivated_at/);
    assert.match(selects, /reactivation_count/);
    assert.match(schemas, /export const staffMemberReactivateSchema/);
    assert.match(service, /staffMemberReactivateSchema/);
    assert.match(service, /reactivate/);
    assert.match(service, /supabase\.functions\.invoke\('staff-member-reactivate'/);
    assert.doesNotMatch(service, /reactivated_at:\s*/);
    assert.doesNotMatch(service, /\.update\(\{[\s\S]{0,120}invite_status:\s*'accepted'/);

    assert.match(edgeFunction, /auth\.getUser\(token\)/);
    assert.match(edgeFunction, /reactivate_staff_member_domain_identity/);
    assert.match(edgeFunction, /STAFF_MEMBER_NOT_REACTIVATABLE/);
    assert.match(edgeFunction, /ORIGIN_NOT_ALLOWED/);
    assert.doesNotMatch(edgeFunction, /serviceRoleKey[^;]*json/);

    assert.match(page, /staffService\.reactivate/);
    assert.match(page, /disabled_previous_invite_status === 'accepted'/);
    assert.match(page, /Reactivate access/);
    assert.doesNotMatch(page, /from\('staff_members'\)/);

    assert.match(functionsReadme, /staff-member-reactivate/);
    assert.match(ledger, /staffService\.reactivate/);
    assert.match(ledger, /staff-member-reactivate/);
    assert.match(gapReview, /FIX-023/);
    assert.match(gapReview, /reactivation/);
  });

  it('cancelled pending staff invite reissue is idempotent, auditable, and server-owned', () => {
    const service = read('packages/core/services/staff.js');
    const schemas = read('packages/core/schemas/index.js');
    const selects = read('packages/core/lib/selects.js');
    const page = read('apps/clinic-ops/src/pages/DoctorStaffPage.jsx');
    const migration = read('supabase/migrations/20260509032000_staff_invite_reissue_lifecycle.sql');
    const edgeFunction = read('supabase/functions/staff-invite-reissue/index.ts');
    const functionsReadme = read('supabase/functions/README.md');

    assert.match(migration, /create table if not exists public\.staff_invite_reissue_events/);
    assert.match(migration, /client_request_id uuid not null/);
    assert.match(migration, /staff_invite_reissue_events_client_request_id_key/);
    assert.match(migration, /coalesce\(v_staff\.disabled_previous_invite_status, ''\) not in \('none', 'invited'\)/);
    assert.match(migration, /STAFF_INVITE_NOT_REISSUABLE/);
    assert.match(migration, /CLIENT_REQUEST_ID_CONFLICT/);
    assert.match(migration, /p_invited_auth_user_id/);
    assert.match(migration, /auth_user_id = p_invited_auth_user_id/);
    assert.match(migration, /invite_status = 'invited'/);
    assert.match(migration, /staff_invite_reissued/);
    assert.match(migration, /revoke all on function public\.create_staff_invite_reissue_event/);
    assert.match(migration, /grant execute[\s\S]*to service_role/);
    assert.doesNotMatch(migration, /delete from public\.staff_members/);

    assert.match(selects, /invite_reissued_at/);
    assert.match(selects, /invite_reissue_count/);
    assert.match(schemas, /export const staffInviteReissueSchema/);
    assert.match(service, /staffInviteReissueSchema/);
    assert.match(service, /reissueInvite/);
    assert.match(service, /supabase\.functions\.invoke\('staff-invite-reissue'/);
    assert.doesNotMatch(service, /\.update\(\{[\s\S]{0,120}invite_status:\s*'invited'/);

    assert.match(edgeFunction, /auth\.getUser\(token\)/);
    assert.match(edgeFunction, /create_staff_invite_reissue_event/);
    assert.match(edgeFunction, /inviteUserByEmail/);
    assert.match(edgeFunction, /finish_staff_invite_reissue_event/);
    assert.match(edgeFunction, /deleteUser\(invitedAuthUserId, true\)/);
    assert.match(edgeFunction, /ORIGIN_NOT_ALLOWED/);
    assert.doesNotMatch(edgeFunction, /serviceRoleKey[^;]*json/);

    assert.match(page, /staffService\.reissueInvite/);
    assert.match(page, /disabled_previous_invite_status/);
    assert.match(page, /Reissue cancelled invite/);
    assert.doesNotMatch(page, /from\('staff_members'\)/);

    assert.match(functionsReadme, /staff-invite-reissue/);
  });

  it('clinical note drafts are tenant-DB backed and do not persist PHI in browser storage', () => {
    const hook = read('apps/clinic-ops/src/hooks/useEncounterDraft.js');
    const tab = read('apps/clinic-ops/src/components/encounter/EncounterNotesTab.jsx');
    const service = read('packages/core/services/clinical.js');
    const schemas = read('packages/core/schemas/index.js');
    const selects = read('packages/core/lib/selects.js');
    const migration = read('supabase/migrations/20260509024000_clinical_note_drafts.sql');
    const readGrantMigration = read('supabase/migrations/20260509024500_revoke_clinical_note_draft_read_rpc.sql');
    const ttlMigration = read('supabase/migrations/20260509025000_schedule_clinical_note_draft_ttl.sql');

    assert.match(migration, /create table if not exists public\.clinical_note_drafts/);
    assert.match(migration, /alter table public\.clinical_note_drafts enable row level security/);
    assert.match(migration, /create or replace function public\.save_clinical_note_draft/);
    assert.match(migration, /create or replace function public\.get_active_clinical_note_draft/);
    assert.match(migration, /create or replace function public\.discard_clinical_note_draft/);
    assert.match(migration, /create or replace function public\.expire_clinical_note_drafts/);
    assert.match(migration, /unique_active_clinical_note_drafts/);
    assert.match(migration, /grant execute on function public\.save_clinical_note_draft[\s\S]*to authenticated/);
    assert.match(migration, /grant execute on function public\.expire_clinical_note_drafts[\s\S]*to service_role/);
    assert.match(readGrantMigration, /revoke all on function public\.get_active_clinical_note_draft\(uuid\) from public, anon, authenticated/);
    assert.match(readGrantMigration, /grant execute on function public\.get_active_clinical_note_draft\(uuid\) to service_role/);
    assert.match(ttlMigration, /create extension if not exists pg_cron/);
    assert.match(ttlMigration, /cron\.schedule/);
    assert.match(ttlMigration, /expire_clinical_note_drafts/);
    assert.match(schemas, /export const clinicalNoteDraftSaveSchema/);
    assert.match(schemas, /export const clinicalNoteDraftDiscardSchema/);
    assert.match(selects, /CLINICAL_NOTE_DRAFT_SELECT_FIELDS/);
    assert.match(service, /saveNoteDraft/);
    assert.match(service, /\.rpc\('save_clinical_note_draft'/);
    assert.match(service, /discardNoteDraft/);
    assert.match(hook, /clinicalService\.getNoteDraft/);
    assert.match(hook, /clinicalService\.saveNoteDraft/);
    assert.match(hook, /clinicalService\.discardNoteDraft/);
    assert.doesNotMatch(hook, /sessionStorage|localStorage|getItem|setItem/);
    assert.match(tab, /tenant clinical database/);
  });

  it('schedule availability removal is reversible deactivation, not hard delete', () => {
    const slots = read('packages/core/services/slots.js');
    const schedules = read('packages/core/services/schedules.js');
    const slotsPage = read('apps/clinic-ops/src/pages/SecretarySlotsPage.jsx');
    const schedulePage = read('apps/clinic-ops/src/pages/DoctorScheduleTemplatesPage.jsx');

    assert.doesNotMatch(slots, /from\('secretary_slots'\)\.delete\(/);
    assert.doesNotMatch(schedules, /from\('secretary_slots'\)[\s\S]{0,80}\.delete\(/);
    assert.doesNotMatch(schedules, /from\('doctor_schedule_templates'\)[\s\S]{0,80}\.delete\(/);
    assert.match(slots, /\.update\(\{ is_active: false \}\)/);
    assert.match(schedules, /return this\.deactivateTemplate\(id\)/);
    assert.match(slotsPage, /Confirm Deactivation/);
    assert.match(schedulePage, /Deactivate Schedule Template/);
  });

  it('appointment cancellation is a hardened lifecycle RPC with reversible slot release', () => {
    const migration = read('supabase/migrations/20260509020000_harden_cancel_appointment_lifecycle.sql');
    const service = read('packages/core/services/appointments.js');
    const schemas = read('packages/core/schemas/index.js');
    const patientAppointmentsPage = read('apps/patient-web/src/pages/PatientAppointmentsPage.jsx');
    const doctorAppointmentsPage = read('apps/clinic-ops/src/pages/DoctorAppointmentsPage.jsx');
    const cancelComponent = read('packages/ui/components/appointments/AppointmentCancelInlineConfirm.jsx');

    assert.match(migration, /create or replace function public\.cancel_appointment/);
    assert.match(migration, /security definer/);
    assert.match(migration, /auth\.uid\(\) is null/);
    assert.match(migration, /for update/);
    assert.match(migration, /Unauthorized: appointment does not belong to caller/);
    assert.match(migration, /status = 'cancelled'/);
    assert.match(migration, /set is_active = true/);
    assert.match(migration, /not exists[\s\S]*public\.appointments/);
    assert.match(migration, /public\.notify_role_event/);
    assert.doesNotMatch(migration, /public\.notifications/);
    assert.match(migration, /revoke all on function public\.cancel_appointment/);
    assert.match(migration, /grant execute on function public\.cancel_appointment[\s\S]*to authenticated, service_role/);

    assert.match(schemas, /export const appointmentCancelSchema/);
    assert.match(service, /appointmentCancelSchema/);
    assert.match(service, /\.rpc\('cancel_appointment'/);
    assert.doesNotMatch(service, /async cancel[\s\S]{0,900}\.from\('appointments'\)[\s\S]{0,120}\.update/);
    assert.match(cancelComponent, /Cancellation reason/);
    assert.match(cancelComponent, /disabled=\{submitting \|\| !trimmedReason\}/);
    assert.match(patientAppointmentsPage, /AppointmentCancelInlineConfirm/);
    assert.match(patientAppointmentsPage, /onConfirm=\{handleCancelAppointment\}/);
    assert.match(patientAppointmentsPage, /setCancelConfirmId\(id\)/);
    assert.match(doctorAppointmentsPage, /AppointmentCancelInlineConfirm/);
    assert.match(doctorAppointmentsPage, /appointmentService\.cancel\(appointmentId, reason\.trim\(\)\)/);
    assert.match(doctorAppointmentsPage, /setRefreshKey/);
  });

  it('tenant DB revokes browser hard-delete policies from protected records', () => {
    const migration = read('supabase/migrations/20260509010000_revoke_browser_hard_delete_policies.sql');
    const protectedPolicyDrops = [
      ['tier2_admin_delete', 'encounters'],
      ['tier2_admin_delete', 'clinical_notes'],
      ['tier2_admin_delete', 'diagnoses'],
      ['tier2_admin_delete', 'prescriptions'],
      ['tier2_admin_delete', 'lab_orders'],
      ['tier2_admin_delete', 'imaging_orders'],
      ['tier2_admin_delete', 'care_tasks'],
      ['tier2_admin_delete', 'clinical_documents'],
      ['tier2_admin_delete', 'document_attachments'],
      ['medical_intake_admin_delete', 'medical_intake'],
      ['patient_vaccinations_admin_delete', 'patient_vaccinations'],
      ['patient_surgeries_admin_delete', 'patient_surgeries'],
      ['patient_diseases_admin_delete', 'patient_diseases'],
      ['patient_family_history_admin_delete', 'patient_family_history'],
      ['tier2_admin_delete', 'consent_documents'],
      ['tier2_admin_delete', 'patient_consents'],
      ['tier2_admin_delete', 'patient_devices'],
      ['tier2_admin_delete', 'conversations'],
      ['tier2_admin_delete', 'conversation_participants'],
      ['tier2_admin_delete', 'messages'],
      ['tier2_admin_delete', 'message_attachments'],
      ['tier2_admin_delete', 'message_read_receipts'],
      ['tier2_admin_delete', 'notification_events'],
      ['tier2_admin_delete', 'notification_deliveries'],
      ['tier2_admin_delete', 'reminder_rules'],
      ['payments_scoped_delete', 'payments'],
      ['insurance_claims_admin_delete', 'insurance_claims'],
      ['patient_insurance_policies_admin_delete', 'patient_insurance_policies'],
      ['doctor_insurance_contracts_admin_delete', 'doctor_insurance_contracts'],
      ['secretary_slots_secretary_delete', 'secretary_slots'],
      ['doctor_schedule_templates_staff_delete', 'doctor_schedule_templates'],
      ['tier2_admin_delete', 'tenant_profile'],
      ['tier2_admin_delete', 'tenant_app_config'],
      ['tier2_admin_delete', 'feature_flags'],
      ['tier2_admin_delete', 'content_pages'],
      ['catalog_admin_delete', 'cities'],
      ['catalog_admin_delete', 'blood_groups'],
      ['catalog_admin_delete', 'occupations'],
      ['catalog_admin_delete', 'specialties'],
      ['catalog_admin_delete', 'vaccines'],
      ['catalog_admin_delete', 'diseases'],
      ['catalog_admin_delete', 'surgery_types'],
      ['catalog_admin_delete', 'family_relations'],
      ['catalog_admin_delete', 'visit_types'],
      ['catalog_admin_delete', 'insurance_providers'],
      ['catalog_admin_delete', 'claim_form_templates'],
      ['doctor_specialties_admin_delete', 'doctor_specialties'],
    ];

    for (const [policyName, tableName] of protectedPolicyDrops) {
      assert.match(
        migration,
        new RegExp(`drop policy if exists ${policyName} on public\\.${tableName};`),
        `${policyName} on ${tableName} must be revoked`,
      );
    }

    assert.match(migration, /drop policy if exists "Staff can delete billable services" on public\.billable_services;/);
    assert.match(migration, /audited service-role RPCs/);
    assert.match(migration, /does not delete data/);
    assert.match(migration, /catalog, and lookup records/);
  });

  it('GitHub Actions runs backend DB contract checks on a disposable local Supabase stack', () => {
    const workflow = read('.github/workflows/ci.yml');
    const script = read('scripts/backend-db-contract-tests.mjs');
    const config = read('supabase/config.toml');
    const readme = read('supabase/tests/README.md');

    assert.match(workflow, /BACKEND_DB_CONTRACT_REQUIRED: 'true'/);
    assert.match(workflow, /uses: supabase\/setup-cli@v1/);
    assert.match(workflow, /supabase start -x realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor/);
    assert.match(workflow, /supabase db reset --local --no-seed/);
    assert.match(workflow, /supabase status -o env/);
    assert.match(workflow, /BACKEND_TEST_DATABASE_URL<<EOF/);
    assert.match(workflow, /BACKEND_TEST_SUPABASE_URL<<EOF/);
    assert.match(workflow, /BACKEND_TEST_SUPABASE_ANON_KEY<<EOF/);
    assert.doesNotMatch(workflow, /BACKEND_TEST_DATABASE_URL: \$\{\{ secrets\.BACKEND_TEST_DATABASE_URL \}\}/);
    assert.match(workflow, /sudo apt-get update && sudo apt-get install -y postgresql-client/);
    assert.match(workflow, /supabase stop --no-backup \|\| true/);
    assert.match(config, /project_id = "doctoleb"/);
    assert.match(config, /major_version = 17/);
    assert.match(config, /\[db\.seed\]\s+enabled = false/);
    assert.match(config, /\[storage\]\s+enabled = true/);
    assert.match(script, /const contractRequired = env\.BACKEND_DB_CONTRACT_REQUIRED === 'true';/);
    assert.match(script, /BACKEND_TEST_ALLOW_LIVE_ANON_RPC/);
    assert.doesNotMatch(script, /BACKEND_TEST_ALLOW_LIVE_DB/);
    assert.match(script, /REQUIRED BUT SKIPPED/);
    assert.match(readme, /free-plan-safe path/);
    assert.match(readme, /supabase db reset --local --no-seed/);
  });

  it('Vercel app shell sets baseline browser security headers', () => {
    const vercel = read('vercel.json');
    const workflow = read('.github/workflows/ci.yml');
    const pkg = JSON.parse(read('package.json'));
    const smoke = read('scripts/csp-smoke.mjs');

    assert.match(vercel, /"headers"/);
    assert.match(vercel, /"X-Content-Type-Options"[\s\S]*"nosniff"/);
    assert.match(vercel, /"X-Frame-Options"[\s\S]*"DENY"/);
    assert.match(vercel, /"Referrer-Policy"[\s\S]*"strict-origin-when-cross-origin"/);
    assert.match(vercel, /"Permissions-Policy"/);
    assert.match(vercel, /"Content-Security-Policy-Report-Only"/);
    assert.match(vercel, /frame-ancestors 'none'/);
    assert.match(vercel, /connect-src 'self' https:\/\/\*\.supabase\.co wss:\/\/\*\.supabase\.co/);
    assert.doesNotMatch(vercel, /Content-Security-Policy-Report-Only[\s\S]*upgrade-insecure-requests/);
    assert.equal(pkg.scripts['smoke:csp:deployed'], 'node scripts/csp-smoke.mjs');
    assert.match(workflow, /csp-smoke-vercel:/);
    assert.match(workflow, /npm run smoke:csp:deployed/);
    assert.match(smoke, /content-security-policy-report-only/);
    assert.match(smoke, /must not include upgrade-insecure-requests/);
    assert.match(smoke, /CSP is enforced before the report-only browser suite is clean/);
  });

  it('CI runs first-band deployed flow smoke with shared Playwright safety helpers', () => {
    const workflow = read('.github/workflows/ci.yml');
    const pkg = JSON.parse(read('package.json'));
    const flowSmoke = read('scripts/deployed-flow-smoke.mjs');
    const helper = read('scripts/lib/browser-smoke-helpers.mjs');

    assert.equal(pkg.scripts['smoke:flows:deployed'], 'node scripts/deployed-flow-smoke.mjs');
    assert.match(workflow, /deployed-flow-smoke-vercel:/);
    assert.match(workflow, /npm run smoke:flows:deployed/);
    assert.match(workflow, /FLOW_SMOKE_REQUIRED: 'true'/);
    assert.match(workflow, /needs:\s*\n\s*- deploy-vercel\s*\n\s*- smoke-vercel\s*\n\s*- auth-smoke-vercel/);
    assert.match(flowSmoke, /patient-first-band/);
    assert.match(flowSmoke, /doctor-first-band/);
    assert.match(flowSmoke, /secretary-first-band/);
    assert.match(flowSmoke, /control-plane-first-band/);
    assert.match(flowSmoke, /deprecated Setup tab is still visible/);
    assert.match(flowSmoke, /getByRole\('button'[\s\S]+New tenant[\s\S]+click\(\{ timeout: 15_000 \}\)/);
    assert.match(flowSmoke, /getByRole\('heading', \{ name: \/New tenant setup\/i \}\)/);
    assert.match(flowSmoke, /FLOW_SMOKE_MUTATE_STAFF/);
    assert.match(flowSmoke, /assertLogoutAndStorageCleanup/);
    assert.match(flowSmoke, /assertNoClinicalDraftBrowserStorage/);
    assert.match(flowSmoke, /clinical draft markers found in browser storage keys/);
    assert.match(flowSmoke, /logout left auth storage keys/);
    assert.match(flowSmoke, /deployed-flow-qa-report\.json/);
    assert.match(helper, /collectRuntimeIssues/);
    assert.match(helper, /assertNoRuntimeIssues/);
  });

  it('next phase backlog separates code-owned flow proof from manual provider blockers', () => {
    const backlog = read('docs/operations/NEXT_PHASE_FLOW_PROOF_BACKLOG_20260509.md');
    const runbook = read('docs/operations/PRODUCTION_FLOW_PROOF_RUNBOOK_20260509.md');

    assert.match(backlog, /Execution Band 1 - Prove CI And Deployed Flow Gates/);
    assert.match(backlog, /Execution Band 2 - Turn Read-Only Smoke Into Reversible Mutation Proof/);
    assert.match(backlog, /FLOW_SMOKE_MUTATE_STAFF=true/);
    assert.match(backlog, /FLOW_SMOKE_MUTATE_CONTROL_PLANE=true/);
    assert.match(backlog, /FLOW_SMOKE_MUTATE_APPOINTMENTS=true/);
    assert.match(backlog, /No PHI in the control plane/);
    assert.match(backlog, /Manual Blockers/);
    assert.match(backlog, /not replace this with a live tenant DB URL/);
    assert.match(read('docs/operations/PRODUCTION_FLOW_PROOF_RUNBOOK_20260509.md'), /disposable local Supabase stack/);
    assert.match(backlog, /Supabase leaked-password protection/);
    assert.match(backlog, /Large-File Cleanup After Browser Baselines/);
    assert.match(runbook, /NEXT_PHASE_FLOW_PROOF_BACKLOG_20260509\.md/);
  });

  it('control-plane rate limiting stores only hashed zero-PHI Edge buckets', () => {
    const migration = read('supabase-control-plane/migrations/00010000000020_control_plane_edge_rate_limits.sql');
    const helper = read('supabase-control-plane/functions/_shared/rateLimit.ts');
    const admin = read('supabase-control-plane/functions/_shared/admin.ts');
    const resolver = read('supabase-control-plane/functions/tenant-resolve/index.ts');

    assert.match(migration, /create table if not exists public\.edge_rate_limit_buckets/);
    assert.match(migration, /key_hash text not null/);
    assert.match(migration, /key_hash ~ '\^\[a-f0-9\]\{64\}\$'/);
    assert.match(migration, /alter table public\.edge_rate_limit_buckets enable row level security/);
    assert.match(migration, /revoke all on table public\.edge_rate_limit_buckets from public, anon, authenticated/);
    assert.match(migration, /grant select, insert, update, delete on table public\.edge_rate_limit_buckets to service_role/);
    assert.match(migration, /create or replace function public\.check_edge_rate_limit/);
    assert.match(migration, /revoke execute on function public\.check_edge_rate_limit\(text, text, integer, integer\) from public, anon, authenticated/);
    assert.match(migration, /rawIpStored', false/);
    assert.match(helper, /crypto\.subtle\.digest\('SHA-256'/);
    assert.match(helper, /firstForwardedIp/);
    assert.match(helper, /check_edge_rate_limit/);
    assert.doesNotMatch(helper, /console\.log|console\.error/);
    assert.match(admin, /checkEdgeRateLimit/);
    assert.match(admin, /RATE_LIMITED/);
    assert.match(resolver, /route: slug \? 'tenant_resolve_slug' : 'tenant_resolve'/);
    assert.match(resolver, /keyParts: \[host, surface, slug \?\? 'host'\]/);
    assert.match(resolver, /error: 'TENANT_RESOLVER_DOWN'/);
    assert.match(resolver, /rateLimit\.headers/);
  });
});
