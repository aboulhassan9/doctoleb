begin;

-- Tier 2 product core foundation.
-- Adds clinical encounters, documents, messaging, notification delivery, and
-- tenant/mobile configuration without changing the tenant silo model.

create or replace function public.current_patient_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id
  from public.patients as p
  where p.user_id = public.current_domain_user_id()
  limit 1;
$$;

create or replace function public.current_doctor_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select d.id
  from public.doctors as d
  where d.user_id = public.current_domain_user_id()
  limit 1;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    public.current_user_role() in ('doctor', 'predoctor', 'secretary', 'admin')
    or exists (
      select 1
      from public.staff_members as sm
      where sm.user_id = public.current_domain_user_id()
        and sm.is_active = true
    ),
    false
  );
$$;

create table if not exists public.encounters (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict,
  doctor_id uuid not null references public.doctors(id) on delete restrict,
  clinic_id uuid references public.clinics(id) on delete restrict,
  visit_type_id uuid references public.visit_types(id) on delete restrict,
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'completed', 'cancelled', 'entered_in_error')),
  started_at timestamptz,
  ended_at timestamptz,
  chief_complaint text,
  summary text,
  created_by uuid references public.users(id),
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or started_at is null or ended_at >= started_at)
);

create table if not exists public.clinical_notes (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict,
  doctor_id uuid not null references public.doctors(id) on delete restrict,
  author_user_id uuid not null references public.users(id) on delete restrict,
  note_type text not null default 'general'
    check (note_type in ('subjective', 'objective', 'assessment', 'plan', 'general', 'private')),
  content text not null check (char_length(trim(content)) > 0),
  visibility text not null default 'clinical'
    check (visibility in ('clinical', 'doctor_private')),
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.diagnoses (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict,
  doctor_id uuid not null references public.doctors(id) on delete restrict,
  disease_id uuid references public.diseases(id) on delete restrict,
  icd10_code text,
  diagnosis_text text,
  diagnosis_type text not null default 'primary'
    check (diagnosis_type in ('primary', 'secondary', 'differential')),
  status text not null default 'active'
    check (status in ('active', 'resolved', 'ruled_out', 'suspected')),
  onset_date date,
  resolved_at timestamptz,
  notes text,
  recorded_by uuid not null references public.users(id) on delete restrict,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (disease_id is not null or nullif(trim(diagnosis_text), '') is not null)
);

create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict,
  doctor_id uuid not null references public.doctors(id) on delete restrict,
  medication_name text not null check (char_length(trim(medication_name)) > 0),
  dosage text,
  route text,
  frequency text,
  duration text,
  instructions text,
  start_date date,
  end_date date,
  status text not null default 'active'
    check (status in ('draft', 'active', 'stopped', 'completed', 'cancelled')),
  prescribed_by uuid not null references public.users(id) on delete restrict,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table if not exists public.lab_orders (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict,
  doctor_id uuid not null references public.doctors(id) on delete restrict,
  title text not null check (char_length(trim(title)) > 0),
  instructions text,
  status text not null default 'draft'
    check (status in ('draft', 'ordered', 'in_progress', 'resulted', 'cancelled')),
  ordered_at timestamptz,
  resulted_at timestamptz,
  result_summary text,
  result_document_id uuid,
  ordered_by uuid not null references public.users(id) on delete restrict,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.imaging_orders (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict,
  doctor_id uuid not null references public.doctors(id) on delete restrict,
  imaging_type text not null check (char_length(trim(imaging_type)) > 0),
  body_area text,
  instructions text,
  status text not null default 'draft'
    check (status in ('draft', 'ordered', 'in_progress', 'resulted', 'cancelled')),
  ordered_at timestamptz,
  resulted_at timestamptz,
  result_summary text,
  result_document_id uuid,
  ordered_by uuid not null references public.users(id) on delete restrict,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinical_documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  encounter_id uuid references public.encounters(id) on delete restrict,
  doctor_id uuid references public.doctors(id) on delete restrict,
  document_type text not null
    check (document_type in ('report', 'certificate', 'prescription', 'insurance_claim', 'lab_result', 'imaging_result', 'other')),
  title text not null check (char_length(trim(title)) > 0),
  content text,
  file_url text,
  status text not null default 'draft'
    check (status in ('draft', 'final', 'superseded', 'void')),
  created_by uuid not null references public.users(id) on delete restrict,
  finalized_at timestamptz,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_attachments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.clinical_documents(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict,
  uploaded_by uuid not null references public.users(id) on delete restrict,
  file_url text not null,
  file_name text not null,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  storage_bucket text,
  storage_path text,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.care_tasks (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete restrict,
  encounter_id uuid references public.encounters(id) on delete restrict,
  appointment_id uuid references public.appointments(id) on delete restrict,
  assigned_to uuid references public.users(id) on delete restrict,
  created_by uuid not null references public.users(id) on delete restrict,
  task_type text not null default 'other'
    check (task_type in ('follow_up', 'call_patient', 'review_result', 'insurance', 'admin', 'other')),
  title text not null check (char_length(trim(title)) > 0),
  description text,
  due_at timestamptz,
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'done', 'cancelled')),
  completed_at timestamptz,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete restrict,
  subject text,
  conversation_type text not null default 'patient_staff'
    check (conversation_type in ('patient_staff', 'internal', 'support')),
  status text not null default 'open'
    check (status in ('open', 'closed', 'archived')),
  created_by uuid references public.users(id) on delete restrict,
  closed_at timestamptz,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((conversation_type = 'patient_staff' and patient_id is not null) or conversation_type <> 'patient_staff')
);

create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid references public.users(id) on delete restrict,
  staff_member_id uuid references public.staff_members(id) on delete restrict,
  patient_id uuid references public.patients(id) on delete restrict,
  role text not null
    check (role in ('patient', 'doctor', 'secretary', 'predoctor', 'nurse', 'assistant', 'junior_doctor', 'admin')),
  is_active boolean not null default true,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or staff_member_id is not null or patient_id is not null)
);

