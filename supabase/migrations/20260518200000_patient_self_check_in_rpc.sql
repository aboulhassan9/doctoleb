-- Patient self check-in contract
--
-- Patients can submit allowlisted check-in/precheck fields for their own
-- active appointment. The browser never writes precheck_forms directly.

alter table public.precheck_forms
  add column if not exists appointment_id uuid references public.appointments(id) on delete set null,
  add column if not exists respiratory_rate integer,
  add column if not exists field_config_version integer not null default 1,
  add column if not exists custom_answers jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'precheck_forms_respiratory_rate_check'
      and conrelid = 'public.precheck_forms'::regclass
  ) then
    alter table public.precheck_forms
      add constraint precheck_forms_respiratory_rate_check
      check (respiratory_rate is null or respiratory_rate between 1 and 80);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'precheck_forms_field_config_version_check'
      and conrelid = 'public.precheck_forms'::regclass
  ) then
    alter table public.precheck_forms
      add constraint precheck_forms_field_config_version_check
      check (field_config_version between 1 and 1000);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'precheck_forms_custom_answers_object_check'
      and conrelid = 'public.precheck_forms'::regclass
  ) then
    alter table public.precheck_forms
      add constraint precheck_forms_custom_answers_object_check
      check (jsonb_typeof(custom_answers) = 'object');
  end if;
end $$;

create index if not exists idx_precheck_forms_appointment_id
  on public.precheck_forms (appointment_id);

