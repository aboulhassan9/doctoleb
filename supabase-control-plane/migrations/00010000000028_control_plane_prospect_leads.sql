-- DoctoLeb Control Plane · marketing prospect leads
-- Zero-PHI table that captures interest from doctors visiting doctoleb.com.
-- Inserted by the public marketing-capture-lead Edge Function via the
-- service-role-only RPC below. Anon and authenticated roles cannot read or
-- write this table directly.

create table if not exists public.prospect_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  clinic_name text,
  doctor_name text,
  message text,
  source text not null default 'landing'
    check (char_length(source) between 1 and 64),
  ip_hash text
    check (ip_hash is null or ip_hash ~ '^[a-f0-9]{16,128}$'),
  user_agent text
    check (user_agent is null or char_length(user_agent) <= 500),
  status text not null default 'new'
    check (status in ('new', 'contacted', 'converted', 'declined', 'spam')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prospect_leads_email_valid
    check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) between 3 and 200),
  constraint prospect_leads_clinic_name_length
    check (clinic_name is null or char_length(clinic_name) <= 160),
  constraint prospect_leads_doctor_name_length
    check (doctor_name is null or char_length(doctor_name) <= 160),
  constraint prospect_leads_message_length
    check (message is null or char_length(message) <= 1000)
);

create index if not exists prospect_leads_status_created_at_idx
  on public.prospect_leads (status, created_at desc);

create index if not exists prospect_leads_email_idx
  on public.prospect_leads (email);

create index if not exists prospect_leads_source_created_at_idx
  on public.prospect_leads (source, created_at desc);

comment on table public.prospect_leads is
  'Marketing-surface leads captured from doctoleb.com. Zero PHI. Written only by the public marketing-capture-lead Edge Function through a service-role RPC.';

alter table public.prospect_leads enable row level security;

-- No policies = no role can read/write directly. Service role bypasses RLS,
-- which is what the Edge Function uses.

create or replace function public.marketing_insert_prospect_lead(
  p_email text,
  p_clinic_name text,
  p_doctor_name text,
  p_message text,
  p_source text,
  p_ip_hash text,
  p_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_clinic_name text := nullif(trim(coalesce(p_clinic_name, '')), '');
  v_doctor_name text := nullif(trim(coalesce(p_doctor_name, '')), '');
  v_message text := nullif(trim(coalesce(p_message, '')), '');
  v_source text := lower(coalesce(nullif(trim(coalesce(p_source, '')), ''), 'landing'));
  v_ip_hash text := nullif(trim(coalesce(p_ip_hash, '')), '');
  v_user_agent text := nullif(left(trim(coalesce(p_user_agent, '')), 500), '');
  v_id uuid;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 200 then
    return jsonb_build_object('data', null, 'error', 'INVALID_EMAIL');
  end if;

  if v_clinic_name is not null and char_length(v_clinic_name) > 160 then
    v_clinic_name := left(v_clinic_name, 160);
  end if;

  if v_doctor_name is not null and char_length(v_doctor_name) > 160 then
    v_doctor_name := left(v_doctor_name, 160);
  end if;

  if v_message is not null and char_length(v_message) > 1000 then
    v_message := left(v_message, 1000);
  end if;

  insert into public.prospect_leads (
    email,
    clinic_name,
    doctor_name,
    message,
    source,
    ip_hash,
    user_agent
  )
  values (
    v_email,
    v_clinic_name,
    v_doctor_name,
    v_message,
    v_source,
    v_ip_hash,
    v_user_agent
  )
  returning id into v_id;

  return jsonb_build_object('data', jsonb_build_object('id', v_id), 'error', null);
end;
$$;

revoke all on function public.marketing_insert_prospect_lead(text, text, text, text, text, text, text) from public;
revoke execute on function public.marketing_insert_prospect_lead(text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.marketing_insert_prospect_lead(text, text, text, text, text, text, text) to service_role;

comment on function public.marketing_insert_prospect_lead(text, text, text, text, text, text, text) is
  'Service-role-only RPC for the marketing-capture-lead Edge Function. Validates input lengths and email format, inserts into prospect_leads, returns the new id. Never writes raw IP — only an IP hash for abuse tracking.';
