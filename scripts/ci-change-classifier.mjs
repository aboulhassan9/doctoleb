import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ALL_APPS = Object.freeze(['patient-web', 'clinic-ops', 'control-plane']);
const ALL_SYSTEMS = Object.freeze(['client', 'operations', 'saas-admin']);

const APP_TO_SYSTEM = Object.freeze({
  'patient-web': 'client',
  'clinic-ops': 'operations',
  'control-plane': 'saas-admin',
});

const DOMAIN_EFFECTS = Object.freeze({
  'audit-observability': {
    systems: ['saas-admin'],
    apps: ['control-plane'],
    smokeApps: ['control-plane'],
    proofs: ['unit', 'lint', 'control-plane-build', 'backend-contract'],
  },
  appointments: {
    systems: ['client', 'operations'],
    apps: ['patient-web', 'clinic-ops'],
    smokeApps: ['patient-web', 'clinic-ops'],
    authScenarios: ['patient', 'ops'],
    proofs: ['unit', 'lint', 'patient-build', 'clinic-ops-build', 'auth-smoke', 'flow-smoke', 'db-contracts'],
    runAuthSmoke: true,
    runDbContracts: true,
    runFlowSmoke: true,
  },
  auth: {
    proofs: ['unit', 'lint'],
  },
  authorization: {
    proofs: ['unit', 'lint', 'db-contracts'],
    runDbContracts: true,
  },
  'billing-insurance': {
    systems: ['operations'],
    apps: ['clinic-ops'],
    smokeApps: ['clinic-ops'],
    authScenarios: ['ops'],
    proofs: ['unit', 'lint', 'clinic-ops-build', 'auth-smoke', 'db-contracts'],
    runAuthSmoke: true,
  },
  branding: {
    systems: ALL_SYSTEMS,
    apps: ALL_APPS,
    smokeApps: ALL_APPS,
    authScenarios: ['patient', 'ops', 'control-plane'],
    proofs: ['unit', 'lint', 'affected-builds', 'browser-smoke', 'auth-smoke'],
    runBrowserSmoke: true,
    runAuthSmoke: true,
  },
  'ci-deploy': {
    systems: ALL_SYSTEMS,
    apps: ALL_APPS,
    smokeApps: ALL_APPS,
    authScenarios: ['patient', 'ops', 'control-plane'],
    proofs: ['full-ci', 'all-builds', 'all-smokes'],
    runBackendContract: true,
    runDbContracts: true,
    runMigrationBundle: true,
    runResolverSmoke: true,
    runAdminCorsSmoke: true,
    runBrowserSmoke: true,
    runAuthSmoke: true,
    runFlowSmoke: true,
    runCspSmoke: true,
  },
  clinical: {
    systems: ['operations'],
    apps: ['clinic-ops'],
    smokeApps: ['clinic-ops'],
    authScenarios: ['ops'],
    proofs: ['unit', 'lint', 'clinic-ops-build', 'auth-smoke', 'db-contracts', 'flow-smoke'],
    runAuthSmoke: true,
    runDbContracts: true,
    runFlowSmoke: true,
  },
  consent: {
    systems: ['client'],
    apps: ['patient-web'],
    smokeApps: ['patient-web'],
    authScenarios: ['patient'],
    proofs: ['unit', 'lint', 'patient-build', 'auth-smoke', 'flow-smoke'],
    runAuthSmoke: true,
    runFlowSmoke: true,
  },
  dependencies: {
    systems: ALL_SYSTEMS,
    apps: ALL_APPS,
    smokeApps: ALL_APPS,
    authScenarios: ['patient', 'ops', 'control-plane'],
    proofs: ['full-ci', 'all-builds', 'dependency-audit', 'all-smokes'],
    runBackendContract: true,
    runDbContracts: true,
    runMigrationBundle: true,
    runResolverSmoke: true,
    runAdminCorsSmoke: true,
    runBrowserSmoke: true,
    runAuthSmoke: true,
    runFlowSmoke: true,
    runCspSmoke: true,
  },
  documents: {
    systems: ['operations'],
    apps: ['clinic-ops'],
    smokeApps: ['clinic-ops'],
    authScenarios: ['ops'],
    proofs: ['unit', 'lint', 'clinic-ops-build', 'auth-smoke', 'db-contracts'],
    runAuthSmoke: true,
  },
  entitlements: {
    systems: ALL_SYSTEMS,
    apps: ALL_APPS,
    smokeApps: ALL_APPS,
    authScenarios: ['patient', 'ops', 'control-plane'],
    proofs: ['unit', 'lint', 'affected-builds', 'auth-smoke', 'flow-smoke', 'db-contracts'],
    runAuthSmoke: true,
    runDbContracts: true,
    runFlowSmoke: true,
  },
  messaging: {
    systems: ['client', 'operations'],
    apps: ['patient-web', 'clinic-ops'],
    smokeApps: ['patient-web', 'clinic-ops'],
    authScenarios: ['patient', 'ops'],
    proofs: ['unit', 'lint', 'patient-build', 'clinic-ops-build', 'auth-smoke', 'flow-smoke', 'db-contracts'],
    runAuthSmoke: true,
    runDbContracts: true,
    runFlowSmoke: true,
  },
  notifications: {
    systems: ['client', 'operations'],
    apps: ['patient-web', 'clinic-ops'],
    smokeApps: ['patient-web', 'clinic-ops'],
    authScenarios: ['patient', 'ops'],
    proofs: ['unit', 'lint', 'patient-build', 'clinic-ops-build', 'auth-smoke', 'db-contracts'],
    runAuthSmoke: true,
  },
  patients: {
    systems: ['client', 'operations'],
    apps: ['patient-web', 'clinic-ops'],
    smokeApps: ['patient-web', 'clinic-ops'],
    authScenarios: ['patient', 'ops'],
    proofs: ['unit', 'lint', 'patient-build', 'clinic-ops-build', 'auth-smoke', 'flow-smoke', 'db-contracts'],
    runAuthSmoke: true,
    runDbContracts: true,
    runFlowSmoke: true,
  },
  provisioning: {
    systems: ['saas-admin'],
    apps: ['control-plane'],
    smokeApps: ['control-plane'],
    authScenarios: ['control-plane'],
    proofs: ['unit', 'lint', 'control-plane-build', 'admin-cors-smoke', 'flow-smoke', 'backend-contract'],
    runAdminCorsSmoke: true,
    runAuthSmoke: true,
    runFlowSmoke: true,
  },
  scheduling: {
    systems: ['client', 'operations'],
    apps: ['patient-web', 'clinic-ops'],
    smokeApps: ['patient-web', 'clinic-ops'],
    authScenarios: ['patient', 'ops'],
    proofs: ['unit', 'lint', 'patient-build', 'clinic-ops-build', 'auth-smoke', 'flow-smoke', 'db-contracts'],
    runAuthSmoke: true,
    runDbContracts: true,
    runFlowSmoke: true,
  },
  security: {
    proofs: ['unit', 'lint', 'secret-audit', 'backend-contract'],
    runBackendContract: true,
  },
  'staff-lifecycle': {
    apps: ['clinic-ops', 'control-plane'],
    smokeApps: ['clinic-ops', 'control-plane'],
    authScenarios: ['ops', 'control-plane'],
    proofs: ['unit', 'lint', 'clinic-ops-build', 'control-plane-build', 'auth-smoke', 'flow-smoke', 'db-contracts'],
    runAuthSmoke: true,
    runDbContracts: true,
    runFlowSmoke: true,
  },
  'tenant-config': {
    proofs: ['unit', 'lint'],
  },
  'tenant-db-setup': {
    systems: ['client', 'operations'],
    apps: ['patient-web', 'clinic-ops'],
    smokeApps: ['patient-web', 'clinic-ops'],
    authScenarios: ['patient', 'ops'],
    proofs: ['unit', 'lint', 'migration-bundle', 'db-contracts'],
    runBackendContract: true,
    runDbContracts: true,
    runMigrationBundle: true,
  },
  'tenant-routing': {
    proofs: ['unit', 'lint'],
  },
  'test-infra': {
    systems: ALL_SYSTEMS,
    apps: ALL_APPS,
    smokeApps: ALL_APPS,
    authScenarios: ['patient', 'ops', 'control-plane'],
    proofs: ['full-ci', 'all-smokes'],
    runBackendContract: true,
    runDbContracts: true,
    runMigrationBundle: true,
    runResolverSmoke: true,
    runAdminCorsSmoke: true,
    runBrowserSmoke: true,
    runAuthSmoke: true,
    runFlowSmoke: true,
    runCspSmoke: true,
  },
});

