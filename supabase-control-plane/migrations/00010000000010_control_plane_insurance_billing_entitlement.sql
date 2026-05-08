-- Adds insurance billing as an entitlement-controlled feature.
-- No PHI. Default is disabled for every plan until the real claims workflow is enabled.

insert into public.plan_entitlements (plan_code, feature_code, is_enabled, limits)
values
  ('starter', 'insurance_billing', false, '{}'::jsonb),
  ('growth', 'insurance_billing', false, '{}'::jsonb),
  ('scale', 'insurance_billing', false, '{}'::jsonb)
on conflict (plan_code, feature_code) do update
set
  is_enabled = excluded.is_enabled,
  limits = excluded.limits;

insert into public.tenant_events (tenant_id, event_type, metadata)
select null, 'entitlements.insurance_billing_registered', jsonb_build_object(
  'featureCode', 'insurance_billing',
  'defaultEnabled', false,
  'phi', false
)
where not exists (
  select 1
  from public.tenant_events
  where event_type = 'entitlements.insurance_billing_registered'
);
