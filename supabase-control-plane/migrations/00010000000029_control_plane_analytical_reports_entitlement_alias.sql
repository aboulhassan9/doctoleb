-- Canonicalize the SaaS "Advanced reports" entitlement to the tenant
-- runtime flag used by the analytical-report engine.
--
-- Older control-plane rows used advanced_reports. Tenant migrations and the
-- clinic app use analytical_reports. Keep both during migration so deployed
-- tenants do not lose access while the console moves to the canonical code.

insert into public.plan_entitlements (plan_code, feature_code, is_enabled, limits)
select plan_code, 'analytical_reports', is_enabled, limits
from public.plan_entitlements
where feature_code = 'advanced_reports'
on conflict (plan_code, feature_code)
do update set
  is_enabled = excluded.is_enabled,
  limits = excluded.limits,
  updated_at = now();

insert into public.tenant_entitlements (tenant_id, feature_code, source, is_enabled, limits, reason, expires_at)
select
  tenant_id,
  'analytical_reports',
  source,
  is_enabled,
  limits,
  coalesce(reason, 'Migrated from advanced_reports entitlement alias.'),
  expires_at
from public.tenant_entitlements
where feature_code = 'advanced_reports'
on conflict (tenant_id, feature_code, source)
do update set
  is_enabled = excluded.is_enabled,
  limits = excluded.limits,
  reason = excluded.reason,
  expires_at = excluded.expires_at,
  updated_at = now();