const VERCEL_APP_CONFIG = Object.freeze({
  'patient-web': {
    app: 'patient-web',
    project_id: 'prj_2MK3W0zlvtVXwHxrKi036CbXwwuQ',
    smoke_url: 'https://doctoleb-patient-web.vercel.app/login',
  },
  'clinic-ops': {
    app: 'clinic-ops',
    project_id: 'prj_sTzoaIuPiwD0zR1kFJi82Gy6Oozg',
    smoke_url: 'https://doctoleb-clinic-ops.vercel.app/login',
  },
  'control-plane': {
    app: 'control-plane',
    project_id: 'prj_PIuy6wTSTvhMsef7dfTg5rOOWXll',
    smoke_url: 'https://doctoleb-control-plane.vercel.app/',
  },
});

const KNOWN_CONTROL_PLANE_FUNCTIONS = Object.freeze([
  'admin-archive-provider-connection',
  'admin-cancel-provisioning-job',
  'admin-compensate-provisioning-step',
  'admin-create-provisioning-job',
  'admin-get-tenant',
  'admin-list-provider-connections',
  'admin-list-tenant-db-setup',
  'admin-list-tenants',
  'admin-resume-provisioning-job',
  'admin-revoke-tenant-secret',
  'admin-run-provisioning-step',
  'admin-set-tenant-runtime-config',
  'admin-store-provider-secret',
  'admin-sync-entitlements',
  'admin-sync-tenant-config',
  'admin-update-first-doctor-admin',
  'admin-update-tenant',
  'admin-upsert-provider-connection',
  'admin-upsert-tenant-secret',
  'tenant-resolve',
]);

