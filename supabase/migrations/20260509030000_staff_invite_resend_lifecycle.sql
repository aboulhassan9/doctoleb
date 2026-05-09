-- Staff invite resend lifecycle v1.
--
-- Production rule:
--   Resending a staff invite is an access lifecycle operation. The browser may
--   request it, but preconditions, idempotency, auditability, and final state
--   are owned by service-role RPCs and immutable event rows.
--
-- Reversibility:
--   Each resend attempt is recorded as a statused event. A failed external email
--   send is visible as `failed`; duplicate client request ids return the same
--   event instead of creating duplicate state. No staff or auth identity is
--   deleted by this workflow.

alter table public.staff_members
  add column if not exists invite_resent_at timestamptz,
  add column if not exists invite_resent_by uuid references public.users(id),
  add column if not exists invite_resend_count integer not null default 0;

alter table public.staff_members
  drop constraint if exists staff_members_invite_resend_count_check;

alter table public.staff_members
  add constraint staff_members_invite_resend_count_check
  check (invite_resend_count >= 0);

create index if not exists idx_staff_members_invite_resent_by
  on public.staff_members(invite_resent_by)
  where invite_resent_by is not null;

comment on column public.staff_members.invite_resent_at is
  'Timestamp for the most recent successful server-side staff invite resend.';

comment on column public.staff_members.invite_resent_by is
  'Domain user who most recently resent this staff invite.';

comment on column public.staff_members.invite_resend_count is
  'Number of successful server-side resend attempts for this staff invite.';

create table if not exists public.staff_invite_resend_events (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid not null references public.staff_members(id) on delete restrict,
  actor_user_id uuid not null references public.users(id) on delete restrict,
  client_request_id uuid not null,
  email text not null,
  status text not null default 'pending',
  error_code text,
  requested_at timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_invite_resend_events_status_check
    check (status in ('pending', 'sent', 'failed', 'cancelled')),
  constraint staff_invite_resend_events_sent_check
    check ((status = 'sent' and sent_at is not null) or status <> 'sent'),
  constraint staff_invite_resend_events_failed_check
    check ((status = 'failed' and failed_at is not null) or status <> 'failed'),
  constraint staff_invite_resend_events_cancelled_check
    check ((status = 'cancelled' and cancelled_at is not null) or status <> 'cancelled')
);

create unique index if not exists staff_invite_resend_events_client_request_id_key
  on public.staff_invite_resend_events(client_request_id);

create index if not exists idx_staff_invite_resend_events_staff_requested
  on public.staff_invite_resend_events(staff_member_id, requested_at desc);

create index if not exists idx_staff_invite_resend_events_actor
  on public.staff_invite_resend_events(actor_user_id, requested_at desc);

create index if not exists idx_staff_invite_resend_events_pending
  on public.staff_invite_resend_events(requested_at)
  where status = 'pending';

alter table public.staff_invite_resend_events enable row level security;

drop policy if exists staff_invite_resend_events_doctor_select on public.staff_invite_resend_events;
create policy staff_invite_resend_events_doctor_select
on public.staff_invite_resend_events
for select
using (
  (select public.has_role(array['admin']))
  or exists (
    select 1
    from public.staff_members as sm
    join public.doctors as d on d.id = sm.doctor_id
    where sm.id = staff_invite_resend_events.staff_member_id
      and d.user_id = (select public.current_domain_user_id())
  )
);

drop trigger if exists set_staff_invite_resend_events_updated_at on public.staff_invite_resend_events;
create trigger set_staff_invite_resend_events_updated_at
before update on public.staff_invite_resend_events
for each row execute function public.set_updated_at();

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
     or old.invite_resend_count is distinct from new.invite_resend_count then
    raise exception 'STAFF_LIFECYCLE_REQUIRES_SERVER';
  end if;

  return new;
end;
$$;

