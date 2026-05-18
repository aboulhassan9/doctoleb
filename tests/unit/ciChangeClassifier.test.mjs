import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { classifyFiles } from '../../scripts/ci-change-classifier.mjs';

describe('CI change classifier', () => {
  function assertIncludesAll(actual, expected) {
    for (const item of expected) {
      assert.ok(actual.includes(item), `expected ${JSON.stringify(actual)} to include ${item}`);
    }
  }

  it('routes docs-only changes to the docs lane without deployments', () => {
    const result = classifyFiles(['docs/graduation/system-design.md', 'AGENTS.md']);

    assert.equal(result.lane, 'docs');
    assert.equal(result.deployVercel, false);
    assert.equal(result.deploySupabaseFunctions, false);
    assert.deepEqual(result.affectedSystems, []);
    assert.deepEqual(result.vercelApps, []);
    assert.deepEqual(result.requiredProofs, ['changed-file-summary']);
  });

  it('routes a patient app change to patient frontend only', () => {
    const result = classifyFiles(['apps/patient-web/src/App.jsx']);

    assert.equal(result.lane, 'frontend');
    assert.deepEqual(result.vercelApps, ['patient-web']);
    assert.deepEqual(result.affectedSystems, ['client']);
    assert.deepEqual(result.smokeApps, ['patient-web']);
    assertIncludesAll(result.domains, ['tenant-config', 'tenant-routing']);
    assertIncludesAll(result.requiredProofs, ['patient-build', 'browser-smoke', 'csp-smoke']);
    assert.equal(result.runBrowserSmoke, true);
    assert.equal(result.runCspSmoke, true);
    assert.equal(result.runDbContracts, false);
  });

  it('routes a clinic operations app change to operations only', () => {
    const result = classifyFiles(['apps/clinic-ops/src/pages/Schedule.jsx']);

    assert.equal(result.lane, 'frontend');
    assert.deepEqual(result.vercelApps, ['clinic-ops']);
    assert.deepEqual(result.affectedSystems, ['operations']);
    assertIncludesAll(result.requiredProofs, ['clinic-ops-build', 'browser-smoke', 'csp-smoke']);
  });

  it('routes a shared UI change to all frontend apps', () => {
    const result = classifyFiles(['packages/ui/components/Button.jsx']);

    assert.equal(result.lane, 'frontend');
    assert.deepEqual(result.affectedSystems, ['client', 'operations', 'saas-admin']);
    assert.deepEqual(result.vercelApps, ['clinic-ops', 'control-plane', 'patient-web']);
    assertIncludesAll(result.domains, ['tenant-config']);
    assertIncludesAll(result.requiredProofs, ['patient-build', 'clinic-ops-build', 'control-plane-build']);
    assert.equal(result.runFlowSmoke, false);
  });

  it('routes a control-plane function change to backend function deployment', () => {
    const result = classifyFiles(['supabase-control-plane/functions/tenant-resolve/index.ts']);

    assert.equal(result.lane, 'backend');
    assert.deepEqual(result.affectedSystems, ['client', 'operations']);
    assert.deepEqual(result.controlPlaneFunctions, ['tenant-resolve']);
    assert.equal(result.deployVercel, false);
    assert.equal(result.deploySupabaseFunctions, true);
    assert.equal(result.runResolverSmoke, true);
    assertIncludesAll(result.domains, ['tenant-routing', 'tenant-config', 'security']);
    assertIncludesAll(result.apps, ['patient-web', 'clinic-ops', 'control-plane']);
    assertIncludesAll(result.requiredProofs, ['patient-build', 'clinic-ops-build', 'control-plane-build', 'resolver-smoke', 'auth-smoke']);
    assert.equal(result.runAuthSmoke, true);
  });

  it('routes a SaaS admin function change to the SaaS admin system', () => {
    const result = classifyFiles(['supabase-control-plane/functions/admin-get-tenant/index.ts']);

    assert.equal(result.lane, 'backend');
    assert.deepEqual(result.affectedSystems, ['saas-admin']);
    assert.deepEqual(result.controlPlaneFunctions, ['admin-get-tenant']);
    assert.equal(result.runAdminCorsSmoke, true);
    assertIncludesAll(result.domains, ['provisioning', 'security', 'tenant-config']);
    assertIncludesAll(result.apps, ['control-plane']);
    assertIncludesAll(result.requiredProofs, ['control-plane-build', 'admin-cors-smoke']);
  });

  it('routes a tenant migration change to backend DB contracts', () => {
    const result = classifyFiles(['supabase/migrations/20260513000000_add_table.sql']);

    assert.equal(result.lane, 'backend');
    assert.deepEqual(result.affectedSystems, ['client', 'operations']);
    assert.equal(result.runMigrationBundle, true);
    assert.equal(result.runDbContracts, true);
    assert.equal(result.deployVercel, false);
    assertIncludesAll(result.domains, ['tenant-db-setup', 'authorization', 'security']);
    assertIncludesAll(result.apps, ['patient-web', 'clinic-ops']);
    assertIncludesAll(result.requiredProofs, ['patient-build', 'clinic-ops-build', 'db-contracts']);
  });

  it('routes tenant migration runner changes through the full migration delivery proof', () => {
    const result = classifyFiles(['supabase-control-plane/functions/_shared/tenantMigrationRunner.ts']);

    assert.equal(result.lane, 'backend');
    assertIncludesAll(result.affectedSystems, ['client', 'operations', 'saas-admin']);
    assert.equal(result.runMigrationBundle, true);
    assert.equal(result.runDbContracts, true);
    assert.equal(result.runBackendContract, true);
    assert.equal(result.runAdminCorsSmoke, true);
    assertIncludesAll(result.domains, ['tenant-db-setup', 'provisioning', 'ci-deploy', 'security']);
    assertIncludesAll(result.apps, ['patient-web', 'clinic-ops', 'control-plane']);
    assertIncludesAll(result.requiredProofs, ['migration-bundle', 'db-contracts', 'control-plane-build']);
  });

  it('routes a staff function change through both ops UI and auth contract proof', () => {
    const result = classifyFiles(['supabase/functions/staff-invite/index.ts']);

    assert.equal(result.lane, 'backend');
    assert.deepEqual(result.affectedSystems, ['operations']);
    assert.deepEqual(result.tenantFunctions, ['staff-invite']);
    assertIncludesAll(result.domains, ['auth', 'authorization', 'staff-lifecycle', 'security']);
    assertIncludesAll(result.apps, ['clinic-ops', 'control-plane']);
    assertIncludesAll(result.requiredProofs, ['clinic-ops-build', 'control-plane-build', 'auth-smoke', 'flow-smoke', 'db-contracts']);
    assert.deepEqual(result.authScenarios, ['control-plane', 'ops']);
  });

  it('routes first doctor admin API changes through SaaS admin and ops consumers', () => {
    const result = classifyFiles(['supabase-control-plane/functions/admin-update-first-doctor-admin/index.ts']);

    assert.equal(result.lane, 'backend');
    assert.deepEqual(result.affectedSystems, ['operations', 'saas-admin']);
    assertIncludesAll(result.domains, ['auth', 'provisioning', 'staff-lifecycle']);
    assertIncludesAll(result.apps, ['clinic-ops', 'control-plane']);
    assertIncludesAll(result.authScenarios, ['ops', 'control-plane']);
    assert.equal(result.runAuthSmoke, true);
    assert.equal(result.runFlowSmoke, true);
  });

  it('routes entitlement changes to every consuming app and DB proof', () => {
    const result = classifyFiles(['supabase-control-plane/functions/admin-sync-entitlements/index.ts']);

    assert.equal(result.lane, 'backend');
    assertIncludesAll(result.domains, ['entitlements', 'security']);
    assert.deepEqual(result.affectedSystems, ['client', 'operations', 'saas-admin']);
    assert.deepEqual(result.apps, ['clinic-ops', 'control-plane', 'patient-web']);
    assertIncludesAll(result.requiredProofs, ['auth-smoke', 'flow-smoke', 'db-contracts']);
  });

  it('routes tenant operational seed admin API changes to SaaS admin and operational proofs', () => {
    const result = classifyFiles(['supabase-control-plane/functions/admin-seed-tenant-operational-data/index.ts']);

    assert.equal(result.lane, 'backend');
    assert.deepEqual(result.controlPlaneFunctions, ['admin-seed-tenant-operational-data']);
    assertIncludesAll(result.affectedSystems, ['saas-admin']);
    assertIncludesAll(result.domains, [
      'appointments',
      'billing-insurance',
      'clinical',
      'messaging',
      'notifications',
      'patients',
      'scheduling',
      'security',
    ]);
    assertIncludesAll(result.apps, ['control-plane']);
    assertIncludesAll(result.requiredProofs, ['control-plane-build', 'admin-cors-smoke']);
  });

  it('forces full for package changes', () => {
    const result = classifyFiles(['package.json']);

    assert.equal(result.lane, 'full');
    assert.deepEqual(result.affectedSystems, ['client', 'operations', 'saas-admin']);
    assert.deepEqual(result.vercelApps, ['clinic-ops', 'control-plane', 'patient-web']);
    assertIncludesAll(result.domains, ['ci-deploy', 'dependencies']);
    assert.equal(result.runFlowSmoke, true);
    assert.equal(result.runDbContracts, true);
  });

  it('forces full for workflow changes', () => {
    const result = classifyFiles(['.github/workflows/ci.yml']);

    assert.equal(result.lane, 'full');
    assert.deepEqual(result.affectedSystems, ['client', 'operations', 'saas-admin']);
    assertIncludesAll(result.domains, ['ci-deploy', 'security']);
    assert.equal(result.runBackendContract, true);
    assert.equal(result.runAuthSmoke, true);
  });

  it('forces full for CI classifier and deploy script changes without treating them as unknown', () => {
    const result = classifyFiles(['scripts/ci-change-classifier.mjs']);

    assert.equal(result.lane, 'full');
    assert.equal(result.reason, 'Shared or release-critical path touched; using full lane.');
    assertIncludesAll(result.domains, ['ci-deploy', 'test-infra']);
    assert.equal(result.runFlowSmoke, true);
  });

  it('forces full when frontend and backend change together', () => {
    const result = classifyFiles([
      'apps/clinic-ops/src/App.jsx',
      'supabase-control-plane/functions/admin-get-tenant/index.ts',
    ]);

    assert.equal(result.lane, 'full');
    assert.deepEqual(result.affectedSystems, ['client', 'operations', 'saas-admin']);
    assert.deepEqual(result.controlPlaneFunctions, ['admin-get-tenant']);
    assert.deepEqual(result.vercelApps, ['clinic-ops', 'control-plane', 'patient-web']);
    assertIncludesAll(result.requiredProofs, ['patient-build', 'clinic-ops-build', 'control-plane-build', 'flow-smoke']);
  });

  it('forces full for unknown paths', () => {
    const result = classifyFiles(['tools/unknown-script.mjs']);

    assert.equal(result.lane, 'full');
    assert.equal(result.reason, 'Unknown path touched; using safe full lane.');
    assertIncludesAll(result.domains, ['ci-deploy']);
  });

  it('supports manual frontend overrides', () => {
    const result = classifyFiles([], { releaseType: 'frontend-control-plane' });

    assert.equal(result.lane, 'frontend');
    assert.deepEqual(result.affectedSystems, ['saas-admin']);
    assert.deepEqual(result.vercelApps, ['control-plane']);
    assertIncludesAll(result.domains, ['auth', 'provisioning', 'tenant-config']);
    assert.equal(result.runCspSmoke, true);
  });
});
