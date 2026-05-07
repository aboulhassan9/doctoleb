-- Baseline bootstrap for tables that pre-date the tracked migration history.
--
-- Why this file exists:
-- - The live development tenant already had these tables before migrations were
--   committed.
-- - Later migrations assume their final-ish shape, so a fresh tenant replay
--   fails without this pre-history baseline.
-- - Legacy shells are included only so old migrations can replay and are later
--   removed by the legacy burn-down migration.
--
-- This migration is intentionally idempotent and should be a no-op against the
-- current live tenant.

create schema if not exists extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email varchar(255) not null unique,
  password_hash varchar(255) not null default 'legacy_supabase_auth',
  role varchar(50) not null,
  first_name varchar(255),
  last_name varchar(255),
  phone varchar(20),
  avatar_url text,
  initials varchar(5),
  is_active boolean default true,
  created_at timestamptz default current_timestamp,
  updated_at timestamptz default current_timestamp,
  auth_user_id uuid references auth.users(id) on delete set null,
  constraint users_role_check
    check (role in ('doctor', 'secretary', 'patient', 'predoctor', 'admin'))
);

create unique index if not exists users_auth_user_id_unique
  on public.users (auth_user_id)
  where auth_user_id is not null;

create index if not exists idx_users_email on public.users (email);
create index if not exists idx_users_role on public.users (role);

create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  department varchar(100),
  specialization varchar(100),
  license_number varchar(100) unique,
  bio text,
  availability json,
  consultation_fee numeric(10,2),
  created_at timestamptz default current_timestamp,
  updated_at timestamptz default current_timestamp
);

create index if not exists idx_doctors_user_id on public.doctors (user_id);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  date_of_birth date,
  sex varchar(20),
  blood_type varchar(10),
  allergies text,
  medical_history text,
  emergency_contact varchar(255),
  emergency_phone varchar(20),
  insurance_id varchar(100),
  created_by uuid references public.users(id),
  created_at timestamptz default current_timestamp,
  updated_at timestamptz default current_timestamp,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references public.users(id),
  intake_completed_at timestamptz,
  established_at timestamptz
);

create index if not exists idx_patients_user_id on public.patients (user_id);
create index if not exists idx_patients_archived_by on public.patients (archived_by);

create table if not exists public.clinics (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  address text not null,
  created_at timestamptz default now()
);

create table if not exists public.secretary_slots (
  id uuid primary key default uuid_generate_v4(),
  doctor_id uuid references public.doctors(id) on delete cascade,
  clinic_id uuid references public.clinics(id) on delete set null,
  date date not null,
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_by uuid not null references public.users(id),
  recurrence_group_id uuid,
  created_at timestamptz default now()
);

create index if not exists idx_secretary_slots_doctor_date
  on public.secretary_slots (doctor_id, date);
create index if not exists idx_secretary_slots_active
  on public.secretary_slots (is_active);
create index if not exists idx_secretary_slots_recurrence
  on public.secretary_slots (recurrence_group_id);
create index if not exists idx_secretary_slots_created_by
  on public.secretary_slots (created_by);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  scheduled_at timestamptz not null,
  duration_minutes integer default 30,
  status varchar(50) not null default 'scheduled',
  reason text,
  notes text,
  created_at timestamptz default current_timestamp,
  updated_at timestamptz default current_timestamp,
  slot_id uuid references public.secretary_slots(id) on delete set null,
  booked_by uuid references public.users(id) on delete set null,
  constraint appointments_status_check
    check (status in (
      'scheduled',
      'confirmed',
      'pre_check',
      'in_consultation',
      'completed',
      'cancelled',
      'no_show'
    ))
);

create index if not exists idx_appointments_doctor
  on public.appointments (doctor_id);
create index if not exists idx_appointments_patient
  on public.appointments (patient_id);
create index if not exists idx_appointments_status
  on public.appointments (status);
create index if not exists idx_appointments_slot_id
  on public.appointments (slot_id);
create index if not exists idx_appointments_booked_by
  on public.appointments (booked_by);

create table if not exists public.predoctors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  supervisor_id uuid references public.doctors(id) on delete set null,
  university varchar(255),
  year_of_study integer,
  status varchar(50) default 'pending',
  created_at timestamptz default current_timestamp,
  updated_at timestamptz default current_timestamp,
  constraint predoctors_status_check
    check (status in ('pending', 'approved', 'rejected', 'graduated'))
);

