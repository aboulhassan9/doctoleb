-- Remove permissive prototype policies and transient columns created by the
-- original 20240626 scheduling migration. The durable policies are recreated by
-- the secure-v1 migrations, and `patients.created_by` only exists so that the
-- old prototype policy can parse during a fresh replay.

drop policy if exists "allow_select_all" on public.clinics;

drop policy if exists "secretary_insert_update_delete" on public.secretary_slots;
drop policy if exists "doctor_predoctor_select" on public.secretary_slots;
drop policy if exists "patient_select_active" on public.secretary_slots;

drop policy if exists "secretary_insert_appointment" on public.appointments;
drop policy if exists "doctor_predoctor_select_appointment" on public.appointments;
drop policy if exists "patient_select_own_appointment" on public.appointments;
drop policy if exists "patient_insert_own_appointment" on public.appointments;

drop policy if exists "secretary_insert_patient" on public.patients;
drop policy if exists "doctor_predoctor_select_patient" on public.patients;
drop policy if exists "patient_select_own" on public.patients;

alter table public.patients
  drop column if exists created_by;
