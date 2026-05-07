-- Drop legacy helper RPCs and old summary views that are no longer part of the
-- canonical doctor-branded Tier 2 model.
--
-- Canonical replacements:
-- - Doctor dashboards read services over appointments/encounters directly.
-- - Patient/doctor identity display is handled in services/selects/userDisplay.
-- - Patient next appointment is queried through appointmentService.

begin;

drop view if exists public.upcoming_appointments;
drop view if exists public.doctor_patients;
drop view if exists public.doctor_dashboard_summary;

drop function if exists public.get_user_full_name(uuid);
drop function if exists public.get_next_appointment(uuid);
drop function if exists public.get_doctor_info(uuid);

commit;
