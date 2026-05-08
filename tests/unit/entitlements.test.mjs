import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ENTITLEMENT_FEATURES,
  EntitlementError,
  featureFlagsToEntitlementMap,
  hasEntitlement,
  requireEntitlement,
  resolveEntitlementMap,
} from '../../packages/core/lib/entitlements.js';

describe('entitlements', () => {
  it('resolves plan defaults when no tenant override exists', () => {
    const entitlements = resolveEntitlementMap({
      planCode: 'starter',
      planEntitlements: [
        {
          plan_code: 'starter',
          feature_code: ENTITLEMENT_FEATURES.messaging,
          is_enabled: true,
          limits: { monthlyThreads: 100 },
        },
      ],
      tenantEntitlements: [],
    });

    assert.equal(hasEntitlement(entitlements, ENTITLEMENT_FEATURES.messaging), true);
    assert.deepEqual(entitlements[ENTITLEMENT_FEATURES.messaging].limits, { monthlyThreads: 100 });
    assert.equal(entitlements[ENTITLEMENT_FEATURES.messaging].source, 'plan');
  });

  it('lets manual overrides disable plan-enabled features', () => {
    const entitlements = resolveEntitlementMap({
      planCode: 'starter',
      planEntitlements: [
        {
          plan_code: 'starter',
          feature_code: ENTITLEMENT_FEATURES.aiClinicalSummary,
          is_enabled: true,
          limits: { monthlyRuns: 25 },
        },
      ],
      tenantEntitlements: [
        {
          feature_code: ENTITLEMENT_FEATURES.aiClinicalSummary,
          source: 'manual_override',
          is_enabled: false,
          limits: { monthlyRuns: 0 },
        },
      ],
    });

    assert.equal(hasEntitlement(entitlements, ENTITLEMENT_FEATURES.aiClinicalSummary), false);
    assert.equal(entitlements[ENTITLEMENT_FEATURES.aiClinicalSummary].source, 'manual_override');
    assert.deepEqual(entitlements[ENTITLEMENT_FEATURES.aiClinicalSummary].limits, { monthlyRuns: 0 });
  });

  it('lets add-ons enable features missing from the plan', () => {
    const entitlements = resolveEntitlementMap({
      planCode: 'starter',
      planEntitlements: [],
      tenantEntitlements: [
        {
          feature_code: ENTITLEMENT_FEATURES.biDashboard,
          source: 'addon',
          is_enabled: true,
          limits: { dashboards: 2 },
        },
      ],
    });

    assert.equal(hasEntitlement(entitlements, ENTITLEMENT_FEATURES.biDashboard), true);
    assert.deepEqual(entitlements[ENTITLEMENT_FEATURES.biDashboard].limits, { dashboards: 2 });
    assert.equal(entitlements[ENTITLEMENT_FEATURES.biDashboard].source, 'addon');
  });

  it('throws a stable error for backend feature enforcement', () => {
    assert.throws(
      () => requireEntitlement({}, ENTITLEMENT_FEATURES.advancedReports),
      (error) => error instanceof EntitlementError
        && error.code === 'FEATURE_NOT_ENABLED'
        && error.featureCode === ENTITLEMENT_FEATURES.advancedReports
    );
  });

  it('normalizes tenant feature_flags rows into entitlement map shape', () => {
    const entitlements = featureFlagsToEntitlementMap([
      {
        code: ENTITLEMENT_FEATURES.customBranding,
        is_enabled: true,
        config: { logoUploads: true },
      },
    ]);

    assert.equal(hasEntitlement(entitlements, ENTITLEMENT_FEATURES.customBranding), true);
    assert.equal(entitlements[ENTITLEMENT_FEATURES.customBranding].source, 'tenant_feature_flags');
    assert.deepEqual(entitlements[ENTITLEMENT_FEATURES.customBranding].limits, { logoUploads: true });
  });
});
