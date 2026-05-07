-- Legacy Compatibility Burn-Down
-- Destructive cleanup is allowed in this development-stage tenant. Canonical
-- Tier 2 domains now own encounters, documents, notifications, and branding.

-- ---------------------------------------------------------------------------
-- 1. Canonical document/insurance compatibility
-- ---------------------------------------------------------------------------

alter table public.clinical_documents
  drop constraint if exists clinical_documents_document_type_check;

alter table public.clinical_documents
  add constraint clinical_documents_document_type_check
  check (
    document_type in (
      'report',
      'certificate',
      'referral',
      'prescription',
      'insurance_claim',
      'insurance_form',
      'lab_request',
      'lab_result',
      'imaging_result',
      'other'
    )
  );

alter table public.insurance_claims
  add column if not exists encounter_id uuid references public.encounters(id) on delete restrict;

drop index if exists public.idx_insurance_claims_consultation_id;
alter table public.insurance_claims
  drop column if exists consultation_id;

create index if not exists idx_insurance_claims_encounter_id
  on public.insurance_claims (encounter_id);

-- ---------------------------------------------------------------------------
-- 2. Canonical public tenant config and dashboard summary
-- ---------------------------------------------------------------------------

drop function if exists public.get_public_doctor_brand();

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
    coalesce(tac.primary_color, '#0891b2'),
    coalesce(tac.secondary_color, '#0f172a'),
    tac.maintenance_message,
    tac.min_supported_version,
    tac.force_update_version,
    coalesce(tac.enabled_locales, array[tp.default_locale]::text[]),
    tac.support_phone,
    tac.support_email,
    tp.display_name,
    tac.app_tagline,
    tac.splash_logo_url,
    tac.support_phone,
    tac.support_email,
    null::text,
    null::text
  from public.tenant_profile as tp
  left join public.tenant_app_config as tac on tac.profile_id = tp.id
  where tp.status in ('active', 'maintenance')
  order by tp.created_at asc
  limit 1;
$$;

revoke execute on function public.get_public_tenant_app_config() from public;
grant execute on function public.get_public_tenant_app_config() to anon, authenticated, service_role;

drop view if exists public.doctor_dashboard_summary;

create view public.doctor_dashboard_summary
with (security_invoker = true)
as
select
  (
    select count(*)
    from public.patients
    where coalesce(is_archived, false) = false
  ) as total_patients,
  (
    select count(*)
    from public.appointments
    where status in ('scheduled', 'confirmed', 'pre_check', 'in_consultation')
      and scheduled_at > now()
  ) as upcoming_appointments,
  (
    select count(*)
    from public.encounters
    where status = 'completed'
      and coalesce(is_archived, false) = false
  ) as completed_encounters,
  (
    select count(*)
    from public.appointments
    where status in ('scheduled', 'confirmed', 'pre_check', 'in_consultation')
      and scheduled_at < now()
  ) as overdue_appointments;

-- ---------------------------------------------------------------------------
-- 3. Canonical role notification RPC
-- ---------------------------------------------------------------------------

create or replace function public.notify_role_event(
  p_role text,
  p_title text,
  p_body text,
  p_event_type text default 'system',
  p_related_type text default null,
  p_related_id uuid default null,
  p_severity text default 'info'
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid;
  caller_role text;
  delivery_count integer;
begin
  caller_id := public.current_domain_user_id();
  caller_role := public.current_user_role();

  if caller_id is null or caller_role is null then
    raise exception 'Authentication required';
  end if;

  if p_role not in ('doctor', 'predoctor', 'secretary', 'nurse', 'assistant', 'junior_doctor', 'admin', 'patient') then
    raise exception 'Unsupported notification target role';
  end if;

  if p_severity not in ('info', 'success', 'warning', 'urgent') then
    raise exception 'Unsupported notification severity';
  end if;

  if char_length(trim(coalesce(p_title, ''))) = 0 or char_length(trim(coalesce(p_body, ''))) = 0 then
    raise exception 'Notification title and body are required';
  end if;

  if caller_role = 'patient' then
    if p_event_type <> 'appointment'
       or p_role not in ('doctor', 'predoctor', 'secretary')
       or p_related_id is null
       or not exists (
         select 1
         from public.appointments as a
         join public.patients as p on p.id = a.patient_id
         where a.id = p_related_id
           and p.user_id = caller_id
       ) then
      raise exception 'Patients can only notify staff about their own appointment events';
    end if;
  elsif caller_role not in ('doctor', 'predoctor', 'secretary', 'nurse', 'assistant', 'junior_doctor', 'admin') then
    raise exception 'Only staff can create role notifications';
  end if;

  with target_users as (
    select id
    from public.users
    where role = p_role
      and is_active = true
  ),
  inserted_events as (
    insert into public.notification_events (
      user_id,
      title,
      body,
      event_type,
      related_type,
      related_id,
      severity,
      status,
      created_by,
      source
    )
    select
      target_users.id,
      trim(p_title),
      trim(p_body),
      p_event_type,
      p_related_type,
      p_related_id,
      p_severity,
      'queued',
      caller_id,
      'user'
    from target_users
    returning id, user_id
  ),
  inserted_deliveries as (
    insert into public.notification_deliveries (
      event_id,
      user_id,
      channel,
      status
    )
    select
      inserted_events.id,
      inserted_events.user_id,
      'in_app',
      'queued'
    from inserted_events
    returning id
  )
  select count(*) into delivery_count
  from inserted_deliveries;

  return delivery_count;
end;
$$;

revoke execute on function public.notify_role_event(text, text, text, text, text, uuid, text) from public;
grant execute on function public.notify_role_event(text, text, text, text, text, uuid, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Drop duplicate legacy surfaces
-- ---------------------------------------------------------------------------

drop table if exists public.consultations cascade;
drop table if exists public.notifications cascade;
drop table if exists public.doctor_brand cascade;
drop table if exists public.clinic_settings cascade;
drop table if exists public.medical_reports cascade;
drop table if exists public.certificates cascade;
drop table if exists public.referrals cascade;
