-- Staff invite lifecycle v1.
--
-- Production rule:
--   Staff onboarding must create/link Supabase Auth identity and tenant
--   domain identity through a server-side workflow. Browser code must not
--   directly insert staff onboarding rows.
--
-- Reversibility:
--   The forward path records a client request id and invite status. Failed
--   external Auth creation is compensated in the Edge Function by soft-deleting
--   the just-created Auth identity. Existing staff rows are returned
--   idempotently when the same request id or doctor/email pair is retried.

alter table public.staff_members
  add column if not exists invite_client_request_id uuid;

create unique index if not exists staff_members_invite_client_request_id_key
  on public.staff_members (invite_client_request_id)
  where invite_client_request_id is not null;

comment on column public.staff_members.invite_client_request_id is
  'Idempotency key for the server-side staff invite workflow.';

create or replace function public.create_staff_invite_domain_identity(
  p_actor_auth_user_id uuid,
  p_invited_auth_user_id uuid,
  p_email text,
  p_role text,
  p_display_name text,
  p_phone text default null,
  p_hire_date date default null,
  p_client_request_id uuid default null
)
returns table (
  id uuid,
  user_id uuid,
  doctor_id uuid,
  role text,
  display_name text,
  phone text,
  email text,
  invite_status text,
  hire_date date,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid;
  v_actor_role text;
  v_doctor_id uuid;
  v_email text := lower(trim(p_email));
  v_existing_staff public.staff_members%rowtype;
  v_domain_user_id uuid;
  v_name_parts text[];
begin
  if p_actor_auth_user_id is null or p_invited_auth_user_id is null then
    raise exception 'INVALID_REQUEST';
  end if;

  if v_email is null or v_email = '' or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_EMAIL';
  end if;

  if p_role not in ('secretary', 'predoctor') then
    raise exception 'UNSUPPORTED_STAFF_ROLE';
  end if;

  if trim(coalesce(p_display_name, '')) = '' then
    raise exception 'DISPLAY_NAME_REQUIRED';
  end if;

  select u.id, u.role
    into v_actor_user_id, v_actor_role
  from public.users as u
  where u.auth_user_id = p_actor_auth_user_id
    and u.is_active is distinct from false;

  if v_actor_user_id is null or v_actor_role <> 'doctor' then
    raise exception 'FORBIDDEN';
  end if;

  select d.id
    into v_doctor_id
  from public.doctors as d
  where d.user_id = v_actor_user_id
  limit 1;

  if v_doctor_id is null then
    raise exception 'DOCTOR_CONTEXT_NOT_FOUND';
  end if;

  if p_client_request_id is not null then
    select sm.*
      into v_existing_staff
    from public.staff_members as sm
    where sm.invite_client_request_id = p_client_request_id;

    if v_existing_staff.id is not null then
      return query
      select sm.id, sm.user_id, sm.doctor_id, sm.role, sm.display_name, sm.phone,
             sm.email, sm.invite_status, sm.hire_date, sm.is_active, sm.created_at, sm.updated_at
      from public.staff_members as sm
      where sm.id = v_existing_staff.id;
      return;
    end if;
  end if;

  select sm.*
    into v_existing_staff
  from public.staff_members as sm
  where sm.doctor_id = v_doctor_id
    and lower(sm.email) = v_email
  limit 1;

  if v_existing_staff.id is not null then
    if v_existing_staff.is_active = true
       and v_existing_staff.role = p_role
       and v_existing_staff.invite_status in ('invited', 'accepted') then
      return query
      select sm.id, sm.user_id, sm.doctor_id, sm.role, sm.display_name, sm.phone,
             sm.email, sm.invite_status, sm.hire_date, sm.is_active, sm.created_at, sm.updated_at
      from public.staff_members as sm
      where sm.id = v_existing_staff.id;
      return;
    end if;

    raise exception 'STAFF_EMAIL_ALREADY_EXISTS';
  end if;

  select u.id
    into v_domain_user_id
  from public.users as u
  where lower(u.email::text) = v_email
  limit 1;

  v_name_parts := regexp_split_to_array(trim(p_display_name), '\s+');

  if v_domain_user_id is null then
    insert into public.users (
      email,
      role,
      first_name,
      last_name,
      phone,
      initials,
      is_active,
      auth_user_id
    )
    values (
      v_email,
      p_role,
      v_name_parts[1],
      nullif(array_to_string(v_name_parts[2:array_length(v_name_parts, 1)], ' '), ''),
      nullif(trim(coalesce(p_phone, '')), ''),
      upper(left(v_name_parts[1], 1) || left(coalesce(v_name_parts[2], ''), 1)),
      true,
      p_invited_auth_user_id
    )
    returning public.users.id into v_domain_user_id;
  else
    update public.users as u
    set
      auth_user_id = coalesce(u.auth_user_id, p_invited_auth_user_id),
      role = p_role,
      first_name = coalesce(u.first_name, v_name_parts[1]),
      last_name = coalesce(u.last_name, nullif(array_to_string(v_name_parts[2:array_length(v_name_parts, 1)], ' '), '')),
      phone = coalesce(nullif(trim(coalesce(p_phone, '')), ''), u.phone),
      is_active = true,
      updated_at = now()
    where u.id = v_domain_user_id
      and (u.auth_user_id is null or u.auth_user_id = p_invited_auth_user_id)
      and u.role in ('secretary', 'predoctor');

    if not found then
      raise exception 'USER_EMAIL_ALREADY_LINKED';
    end if;
  end if;

  return query
  insert into public.staff_members (
    user_id,
    doctor_id,
    role,
    display_name,
    phone,
    email,
    invite_status,
    hire_date,
    is_active,
    invite_client_request_id
  )
  values (
    v_domain_user_id,
    v_doctor_id,
    p_role,
    trim(p_display_name),
    nullif(trim(coalesce(p_phone, '')), ''),
    v_email,
    'invited',
    p_hire_date,
    true,
    p_client_request_id
  )
  returning staff_members.id, staff_members.user_id, staff_members.doctor_id,
            staff_members.role, staff_members.display_name, staff_members.phone,
            staff_members.email, staff_members.invite_status, staff_members.hire_date,
            staff_members.is_active, staff_members.created_at, staff_members.updated_at;

  insert into public.audit_log (table_name, record_id, action, actor_user_id, after_data)
  select
    'staff_members',
    sm.id,
    'INSERT',
    v_actor_user_id,
    jsonb_build_object(
      'event_type', 'staff_invited',
      'staff_member_id', sm.id,
      'doctor_id', sm.doctor_id,
      'role', sm.role,
      'invite_status', sm.invite_status
    )
  from public.staff_members as sm
  where sm.invite_client_request_id = p_client_request_id
     or (sm.doctor_id = v_doctor_id and lower(sm.email) = v_email)
  order by sm.created_at desc
  limit 1;
end;
$$;

revoke all on function public.create_staff_invite_domain_identity(
  uuid, uuid, text, text, text, text, date, uuid
) from public, anon, authenticated;

grant execute on function public.create_staff_invite_domain_identity(
  uuid, uuid, text, text, text, text, date, uuid
) to service_role;