create unique index if not exists conversation_participants_user_unique
  on public.conversation_participants (conversation_id, user_id)
  where user_id is not null;

create unique index if not exists conversation_participants_patient_unique
  on public.conversation_participants (conversation_id, patient_id)
  where patient_id is not null;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_user_id uuid references public.users(id) on delete restrict,
  sender_patient_id uuid references public.patients(id) on delete restrict,
  body text not null check (char_length(trim(body)) > 0),
  message_type text not null default 'text' check (message_type in ('text', 'system')),
  is_internal boolean not null default false,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_user_id is not null or sender_patient_id is not null)
);

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  uploaded_by uuid references public.users(id) on delete restrict,
  file_url text not null,
  file_name text not null,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  storage_bucket text,
  storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.message_read_receipts (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete restrict,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create table if not exists public.patient_devices (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  user_id uuid not null references public.users(id) on delete restrict,
  platform text not null check (platform in ('ios', 'android', 'web')),
  push_token text not null unique,
  device_label text,
  app_version text,
  locale text,
  timezone text,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete restrict,
  patient_id uuid references public.patients(id) on delete restrict,
  title text not null,
  body text not null,
  event_type text not null,
  related_type text,
  related_id uuid,
  severity text not null default 'info'
    check (severity in ('info', 'success', 'warning', 'urgent')),
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed', 'cancelled')),
  scheduled_for timestamptz,
  created_by uuid references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or patient_id is not null)
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.notification_events(id) on delete cascade,
  user_id uuid references public.users(id) on delete restrict,
  device_id uuid references public.patient_devices(id) on delete set null,
  channel text not null check (channel in ('in_app', 'push', 'email', 'sms')),
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed', 'read', 'cancelled')),
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reminder_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  related_type text not null check (related_type in ('appointment', 'care_task', 'insurance_claim', 'document')),
  offset_minutes integer not null,
  channels text[] not null default array['in_app']::text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_profile (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null unique references public.doctors(id) on delete restrict,
  tenant_slug text not null unique check (tenant_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  display_name text not null,
  timezone text not null default 'Asia/Beirut',
  default_locale text not null default 'en',
  status text not null default 'active' check (status in ('active', 'maintenance', 'disabled')),
  schema_version text not null default 'tier2',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_app_config (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.tenant_profile(id) on delete restrict,
  app_name text not null default 'DoctoLeb',
  app_tagline text,
  splash_logo_url text,
  icon_url text,
  primary_color text check (primary_color ~ '^#[0-9A-Fa-f]{6}$' or primary_color is null),
  secondary_color text check (secondary_color ~ '^#[0-9A-Fa-f]{6}$' or secondary_color is null),
  maintenance_message text,
  min_supported_version text,
  force_update_version text,
  enabled_locales text[] not null default array['en']::text[],
  support_phone text,
  support_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_enabled boolean not null default false,
  target_roles text[] not null default array[]::text[],
  target_platforms text[] not null default array['web']::text[],
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null,
  body_md text not null,
  audience text not null default 'public' check (audience in ('public', 'patient', 'staff')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_by uuid references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.consent_documents (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  title text not null,
  body_md text not null,
  version text not null,
  audience text not null default 'patient' check (audience in ('patient', 'staff')),
  is_required boolean not null default true,
  is_active boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code, version)
);

create table if not exists public.patient_consents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  consent_document_id uuid not null references public.consent_documents(id) on delete restrict,
  accepted_by_user_id uuid references public.users(id) on delete restrict,
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, consent_document_id)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lab_orders_result_document_id_fkey'
      and conrelid = 'public.lab_orders'::regclass
  ) then
    alter table public.lab_orders
      add constraint lab_orders_result_document_id_fkey
      foreign key (result_document_id) references public.clinical_documents(id) on delete restrict
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'imaging_orders_result_document_id_fkey'
      and conrelid = 'public.imaging_orders'::regclass
  ) then
    alter table public.imaging_orders
      add constraint imaging_orders_result_document_id_fkey
      foreign key (result_document_id) references public.clinical_documents(id) on delete restrict
      not valid;
  end if;
end $$;

create or replace function public.normalize_encounter_from_appointment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_appointment record;
begin
  if tg_op = 'UPDATE' and new.appointment_id is distinct from old.appointment_id then
    raise exception 'Encounter appointment cannot be changed';
  end if;

  select a.patient_id, a.doctor_id, a.clinic_id, a.visit_type_id
  into v_appointment
  from public.appointments as a
  where a.id = new.appointment_id;

  if not found then
    raise exception 'Appointment not found for encounter';
  end if;

  if tg_op = 'UPDATE' and (
    new.patient_id is distinct from old.patient_id
    or new.doctor_id is distinct from old.doctor_id
  ) then
    raise exception 'Encounter patient and doctor are immutable';
  end if;

  new.patient_id := v_appointment.patient_id;
  new.doctor_id := v_appointment.doctor_id;
  new.clinic_id := coalesce(new.clinic_id, v_appointment.clinic_id);
  new.visit_type_id := coalesce(new.visit_type_id, v_appointment.visit_type_id);
  new.created_by := coalesce(new.created_by, public.current_domain_user_id());

  if new.status = 'in_progress' and new.started_at is null then
    new.started_at := now();
  end if;

  if new.status = 'completed' and new.ended_at is null then
    new.ended_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists normalize_encounter_from_appointment on public.encounters;
create trigger normalize_encounter_from_appointment
before insert or update on public.encounters
for each row execute function public.normalize_encounter_from_appointment();

create or replace function public.can_access_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    public.is_staff()
    or exists (
      select 1
      from public.conversation_participants as cp
      where cp.conversation_id = p_conversation_id
        and cp.is_active = true
        and cp.user_id = public.current_domain_user_id()
    )
    or exists (
      select 1
      from public.conversations as c
      where c.id = p_conversation_id
        and c.patient_id = public.current_patient_id()
    ),
    false
  );
