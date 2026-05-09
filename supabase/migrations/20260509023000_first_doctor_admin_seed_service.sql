-- First doctor/admin seed service for SaaS tenant provisioning.
-- This is service-role-only and creates no clinical records.

alter table public.doctors
  add column if not exists provisioning_client_request_id uuid;

create unique index if not exists idx_doctors_provisioning_client_request_id_unique
  on public.doctors (provisioning_client_request_id)
  where provisioning_client_request_id is not null;

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
    when v_requested_role in ('doctor', 'secretary', 'predoctor') then v_requested_role
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
    nullif(trim(regexp_replace(coalesce(v_full_name, ''), '^[^ ]+\s*', '')), ''),
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
    set auth_user_id = coalesce(public.users.auth_user_id, excluded.auth_user_id),
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

create or replace function public.service_seed_first_doctor_admin(
  p_invited_auth_user_id uuid,
  p_email text,
  p_display_name text,
  p_phone text default null,
  p_client_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_display_name text := trim(coalesce(p_display_name, ''));
  v_phone text := nullif(left(trim(coalesce(p_phone, '')), 40), '');
  v_name_parts text[];
  v_user_role text;
  v_user_id uuid;
  v_doctor_id uuid;
  v_profile_id uuid;
begin
  if p_invited_auth_user_id is null
     or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or char_length(v_email) > 320
     or v_display_name = ''
     or char_length(v_display_name) > 160 then
    return jsonb_build_object('data', null, 'error', 'INVALID_REQUEST');
  end if;

  if p_client_request_id is not null then
    select d.user_id, d.id
      into v_user_id, v_doctor_id
    from public.doctors as d
    where d.provisioning_client_request_id = p_client_request_id;

    if v_doctor_id is not null then
      return jsonb_build_object(
        'data', jsonb_build_object(
          'domainUserId', v_user_id,
          'doctorId', v_doctor_id,
          'created', false,
          'firstDoctorAdminInviteCreated', true
        ),
        'error', null
      );
    end if;
  end if;

  v_name_parts := regexp_split_to_array(v_display_name, '\s+');

  insert into public.users (
    auth_user_id,
    email,
    role,
    first_name,
    last_name,
    phone,
    initials,
    is_active
  )
  values (
    p_invited_auth_user_id,
    v_email,
    'doctor',
    v_name_parts[1],
    nullif(array_to_string(v_name_parts[2:array_length(v_name_parts, 1)], ' '), ''),
    v_phone,
    upper(left(v_name_parts[1], 1) || left(coalesce(v_name_parts[2], ''), 1)),
    true
  )
  on conflict (email) do update
    set auth_user_id = coalesce(public.users.auth_user_id, excluded.auth_user_id),
        role = case
          when public.users.role = 'doctor'
               and (public.users.auth_user_id is null or public.users.auth_user_id = excluded.auth_user_id)
            then 'doctor'
          else public.users.role
        end,
        first_name = coalesce(public.users.first_name, excluded.first_name),
        last_name = coalesce(public.users.last_name, excluded.last_name),
        phone = coalesce(excluded.phone, public.users.phone),
        initials = coalesce(public.users.initials, excluded.initials),
        is_active = true,
        updated_at = now()
    where public.users.role = 'doctor'
      and (public.users.auth_user_id is null or public.users.auth_user_id = excluded.auth_user_id)
  returning id, role
  into v_user_id, v_user_role;

  if v_user_id is null or v_user_role <> 'doctor' then
    return jsonb_build_object('data', null, 'error', 'USER_EMAIL_ALREADY_LINKED');
  end if;

  insert into public.doctors (
    user_id,
    provisioning_client_request_id
  )
  values (
    v_user_id,
    p_client_request_id
  )
  on conflict (user_id) do update
    set provisioning_client_request_id = coalesce(public.doctors.provisioning_client_request_id, excluded.provisioning_client_request_id),
        updated_at = now()
  returning id into v_doctor_id;

  update public.tenant_profile
  set doctor_id = coalesce(doctor_id, v_doctor_id),
      updated_at = now()
  where doctor_id is null
     or doctor_id = v_doctor_id
  returning id into v_profile_id;

  if v_profile_id is null then
    return jsonb_build_object('data', null, 'error', 'TENANT_PROFILE_REQUIRED');
  end if;

  insert into public.audit_log (table_name, record_id, action, actor_user_id, after_data)
  values (
    'doctors',
    v_doctor_id,
    'INSERT',
    v_user_id,
    jsonb_build_object(
      'event_type', 'first_doctor_admin_seeded',
      'doctor_id', v_doctor_id,
      'tenant_profile_id', v_profile_id,
      'phi', false
    )
  );

  return jsonb_build_object(
    'data', jsonb_build_object(
      'domainUserId', v_user_id,
      'doctorId', v_doctor_id,
      'tenantProfileId', v_profile_id,
      'created', true,
      'firstDoctorAdminInviteCreated', true
    ),
    'error', null
  );
end;
$$;

revoke all on function public.service_seed_first_doctor_admin(uuid, text, text, text, uuid) from public;
revoke execute on function public.service_seed_first_doctor_admin(uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.service_seed_first_doctor_admin(uuid, text, text, text, uuid) to service_role;

comment on function public.service_seed_first_doctor_admin(uuid, text, text, text, uuid) is
  'Service-role-only seed path for first doctor/admin provisioning. Creates Auth-linked domain user and doctor records, then links tenant_profile without PHI.';