const KNOWN_TENANT_FUNCTIONS = Object.freeze([
  'staff-invite',
  'staff-invite-reissue',
  'staff-invite-resend',
  'staff-member-disable',
  'staff-member-reactivate',
]);

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function normalizePath(filePath) {
  return String(filePath || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .trim();
}

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeReleaseType(value) {
  const normalized = String(value || 'auto').trim().toLowerCase();
  const allowed = new Set([
    'auto',
    'docs',
    'frontend-patient',
    'frontend-ops',
    'frontend-control-plane',
    'frontend-all',
    'backend',
    'full',
  ]);
  return allowed.has(normalized) ? normalized : 'full';
}

function isDocsPath(filePath) {
  return /^docs\//.test(filePath)
    || /\.md$/i.test(filePath)
    || /(^|\/)AGENTS\.md$/.test(filePath);
}

function isFrontendPath(filePath) {
  if (filePath.startsWith('apps/patient-web/')) return true;
  if (filePath.startsWith('apps/clinic-ops/')) return true;
  if (filePath.startsWith('apps/control-plane/')) return true;
  if (filePath.startsWith('packages/ui/')) return true;
  if (filePath.startsWith('public/')) return true;
  if (filePath === 'index.html') return true;
  return false;
}

function frontendAppsForPath(filePath) {
  if (filePath.startsWith('apps/patient-web/')) return ['patient-web'];
  if (filePath.startsWith('apps/clinic-ops/')) return ['clinic-ops'];
  if (filePath.startsWith('apps/control-plane/')) return ['control-plane'];
  if (filePath.startsWith('packages/ui/') || filePath.startsWith('public/') || filePath === 'index.html') {
    return ALL_APPS;
  }
  return [];
}

function systemsForApps(apps) {
  return apps.map((app) => APP_TO_SYSTEM[app]).filter(Boolean);
}

function addDomain(result, domainName) {
  const domain = DOMAIN_EFFECTS[domainName];
  if (!domain) return;

  result.domains.push(domainName);
  result.affectedSystems.push(...(domain.systems || []));
  result.apps.push(...(domain.apps || []));
  result.smokeApps.push(...(domain.smokeApps || []));
  result.authScenarios.push(...(domain.authScenarios || []));
  result.requiredProofs.push(...(domain.proofs || []));
  result.runBackendContract ||= Boolean(domain.runBackendContract);
  result.runDbContracts ||= Boolean(domain.runDbContracts);
  result.runMigrationBundle ||= Boolean(domain.runMigrationBundle);
  result.runResolverSmoke ||= Boolean(domain.runResolverSmoke);
  result.runAdminCorsSmoke ||= Boolean(domain.runAdminCorsSmoke);
  result.runBrowserSmoke ||= Boolean(domain.runBrowserSmoke);
  result.runAuthSmoke ||= Boolean(domain.runAuthSmoke);
  result.runFlowSmoke ||= Boolean(domain.runFlowSmoke);
  result.runCspSmoke ||= Boolean(domain.runCspSmoke);
}

function addDomains(result, domainNames) {
  for (const domainName of domainNames) {
    addDomain(result, domainName);
  }
}

function tagDomains(result, domainNames) {
  for (const domainName of domainNames) {
    if (DOMAIN_EFFECTS[domainName]) {
      result.domains.push(domainName);
    }
  }
}

function addAppBuildProofs(result, apps) {
  for (const app of apps) {
    if (app === 'patient-web') result.requiredProofs.push('patient-build');
    if (app === 'clinic-ops') result.requiredProofs.push('clinic-ops-build');
    if (app === 'control-plane') result.requiredProofs.push('control-plane-build');
  }
}

function addFrontendSmokeProofs(result) {
  result.requiredProofs.push('browser-smoke', 'csp-smoke');
}

function addTextDomains(domains, text) {
  const value = text.toLowerCase();

  if (/login|signup|password|session|auth|otp|magic-link|magiclink|first-doctor|doctor-admin|role/.test(value)) {
    domains.push('auth');
  }
  if (/protectedroute|featureprotectedroute|rls|policy|permission|rbac|role|allowedroles|requiredrole|authorization/.test(value)) {
    domains.push('authorization');
  }
  if (/tenant-resolve|tenantresolver|tenantpath|hostname|domain|no-domain|nodomain|surface|basename|routing/.test(value)) {
    domains.push('tenant-routing');
  }
  if (/brand|theme|tenant-config|tenantconfig|tenant_profile|tenant_app_config|runtime-config|app_config/.test(value)) {
    domains.push('branding', 'tenant-config');
  }
  if (/entitlement|feature_flag|featureflag|featureprotectedroute|feature_code|plan/.test(value)) {
    domains.push('entitlements');
  }
  if (/provision|provider|tenant-secret|tenant_secret|vault|migration-run|migration_runner/.test(value)) {
    domains.push('provisioning');
  }
  if (/tenant-db|tenant_db|migration|database-url|database_url|db-setup/.test(value)) {
    domains.push('tenant-db-setup');
  }
  if (/staff|invite|reactivate|disable|reissue|resend/.test(value)) {
    domains.push('staff-lifecycle');
  }
  if (/appointment|booking|book-slot|book_slot|cancel_appointment/.test(value)) {
    domains.push('appointments');
  }
  if (/slot|schedule|availability|calendar/.test(value)) {
    domains.push('scheduling');
  }
  if (/patient|profile|intake|medical-history|medical_history/.test(value)) {
    domains.push('patients');
  }
  if (/clinical|encounter|diagnos|prescription|care-task|care_task|lab|referral|certificate|note|draft|catalog/.test(value)) {
    domains.push('clinical');
  }
  if (/billing|insurance|payment|claim|billable/.test(value)) {
    domains.push('billing-insurance');
  }
  if (/message|conversation|chat/.test(value)) {
    domains.push('messaging');
  }
  if (/notification|device|reminder|fcm/.test(value)) {
    domains.push('notifications');
  }
  if (/document|storage|bucket|upload|file/.test(value)) {
    domains.push('documents');
  }
  if (/consent/.test(value)) {
    domains.push('consent');
  }
  if (/audit|log|logger|event/.test(value)) {
    domains.push('audit-observability');
  }
  if (/rate-limit|ratelimit|cors|csp|secret|service-role|service_role|token|security/.test(value)) {
    domains.push('security');
  }
}

function domainsForControlPlaneFunction(functionName) {
  const domains = ['security'];
  addTextDomains(domains, functionName || '');

  if (functionName === 'tenant-resolve') domains.push('tenant-routing', 'tenant-config');
  if (/provider|provisioning|run-provisioning|resume-provisioning|cancel-provisioning|compensate-provisioning|create-provisioning/.test(functionName || '')) {
    domains.push('provisioning');
  }
  if (/tenant-secret|tenant-db|migration/.test(functionName || '')) domains.push('tenant-db-setup');
  if (/runtime-config|sync-tenant-config/.test(functionName || '')) domains.push('tenant-config', 'branding');
  if (/sync-entitlements/.test(functionName || '')) domains.push('entitlements');
  if (/first-doctor-admin/.test(functionName || '')) domains.push('auth', 'staff-lifecycle', 'provisioning');
  if (/get-tenant|list-tenants|update-tenant/.test(functionName || '')) domains.push('tenant-config', 'provisioning');

  return unique(domains);
}

function domainsForTenantFunction(functionName) {
  const domains = ['auth', 'authorization', 'staff-lifecycle', 'security'];
  addTextDomains(domains, functionName || '');
  return unique(domains);
}

function domainsForMigration(filePath) {
  const domains = ['authorization', 'security'];
  addTextDomains(domains, filePath);

  if (filePath.startsWith('supabase-control-plane/migrations/')) {
    domains.push('provisioning', 'tenant-config');
  }
  if (filePath.startsWith('supabase/migrations/')) {
    domains.push('tenant-db-setup');
  }

  return unique(domains);
}

function domainsForPath(filePath) {
  const domains = [];

  if (isDocsPath(filePath)) return domains;

  if (filePath.startsWith('.github/workflows/') || filePath === 'vercel.json') {
    domains.push('ci-deploy', 'security');
  }
  if (filePath === 'package.json' || filePath === 'package-lock.json') {
    domains.push('dependencies', 'ci-deploy');
  }
  if (filePath.startsWith('tests/') || /^scripts\/.*smoke\.mjs$/.test(filePath)) {
    domains.push('test-infra');
  }
  if (/^scripts\/(ci-change-classifier|deploy-supabase-functions|github-run-summary)\.mjs$/.test(filePath)) {
    domains.push('ci-deploy', 'test-infra');
  }
  if (filePath.startsWith('scripts/')) {
    addTextDomains(domains, filePath);
  }

  if (filePath.startsWith('apps/patient-web/')) {
    domains.push('tenant-routing', 'tenant-config');
    addTextDomains(domains, filePath.slice('apps/patient-web/'.length));
  }
  if (filePath.startsWith('apps/clinic-ops/')) {
    domains.push('tenant-routing', 'tenant-config', 'authorization');
    addTextDomains(domains, filePath.slice('apps/clinic-ops/'.length));
  }
  if (filePath.startsWith('apps/control-plane/')) {
    domains.push('provisioning', 'tenant-config', 'security');
    addTextDomains(domains, filePath.slice('apps/control-plane/'.length));
  }
  if (filePath.startsWith('packages/ui/')) {
    domains.push('tenant-config');
    addTextDomains(domains, filePath);
  }
  if (filePath.startsWith('packages/core/')) {
    addTextDomains(domains, filePath);
  }

  if (filePath.startsWith('supabase-control-plane/functions/')) {
    const functionName = functionNameFromPath(filePath, 'supabase-control-plane/functions/');
    if (functionName === '_shared') {
      domains.push('provisioning', 'tenant-routing', 'tenant-db-setup', 'tenant-config', 'security');
    } else {
      domains.push(...domainsForControlPlaneFunction(functionName));
    }
  }
  if (filePath.startsWith('supabase/functions/')) {
    const functionName = functionNameFromPath(filePath, 'supabase/functions/');
    domains.push(...domainsForTenantFunction(functionName));
  }
  if (isMigrationOrDbPath(filePath)) {
    domains.push(...domainsForMigration(filePath));
  }

  if (filePath.startsWith('public/') || filePath === 'index.html') {
    domains.push('branding', 'tenant-config');
  }

  return unique(domains);
}

function systemsForPath(filePath) {
  if (filePath.startsWith('apps/patient-web/')) return ['client'];
  if (filePath.startsWith('apps/clinic-ops/')) return ['operations'];
  if (filePath.startsWith('apps/control-plane/')) return ['saas-admin'];
  if (filePath.startsWith('packages/ui/') || filePath.startsWith('public/') || filePath === 'index.html') return ALL_SYSTEMS;
  if (filePath.startsWith('packages/core/') || filePath === 'package.json' || filePath === 'package-lock.json') return ALL_SYSTEMS;
  if (filePath.startsWith('supabase/functions/')) return ['operations'];
  if (filePath.startsWith('supabase/migrations/') || filePath.startsWith('supabase/sql/') || filePath.startsWith('supabase/tests/')) return ['client', 'operations'];
  if (filePath.startsWith('supabase-control-plane/migrations/')) return ALL_SYSTEMS;
  if (filePath.startsWith('supabase-control-plane/functions/tenant-resolve/')) return ['client', 'operations'];
  if (filePath.startsWith('supabase-control-plane/functions/admin-update-first-doctor-admin/')) return ['operations', 'saas-admin'];
  if (filePath.startsWith('supabase-control-plane/functions/admin-')) return ['saas-admin'];
  if (filePath.startsWith('supabase-control-plane/functions/_shared/')) return ALL_SYSTEMS;
  if (filePath === 'vercel.json') return ALL_SYSTEMS;
  return [];
}

function isMigrationOrDbPath(filePath) {
  return /^supabase\/(migrations|sql|tests)\//.test(filePath)
    || /^supabase-control-plane\/migrations\//.test(filePath);
}

function isBackendScriptPath(filePath) {
  return [
    'scripts/backend-contract-audit.mjs',
    'scripts/backend-db-contract-tests.mjs',
    'scripts/generate-tenant-migration-bundle.mjs',
  ].includes(filePath);
}

function isBackendPath(filePath) {
  return filePath.startsWith('supabase-control-plane/functions/')
    || filePath.startsWith('supabase/functions/')
    || isMigrationOrDbPath(filePath)
    || isBackendScriptPath(filePath);
}

function isFullPath(filePath) {
  if (filePath.startsWith('.github/workflows/')) return true;
  if (filePath.startsWith('packages/core/')) return true;
  if (filePath.startsWith('src/')) return true;
  if (filePath.startsWith('tests/')) return true;
  if (/^scripts\/(ci-change-classifier|deploy-supabase-functions|github-run-summary)\.mjs$/.test(filePath)) return true;
  if (filePath.startsWith('scripts/lib/')) return true;
  if (/^scripts\/.*smoke\.mjs$/.test(filePath)) return true;
  if (filePath === 'package.json' || filePath === 'package-lock.json') return true;
  if (/^(vite|tailwind|postcss|eslint)\.config\./.test(filePath)) return true;
  if (filePath === 'vercel.json') return true;
  return false;
}

function functionNameFromPath(filePath, root) {
  const rest = filePath.slice(root.length);
  const [functionName] = rest.split('/');
  return functionName || null;
}

function listFunctionDirs(root, fallback) {
  try {
    return fs.readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== '_shared')
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [...fallback];
  }
}