$$;

revoke execute on function public.current_patient_id() from public;
revoke execute on function public.current_doctor_id() from public;
revoke execute on function public.can_access_conversation(uuid) from public;
grant execute on function public.current_patient_id() to authenticated, service_role;
grant execute on function public.current_doctor_id() to authenticated, service_role;
grant execute on function public.can_access_conversation(uuid) to authenticated, service_role;

create or replace function public.get_public_tenant_app_config()
returns table (
  tenant_slug text,
  tenant_status text,
  display_name text,
  timezone text,
  default_locale text,
  app_name text,
  app_tagline text,
  splash_logo_url text,
  icon_url text,
  primary_color text,
  secondary_color text,
  maintenance_message text,
  min_supported_version text,
  force_update_version text,
  enabled_locales text[],
  support_phone text,
  support_email text,
  doctor_display_name text,
  doctor_tagline text,
  doctor_logo_url text,
  doctor_contact_phone text,
  doctor_contact_email text,
  doctor_website_url text,
  doctor_about_md text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    tp.tenant_slug,
    tp.status,
    tp.display_name,
    tp.timezone,
    tp.default_locale,
    coalesce(tac.app_name, tp.display_name),
    tac.app_tagline,
    tac.splash_logo_url,
    tac.icon_url,
    coalesce(tac.primary_color, b.primary_color),
    coalesce(tac.secondary_color, b.secondary_color),
    tac.maintenance_message,
    tac.min_supported_version,
    tac.force_update_version,
    coalesce(tac.enabled_locales, array[tp.default_locale]::text[]),
    coalesce(tac.support_phone, b.contact_phone),
    coalesce(tac.support_email, b.contact_email),
    b.display_name,
    b.tagline,
    b.logo_url,
    b.contact_phone,
    b.contact_email,
    b.website_url,
    b.about_md
  from public.tenant_profile as tp
  left join public.tenant_app_config as tac on tac.profile_id = tp.id
  left join public.doctor_brand as b on b.doctor_id = tp.doctor_id
  where tp.status in ('active', 'maintenance')
  order by tp.created_at asc
  limit 1;
$$;

revoke execute on function public.get_public_tenant_app_config() from public;
grant execute on function public.get_public_tenant_app_config() to anon, authenticated, service_role;

insert into public.tenant_profile (doctor_id, tenant_slug, display_name)
select
  d.id,
  coalesce(
    nullif(
      regexp_replace(
        lower(coalesce(split_part(u.email, '@', 1), 'doctor-practice')),
        '[^a-z0-9]+',
        '-',
        'g'
      ),
      ''
    ),
    'doctor-practice'
  ) as tenant_slug,
  coalesce(b.display_name, 'Doctor Practice') as display_name
from public.doctors as d
left join public.users as u on u.id = d.user_id
left join public.doctor_brand as b on b.doctor_id = d.id
where not exists (select 1 from public.tenant_profile)
order by d.created_at asc
limit 1
on conflict do nothing;

insert into public.tenant_app_config (
  profile_id,
  app_name,
  app_tagline,
  primary_color,
  secondary_color,
  support_phone,
  support_email
)
select
  tp.id,
  coalesce(b.display_name, tp.display_name, 'DoctoLeb'),
  b.tagline,
  b.primary_color,
  b.secondary_color,
  b.contact_phone,
  b.contact_email
from public.tenant_profile as tp
left join public.doctor_brand as b on b.doctor_id = tp.doctor_id
where not exists (
  select 1
  from public.tenant_app_config as tac
  where tac.profile_id = tp.id
)
on conflict do nothing;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'encounters',
    'clinical_notes',
    'diagnoses',
    'prescriptions',
    'lab_orders',
    'imaging_orders',
    'clinical_documents',
    'document_attachments',
    'care_tasks',
    'conversations',
    'conversation_participants',
    'messages',
    'message_attachments',
    'patient_devices',
    'notification_events',
    'notification_deliveries',
    'reminder_rules',
    'tenant_profile',
    'tenant_app_config',
    'feature_flags',
    'content_pages',
    'consent_documents',
    'patient_consents'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'set_' || target_table || '_updated_at', target_table);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      'set_' || target_table || '_updated_at',
      target_table
    );
  end loop;
