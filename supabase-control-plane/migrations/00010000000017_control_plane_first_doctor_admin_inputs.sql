-- First doctor/admin input contract for tenant provisioning.
-- Stores SaaS customer contact metadata only. No clinical data/PHI belongs here.

alter table public.tenant_provisioning_jobs
  add column if not exists first_doctor_email text,
  add column if not exists first_doctor_display_name text,
  add column if not exists first_doctor_phone text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tenant_provisioning_jobs_first_doctor_email_check'
      and conrelid = 'public.tenant_provisioning_jobs'::regclass
  ) then
    alter table public.tenant_provisioning_jobs
      add constraint tenant_provisioning_jobs_first_doctor_email_check
      check (
        first_doctor_email is null
        or (
          first_doctor_email = lower(trim(first_doctor_email))
          and char_length(first_doctor_email) <= 320
          and first_doctor_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tenant_provisioning_jobs_first_doctor_name_check'
      and conrelid = 'public.tenant_provisioning_jobs'::regclass
  ) then
    alter table public.tenant_provisioning_jobs
      add constraint tenant_provisioning_jobs_first_doctor_name_check
      check (
        first_doctor_display_name is null
        or (
          char_length(trim(first_doctor_display_name)) between 1 and 160
          and first_doctor_display_name = trim(first_doctor_display_name)
        )
      );
  end if;
end $$;

create or replace function public.admin_set_provisioning_first_doctor_atomic(
  p_actor_id uuid,
  p_job_id uuid,
  p_email text,
  p_display_name text,
  p_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_display_name text := trim(coalesce(p_display_name, ''));
  v_phone text := nullif(left(trim(coalesce(p_phone, '')), 40), '');
  v_job public.tenant_provisioning_jobs%rowtype;
begin
  if p_actor_id is null
     or p_job_id is null
     or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or char_length(v_email) > 320
     or v_display_name = ''
     or char_length(v_display_name) > 160 then
    return jsonb_build_object('data', null, 'error', 'INVALID_REQUEST');
  end if;

  update public.tenant_provisioning_jobs
  set
    first_doctor_email = v_email,
    first_doctor_display_name = v_display_name,
    first_doctor_phone = v_phone,
    checklist = jsonb_set(
      coalesce(checklist, '{}'::jsonb),
      '{firstDoctorAdminInputCaptured}',
      'true'::jsonb,
      true
    ),
    updated_at = now()
  where id = p_job_id
    and status not in ('cancelled', 'archived')
  returning * into v_job;

  if v_job.id is null then
    return jsonb_build_object('data', null, 'error', 'PROVISIONING_JOB_NOT_FOUND');
  end if;

  insert into public.tenant_events (
    tenant_id,
    event_type,
    actor_id,
    metadata
  )
  values (
    v_job.tenant_id,
    'tenant.provisioning_first_doctor_input_set',
    p_actor_id,
    jsonb_build_object(
      'jobId', v_job.id,
      'emailCaptured', true,
      'displayNameCaptured', true,
      'phoneCaptured', v_phone is not null,
      'phi', false
    )
  );

  return jsonb_build_object(
    'data', jsonb_build_object(
      'id', v_job.id,
      'tenant_id', v_job.tenant_id,
      'first_doctor_email', v_job.first_doctor_email,
      'first_doctor_display_name', v_job.first_doctor_display_name,
      'first_doctor_phone', v_job.first_doctor_phone,
      'checklist', v_job.checklist,
      'updated_at', v_job.updated_at
    ),
    'error', null
  );
end;
$$;

revoke all on function public.admin_set_provisioning_first_doctor_atomic(uuid, uuid, text, text, text) from public;
revoke execute on function public.admin_set_provisioning_first_doctor_atomic(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_set_provisioning_first_doctor_atomic(uuid, uuid, text, text, text) to service_role;

comment on function public.admin_set_provisioning_first_doctor_atomic(uuid, uuid, text, text, text) is
  'Private service-role RPC for storing the first doctor/admin provisioning contact on a zero-PHI provisioning job.';
