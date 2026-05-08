-- DoctoLeb Control Plane · provider-connected provisioning backbone
-- Stores only zero-PHI SaaS/provisioning metadata. Raw provider tokens, service
-- role keys, and management credentials must stay in Vault, Edge Function
-- secrets, or an external secret manager. Never store them in these tables.

create table if not exists public.provisioning_provider_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null
    check (provider in ('supabase','vercel')),
  display_name text not null
    check (char_length(trim(display_name)) between 1 and 160),
  owner_scope text not null default 'doctoleb'
    check (owner_scope in ('doctoleb','customer','partner')),
  auth_method text not null default 'oauth'
    check (auth_method in ('oauth','personal_access_token','service_account','manual')),
  status text not null default 'pending_authorization'
    check (status in ('pending_authorization','active','disabled','revoked','error','archived')),
  is_automation_enabled boolean not null default false,
  external_account_id text,
  external_account_slug text,
  external_team_id text,
  external_org_id text,
  capabilities jsonb not null default '{}'::jsonb
    check (jsonb_typeof(capabilities) = 'object'),
  secret_storage text not null default 'edge_function_secret'
    check (secret_storage in ('edge_function_secret','supabase_vault','external_secret_manager','none')),
  secret_ref text,
  secret_last_rotated_at timestamptz,
  last_verified_at timestamptz,
  last_error_code text,
  last_error_summary text
    check (last_error_summary is null or char_length(last_error_summary) <= 1000),
  created_by uuid references public.super_admins(id) on delete set null,
  updated_by uuid references public.super_admins(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint provisioning_provider_connections_secret_ref_not_raw_token
    check (
      secret_ref is null
      or secret_ref !~* '(eyJ|sbp_|vcp_|sk_live_|sk_test_)'
    ),
  constraint provisioning_provider_connections_automation_secret_required
    check (
      is_automation_enabled = false
      or (
        status = 'active'
        and secret_storage <> 'none'
        and nullif(trim(coalesce(secret_ref, '')), '') is not null
      )
    ),
  constraint provisioning_provider_connections_archived_at_required
    check (
      (status = 'archived' and archived_at is not null)
      or (status <> 'archived' and archived_at is null)
    )
);

create index if not exists provisioning_provider_connections_provider_status_idx
  on public.provisioning_provider_connections (provider, status, created_at desc);

create index if not exists provisioning_provider_connections_owner_scope_idx
  on public.provisioning_provider_connections (owner_scope, provider, status);

create unique index if not exists provisioning_provider_connections_external_account_key
  on public.provisioning_provider_connections (provider, external_account_id)
  where external_account_id is not null
    and status <> 'archived';

comment on table public.provisioning_provider_connections is
  'Authorized Supabase/Vercel account handles for tenant provisioning. Stores secret references only. NO PHI.';

comment on column public.provisioning_provider_connections.secret_ref is
  'Reference to a server-side secret location. Must never contain a raw provider token or service key.';

alter table public.tenant_provisioning_jobs
  add column if not exists supabase_connection_id uuid references public.provisioning_provider_connections(id) on delete set null,
  add column if not exists vercel_connection_id uuid references public.provisioning_provider_connections(id) on delete set null,
  add column if not exists automation_mode text not null default 'manual',
  add column if not exists automation_status text not null default 'not_started',
  add column if not exists provider_state jsonb not null default '{}'::jsonb,
  add column if not exists cancel_requested_at timestamptz;

alter table public.tenant_provisioning_jobs
  drop constraint if exists tenant_provisioning_jobs_automation_mode_check;

alter table public.tenant_provisioning_jobs
  add constraint tenant_provisioning_jobs_automation_mode_check
  check (automation_mode in ('manual','assisted','automatic'));

alter table public.tenant_provisioning_jobs
  drop constraint if exists tenant_provisioning_jobs_automation_status_check;

alter table public.tenant_provisioning_jobs
  add constraint tenant_provisioning_jobs_automation_status_check
  check (automation_status in (
    'not_started',
    'waiting_for_authorization',
    'ready',
    'running',
    'blocked',
    'completed',
    'cancelled'
  ));

alter table public.tenant_provisioning_jobs
  drop constraint if exists tenant_provisioning_jobs_provider_state_object_check;

alter table public.tenant_provisioning_jobs
  add constraint tenant_provisioning_jobs_provider_state_object_check
  check (jsonb_typeof(provider_state) = 'object');

create index if not exists tenant_provisioning_jobs_supabase_connection_idx
  on public.tenant_provisioning_jobs (supabase_connection_id)
  where supabase_connection_id is not null;