end $$;

do $$
declare
  audited_table text;
begin
  foreach audited_table in array array[
    'encounters',
    'clinical_notes',
    'diagnoses',
    'prescriptions',
    'lab_orders',
    'imaging_orders',
    'clinical_documents',
    'document_attachments',
    'care_tasks',
    'patient_devices',
    'notification_events',
    'notification_deliveries',
    'reminder_rules',
    'tenant_profile',
    'tenant_app_config',
    'feature_flags',
    'content_pages',
    'consent_documents',
    'patient_consents'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'audit_' || audited_table || '_changes', audited_table);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.write_audit_log()',
      'audit_' || audited_table || '_changes',
      audited_table
    );
  end loop;
end $$;

alter table public.encounters enable row level security;
alter table public.clinical_notes enable row level security;
alter table public.diagnoses enable row level security;
alter table public.prescriptions enable row level security;
alter table public.lab_orders enable row level security;
alter table public.imaging_orders enable row level security;
alter table public.clinical_documents enable row level security;
alter table public.document_attachments enable row level security;
alter table public.care_tasks enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.message_attachments enable row level security;
alter table public.message_read_receipts enable row level security;
alter table public.patient_devices enable row level security;
alter table public.notification_events enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.reminder_rules enable row level security;
alter table public.tenant_profile enable row level security;
alter table public.tenant_app_config enable row level security;
alter table public.feature_flags enable row level security;
alter table public.content_pages enable row level security;
alter table public.consent_documents enable row level security;
alter table public.patient_consents enable row level security;

drop policy if exists clinical_scoped_select on public.encounters;
create policy clinical_scoped_select on public.encounters
for select using ((select public.is_staff()) or patient_id = (select public.current_patient_id()));
drop policy if exists encounters_doctor_insert on public.encounters;
create policy encounters_doctor_insert on public.encounters
for insert with check (
  (select public.has_role(array['admin']))
  or ((select public.has_role(array['doctor'])) and doctor_id = (select public.current_doctor_id()))
);
drop policy if exists encounters_doctor_update on public.encounters;
create policy encounters_doctor_update on public.encounters
for update using (
  (select public.has_role(array['admin']))
  or ((select public.has_role(array['doctor'])) and doctor_id = (select public.current_doctor_id()))
)
with check (
  (select public.has_role(array['admin']))
  or ((select public.has_role(array['doctor'])) and doctor_id = (select public.current_doctor_id()))
);

drop policy if exists clinical_scoped_select on public.clinical_notes;
create policy clinical_scoped_select on public.clinical_notes
for select using (
  ((select public.is_staff()) and (visibility = 'clinical' or doctor_id = (select public.current_doctor_id()) or (select public.has_role(array['admin']))))
  or (patient_id = (select public.current_patient_id()) and visibility = 'clinical')
);
drop policy if exists clinical_doctor_insert on public.clinical_notes;
create policy clinical_doctor_insert on public.clinical_notes
for insert with check (
  (select public.has_role(array['admin']))
  or ((select public.has_role(array['doctor'])) and doctor_id = (select public.current_doctor_id()) and author_user_id = (select public.current_domain_user_id()))
);
drop policy if exists clinical_doctor_update on public.clinical_notes;
create policy clinical_doctor_update on public.clinical_notes
for update using (
  (select public.has_role(array['admin']))
  or ((select public.has_role(array['doctor'])) and doctor_id = (select public.current_doctor_id()))
)
with check (
  (select public.has_role(array['admin']))
  or ((select public.has_role(array['doctor'])) and doctor_id = (select public.current_doctor_id()))
);

