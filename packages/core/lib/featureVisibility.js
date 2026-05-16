import { ENTITLEMENT_FEATURES, hasEntitlement } from './entitlements.js';

const FEATURE_ROUTE_RULES = Object.freeze([
  { path: '/patient-messages', featureCode: ENTITLEMENT_FEATURES.messaging },
  { path: '/staff-messages', featureCode: ENTITLEMENT_FEATURES.messaging },
  { path: '/doctor-staff', featureCode: ENTITLEMENT_FEATURES.staffAccounts },
  { path: '/doctor-reports', featureCode: ENTITLEMENT_FEATURES.advancedReports },
  { prefix: '/reports', featureCode: ENTITLEMENT_FEATURES.analyticalReports },
  { path: '/doctor-claims', featureCode: ENTITLEMENT_FEATURES.insuranceBilling },
  { path: '/secretary-insurance-providers', featureCode: ENTITLEMENT_FEATURES.insuranceBilling },
  { path: '/secretary-claim-templates', featureCode: ENTITLEMENT_FEATURES.insuranceBilling },
  { prefix: '/secretary-patient-insurance', featureCode: ENTITLEMENT_FEATURES.insuranceBilling },
  { prefix: '/templates', featureCode: ENTITLEMENT_FEATURES.templatesEngine },
]);

function normalizePathname(value) {
  if (typeof value !== 'string') return '';
  const [withoutHash] = value.split('#');
  const [withoutSearch] = withoutHash.split('?');
  const normalized = withoutSearch.trim();
  if (!normalized || normalized === '/') return normalized || '';
  return normalized.replace(/\/+$/, '');
}

function matchesRouteRule(pathname, rule) {
  if (rule.path) return pathname === normalizePathname(rule.path);
  if (!rule.prefix) return false;

  const prefix = normalizePathname(rule.prefix);
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function getFeatureRequirementForPath(pathname) {
  const normalizedPathname = normalizePathname(pathname);
  const rule = FEATURE_ROUTE_RULES.find((candidate) => matchesRouteRule(normalizedPathname, candidate));
  return rule?.featureCode || null;
}

export function canAccessFeaturePath(entitlements, pathname) {
  const featureCode = getFeatureRequirementForPath(pathname);
  return featureCode ? hasEntitlement(entitlements, featureCode) : true;
}

export function filterNavigationItemsByEntitlements(items = [], entitlements = {}) {
  return items.filter((item) => canAccessFeaturePath(entitlements, item?.path));
}
