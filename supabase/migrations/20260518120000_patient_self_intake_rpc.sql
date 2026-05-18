-- Patient self-intake and config-ready patient forms
--
-- V1 keeps the patient UI simple, but makes the contract future-ready:
--   - default onboarding fields stay in code as the canonical registry;
--   - tenant/doctor overrides are stored as zero-PHI configuration;
--   - custom patient-entered answers are accepted only for active custom.*
--     fields and only for the current authenticated patient's own record.

alter table public.medical_intake
  add column if not exists field_config_version integer not null default 1,
  add column if not exists custom_answers jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'medical_intake_field_config_version_check'
      and conrelid = 'public.medical_intake'::regclass
  ) then
    alter table public.medical_intake
      add constraint medical_intake_field_config_version_check
      check (field_config_version between 1 and 1000);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'medical_intake_custom_answers_object_check'
      and conrelid = 'public.medical_intake'::regclass
  ) then
    alter table public.medical_intake
      add constraint medical_intake_custom_answers_object_check
      check (jsonb_typeof(custom_answers) = 'object');
  end if;
end $$;

create table if not exists public.patient_form_field_config (
  id uuid primary key default gen_random_uuid(),
  form_context text not null default 'patient_onboarding'
    check (form_context = any (array['patient_onboarding', 'appointment_booking'])),
  scope text not null
    constraint patient_form_field_config_scope_value_check
      check (scope = any (array['tenant', 'doctor'])),
  doctor_id uuid references public.doctors(id) on delete cascade,
  field_kind text not null default 'base'
    check (field_kind = any (array['base', 'custom'])),
  field_key text not null,
  section text not null
    check (section = any (array['identity', 'safety', 'support', 'booking', 'visit', 'coverage'])),
  field_type text not null default 'text'
    check (field_type = any (array['text', 'textarea', 'select', 'date', 'tel'])),
  is_visible boolean not null default true,
  is_required boolean not null default false,
  sort_order integer not null default 500
    check (sort_order between -1000 and 2000),
  label text,
  placeholder text,
  help_text text,
  options jsonb not null default '[]'::jsonb,
  rows integer,
  status text not null default 'active'
    check (status = any (array['draft', 'active', 'archived'])),
  config_version integer not null default 1
    check (config_version between 1 and 1000),
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_form_field_config_scope_check check (
    (scope = 'tenant' and doctor_id is null)
    or (scope = 'doctor' and doctor_id is not null)
  ),
  constraint patient_form_field_config_options_check check (jsonb_typeof(options) = 'array'),
  constraint patient_form_field_config_rows_check check (rows is null or rows between 2 and 8),
  constraint patient_form_field_config_copy_check check (
    (label is null or char_length(trim(label)) between 1 and 120)
    and (placeholder is null or char_length(trim(placeholder)) <= 240)
    and (help_text is null or char_length(trim(help_text)) <= 360)
  ),
  constraint patient_form_field_config_field_key_check check (
    (
      field_kind = 'base'
      and field_key = any (array[
        'first_name',
        'last_name',
        'phone',
        'date_of_birth',
        'sex',
        'blood_type',
        'allergies',
        'current_medications',
        'medical_history',
        'emergency_contact',
        'emergency_phone',
        'insurance_id'
      ])
    )
    or (
      field_kind = 'custom'
      and field_key ~ '^custom\.[a-z0-9_]{2,60}$'
      and label is not null
      and field_type = any (array['text', 'textarea', 'select'])
    )
  )
);

create unique index if not exists patient_form_field_config_active_scope_key_idx
  on public.patient_form_field_config (
    form_context,
    scope,
    coalesce(doctor_id, '00000000-0000-0000-0000-000000000000'::uuid),
    field_key
  )
  where status <> 'archived';

create index if not exists patient_form_field_config_active_lookup_idx
  on public.patient_form_field_config (form_context, scope, doctor_id, status, sort_order);

drop trigger if exists patient_form_field_config_set_updated_at on public.patient_form_field_config;
create trigger patient_form_field_config_set_updated_at
  before update on public.patient_form_field_config
  for each row execute function public.set_updated_at();

alter table public.patient_form_field_config enable row level security;

drop policy if exists patient_form_field_config_select on public.patient_form_field_config;
drop policy if exists patient_form_field_config_manage on public.patient_form_field_config;

create policy patient_form_field_config_select
  on public.patient_form_field_config
  for select
  to authenticated
  using (status = 'active' or public.is_staff());

create policy patient_form_field_config_manage
  on public.patient_form_field_config
  for all
  to authenticated
  using (
    public.has_role(array['admin'])
    or (scope = 'doctor' and doctor_id = public.current_doctor_id())
  )
  with check (
    public.has_role(array['admin'])
    or (scope = 'doctor' and doctor_id = public.current_doctor_id())
  );

