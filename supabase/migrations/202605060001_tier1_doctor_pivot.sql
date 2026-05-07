begin;

-- Tier 1 doctor-branded practice pivot.
-- Schema only: catalogs, normalized intake history, staff, schedules, branding,
-- insurance, RLS, indexes, and triggers. Seed data is in the next migration.

create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  country text not null default 'Lebanon',
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, country)
);

create table if not exists public.blood_groups (
  id smallint primary key,
  code text not null unique,
  name text not null,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.occupations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.specialties (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vaccines (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  typical_doses smallint,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.diseases (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  icd10_code text,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists diseases_icd10_code_unique
  on public.diseases (icd10_code)
  where icd10_code is not null;

create table if not exists public.surgery_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  body_system text,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.family_relations (
  id smallint primary key,
  code text not null unique,
  name text not null,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.visit_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  default_duration_minutes integer not null default 30 check (default_duration_minutes between 5 and 240),
  default_fee numeric(10,2),
  requires_intake boolean not null default false,
  billable_service_id uuid references public.billable_services(id) on delete set null,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clinics
  add column if not exists location_type text not null default 'private_clinic'
    check (location_type in ('hospital', 'medical_group', 'private_clinic', 'other')),
  add column if not exists city_id uuid references public.cities(id) on delete restrict,
  add column if not exists phone text,
  add column if not exists working_hours jsonb,
  add column if not exists is_primary boolean not null default false,
  add column if not exists notes text,
  add column if not exists latitude numeric(10,7),
  add column if not exists longitude numeric(10,7),
  add column if not exists map_url text,
  add column if not exists floor text,
  add column if not exists room text;

alter table public.patients
  add column if not exists intake_completed_at timestamptz,
  add column if not exists established_at timestamptz;

alter table public.appointments
  add column if not exists clinic_id uuid references public.clinics(id) on delete restrict,
  add column if not exists visit_type_id uuid references public.visit_types(id) on delete restrict;

update public.appointments as a
set clinic_id = s.clinic_id
from public.secretary_slots as s
where a.slot_id = s.id
  and a.clinic_id is null
  and s.clinic_id is not null;

create table if not exists public.doctor_specialties (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete restrict,
  specialty_id uuid not null references public.specialties(id) on delete restrict,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (doctor_id, specialty_id)
);

create unique index if not exists doctor_specialties_one_primary_idx
  on public.doctor_specialties (doctor_id)
  where is_primary = true;

create table if not exists public.patient_vaccinations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  vaccine_id uuid not null references public.vaccines(id) on delete restrict,
  status text not null check (status in ('received', 'scheduled', 'overdue', 'declined', 'unknown')),
  given_at date,
  due_at date,
  dose_number smallint,
  lot_number text,
  administered_by text,
  notes text,
  recorded_by uuid references public.users(id),
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'received' and given_at is not null) or
    (status = 'scheduled' and due_at is not null and given_at is null) or
    (status in ('overdue', 'declined', 'unknown'))
  )
);

create table if not exists public.patient_surgeries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  surgery_type_id uuid not null references public.surgery_types(id) on delete restrict,
  performed_at date,
  hospital_name text,
  surgeon_name text,
  notes text,
  recorded_by uuid references public.users(id),
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.patient_diseases (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  disease_id uuid not null references public.diseases(id) on delete restrict,
  status text not null check (status in ('active', 'resolved', 'chronic', 'in_remission', 'suspected')),
  severity text check (severity in ('mild', 'moderate', 'severe') or severity is null),
  diagnosed_at date,
  notes text,
  recorded_by uuid references public.users(id),
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists patient_diseases_active_unique
  on public.patient_diseases (patient_id, disease_id)
  where is_archived = false;

create table if not exists public.patient_family_history (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  relation_id smallint not null references public.family_relations(id) on delete restrict,
  disease_id uuid references public.diseases(id) on delete restrict,
  condition_text text,
  age_at_onset smallint,
  is_deceased boolean not null default false,
  death_cause_disease_id uuid references public.diseases(id) on delete restrict,
  death_cause_text text,
  notes text,
  recorded_by uuid references public.users(id),
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (disease_id is not null or nullif(trim(condition_text), '') is not null)
);

create table if not exists public.medical_intake (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null unique references public.patients(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'completed', 'reopened')),
  collected_by uuid references public.users(id),
  completed_by uuid references public.users(id),
  completed_at timestamptz,
  reopened_by uuid references public.users(id),
  reopened_at timestamptz,
  reopen_reason text,
  occupation_id uuid references public.occupations(id) on delete restrict,
  occupation_other text,
  blood_group_id smallint references public.blood_groups(id) on delete restrict,
  marital_status text check (marital_status in ('single', 'married', 'divorced', 'widowed', 'other') or marital_status is null),
  living_with text,
  smoking_status text check (smoking_status in ('never', 'former', 'current_light', 'current_heavy', 'unknown') or smoking_status is null),
  alcohol_use text check (alcohol_use in ('none', 'occasional', 'moderate', 'heavy') or alcohol_use is null),
  exercise_frequency text check (exercise_frequency in ('none', 'rare', 'weekly', 'daily') or exercise_frequency is null),
  allergies_text text,
  current_medications_text text,
  notes text,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'completed' and completed_at is not null and completed_by is not null) or status <> 'completed'),
  check ((status = 'reopened' and reopened_at is not null and reopened_by is not null) or status <> 'reopened')
);

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.users(id) on delete restrict,
  doctor_id uuid not null references public.doctors(id) on delete restrict,
  role text not null check (role in ('secretary', 'predoctor', 'nurse', 'assistant', 'junior_doctor')),
  display_name text not null,
  phone text,
  email text,
  invite_status text not null default 'none' check (invite_status in ('none', 'invited', 'accepted', 'disabled')),
  reports_to uuid references public.staff_members(id) on delete restrict,
  hire_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.doctor_schedule_templates (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete restrict,
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  slot_duration_minutes integer not null default 30 check (slot_duration_minutes between 5 and 240),
  is_active boolean not null default true,
  effective_from date,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (doctor_id, clinic_id, weekday, start_time)
);

