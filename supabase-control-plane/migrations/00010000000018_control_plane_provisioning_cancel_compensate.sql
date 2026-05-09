-- DoctoLeb Control Plane · provisioning cancel and compensation helpers
--
-- Adds service-role-only RPCs for operator-triggered provisioning cancellation
-- and completed-step compensation records. These helpers keep cancellation and
-- rollback visible, audited, and zero-PHI.

create or replace function public.admin_cancel_provisioning_job_atomic(
  p_actor_id uuid,
  p_provisioning_job_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.tenant_provisioning_jobs%rowtype;
  v_tenant public.tenants%rowtype;
  v_reason text := left(nullif(trim(coalesce(p_reason, '')), ''), 1000);
begin
  if p_actor_id is null or p_provisioning_job_id is null then
    return jsonb_build_object('data', null, 'error', 'INVALID_REQUEST');
  end if;

  select *
  into v_job
  from public.tenant_provisioning_jobs
  where id = p_provisioning_job_id
  for update;

  if not found then
    return jsonb_build_object('data', null, 'error', 'PROVISIONING_JOB_NOT_FOUND');
  end if;

  if v_job.status = 'cancelled' then
    return jsonb_build_object(
      'data', jsonb_build_object('job', to_jsonb(v_job), 'alreadyFinal', true),
      'error', null
    );
  end if;

  if v_job.status in ('completed', 'archived') then
    return jsonb_build_object('data', null, 'error', 'PROVISIONING_JOB_NOT_CANCELLABLE');
  end if;

  if v_job.tenant_id is not null then
    select *
    into v_tenant
    from public.tenants
    where id = v_job.tenant_id
    for update;

    if found and v_tenant.status = 'active' then
      return jsonb_build_object('data', null, 'error', 'TENANT_ALREADY_ACTIVE');
    end if;

    if found and v_tenant.status in ('draft', 'provisioning') then
      update public.tenants
      set status = 'inactive',
          updated_at = now()
      where id = v_tenant.id;
    end if;
  end if;

  update public.tenant_provisioning_steps
  set status = 'cancelled',
      completed_at = now(),
      last_error_code = 'JOB_CANCELLED',
      last_error_summary = coalesce(v_reason, 'Provisioning job was cancelled by an operator.'),
      updated_at = now()
  where provisioning_job_id = v_job.id
    and status not in ('succeeded', 'skipped', 'cancelled', 'rolled_back');

  update public.tenant_provisioning_jobs
  set status = 'cancelled',
      automation_status = 'cancelled',
      cancel_requested_at = coalesce(cancel_requested_at, now()),
      last_error = coalesce(v_reason, 'Provisioning job was cancelled by an operator.'),
      completed_at = now(),
      updated_at = now()
  where id = v_job.id
  returning * into v_job;

  insert into public.tenant_events (
    tenant_id,
    event_type,
    actor_id,
    metadata
  )
  values (
    v_job.tenant_id,
    'tenant.provisioning_job_cancelled',
    p_actor_id,
    jsonb_build_object(
      'jobId', v_job.id,
      'reason', v_reason,
      'tenantMovedInactiveWhenDraftOrProvisioning', true,
      'phi', false
    )
  );

  return jsonb_build_object(
    'data', jsonb_build_object('job', to_jsonb(v_job)),
    'error', null
  );
exception
  when check_violation then
    return jsonb_build_object('data', null, 'error', 'PROVISIONING_CANCEL_BLOCKED');
  when others then
    return jsonb_build_object('data', null, 'error', 'PROVISIONING_CANCEL_FAILED');
end;
$$;

create or replace function public.admin_mark_provisioning_step_rolled_back_atomic(
  p_actor_id uuid,
  p_step_id uuid,
  p_postconditions jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_postconditions jsonb := coalesce(p_postconditions, '{}'::jsonb);
  v_step public.tenant_provisioning_steps%rowtype;
begin
  if p_actor_id is null or p_step_id is null or jsonb_typeof(v_postconditions) <> 'object' then
    return jsonb_build_object('data', null, 'error', 'INVALID_REQUEST');
  end if;

  select *
  into v_step
  from public.tenant_provisioning_steps
  where id = p_step_id
  for update;

  if not found then
    return jsonb_build_object('data', null, 'error', 'STEP_NOT_FOUND');
  end if;

  if v_step.status = 'rolled_back' then
    return jsonb_build_object(
      'data', jsonb_build_object('step', to_jsonb(v_step), 'alreadyFinal', true),
      'error', null
    );
  end if;

  if v_step.status <> 'succeeded' then
    return jsonb_build_object('data', null, 'error', 'STEP_NOT_COMPENSATABLE');
  end if;

  if coalesce(v_step.undo_strategy, 'none') = 'none' then
    return jsonb_build_object('data', null, 'error', 'STEP_NOT_COMPENSATABLE');
  end if;

  update public.tenant_provisioning_steps
  set status = 'rolled_back',
      postconditions = postconditions || v_postconditions,
      completed_at = now(),
      updated_at = now()
  where id = v_step.id
  returning * into v_step;

  insert into public.tenant_events (
    tenant_id,
    event_type,
    actor_id,
    metadata
  )
  values (
    v_step.tenant_id,
    'tenant.provisioning_step_rolled_back',
    p_actor_id,
    jsonb_build_object(
      'stepId', v_step.id,
      'jobId', v_step.provisioning_job_id,
      'stepCode', v_step.step_code,
      'undoStrategy', v_step.undo_strategy,
      'phi', false
    )
  );

  return jsonb_build_object(
    'data', jsonb_build_object('step', to_jsonb(v_step)),
    'error', null
  );
exception
  when others then
    return jsonb_build_object('data', null, 'error', 'STEP_COMPENSATION_RECORD_FAILED');
end;
$$;

revoke all on function public.admin_cancel_provisioning_job_atomic(uuid, uuid, text) from public;
revoke execute on function public.admin_cancel_provisioning_job_atomic(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_cancel_provisioning_job_atomic(uuid, uuid, text) to service_role;

revoke all on function public.admin_mark_provisioning_step_rolled_back_atomic(uuid, uuid, jsonb) from public;
revoke execute on function public.admin_mark_provisioning_step_rolled_back_atomic(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.admin_mark_provisioning_step_rolled_back_atomic(uuid, uuid, jsonb) to service_role;

comment on function public.admin_cancel_provisioning_job_atomic(uuid, uuid, text) is
  'Private service-role RPC that cancels an unfinished zero-PHI tenant provisioning job.';

comment on function public.admin_mark_provisioning_step_rolled_back_atomic(uuid, uuid, jsonb) is
  'Private service-role RPC that records a zero-PHI provisioning step compensation result.';

insert into public.tenant_events (tenant_id, event_type, metadata)
select null, 'control_plane.provisioning_cancel_compensate_applied', jsonb_build_object(
  'functions', array[
    'admin_cancel_provisioning_job_atomic',
    'admin_mark_provisioning_step_rolled_back_atomic'
  ],
  'serviceRoleOnly', true,
  'phi', false
)
where not exists (
  select 1
  from public.tenant_events
  where event_type = 'control_plane.provisioning_cancel_compensate_applied'
);
