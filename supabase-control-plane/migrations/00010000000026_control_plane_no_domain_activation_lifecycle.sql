-- DoctoLeb Control Plane · no-domain activation lifecycle
--
-- Domain routing remains the preferred production path. During the no-domain
-- phase, activation is also allowed when the tenant has valid runtime config
-- and the provisioning ledger already proved /t/<tenant-slug> resolver smoke.
-- NO PHI is stored or returned here.

create or replace function public.enforce_tenant_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_has_active_domain boolean;
  v_project_ref text;
  v_slug text;
  v_supabase_url text;
  v_anon_key text;
  v_has_no_domain_runtime boolean;
  v_has_no_domain_smoke_checkpoint boolean;
begin
  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'provisioning') then
      raise exception 'INVALID_TENANT_INITIAL_STATUS'
        using errcode = '23514';
    end if;
    return new;
  end if;

  if old.status = new.status then
    return new;
  end if;

  if old.status = 'archived' then
    raise exception 'INVALID_TENANT_STATUS_TRANSITION'
      using errcode = '23514';
  end if;

  if new.status = 'active' then
    select exists (
      select 1
      from public.tenant_domains d
      where d.tenant_id = new.id
        and d.status = 'active'
    )
    into v_has_active_domain;

    v_project_ref := lower(trim(coalesce(new.supabase_project_ref, '')));
    v_slug := lower(trim(coalesce(new.slug, '')));
    v_supabase_url := lower(regexp_replace(trim(coalesce(new.supabase_url, '')), '/+$', ''));
    v_anon_key := trim(coalesce(new.supabase_anon_key, ''));

    v_has_no_domain_runtime :=
      v_slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'
      and v_project_ref ~ '^[a-z0-9]{20}$'
      and v_supabase_url = 'https://' || v_project_ref || '.supabase.co'
      and length(v_anon_key) >= 20
      and v_anon_key !~ '\s';

    select exists (
      select 1
      from public.tenant_provisioning_steps s
      join public.tenant_provisioning_jobs j on j.id = s.provisioning_job_id
      where s.tenant_id = new.id
        and s.step_code = 'smoke_test_resolver'
        and s.status = 'succeeded'
        and s.postconditions @> '{"noDomainPathSmokePassed": true}'::jsonb
        and j.status not in ('cancelled', 'archived', 'failed')
    )
    into v_has_no_domain_smoke_checkpoint;

    if not (
      v_has_active_domain
      or (v_has_no_domain_runtime and v_has_no_domain_smoke_checkpoint)
    ) then
      raise exception 'TENANT_ACTIVATION_REQUIRES_ACTIVE_DOMAIN'
        using errcode = '23514';
    end if;
  end if;

  if old.status = 'draft'
     and new.status in ('provisioning', 'inactive', 'archived') then
    return new;
  end if;

  if old.status = 'provisioning'
     and new.status in ('active', 'maintenance', 'suspended', 'inactive', 'archived') then
    return new;
  end if;

  if old.status = 'active'
     and new.status in ('maintenance', 'suspended', 'inactive', 'archived') then
    return new;
  end if;

  if old.status = 'maintenance'
     and new.status in ('active', 'suspended', 'inactive', 'archived') then
    return new;
  end if;

  if old.status = 'suspended'
     and new.status in ('active', 'maintenance', 'inactive', 'archived') then
    return new;
  end if;

  if old.status = 'inactive'
     and new.status in ('provisioning', 'active', 'archived') then
    return new;
  end if;

  raise exception 'INVALID_TENANT_STATUS_TRANSITION'
    using errcode = '23514';
end;
$$;

revoke all on function public.enforce_tenant_status_transition() from public;
revoke execute on function public.enforce_tenant_status_transition() from public, anon, authenticated;

insert into public.tenant_events (tenant_id, event_type, metadata)
select null, 'control_plane.no_domain_activation_lifecycle_applied', jsonb_build_object(
  'table', 'tenants',
  'activationRequiresActiveDomain', true,
  'activationAllowsNoDomainPathRouting', true,
  'activationRequiresNoDomainSmokeCheckpoint', true,
  'phi', false
)
where not exists (
  select 1
  from public.tenant_events
  where event_type = 'control_plane.no_domain_activation_lifecycle_applied'
);
