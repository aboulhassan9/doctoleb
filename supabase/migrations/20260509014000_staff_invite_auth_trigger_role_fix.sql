-- Staff invite Auth trigger role fix.
--
-- Production rule:
--   Supabase Auth identity creation must not automatically create a patient
--   domain extension for staff invites. Staff invite metadata carries the
--   requested staff role; patient signup keeps the existing patient behavior.
--
-- Reversibility:
--   The staff invite RPC can convert only an empty accidental patient extension
--   left by the previous trigger behavior. If clinical dependencies exist, the
--   conversion fails closed instead of deleting patient history.

create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_first_name text;
  v_last_name text;
  v_full_name text;
  v_initials text;
  v_requested_role text;
  v_role text;
begin
  v_requested_role := nullif(trim(coalesce(new.raw_user_meta_data ->> 'role', '')), '');
  v_role := case
    when v_requested_role in ('secretary', 'predoctor') then v_requested_role
    else 'patient'
  end;

  v_full_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  v_first_name := coalesce(
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'first_name', '')), ''),
    nullif(split_part(coalesce(v_full_name, ''), ' ', 1), ''),
    split_part(new.email, '@', 1)
  );
  v_last_name := coalesce(
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'last_name', '')), ''),
    nullif(trim(regexp_replace(coalesce(v_full_name, ''), '^[^ ]+\\s*', '')), ''),
    ''
  );
  v_initials := upper(left(coalesce(v_first_name, ''), 1) || left(coalesce(v_last_name, ''), 1));

  insert into public.users (
    auth_user_id,
    email,
    first_name,
    last_name,
    role,
    initials,
    is_active
  )
  values (
    new.id,
    lower(new.email),
    nullif(v_first_name, ''),
    nullif(v_last_name, ''),
    v_role,
    nullif(v_initials, ''),
    true
  )
  on conflict (email) do update
    set auth_user_id = excluded.auth_user_id,
        first_name = coalesce(public.users.first_name, excluded.first_name),
        last_name = coalesce(public.users.last_name, excluded.last_name),
        initials = coalesce(public.users.initials, excluded.initials),
        role = case
          when public.users.role = 'patient'
               and excluded.role in ('secretary', 'predoctor')
               and (public.users.auth_user_id is null or public.users.auth_user_id = excluded.auth_user_id)
            then excluded.role
          else public.users.role
        end,
        is_active = true,
        updated_at = now()
  returning id into v_user_id;

  insert into public.patients (user_id)
  select v_user_id
  where v_role = 'patient'
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_auth_user_created();

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
  v_existing_user public.users%rowtype;
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

  select u.*
    into v_existing_user
  from public.users as u
  where lower(u.email::text) = v_email
  limit 1;

  v_name_parts := regexp_split_to_array(trim(p_display_name), '\s+');

  if v_existing_user.id is null then
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
    v_domain_user_id := v_existing_user.id;

    if v_existing_user.auth_user_id is not null and v_existing_user.auth_user_id <> p_invited_auth_user_id then
      raise exception 'USER_EMAIL_ALREADY_LINKED';
    end if;

    if v_existing_user.role = 'patient' then
      delete from public.patients
      where user_id = v_domain_user_id;
    elsif v_existing_user.role not in ('secretary', 'predoctor') then
      raise exception 'USER_EMAIL_ALREADY_LINKED';
    end if;

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
      and u.role in ('patient', 'secretary', 'predoctor');

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