grant select on public.patient_form_field_config to authenticated;
grant insert, update, delete on public.patient_form_field_config to authenticated;
grant all on public.patient_form_field_config to service_role;

create or replace function public.get_patient_onboarding_definition(
  p_patient_id uuid default null,
  p_doctor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_domain_user_id uuid;
  v_doctor_id uuid;
  v_is_staff boolean;
  v_field_overrides jsonb;
  v_custom_fields jsonb;
  v_version integer;
  v_source text;
begin
  v_domain_user_id := public.current_domain_user_id();
  v_is_staff := public.is_staff();

  if v_domain_user_id is null then
    raise exception 'AUTH_REQUIRED'
      using errcode = '42501';
  end if;

  if p_patient_id is not null and not v_is_staff then
    if not exists (
      select 1
      from public.patients as p
      where p.id = p_patient_id
        and p.user_id = v_domain_user_id
        and coalesce(p.is_archived, false) = false
    ) then
      raise exception 'PATIENT_NOT_FOUND_OR_FORBIDDEN'
        using errcode = '42501';
    end if;
  end if;

  v_doctor_id := p_doctor_id;

  if v_doctor_id is null and p_patient_id is not null then
    select a.doctor_id
      into v_doctor_id
    from public.appointments as a
    where a.patient_id = p_patient_id
      and a.status <> 'cancelled'
    order by
      case when a.scheduled_at >= now() then 0 else 1 end,
      a.scheduled_at desc
    limit 1;
  end if;

  with active_config as (
    select
      c.*,
      case c.scope when 'doctor' then 2 else 1 end as scope_rank
    from public.patient_form_field_config as c
    where c.form_context = 'patient_onboarding'
      and c.status = 'active'
      and (
        c.scope = 'tenant'
        or (c.scope = 'doctor' and c.doctor_id = v_doctor_id)
      )
  ),
  ranked_config as (
    select
      *,
      row_number() over (
        partition by field_key
        order by scope_rank desc, updated_at desc, id desc
      ) as row_rank
    from active_config
  ),
  selected_config as (
    select *
    from ranked_config
    where row_rank = 1
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'key', field_key,
          'fieldKind', field_kind,
          'section', section,
          'type', field_type,
          'visible', is_visible,
          'required', is_required,
          'order', sort_order,
          'label', label,
          'placeholder', placeholder,
          'helpText', help_text,
          'options', options,
          'rows', rows
        ))
        order by sort_order, field_key
      ) filter (where field_kind = 'base'),
      '[]'::jsonb
    ),
    coalesce(
      jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'key', field_key,
          'fieldKind', field_kind,
          'section', section,
          'type', field_type,
          'visible', is_visible,
          'required', is_required,
          'order', sort_order,
          'label', label,
          'placeholder', placeholder,
          'helpText', help_text,
          'options', options,
          'rows', rows
        ))
        order by sort_order, field_key
      ) filter (where field_kind = 'custom'),
      '[]'::jsonb
    ),
    coalesce(max(config_version), 1),
    case
      when count(*) filter (where scope = 'doctor') > 0 then 'doctor'
      when count(*) filter (where scope = 'tenant') > 0 then 'tenant'
      else 'default'
    end
  into v_field_overrides, v_custom_fields, v_version, v_source
  from selected_config;

  return jsonb_build_object(
    'version', v_version,
    'source', v_source,
    'doctorId', v_doctor_id,
    'fieldOverrides', v_field_overrides,
    'customFields', v_custom_fields
  );
end;
$$;

drop function if exists public.submit_patient_self_intake(uuid, text, text, text);

create or replace function public.submit_patient_self_intake(
  p_patient_id uuid,
  p_allergies_text text default null,
  p_current_medications_text text default null,
  p_notes text default null,
  p_field_config_version integer default 1,
  p_custom_answers jsonb default '{}'::jsonb
)
returns public.medical_intake
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_domain_user_id uuid;
  v_doctor_id uuid;
  v_custom_answers jsonb;
  v_field_config_version integer;
  v_row public.medical_intake;
