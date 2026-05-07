begin;

drop function if exists public.book_slot(uuid, uuid, uuid, text);
drop function if exists public.book_slot(uuid, uuid, uuid, text, text, integer);

create or replace function public.book_slot(
  p_slot uuid,
  p_patient uuid,
  p_booked_by uuid,
  p_status text default 'scheduled',
  p_reason text default null,
  p_duration_minutes integer default null,
  p_visit_type uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_domain_id uuid;
  v_caller_role text;
  v_slot record;
  v_patient record;
  v_visit_type record;
  v_appointment_id uuid;
  v_requested_status text := lower(replace(coalesce(nullif(trim(p_status), ''), 'scheduled'), '-', '_'));
  v_slot_duration_minutes integer;
  v_duration_minutes integer;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  select u.id, u.role
  into v_caller_domain_id, v_caller_role
  from public.users as u
  where u.auth_user_id = auth.uid()
    and coalesce(u.is_active, true) = true
  limit 1;

  if v_caller_domain_id is null then
    raise exception 'Unauthorized: caller has no active domain profile';
  end if;

  if p_booked_by is not null and p_booked_by <> v_caller_domain_id then
    raise exception 'Unauthorized: booked_by must match the authenticated caller';
  end if;

  if v_requested_status <> 'scheduled' then
    raise exception 'Invalid initial appointment status: appointments must start as scheduled';
  end if;

  if p_reason is not null and length(trim(p_reason)) > 1000 then
    raise exception 'Appointment reason is too long';
  end if;

  select p.id, p.user_id, p.intake_completed_at, p.is_archived
  into v_patient
  from public.patients as p
  where p.id = p_patient;

  if not found or coalesce(v_patient.is_archived, false) then
    raise exception 'Patient record not found';
  end if;

  if v_caller_role not in ('secretary', 'admin', 'doctor', 'predoctor') then
    if v_patient.user_id <> v_caller_domain_id then
      raise exception 'Unauthorized: patient record does not belong to caller';
    end if;
  end if;

  select
    s.id,
    s.is_active,
    s.doctor_id,
    s.clinic_id,
    s.date,
    s.start_time,
    s.end_time
  into v_slot
  from public.secretary_slots as s
  where s.id = p_slot
  for update;

  if not found then
    raise exception 'Slot not found';
  end if;

  if not coalesce(v_slot.is_active, false) then
    raise exception 'Slot is no longer available';
  end if;

  if v_slot.clinic_id is null then
    raise exception 'SLOT_LOCATION_REQUIRED';
  end if;

  if p_visit_type is null then
    select vt.id, vt.default_duration_minutes, vt.requires_intake
    into v_visit_type
    from public.visit_types as vt
    where vt.code = 'follow_up'
      and coalesce(vt.is_active, true) = true
    limit 1;
  else
    select vt.id, vt.default_duration_minutes, vt.requires_intake
    into v_visit_type
    from public.visit_types as vt
    where vt.id = p_visit_type
      and coalesce(vt.is_active, true) = true
    limit 1;
  end if;

  if v_visit_type.id is null then
    raise exception 'VISIT_TYPE_REQUIRED';
  end if;

  if v_visit_type.requires_intake
     and v_patient.intake_completed_at is null
     and exists (
       select 1
       from public.appointments as a
       where a.patient_id = p_patient
         and a.status = 'completed'
       limit 1
     ) then
    raise exception 'INTAKE_REQUIRED';
  end if;

  v_slot_duration_minutes := floor(extract(epoch from (v_slot.end_time - v_slot.start_time)) / 60)::integer;
  v_duration_minutes := coalesce(p_duration_minutes, v_visit_type.default_duration_minutes, v_slot_duration_minutes);

  if v_duration_minutes is null or v_duration_minutes < 5 or v_duration_minutes > 240 then
    raise exception 'Invalid appointment duration';
  end if;

  if v_slot_duration_minutes is not null and v_duration_minutes > v_slot_duration_minutes then
    raise exception 'Invalid appointment duration: duration exceeds selected slot';
  end if;

  insert into public.appointments (
    slot_id,
    patient_id,
    doctor_id,
    clinic_id,
    visit_type_id,
    booked_by,
    status,
    reason,
    duration_minutes,
    scheduled_at
  )
  values (
    v_slot.id,
    p_patient,
    v_slot.doctor_id,
    v_slot.clinic_id,
    v_visit_type.id,
    v_caller_domain_id,
    'scheduled',
    nullif(trim(p_reason), ''),
    v_duration_minutes,
    ((v_slot.date::timestamp + v_slot.start_time) at time zone 'Asia/Beirut')
  )
  returning id into v_appointment_id;

  update public.secretary_slots
  set is_active = false
  where id = v_slot.id;

  return v_appointment_id;
end;
$$;

revoke execute on function public.book_slot(uuid, uuid, uuid, text, text, integer, uuid) from public;
revoke execute on function public.book_slot(uuid, uuid, uuid, text, text, integer, uuid) from anon;
grant execute on function public.book_slot(uuid, uuid, uuid, text, text, integer, uuid) to authenticated, service_role;

-- Appointment creation is canonical through book_slot. Browser clients must not
-- insert appointments directly because that would bypass slot consumption,
-- location snapshotting, visit type assignment, and the intake gate.
drop policy if exists appointments_scoped_insert on public.appointments;
drop policy if exists appointments_staff_only_insert on public.appointments;

create or replace function public.prevent_appointment_identity_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.slot_id is distinct from new.slot_id
     or old.clinic_id is distinct from new.clinic_id
     or old.visit_type_id is distinct from new.visit_type_id
     or old.patient_id is distinct from new.patient_id
     or old.doctor_id is distinct from new.doctor_id
     or old.booked_by is distinct from new.booked_by
     or old.scheduled_at is distinct from new.scheduled_at then
    raise exception 'Appointment booking identity fields are immutable; cancel and rebook instead';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_appointment_identity_mutation on public.appointments;
create trigger prevent_appointment_identity_mutation
before update on public.appointments
for each row execute function public.prevent_appointment_identity_mutation();

commit;