drop policy if exists clinical_scoped_select on public.diagnoses;
create policy clinical_scoped_select on public.diagnoses
for select using ((select public.is_staff()) or patient_id = (select public.current_patient_id()));
drop policy if exists clinical_doctor_insert on public.diagnoses;
create policy clinical_doctor_insert on public.diagnoses
for insert with check (
  (select public.has_role(array['admin']))
  or ((select public.has_role(array['doctor'])) and doctor_id = (select public.current_doctor_id()) and recorded_by = (select public.current_domain_user_id()))
);
drop policy if exists clinical_doctor_update on public.diagnoses;
create policy clinical_doctor_update on public.diagnoses
for update using (
  (select public.has_role(array['admin']))
  or ((select public.has_role(array['doctor'])) and doctor_id = (select public.current_doctor_id()))
)
with check (
  (select public.has_role(array['admin']))
  or ((select public.has_role(array['doctor'])) and doctor_id = (select public.current_doctor_id()))
);

drop policy if exists clinical_scoped_select on public.prescriptions;
create policy clinical_scoped_select on public.prescriptions
for select using ((select public.is_staff()) or patient_id = (select public.current_patient_id()));
drop policy if exists clinical_doctor_insert on public.prescriptions;
create policy clinical_doctor_insert on public.prescriptions
for insert with check (
  (select public.has_role(array['admin']))
  or ((select public.has_role(array['doctor'])) and doctor_id = (select public.current_doctor_id()) and prescribed_by = (select public.current_domain_user_id()))
);
drop policy if exists clinical_doctor_update on public.prescriptions;
create policy clinical_doctor_update on public.prescriptions
for update using (
  (select public.has_role(array['admin']))
  or ((select public.has_role(array['doctor'])) and doctor_id = (select public.current_doctor_id()))
)
with check (
  (select public.has_role(array['admin']))
  or ((select public.has_role(array['doctor'])) and doctor_id = (select public.current_doctor_id()))
);

drop policy if exists clinical_scoped_select on public.lab_orders;
create policy clinical_scoped_select on public.lab_orders
for select using ((select public.is_staff()) or patient_id = (select public.current_patient_id()));
drop policy if exists clinical_doctor_insert on public.lab_orders;
create policy clinical_doctor_insert on public.lab_orders
for insert with check (
  (select public.has_role(array['admin']))
  or ((select public.has_role(array['doctor'])) and doctor_id = (select public.current_doctor_id()) and ordered_by = (select public.current_domain_user_id()))
);
drop policy if exists clinical_doctor_update on public.lab_orders;
create policy clinical_doctor_update on public.lab_orders
for update using (
  (select public.has_role(array['admin']))
  or ((select public.has_role(array['doctor'])) and doctor_id = (select public.current_doctor_id()))
)
with check (
  (select public.has_role(array['admin']))
  or ((select public.has_role(array['doctor'])) and doctor_id = (select public.current_doctor_id()))
);

drop policy if exists clinical_scoped_select on public.imaging_orders;
create policy clinical_scoped_select on public.imaging_orders
for select using ((select public.is_staff()) or patient_id = (select public.current_patient_id()));
drop policy if exists clinical_doctor_insert on public.imaging_orders;
create policy clinical_doctor_insert on public.imaging_orders
for insert with check (
  (select public.has_role(array['admin']))
  or ((select public.has_role(array['doctor'])) and doctor_id = (select public.current_doctor_id()) and ordered_by = (select public.current_domain_user_id()))
);
drop policy if exists clinical_doctor_update on public.imaging_orders;
create policy clinical_doctor_update on public.imaging_orders
for update using (
  (select public.has_role(array['admin']))
  or ((select public.has_role(array['doctor'])) and doctor_id = (select public.current_doctor_id()))
)
with check (
  (select public.has_role(array['admin']))
  or ((select public.has_role(array['doctor'])) and doctor_id = (select public.current_doctor_id()))
);

drop policy if exists clinical_documents_scoped_select on public.clinical_documents;
create policy clinical_documents_scoped_select on public.clinical_documents
for select using ((select public.is_staff()) or patient_id = (select public.current_patient_id()));
drop policy if exists clinical_documents_staff_insert on public.clinical_documents;
create policy clinical_documents_staff_insert on public.clinical_documents
for insert with check ((select public.has_role(array['doctor', 'secretary', 'admin'])));
drop policy if exists clinical_documents_staff_update on public.clinical_documents;
create policy clinical_documents_staff_update on public.clinical_documents
for update using ((select public.has_role(array['doctor', 'secretary', 'admin'])))
with check ((select public.has_role(array['doctor', 'secretary', 'admin'])));

