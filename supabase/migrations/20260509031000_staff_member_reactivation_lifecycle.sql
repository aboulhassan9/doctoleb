-- Staff member reactivation lifecycle v1.
--
-- Production rule:
--   Re-enabling staff access is an access lifecycle operation. Browser code
--   may request reactivation, but the DB owns eligibility, state transition,
--   audit, and postconditions.
--
-- Scope:
--   v1 reactivates previously accepted staff only. Cancelled pending invites
--   had their pending Auth identities soft-deleted by the disable workflow and
--   require a future re-invite path, not a blind DB toggle.

alter table public.staff_members
  add column if not exists reactivated_at timestamptz,
  add column if not exists reactivated_by uuid references public.users(id),
  add column if not exists reactivation_count integer not null default 0;

alter table public.staff_members
  drop constraint if exists staff_members_reactivation_count_check;

alter table public.staff_members
  add constraint staff_members_reactivation_count_check
  check (reactivation_count >= 0);

create index if not exists idx_staff_members_reactivated_by
  on public.staff_members(reactivated_by)
  where reactivated_by is not null;

comment on column public.staff_members.reactivated_at is
  'Timestamp for the most recent accepted-staff reactivation.';

comment on column public.staff_members.reactivated_by is
  'Domain user who most recently reactivated accepted staff access.';

comment on column public.staff_members.reactivation_count is
  'Number of successful accepted-staff reactivation actions.';

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
     or old.disabled_previous_invite_status is distinct from new.disabled_previous_invite_status
     or old.invite_resent_at is distinct from new.invite_resent_at
     or old.invite_resent_by is distinct from new.invite_resent_by
     or old.invite_resend_count is distinct from new.invite_resend_count
     or old.reactivated_at is distinct from new.reactivated_at
     or old.reactivated_by is distinct from new.reactivated_by
     or old.reactivation_count is distinct from new.reactivation_count then
    raise exception 'STAFF_LIFECYCLE_REQUIRES_SERVER';
  end if;

  return new;
end;
$$;

create or replace function public.reactivate_staff_member_domain_identity(
  p_actor_auth_user_id uuid,
  p_staff_member_id uuid
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
  invite_client_request_id uuid,
  disabled_previous_invite_status text,
  invite_resent_at timestamptz,
  invite_resent_by uuid,
  invite_resend_count integer,
  reactivated_at timestamptz,
  reactivated_by uuid,
  reactivation_count integer,
  reports_to uuid,
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
  v_reactivated_at timestamptz := now();
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

  if v_staff.is_active = true and v_staff.invite_status = 'accepted' then
    return query
    select sm.id, sm.user_id, sm.doctor_id, sm.role, sm.display_name,
           sm.phone, sm.email, sm.invite_status, sm.invite_client_request_id,
           sm.disabled_previous_invite_status, sm.invite_resent_at,
           sm.invite_resent_by, sm.invite_resend_count, sm.reactivated_at,
           sm.reactivated_by, sm.reactivation_count, sm.reports_to,
           sm.hire_date, sm.is_active, sm.disabled_at, sm.disabled_by,
           sm.created_at, sm.updated_at
    from public.staff_members as sm
    where sm.id = v_staff.id;
    return;
  end if;

  if v_staff.is_active is distinct from false
     or v_staff.invite_status <> 'disabled'
     or coalesce(v_staff.disabled_previous_invite_status, '') <> 'accepted'
     or v_staff.user_id is null then
    raise exception 'STAFF_MEMBER_NOT_REACTIVATABLE';
  end if;

  update public.staff_members as sm
  set
    invite_status = 'accepted',
    is_active = true,
    reactivated_at = v_reactivated_at,
    reactivated_by = v_actor_user_id,
    reactivation_count = sm.reactivation_count + 1,
    updated_at = v_reactivated_at
  where sm.id = v_staff.id;

  update public.users as u
  set
    is_active = true,
    updated_at = v_reactivated_at
  where u.id = v_staff.user_id;

  insert into public.audit_log (table_name, record_id, action, actor_user_id, before_data, after_data)
  values (
    'staff_members',
    v_staff.id,
    'UPDATE',
    v_actor_user_id,
    jsonb_build_object(
      'invite_status', v_staff.invite_status,
      'is_active', v_staff.is_active,
      'disabled_previous_invite_status', v_staff.disabled_previous_invite_status
    ),
    jsonb_build_object(
      'event_type', 'staff_member_reactivated',
      'staff_member_id', v_staff.id,
      'doctor_id', v_staff.doctor_id,
      'role', v_staff.role,
      'invite_status', 'accepted',
      'is_active', true,
      'reactivated_at', v_reactivated_at
    )
  );

  return query
  select sm.id, sm.user_id, sm.doctor_id, sm.role, sm.display_name,
         sm.phone, sm.email, sm.invite_status, sm.invite_client_request_id,
         sm.disabled_previous_invite_status, sm.invite_resent_at,
         sm.invite_resent_by, sm.invite_resend_count, sm.reactivated_at,
         sm.reactivated_by, sm.reactivation_count, sm.reports_to,
         sm.hire_date, sm.is_active, sm.disabled_at, sm.disabled_by,
         sm.created_at, sm.updated_at
  from public.staff_members as sm
  where sm.id = v_staff.id;
end;
$$;

revoke all on function public.reactivate_staff_member_domain_identity(uuid, uuid)
from public, anon, authenticated;

grant execute on function public.reactivate_staff_member_domain_identity(uuid, uuid)
to service_role;