create or replace function public.submit_patient_check_in(
  p_appointment_id uuid,
  p_field_config_version integer default 1,
  p_blood_pressure text default null,
  p_heart_rate integer default null,
  p_temperature numeric default null,
  p_respiratory_rate integer default null,
  p_weight numeric default null,
  p_height numeric default null,
  p_allergies text default null,
  p_current_medications text default null,
  p_symptoms text default null,
  p_is_urgent boolean default false,
  p_custom_answers jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_domain_user_id uuid;
  v_patient_id uuid;
  v_doctor_id uuid;
  v_appointment_status text;
  v_existing_id uuid;
  v_existing_status text;
  v_precheck public.precheck_forms%rowtype;
  v_custom_answers jsonb;
begin
  v_domain_user_id := public.current_domain_user_id();
  if v_domain_user_id is null then
    raise exception 'AUTH_REQUIRED'
      using errcode = '42501';
  end if;

  if p_appointment_id is null then
    raise exception 'APPOINTMENT_REQUIRED'
      using errcode = '22023';
  end if;

  if coalesce(p_field_config_version, 1) not between 1 and 1000 then
    raise exception 'INVALID_FIELD_CONFIG_VERSION'
      using errcode = '22023';
  end if;

  v_custom_answers := coalesce(p_custom_answers, '{}'::jsonb);
  if jsonb_typeof(v_custom_answers) <> 'object' then
    raise exception 'CUSTOM_ANSWERS_MUST_BE_OBJECT'
      using errcode = '22023';
  end if;

  select a.patient_id, a.doctor_id, a.status
    into v_patient_id, v_doctor_id, v_appointment_status
  from public.appointments as a
  join public.patients as p on p.id = a.patient_id
  where a.id = p_appointment_id
    and p.user_id = v_domain_user_id
    and coalesce(p.is_archived, false) = false;

  if v_patient_id is null then
    raise exception 'APPOINTMENT_NOT_FOUND_OR_FORBIDDEN'
      using errcode = '42501';
  end if;

  if v_appointment_status not in ('scheduled', 'confirmed', 'pre_check') then
    raise exception 'APPOINTMENT_NOT_CHECK_IN_ELIGIBLE'
      using errcode = '22023';
  end if;

  if v_custom_answers <> '{}'::jsonb then
    if exists (
      select 1
      from jsonb_object_keys(v_custom_answers) as answer_key(key)
      where answer_key.key !~ '^custom\.[a-z0-9_]{2,60}$'
        or not exists (
          select 1
          from public.patient_form_field_config as c
          where c.form_context = 'check_in'
            and c.field_kind = 'custom'
            and c.field_key = answer_key.key
            and c.is_visible = true
            and c.status = 'active'
            and (
              c.scope = 'tenant'
              or (c.scope = 'doctor' and c.doctor_id = v_doctor_id)
            )
        )
    ) then
      raise exception 'CUSTOM_ANSWER_NOT_ALLOWED'
        using errcode = '42501';
    end if;
  end if;

  if nullif(trim(coalesce(p_blood_pressure, '')), '') is null then
    raise exception 'BLOOD_PRESSURE_REQUIRED'
      using errcode = '22023';
  end if;
  if p_heart_rate is null or p_heart_rate not between 1 and 300 then
    raise exception 'HEART_RATE_REQUIRED'
      using errcode = '22023';
  end if;
  if p_temperature is null or p_temperature not between 20 and 50 then
    raise exception 'TEMPERATURE_REQUIRED'
      using errcode = '22023';
  end if;
  if p_respiratory_rate is not null and p_respiratory_rate not between 1 and 80 then
    raise exception 'RESPIRATORY_RATE_INVALID'
      using errcode = '22023';
  end if;
  if p_weight is not null and p_weight not between 1 and 1000 then
    raise exception 'WEIGHT_INVALID'
      using errcode = '22023';
  end if;
  if p_height is not null and p_height not between 1 and 300 then
    raise exception 'HEIGHT_INVALID'
      using errcode = '22023';
  end if;

  select id, status
    into v_existing_id, v_existing_status
  from public.precheck_forms
  where appointment_id = p_appointment_id
    and patient_id = v_patient_id
    and predoctor_id is null
  order by created_at desc
  limit 1;

  if v_existing_id is not null and v_existing_status in ('reviewed', 'completed') then
    raise exception 'CHECK_IN_ALREADY_REVIEWED'
      using errcode = '22023';
  end if;

  if v_existing_id is null then
    insert into public.precheck_forms (
      patient_id,
      appointment_id,
      blood_pressure,
      heart_rate,
      temperature,
      respiratory_rate,
      weight,
      height,
      current_medications,
      allergies,
      symptoms,
      is_urgent,
      status,
      submitted_at,
      field_config_version,
      custom_answers
    )
    values (
      v_patient_id,
      p_appointment_id,
      left(trim(p_blood_pressure), 20),
      p_heart_rate,
      p_temperature,
      p_respiratory_rate,
      p_weight,
      p_height,
      nullif(trim(coalesce(p_current_medications, '')), ''),
      nullif(trim(coalesce(p_allergies, '')), ''),
      nullif(trim(coalesce(p_symptoms, '')), ''),
      coalesce(p_is_urgent, false),
      'submitted',
      now(),
      coalesce(p_field_config_version, 1),
      v_custom_answers
    )
    returning * into v_precheck;
  else
    update public.precheck_forms
      set blood_pressure = left(trim(p_blood_pressure), 20),
          heart_rate = p_heart_rate,
          temperature = p_temperature,
          respiratory_rate = p_respiratory_rate,
          weight = p_weight,
          height = p_height,
          current_medications = nullif(trim(coalesce(p_current_medications, '')), ''),
          allergies = nullif(trim(coalesce(p_allergies, '')), ''),
          symptoms = nullif(trim(coalesce(p_symptoms, '')), ''),
          is_urgent = coalesce(p_is_urgent, false),
          status = 'submitted',
          submitted_at = now(),
          field_config_version = coalesce(p_field_config_version, 1),
          custom_answers = v_custom_answers,
          updated_at = now()
    where id = v_existing_id
    returning * into v_precheck;
  end if;

  if v_appointment_status in ('scheduled', 'confirmed') then
    update public.appointments
      set status = 'pre_check',
          updated_at = now()
    where id = p_appointment_id;
    v_appointment_status := 'pre_check';
  end if;

  return jsonb_build_object(
    'id', v_precheck.id,
    'appointmentId', p_appointment_id,
    'patientId', v_patient_id,
    'status', v_precheck.status,
    'appointmentStatus', v_appointment_status,
    'submittedAt', v_precheck.submitted_at,
    'fieldConfigVersion', v_precheck.field_config_version
  );
end;
$$;

grant execute on function public.submit_patient_check_in(
  uuid,
  integer,
  text,
  integer,
  numeric,
  integer,
  numeric,
  numeric,
  text,
  text,
  text,
  boolean,
  jsonb
) to authenticated;

comment on function public.submit_patient_check_in(
  uuid,
  integer,
  text,
  integer,
  numeric,
  integer,
  numeric,
  numeric,
  text,
  text,
  text,
  boolean,
  jsonb
) is 'Patient-safe self check-in submission for owned active appointments. Writes only allowlisted precheck fields and approved custom.* answers.';
