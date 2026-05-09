begin;

drop view if exists public.doctor_dashboard_summary;
drop view if exists public.doctor_patients;
drop view if exists public.upcoming_appointments;

alter table public.users add column if not exists auth_user_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_auth_user_id_fkey'
  ) then
    alter table public.users
      add constraint users_auth_user_id_fkey
      foreign key (auth_user_id)
      references auth.users(id)
      on delete set null;
  end if;
exception
  when duplicate_object then null;
end
$$;

create unique index if not exists users_auth_user_id_unique
  on public.users(auth_user_id)
  where auth_user_id is not null;

update public.users as domain_user
set auth_user_id = auth_user.id
from auth.users as auth_user
where domain_user.auth_user_id is null
  and lower(domain_user.email) = lower(auth_user.email);

create or replace function public.current_domain_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id
  from public.users as u
  where u.auth_user_id = auth.uid()
  limit 1;
$$;

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

alter table public.users
  alter column created_at type timestamptz using case when created_at is null then null else created_at at time zone 'Asia/Beirut' end,
  alter column updated_at type timestamptz using case when updated_at is null then null else updated_at at time zone 'Asia/Beirut' end;

alter table public.doctors
  alter column created_at type timestamptz using case when created_at is null then null else created_at at time zone 'Asia/Beirut' end,
  alter column updated_at type timestamptz using case when updated_at is null then null else updated_at at time zone 'Asia/Beirut' end;

alter table public.patients
  alter column created_at type timestamptz using case when created_at is null then null else created_at at time zone 'Asia/Beirut' end,
  alter column updated_at type timestamptz using case when updated_at is null then null else updated_at at time zone 'Asia/Beirut' end;

alter table public.appointments
  alter column scheduled_at type timestamptz using case when scheduled_at is null then null else scheduled_at at time zone 'Asia/Beirut' end,
  alter column created_at type timestamptz using case when created_at is null then null else created_at at time zone 'Asia/Beirut' end,
  alter column updated_at type timestamptz using case when updated_at is null then null else updated_at at time zone 'Asia/Beirut' end;

alter table public.consultations
  alter column session_start type timestamptz using case when session_start is null then null else session_start at time zone 'Asia/Beirut' end,
  alter column session_end type timestamptz using case when session_end is null then null else session_end at time zone 'Asia/Beirut' end,
  alter column created_at type timestamptz using case when created_at is null then null else created_at at time zone 'Asia/Beirut' end,
  alter column updated_at type timestamptz using case when updated_at is null then null else updated_at at time zone 'Asia/Beirut' end;

alter table public.medical_reports
  alter column created_at type timestamptz using case when created_at is null then null else created_at at time zone 'Asia/Beirut' end,
  alter column updated_at type timestamptz using case when updated_at is null then null else updated_at at time zone 'Asia/Beirut' end;

alter table public.referrals
  alter column referred_at type timestamptz using case when referred_at is null then null else referred_at at time zone 'Asia/Beirut' end,
  alter column created_at type timestamptz using case when created_at is null then null else created_at at time zone 'Asia/Beirut' end,
  alter column updated_at type timestamptz using case when updated_at is null then null else updated_at at time zone 'Asia/Beirut' end;

alter table public.certificates
  alter column created_at type timestamptz using case when created_at is null then null else created_at at time zone 'Asia/Beirut' end,
  alter column updated_at type timestamptz using case when updated_at is null then null else updated_at at time zone 'Asia/Beirut' end;

alter table public.predoctors
  alter column created_at type timestamptz using case when created_at is null then null else created_at at time zone 'Asia/Beirut' end,
  alter column updated_at type timestamptz using case when updated_at is null then null else updated_at at time zone 'Asia/Beirut' end;

alter table public.precheck_forms
  alter column submitted_at type timestamptz using case when submitted_at is null then null else submitted_at at time zone 'Asia/Beirut' end,
  alter column created_at type timestamptz using case when created_at is null then null else created_at at time zone 'Asia/Beirut' end,
  alter column updated_at type timestamptz using case when updated_at is null then null else updated_at at time zone 'Asia/Beirut' end;

