-- ═══════════════════════════════════════════════════════════════════
-- Hardening migration: Fixes P0/P1 reviewer findings
-- - P0: update_patient_profile + book_slot RPCs get auth.uid() checks
-- - P1: Patient direct INSERT/UPDATE on appointments → staff-only
-- - P1: Notification INSERT → staff-only
-- - P1: book_slot now returns appointment UUID and accepts reason/duration
-- ═══════════════════════════════════════════════════════════════════

-- Fresh disposable databases apply this file before the later secure web
-- foundation migration. Keep the helper definitions self-contained here so
-- policies below can be created from an empty branch/local database.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.role
  from public.users as u
  where u.auth_user_id = auth.uid()
    and coalesce(u.is_active, true) = true
  limit 1;
$$;

create or replace function public.has_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_user_role() = any (allowed_roles), false);
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_role(array['doctor', 'predoctor', 'secretary', 'admin']);
$$;

-- P0 FIX 1: update_patient_profile — add auth ownership / staff check
create or replace function public.update_patient_profile(
  p_user_id uuid,
  p_patient_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text default null,
  p_date_of_birth text default null,
  p_sex text default null,
  p_blood_type text default null,
  p_allergies text default null,
  p_insurance_id text default null,
  p_emergency_contact text default null,
  p_emergency_phone text default null,
  p_medical_history text default null
)
returns table(user_id uuid, patient_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_domain_id uuid;
  v_initials text;
begin
  select u.id into v_caller_domain_id
  from public.users as u
  where u.auth_user_id = auth.uid()
  limit 1;

  if v_caller_domain_id is null then
    raise exception 'Unauthorized: caller has no domain profile';
  end if;

  if v_caller_domain_id != p_user_id
     and not public.has_role(array['secretary', 'admin']) then
    raise exception 'Unauthorized: cannot update another user''s profile';
  end if;

  v_initials := upper(
    left(coalesce(trim(p_first_name), ''), 1) ||
    left(coalesce(trim(p_last_name), ''), 1)
  );

  update public.users
  set first_name = nullif(trim(p_first_name), ''),
      last_name  = nullif(trim(p_last_name), ''),
      phone      = nullif(trim(p_phone), ''),
      initials   = nullif(v_initials, ''),
      updated_at = now()
  where id = p_user_id;

  update public.patients
  set date_of_birth     = nullif(trim(p_date_of_birth), '')::date,
      sex               = nullif(trim(p_sex), ''),
      blood_type        = nullif(trim(p_blood_type), ''),
      allergies         = nullif(trim(p_allergies), ''),
      insurance_id      = nullif(trim(p_insurance_id), ''),
      emergency_contact = nullif(trim(p_emergency_contact), ''),
      emergency_phone   = nullif(trim(p_emergency_phone), ''),
      medical_history   = nullif(trim(p_medical_history), ''),
      updated_at        = now()
  where id = p_patient_id
    and user_id = p_user_id;

  return query
  select p_user_id, p_patient_id;
end;
$$;

-- P0 FIX 2: book_slot — add auth check + fold in reason/duration (atomic)
create or replace function public.book_slot(
  p_slot uuid,
  p_patient uuid,
  p_booked_by uuid,
  p_status text default 'scheduled',
  p_reason text default null,
  p_duration_minutes int default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_domain_id uuid;
  v_caller_role text;
  v_is_active boolean;
  v_doctor_id uuid;
  v_appointment_id uuid;
begin
  select u.id, u.role into v_caller_domain_id, v_caller_role
  from public.users as u
  where u.auth_user_id = auth.uid()
  limit 1;

  if v_caller_domain_id is null then
    raise exception 'Unauthorized: caller has no domain profile';
  end if;

  if v_caller_role not in ('secretary', 'admin', 'doctor', 'predoctor') then
    if v_caller_domain_id != p_booked_by then
      raise exception 'Unauthorized: cannot book on behalf of another user';
    end if;
    if not exists (
      select 1 from public.patients
      where id = p_patient and user_id = v_caller_domain_id
    ) then
      raise exception 'Unauthorized: patient record does not belong to caller';
    end if;
  end if;

  select s.is_active, s.doctor_id
  into v_is_active, v_doctor_id
  from public.secretary_slots as s
  where s.id = p_slot
  for update;

  if not found then
    raise exception 'Slot not found';
  end if;

  if not v_is_active then
    raise exception 'Slot is no longer available';
  end if;

  insert into public.appointments (
    slot_id, patient_id, doctor_id, booked_by,
    status, reason, duration_minutes, scheduled_at
  )
  select
    s.id, p_patient, v_doctor_id, p_booked_by,
    p_status, p_reason, p_duration_minutes,
    ((s.date::timestamp + s.start_time) at time zone 'Asia/Beirut')
  from public.secretary_slots as s
  where s.id = p_slot
  returning id into v_appointment_id;

  update public.secretary_slots
  set is_active = false
  where id = p_slot;

  return v_appointment_id;
end;
$$;

-- P1 FIX 3: Appointment INSERT/UPDATE → staff-only
drop policy if exists appointments_scoped_insert on public.appointments;
create policy appointments_staff_only_insert
on public.appointments for insert
with check (public.has_role(array['secretary', 'admin']));

drop policy if exists appointments_scoped_update on public.appointments;
create policy appointments_staff_only_update
on public.appointments for update
using (public.is_staff())
with check (public.is_staff());

-- P1 FIX 4: Notification INSERT → staff-only
drop policy if exists notifications_authenticated_insert on public.notifications;
create policy notifications_staff_only_insert
on public.notifications for insert
with check (public.is_staff());

-- Lock anon out of the updated function signatures
revoke execute on function public.update_patient_profile(uuid,uuid,text,text,text,text,text,text,text,text,text,text,text) from anon;
revoke execute on function public.book_slot(uuid,uuid,uuid,text,text,int) from anon;