function createBaseResult({ lane, reason, files }) {
  return {
    lane,
    reason,
    files,
    apps: [],
    affectedSystems: [],
    domains: [],
    requiredProofs: [],
    vercelApps: [],
    vercelMatrix: { include: [] },
    smokeApps: [],
    authScenarios: [],
    controlPlaneFunctions: [],
    tenantFunctions: [],
    deployVercel: false,
    deploySupabaseFunctions: false,
    runBackendContract: false,
    runDbContracts: false,
    runMigrationBundle: false,
    runResolverSmoke: false,
    runAdminCorsSmoke: false,
    runBrowserSmoke: false,
    runAuthSmoke: false,
    runFlowSmoke: false,
    runCspSmoke: false,
  };
}

function finalizeResult(result) {
  result.apps = unique(result.apps);
  result.affectedSystems = unique(result.affectedSystems);
  result.domains = unique(result.domains);
  result.requiredProofs = unique(result.requiredProofs);
  addAppBuildProofs(result, result.apps);
  result.requiredProofs = unique(result.requiredProofs);
  result.vercelApps = unique(result.vercelApps);
  result.smokeApps = unique(result.smokeApps);
  result.authScenarios = unique(result.authScenarios);
  result.controlPlaneFunctions = unique(result.controlPlaneFunctions);
  result.tenantFunctions = unique(result.tenantFunctions);
  result.deployVercel = result.vercelApps.length > 0;
  result.deploySupabaseFunctions = result.controlPlaneFunctions.length > 0 || result.tenantFunctions.length > 0;
  result.vercelMatrix = {
    include: result.vercelApps.map((app) => VERCEL_APP_CONFIG[app]),
  };
  return result;
}

