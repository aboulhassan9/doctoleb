-- Service-role-only first doctor/admin contact update for SaaS tenant maintenance.
-- Keeps the tenant mutation inside the tenant DB boundary; the control plane calls RPCs only.

create or replace function public.service_get_first_doctor_admin_contact()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_auth_user_id uuid;
  v_doctor_id uuid;
  v_email text;
  v_display_name text;
  v_phone text;
begin
  select u.id,
         u.auth_user_id,
         d.id,
         lower(u.email),
         trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')),
         u.phone
    into v_user_id,
         v_auth_user_id,
         v_doctor_id,
         v_email,
         v_display_name,
         v_phone
  from public.tenant_profile as tp
  join public.doctors as d on d.id = tp.doctor_id
  join public.users as u on u.id = d.user_id
  where u.role = 'doctor'
    and u.is_active = true
    and u.auth_user_id is not null
  limit 1;

  if v_user_id is null then
    return jsonb_build_object('data', null, 'error', 'FIRST_DOCTOR_ADMIN_NOT_FOUND');
  end if;

  return jsonb_build_object(
    'data', jsonb_build_object(
      'domainUserId', v_user_id,
      'authUserId', v_auth_user_id,
      'doctorId', v_doctor_id,
      'email', v_email,
      'displayName', coalesce(nullif(v_display_name, ''), split_part(v_email, '@', 1)),
      'phone', v_phone
    ),
    'error', null
  );
end;
$$;

create or replace function public.service_update_first_doctor_admin_contact(
  p_auth_user_id uuid,
  p_email text,
  p_display_name text,
  p_phone text default null
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
  v_user_id uuid;
  v_doctor_id uuid;
  v_conflicting_user_id uuid;
begin
  if p_auth_user_id is null
     or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or char_length(v_email) > 320
     or v_display_name = ''
     or char_length(v_display_name) > 160 then
    return jsonb_build_object('data', null, 'error', 'INVALID_REQUEST');
  end if;

  select u.id, d.id
    into v_user_id, v_doctor_id
  from public.tenant_profile as tp
  join public.doctors as d on d.id = tp.doctor_id
  join public.users as u on u.id = d.user_id
  where u.auth_user_id = p_auth_user_id
    and u.role = 'doctor'
    and u.is_active = true
  limit 1;

  if v_user_id is null then
    return jsonb_build_object('data', null, 'error', 'FIRST_DOCTOR_ADMIN_NOT_FOUND');
  end if;

  select id
    into v_conflicting_user_id
  from public.users
  where email = v_email
    and id <> v_user_id
  limit 1;

  if v_conflicting_user_id is not null then
    return jsonb_build_object('data', null, 'error', 'FIRST_DOCTOR_EMAIL_TAKEN');
  end if;

  v_name_parts := regexp_split_to_array(v_display_name, '\s+');

  update public.users
  set email = v_email,
      first_name = v_name_parts[1],
      last_name = nullif(array_to_string(v_name_parts[2:array_length(v_name_parts, 1)], ' '), ''),
      phone = v_phone,
      initials = upper(left(v_name_parts[1], 1) || left(coalesce(v_name_parts[2], ''), 1)),
      updated_at = now()
  where id = v_user_id
    and role = 'doctor';

  insert into public.audit_log (table_name, record_id, action, actor_user_id, after_data)
  values (
    'users',
    v_user_id,
    'UPDATE',
    v_user_id,
    jsonb_build_object(
      'event_type', 'first_doctor_admin_contact_updated',
      'doctor_id', v_doctor_id,
      'phi', false
    )
  );

  return jsonb_build_object(
    'data', jsonb_build_object(
      'domainUserId', v_user_id,
      'doctorId', v_doctor_id,
      'email', v_email,
      'displayName', v_display_name,
      'phone', v_phone,
      'firstDoctorAdminUpdated', true
    ),
    'error', null
  );
end;
$$;

revoke all on function public.service_get_first_doctor_admin_contact() from public;
revoke execute on function public.service_get_first_doctor_admin_contact() from public, anon, authenticated;
grant execute on function public.service_get_first_doctor_admin_contact() to service_role;

revoke all on function public.service_update_first_doctor_admin_contact(uuid, text, text, text) from public;
revoke execute on function public.service_update_first_doctor_admin_contact(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.service_update_first_doctor_admin_contact(uuid, text, text, text) to service_role;

comment on function public.service_get_first_doctor_admin_contact() is
  'Service-role-only read model for the first doctor/admin login identity. Returns no PHI.';

comment on function public.service_update_first_doctor_admin_contact(uuid, text, text, text) is
  'Service-role-only tenant-side first doctor/admin contact update used by the SaaS control plane.';