create or replace function public.create_staff_invite_resend_event(
  p_actor_auth_user_id uuid,
  p_staff_member_id uuid,
  p_client_request_id uuid
)
returns table (
  event_id uuid,
  staff_member_id uuid,
  email text,
  display_name text,
  role text,
  client_request_id uuid,
  status text,
  error_code text,
  requested_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  should_send boolean
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
  v_existing public.staff_invite_resend_events%rowtype;
  v_email text;
begin
  if p_actor_auth_user_id is null or p_staff_member_id is null or p_client_request_id is null then
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

  if v_staff.is_active is distinct from true
     or v_staff.invite_status <> 'invited' then
    raise exception 'STAFF_INVITE_NOT_RESENDABLE';
  end if;

  v_email := lower(trim(coalesce(v_staff.email, '')));
  if v_email = '' or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'STAFF_INVITE_EMAIL_MISSING';
  end if;

  select e.*
    into v_existing
  from public.staff_invite_resend_events as e
  where e.client_request_id = p_client_request_id;

  if v_existing.id is not null then
    return query
    select
      v_existing.id,
      v_staff.id,
      v_existing.email,
      v_staff.display_name,
      v_staff.role,
      v_existing.client_request_id,
      v_existing.status,
      v_existing.error_code,
      v_existing.requested_at,
      v_existing.sent_at,
      v_existing.failed_at,
      false;
    return;
  end if;

  return query
  with inserted as (
    insert into public.staff_invite_resend_events (
      staff_member_id,
      actor_user_id,
      client_request_id,
      email
    )
    values (
      v_staff.id,
      v_actor_user_id,
      p_client_request_id,
      v_email
    )
    returning *
  )
  select
    inserted.id,
    v_staff.id,
    inserted.email,
    v_staff.display_name,
    v_staff.role,
    inserted.client_request_id,
    inserted.status,
    inserted.error_code,
    inserted.requested_at,
    inserted.sent_at,
    inserted.failed_at,
    true
  from inserted;
end;
$$;

create or replace function public.finish_staff_invite_resend_event(
  p_event_id uuid,
  p_status text,
  p_error_code text default null
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
  v_event public.staff_invite_resend_events%rowtype;
  v_finished_at timestamptz := now();
begin
  if p_event_id is null or p_status not in ('sent', 'failed') then
    raise exception 'INVALID_REQUEST';
  end if;

  select e.*
    into v_event
  from public.staff_invite_resend_events as e
  where e.id = p_event_id
  for update;

  if v_event.id is null then
    raise exception 'STAFF_INVITE_RESEND_EVENT_NOT_FOUND';
  end if;

  if v_event.status = 'pending' then
    update public.staff_invite_resend_events as e
    set
      status = p_status,
      error_code = nullif(trim(coalesce(p_error_code, '')), ''),
      sent_at = case when p_status = 'sent' then v_finished_at else e.sent_at end,
      failed_at = case when p_status = 'failed' then v_finished_at else e.failed_at end,
      updated_at = v_finished_at
    where e.id = v_event.id
    returning e.* into v_event;

    if p_status = 'sent' then
      update public.staff_members as sm
      set
        invite_resent_at = v_finished_at,
        invite_resent_by = v_event.actor_user_id,
        invite_resend_count = sm.invite_resend_count + 1,
        updated_at = v_finished_at
      where sm.id = v_event.staff_member_id;
    end if;

    insert into public.audit_log (table_name, record_id, action, actor_user_id, after_data)
    values (
      'staff_members',
      v_event.staff_member_id,
      'UPDATE',
      v_event.actor_user_id,
      jsonb_build_object(
        'event_type', case when p_status = 'sent' then 'staff_invite_resent' else 'staff_invite_resend_failed' end,
        'staff_member_id', v_event.staff_member_id,
        'resend_event_id', v_event.id,
        'status', p_status,
        'error_code', nullif(trim(coalesce(p_error_code, '')), '')
      )
    );
  end if;

  return query
  select
    sm.id,
    sm.user_id,
    sm.doctor_id,
    sm.role,
    sm.display_name,
    sm.phone,
    sm.email,
    sm.invite_status,
    sm.invite_client_request_id,
    sm.disabled_previous_invite_status,
    sm.invite_resent_at,
    sm.invite_resent_by,
    sm.invite_resend_count,
    sm.reports_to,
    sm.hire_date,
    sm.is_active,
    sm.disabled_at,
    sm.disabled_by,
    sm.created_at,
    sm.updated_at
  from public.staff_members as sm
  where sm.id = v_event.staff_member_id;
end;
$$;

revoke all on function public.create_staff_invite_resend_event(uuid, uuid, uuid)
from public, anon, authenticated;

grant execute on function public.create_staff_invite_resend_event(uuid, uuid, uuid)
to service_role;

revoke all on function public.finish_staff_invite_resend_event(uuid, text, text)
from public, anon, authenticated;

grant execute on function public.finish_staff_invite_resend_event(uuid, text, text)
to service_role;