function applyForcedReleaseType(result, releaseType) {
  if (releaseType === 'docs') {
    result.lane = 'docs';
    result.reason = 'Manual docs lane selected.';
    result.requiredProofs.push('changed-file-summary');
    return result;
  }
  if (releaseType === 'frontend-patient') {
    result.lane = 'frontend';
    result.reason = 'Manual patient frontend lane selected.';
    tagDomains(result, ['tenant-routing', 'tenant-config']);
    result.apps.push('patient-web');
    result.affectedSystems.push('client');
    result.vercelApps.push('patient-web');
    result.smokeApps.push('patient-web');
    addAppBuildProofs(result, ['patient-web']);
    addFrontendSmokeProofs(result);
    result.runBrowserSmoke = true;
    result.runCspSmoke = true;
    return result;
  }
  if (releaseType === 'frontend-ops') {
    result.lane = 'frontend';
    result.reason = 'Manual clinic ops frontend lane selected.';
    tagDomains(result, ['auth', 'authorization', 'tenant-routing', 'tenant-config']);
    result.apps.push('clinic-ops');
    result.affectedSystems.push('operations');
    result.vercelApps.push('clinic-ops');
    result.smokeApps.push('clinic-ops');
    addAppBuildProofs(result, ['clinic-ops']);
    addFrontendSmokeProofs(result);
    result.runBrowserSmoke = true;
    result.runCspSmoke = true;
    return result;
  }
  if (releaseType === 'frontend-control-plane') {
    result.lane = 'frontend';
    result.reason = 'Manual control-plane frontend lane selected.';
    tagDomains(result, ['auth', 'provisioning', 'tenant-config']);
    result.apps.push('control-plane');
    result.affectedSystems.push('saas-admin');
    result.vercelApps.push('control-plane');
    result.smokeApps.push('control-plane');
    addAppBuildProofs(result, ['control-plane']);
    addFrontendSmokeProofs(result);
    result.runBrowserSmoke = true;
    result.runCspSmoke = true;
    return result;
  }
  if (releaseType === 'frontend-all') {
    result.lane = 'frontend';
    result.reason = 'Manual all-frontend lane selected.';
    tagDomains(result, ['auth', 'authorization', 'tenant-routing', 'tenant-config']);
    result.apps.push(...ALL_APPS);
    result.affectedSystems.push(...ALL_SYSTEMS);
    result.vercelApps.push(...ALL_APPS);
    result.smokeApps.push(...ALL_APPS);
    addAppBuildProofs(result, ALL_APPS);
    addFrontendSmokeProofs(result);
    result.runBrowserSmoke = true;
    result.runCspSmoke = true;
    return result;
  }
  if (releaseType === 'backend') {
    result.lane = 'backend';
    result.reason = 'Manual backend lane selected.';
    addDomains(result, ['security', 'tenant-db-setup']);
    result.runBackendContract = true;
    result.runMigrationBundle = true;
    result.runDbContracts = true;
    return result;
  }
  if (releaseType === 'full') {
    result.lane = 'full';
    result.reason = 'Manual full release lane selected.';
    addDomains(result, ['ci-deploy']);
    result.apps.push(...ALL_APPS);
    result.affectedSystems.push(...ALL_SYSTEMS);
    result.vercelApps.push(...ALL_APPS);
    result.smokeApps.push(...ALL_APPS);
    addAppBuildProofs(result, ALL_APPS);
    result.authScenarios.push('patient', 'ops', 'control-plane');
    result.runBackendContract = true;
    result.runMigrationBundle = true;
    result.runDbContracts = true;
    result.runResolverSmoke = true;
    result.runAdminCorsSmoke = true;
    result.runBrowserSmoke = true;
    result.runAuthSmoke = true;
    result.runFlowSmoke = true;
    result.runCspSmoke = true;
    return result;
  }
  return result;
}

