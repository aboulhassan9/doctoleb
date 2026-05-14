import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENTITLEMENT_FEATURES,
  EntitlementError,
  resolveEntitlementMap,
  featureFlagsToEntitlementMap,
  hasEntitlement,
  requireEntitlement,
} from '../../../packages/core/lib/entitlements.js';

describe('ENTITLEMENT_FEATURES', () => {
  it('is frozen', () => {
    assert.ok(Object.isFrozen(ENTITLEMENT_FEATURES));
  });

  it('contains the documented feature codes', () => {
    assert.equal(ENTITLEMENT_FEATURES.messaging, 'messaging');
    assert.equal(ENTITLEMENT_FEATURES.insuranceBilling, 'insurance_billing');
    assert.equal(ENTITLEMENT_FEATURES.customDomain, 'custom_domain');
  });
});

describe('resolveEntitlementMap', () => {
  it('returns empty map when no entitlements are provided', () => {
    assert.deepEqual(resolveEntitlementMap({}), {});
  });

  it('includes plan entitlements for the given planCode', () => {
    const result = resolveEntitlementMap({
      planCode: 'starter',
      planEntitlements: [
        { plan_code: 'starter', feature_code: 'messaging', is_enabled: true },
        { plan_code: 'pro', feature_code: 'insurance_billing', is_enabled: true },
      ],
    });
    assert.equal(result.messaging?.isEnabled, true);
    assert.equal(result.insurance_billing, undefined);
  });

  it('ignores plan entitlements that do not match the planCode', () => {
    const result = resolveEntitlementMap({
      planCode: 'starter',
      planEntitlements: [
        { plan_code: 'pro', feature_code: 'insurance_billing', is_enabled: true },
      ],
    });
    assert.deepEqual(result, {});
  });

  it('lets tenant_feature_flags override plan entitlements', () => {
    const result = resolveEntitlementMap({
      planCode: 'starter',
      planEntitlements: [
        { plan_code: 'starter', feature_code: 'messaging', is_enabled: false },
      ],
      tenantEntitlements: [
        { feature_code: 'messaging', is_enabled: true, source: 'tenant_feature_flags' },
      ],
    });
    assert.equal(result.messaging.isEnabled, true);
    assert.equal(result.messaging.source, 'tenant_feature_flags');
  });

  it('lets manual_override beat tenant_feature_flags', () => {
    const result = resolveEntitlementMap({
      planCode: 'starter',
      tenantEntitlements: [
        { feature_code: 'messaging', is_enabled: true, source: 'tenant_feature_flags' },
        { feature_code: 'messaging', is_enabled: false, source: 'manual_override' },
      ],
    });
    assert.equal(result.messaging.isEnabled, false);
    assert.equal(result.messaging.source, 'manual_override');
  });

  it('skips rows without a feature_code', () => {
    const result = resolveEntitlementMap({
      planCode: 'starter',
      planEntitlements: [
        { plan_code: 'starter', feature_code: '', is_enabled: true },
        { plan_code: 'starter', feature_code: null, is_enabled: true },
      ],
    });
    assert.deepEqual(result, {});
  });
});

describe('featureFlagsToEntitlementMap', () => {
  it('maps tenant feature_flag rows to the entitlement shape', () => {
    const result = featureFlagsToEntitlementMap([
      { code: 'messaging', is_enabled: true },
      { code: 'custom_branding', is_enabled: false, config: { hex: '#1E5FA8' } },
    ]);
    assert.equal(result.messaging.isEnabled, true);
    assert.equal(result.custom_branding.isEnabled, false);
    assert.deepEqual(result.custom_branding.limits, { hex: '#1E5FA8' });
  });
});

describe('hasEntitlement / requireEntitlement', () => {
  const entitlements = {
    messaging: { isEnabled: true },
    insurance_billing: { isEnabled: false },
  };

  it('hasEntitlement returns true for enabled features', () => {
    assert.equal(hasEntitlement(entitlements, 'messaging'), true);
  });

  it('hasEntitlement returns false for disabled features', () => {
    assert.equal(hasEntitlement(entitlements, 'insurance_billing'), false);
  });

  it('hasEntitlement returns false for unknown features', () => {
    assert.equal(hasEntitlement(entitlements, 'made_up_feature'), false);
  });

  it('hasEntitlement is case-insensitive', () => {
    assert.equal(hasEntitlement(entitlements, 'MESSAGING'), true);
  });

  it('hasEntitlement handles null entitlements gracefully', () => {
    assert.equal(hasEntitlement(null, 'messaging'), false);
    assert.equal(hasEntitlement(undefined, 'messaging'), false);
  });

  it('requireEntitlement returns the row for enabled features', () => {
    const result = requireEntitlement(entitlements, 'messaging');
    assert.equal(result.isEnabled, true);
  });

  it('requireEntitlement throws EntitlementError for disabled features', () => {
    assert.throws(
      () => requireEntitlement(entitlements, 'insurance_billing'),
      EntitlementError,
    );
  });

  it('EntitlementError carries the feature code and a stable error code', () => {
    try {
      requireEntitlement(entitlements, 'insurance_billing');
      assert.fail('expected to throw');
    } catch (err) {
      assert.ok(err instanceof EntitlementError);
      assert.equal(err.code, 'FEATURE_NOT_ENABLED');
      assert.equal(err.featureCode, 'insurance_billing');
    }
  });
});