drop policy if exists document_attachments_scoped_select on public.document_attachments;
create policy document_attachments_scoped_select on public.document_attachments
for select using ((select public.is_staff()) or patient_id = (select public.current_patient_id()));
drop policy if exists document_attachments_staff_insert on public.document_attachments;
create policy document_attachments_staff_insert on public.document_attachments
for insert with check ((select public.has_role(array['doctor', 'secretary', 'predoctor', 'admin'])));
drop policy if exists document_attachments_staff_update on public.document_attachments;
create policy document_attachments_staff_update on public.document_attachments
for update using ((select public.has_role(array['doctor', 'secretary', 'predoctor', 'admin'])))
with check ((select public.has_role(array['doctor', 'secretary', 'predoctor', 'admin'])));

drop policy if exists care_tasks_staff_select on public.care_tasks;
create policy care_tasks_staff_select on public.care_tasks
for select using (
  (select public.is_staff())
  or assigned_to = (select public.current_domain_user_id())
  or patient_id = (select public.current_patient_id())
);
drop policy if exists care_tasks_staff_insert on public.care_tasks;
create policy care_tasks_staff_insert on public.care_tasks
for insert with check ((select public.is_staff()));
drop policy if exists care_tasks_staff_update on public.care_tasks;
create policy care_tasks_staff_update on public.care_tasks
for update using ((select public.is_staff()) or assigned_to = (select public.current_domain_user_id()))
with check ((select public.is_staff()) or assigned_to = (select public.current_domain_user_id()));

drop policy if exists conversations_scoped_select on public.conversations;
create policy conversations_scoped_select on public.conversations
for select using ((select public.can_access_conversation(id)));
drop policy if exists conversations_staff_insert on public.conversations;
create policy conversations_staff_insert on public.conversations
for insert with check ((select public.is_staff()) or patient_id = (select public.current_patient_id()));
drop policy if exists conversations_staff_update on public.conversations;
create policy conversations_staff_update on public.conversations
for update using ((select public.is_staff()) or (select public.can_access_conversation(id)))
with check ((select public.is_staff()) or (select public.can_access_conversation(id)));

drop policy if exists conversation_participants_scoped_select on public.conversation_participants;
create policy conversation_participants_scoped_select on public.conversation_participants
for select using ((select public.can_access_conversation(conversation_id)));
drop policy if exists conversation_participants_staff_insert on public.conversation_participants;
create policy conversation_participants_staff_insert on public.conversation_participants
for insert with check ((select public.is_staff()) or patient_id = (select public.current_patient_id()));
drop policy if exists conversation_participants_self_update on public.conversation_participants;
create policy conversation_participants_self_update on public.conversation_participants
for update using (
  (select public.is_staff())
  or user_id = (select public.current_domain_user_id())
  or patient_id = (select public.current_patient_id())
)
with check (
  (select public.is_staff())
  or user_id = (select public.current_domain_user_id())
  or patient_id = (select public.current_patient_id())
);

drop policy if exists messages_scoped_select on public.messages;
create policy messages_scoped_select on public.messages
for select using ((select public.can_access_conversation(conversation_id)));
drop policy if exists messages_participant_insert on public.messages;
create policy messages_participant_insert on public.messages
for insert with check (
  (select public.can_access_conversation(conversation_id))
  and (
    sender_user_id = (select public.current_domain_user_id())
    or sender_patient_id = (select public.current_patient_id())
  )
);
drop policy if exists messages_sender_update on public.messages;
create policy messages_sender_update on public.messages
for update using (
  sender_user_id = (select public.current_domain_user_id())
  or (select public.has_role(array['admin']))
)
with check (
  sender_user_id = (select public.current_domain_user_id())
  or (select public.has_role(array['admin']))
);

drop policy if exists message_attachments_scoped_select on public.message_attachments;
create policy message_attachments_scoped_select on public.message_attachments
for select using (
  exists (
    select 1 from public.messages as m
    where m.id = message_id
      and public.can_access_conversation(m.conversation_id)
  )
);
drop policy if exists message_attachments_participant_insert on public.message_attachments;
create policy message_attachments_participant_insert on public.message_attachments
for insert with check (
  exists (
    select 1 from public.messages as m
    where m.id = message_id
      and public.can_access_conversation(m.conversation_id)
  )
);

drop policy if exists message_read_receipts_scoped_select on public.message_read_receipts;
create policy message_read_receipts_scoped_select on public.message_read_receipts
for select using (
  user_id = (select public.current_domain_user_id())
  or exists (
    select 1
    from public.messages as m
    where m.id = message_id
      and public.can_access_conversation(m.conversation_id)
  )
);
drop policy if exists message_read_receipts_self_insert on public.message_read_receipts;
create policy message_read_receipts_self_insert on public.message_read_receipts
for insert with check (user_id = (select public.current_domain_user_id()));
drop policy if exists message_read_receipts_self_update on public.message_read_receipts;
create policy message_read_receipts_self_update on public.message_read_receipts
for update using (user_id = (select public.current_domain_user_id()))
with check (user_id = (select public.current_domain_user_id()));