function collectBackendDetails(result, files) {
  const controlPlaneFunctions = new Set(result.controlPlaneFunctions);
  const tenantFunctions = new Set(result.tenantFunctions);
  const allControlPlaneFunctions = listFunctionDirs('supabase-control-plane/functions', KNOWN_CONTROL_PLANE_FUNCTIONS);
  const allTenantFunctions = listFunctionDirs('supabase/functions', KNOWN_TENANT_FUNCTIONS);

  for (const filePath of files) {
    addDomains(result, domainsForPath(filePath));
    result.affectedSystems.push(...systemsForPath(filePath));

    if (filePath.startsWith('supabase-control-plane/functions/')) {
      const functionName = functionNameFromPath(filePath, 'supabase-control-plane/functions/');
      if (functionName === '_shared') {
        for (const name of allControlPlaneFunctions) controlPlaneFunctions.add(name);
      } else if (functionName) {
        controlPlaneFunctions.add(functionName);
      }
      if (functionName === 'tenant-resolve' || functionName === '_shared') {
        result.affectedSystems.push('client', 'operations');
        result.apps.push(...ALL_APPS);
        result.smokeApps.push(...ALL_APPS);
        result.authScenarios.push('patient', 'ops', 'control-plane');
        result.requiredProofs.push('resolver-smoke', 'auth-smoke');
        result.runResolverSmoke = true;
        result.runAuthSmoke = true;
      }
      if (functionName?.startsWith('admin-') || functionName === '_shared') {
        result.affectedSystems.push('saas-admin');
        result.runAdminCorsSmoke = true;
      }
      if (functionName === 'admin-update-first-doctor-admin') {
        result.affectedSystems.push('operations', 'saas-admin');
        result.runAuthSmoke = true;
        result.authScenarios.push('ops');
      }
    }

    if (filePath.startsWith('supabase/functions/')) {
      const functionName = functionNameFromPath(filePath, 'supabase/functions/');
      if (functionName === '_shared') {
        for (const name of allTenantFunctions) tenantFunctions.add(name);
      } else if (functionName) {
        tenantFunctions.add(functionName);
      }
      result.affectedSystems.push('operations');
      result.runAuthSmoke = true;
      result.authScenarios.push('ops');
    }

    if (isMigrationOrDbPath(filePath)) {
      result.affectedSystems.push(...systemsForPath(filePath));
      result.runDbContracts = true;
      result.runMigrationBundle = true;
      if (filePath.startsWith('supabase-control-plane/migrations/')) {
        result.runResolverSmoke = true;
        result.runAdminCorsSmoke = true;
      }
    }
  }

  result.controlPlaneFunctions = [...controlPlaneFunctions];
  result.tenantFunctions = [...tenantFunctions];
}