begin
  v_domain_user_id := public.current_domain_user_id();

  if v_domain_user_id is null then
    raise exception 'AUTH_REQUIRED'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.patients as p
    where p.id = p_patient_id
      and p.user_id = v_domain_user_id
      and coalesce(p.is_archived, false) = false
  ) then
    raise exception 'PATIENT_NOT_FOUND_OR_FORBIDDEN'
      using errcode = '42501';
  end if;

  v_custom_answers := coalesce(p_custom_answers, '{}'::jsonb);
  v_field_config_version := greatest(1, least(1000, coalesce(p_field_config_version, 1)));

  if jsonb_typeof(v_custom_answers) <> 'object' then
    raise exception 'INVALID_CUSTOM_ANSWERS'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_each(v_custom_answers) as answer(field_key, field_value)
    where answer.field_key !~ '^custom\.[a-z0-9_]{2,60}$'
      or jsonb_typeof(answer.field_value) not in ('string', 'null')
      or char_length(coalesce(answer.field_value #>> '{}', '')) > 4000
  ) then
    raise exception 'INVALID_CUSTOM_ANSWERS'
      using errcode = '22023';
  end if;

  select a.doctor_id
    into v_doctor_id
  from public.appointments as a
  where a.patient_id = p_patient_id
    and a.status <> 'cancelled'
  order by
    case when a.scheduled_at >= now() then 0 else 1 end,
    a.scheduled_at desc
  limit 1;

  if exists (
    with active_config as (
      select
        c.*,
        case c.scope when 'doctor' then 2 else 1 end as scope_rank
      from public.patient_form_field_config as c
      where c.form_context = 'patient_onboarding'
        and c.field_kind = 'custom'
        and c.status = 'active'
        and c.is_visible = true
        and (
          c.scope = 'tenant'
          or (c.scope = 'doctor' and c.doctor_id = v_doctor_id)
        )
    ),
    ranked_config as (
      select
        *,
        row_number() over (
          partition by field_key
          order by scope_rank desc, updated_at desc, id desc
        ) as row_rank
      from active_config
    ),
    selected_config as (
      select *
      from ranked_config
      where row_rank = 1
    )
    select 1
    from jsonb_each(v_custom_answers) as answer(field_key, field_value)
    left join selected_config as config
      on config.field_key = answer.field_key
    where config.id is null
      or (
        config.field_type = 'select'
        and jsonb_typeof(answer.field_value) = 'string'
        and coalesce(answer.field_value #>> '{}', '') <> ''
        and not exists (
          select 1
          from jsonb_array_elements(config.options) as option_value
          where option_value ->> 'value' = (answer.field_value #>> '{}')
        )
      )
  ) then
    raise exception 'CUSTOM_FIELD_NOT_ALLOWED'
      using errcode = '42501';
  end if;

  insert into public.medical_intake (
    patient_id,
    status,
    collected_by,
    completed_by,
    completed_at,
    allergies_text,
    current_medications_text,
    notes,
    field_config_version,
    custom_answers
  )
  values (
    p_patient_id,
    'completed',
    v_domain_user_id,
    v_domain_user_id,
    now(),
    nullif(trim(coalesce(p_allergies_text, '')), ''),
    nullif(trim(coalesce(p_current_medications_text, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    v_field_config_version,
    jsonb_strip_nulls(v_custom_answers)
  )
  on conflict (patient_id) do update
    set status = 'completed',
        collected_by = coalesce(public.medical_intake.collected_by, excluded.collected_by),
        completed_by = v_domain_user_id,
        completed_at = now(),
        reopened_by = null,
        reopened_at = null,
        reopen_reason = null,
        allergies_text = excluded.allergies_text,
        current_medications_text = excluded.current_medications_text,
        notes = excluded.notes,
        field_config_version = excluded.field_config_version,
        custom_answers = excluded.custom_answers,
        updated_at = now()
  returning * into v_row;

  update public.patients
    set intake_completed_at = coalesce(intake_completed_at, now()),
        updated_at = now()
  where id = p_patient_id;

  return v_row;
end;
$$;

revoke all on function public.get_patient_onboarding_definition(uuid, uuid) from public, anon;
grant execute on function public.get_patient_onboarding_definition(uuid, uuid) to authenticated, service_role;

revoke all on function public.submit_patient_self_intake(uuid, text, text, text, integer, jsonb) from public, anon;
grant execute on function public.submit_patient_self_intake(uuid, text, text, text, integer, jsonb) to authenticated, service_role;

comment on table public.patient_form_field_config
  is 'Zero-PHI allowlisted patient form configuration for tenant/doctor-scoped patient onboarding and future appointment booking forms.';

comment on column public.medical_intake.custom_answers
  is 'Patient-entered answers for active custom.* intake fields. Keys are validated by submit_patient_self_intake.';

comment on function public.get_patient_onboarding_definition(uuid, uuid)
  is 'Returns zero-PHI active patient onboarding field overrides/custom fields for the current patient and optional doctor scope.';

comment on function public.submit_patient_self_intake(uuid, text, text, text, integer, jsonb)
  is 'Allows an authenticated patient to complete approved self-intake fields and active custom.* answers for their own patient record.';