alter table public.secretary_slots
  add column if not exists schedule_template_id uuid references public.doctor_schedule_templates(id) on delete set null;

create table if not exists public.insurance_providers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  phone text,
  email text,
  website_url text,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.claim_form_templates (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.insurance_providers(id) on delete restrict,
  name text not null,
  description text,
  template_format text not null check (template_format in ('html', 'handlebars')),
  template_body text not null,
  preview_image_url text,
  is_active boolean not null default true,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists claim_form_templates_provider_name_unique
  on public.claim_form_templates (provider_id, name)
  where provider_id is not null;

create unique index if not exists claim_form_templates_generic_name_unique
  on public.claim_form_templates (name)
  where provider_id is null;

create table if not exists public.doctor_insurance_contracts (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete restrict,
  provider_id uuid not null references public.insurance_providers(id) on delete restrict,
  doctor_provider_code text,
  contract_number text,
  valid_from date,
  valid_to date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (doctor_id, provider_id)
);

create table if not exists public.patient_insurance_policies (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  provider_id uuid not null references public.insurance_providers(id) on delete restrict,
  policy_number text not null,
  policyholder_name text,
  valid_from date,
  valid_to date,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, provider_id, policy_number)
);

create unique index if not exists patient_insurance_policies_one_primary_idx
  on public.patient_insurance_policies (patient_id)
  where is_primary = true;