export function classifyFiles(rawFiles, options = {}) {
  const files = unique(rawFiles.map(normalizePath).filter(Boolean));
  const releaseType = normalizeReleaseType(options.releaseType);
  const result = createBaseResult({ lane: 'full', reason: 'No changed files found; using safe full lane.', files });

  if (releaseType !== 'auto') {
    applyForcedReleaseType(result, releaseType);
    if (releaseType === 'backend' || releaseType === 'full') {
      collectBackendDetails(result, files);
    }
    return finalizeResult(result);
  }

  if (files.length === 0) {
    addDomains(result, ['ci-deploy']);
    result.apps.push(...ALL_APPS);
    result.affectedSystems.push(...ALL_SYSTEMS);
    result.vercelApps.push(...ALL_APPS);
    result.smokeApps.push(...ALL_APPS);
    addAppBuildProofs(result, ALL_APPS);
    result.authScenarios.push('patient', 'ops', 'control-plane');
    result.runBackendContract = true;
    result.runMigrationBundle = true;
    result.runDbContracts = true;
    result.runResolverSmoke = true;
    result.runAdminCorsSmoke = true;
    result.runBrowserSmoke = true;
    result.runAuthSmoke = true;
    result.runFlowSmoke = true;
    result.runCspSmoke = true;
    return finalizeResult(result);
  }

  if (files.every(isDocsPath)) {
    const docsResult = createBaseResult({ lane: 'docs', reason: 'Docs-only change.', files });
    docsResult.requiredProofs.push('changed-file-summary');
    return finalizeResult(docsResult);
  }

  const hasFull = files.some(isFullPath);
  const hasFrontend = files.some(isFrontendPath);
  const hasBackend = files.some(isBackendPath);
  const hasUnknown = files.some((filePath) => !isDocsPath(filePath) && !isFrontendPath(filePath) && !isBackendPath(filePath) && !isFullPath(filePath));

  if (hasFull || hasUnknown || (hasFrontend && hasBackend)) {
    result.lane = 'full';
    result.reason = hasUnknown
      ? 'Unknown path touched; using safe full lane.'
      : hasFrontend && hasBackend
        ? 'Frontend and backend changed together; using full lane.'
        : 'Shared or release-critical path touched; using full lane.';
    for (const filePath of files) {
      tagDomains(result, domainsForPath(filePath));
    }
    if (result.domains.length === 0) {
      addDomains(result, ['ci-deploy']);
    }
    result.apps.push(...ALL_APPS);
    result.affectedSystems.push(...ALL_SYSTEMS);
    result.vercelApps.push(...ALL_APPS);
    result.smokeApps.push(...ALL_APPS);
    addAppBuildProofs(result, ALL_APPS);
    result.authScenarios.push('patient', 'ops', 'control-plane');
    result.runBackendContract = true;
    result.runMigrationBundle = true;
    result.runDbContracts = true;
    result.runResolverSmoke = true;
    result.runAdminCorsSmoke = true;
    result.runBrowserSmoke = true;
    result.runAuthSmoke = true;
    result.runFlowSmoke = true;
    result.runCspSmoke = true;
    collectBackendDetails(result, files);
    return finalizeResult(result);
  }

  if (hasFrontend) {
    result.lane = 'frontend';
    result.reason = 'Frontend-only change.';
    for (const filePath of files) {
      tagDomains(result, domainsForPath(filePath));
      const apps = frontendAppsForPath(filePath);
      result.apps.push(...apps);
      result.affectedSystems.push(...systemsForApps(apps), ...systemsForPath(filePath));
      result.vercelApps.push(...apps);
      result.smokeApps.push(...apps);
      addAppBuildProofs(result, apps);
    }
    result.runBrowserSmoke = true;
    result.runCspSmoke = true;
    addFrontendSmokeProofs(result);
    return finalizeResult(result);
  }

  if (hasBackend) {
    result.lane = 'backend';
    result.reason = 'Backend-only change.';
    result.runBackendContract = true;
    result.runMigrationBundle = true;
    collectBackendDetails(result, files);
    return finalizeResult(result);
  }

  return finalizeResult(result);
}