create index if not exists tenant_provisioning_jobs_vercel_connection_idx
  on public.tenant_provisioning_jobs (vercel_connection_id)
  where vercel_connection_id is not null;

create index if not exists tenant_provisioning_jobs_automation_status_idx
  on public.tenant_provisioning_jobs (automation_status, created_at desc);

create table if not exists public.tenant_provisioning_steps (
  id uuid primary key default gen_random_uuid(),
  provisioning_job_id uuid not null references public.tenant_provisioning_jobs(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete set null,
  step_code text not null
    check (step_code ~ '^[a-z0-9](?:[a-z0-9_ -]{0,120}[a-z0-9])?$'),
  provider text
    check (provider is null or provider in ('doctoleb','supabase','vercel','tenant_db','dns')),
  status text not null default 'pending'
    check (status in ('pending','queued','running','succeeded','failed','skipped','cancelled','compensating','rolled_back')),
  idempotency_key text not null
    check (char_length(trim(idempotency_key)) between 8 and 240),
  external_resource_kind text,
  external_resource_id text,
  external_resource_url text,
  preconditions jsonb not null default '{}'::jsonb
    check (jsonb_typeof(preconditions) = 'object'),
  postconditions jsonb not null default '{}'::jsonb
    check (jsonb_typeof(postconditions) = 'object'),
  undo_strategy text
    check (undo_strategy is null or undo_strategy in (
      'delete_external_resource',
      'disable_external_resource',
      'restore_previous_value',
      'manual_review',
      'none'
    )),
  undo_payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(undo_payload) = 'object'),
  attempt_count integer not null default 0
    check (attempt_count >= 0),
  last_error_code text,
  last_error_summary text
    check (last_error_summary is null or char_length(last_error_summary) <= 1000),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provisioning_job_id, step_code),
  constraint tenant_provisioning_steps_completion_required
    check (
      (status in ('succeeded','failed','skipped','cancelled','rolled_back') and completed_at is not null)
      or status not in ('succeeded','failed','skipped','cancelled','rolled_back')
    )
);

create unique index if not exists tenant_provisioning_steps_idempotency_key
  on public.tenant_provisioning_steps (idempotency_key);

create index if not exists tenant_provisioning_steps_job_status_idx
  on public.tenant_provisioning_steps (provisioning_job_id, status, created_at);

create index if not exists tenant_provisioning_steps_tenant_idx
  on public.tenant_provisioning_steps (tenant_id)
  where tenant_id is not null;

create index if not exists tenant_provisioning_steps_external_resource_idx
  on public.tenant_provisioning_steps (provider, external_resource_kind, external_resource_id)
  where external_resource_id is not null;

comment on table public.tenant_provisioning_steps is
  'Step-level automation ledger for tenant provisioning, including idempotency keys and undo metadata. NO PHI.';

comment on column public.tenant_provisioning_steps.undo_payload is
  'Safe metadata required to undo or compensate this provisioning step. Must not contain raw secrets or PHI.';

drop trigger if exists provisioning_provider_connections_touch_updated_at on public.provisioning_provider_connections;
create trigger provisioning_provider_connections_touch_updated_at
  before update on public.provisioning_provider_connections
  for each row execute function public.touch_updated_at();

drop trigger if exists tenant_provisioning_steps_touch_updated_at on public.tenant_provisioning_steps;
create trigger tenant_provisioning_steps_touch_updated_at
  before update on public.tenant_provisioning_steps
  for each row execute function public.touch_updated_at();

alter table public.provisioning_provider_connections enable row level security;
alter table public.tenant_provisioning_steps enable row level security;

drop policy if exists provisioning_provider_connections_super_admin_select
  on public.provisioning_provider_connections;
create policy provisioning_provider_connections_super_admin_select
  on public.provisioning_provider_connections
  for select to authenticated
  using (public.is_super_admin());

drop policy if exists tenant_provisioning_steps_super_admin_select
  on public.tenant_provisioning_steps;
create policy tenant_provisioning_steps_super_admin_select
  on public.tenant_provisioning_steps
  for select to authenticated
  using (public.is_super_admin());

insert into public.tenant_events (tenant_id, event_type, metadata)
select null, 'control_plane.provider_provisioning_backbone_applied', jsonb_build_object(
  'providerConnections', true,
  'provisioningSteps', true,
  'secretRefsOnly', true,
  'automationReversible', true,
  'phi', false
)
where not exists (
  select 1
  from public.tenant_events
  where event_type = 'control_plane.provider_provisioning_backbone_applied'
);
