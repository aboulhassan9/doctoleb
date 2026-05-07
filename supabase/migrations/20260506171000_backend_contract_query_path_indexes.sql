-- Backend contract query-path indexes.
-- These indexes are intentionally narrow: they cover high-value FK paths used by
-- the service contracts for encounter timelines, messaging, and mobile delivery.
-- Do not add every advisor-reported FK index blindly; keep write cost modest.

-- Current encounter tabs and encounter timeline reads.
create index if not exists idx_prescriptions_encounter_id
  on public.prescriptions (encounter_id);

create index if not exists idx_lab_orders_encounter_id
  on public.lab_orders (encounter_id);

create index if not exists idx_imaging_orders_encounter_id
  on public.imaging_orders (encounter_id);

create index if not exists idx_diagnoses_encounter_id
  on public.diagnoses (encounter_id);

create index if not exists idx_clinical_notes_patient_id
  on public.clinical_notes (patient_id);

create index if not exists idx_clinical_notes_doctor_id
  on public.clinical_notes (doctor_id);

create index if not exists idx_clinical_documents_doctor_id
  on public.clinical_documents (doctor_id);

-- Care task filters from appointment/encounter views.
create index if not exists idx_care_tasks_encounter_id
  on public.care_tasks (encounter_id);

create index if not exists idx_care_tasks_appointment_id
  on public.care_tasks (appointment_id);

-- Messaging participant lookup for staff dashboards.
create index if not exists idx_conversation_participants_staff_active
  on public.conversation_participants (staff_member_id, is_active)
  where staff_member_id is not null;

-- Mobile notification delivery/device ownership lookups.
create index if not exists idx_notification_deliveries_device_id
  on public.notification_deliveries (device_id);

create index if not exists idx_patient_devices_user_active
  on public.patient_devices (user_id, is_active);

-- Schedule-by-location screens.
create index if not exists idx_doctor_schedule_templates_clinic_active
  on public.doctor_schedule_templates (clinic_id, is_active);
