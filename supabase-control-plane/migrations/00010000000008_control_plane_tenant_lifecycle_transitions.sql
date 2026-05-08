-- DoctoLeb Control Plane · tenant lifecycle transitions
-- Aligns tenant status values with the documented SaaS lifecycle and keeps
-- activation reversible/safe by requiring an active domain before activation.

alter table public.tenants
  drop constraint if exists tenants_status_check;

alter table public.tenants
  add constraint tenants_status_check
  check (status in (
    'draft',
    'provisioning',
    'active',
    'maintenance',
    'suspended',
    'inactive',
    'archived'
  ));

create or replace function public.enforce_tenant_status_transition()
returns trigger
language plpgsql
as $$
declare
  v_has_active_domain boolean;
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

    if not v_has_active_domain then
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

drop trigger if exists tenants_status_transition on public.tenants;
create trigger tenants_status_transition
  before insert or update of status on public.tenants
  for each row execute function public.enforce_tenant_status_transition();

insert into public.tenant_events (tenant_id, event_type, metadata)
select null, 'control_plane.tenant_lifecycle_transitions_applied', jsonb_build_object(
  'table', 'tenants',
  'statuses', array['draft','provisioning','active','maintenance','suspended','inactive','archived'],
  'activationRequiresActiveDomain', true,
  'phi', false
)
where not exists (
  select 1
  from public.tenant_events
  where event_type = 'control_plane.tenant_lifecycle_transitions_applied'
);
