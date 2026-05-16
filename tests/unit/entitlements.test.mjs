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
import {
  canAccessFeaturePath,
  filterNavigationItemsByEntitlements,
  getFeatureRequirementForPath,
} from '../../packages/core/lib/featureVisibility.js';

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

  it('treats legacy advanced_reports as the analytical_reports entitlement', () => {
    const entitlements = featureFlagsToEntitlementMap([
      {
        code: ENTITLEMENT_FEATURES.advancedReports,
        is_enabled: true,
      },
    ]);

    assert.equal(hasEntitlement(entitlements, ENTITLEMENT_FEATURES.analyticalReports), true);
  });

  it('defines insurance billing as a plan-gated entitlement code', () => {
    assert.equal(ENTITLEMENT_FEATURES.insuranceBilling, 'insurance_billing');
  });

  it('maps premium routes to their canonical entitlement codes', () => {
    assert.equal(getFeatureRequirementForPath('/patient-messages'), ENTITLEMENT_FEATURES.messaging);
    assert.equal(getFeatureRequirementForPath('/staff-messages'), ENTITLEMENT_FEATURES.messaging);
    assert.equal(getFeatureRequirementForPath('/doctor-staff'), ENTITLEMENT_FEATURES.staffAccounts);
    assert.equal(getFeatureRequirementForPath('/doctor-reports'), ENTITLEMENT_FEATURES.advancedReports);
    assert.equal(getFeatureRequirementForPath('/reports'), ENTITLEMENT_FEATURES.analyticalReports);
    assert.equal(getFeatureRequirementForPath('/reports/123'), ENTITLEMENT_FEATURES.analyticalReports);
    assert.equal(getFeatureRequirementForPath('/doctor-claims'), ENTITLEMENT_FEATURES.insuranceBilling);
    assert.equal(getFeatureRequirementForPath('/secretary-insurance-providers'), ENTITLEMENT_FEATURES.insuranceBilling);
    assert.equal(getFeatureRequirementForPath('/secretary-patient-insurance/123'), ENTITLEMENT_FEATURES.insuranceBilling);
    assert.equal(getFeatureRequirementForPath('/doctor-dashboard'), null);
  });

  it('fails closed for gated navigation while keeping base routes available', () => {
    const entitlements = {
      [ENTITLEMENT_FEATURES.messaging]: { isEnabled: true },
      [ENTITLEMENT_FEATURES.staffAccounts]: { isEnabled: false },
    };

    assert.equal(canAccessFeaturePath(entitlements, '/staff-messages'), true);
    assert.equal(canAccessFeaturePath(entitlements, '/doctor-staff'), false);
    assert.equal(canAccessFeaturePath(entitlements, '/doctor-dashboard'), true);
  });

  it('filters sidebar links through the shared entitlement map', () => {
    const items = [
      { label: 'Dashboard', path: '/doctor-dashboard' },
      { label: 'Messages', path: '/staff-messages' },
      { label: 'Staff', path: '/doctor-staff' },
    ];
    const entitlements = {
      [ENTITLEMENT_FEATURES.messaging]: { isEnabled: true },
    };

    assert.deepEqual(
      filterNavigationItemsByEntitlements(items, entitlements).map((item) => item.label),
      ['Dashboard', 'Messages'],
    );
  });
});