drop policy if exists patient_devices_scoped_select on public.patient_devices;
create policy patient_devices_scoped_select on public.patient_devices
for select using ((select public.is_staff()) or patient_id = (select public.current_patient_id()));
drop policy if exists patient_devices_own_insert on public.patient_devices;
create policy patient_devices_own_insert on public.patient_devices
for insert with check (
  user_id = (select public.current_domain_user_id())
  and patient_id = (select public.current_patient_id())
);
drop policy if exists patient_devices_own_update on public.patient_devices;
create policy patient_devices_own_update on public.patient_devices
for update using (
  user_id = (select public.current_domain_user_id())
  or (select public.has_role(array['admin']))
)
with check (
  user_id = (select public.current_domain_user_id())
  or (select public.has_role(array['admin']))
);

drop policy if exists notification_events_scoped_select on public.notification_events;
create policy notification_events_scoped_select on public.notification_events
for select using (
  (select public.is_staff())
  or user_id = (select public.current_domain_user_id())
  or patient_id = (select public.current_patient_id())
);
drop policy if exists notification_events_staff_insert on public.notification_events;
create policy notification_events_staff_insert on public.notification_events
for insert with check ((select public.is_staff()));
drop policy if exists notification_events_staff_update on public.notification_events;
create policy notification_events_staff_update on public.notification_events
for update using ((select public.is_staff()))
with check ((select public.is_staff()));

drop policy if exists notification_deliveries_scoped_select on public.notification_deliveries;
create policy notification_deliveries_scoped_select on public.notification_deliveries
for select using ((select public.is_staff()) or user_id = (select public.current_domain_user_id()));
drop policy if exists notification_deliveries_staff_insert on public.notification_deliveries;
create policy notification_deliveries_staff_insert on public.notification_deliveries
for insert with check ((select public.is_staff()));
drop policy if exists notification_deliveries_staff_update on public.notification_deliveries;
create policy notification_deliveries_staff_update on public.notification_deliveries
for update using ((select public.is_staff()) or user_id = (select public.current_domain_user_id()))
with check ((select public.is_staff()) or user_id = (select public.current_domain_user_id()));

drop policy if exists reminder_rules_authenticated_select on public.reminder_rules;
create policy reminder_rules_authenticated_select on public.reminder_rules
for select using ((select auth.role()) = 'authenticated');
drop policy if exists reminder_rules_admin_write on public.reminder_rules;
create policy reminder_rules_admin_write on public.reminder_rules
for insert with check ((select public.has_role(array['admin'])));
drop policy if exists reminder_rules_admin_update on public.reminder_rules;
create policy reminder_rules_admin_update on public.reminder_rules
for update using ((select public.has_role(array['admin'])))
with check ((select public.has_role(array['admin'])));
drop policy if exists reminder_rules_admin_delete on public.reminder_rules;
create policy reminder_rules_admin_delete on public.reminder_rules
for delete using ((select public.has_role(array['admin'])));

drop policy if exists tenant_profile_authenticated_select on public.tenant_profile;
create policy tenant_profile_authenticated_select on public.tenant_profile
for select using ((select auth.role()) = 'authenticated');
drop policy if exists tenant_profile_doctor_insert on public.tenant_profile;
create policy tenant_profile_doctor_insert on public.tenant_profile
for insert with check ((select public.has_role(array['doctor', 'admin'])));
drop policy if exists tenant_profile_doctor_update on public.tenant_profile;
create policy tenant_profile_doctor_update on public.tenant_profile
for update using ((select public.has_role(array['doctor', 'admin'])))
with check ((select public.has_role(array['doctor', 'admin'])));

drop policy if exists tenant_app_config_authenticated_select on public.tenant_app_config;
create policy tenant_app_config_authenticated_select on public.tenant_app_config
for select using ((select auth.role()) = 'authenticated');
drop policy if exists tenant_app_config_doctor_insert on public.tenant_app_config;
create policy tenant_app_config_doctor_insert on public.tenant_app_config
for insert with check ((select public.has_role(array['doctor', 'admin'])));
drop policy if exists tenant_app_config_doctor_update on public.tenant_app_config;
create policy tenant_app_config_doctor_update on public.tenant_app_config
for update using ((select public.has_role(array['doctor', 'admin'])))
with check ((select public.has_role(array['doctor', 'admin'])));

drop policy if exists feature_flags_authenticated_select on public.feature_flags;
create policy feature_flags_authenticated_select on public.feature_flags
for select using ((select auth.role()) = 'authenticated');
drop policy if exists feature_flags_admin_insert on public.feature_flags;
create policy feature_flags_admin_insert on public.feature_flags
for insert with check ((select public.has_role(array['admin'])));
drop policy if exists feature_flags_admin_update on public.feature_flags;
create policy feature_flags_admin_update on public.feature_flags
for update using ((select public.has_role(array['admin'])))
with check ((select public.has_role(array['admin'])));

