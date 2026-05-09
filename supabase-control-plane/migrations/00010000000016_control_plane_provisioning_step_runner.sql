-- DoctoLeb Control Plane · provisioning step runner
-- Adds private service-role RPCs used by admin-run-provisioning-step.
-- The runner records step attempts, terminal results, and audit events without
-- storing PHI, raw provider tokens, or tenant service credentials.

create or replace function public.admin_mark_provisioning_step_running(
  p_actor_id uuid,
  p_step_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_step public.tenant_provisioning_steps%rowtype;
  v_job public.tenant_provisioning_jobs%rowtype;
begin
  if p_actor_id is null or p_step_id is null then
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

  select *
  into v_job
  from public.tenant_provisioning_jobs
  where id = v_step.provisioning_job_id
  for update;

  if not found then
    return jsonb_build_object('data', null, 'error', 'PROVISIONING_JOB_NOT_FOUND');
  end if;

  if v_job.status in ('completed', 'cancelled', 'archived', 'failed') then
    return jsonb_build_object(
      'data', jsonb_build_object('step', to_jsonb(v_step), 'job', to_jsonb(v_job)),
      'error', 'JOB_NOT_RUNNABLE'
    );
  end if;

  if v_step.status in ('succeeded', 'skipped', 'cancelled', 'rolled_back') then
    return jsonb_build_object(
      'data', jsonb_build_object(
        'step', to_jsonb(v_step),
        'job', to_jsonb(v_job),
        'alreadyFinal', true
      ),
      'error', null
    );
  end if;

  if v_step.status <> 'running' then
    update public.tenant_provisioning_steps
    set status = 'running',
        attempt_count = attempt_count + 1,
        started_at = coalesce(started_at, now()),
        completed_at = null,
        last_error_code = null,
        last_error_summary = null
    where id = p_step_id
    returning * into v_step;
  end if;

  update public.tenant_provisioning_jobs
  set status = case
        when status in ('ready_for_manual_provisioning', 'blocked') then 'provisioning'
        else status
      end,
      automation_status = 'running',
      last_error = null
  where id = v_step.provisioning_job_id
  returning * into v_job;

  insert into public.tenant_events (
    tenant_id,
    event_type,
    actor_id,
    metadata
  )
  values (
    v_step.tenant_id,
    'tenant.provisioning_step_started',
    p_actor_id,
    jsonb_build_object(
      'stepId', v_step.id,
      'jobId', v_step.provisioning_job_id,
      'stepCode', v_step.step_code,
      'provider', v_step.provider,
      'attemptCount', v_step.attempt_count,
      'phi', false
    )
  );

  return jsonb_build_object(
    'data', jsonb_build_object('step', to_jsonb(v_step), 'job', to_jsonb(v_job)),
    'error', null
  );
exception
  when check_violation then
    return jsonb_build_object('data', null, 'error', 'INVALID_STEP_TRANSITION');
  when others then
    return jsonb_build_object('data', null, 'error', 'STEP_RUN_START_FAILED');
end;
$$;

create or replace function public.admin_record_provisioning_step_result_atomic(
  p_actor_id uuid,
  p_step_id uuid,
  p_status text,
  p_postconditions jsonb default '{}'::jsonb,
  p_error_code text default null,
  p_error_summary text default null,
  p_external_resource_kind text default null,
  p_external_resource_id text default null,
  p_external_resource_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := lower(trim(coalesce(p_status, '')));
  v_postconditions jsonb := coalesce(p_postconditions, '{}'::jsonb);
  v_step public.tenant_provisioning_steps%rowtype;
  v_job public.tenant_provisioning_jobs%rowtype;
  v_event_type text;
begin
  if p_actor_id is null
     or p_step_id is null
     or v_status not in ('succeeded', 'skipped', 'failed')
     or jsonb_typeof(v_postconditions) <> 'object' then
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

  select *
  into v_job
  from public.tenant_provisioning_jobs
  where id = v_step.provisioning_job_id
  for update;

  if not found then
    return jsonb_build_object('data', null, 'error', 'PROVISIONING_JOB_NOT_FOUND');
  end if;

  if v_step.status in ('succeeded', 'skipped', 'cancelled', 'rolled_back') then
    return jsonb_build_object(
      'data', jsonb_build_object(
        'step', to_jsonb(v_step),
        'job', to_jsonb(v_job),
        'alreadyFinal', true
      ),
      'error', null
    );
  end if;

  if v_step.status <> 'running' then
    return jsonb_build_object('data', null, 'error', 'STEP_NOT_RUNNING');
  end if;

  update public.tenant_provisioning_steps
  set status = v_status,
      postconditions = postconditions || v_postconditions,
      external_resource_kind = coalesce(nullif(trim(p_external_resource_kind), ''), external_resource_kind),
      external_resource_id = coalesce(nullif(trim(p_external_resource_id), ''), external_resource_id),
      external_resource_url = coalesce(nullif(trim(p_external_resource_url), ''), external_resource_url),
      last_error_code = case when v_status = 'failed' then nullif(trim(p_error_code), '') else null end,
      last_error_summary = case
        when v_status = 'failed' then left(nullif(trim(p_error_summary), ''), 1000)
        else null
      end,
      completed_at = now()
  where id = p_step_id
  returning * into v_step;

  update public.tenant_provisioning_jobs
  set status = case
        when v_status = 'failed' then 'blocked'
        else status
      end,
      automation_status = case
        when v_status = 'failed' then 'blocked'
        when exists (
          select 1
          from public.tenant_provisioning_steps
          where provisioning_job_id = v_step.provisioning_job_id
            and status not in ('succeeded', 'skipped')
        ) then 'running'
        else 'completed'
      end,
      last_error = case
        when v_status = 'failed' then left(coalesce(nullif(trim(p_error_summary), ''), nullif(trim(p_error_code), ''), 'Provisioning step failed.'), 1000)
        else null
      end,
      completed_at = case
        when not exists (
          select 1
          from public.tenant_provisioning_steps
          where provisioning_job_id = v_step.provisioning_job_id
            and status not in ('succeeded', 'skipped')
        ) then now()
        else completed_at
      end
  where id = v_step.provisioning_job_id
  returning * into v_job;

  v_event_type := case v_status
    when 'failed' then 'tenant.provisioning_step_failed'
    when 'skipped' then 'tenant.provisioning_step_skipped'
    else 'tenant.provisioning_step_succeeded'
  end;

  insert into public.tenant_events (
    tenant_id,
    event_type,
    actor_id,
    metadata
  )
  values (
    v_step.tenant_id,
    v_event_type,
    p_actor_id,
    jsonb_build_object(
      'stepId', v_step.id,
      'jobId', v_step.provisioning_job_id,
      'stepCode', v_step.step_code,
      'provider', v_step.provider,
      'status', v_step.status,
      'attemptCount', v_step.attempt_count,
      'errorCode', v_step.last_error_code,
      'hasExternalResourceId', v_step.external_resource_id is not null,
      'phi', false
    )
  );

  return jsonb_build_object(
    'data', jsonb_build_object('step', to_jsonb(v_step), 'job', to_jsonb(v_job)),
    'error', null
  );
exception
  when check_violation then
    return jsonb_build_object('data', null, 'error', 'INVALID_STEP_RESULT');
  when others then
    return jsonb_build_object('data', null, 'error', 'STEP_RESULT_RECORD_FAILED');
end;
$$;

revoke all on function public.admin_mark_provisioning_step_running(uuid, uuid) from public;
revoke execute on function public.admin_mark_provisioning_step_running(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_mark_provisioning_step_running(uuid, uuid) to service_role;

revoke all on function public.admin_record_provisioning_step_result_atomic(uuid, uuid, text, jsonb, text, text, text, text, text) from public;
revoke execute on function public.admin_record_provisioning_step_result_atomic(uuid, uuid, text, jsonb, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_record_provisioning_step_result_atomic(uuid, uuid, text, jsonb, text, text, text, text, text) to service_role;

comment on function public.admin_mark_provisioning_step_running(uuid, uuid) is
  'Private service-role RPC that starts a zero-PHI provisioning step attempt and writes safe audit metadata.';

comment on function public.admin_record_provisioning_step_result_atomic(uuid, uuid, text, jsonb, text, text, text, text, text) is
  'Private service-role RPC that records a zero-PHI provisioning step terminal result with retry/undo metadata.';

insert into public.tenant_events (tenant_id, event_type, metadata)
select null, 'control_plane.provisioning_step_runner_applied', jsonb_build_object(
  'functions', array[
    'admin_mark_provisioning_step_running',
    'admin_record_provisioning_step_result_atomic'
  ],
  'serviceRoleOnly', true,
  'storesRawProviderSecrets', false,
  'phi', false
)
where not exists (
  select 1
  from public.tenant_events
  where event_type = 'control_plane.provisioning_step_runner_applied'
);
