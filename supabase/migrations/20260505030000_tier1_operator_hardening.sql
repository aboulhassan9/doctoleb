begin;

-- Booking is a domain operation, not a generic insert helper. The RPC owns
-- initial lifecycle values so direct REST/RPC callers cannot forge state.
create or replace function public.book_slot(
  p_slot uuid,
  p_patient uuid,
  p_booked_by uuid,
  p_status text default 'scheduled',
  p_reason text default null,
  p_duration_minutes integer default null
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
  v_appointment_id uuid;
  v_requested_status text := lower(replace(coalesce(nullif(trim(p_status), ''), 'scheduled'), '-', '_'));
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

  select s.id, s.is_active, s.doctor_id, s.date, s.start_time, s.end_time
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

  if v_caller_role not in ('secretary', 'admin', 'doctor', 'predoctor') then
    if not exists (
      select 1
      from public.patients as p
      where p.id = p_patient
        and p.user_id = v_caller_domain_id
    ) then
      raise exception 'Unauthorized: patient record does not belong to caller';
    end if;
  end if;

  v_duration_minutes := p_duration_minutes;
  if v_duration_minutes is null then
    v_duration_minutes := floor(extract(epoch from (v_slot.end_time - v_slot.start_time)) / 60)::integer;
  end if;

  if v_duration_minutes is null or v_duration_minutes < 5 or v_duration_minutes > 240 then
    raise exception 'Invalid appointment duration';
  end if;

  insert into public.appointments (
    slot_id,
    patient_id,
    doctor_id,
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

revoke execute on function public.book_slot(uuid, uuid, uuid, text, text, integer) from public;
revoke execute on function public.book_slot(uuid, uuid, uuid, text, text, integer) from anon;
grant execute on function public.book_slot(uuid, uuid, uuid, text, text, integer) to authenticated, service_role;

-- Audit rows can contain full PHI snapshots. Keep direct table access limited
-- to an admin/compliance boundary; expose future role-specific redacted views
-- instead of widening this table policy.
drop policy if exists audit_log_staff_select on public.audit_log;
drop policy if exists audit_log_admin_select on public.audit_log;
create policy audit_log_admin_select
on public.audit_log
for select
using (
  public.has_role(array['admin'])
);

-- Operational indexes for FK checks, scoped reads, and audit investigations.
create index if not exists idx_appointments_booked_by on public.appointments(booked_by);
create index if not exists idx_appointments_slot_id on public.appointments(slot_id);
create index if not exists idx_consultations_appointment_id on public.consultations(appointment_id);
create index if not exists idx_consultations_archived_by on public.consultations(archived_by);
create index if not exists idx_medical_reports_patient_id on public.medical_reports(patient_id);
create index if not exists idx_medical_reports_doctor_id on public.medical_reports(doctor_id);
create index if not exists idx_medical_reports_archived_by on public.medical_reports(archived_by);
create index if not exists idx_certificates_doctor_id on public.certificates(doctor_id);
create index if not exists idx_certificates_archived_by on public.certificates(archived_by);
create index if not exists idx_patients_archived_by on public.patients(archived_by);
create index if not exists idx_payments_appointment_id on public.payments(appointment_id);
create index if not exists idx_payments_doctor_id on public.payments(doctor_id);
create index if not exists idx_precheck_forms_predoctor_id on public.precheck_forms(predoctor_id);
create index if not exists idx_predoctors_supervisor_id on public.predoctors(supervisor_id);
create index if not exists idx_referrals_from_doctor_id on public.referrals(from_doctor_id);
create index if not exists idx_referrals_to_doctor_id on public.referrals(to_doctor_id);
create index if not exists idx_referrals_patient_id on public.referrals(patient_id);
create index if not exists idx_referrals_archived_by on public.referrals(archived_by);
create index if not exists idx_secretary_slots_created_by on public.secretary_slots(created_by);
create index if not exists idx_audit_log_actor_user_id on public.audit_log(actor_user_id);
create index if not exists idx_audit_log_table_record on public.audit_log(table_name, record_id);
create index if not exists idx_audit_log_created_at on public.audit_log(created_at desc);

commit;
