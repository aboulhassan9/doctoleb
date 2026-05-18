-- Patient billing, checkout, and generalized patient form contracts
--
-- This extends the patient-web foundation without exposing direct financial
-- mutations to browser code:
--   - patients can read their own billing overview through RPCs;
--   - checkout is initiated by a JWT-protected Edge Function;
--   - Stripe/webhook updates are idempotent and service-role only;
--   - profile, booking, and billing-contact forms can reuse the same
--     allowlisted patient_form_field_config table.

do $$
begin
  alter table public.patient_form_field_config
    drop constraint if exists patient_form_field_config_form_context_check;
  alter table public.patient_form_field_config
    add constraint patient_form_field_config_form_context_check
    check (form_context = any (array[
      'patient_onboarding',
      'profile',
      'appointment_booking',
      'billing_contact'
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
      'payment'
    ]));

  alter table public.patient_form_field_config
    drop constraint if exists patient_form_field_config_field_type_check;
  alter table public.patient_form_field_config
    add constraint patient_form_field_config_field_type_check
    check (field_type = any (array[
      'text',
      'textarea',
      'select',
      'date',
      'tel',
      'email',
      'number'
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
          'receipt_delivery'
        ])
      )
      or (
        field_kind = 'custom'
        and field_key ~ '^custom\.[a-z0-9_]{2,60}$'
        and label is not null
        and field_type = any (array['text', 'textarea', 'select'])
      )
    );
end $$;

create table if not exists public.appointment_patient_answers (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  form_context text not null default 'appointment_booking'
    check (form_context = 'appointment_booking'),
  field_config_version integer not null default 1
    check (field_config_version between 1 and 1000),
  custom_answers jsonb not null default '{}'::jsonb
    check (jsonb_typeof(custom_answers) = 'object'),
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (appointment_id)
);

create index if not exists appointment_patient_answers_patient_idx
  on public.appointment_patient_answers (patient_id, created_at desc);

drop trigger if exists appointment_patient_answers_set_updated_at on public.appointment_patient_answers;
create trigger appointment_patient_answers_set_updated_at
  before update on public.appointment_patient_answers
  for each row execute function public.set_updated_at();

alter table public.appointment_patient_answers enable row level security;

drop policy if exists appointment_patient_answers_select on public.appointment_patient_answers;
create policy appointment_patient_answers_select
  on public.appointment_patient_answers
  for select
  to authenticated
  using (
    public.is_staff()
    or patient_id in (
      select p.id
      from public.patients as p
      where p.user_id = public.current_domain_user_id()
    )
  );

grant select on public.appointment_patient_answers to authenticated;
grant all on public.appointment_patient_answers to service_role;

create table if not exists public.patient_payment_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  provider text not null default 'stripe'
    check (provider = 'stripe'),
  provider_session_id text not null unique,
  provider_payment_intent_id text,
  amount numeric(10,2) not null check (amount > 0),
  currency varchar(10) not null default 'USD',
  checkout_url text not null,
  status text not null default 'created'
    check (status = any (array['created', 'completed', 'expired', 'failed'])),
  created_by uuid references public.users(id),
  expires_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists patient_payment_checkout_sessions_patient_idx
  on public.patient_payment_checkout_sessions (patient_id, created_at desc);

create index if not exists patient_payment_checkout_sessions_payment_open_idx
  on public.patient_payment_checkout_sessions (payment_id, status, created_at desc)
  where status = 'created';

drop trigger if exists patient_payment_checkout_sessions_set_updated_at on public.patient_payment_checkout_sessions;
create trigger patient_payment_checkout_sessions_set_updated_at
  before update on public.patient_payment_checkout_sessions
  for each row execute function public.set_updated_at();

alter table public.patient_payment_checkout_sessions enable row level security;

drop policy if exists patient_payment_checkout_sessions_select on public.patient_payment_checkout_sessions;
create policy patient_payment_checkout_sessions_select
  on public.patient_payment_checkout_sessions
  for select
  to authenticated
  using (
    public.is_staff()
    or patient_id in (
      select p.id
      from public.patients as p
      where p.user_id = public.current_domain_user_id()
    )
  );

grant select on public.patient_payment_checkout_sessions to authenticated;
grant all on public.patient_payment_checkout_sessions to service_role;