function readGithubEvent() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) return null;
  try {
    return JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  } catch {
    return null;
  }
}

function getDiffRangeFromEvent() {
  const event = readGithubEvent();
  if (event?.pull_request?.base?.sha && event?.pull_request?.head?.sha) {
    return {
      base: event.pull_request.base.sha,
      head: event.pull_request.head.sha,
    };
  }
  if (event?.before && event?.after && !/^0+$/.test(event.before)) {
    return {
      base: event.before,
      head: event.after,
    };
  }
  return {
    base: process.env.CI_BASE_SHA || '',
    head: process.env.CI_HEAD_SHA || process.env.GITHUB_SHA || 'HEAD',
  };
}

function readChangedFilesFromGit({ base, head }) {
  if (!base || !head) return [];
  try {
    return execFileSync('git', ['diff', '--name-only', `${base}...${head}`], { encoding: 'utf8' })
      .split(/\r?\n/)
      .filter(Boolean);
  } catch {
    try {
      return execFileSync('git', ['diff', '--name-only', `${base}`, `${head}`], { encoding: 'utf8' })
        .split(/\r?\n/)
        .filter(Boolean);
    } catch {
      return [];
    }
  }
}

function parseArgs(argv) {
  const args = new Map();
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [key, ...rest] = arg.slice(2).split('=');
    args.set(key, rest.join('=') || 'true');
  }
  return args;
}

function appendGithubOutput(result) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  const lines = [
    `lane=${result.lane}`,
    `reason=${result.reason}`,
    `apps=${result.apps.join(',')}`,
    `affected_systems=${result.affectedSystems.join(',')}`,
    `domains=${result.domains.join(',')}`,
    `required_proofs=${result.requiredProofs.join(',')}`,
    `smoke_apps=${result.smokeApps.join(',')}`,
    `auth_scenarios=${result.authScenarios.join(',')}`,
    `deploy_vercel=${String(result.deployVercel)}`,
    `deploy_supabase_functions=${String(result.deploySupabaseFunctions)}`,
    `control_plane_functions=${result.controlPlaneFunctions.join(',')}`,
    `tenant_functions=${result.tenantFunctions.join(',')}`,
    `run_backend_contract=${String(result.runBackendContract)}`,
    `run_db_contracts=${String(result.runDbContracts)}`,
    `run_migration_bundle=${String(result.runMigrationBundle)}`,
    `run_resolver_smoke=${String(result.runResolverSmoke)}`,
    `run_admin_cors_smoke=${String(result.runAdminCorsSmoke)}`,
    `run_browser_smoke=${String(result.runBrowserSmoke)}`,
    `run_auth_smoke=${String(result.runAuthSmoke)}`,
    `run_flow_smoke=${String(result.runFlowSmoke)}`,
    `run_csp_smoke=${String(result.runCspSmoke)}`,
    `vercel_matrix=${JSON.stringify(result.vercelMatrix)}`,
  ];
  fs.appendFileSync(outputPath, `${lines.join('\n')}\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const releaseType = args.get('release-type') || process.env.RELEASE_TYPE || 'auto';
  const filesArg = args.get('files') || process.env.CI_CHANGED_FILES || '';
  const range = {
    base: args.get('base') || '',
    head: args.get('head') || '',
  };
  const eventRange = getDiffRangeFromEvent();
  const diffRange = {
    base: range.base || eventRange.base,
    head: range.head || eventRange.head,
  };
  const files = filesArg ? parseCsv(filesArg) : readChangedFilesFromGit(diffRange);
  const result = classifyFiles(files, { releaseType });

  appendGithubOutput(result);
  console.log(JSON.stringify(result, null, 2));
}

const currentFileUrl = pathToFileURL(fileURLToPath(import.meta.url)).href;
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === currentFileUrl) {
  await main();
}
