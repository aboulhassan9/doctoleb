import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getPaymentMethodFeatureRequirement,
  hasPaymentMethodAccess,
  requirePaymentMethodAccess,
} from '../../packages/core/lib/billingEntitlements.js';
import { ENTITLEMENT_FEATURES, EntitlementError } from '../../packages/core/lib/entitlements.js';

describe('billing entitlement gates', () => {
  it('allows non-plan-gated payment methods without feature flags', () => {
    assert.equal(getPaymentMethodFeatureRequirement('cash'), null);
    assert.equal(hasPaymentMethodAccess({}, 'cash'), true);
    assert.deepEqual(requirePaymentMethodAccess({}, 'visa'), { featureCode: null });
  });

  it('requires insurance_billing before insurance payments can be created', () => {
    assert.equal(getPaymentMethodFeatureRequirement('insurance'), ENTITLEMENT_FEATURES.insuranceBilling);
    assert.equal(hasPaymentMethodAccess({}, 'insurance'), false);
    assert.throws(
      () => requirePaymentMethodAccess({}, 'insurance'),
      (error) => error instanceof EntitlementError
        && error.code === 'FEATURE_NOT_ENABLED'
        && error.featureCode === ENTITLEMENT_FEATURES.insuranceBilling
    );
  });

  it('allows insurance payment only when the tenant entitlement is enabled', () => {
    const entitlements = {
      [ENTITLEMENT_FEATURES.insuranceBilling]: {
        isEnabled: true,
        limits: {},
        source: 'tenant_feature_flags',
      },
    };

    assert.equal(hasPaymentMethodAccess(entitlements, 'insurance'), true);
    assert.deepEqual(requirePaymentMethodAccess(entitlements, 'insurance'), entitlements[ENTITLEMENT_FEATURES.insuranceBilling]);
  });
});