create table if not exists public.patient_payment_gateway_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'stripe'
    check (provider = 'stripe'),
  provider_event_id text not null unique,
  event_type text not null,
  provider_session_id text,
  provider_payment_intent_id text,
  payment_id uuid references public.payments(id) on delete set null,
  checkout_session_id uuid references public.patient_payment_checkout_sessions(id) on delete set null,
  event_status text not null default 'received'
    check (event_status = any (array['received', 'processed', 'ignored', 'failed'])),
  payload_hash text,
  error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists patient_payment_gateway_events_session_idx
  on public.patient_payment_gateway_events (provider_session_id, created_at desc);

alter table public.patient_payment_gateway_events enable row level security;
grant all on public.patient_payment_gateway_events to service_role;

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
  if p_form_context not in ('patient_onboarding', 'profile', 'appointment_booking', 'billing_contact') then
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

create or replace function public.submit_patient_appointment_answers(
  p_appointment_id uuid,
  p_field_config_version integer default 1,
  p_custom_answers jsonb default '{}'::jsonb
)
returns public.appointment_patient_answers
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_domain_user_id uuid;
  v_patient_id uuid;
  v_doctor_id uuid;
  v_custom_answers jsonb;
  v_row public.appointment_patient_answers;
begin
  v_domain_user_id := public.current_domain_user_id();
  if v_domain_user_id is null then
    raise exception 'AUTH_REQUIRED'
      using errcode = '42501';
  end if;

  select a.patient_id, a.doctor_id
    into v_patient_id, v_doctor_id
  from public.appointments as a
  join public.patients as p on p.id = a.patient_id
  where a.id = p_appointment_id
    and p.user_id = v_domain_user_id
    and coalesce(p.is_archived, false) = false;

  if v_patient_id is null then
    raise exception 'APPOINTMENT_NOT_FOUND_OR_FORBIDDEN'
      using errcode = '42501';
  end if;

  v_custom_answers := coalesce(p_custom_answers, '{}'::jsonb);

  if jsonb_typeof(v_custom_answers) <> 'object' then
    raise exception 'INVALID_CUSTOM_ANSWERS'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_each(v_custom_answers) as answer(field_key, field_value)
    where (
        answer.field_key !~ '^custom\.[a-z0-9_]{2,60}$'
        and answer.field_key not in (
          'visit_priority',
          'visit_modality',
          'preferred_contact_method'
        )
      )
      or jsonb_typeof(answer.field_value) not in ('string', 'null')
      or char_length(coalesce(answer.field_value #>> '{}', '')) > 4000
  ) then
    raise exception 'INVALID_CUSTOM_ANSWERS'
      using errcode = '22023';
  end if;

  if exists (
    with active_config as (
      select
        c.*,
        case c.scope when 'doctor' then 2 else 1 end as scope_rank
      from public.patient_form_field_config as c
      where c.form_context = 'appointment_booking'
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
    where (
        answer.field_key ~ '^custom\.[a-z0-9_]{2,60}$'
        and (
          config.id is null
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
        )
      )
      or (
        answer.field_key = 'visit_priority'
        and jsonb_typeof(answer.field_value) = 'string'
        and coalesce(answer.field_value #>> '{}', '') <> ''
        and answer.field_value #>> '{}' not in ('routine', 'soon', 'urgent')
      )
      or (
        answer.field_key = 'visit_modality'
        and jsonb_typeof(answer.field_value) = 'string'
        and coalesce(answer.field_value #>> '{}', '') <> ''
        and answer.field_value #>> '{}' not in ('in_person', 'telehealth', 'clinic_decides')
      )
      or (
        answer.field_key = 'preferred_contact_method'
        and jsonb_typeof(answer.field_value) = 'string'
        and coalesce(answer.field_value #>> '{}', '') <> ''
        and answer.field_value #>> '{}' not in ('portal', 'phone', 'email')
      )
  ) then
    raise exception 'CUSTOM_FIELD_NOT_ALLOWED'
      using errcode = '42501';
  end if;

  insert into public.appointment_patient_answers (
    appointment_id,
    patient_id,
    field_config_version,
    custom_answers,
    created_by
  )
  values (
    p_appointment_id,
    v_patient_id,
    greatest(1, least(1000, coalesce(p_field_config_version, 1))),
    jsonb_strip_nulls(v_custom_answers),
    v_domain_user_id
  )
  on conflict (appointment_id) do update
    set field_config_version = excluded.field_config_version,
        custom_answers = excluded.custom_answers,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.get_patient_billing_overview()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_domain_user_id uuid;
  v_patient_id uuid;
  v_payments jsonb;
  v_pending_total numeric(10,2);
  v_paid_total numeric(10,2);
  v_refunded_total numeric(10,2);
  v_currency text;
begin
  v_domain_user_id := public.current_domain_user_id();
  if v_domain_user_id is null then
    raise exception 'AUTH_REQUIRED'
      using errcode = '42501';
  end if;

  select p.id
    into v_patient_id
  from public.patients as p
  where p.user_id = v_domain_user_id
    and coalesce(p.is_archived, false) = false
  limit 1;

  if v_patient_id is null then
    raise exception 'PATIENT_NOT_FOUND'
      using errcode = '42501';
  end if;

  select
    coalesce(sum(amount) filter (where status = 'pending'), 0),
    coalesce(sum(amount) filter (where status = 'completed'), 0),
    coalesce(sum(amount) filter (where status = 'refunded'), 0),
    coalesce((array_agg(currency order by created_at desc))[1], 'USD')
  into v_pending_total, v_paid_total, v_refunded_total, v_currency
  from public.payments
  where patient_id = v_patient_id;

  select coalesce(jsonb_agg(payment_row order by created_at desc), '[]'::jsonb)
    into v_payments
  from (
    select jsonb_build_object(
      'id', pay.id,
      'amount', pay.amount,
      'currency', coalesce(pay.currency, 'USD'),
      'status', pay.status,
      'paymentMethod', pay.payment_method,
      'transactionId', pay.transaction_id,
      'createdAt', pay.created_at,
      'updatedAt', pay.updated_at,
      'canPay', pay.status = 'pending' and pay.amount > 0,
      'appointment', case
        when a.id is null then null
        else jsonb_build_object(
          'id', a.id,
          'scheduledAt', a.scheduled_at,
          'visitType', vt.name
        )
      end,
      'doctor', case
        when d.id is null then null
        else jsonb_build_object(
          'id', d.id,
          'name', trim(coalesce(du.first_name, '') || ' ' || coalesce(du.last_name, ''))
        )
      end,
      'checkoutSession', (
        select jsonb_build_object(
          'id', s.id,
          'providerSessionId', s.provider_session_id,
          'status', s.status,
          'expiresAt', s.expires_at,
          'createdAt', s.created_at
        )
        from public.patient_payment_checkout_sessions as s
        where s.payment_id = pay.id
        order by s.created_at desc
        limit 1
      )
    ) as payment_row,
    pay.created_at
    from public.payments as pay
    left join public.appointments as a on a.id = pay.appointment_id
    left join public.visit_types as vt on vt.id = a.visit_type_id
    left join public.doctors as d on d.id = pay.doctor_id
    left join public.users as du on du.id = d.user_id
    where pay.patient_id = v_patient_id
    order by pay.created_at desc
    limit 50
  ) as rows;

  return jsonb_build_object(
    'patientId', v_patient_id,
    'currency', v_currency,
    'summary', jsonb_build_object(
      'pendingTotal', v_pending_total,
      'paidTotal', v_paid_total,
      'refundedTotal', v_refunded_total,
      'hasBalanceDue', v_pending_total > 0
    ),
    'payments', v_payments
  );
end;
$$;

create or replace function public.get_patient_payment_receipt(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_domain_user_id uuid;
  v_receipt jsonb;
begin
  v_domain_user_id := public.current_domain_user_id();
  if v_domain_user_id is null then
    raise exception 'AUTH_REQUIRED'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', pay.id,
    'amount', pay.amount,
    'currency', coalesce(pay.currency, 'USD'),
    'status', pay.status,
    'paymentMethod', pay.payment_method,
    'transactionId', pay.transaction_id,
    'createdAt', pay.created_at,
    'updatedAt', pay.updated_at,
    'appointment', case
      when a.id is null then null
      else jsonb_build_object(
        'id', a.id,
        'scheduledAt', a.scheduled_at,
        'visitType', vt.name
      )
    end
  )
    into v_receipt
  from public.payments as pay
  join public.patients as p on p.id = pay.patient_id
  left join public.appointments as a on a.id = pay.appointment_id
  left join public.visit_types as vt on vt.id = a.visit_type_id
  where pay.id = p_payment_id
    and p.user_id = v_domain_user_id
    and coalesce(p.is_archived, false) = false;

  if v_receipt is null then
    raise exception 'PAYMENT_NOT_FOUND_OR_FORBIDDEN'
      using errcode = '42501';
  end if;

  return v_receipt;
end;
$$;

create or replace function public.create_patient_payment_checkout_context(
  p_actor_auth_user_id uuid,
  p_payment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_domain_user_id uuid;
  v_context jsonb;
begin
  if p_actor_auth_user_id is null or p_payment_id is null then
    raise exception 'INVALID_REQUEST'
      using errcode = '22023';
  end if;

  select u.id
    into v_domain_user_id
  from public.users as u
  where u.auth_user_id = p_actor_auth_user_id
    and u.role = 'patient'
    and coalesce(u.is_active, true) = true
  limit 1;

  if v_domain_user_id is null then
    raise exception 'PATIENT_CONTEXT_NOT_FOUND'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'paymentId', pay.id,
    'patientId', p.id,
    'amount', pay.amount,
    'currency', lower(coalesce(pay.currency, 'USD')),
    'status', pay.status
  )
    into v_context
  from public.payments as pay
  join public.patients as p on p.id = pay.patient_id
  where pay.id = p_payment_id
    and p.user_id = v_domain_user_id
    and coalesce(p.is_archived, false) = false;

  if v_context is null then
    raise exception 'PAYMENT_NOT_FOUND_OR_FORBIDDEN'
      using errcode = '42501';
  end if;

  if v_context ->> 'status' <> 'pending' then
    raise exception 'PAYMENT_NOT_PAYABLE'
      using errcode = '22023';
  end if;

  return v_context;
end;
$$;

create or replace function public.record_patient_payment_checkout_session(
  p_actor_auth_user_id uuid,
  p_payment_id uuid,
  p_provider_session_id text,
  p_checkout_url text,
  p_expires_at timestamptz default null
)
returns public.patient_payment_checkout_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_domain_user_id uuid;
  v_payment public.payments;
  v_patient_id uuid;
  v_row public.patient_payment_checkout_sessions;
begin
  if p_actor_auth_user_id is null
     or p_payment_id is null
     or nullif(trim(coalesce(p_provider_session_id, '')), '') is null
     or nullif(trim(coalesce(p_checkout_url, '')), '') is null then
    raise exception 'INVALID_REQUEST'
      using errcode = '22023';
  end if;

  select u.id
    into v_domain_user_id
  from public.users as u
  where u.auth_user_id = p_actor_auth_user_id
    and u.role = 'patient'
    and coalesce(u.is_active, true) = true
  limit 1;

  if v_domain_user_id is null then
    raise exception 'PATIENT_CONTEXT_NOT_FOUND'
      using errcode = '42501';
  end if;

  select pay.*
    into v_payment
  from public.payments as pay
  join public.patients as p on p.id = pay.patient_id
  where pay.id = p_payment_id
    and p.user_id = v_domain_user_id
    and coalesce(p.is_archived, false) = false;

  if v_payment.id is null then
    raise exception 'PAYMENT_NOT_FOUND_OR_FORBIDDEN'
      using errcode = '42501';
  end if;

  if v_payment.status <> 'pending' then
    raise exception 'PAYMENT_NOT_PAYABLE'
      using errcode = '22023';
  end if;

  v_patient_id := v_payment.patient_id;

  insert into public.patient_payment_checkout_sessions (
    payment_id,
    patient_id,
    provider_session_id,
    amount,
    currency,
    checkout_url,
    status,
    created_by,
    expires_at
  )
  values (
    p_payment_id,
    v_patient_id,
    trim(p_provider_session_id),
    v_payment.amount,
    coalesce(v_payment.currency, 'USD'),
    trim(p_checkout_url),
    'created',
    v_domain_user_id,
    p_expires_at
  )
  on conflict (provider_session_id) do update
    set checkout_url = excluded.checkout_url,
        expires_at = excluded.expires_at,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.apply_patient_payment_gateway_event(
  p_provider_event_id text,
  p_event_type text,
  p_provider_session_id text default null,
  p_provider_payment_intent_id text default null,
  p_payment_status text default null,
  p_payload_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.patient_payment_checkout_sessions;
  v_event_id uuid;
  v_status text := 'ignored';
  v_payment_status text := coalesce(p_payment_status, '');
begin
  if nullif(trim(coalesce(p_provider_event_id, '')), '') is null
     or nullif(trim(coalesce(p_event_type, '')), '') is null then
    raise exception 'INVALID_GATEWAY_EVENT'
      using errcode = '22023';
  end if;

  select *
    into v_session
  from public.patient_payment_checkout_sessions
  where provider_session_id = p_provider_session_id
  limit 1;

  insert into public.patient_payment_gateway_events (
    provider_event_id,
    event_type,
    provider_session_id,
    provider_payment_intent_id,
    payment_id,
    checkout_session_id,
    event_status,
    payload_hash
  )
  values (
    trim(p_provider_event_id),
    trim(p_event_type),
    nullif(trim(coalesce(p_provider_session_id, '')), ''),
    nullif(trim(coalesce(p_provider_payment_intent_id, '')), ''),
    v_session.payment_id,
    v_session.id,
    'received',
    nullif(trim(coalesce(p_payload_hash, '')), '')
  )
  on conflict (provider_event_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return jsonb_build_object('status', 'duplicate');
  end if;

  if v_session.id is not null
     and p_event_type = 'checkout.session.completed'
     and v_payment_status in ('paid', 'complete') then
    update public.payments
      set status = 'completed',
          payment_method = coalesce(nullif(payment_method, ''), 'card'),
          transaction_id = coalesce(
            nullif(trim(coalesce(p_provider_payment_intent_id, '')), ''),
            nullif(trim(coalesce(p_provider_session_id, '')), ''),
            transaction_id
          ),
          updated_at = now()
    where id = v_session.payment_id
      and status = 'pending';

    update public.patient_payment_checkout_sessions
      set status = 'completed',
          provider_payment_intent_id = nullif(trim(coalesce(p_provider_payment_intent_id, '')), ''),
          completed_at = now(),
          updated_at = now()
    where id = v_session.id;

    v_status := 'processed';
  elsif v_session.id is not null
        and p_event_type in ('checkout.session.expired', 'checkout.session.async_payment_failed') then
    update public.patient_payment_checkout_sessions
      set status = case when p_event_type = 'checkout.session.expired' then 'expired' else 'failed' end,
          failed_at = now(),
          updated_at = now()
    where id = v_session.id
      and status = 'created';

    if p_event_type = 'checkout.session.async_payment_failed' then
      update public.payments
        set status = 'failed',
            updated_at = now()
      where id = v_session.payment_id
        and status = 'pending';
    end if;

    v_status := 'processed';
  end if;

  update public.patient_payment_gateway_events
    set event_status = v_status,
        processed_at = now()
  where id = v_event_id;

  return jsonb_build_object(
    'status', v_status,
    'paymentId', v_session.payment_id,
    'checkoutSessionId', v_session.id
  );
end;
$$;

revoke all on function public.get_patient_form_definition(text, uuid, uuid, uuid) from public, anon;
grant execute on function public.get_patient_form_definition(text, uuid, uuid, uuid) to authenticated, service_role;

revoke all on function public.submit_patient_appointment_answers(uuid, integer, jsonb) from public, anon;
grant execute on function public.submit_patient_appointment_answers(uuid, integer, jsonb) to authenticated, service_role;

revoke all on function public.get_patient_billing_overview() from public, anon;
grant execute on function public.get_patient_billing_overview() to authenticated, service_role;

revoke all on function public.get_patient_payment_receipt(uuid) from public, anon;
grant execute on function public.get_patient_payment_receipt(uuid) to authenticated, service_role;

revoke all on function public.create_patient_payment_checkout_context(uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_patient_payment_checkout_context(uuid, uuid) to service_role;

revoke all on function public.record_patient_payment_checkout_session(uuid, uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.record_patient_payment_checkout_session(uuid, uuid, text, text, timestamptz) to service_role;

revoke all on function public.apply_patient_payment_gateway_event(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.apply_patient_payment_gateway_event(text, text, text, text, text, text) to service_role;

comment on table public.appointment_patient_answers
  is 'Patient-entered custom booking answers for allowlisted appointment_booking fields. Writes only through submit_patient_appointment_answers.';

comment on table public.patient_payment_checkout_sessions
  is 'Hosted checkout sessions created for patient-owned pending payment rows. No card data is stored.';

comment on table public.patient_payment_gateway_events
  is 'Idempotent gateway event ledger for patient payment webhooks. Stores identifiers and hashes only, not raw gateway payloads.';

comment on function public.get_patient_billing_overview()
  is 'Returns the authenticated patient billing summary and safe receipt rows for the patient portal.';

comment on function public.apply_patient_payment_gateway_event(text, text, text, text, text, text)
  is 'Service-role only idempotent payment gateway event applier for hosted patient checkout.';
