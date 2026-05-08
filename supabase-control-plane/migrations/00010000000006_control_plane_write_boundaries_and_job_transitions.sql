-- DoctoLeb Control Plane · write boundaries and provisioning transitions
-- Keeps the control plane zero-PHI and moves authenticated browser writes
-- behind audited Edge Functions. Service-role Edge Functions still bypass RLS.

-- Authenticated users may read through RLS, but mutations must go through
-- admin Edge Functions that validate role, preconditions, audit events, and
-- reversible state transitions.
drop policy if exists tenants_super_admin_insert on public.tenants;
drop policy if exists tenants_super_admin_update on public.tenants;
drop policy if exists tenants_super_admin_delete on public.tenants;

drop policy if exists tenant_domains_super_admin_insert on public.tenant_domains;
drop policy if exists tenant_domains_super_admin_update on public.tenant_domains;
drop policy if exists tenant_domains_super_admin_delete on public.tenant_domains;

drop policy if exists super_admins_super_admin_insert on public.super_admins;
drop policy if exists super_admins_super_admin_update on public.super_admins;

drop policy if exists plans_billing_insert on public.plans;
drop policy if exists plans_billing_update on public.plans;
drop policy if exists plans_billing_delete on public.plans;

drop policy if exists plan_entitlements_billing_insert on public.plan_entitlements;
drop policy if exists plan_entitlements_billing_update on public.plan_entitlements;
drop policy if exists plan_entitlements_billing_delete on public.plan_entitlements;

drop policy if exists tenant_entitlements_operator_insert on public.tenant_entitlements;
drop policy if exists tenant_entitlements_operator_update on public.tenant_entitlements;
drop policy if exists tenant_entitlements_operator_delete on public.tenant_entitlements;

drop policy if exists tenant_provisioning_jobs_operator_insert on public.tenant_provisioning_jobs;
drop policy if exists tenant_provisioning_jobs_operator_update on public.tenant_provisioning_jobs;
drop policy if exists tenant_provisioning_jobs_operator_delete on public.tenant_provisioning_jobs;

alter table public.tenant_provisioning_jobs
  drop constraint if exists tenant_provisioning_jobs_status_check;

alter table public.tenant_provisioning_jobs
  add constraint tenant_provisioning_jobs_status_check
  check (status in (
    'draft',
    'ready_for_manual_provisioning',
    'provisioning',
    'blocked',
    'completed',
    'failed',
    'cancelled',
    'archived'
  ));

create or replace function public.enforce_tenant_provisioning_job_transition()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'ready_for_manual_provisioning') then
      raise exception 'INVALID_PROVISIONING_JOB_INITIAL_STATUS'
        using errcode = '23514';
    end if;
    return new;
  end if;

  if old.status = new.status then
    return new;
  end if;

  if new.status = 'completed' and new.completed_at is null then
    new.completed_at = now();
  end if;

  if old.status = 'draft'
     and new.status in ('ready_for_manual_provisioning', 'cancelled', 'archived') then
    return new;
  end if;

  if old.status = 'ready_for_manual_provisioning'
     and new.status in ('provisioning', 'blocked', 'cancelled', 'archived') then
    return new;
  end if;

  if old.status = 'provisioning'
     and new.status in ('blocked', 'completed', 'failed', 'cancelled') then
    return new;
  end if;

  if old.status = 'blocked'
     and new.status in ('ready_for_manual_provisioning', 'provisioning', 'failed', 'cancelled', 'archived') then
    return new;
  end if;

  if old.status = 'failed'
     and new.status in ('ready_for_manual_provisioning', 'cancelled', 'archived') then
    return new;
  end if;

  if old.status in ('completed', 'cancelled')
     and new.status = 'archived' then
    return new;
  end if;

  raise exception 'INVALID_PROVISIONING_JOB_STATUS_TRANSITION'
    using errcode = '23514';
end;
$$;

revoke all on function public.enforce_tenant_provisioning_job_transition() from public;
revoke execute on function public.enforce_tenant_provisioning_job_transition() from public, anon, authenticated;

drop trigger if exists tenant_provisioning_jobs_status_transition on public.tenant_provisioning_jobs;
create trigger tenant_provisioning_jobs_status_transition
  before insert or update of status on public.tenant_provisioning_jobs
  for each row execute function public.enforce_tenant_provisioning_job_transition();

insert into public.tenant_events (tenant_id, event_type, metadata)
select null, 'control_plane.write_boundaries_applied', jsonb_build_object(
  'directAuthenticatedWrites', false,
  'provisioningTransitionsEnforced', true,
  'phi', false
)
where not exists (
  select 1
  from public.tenant_events
  where event_type = 'control_plane.write_boundaries_applied'
);
