-- ============================================================
-- TIER 0: Schema Alignment Migration
-- Aligns live DB columns with the frontend service/select contract.
-- Safe to apply once through Supabase migrations; ADD COLUMN clauses
-- are idempotent and the policy block guards duplicate creation.
-- ============================================================

-- 1. consultations: fields used by consultation views/services.
alter table public.consultations
  add column if not exists symptoms text,
  add column if not exists follow_up_date date;

-- 2. certificates: patient-facing medical certificate fields.
alter table public.certificates
  add column if not exists patient_id uuid references public.patients(id),
  add column if not exists content text,
  add column if not exists diagnosis text,
  add column if not exists treatment text,
  add column if not exists recommendations text,
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists status varchar default 'draft';

create index if not exists idx_certificates_patient_id
  on public.certificates(patient_id);

alter table public.certificates
  alter column certificate_type set default 'Medical Certificate';

-- 3. referrals: referral-letter clinical fields and external recipient support.
alter table public.referrals
  add column if not exists notes text,
  add column if not exists priority varchar default 'routine',
  add column if not exists clinical_findings text,
  add column if not exists treatment_plan text,
  add column if not exists ref_number varchar,
  add column if not exists to_doctor_name varchar;

alter table public.referrals
  alter column to_doctor_id drop not null;

-- 4. medical_reports: findings used by report queries/UI.
alter table public.medical_reports
  add column if not exists findings text;

-- 5. certificates RLS: patients can read certificates issued to them.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'certificates'
      and policyname = 'patients_read_own_certificates'
  ) then
    create policy "patients_read_own_certificates"
      on public.certificates
      for select
      using (
        patient_id in (
          select p.id
          from public.patients p
          join public.users u on p.user_id = u.id
          where u.auth_user_id = auth.uid()
        )
      );
  end if;
end $$;
