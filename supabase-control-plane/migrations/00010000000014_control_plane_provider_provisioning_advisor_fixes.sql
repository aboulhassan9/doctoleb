-- DoctoLeb Control Plane · provider provisioning advisor fixes
-- Covers FK indexes introduced by the provider provisioning backbone and
-- hardens existing trigger functions with explicit search_path settings.

create index if not exists provisioning_provider_connections_created_by_idx
  on public.provisioning_provider_connections (created_by)
  where created_by is not null;

create index if not exists provisioning_provider_connections_updated_by_idx
  on public.provisioning_provider_connections (updated_by)
  where updated_by is not null;

alter function public.enforce_tenant_provisioning_job_transition()
  set search_path = public;

alter function public.enforce_tenant_status_transition()
  set search_path = public;

insert into public.tenant_events (tenant_id, event_type, metadata)
select null, 'control_plane.provider_provisioning_advisor_fixes_applied', jsonb_build_object(
  'providerConnectionForeignKeysIndexed', true,
  'provisioningTransitionSearchPathHardened', true,
  'tenantStatusTransitionSearchPathHardened', true,
  'phi', false
)
where not exists (
  select 1
  from public.tenant_events
  where event_type = 'control_plane.provider_provisioning_advisor_fixes_applied'
);
