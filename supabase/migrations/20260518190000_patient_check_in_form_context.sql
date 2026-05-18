-- Patient check-in form configuration context
--
-- Keeps predoctor/check-in requirements configurable through the same
-- zero-PHI allowlisted registry used by onboarding, profile, booking, and
-- billing contact forms.

alter table public.patient_form_field_config
  drop constraint if exists patient_form_field_config_form_context_check;

alter table public.patient_form_field_config
  add constraint patient_form_field_config_form_context_check
  check (form_context = any (array[
    'patient_onboarding',
    'profile',
    'appointment_booking',
    'billing_contact',
    'check_in'
  ]));

alter table public.patient_form_field_config
  drop constraint if exists patient_form_field_config_section_check;

alter table public.patient_form_field_config
  add constraint patient_form_field_config_section_check
  check (section = any (array[
    'identity',
    'safety',
    'support',
    'booking',
    'visit',
    'coverage',
    'billing',
    'payment',
    'vitals',
    'symptoms'
  ]));

alter table public.patient_form_field_config
  drop constraint if exists patient_form_field_config_field_key_check;

alter table public.patient_form_field_config
  add constraint patient_form_field_config_field_key_check
  check (
    (
      field_kind = 'base'
      and field_key = any (array[
        'first_name',
        'last_name',
        'phone',
        'email',
        'date_of_birth',
        'sex',
        'blood_type',
        'allergies',
        'current_medications',
        'medical_history',
        'emergency_contact',
        'emergency_phone',
        'insurance_id',
        'visit_reason',
        'visit_priority',
        'visit_modality',
        'preferred_contact_method',
        'billing_email',
        'billing_phone',
        'receipt_delivery',
        'blood_pressure',
        'heart_rate',
        'temperature',
        'respiratory_rate',
        'weight',
        'height',
        'symptoms'
      ])
    )
    or (
      field_kind = 'custom'
      and field_key ~ '^custom\.[a-z0-9_]{2,60}$'
      and label is not null
      and field_type = any (array['text', 'textarea', 'select'])
    )
  );

create or replace function public.get_patient_form_definition(
  p_form_context text,
  p_patient_id uuid default null,
  p_doctor_id uuid default null,
  p_visit_type_id uuid default null
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
  if p_form_context not in ('patient_onboarding', 'profile', 'appointment_booking', 'billing_contact', 'check_in') then
    raise exception 'UNSUPPORTED_PATIENT_FORM_CONTEXT'
      using errcode = '22023';
  end if;

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
    where c.form_context = p_form_context
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
    'formContext', p_form_context,
    'doctorId', v_doctor_id,
    'visitTypeId', p_visit_type_id,
    'fieldOverrides', v_field_overrides,
    'customFields', v_custom_fields
  );
end;
$$;

revoke all on function public.get_patient_form_definition(text, uuid, uuid, uuid) from public, anon;
grant execute on function public.get_patient_form_definition(text, uuid, uuid, uuid) to authenticated, service_role;

comment on function public.get_patient_form_definition(text, uuid, uuid, uuid)
  is 'Returns zero-PHI active patient form overrides/custom fields for onboarding, profile, booking, billing contact, and check-in contexts.';
