-- ============================================================
-- TIER 0 v2: Revert schema-expansion columns from the first
-- Tier 0 draft so the DB contract returns to the live-schema
-- source-of-truth model.
-- ============================================================

drop policy if exists "patients_read_own_certificates" on public.certificates;
drop index if exists public.idx_certificates_patient_id;

alter table public.consultations
  drop column if exists symptoms,
  drop column if exists follow_up_date;

alter table public.certificates
  alter column certificate_type drop default,
  drop column if exists patient_id,
  drop column if exists content,
  drop column if exists diagnosis,
  drop column if exists treatment,
  drop column if exists recommendations,
  drop column if exists start_date,
  drop column if exists end_date,
  drop column if exists status;

alter table public.referrals
  alter column to_doctor_id set not null,
  drop column if exists notes,
  drop column if exists priority,
  drop column if exists clinical_findings,
  drop column if exists treatment_plan,
  drop column if exists ref_number,
  drop column if exists to_doctor_name;

alter table public.medical_reports
  drop column if exists findings;
