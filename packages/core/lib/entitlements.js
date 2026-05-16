export const ENTITLEMENT_FEATURES = Object.freeze({
  messaging: 'messaging',
  customBranding: 'custom_branding',
  customDomain: 'custom_domain',
  staffAccounts: 'staff_accounts',
  insuranceBilling: 'insurance_billing',
  aiClinicalSummary: 'ai_clinical_summary',
  biDashboard: 'bi_dashboard',
  advancedReports: 'advanced_reports',
  templatesEngine: 'templates_engine',
  analyticalReports: 'analytical_reports',
});

const FEATURE_ALIASES = Object.freeze({
  [ENTITLEMENT_FEATURES.analyticalReports]: [ENTITLEMENT_FEATURES.advancedReports],
  [ENTITLEMENT_FEATURES.advancedReports]: [ENTITLEMENT_FEATURES.analyticalReports],
});

const SOURCE_PRIORITY = Object.freeze({
  plan: 10,
  tenant_feature_flags: 20,
  addon: 30,
  manual_override: 40,
});

export class EntitlementError extends Error {
  constructor(featureCode, message = 'Feature is not enabled for this tenant.') {
    super(message);
    this.name = 'EntitlementError';
    this.code = 'FEATURE_NOT_ENABLED';
    this.featureCode = featureCode;
  }
}

function normalizeFeatureCode(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function getEntitlementFeatureCodes(featureCode) {
  const normalizedFeatureCode = normalizeFeatureCode(featureCode);
  if (!normalizedFeatureCode) return [];
  return [normalizedFeatureCode, ...(FEATURE_ALIASES[normalizedFeatureCode] ?? [])];
}

function normalizeLimits(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeSource(value, fallback = 'plan') {
  return Object.prototype.hasOwnProperty.call(SOURCE_PRIORITY, value) ? value : fallback;
}

function normalizeEntitlement(row, fallbackSource = 'plan') {
  const featureCode = normalizeFeatureCode(row?.feature_code ?? row?.code);
  if (!featureCode) return null;

  return {
    featureCode,
    isEnabled: row?.is_enabled === true,
    limits: normalizeLimits(row?.limits ?? row?.config),
    source: normalizeSource(row?.source, fallbackSource),
    raw: row,
  };
}

function shouldReplace(current, candidate) {
  if (!current) return true;
  return SOURCE_PRIORITY[candidate.source] >= SOURCE_PRIORITY[current.source];
}

function applyEntitlement(map, row, fallbackSource) {
  const entitlement = normalizeEntitlement(row, fallbackSource);
  if (!entitlement) return map;

  const current = map[entitlement.featureCode];
  if (shouldReplace(current, entitlement)) {
    map[entitlement.featureCode] = {
      isEnabled: entitlement.isEnabled,
      limits: entitlement.limits,
      source: entitlement.source,
    };
  }

  return map;
}

export function resolveEntitlementMap({
  planCode,
  planEntitlements = [],
  tenantEntitlements = [],
} = {}) {
  const normalizedPlanCode = normalizeFeatureCode(planCode);
  const map = {};

  for (const row of planEntitlements) {
    if (normalizeFeatureCode(row?.plan_code) !== normalizedPlanCode) continue;
    applyEntitlement(map, row, 'plan');
  }

  for (const row of tenantEntitlements) {
    applyEntitlement(map, row, row?.source || 'manual_override');
  }

  return map;
}

export function featureFlagsToEntitlementMap(featureFlags = []) {
  const map = {};
  for (const row of featureFlags) {
    applyEntitlement(map, row, 'tenant_feature_flags');
  }
  return map;
}

export function hasEntitlement(entitlements, featureCode) {
  return getEntitlementFeatureCodes(featureCode).some((code) => entitlements?.[code]?.isEnabled === true);
}

export function requireEntitlement(entitlements, featureCode) {
  const enabledCode = getEntitlementFeatureCodes(featureCode)
    .find((code) => entitlements?.[code]?.isEnabled === true);
  if (!enabledCode) {
    throw new EntitlementError(normalizeFeatureCode(featureCode));
  }
  return entitlements[enabledCode];
}