alter table public.notifications
  alter column created_at type timestamptz using case when created_at is null then null else created_at at time zone 'Asia/Beirut' end;

alter table public.payments
  alter column created_at type timestamptz using case when created_at is null then null else created_at at time zone 'Asia/Beirut' end,
  alter column updated_at type timestamptz using case when updated_at is null then null else updated_at at time zone 'Asia/Beirut' end;

alter table public.clinic_settings
  alter column created_at type timestamptz using case when created_at is null then null else created_at at time zone 'Asia/Beirut' end,
  alter column updated_at type timestamptz using case when updated_at is null then null else updated_at at time zone 'Asia/Beirut' end;

update public.appointments
set status = 'no_show'
where status = 'no-show';

update public.consultations
set status = 'in_progress'
where status = 'in-progress';

alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments
  add constraint appointments_status_check
  check (status::text = any (array[
    'scheduled'::text,
    'confirmed'::text,
    'pre_check'::text,
    'in_consultation'::text,
    'completed'::text,
    'cancelled'::text,
    'no_show'::text
  ]));

alter table public.consultations drop constraint if exists consultations_status_check;
alter table public.consultations
  add constraint consultations_status_check
  check (status::text = any (array[
    'pending'::text,
    'in_progress'::text,
    'completed'::text,
    'cancelled'::text
  ]));

alter table public.referrals drop constraint if exists referrals_status_check;
alter table public.referrals
  add constraint referrals_status_check
  check (status::text = any (array[
    'pending'::text,
    'accepted'::text,
    'in_progress'::text,
    'completed'::text,
    'rejected'::text
  ]));

alter table public.patients
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.users(id);

alter table public.consultations
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.users(id);

alter table public.medical_reports
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.users(id);

alter table public.certificates
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.users(id);

