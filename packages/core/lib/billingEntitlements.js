import { ENTITLEMENT_FEATURES, hasEntitlement, requireEntitlement } from './entitlements.js';

const PAYMENT_METHOD_FEATURE_REQUIREMENTS = Object.freeze({
  insurance: ENTITLEMENT_FEATURES.insuranceBilling,
});

function normalizePaymentMethod(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function getPaymentMethodFeatureRequirement(paymentMethod) {
  return PAYMENT_METHOD_FEATURE_REQUIREMENTS[normalizePaymentMethod(paymentMethod)] || null;
}

export function hasPaymentMethodAccess(entitlements, paymentMethod) {
  const featureCode = getPaymentMethodFeatureRequirement(paymentMethod);
  return featureCode ? hasEntitlement(entitlements, featureCode) : true;
}

export function requirePaymentMethodAccess(entitlements, paymentMethod) {
  const featureCode = getPaymentMethodFeatureRequirement(paymentMethod);
  if (!featureCode) return { featureCode: null };
  return requireEntitlement(entitlements, featureCode);
}