create table if not exists public.insurance_claims (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid references public.consultations(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict,
  doctor_id uuid not null references public.doctors(id) on delete restrict,
  policy_id uuid not null references public.patient_insurance_policies(id) on delete restrict,
  template_id uuid references public.claim_form_templates(id) on delete restrict,
  amount numeric(10,2) not null check (amount >= 0),
  amount_paid_by_insurer numeric(10,2) check (amount_paid_by_insurer is null or amount_paid_by_insurer >= 0),
  amount_paid_by_patient numeric(10,2) check (amount_paid_by_patient is null or amount_paid_by_patient >= 0),
  diagnosis_code text,
  claim_form_pdf_url text,
  status text not null default 'draft' check (status in ('draft', 'printed', 'submitted', 'paid', 'rejected')),
  printed_at timestamptz,
  submitted_at timestamptz,
  paid_at timestamptz,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.doctor_brand (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null unique references public.doctors(id) on delete restrict,
  display_name text not null,
  tagline text,
  logo_url text,
  favicon_url text,
  primary_color text check (primary_color ~ '^#[0-9A-Fa-f]{6}$' or primary_color is null),
  secondary_color text check (secondary_color ~ '^#[0-9A-Fa-f]{6}$' or secondary_color is null),
  custom_domain text,
  contact_phone text,
  contact_email text,
  website_url text,
  about_md text,
  languages text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.prevent_system_catalog_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and coalesce(old.is_system, false) then
    raise exception 'System catalog rows cannot be updated';
  end if;

  if tg_op = 'DELETE' and coalesce(old.is_system, false) then
    raise exception 'System catalog rows cannot be deleted';
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.normalize_medical_intake_workflow()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'completed'
     and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    new.completed_at := coalesce(new.completed_at, now());
    new.completed_by := coalesce(new.completed_by, public.current_domain_user_id());
  end if;

  if new.status = 'reopened'
     and (tg_op = 'INSERT' or old.status is distinct from 'reopened') then
    if not public.has_role(array['admin']) then
      raise exception 'Only an admin can reopen completed medical intake';
    end if;

    new.reopened_at := coalesce(new.reopened_at, now());
    new.reopened_by := coalesce(new.reopened_by, public.current_domain_user_id());
    new.completed_at := null;
  end if;

  return new;
end;
$$;

create or replace function public.propagate_medical_intake_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'completed'
     and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    update public.patients
    set intake_completed_at = new.completed_at,
        established_at = coalesce(established_at, now()),
        updated_at = now()
    where id = new.patient_id;
  elsif new.status = 'reopened'
     and (tg_op = 'INSERT' or old.status is distinct from 'reopened') then
    update public.patients
    set intake_completed_at = null,
        updated_at = now()
    where id = new.patient_id;
  end if;

  return new;
end;
$$;

create or replace function public.get_public_doctor_brand()
returns table (
  id uuid,
  doctor_id uuid,
  display_name text,
  tagline text,
  logo_url text,
  favicon_url text,
  primary_color text,
  secondary_color text,
  custom_domain text,
  contact_phone text,
  contact_email text,
  website_url text,
  about_md text,
  languages text[]
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    b.id,
    b.doctor_id,
    b.display_name,
    b.tagline,
    b.logo_url,
    b.favicon_url,
    b.primary_color,
    b.secondary_color,
    b.custom_domain,
    b.contact_phone,
    b.contact_email,
    b.website_url,
    b.about_md,
    b.languages
  from public.doctor_brand as b
  order by b.created_at asc
  limit 1;
$$;

revoke execute on function public.get_public_doctor_brand() from public;
grant execute on function public.get_public_doctor_brand() to anon, authenticated, service_role;

do $$
declare
  catalog_table text;
begin
  foreach catalog_table in array array[
    'cities',
    'blood_groups',
    'occupations',
    'specialties',
    'vaccines',
    'diseases',
    'surgery_types',
    'family_relations',
    'visit_types',
    'insurance_providers',
    'claim_form_templates'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', 'prevent_' || catalog_table || '_system_mutation', catalog_table);
    execute format(
      'create trigger %I before update or delete on public.%I for each row execute function public.prevent_system_catalog_mutation()',
      'prevent_' || catalog_table || '_system_mutation',
      catalog_table
    );
  end loop;
end
$$;

drop trigger if exists normalize_medical_intake_workflow on public.medical_intake;
create trigger normalize_medical_intake_workflow
before insert or update on public.medical_intake
for each row execute function public.normalize_medical_intake_workflow();

drop trigger if exists propagate_medical_intake_status on public.medical_intake;
create trigger propagate_medical_intake_status
after insert or update on public.medical_intake
for each row execute function public.propagate_medical_intake_status();

drop trigger if exists audit_patient_vaccinations_changes on public.patient_vaccinations;
create trigger audit_patient_vaccinations_changes
after insert or update or delete on public.patient_vaccinations
for each row execute function public.write_audit_log();

drop trigger if exists audit_patient_surgeries_changes on public.patient_surgeries;
create trigger audit_patient_surgeries_changes
after insert or update or delete on public.patient_surgeries
for each row execute function public.write_audit_log();

drop trigger if exists audit_patient_diseases_changes on public.patient_diseases;
create trigger audit_patient_diseases_changes
after insert or update or delete on public.patient_diseases
for each row execute function public.write_audit_log();

drop trigger if exists audit_patient_family_history_changes on public.patient_family_history;
create trigger audit_patient_family_history_changes
after insert or update or delete on public.patient_family_history
for each row execute function public.write_audit_log();

drop trigger if exists audit_medical_intake_changes on public.medical_intake;
create trigger audit_medical_intake_changes
after insert or update or delete on public.medical_intake
for each row execute function public.write_audit_log();

drop trigger if exists audit_patient_insurance_policies_changes on public.patient_insurance_policies;
create trigger audit_patient_insurance_policies_changes
after insert or update or delete on public.patient_insurance_policies
for each row execute function public.write_audit_log();

drop trigger if exists audit_insurance_claims_changes on public.insurance_claims;
create trigger audit_insurance_claims_changes
after insert or update or delete on public.insurance_claims
for each row execute function public.write_audit_log();

alter table public.cities enable row level security;
alter table public.blood_groups enable row level security;
alter table public.occupations enable row level security;
alter table public.specialties enable row level security;
alter table public.vaccines enable row level security;
alter table public.diseases enable row level security;
alter table public.surgery_types enable row level security;
alter table public.family_relations enable row level security;
alter table public.visit_types enable row level security;
alter table public.doctor_specialties enable row level security;
alter table public.patient_vaccinations enable row level security;
alter table public.patient_surgeries enable row level security;
alter table public.patient_diseases enable row level security;
alter table public.patient_family_history enable row level security;
alter table public.medical_intake enable row level security;
alter table public.staff_members enable row level security;
alter table public.doctor_schedule_templates enable row level security;
alter table public.insurance_providers enable row level security;
alter table public.claim_form_templates enable row level security;
alter table public.doctor_insurance_contracts enable row level security;
alter table public.patient_insurance_policies enable row level security;
alter table public.insurance_claims enable row level security;
alter table public.doctor_brand enable row level security;

drop policy if exists catalog_authenticated_select on public.cities;
create policy catalog_authenticated_select on public.cities
for select using ((select auth.role()) = 'authenticated');
drop policy if exists catalog_ops_write on public.cities;
create policy catalog_ops_write on public.cities
for insert with check ((select public.has_role(array['secretary', 'admin'])));
drop policy if exists catalog_ops_update on public.cities;
create policy catalog_ops_update on public.cities
for update using ((select public.has_role(array['secretary', 'admin'])))
with check ((select public.has_role(array['secretary', 'admin'])));
drop policy if exists catalog_admin_delete on public.cities;
create policy catalog_admin_delete on public.cities
for delete using ((select public.has_role(array['admin'])));

drop policy if exists catalog_authenticated_select on public.occupations;
create policy catalog_authenticated_select on public.occupations
for select using ((select auth.role()) = 'authenticated');
drop policy if exists catalog_ops_write on public.occupations;
create policy catalog_ops_write on public.occupations
for insert with check ((select public.has_role(array['secretary', 'admin'])));
drop policy if exists catalog_ops_update on public.occupations;
create policy catalog_ops_update on public.occupations
for update using ((select public.has_role(array['secretary', 'admin'])))
with check ((select public.has_role(array['secretary', 'admin'])));
drop policy if exists catalog_admin_delete on public.occupations;
create policy catalog_admin_delete on public.occupations
for delete using ((select public.has_role(array['admin'])));

drop policy if exists catalog_authenticated_select on public.insurance_providers;
create policy catalog_authenticated_select on public.insurance_providers
for select using ((select auth.role()) = 'authenticated');
drop policy if exists catalog_ops_write on public.insurance_providers;
create policy catalog_ops_write on public.insurance_providers
for insert with check ((select public.has_role(array['secretary', 'admin'])));
drop policy if exists catalog_ops_update on public.insurance_providers;
create policy catalog_ops_update on public.insurance_providers
for update using ((select public.has_role(array['secretary', 'admin'])))
with check ((select public.has_role(array['secretary', 'admin'])));
drop policy if exists catalog_admin_delete on public.insurance_providers;
create policy catalog_admin_delete on public.insurance_providers
for delete using ((select public.has_role(array['admin'])));

drop policy if exists catalog_authenticated_select on public.claim_form_templates;
create policy catalog_authenticated_select on public.claim_form_templates
for select using ((select auth.role()) = 'authenticated');
drop policy if exists catalog_ops_write on public.claim_form_templates;
create policy catalog_ops_write on public.claim_form_templates
for insert with check ((select public.has_role(array['secretary', 'admin'])));
drop policy if exists catalog_ops_update on public.claim_form_templates;
create policy catalog_ops_update on public.claim_form_templates
for update using ((select public.has_role(array['secretary', 'admin'])))
with check ((select public.has_role(array['secretary', 'admin'])));
drop policy if exists catalog_admin_delete on public.claim_form_templates;
create policy catalog_admin_delete on public.claim_form_templates
for delete using ((select public.has_role(array['admin'])));

drop policy if exists static_catalog_authenticated_select on public.blood_groups;
create policy static_catalog_authenticated_select on public.blood_groups
for select using ((select auth.role()) = 'authenticated');
drop policy if exists static_catalog_authenticated_select on public.family_relations;
create policy static_catalog_authenticated_select on public.family_relations
for select using ((select auth.role()) = 'authenticated');

drop policy if exists clinical_catalog_authenticated_select on public.specialties;
create policy clinical_catalog_authenticated_select on public.specialties
for select using ((select auth.role()) = 'authenticated');
drop policy if exists clinical_catalog_write on public.specialties;
create policy clinical_catalog_write on public.specialties
for insert with check ((select public.has_role(array['doctor', 'admin'])));
drop policy if exists clinical_catalog_update on public.specialties;
create policy clinical_catalog_update on public.specialties
for update using ((select public.has_role(array['doctor', 'admin'])))
with check ((select public.has_role(array['doctor', 'admin'])));
drop policy if exists clinical_catalog_admin_delete on public.specialties;
create policy clinical_catalog_admin_delete on public.specialties
for delete using ((select public.has_role(array['admin'])));

drop policy if exists clinical_catalog_authenticated_select on public.vaccines;
create policy clinical_catalog_authenticated_select on public.vaccines
for select using ((select auth.role()) = 'authenticated');
drop policy if exists clinical_catalog_write on public.vaccines;
create policy clinical_catalog_write on public.vaccines
for insert with check ((select public.has_role(array['doctor', 'admin'])));
drop policy if exists clinical_catalog_update on public.vaccines;
create policy clinical_catalog_update on public.vaccines
for update using ((select public.has_role(array['doctor', 'admin'])))
with check ((select public.has_role(array['doctor', 'admin'])));
drop policy if exists clinical_catalog_admin_delete on public.vaccines;
create policy clinical_catalog_admin_delete on public.vaccines
for delete using ((select public.has_role(array['admin'])));

drop policy if exists clinical_catalog_authenticated_select on public.diseases;
create policy clinical_catalog_authenticated_select on public.diseases
for select using ((select auth.role()) = 'authenticated');
drop policy if exists clinical_catalog_write on public.diseases;
create policy clinical_catalog_write on public.diseases
for insert with check ((select public.has_role(array['doctor', 'admin'])));
drop policy if exists clinical_catalog_update on public.diseases;
create policy clinical_catalog_update on public.diseases
for update using ((select public.has_role(array['doctor', 'admin'])))
with check ((select public.has_role(array['doctor', 'admin'])));
drop policy if exists clinical_catalog_admin_delete on public.diseases;
create policy clinical_catalog_admin_delete on public.diseases
for delete using ((select public.has_role(array['admin'])));

drop policy if exists clinical_catalog_authenticated_select on public.surgery_types;
create policy clinical_catalog_authenticated_select on public.surgery_types
for select using ((select auth.role()) = 'authenticated');
drop policy if exists clinical_catalog_write on public.surgery_types;
create policy clinical_catalog_write on public.surgery_types
for insert with check ((select public.has_role(array['doctor', 'admin'])));
drop policy if exists clinical_catalog_update on public.surgery_types;
create policy clinical_catalog_update on public.surgery_types
for update using ((select public.has_role(array['doctor', 'admin'])))
with check ((select public.has_role(array['doctor', 'admin'])));
drop policy if exists clinical_catalog_admin_delete on public.surgery_types;
create policy clinical_catalog_admin_delete on public.surgery_types
for delete using ((select public.has_role(array['admin'])));

drop policy if exists clinical_catalog_authenticated_select on public.visit_types;
create policy clinical_catalog_authenticated_select on public.visit_types
for select using ((select auth.role()) = 'authenticated');
drop policy if exists clinical_catalog_write on public.visit_types;
create policy clinical_catalog_write on public.visit_types
for insert with check ((select public.has_role(array['doctor', 'admin'])));
drop policy if exists clinical_catalog_update on public.visit_types;
create policy clinical_catalog_update on public.visit_types
for update using ((select public.has_role(array['doctor', 'admin'])))
with check ((select public.has_role(array['doctor', 'admin'])));
drop policy if exists clinical_catalog_admin_delete on public.visit_types;
create policy clinical_catalog_admin_delete on public.visit_types
for delete using ((select public.has_role(array['admin'])));

drop policy if exists doctor_specialties_authenticated_select on public.doctor_specialties;
create policy doctor_specialties_authenticated_select on public.doctor_specialties
for select using ((select auth.role()) = 'authenticated');
drop policy if exists doctor_specialties_doctor_write on public.doctor_specialties;
create policy doctor_specialties_doctor_write on public.doctor_specialties
for insert with check ((select public.has_role(array['doctor', 'admin'])));
drop policy if exists doctor_specialties_doctor_update on public.doctor_specialties;
create policy doctor_specialties_doctor_update on public.doctor_specialties
for update using ((select public.has_role(array['doctor', 'admin'])))
with check ((select public.has_role(array['doctor', 'admin'])));
drop policy if exists doctor_specialties_admin_delete on public.doctor_specialties;
create policy doctor_specialties_admin_delete on public.doctor_specialties
for delete using ((select public.has_role(array['admin'])));

drop policy if exists doctor_insurance_contracts_authenticated_select on public.doctor_insurance_contracts;
create policy doctor_insurance_contracts_authenticated_select on public.doctor_insurance_contracts
for select using ((select auth.role()) = 'authenticated');
drop policy if exists doctor_insurance_contracts_staff_write on public.doctor_insurance_contracts;
create policy doctor_insurance_contracts_staff_write on public.doctor_insurance_contracts
for insert with check ((select public.has_role(array['secretary', 'admin'])));
drop policy if exists doctor_insurance_contracts_staff_update on public.doctor_insurance_contracts;
create policy doctor_insurance_contracts_staff_update on public.doctor_insurance_contracts
for update using ((select public.has_role(array['secretary', 'admin'])))
with check ((select public.has_role(array['secretary', 'admin'])));
drop policy if exists doctor_insurance_contracts_admin_delete on public.doctor_insurance_contracts;
create policy doctor_insurance_contracts_admin_delete on public.doctor_insurance_contracts
for delete using ((select public.has_role(array['admin'])));

drop policy if exists patient_vaccinations_scoped_select on public.patient_vaccinations;
create policy patient_vaccinations_scoped_select on public.patient_vaccinations
for select using (
  (select public.is_staff())
  or patient_id in (select p.id from public.patients as p where p.user_id = (select public.current_domain_user_id()))
);
drop policy if exists patient_vaccinations_staff_insert on public.patient_vaccinations;
create policy patient_vaccinations_staff_insert on public.patient_vaccinations
for insert with check ((select public.has_role(array['doctor', 'predoctor', 'secretary', 'admin'])));
drop policy if exists patient_vaccinations_staff_update on public.patient_vaccinations;
create policy patient_vaccinations_staff_update on public.patient_vaccinations
for update using ((select public.has_role(array['doctor', 'predoctor', 'secretary', 'admin'])))
with check ((select public.has_role(array['doctor', 'predoctor', 'secretary', 'admin'])));
drop policy if exists patient_vaccinations_admin_delete on public.patient_vaccinations;
create policy patient_vaccinations_admin_delete on public.patient_vaccinations
for delete using ((select public.has_role(array['admin'])));

drop policy if exists patient_surgeries_scoped_select on public.patient_surgeries;
create policy patient_surgeries_scoped_select on public.patient_surgeries
for select using (
  (select public.is_staff())
  or patient_id in (select p.id from public.patients as p where p.user_id = (select public.current_domain_user_id()))
);
drop policy if exists patient_surgeries_staff_insert on public.patient_surgeries;
create policy patient_surgeries_staff_insert on public.patient_surgeries
for insert with check ((select public.has_role(array['doctor', 'predoctor', 'secretary', 'admin'])));
drop policy if exists patient_surgeries_staff_update on public.patient_surgeries;
create policy patient_surgeries_staff_update on public.patient_surgeries
for update using ((select public.has_role(array['doctor', 'predoctor', 'secretary', 'admin'])))
with check ((select public.has_role(array['doctor', 'predoctor', 'secretary', 'admin'])));
drop policy if exists patient_surgeries_admin_delete on public.patient_surgeries;
create policy patient_surgeries_admin_delete on public.patient_surgeries
for delete using ((select public.has_role(array['admin'])));

drop policy if exists patient_diseases_scoped_select on public.patient_diseases;
create policy patient_diseases_scoped_select on public.patient_diseases
for select using (
  (select public.is_staff())
  or patient_id in (select p.id from public.patients as p where p.user_id = (select public.current_domain_user_id()))
);
drop policy if exists patient_diseases_staff_insert on public.patient_diseases;
create policy patient_diseases_staff_insert on public.patient_diseases
for insert with check ((select public.has_role(array['doctor', 'predoctor', 'secretary', 'admin'])));
drop policy if exists patient_diseases_staff_update on public.patient_diseases;
create policy patient_diseases_staff_update on public.patient_diseases
for update using ((select public.has_role(array['doctor', 'predoctor', 'secretary', 'admin'])))
with check ((select public.has_role(array['doctor', 'predoctor', 'secretary', 'admin'])));
drop policy if exists patient_diseases_admin_delete on public.patient_diseases;
create policy patient_diseases_admin_delete on public.patient_diseases
for delete using ((select public.has_role(array['admin'])));

drop policy if exists patient_family_history_scoped_select on public.patient_family_history;
create policy patient_family_history_scoped_select on public.patient_family_history
for select using (
  (select public.is_staff())
  or patient_id in (select p.id from public.patients as p where p.user_id = (select public.current_domain_user_id()))
);
drop policy if exists patient_family_history_staff_insert on public.patient_family_history;
create policy patient_family_history_staff_insert on public.patient_family_history
for insert with check ((select public.has_role(array['doctor', 'predoctor', 'secretary', 'admin'])));
drop policy if exists patient_family_history_staff_update on public.patient_family_history;
create policy patient_family_history_staff_update on public.patient_family_history
for update using ((select public.has_role(array['doctor', 'predoctor', 'secretary', 'admin'])))
with check ((select public.has_role(array['doctor', 'predoctor', 'secretary', 'admin'])));
drop policy if exists patient_family_history_admin_delete on public.patient_family_history;
create policy patient_family_history_admin_delete on public.patient_family_history
for delete using ((select public.has_role(array['admin'])));

drop policy if exists medical_intake_scoped_select on public.medical_intake;
create policy medical_intake_scoped_select on public.medical_intake
for select using (
  (select public.is_staff())
  or patient_id in (select p.id from public.patients as p where p.user_id = (select public.current_domain_user_id()))
);
drop policy if exists medical_intake_staff_insert on public.medical_intake;
create policy medical_intake_staff_insert on public.medical_intake
for insert with check ((select public.has_role(array['secretary', 'predoctor', 'admin'])));
drop policy if exists medical_intake_staff_update on public.medical_intake;
create policy medical_intake_staff_update on public.medical_intake
for update using ((select public.has_role(array['secretary', 'predoctor', 'admin'])))
with check ((select public.has_role(array['secretary', 'predoctor', 'admin'])));
drop policy if exists medical_intake_admin_delete on public.medical_intake;
create policy medical_intake_admin_delete on public.medical_intake
for delete using ((select public.has_role(array['admin'])));

drop policy if exists staff_members_scoped_select on public.staff_members;
create policy staff_members_scoped_select on public.staff_members
for select using (
  (select public.has_role(array['doctor', 'admin']))
  or user_id = (select public.current_domain_user_id())
);
drop policy if exists staff_members_doctor_insert on public.staff_members;
create policy staff_members_doctor_insert on public.staff_members
for insert with check ((select public.has_role(array['doctor', 'admin'])));
drop policy if exists staff_members_doctor_update on public.staff_members;
create policy staff_members_doctor_update on public.staff_members
for update using ((select public.has_role(array['doctor', 'admin'])))
with check ((select public.has_role(array['doctor', 'admin'])));

drop policy if exists doctor_schedule_templates_authenticated_select on public.doctor_schedule_templates;
create policy doctor_schedule_templates_authenticated_select on public.doctor_schedule_templates
for select using ((select auth.role()) = 'authenticated');
drop policy if exists doctor_schedule_templates_staff_insert on public.doctor_schedule_templates;
create policy doctor_schedule_templates_staff_insert on public.doctor_schedule_templates
for insert with check ((select public.has_role(array['secretary', 'admin'])));
drop policy if exists doctor_schedule_templates_staff_update on public.doctor_schedule_templates;
create policy doctor_schedule_templates_staff_update on public.doctor_schedule_templates
for update using ((select public.has_role(array['secretary', 'admin'])))
with check ((select public.has_role(array['secretary', 'admin'])));
drop policy if exists doctor_schedule_templates_staff_delete on public.doctor_schedule_templates;
create policy doctor_schedule_templates_staff_delete on public.doctor_schedule_templates
for delete using ((select public.has_role(array['secretary', 'admin'])));

drop policy if exists patient_insurance_policies_scoped_select on public.patient_insurance_policies;
create policy patient_insurance_policies_scoped_select on public.patient_insurance_policies
for select using (
  (select public.is_staff())
  or patient_id in (select p.id from public.patients as p where p.user_id = (select public.current_domain_user_id()))
);
drop policy if exists patient_insurance_policies_staff_insert on public.patient_insurance_policies;
create policy patient_insurance_policies_staff_insert on public.patient_insurance_policies
for insert with check ((select public.has_role(array['secretary', 'admin'])));
drop policy if exists patient_insurance_policies_staff_update on public.patient_insurance_policies;
create policy patient_insurance_policies_staff_update on public.patient_insurance_policies
for update using ((select public.has_role(array['secretary', 'admin'])))
with check ((select public.has_role(array['secretary', 'admin'])));
drop policy if exists patient_insurance_policies_admin_delete on public.patient_insurance_policies;
create policy patient_insurance_policies_admin_delete on public.patient_insurance_policies
for delete using ((select public.has_role(array['admin'])));

drop policy if exists insurance_claims_scoped_select on public.insurance_claims;
create policy insurance_claims_scoped_select on public.insurance_claims
for select using (
  (select public.is_staff())
  or patient_id in (select p.id from public.patients as p where p.user_id = (select public.current_domain_user_id()))
);
drop policy if exists insurance_claims_staff_insert on public.insurance_claims;
create policy insurance_claims_staff_insert on public.insurance_claims
for insert with check ((select public.has_role(array['doctor', 'secretary', 'admin'])));
drop policy if exists insurance_claims_staff_update on public.insurance_claims;
create policy insurance_claims_staff_update on public.insurance_claims
for update using ((select public.has_role(array['doctor', 'secretary', 'admin'])))
with check ((select public.has_role(array['doctor', 'secretary', 'admin'])));
drop policy if exists insurance_claims_admin_delete on public.insurance_claims;
create policy insurance_claims_admin_delete on public.insurance_claims
for delete using ((select public.has_role(array['admin'])));

drop policy if exists doctor_brand_authenticated_select on public.doctor_brand;
create policy doctor_brand_authenticated_select on public.doctor_brand
for select using ((select auth.role()) = 'authenticated');
drop policy if exists doctor_brand_doctor_insert on public.doctor_brand;
create policy doctor_brand_doctor_insert on public.doctor_brand
for insert with check ((select public.has_role(array['doctor', 'admin'])));
drop policy if exists doctor_brand_doctor_update on public.doctor_brand;
create policy doctor_brand_doctor_update on public.doctor_brand
for update using ((select public.has_role(array['doctor', 'admin'])))
with check ((select public.has_role(array['doctor', 'admin'])));
drop policy if exists doctor_brand_admin_delete on public.doctor_brand;
create policy doctor_brand_admin_delete on public.doctor_brand
for delete using ((select public.has_role(array['admin'])));

drop policy if exists appointments_scoped_insert on public.appointments;
drop policy if exists appointments_staff_only_insert on public.appointments;

create index if not exists idx_cities_active on public.cities (is_active);
create index if not exists idx_clinics_city_id on public.clinics (city_id);
create index if not exists idx_appointments_clinic_scheduled_at on public.appointments (clinic_id, scheduled_at);
create index if not exists idx_appointments_visit_type_id on public.appointments (visit_type_id);
create index if not exists idx_doctor_specialties_doctor_id on public.doctor_specialties (doctor_id);
create index if not exists idx_doctor_specialties_specialty_id on public.doctor_specialties (specialty_id);
create index if not exists idx_patient_vaccinations_patient_given_at on public.patient_vaccinations (patient_id, given_at desc nulls last);
create index if not exists idx_patient_vaccinations_vaccine_status on public.patient_vaccinations (vaccine_id, status);
create index if not exists idx_patient_vaccinations_active_patient on public.patient_vaccinations (patient_id) where is_archived = false;
create index if not exists idx_patient_surgeries_patient_performed_at on public.patient_surgeries (patient_id, performed_at desc);
create index if not exists idx_patient_surgeries_surgery_type_id on public.patient_surgeries (surgery_type_id);
create index if not exists idx_patient_diseases_patient_status on public.patient_diseases (patient_id, status);
create index if not exists idx_patient_diseases_disease_status on public.patient_diseases (disease_id, status);
create index if not exists idx_patient_family_history_patient_id on public.patient_family_history (patient_id);
create index if not exists idx_patient_family_history_disease_id on public.patient_family_history (disease_id);
create index if not exists idx_patient_family_history_active_patient on public.patient_family_history (patient_id) where is_archived = false;
create index if not exists idx_medical_intake_status_completed_at on public.medical_intake (status, completed_at);
create index if not exists idx_staff_members_active_doctor on public.staff_members (doctor_id) where is_active = true;
create unique index if not exists idx_staff_members_doctor_email_unique on public.staff_members (doctor_id, lower(email)) where email is not null;
create index if not exists idx_staff_members_user_id_present on public.staff_members (user_id) where user_id is not null;
create index if not exists idx_staff_members_reports_to on public.staff_members (reports_to);
create index if not exists idx_doctor_schedule_templates_doctor_weekday_active on public.doctor_schedule_templates (doctor_id, weekday, is_active);
create index if not exists idx_secretary_slots_schedule_template_id on public.secretary_slots (schedule_template_id);
create index if not exists idx_insurance_claims_consultation_id on public.insurance_claims (consultation_id);
create index if not exists idx_insurance_claims_status_created_at on public.insurance_claims (status, created_at desc);
create index if not exists idx_insurance_claims_patient_created_at on public.insurance_claims (patient_id, created_at desc);
create index if not exists idx_patient_insurance_policies_provider_id on public.patient_insurance_policies (provider_id);
create index if not exists idx_doctor_insurance_contracts_active_doctor on public.doctor_insurance_contracts (doctor_id) where is_active = true;
create index if not exists idx_claim_form_templates_provider_active on public.claim_form_templates (provider_id, is_active);
create unique index if not exists idx_doctor_brand_doctor_id_unique on public.doctor_brand (doctor_id);
create index if not exists idx_users_lower_email on public.users (lower(email));

commit;
