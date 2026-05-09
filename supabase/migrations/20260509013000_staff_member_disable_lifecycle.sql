-- Staff member disable lifecycle v1.
--
-- Production rule:
--   Staff lifecycle changes that affect access must be server-owned. Browser
--   code may edit low-risk roster metadata through RLS, but it may not insert
--   staff identities or mutate auth/access state directly.
--
-- Reversibility:
--   Disabling preserves the staff row, linked domain user, previous invite
--   status, actor, timestamp, and audit event. Pending invites can be
--   compensated by soft-deleting the Supabase Auth identity in the Edge
--   Function. Accepted staff keep their Auth identity so future reactivation
--   can be implemented without data loss.

alter table public.staff_members
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_by uuid references public.users(id),
  add column if not exists disabled_previous_invite_status text;

alter table public.staff_members
  drop constraint if exists staff_members_disabled_previous_invite_status_check;

alter table public.staff_members
  add constraint staff_members_disabled_previous_invite_status_check
  check (
    disabled_previous_invite_status is null
    or disabled_previous_invite_status in ('none', 'invited', 'accepted', 'disabled')
  );

create index if not exists idx_staff_members_disabled_by
  on public.staff_members(disabled_by)
  where disabled_by is not null;

comment on column public.staff_members.disabled_at is
  'Timestamp when staff access was disabled through the server-side lifecycle.';

comment on column public.staff_members.disabled_by is
  'Domain user who disabled staff access through the server-side lifecycle.';

comment on column public.staff_members.disabled_previous_invite_status is
  'Invite status before the most recent disable action; kept for undo and compensation decisions.';

drop policy if exists staff_members_doctor_insert on public.staff_members;

drop policy if exists staff_members_doctor_update on public.staff_members;
create policy staff_members_doctor_update on public.staff_members
for update using (
  (select public.has_role(array['admin']))
  or doctor_id in (
    select d.id
    from public.doctors as d
    where d.user_id = (select public.current_domain_user_id())
  )
)
with check (
  (select public.has_role(array['admin']))
  or doctor_id in (
    select d.id
    from public.doctors as d
    where d.user_id = (select public.current_domain_user_id())
  )
);

create or replace function public.enforce_staff_members_server_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'STAFF_INVITE_REQUIRED';
  end if;

  if old.user_id is distinct from new.user_id
     or old.doctor_id is distinct from new.doctor_id
     or old.role is distinct from new.role
     or old.email is distinct from new.email
     or old.invite_status is distinct from new.invite_status
     or old.invite_client_request_id is distinct from new.invite_client_request_id
     or old.reports_to is distinct from new.reports_to
     or old.is_active is distinct from new.is_active
     or old.disabled_at is distinct from new.disabled_at
     or old.disabled_by is distinct from new.disabled_by
     or old.disabled_previous_invite_status is distinct from new.disabled_previous_invite_status then
    raise exception 'STAFF_LIFECYCLE_REQUIRES_SERVER';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_staff_members_server_lifecycle on public.staff_members;
create trigger enforce_staff_members_server_lifecycle
before insert or update on public.staff_members
for each row execute function public.enforce_staff_members_server_lifecycle();

create or replace function public.disable_staff_member_domain_identity(
  p_actor_auth_user_id uuid,
  p_staff_member_id uuid
)
returns table (
  id uuid,
  user_id uuid,
  auth_user_id uuid,
  doctor_id uuid,
  role text,
  display_name text,
  phone text,
  email text,
  invite_status text,
  previous_invite_status text,
  disabled_previous_invite_status text,
  hire_date date,
  is_active boolean,
  disabled_at timestamptz,
  disabled_by uuid,
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
  v_staff public.staff_members%rowtype;
  v_previous_invite_status text;
  v_event_type text;
begin
  if p_actor_auth_user_id is null or p_staff_member_id is null then
    raise exception 'INVALID_REQUEST';
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

  select sm.*
    into v_staff
  from public.staff_members as sm
  where sm.id = p_staff_member_id
    and sm.doctor_id = v_doctor_id
  for update;

  if v_staff.id is null then
    raise exception 'STAFF_MEMBER_NOT_FOUND';
  end if;

  if v_staff.is_active = false and v_staff.invite_status = 'disabled' then
    return query
    select sm.id, sm.user_id, u.auth_user_id, sm.doctor_id, sm.role, sm.display_name,
           sm.phone, sm.email, sm.invite_status,
           coalesce(sm.disabled_previous_invite_status, sm.invite_status) as previous_invite_status,
           sm.disabled_previous_invite_status, sm.hire_date, sm.is_active,
           sm.disabled_at, sm.disabled_by, sm.created_at, sm.updated_at
    from public.staff_members as sm
    left join public.users as u on u.id = sm.user_id
    where sm.id = v_staff.id;
    return;
  end if;

  v_previous_invite_status := v_staff.invite_status;
  v_event_type := case
    when v_previous_invite_status in ('none', 'invited') then 'staff_invite_cancelled'
    else 'staff_member_disabled'
  end;

  update public.staff_members as sm
  set
    invite_status = 'disabled',
    disabled_previous_invite_status = v_previous_invite_status,
    is_active = false,
    disabled_at = now(),
    disabled_by = v_actor_user_id,
    updated_at = now()
  where sm.id = v_staff.id;

  if v_staff.user_id is not null then
    update public.users as u
    set
      is_active = false,
      updated_at = now()
    where u.id = v_staff.user_id;
  end if;

  insert into public.audit_log (table_name, record_id, action, actor_user_id, before_data, after_data)
  values (
    'staff_members',
    v_staff.id,
    'UPDATE',
    v_actor_user_id,
    jsonb_build_object(
      'invite_status', v_staff.invite_status,
      'is_active', v_staff.is_active,
      'disabled_at', v_staff.disabled_at,
      'disabled_by', v_staff.disabled_by
    ),
    jsonb_build_object(
      'event_type', v_event_type,
      'staff_member_id', v_staff.id,
      'doctor_id', v_staff.doctor_id,
      'role', v_staff.role,
      'previous_invite_status', v_previous_invite_status,
      'invite_status', 'disabled',
      'is_active', false
    )
  );

  return query
  select sm.id, sm.user_id, u.auth_user_id, sm.doctor_id, sm.role, sm.display_name,
         sm.phone, sm.email, sm.invite_status, v_previous_invite_status as previous_invite_status,
         sm.disabled_previous_invite_status, sm.hire_date, sm.is_active,
         sm.disabled_at, sm.disabled_by, sm.created_at, sm.updated_at
  from public.staff_members as sm
  left join public.users as u on u.id = sm.user_id
  where sm.id = v_staff.id;
end;
$$;

revoke all on function public.disable_staff_member_domain_identity(uuid, uuid)
from public, anon, authenticated;

grant execute on function public.disable_staff_member_domain_identity(uuid, uuid)
to service_role;
