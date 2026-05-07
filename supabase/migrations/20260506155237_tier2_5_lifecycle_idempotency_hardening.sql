-- Tier 2.5 hardening: lifecycle RPCs, idempotency, redaction, and tighter grants.
-- This migration is additive and keeps Tier 2 clinical/mobile contracts enforceable
-- before large UI work begins.

begin;

-- ---------------------------------------------------------------------------
-- 1. Defense-in-depth grant tightening
-- ---------------------------------------------------------------------------

revoke execute on function public.current_doctor_id() from anon, public;
revoke execute on function public.current_patient_id() from anon, public;
revoke execute on function public.can_access_conversation(uuid) from anon, public;
revoke execute on function public.set_updated_at() from anon, public;
revoke execute on function public.set_updated_at() from authenticated, service_role;

grant execute on function public.current_doctor_id() to authenticated, service_role;
grant execute on function public.current_patient_id() to authenticated, service_role;
grant execute on function public.can_access_conversation(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Mobile retry/idempotency and compliance columns
-- ---------------------------------------------------------------------------

alter table public.messages
  add column if not exists client_request_id uuid,
  add column if not exists redacted_at timestamptz,
  add column if not exists redacted_by uuid references public.users(id) on delete restrict;

alter table public.notification_events
  add column if not exists client_request_id uuid,
  add column if not exists source text not null default 'user'
    check (source in ('user', 'system'));

alter table public.notification_events
  alter column created_by drop not null;

update public.notification_events
set source = 'system'
where created_by is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notification_events_source_created_by_check'
      and conrelid = 'public.notification_events'::regclass
  ) then
    alter table public.notification_events
      add constraint notification_events_source_created_by_check
      check (source = 'system' or created_by is not null);
  end if;
end $$;

alter table public.notification_deliveries
  add column if not exists client_request_id uuid;

alter table public.care_tasks
  add column if not exists client_request_id uuid;

alter table public.clinical_documents
  add column if not exists client_request_id uuid,
  add column if not exists finalized_by uuid references public.users(id) on delete restrict,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references public.users(id) on delete restrict,
  add column if not exists void_reason text;

alter table public.patient_consents
  add column if not exists acceptance_method text not null default 'patient_self'
    check (acceptance_method in ('patient_self', 'staff_assisted', 'kiosk'));

update public.patient_consents pc
set accepted_by_user_id = p.user_id
from public.patients p
where pc.patient_id = p.id
  and pc.accepted_by_user_id is null
  and p.user_id is not null;

do $$
begin
  if not exists (
    select 1
    from public.patient_consents
    where accepted_by_user_id is null
  ) then
    alter table public.patient_consents
      alter column accepted_by_user_id set not null;
  end if;
end $$;

create unique index if not exists idx_messages_client_request_id_unique
  on public.messages (client_request_id)
  where client_request_id is not null;

create unique index if not exists idx_notification_events_client_request_id_unique
  on public.notification_events (client_request_id)
  where client_request_id is not null;

create unique index if not exists idx_notification_deliveries_client_request_id_unique
  on public.notification_deliveries (client_request_id)
  where client_request_id is not null;

create unique index if not exists idx_care_tasks_client_request_id_unique
  on public.care_tasks (client_request_id)
  where client_request_id is not null;

create unique index if not exists idx_clinical_documents_client_request_id_unique
  on public.clinical_documents (client_request_id)
  where client_request_id is not null;

create unique index if not exists idx_tenant_profile_doctor_id_unique
  on public.tenant_profile (doctor_id);