alter table public.referrals
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.users(id);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  actor_user_id uuid references public.users(id),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (table_name, record_id, action, actor_user_id, after_data)
    values (tg_table_name, new.id, tg_op, public.current_domain_user_id(), to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_log (table_name, record_id, action, actor_user_id, before_data, after_data)
    values (tg_table_name, new.id, tg_op, public.current_domain_user_id(), to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into public.audit_log (table_name, record_id, action, actor_user_id, before_data)
    values (tg_table_name, old.id, tg_op, public.current_domain_user_id(), to_jsonb(old));
    return old;
  end if;
end;
$$;

drop trigger if exists audit_patients_changes on public.patients;
create trigger audit_patients_changes
after insert or update or delete on public.patients
for each row execute function public.write_audit_log();

drop trigger if exists audit_appointments_changes on public.appointments;
create trigger audit_appointments_changes
after insert or update or delete on public.appointments
for each row execute function public.write_audit_log();

drop trigger if exists audit_consultations_changes on public.consultations;
create trigger audit_consultations_changes
after insert or update or delete on public.consultations
for each row execute function public.write_audit_log();

drop trigger if exists audit_medical_reports_changes on public.medical_reports;
create trigger audit_medical_reports_changes
after insert or update or delete on public.medical_reports
for each row execute function public.write_audit_log();

drop trigger if exists audit_certificates_changes on public.certificates;
create trigger audit_certificates_changes
after insert or update or delete on public.certificates
for each row execute function public.write_audit_log();

drop trigger if exists audit_referrals_changes on public.referrals;
create trigger audit_referrals_changes
after insert or update or delete on public.referrals
for each row execute function public.write_audit_log();

drop trigger if exists audit_precheck_forms_changes on public.precheck_forms;
create trigger audit_precheck_forms_changes
after insert or update or delete on public.precheck_forms
for each row execute function public.write_audit_log();

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
  v_initials text;
begin
  v_first_name := coalesce(new.raw_user_meta_data ->> 'first_name', split_part(new.email, '@', 1));
  v_last_name := coalesce(new.raw_user_meta_data ->> 'last_name', '');
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
    new.email,
    nullif(v_first_name, ''),
    nullif(v_last_name, ''),
    'patient',
    nullif(v_initials, ''),
    true
  )
  on conflict (email) do update
    set auth_user_id = excluded.auth_user_id,
        first_name = coalesce(public.users.first_name, excluded.first_name),
        last_name = coalesce(public.users.last_name, excluded.last_name),
        initials = coalesce(public.users.initials, excluded.initials),
        is_active = true,
        updated_at = now()
  returning id into v_user_id;

  insert into public.patients (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_auth_user_created();

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
  v_initials text;
begin
  v_initials := upper(left(coalesce(trim(p_first_name), ''), 1) || left(coalesce(trim(p_last_name), ''), 1));

  update public.users
  set first_name = nullif(trim(p_first_name), ''),
      last_name = nullif(trim(p_last_name), ''),
      phone = nullif(trim(p_phone), ''),
      initials = nullif(v_initials, ''),
      updated_at = now()
  where id = p_user_id;

  update public.patients
  set date_of_birth = nullif(trim(p_date_of_birth), '')::date,
      sex = nullif(trim(p_sex), ''),
      blood_type = nullif(trim(p_blood_type), ''),
      allergies = nullif(trim(p_allergies), ''),
      insurance_id = nullif(trim(p_insurance_id), ''),
      emergency_contact = nullif(trim(p_emergency_contact), ''),
      emergency_phone = nullif(trim(p_emergency_phone), ''),
      medical_history = nullif(trim(p_medical_history), ''),
      updated_at = now()
  where id = p_patient_id
    and user_id = p_user_id;

  return query
  select p_user_id, p_patient_id;
end;
$$;

create view public.doctor_dashboard_summary
with (security_invoker = true)
as
select
  (select count(*) from public.patients where coalesce(is_archived, false) = false) as total_patients,
  (
    select count(*)
    from public.appointments
    where status in ('scheduled', 'confirmed', 'pre_check', 'in_consultation')
      and scheduled_at > now()
  ) as upcoming_appointments,
  (
    select count(*)
    from public.consultations
    where status = 'completed'
      and coalesce(is_archived, false) = false
  ) as completed_consultations,
  (
    select count(*)
    from public.appointments
    where status in ('scheduled', 'confirmed', 'pre_check', 'in_consultation')
      and scheduled_at < now()
  ) as overdue_appointments;

create view public.doctor_patients
with (security_invoker = true)
as
select
  p.id,
  u.first_name,
  u.last_name,
  u.email,
  u.phone,
  u.initials,
  p.sex,
  p.blood_type,
  p.date_of_birth,
  max(a.scheduled_at) as last_visit,
  count(distinct a.id) as total_visits
from public.patients as p
join public.users as u
  on p.user_id = u.id
join public.appointments as a
  on p.id = a.patient_id
where coalesce(p.is_archived, false) = false
group by p.id, u.id, u.first_name, u.last_name, u.email, u.phone, u.initials, p.sex, p.blood_type, p.date_of_birth;

create view public.upcoming_appointments
with (security_invoker = true)
as
select
  a.id,
  a.scheduled_at,
  a.duration_minutes,
  a.status,
  u_patient.first_name as patient_name,
  u_patient.email as patient_email,
  u_patient.phone as patient_phone,
  u_doctor.first_name as doctor_name,
  u_doctor.last_name as doctor_last_name,
  doc.department,
  doc.specialization
from public.appointments as a
join public.doctors as doc
  on a.doctor_id = doc.id
join public.patients as p
  on a.patient_id = p.id
join public.users as u_doctor
  on doc.user_id = u_doctor.id
join public.users as u_patient
  on p.user_id = u_patient.id
where a.scheduled_at > now()
  and a.status in ('scheduled', 'confirmed', 'pre_check', 'in_consultation')
order by a.scheduled_at;

create or replace function public.book_slot(
  p_slot uuid,
  p_patient uuid,
  p_booked_by uuid,
  p_status text default 'scheduled'
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_active boolean;
  v_doctor_id uuid;
begin
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
    slot_id,
    patient_id,
    doctor_id,
    booked_by,
    status,
    scheduled_at
  )
  select
    s.id,
    p_patient,
    v_doctor_id,
    p_booked_by,
    p_status,
    ((s.date::timestamp + s.start_time) at time zone 'Asia/Beirut')
  from public.secretary_slots as s
  where s.id = p_slot;

  update public.secretary_slots
  set is_active = false
  where id = p_slot;
end;
$$;

drop function if exists public.get_available_slots(uuid, date);

create or replace function public.get_available_slots(p_doctor uuid, p_date date)
returns table (
  id uuid,
  clinic_id uuid,
  slot_date date,
  start_time time without time zone,
  end_time time without time zone,
  is_active boolean,
  clinic_name text,
  clinic_address text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    s.id,
    s.clinic_id,
    s.date as slot_date,
    s.start_time,
    s.end_time,
    s.is_active,
    c.name as clinic_name,
    c.address as clinic_address
  from public.secretary_slots as s
  left join public.clinics as c
    on s.clinic_id = c.id
  where s.doctor_id = p_doctor
    and s.date = p_date
    and s.is_active = true
  order by s.start_time;
$$;

create or replace function public.cancel_appointment(appointment_id uuid, cancellation_reason text default null)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_notes text;
begin
  select notes
  into v_notes
  from public.appointments
  where id = appointment_id
  for update;

  update public.appointments
  set status = 'cancelled',
      notes = concat_ws(E'\n\n', nullif(v_notes, ''), nullif(cancellation_reason, ''))
  where id = appointment_id;

  insert into public.notifications (user_id, title, message, type)
  select p.user_id,
         'Appointment Cancelled',
         coalesce(cancellation_reason, 'Your appointment has been cancelled.'),
         'appointment_cancelled'
  from public.appointments as a
  join public.patients as p
    on a.patient_id = p.id
  where a.id = appointment_id;

  return true;
end;
$$;

create or replace function public.get_next_appointment(patient_id uuid)
returns table(id uuid, doctor_name text, scheduled_at timestamptz, department character varying)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    a.id,
    concat(u.first_name, ' ', u.last_name),
    a.scheduled_at,
    doc.department
  from public.appointments as a
  join public.doctors as doc
    on a.doctor_id = doc.id
  join public.users as u
    on doc.user_id = u.id
  where a.patient_id = patient_id
    and a.scheduled_at > now()
    and a.status in ('scheduled', 'confirmed', 'pre_check', 'in_consultation')
  order by a.scheduled_at asc
  limit 1;
$$;

create or replace function public.get_user_full_name(user_id uuid)
returns text
language sql
security definer
set search_path = public, pg_temp
as $$
  select concat(first_name, ' ', last_name)
  from public.users
  where id = user_id;
$$;

create or replace function public.get_doctor_info(doctor_user_id uuid)
returns table(
  doctor_id uuid,
  user_id uuid,
  full_name text,
  email character varying,
  department character varying,
  specialization character varying,
  license_number character varying
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    d.id,
    u.id,
    concat(u.first_name, ' ', u.last_name),
    u.email,
    d.department,
    d.specialization,
    d.license_number
  from public.doctors as d
  join public.users as u
    on d.user_id = u.id
  where u.id = doctor_user_id;
$$;

revoke execute on function public.book_slot(uuid, uuid, uuid, text) from public, anon;
revoke execute on function public.get_available_slots(uuid, date) from public, anon;
grant execute on function public.book_slot(uuid, uuid, uuid, text) to authenticated, service_role;
grant execute on function public.get_available_slots(uuid, date) to authenticated, service_role;

commit;