create index if not exists idx_predoctors_supervisor_id
  on public.predoctors (supervisor_id);

create table if not exists public.precheck_forms (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  predoctor_id uuid references public.predoctors(id) on delete set null,
  blood_pressure varchar(20),
  heart_rate integer,
  temperature numeric(5,2),
  weight numeric(8,2),
  height numeric(8,2),
  current_medications text,
  allergies text,
  symptoms text,
  status varchar(50) default 'draft',
  submitted_at timestamptz,
  created_at timestamptz default current_timestamp,
  updated_at timestamptz default current_timestamp,
  image_url text,
  is_urgent boolean default false,
  constraint precheck_forms_status_check
    check (status in ('draft', 'submitted', 'reviewed', 'completed'))
);

create index if not exists idx_precheck_patient
  on public.precheck_forms (patient_id);
create index if not exists idx_precheck_forms_predoctor_id
  on public.precheck_forms (predoctor_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  amount numeric(10,2) not null,
  currency varchar(10) default 'USD',
  status varchar(50) default 'pending',
  payment_method varchar(50),
  transaction_id varchar(255) unique,
  created_at timestamptz default current_timestamp,
  updated_at timestamptz default current_timestamp,
  constraint payments_status_check
    check (status in ('pending', 'completed', 'failed', 'refunded'))
);

create index if not exists idx_payments_patient
  on public.payments (patient_id);
create index if not exists idx_payments_doctor_id
  on public.payments (doctor_id);
create index if not exists idx_payments_appointment_id
  on public.payments (appointment_id);

-- Temporary legacy shells required by early migrations. They are deliberately
-- dropped by 20260506190000_legacy_compatibility_burndown.sql.
create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete cascade,
  doctor_id uuid references public.doctors(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  diagnosis text,
  treatment_plan text,
  notes text,
  medications jsonb default '[]'::jsonb,
  status varchar(50) default 'pending',
  session_start timestamptz,
  session_end timestamptz,
  created_at timestamptz default current_timestamp,
  updated_at timestamptz default current_timestamp,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references public.users(id),
  constraint consultations_status_check
    check (status in ('pending', 'in_progress', 'completed', 'cancelled'))
);

create table if not exists public.medical_reports (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete cascade,
  doctor_id uuid references public.doctors(id) on delete cascade,
  report_type varchar(100),
  title text,
  content text,
  file_url text,
  created_at timestamptz default current_timestamp,
  updated_at timestamptz default current_timestamp,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references public.users(id)
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid references public.doctors(id) on delete cascade,
  certificate_type varchar(100),
  title text,
  issuer text,
  issue_date date,
  expiry_date date,
  file_url text,
  created_at timestamptz default current_timestamp,
  updated_at timestamptz default current_timestamp,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references public.users(id)
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  from_doctor_id uuid not null references public.doctors(id) on delete cascade,
  to_doctor_id uuid not null references public.doctors(id) on delete cascade,
  reason text,
  status varchar(50) default 'pending',
  referred_at timestamptz default current_timestamp,
  created_at timestamptz default current_timestamp,
  updated_at timestamptz default current_timestamp,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references public.users(id),
  constraint referrals_status_check
    check (status in ('pending', 'accepted', 'in_progress', 'completed', 'rejected'))
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text,
  related_id uuid,
  related_type text,
  is_read boolean not null default false,
  created_at timestamptz default current_timestamp
);

create table if not exists public.clinic_settings (
  id uuid primary key default gen_random_uuid(),
  clinic_name text,
  doctor_id uuid references public.doctors(id) on delete set null,
  phone text,
  email text,
  address text,
  working_hours jsonb,
  created_at timestamptz default current_timestamp,
  updated_at timestamptz default current_timestamp
);

alter table public.users enable row level security;
alter table public.doctors enable row level security;
alter table public.patients enable row level security;
alter table public.clinics enable row level security;
alter table public.secretary_slots enable row level security;
alter table public.appointments enable row level security;
alter table public.predoctors enable row level security;
alter table public.precheck_forms enable row level security;
alter table public.payments enable row level security;
alter table public.consultations enable row level security;
alter table public.medical_reports enable row level security;
alter table public.certificates enable row level security;
alter table public.referrals enable row level security;
alter table public.notifications enable row level security;
alter table public.clinic_settings enable row level security;