-- ---------------------------------------------------------------------------
-- 3. Explicit admin delete escape valve for Tier 2 records
-- ---------------------------------------------------------------------------

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'encounters',
    'clinical_notes',
    'diagnoses',
    'prescriptions',
    'lab_orders',
    'imaging_orders',
    'clinical_documents',
    'document_attachments',
    'care_tasks',
    'conversations',
    'conversation_participants',
    'messages',
    'message_attachments',
    'message_read_receipts',
    'patient_devices',
    'notification_events',
    'notification_deliveries',
    'reminder_rules',
    'tenant_profile',
    'tenant_app_config',
    'feature_flags',
    'content_pages',
    'consent_documents',
    'patient_consents'
  ]
  loop
    execute format('drop policy if exists tier2_admin_delete on public.%I', target_table);
    execute format(
      'create policy tier2_admin_delete on public.%I for delete using ((select public.has_role(array[''admin''])))',
      target_table
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Lifecycle guards
-- ---------------------------------------------------------------------------

create or replace function public.enforce_tier2_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  allowed boolean := false;
begin
  if tg_op <> 'UPDATE' or old.status is not distinct from new.status then
    return new;
  end if;

  case tg_table_name
    when 'encounters' then
      allowed := (
        (old.status = 'planned' and new.status in ('in_progress', 'cancelled', 'entered_in_error')) or
        (old.status = 'in_progress' and new.status in ('completed', 'cancelled', 'entered_in_error'))
      );
    when 'clinical_documents' then
      allowed := (
        (old.status = 'draft' and new.status in ('final', 'void')) or
        (old.status = 'final' and new.status in ('superseded', 'void'))
      );
    when 'lab_orders', 'imaging_orders' then
      allowed := (
        (old.status = 'draft' and new.status in ('ordered', 'cancelled')) or
        (old.status = 'ordered' and new.status in ('in_progress', 'resulted', 'cancelled')) or
        (old.status = 'in_progress' and new.status in ('resulted', 'cancelled'))
      );
    when 'prescriptions' then
      allowed := (
        (old.status = 'draft' and new.status in ('active', 'cancelled')) or
        (old.status = 'active' and new.status in ('completed', 'stopped', 'cancelled'))
      );
    when 'care_tasks' then
      allowed := (
        (old.status = 'open' and new.status in ('in_progress', 'done', 'cancelled')) or
        (old.status = 'in_progress' and new.status in ('done', 'cancelled'))
      );
    else
      return new;
  end case;

  if not allowed then
    raise exception 'Invalid % status transition from % to %', tg_table_name, old.status, new.status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_encounters_status_transition on public.encounters;
create trigger enforce_encounters_status_transition
before update on public.encounters
for each row execute function public.enforce_tier2_status_transition();

drop trigger if exists enforce_clinical_documents_status_transition on public.clinical_documents;
create trigger enforce_clinical_documents_status_transition
before update on public.clinical_documents
for each row execute function public.enforce_tier2_status_transition();

drop trigger if exists enforce_lab_orders_status_transition on public.lab_orders;
create trigger enforce_lab_orders_status_transition
before update on public.lab_orders
for each row execute function public.enforce_tier2_status_transition();

drop trigger if exists enforce_imaging_orders_status_transition on public.imaging_orders;
create trigger enforce_imaging_orders_status_transition
before update on public.imaging_orders
for each row execute function public.enforce_tier2_status_transition();

drop trigger if exists enforce_prescriptions_status_transition on public.prescriptions;
create trigger enforce_prescriptions_status_transition
before update on public.prescriptions
for each row execute function public.enforce_tier2_status_transition();

drop trigger if exists enforce_care_tasks_status_transition on public.care_tasks;
create trigger enforce_care_tasks_status_transition
before update on public.care_tasks
for each row execute function public.enforce_tier2_status_transition();

create or replace function public.enforce_message_redaction()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.redacted_at is not null then
    if old.body is distinct from new.body
      or old.redacted_at is distinct from new.redacted_at
      or old.redacted_by is distinct from new.redacted_by then
      raise exception 'Redacted messages are immutable'
        using errcode = 'check_violation';
    end if;

    return new;
  end if;

  if old.body is distinct from new.body and new.redacted_at is null then
    raise exception 'Messages cannot be edited; redact instead'
      using errcode = 'check_violation';
  end if;

  if new.redacted_at is not null then
    new.body := '[redacted]';
    new.redacted_by := coalesce(new.redacted_by, public.current_domain_user_id());
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_messages_redaction on public.messages;
create trigger enforce_messages_redaction
before update on public.messages
for each row execute function public.enforce_message_redaction();

-- ---------------------------------------------------------------------------
-- 5. Atomic lifecycle RPCs
-- ---------------------------------------------------------------------------

create or replace function public.start_encounter(
  p_appointment uuid,
  p_chief_complaint text default null
)
returns public.encounters
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid;
  v_doctor uuid;
  v_appointment public.appointments%rowtype;
  v_encounter public.encounters%rowtype;
begin
  v_actor := public.current_domain_user_id();
  v_doctor := public.current_doctor_id();

  if v_actor is null or not public.has_role(array['doctor', 'admin']) then
    raise exception 'Only doctors can start encounters' using errcode = 'insufficient_privilege';
  end if;

  select *
  into v_appointment
  from public.appointments
  where id = p_appointment
  for update;

  if not found then
    raise exception 'Appointment not found' using errcode = 'no_data_found';
  end if;

  if public.current_user_role() = 'doctor' and v_appointment.doctor_id is distinct from v_doctor then
    raise exception 'Cannot start another doctor''s encounter' using errcode = 'insufficient_privilege';
  end if;

  if v_appointment.status in ('completed', 'cancelled', 'no_show') then
    raise exception 'Cannot start encounter for appointment in status %', v_appointment.status
      using errcode = 'check_violation';
  end if;

  select *
  into v_encounter
  from public.encounters
  where appointment_id = p_appointment
  for update;

  if found then
    if v_encounter.status = 'planned' then
      update public.encounters
      set status = 'in_progress',
          started_at = coalesce(started_at, now()),
          chief_complaint = coalesce(nullif(p_chief_complaint, ''), chief_complaint),
          updated_at = now()
      where id = v_encounter.id
      returning * into v_encounter;
    elsif v_encounter.status = 'in_progress' then
      update public.encounters
      set chief_complaint = coalesce(nullif(p_chief_complaint, ''), chief_complaint),
          updated_at = now()
      where id = v_encounter.id
      returning * into v_encounter;
    else
      raise exception 'Encounter cannot be started from status %', v_encounter.status
        using errcode = 'check_violation';
    end if;
  else
    insert into public.encounters (
      appointment_id,
      patient_id,
      doctor_id,
      clinic_id,
      visit_type_id,
      status,
      started_at,
      chief_complaint,
      created_by
    )
    values (
      v_appointment.id,
      v_appointment.patient_id,
      v_appointment.doctor_id,
      v_appointment.clinic_id,
      v_appointment.visit_type_id,
      'in_progress',
      now(),
      nullif(p_chief_complaint, ''),
      v_actor
    )
    returning * into v_encounter;
  end if;

  update public.appointments
  set status = 'in_consultation',
      updated_at = now()
  where id = p_appointment
    and status in ('scheduled', 'confirmed', 'pre_check', 'in_consultation');

  return v_encounter;
end;
$$;

create or replace function public.complete_encounter(
  p_encounter uuid,
  p_summary text default null
)
returns public.encounters
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doctor uuid;
  v_encounter public.encounters%rowtype;
begin
  v_doctor := public.current_doctor_id();

  if public.current_domain_user_id() is null or not public.has_role(array['doctor', 'admin']) then
    raise exception 'Only doctors can complete encounters' using errcode = 'insufficient_privilege';
  end if;

  select *
  into v_encounter
  from public.encounters
  where id = p_encounter
  for update;

  if not found then
    raise exception 'Encounter not found' using errcode = 'no_data_found';
  end if;

  if public.current_user_role() = 'doctor' and v_encounter.doctor_id is distinct from v_doctor then
    raise exception 'Cannot complete another doctor''s encounter' using errcode = 'insufficient_privilege';
  end if;

  if v_encounter.status = 'completed' then
    return v_encounter;
  end if;

  if v_encounter.status <> 'in_progress' then
    raise exception 'Encounter cannot be completed from status %', v_encounter.status
      using errcode = 'check_violation';
  end if;

  update public.encounters
  set status = 'completed',
      ended_at = coalesce(ended_at, now()),
      summary = coalesce(nullif(p_summary, ''), summary),
      updated_at = now()
  where id = p_encounter
  returning * into v_encounter;

  update public.appointments
  set status = 'completed',
      updated_at = now()
  where id = v_encounter.appointment_id
    and status in ('scheduled', 'confirmed', 'pre_check', 'in_consultation');

  return v_encounter;
end;
$$;

create or replace function public.cancel_encounter(
  p_encounter uuid,
  p_reason text default null
)
returns public.encounters
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doctor uuid;
  v_encounter public.encounters%rowtype;
begin
  v_doctor := public.current_doctor_id();

  if public.current_domain_user_id() is null or not public.has_role(array['doctor', 'admin']) then
    raise exception 'Only doctors can cancel encounters' using errcode = 'insufficient_privilege';
  end if;

  select *
  into v_encounter
  from public.encounters
  where id = p_encounter
  for update;

  if not found then
    raise exception 'Encounter not found' using errcode = 'no_data_found';
  end if;

  if public.current_user_role() = 'doctor' and v_encounter.doctor_id is distinct from v_doctor then
    raise exception 'Cannot cancel another doctor''s encounter' using errcode = 'insufficient_privilege';
  end if;

  if v_encounter.status = 'cancelled' then
    return v_encounter;
  end if;

  if v_encounter.status not in ('planned', 'in_progress') then
    raise exception 'Encounter cannot be cancelled from status %', v_encounter.status
      using errcode = 'check_violation';
  end if;

  update public.encounters
  set status = 'cancelled',
      summary = case
        when nullif(p_reason, '') is null then summary
        else concat_ws(E'\n', summary, 'Cancelled: ' || p_reason)
      end,
      updated_at = now()
  where id = p_encounter
  returning * into v_encounter;

  return v_encounter;
end;
$$;

create or replace function public.finalize_clinical_document(
  p_document uuid
)
returns public.clinical_documents
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid;
  v_doctor uuid;
  v_document public.clinical_documents%rowtype;
begin
  v_actor := public.current_domain_user_id();
  v_doctor := public.current_doctor_id();

  if v_actor is null or not public.has_role(array['doctor', 'secretary', 'admin']) then
    raise exception 'Only staff can finalize clinical documents' using errcode = 'insufficient_privilege';
  end if;

  select *
  into v_document
  from public.clinical_documents
  where id = p_document
  for update;

  if not found then
    raise exception 'Clinical document not found' using errcode = 'no_data_found';
  end if;

  if public.current_user_role() = 'doctor' and v_document.doctor_id is distinct from v_doctor then
    raise exception 'Cannot finalize another doctor''s document' using errcode = 'insufficient_privilege';
  end if;

  if v_document.status = 'final' then
    return v_document;
  end if;

  if v_document.status <> 'draft' then
    raise exception 'Clinical document cannot be finalized from status %', v_document.status
      using errcode = 'check_violation';
  end if;

  update public.clinical_documents
  set status = 'final',
      finalized_at = coalesce(finalized_at, now()),
      finalized_by = coalesce(finalized_by, v_actor),
      updated_at = now()
  where id = p_document
  returning * into v_document;

  return v_document;
end;
$$;

create or replace function public.void_clinical_document(
  p_document uuid,
  p_reason text default null
)
returns public.clinical_documents
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid;
  v_doctor uuid;
  v_document public.clinical_documents%rowtype;
begin
  v_actor := public.current_domain_user_id();
  v_doctor := public.current_doctor_id();

  if v_actor is null or not public.has_role(array['doctor', 'secretary', 'admin']) then
    raise exception 'Only staff can void clinical documents' using errcode = 'insufficient_privilege';
  end if;

  select *
  into v_document
  from public.clinical_documents
  where id = p_document
  for update;

  if not found then
    raise exception 'Clinical document not found' using errcode = 'no_data_found';
  end if;

  if public.current_user_role() = 'doctor' and v_document.doctor_id is distinct from v_doctor then
    raise exception 'Cannot void another doctor''s document' using errcode = 'insufficient_privilege';
  end if;

  if v_document.status = 'void' then
    return v_document;
  end if;

  if v_document.status not in ('draft', 'final') then
    raise exception 'Clinical document cannot be voided from status %', v_document.status
      using errcode = 'check_violation';
  end if;

  update public.clinical_documents
  set status = 'void',
      voided_at = coalesce(voided_at, now()),
      voided_by = coalesce(voided_by, v_actor),
      void_reason = coalesce(nullif(p_reason, ''), void_reason),
      updated_at = now()
  where id = p_document
  returning * into v_document;

  return v_document;
end;
$$;

revoke execute on function public.start_encounter(uuid, text) from public, anon;
revoke execute on function public.complete_encounter(uuid, text) from public, anon;
revoke execute on function public.cancel_encounter(uuid, text) from public, anon;
revoke execute on function public.finalize_clinical_document(uuid) from public, anon;
revoke execute on function public.void_clinical_document(uuid, text) from public, anon;

grant execute on function public.start_encounter(uuid, text) to authenticated, service_role;
grant execute on function public.complete_encounter(uuid, text) to authenticated, service_role;
grant execute on function public.cancel_encounter(uuid, text) to authenticated, service_role;
grant execute on function public.finalize_clinical_document(uuid) to authenticated, service_role;
grant execute on function public.void_clinical_document(uuid, text) to authenticated, service_role;

commit;
