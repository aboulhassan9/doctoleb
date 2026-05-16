import {
  getEntitlementFeatureCodes,
  hasEntitlement,
  resolveEntitlementMap,
} from '../../../../packages/core/lib/entitlements.js';

function normalizeFeatureCode(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function toBooleanState(features, entitlements) {
  const state = {};
  for (const feature of features) {
    const code = normalizeFeatureCode(feature.code);
    state[code] = hasEntitlement(entitlements, code);
  }
  return state;
}

function manualOverrideMap(tenantEntitlements = []) {
  const map = new Map();
  for (const row of tenantEntitlements) {
    const code = normalizeFeatureCode(row?.feature_code);
    if (code && row?.source === 'manual_override') {
      for (const candidate of getEntitlementFeatureCodes(code)) {
        map.set(candidate, row);
      }
    }
  }
  return map;
}

export function resolvePlanEntitlementState({ planCode, planEntitlements = [], features = [] } = {}) {
  return toBooleanState(
    features,
    resolveEntitlementMap({
      planCode,
      planEntitlements,
      tenantEntitlements: [],
    }),
  );
}

export function resolveEffectiveEntitlementState({
  planCode,
  planEntitlements = [],
  tenantEntitlements = [],
  features = [],
} = {}) {
  return toBooleanState(
    features,
    resolveEntitlementMap({
      planCode,
      planEntitlements,
      tenantEntitlements,
    }),
  );
}

export function buildManualEntitlementSyncPayload({
  desiredState = {},
  planState = {},
  tenantEntitlements = [],
  features = [],
} = {}) {
  const existingManualOverrides = manualOverrideMap(tenantEntitlements);
  const entitlements = [];
  const resetFeatureCodes = [];

  for (const feature of features) {
    const code = normalizeFeatureCode(feature.code);
    if (!code) continue;

    const desiredEnabled = desiredState[code] === true;
    const planEnabled = planState[code] === true;
    const hasManualOverride = existingManualOverrides.has(code);

    if (desiredEnabled !== planEnabled) {
      entitlements.push({
        feature_code: code,
        source: 'manual_override',
        is_enabled: desiredEnabled,
        limits: {},
        reason: 'Console toggle',
      });
    } else if (hasManualOverride) {
      resetFeatureCodes.push(...getEntitlementFeatureCodes(code));
    }
  }

  return { entitlements, resetFeatureCodes: [...new Set(resetFeatureCodes)] };
}