drop policy if exists content_pages_authenticated_select on public.content_pages;
create policy content_pages_authenticated_select on public.content_pages
for select using ((select auth.role()) = 'authenticated');
drop policy if exists content_pages_admin_insert on public.content_pages;
create policy content_pages_admin_insert on public.content_pages
for insert with check ((select public.has_role(array['doctor', 'secretary', 'admin'])));
drop policy if exists content_pages_admin_update on public.content_pages;
create policy content_pages_admin_update on public.content_pages
for update using ((select public.has_role(array['doctor', 'secretary', 'admin'])))
with check ((select public.has_role(array['doctor', 'secretary', 'admin'])));

drop policy if exists consent_documents_authenticated_select on public.consent_documents;
create policy consent_documents_authenticated_select on public.consent_documents
for select using ((select auth.role()) = 'authenticated');
drop policy if exists consent_documents_admin_insert on public.consent_documents;
create policy consent_documents_admin_insert on public.consent_documents
for insert with check ((select public.has_role(array['admin'])));
drop policy if exists consent_documents_admin_update on public.consent_documents;
create policy consent_documents_admin_update on public.consent_documents
for update using ((select public.has_role(array['admin'])))
with check ((select public.has_role(array['admin'])));

drop policy if exists patient_consents_scoped_select on public.patient_consents;
create policy patient_consents_scoped_select on public.patient_consents
for select using ((select public.is_staff()) or patient_id = (select public.current_patient_id()));
drop policy if exists patient_consents_own_insert on public.patient_consents;
create policy patient_consents_own_insert on public.patient_consents
for insert with check (
  patient_id = (select public.current_patient_id())
  and (accepted_by_user_id is null or accepted_by_user_id = (select public.current_domain_user_id()))
);
drop policy if exists patient_consents_admin_update on public.patient_consents;
create policy patient_consents_admin_update on public.patient_consents
for update using (
  patient_id = (select public.current_patient_id())
  or (select public.has_role(array['admin']))
)
with check (
  patient_id = (select public.current_patient_id())
  or (select public.has_role(array['admin']))
);

create index if not exists idx_encounters_patient_started_at on public.encounters (patient_id, started_at desc nulls last);
create index if not exists idx_encounters_doctor_status on public.encounters (doctor_id, status, started_at desc nulls last);
create index if not exists idx_encounters_active_patient on public.encounters (patient_id) where is_archived = false;
create index if not exists idx_clinical_notes_encounter_created_at on public.clinical_notes (encounter_id, created_at desc);
create index if not exists idx_diagnoses_patient_status on public.diagnoses (patient_id, status);
create index if not exists idx_diagnoses_disease_id on public.diagnoses (disease_id);
create index if not exists idx_prescriptions_patient_status on public.prescriptions (patient_id, status);
create index if not exists idx_lab_orders_patient_status on public.lab_orders (patient_id, status);
create index if not exists idx_imaging_orders_patient_status on public.imaging_orders (patient_id, status);
create index if not exists idx_clinical_documents_patient_created_at on public.clinical_documents (patient_id, created_at desc);
create index if not exists idx_clinical_documents_encounter_id on public.clinical_documents (encounter_id);
create index if not exists idx_document_attachments_document_id on public.document_attachments (document_id);
create index if not exists idx_care_tasks_assigned_status_due on public.care_tasks (assigned_to, status, due_at);
create index if not exists idx_care_tasks_patient_status on public.care_tasks (patient_id, status);
create index if not exists idx_conversations_patient_status on public.conversations (patient_id, status, updated_at desc);
create index if not exists idx_conversation_participants_user_active on public.conversation_participants (user_id, is_active);
create index if not exists idx_conversation_participants_patient_active on public.conversation_participants (patient_id, is_active);
create index if not exists idx_messages_conversation_created_at on public.messages (conversation_id, created_at desc);
create index if not exists idx_message_attachments_message_id on public.message_attachments (message_id);
create index if not exists idx_message_read_receipts_user_id on public.message_read_receipts (user_id);
create index if not exists idx_patient_devices_patient_active on public.patient_devices (patient_id, is_active);
create index if not exists idx_notification_events_user_status on public.notification_events (user_id, status, scheduled_for);
create index if not exists idx_notification_events_patient_created_at on public.notification_events (patient_id, created_at desc);
create index if not exists idx_notification_deliveries_event_id on public.notification_deliveries (event_id);
create index if not exists idx_notification_deliveries_user_status on public.notification_deliveries (user_id, status, created_at desc);
create index if not exists idx_reminder_rules_related_active on public.reminder_rules (related_type, is_active);
create index if not exists idx_tenant_profile_status on public.tenant_profile (status);
create index if not exists idx_feature_flags_enabled on public.feature_flags (is_enabled);
create index if not exists idx_content_pages_audience_status on public.content_pages (audience, status);
create index if not exists idx_consent_documents_code_active on public.consent_documents (code, is_active);
create index if not exists idx_patient_consents_patient_id on public.patient_consents (patient_id);

commit;
