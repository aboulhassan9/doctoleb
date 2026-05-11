-- DoctoLeb Control Plane · tenant database setup automation
-- Stores only zero-PHI setup metadata. Raw tenant/provider credentials live in
-- Supabase Vault, Edge Function secrets, or an external secret manager.

create extension if not exists supabase_vault with schema vault;

create table if not exists public.tenant_secret_refs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  project_ref text not null
    check (project_ref ~ '^[a-z0-9]{20}$'),
  secret_kind text not null
    check (secret_kind in ('service_role_key','database_url')),
  secret_storage text not null
    check (secret_storage in ('supabase_vault','edge_function_secret','external_secret_manager')),
  secret_ref text not null
    check (char_length(trim(secret_ref)) between 3 and 512),
  status text not null default 'active'
    check (status in ('active','rotated','revoked','error')),
  secret_last_rotated_at timestamptz not null default now(),
  last_verified_at timestamptz,
  last_error_code text,
  last_error_summary text
    check (last_error_summary is null or char_length(last_error_summary) <= 1000),
  created_by uuid references public.super_admins(id) on delete set null,
  updated_by uuid references public.super_admins(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_secret_refs_secret_ref_not_raw
    check (
      secret_ref !~* '(eyJ|sbp_|vcp_|sk_live_|sk_test_|postgres(ql)?://)'
    ),
  constraint tenant_secret_refs_revoked_at_consistent
    check (
      (status = 'revoked' and revoked_at is not null)
      or (status <> 'revoked' and revoked_at is null)
    )
);

create unique index if not exists tenant_secret_refs_one_active_kind
  on public.tenant_secret_refs (tenant_id, secret_kind)
  where status = 'active';

create index if not exists tenant_secret_refs_project_kind_idx
  on public.tenant_secret_refs (project_ref, secret_kind, status);

comment on table public.tenant_secret_refs is
  'Server-side secret references for tenant setup. NO PHI. Raw values stay outside control-plane tables.';
comment on column public.tenant_secret_refs.secret_ref is
  'Reference only, for example vault:<uuid> or an Edge Function secret name. Never a raw credential.';

create table if not exists public.tenant_migration_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  provisioning_step_id uuid references public.tenant_provisioning_steps(id) on delete set null,
  project_ref text not null
    check (project_ref ~ '^[a-z0-9]{20}$'),
  runner_mode text not null default 'verify_only'
    check (runner_mode in ('verify_only','supabase_management_api','database_url')),
  status text not null default 'queued'
    check (status in ('queued','running','succeeded','failed','blocked','cancelled')),
  migration_source text not null default 'supabase/migrations',
  source_checksum text,
  expected_migrations_count integer not null default 0
    check (expected_migrations_count >= 0),
  applied_migrations_count integer not null default 0
    check (applied_migrations_count >= 0),
  failed_migration_version text,
  failed_migration_name text,
  last_error_code text,
  last_error_summary text
    check (last_error_summary is null or char_length(last_error_summary) <= 1000),
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.super_admins(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_migration_runs_completion_consistent
    check (
      (status in ('succeeded','failed','blocked','cancelled') and completed_at is not null)
      or status in ('queued','running')
    )
);

create index if not exists tenant_migration_runs_tenant_created_idx
  on public.tenant_migration_runs (tenant_id, created_at desc);

create index if not exists tenant_migration_runs_status_idx
  on public.tenant_migration_runs (status, created_at desc);

comment on table public.tenant_migration_runs is
  'Tenant DB migration/setup run ledger. Metadata only; no PHI or raw credentials.';

create table if not exists public.tenant_migration_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.tenant_migration_runs(id) on delete cascade,
  sequence_no integer not null
    check (sequence_no >= 0),
  version text not null
    check (version ~ '^[0-9]{12,20}$'),
  name text not null
    check (char_length(trim(name)) between 1 and 240),
  checksum text,
  status text not null default 'pending'
    check (status in ('pending','running','succeeded','failed','skipped')),
  error_code text,
  error_summary text
    check (error_summary is null or char_length(error_summary) <= 1000),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, version)
);

create index if not exists tenant_migration_items_run_sequence_idx
  on public.tenant_migration_items (run_id, sequence_no);

comment on table public.tenant_migration_items is
  'Per-migration status ledger for tenant DB setup. Metadata only.';

drop trigger if exists tenant_secret_refs_touch_updated_at on public.tenant_secret_refs;
create trigger tenant_secret_refs_touch_updated_at
  before update on public.tenant_secret_refs
  for each row execute function public.touch_updated_at();

drop trigger if exists tenant_migration_runs_touch_updated_at on public.tenant_migration_runs;
create trigger tenant_migration_runs_touch_updated_at
  before update on public.tenant_migration_runs
  for each row execute function public.touch_updated_at();

drop trigger if exists tenant_migration_items_touch_updated_at on public.tenant_migration_items;
create trigger tenant_migration_items_touch_updated_at
  before update on public.tenant_migration_items
  for each row execute function public.touch_updated_at();

alter table public.tenant_secret_refs enable row level security;
alter table public.tenant_migration_runs enable row level security;
alter table public.tenant_migration_items enable row level security;

drop policy if exists tenant_secret_refs_super_admin_select on public.tenant_secret_refs;
create policy tenant_secret_refs_super_admin_select
  on public.tenant_secret_refs
  for select to authenticated
  using (public.is_super_admin());

drop policy if exists tenant_migration_runs_super_admin_select on public.tenant_migration_runs;
create policy tenant_migration_runs_super_admin_select
  on public.tenant_migration_runs
  for select to authenticated
  using (public.is_super_admin());

drop policy if exists tenant_migration_items_super_admin_select on public.tenant_migration_items;
create policy tenant_migration_items_super_admin_select
  on public.tenant_migration_items
  for select to authenticated
  using (
    exists (
      select 1
      from public.tenant_migration_runs run
      where run.id = tenant_migration_items.run_id
        and public.is_super_admin()
    )
  );

create or replace function public.admin_read_vault_secret_ref(p_secret_ref text)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
  v_secret text;
begin
  if p_secret_ref is null or p_secret_ref !~* '^vault:[0-9a-f-]{36}$' then
    return null;
  end if;

  v_secret_id := replace(p_secret_ref, 'vault:', '')::uuid;

  select decrypted_secret
  into v_secret
  from vault.decrypted_secrets
  where id = v_secret_id;

  return v_secret;
end;
$$;

revoke all on function public.admin_read_vault_secret_ref(text) from public, anon, authenticated;
grant execute on function public.admin_read_vault_secret_ref(text) to service_role;

create or replace function public.admin_store_tenant_secret_ref(
  p_tenant_id uuid,
  p_project_ref text,
  p_secret_kind text,
  p_secret_storage text,
  p_secret_value text,
  p_secret_ref text,
  p_actor_id uuid
)
returns table (
  id uuid,
  tenant_id uuid,
  project_ref text,
  secret_kind text,
  secret_storage text,
  secret_ref text,
  status text,
  secret_last_rotated_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
  v_secret_ref text;
  v_project_ref text := lower(trim(coalesce(p_project_ref, '')));
  v_secret_kind text := lower(trim(coalesce(p_secret_kind, '')));
  v_secret_storage text := lower(trim(coalesce(p_secret_storage, '')));
begin
  if v_project_ref !~ '^[a-z0-9]{20}$' then
    raise exception 'INVALID_PROJECT_REF' using errcode = '22023';
  end if;

  if v_secret_kind not in ('service_role_key','database_url') then
    raise exception 'INVALID_SECRET_KIND' using errcode = '22023';
  end if;

  if v_secret_storage not in ('supabase_vault','edge_function_secret','external_secret_manager') then
    raise exception 'INVALID_SECRET_STORAGE' using errcode = '22023';
  end if;

  if not exists (select 1 from public.tenants t where t.id = p_tenant_id) then
    raise exception 'TENANT_NOT_FOUND' using errcode = '22023';
  end if;

  if v_secret_storage = 'supabase_vault' then
    if nullif(p_secret_value, '') is null or char_length(p_secret_value) < 20 then
      raise exception 'SECRET_VALUE_REQUIRED' using errcode = '22023';
    end if;

    v_secret_id := vault.create_secret(
      p_secret_value,
      'tenant/' || p_tenant_id::text || '/' || v_project_ref || '/' || v_secret_kind,
      'DoctoLeb tenant setup secret. Metadata only is stored in public tables.'
    );
    v_secret_ref := 'vault:' || v_secret_id::text;
  else
    v_secret_ref := trim(coalesce(p_secret_ref, ''));
    if nullif(v_secret_ref, '') is null or v_secret_ref ~* '(eyJ|sbp_|vcp_|sk_live_|sk_test_|postgres(ql)?://)' then
      raise exception 'SECRET_REF_INVALID' using errcode = '22023';
    end if;
  end if;

  update public.tenant_secret_refs
  set status = 'rotated',
      updated_by = p_actor_id,
      secret_last_rotated_at = now(),
      updated_at = now()
  where tenant_id = p_tenant_id
    and secret_kind = v_secret_kind
    and status = 'active';

  return query
  insert into public.tenant_secret_refs (
    tenant_id,
    project_ref,
    secret_kind,
    secret_storage,
    secret_ref,
    status,
    created_by,
    updated_by
  )
  values (
    p_tenant_id,
    v_project_ref,
    v_secret_kind,
    v_secret_storage,
    v_secret_ref,
    'active',
    p_actor_id,
    p_actor_id
  )
  returning
    tenant_secret_refs.id,
    tenant_secret_refs.tenant_id,
    tenant_secret_refs.project_ref,
    tenant_secret_refs.secret_kind,
    tenant_secret_refs.secret_storage,
    tenant_secret_refs.secret_ref,
    tenant_secret_refs.status,
    tenant_secret_refs.secret_last_rotated_at,
    tenant_secret_refs.created_at,
    tenant_secret_refs.updated_at;
end;
$$;

revoke all on function public.admin_store_tenant_secret_ref(uuid, text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_store_tenant_secret_ref(uuid, text, text, text, text, text, uuid) to service_role;

create or replace function public.admin_read_tenant_secret(
  p_tenant_id uuid,
  p_project_ref text,
  p_secret_kind text
)
returns table (
  secret_value text,
  secret_ref text,
  secret_storage text
)
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_ref public.tenant_secret_refs%rowtype;
begin
  select *
  into v_ref
  from public.tenant_secret_refs
  where status = 'active'
    and secret_kind = lower(trim(coalesce(p_secret_kind, '')))
    and (
      tenant_id = p_tenant_id
      or project_ref = lower(trim(coalesce(p_project_ref, '')))
    )
  order by updated_at desc
  limit 1;

  if not found then
    return;
  end if;

  if v_ref.secret_storage = 'supabase_vault' then
    return query select public.admin_read_vault_secret_ref(v_ref.secret_ref), v_ref.secret_ref, v_ref.secret_storage;
  else
    return query select null::text, v_ref.secret_ref, v_ref.secret_storage;
  end if;
end;
$$;

revoke all on function public.admin_read_tenant_secret(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_read_tenant_secret(uuid, text, text) to service_role;

create or replace function public.admin_revoke_tenant_secret_ref(
  p_tenant_id uuid,
  p_secret_kind text,
  p_actor_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_row public.tenant_secret_refs%rowtype;
  v_count integer := 0;
begin
  for v_row in
    select *
    from public.tenant_secret_refs
    where tenant_id = p_tenant_id
      and secret_kind = lower(trim(coalesce(p_secret_kind, '')))
      and status = 'active'
    for update
  loop
    update public.tenant_secret_refs
    set status = 'revoked',
        revoked_at = now(),
        updated_by = p_actor_id,
        updated_at = now()
    where id = v_row.id;

    if v_row.secret_storage = 'supabase_vault' and v_row.secret_ref ~* '^vault:[0-9a-f-]{36}$' then
      perform vault.update_secret(
        replace(v_row.secret_ref, 'vault:', '')::uuid,
        'revoked:' || v_row.id::text,
        null,
        'Revoked DoctoLeb tenant setup secret reference.'
      );
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.admin_revoke_tenant_secret_ref(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_revoke_tenant_secret_ref(uuid, text, uuid) to service_role;

create or replace function public.admin_store_provider_secret_ref(
  p_connection_id uuid,
  p_secret_value text,
  p_actor_id uuid
)
returns public.provisioning_provider_connections
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_connection public.provisioning_provider_connections%rowtype;
  v_secret_id uuid;
  v_secret_ref text;
begin
  select *
  into v_connection
  from public.provisioning_provider_connections
  where id = p_connection_id
  for update;

  if not found or v_connection.status = 'archived' then
    raise exception 'PROVIDER_CONNECTION_NOT_FOUND' using errcode = '22023';
  end if;

  if nullif(p_secret_value, '') is null or char_length(p_secret_value) < 20 then
    raise exception 'SECRET_VALUE_REQUIRED' using errcode = '22023';
  end if;

  if v_connection.secret_storage = 'supabase_vault'
    and v_connection.secret_ref ~* '^vault:[0-9a-f-]{36}$'
  then
    v_secret_id := replace(v_connection.secret_ref, 'vault:', '')::uuid;
    perform vault.update_secret(
      v_secret_id,
      p_secret_value,
      null,
      'DoctoLeb provider automation secret. Metadata only is stored in public tables.'
    );
  else
    v_secret_id := vault.create_secret(
      p_secret_value,
      'provider/' || v_connection.provider || '/' || p_connection_id::text,
      'DoctoLeb provider automation secret. Metadata only is stored in public tables.'
    );
  end if;

  v_secret_ref := 'vault:' || v_secret_id::text;

  update public.provisioning_provider_connections
  set secret_storage = 'supabase_vault',
      secret_ref = v_secret_ref,
      secret_last_rotated_at = now(),
      status = case
        when status in ('pending_authorization','error') then 'active'
        else status
      end,
      updated_by = p_actor_id,
      updated_at = now()
  where id = p_connection_id
  returning * into v_connection;

  return v_connection;
end;
$$;

revoke all on function public.admin_store_provider_secret_ref(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_store_provider_secret_ref(uuid, text, uuid) to service_role;

create or replace function public.admin_create_tenant_migration_run(
  p_tenant_id uuid,
  p_provisioning_step_id uuid,
  p_project_ref text,
  p_runner_mode text,
  p_status text,
  p_error_code text,
  p_error_summary text,
  p_actor_id uuid
)
returns public.tenant_migration_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.tenant_migration_runs%rowtype;
  v_status text := lower(trim(coalesce(p_status, 'blocked')));
begin
  if v_status not in ('queued','running','succeeded','failed','blocked','cancelled') then
    raise exception 'INVALID_MIGRATION_RUN_STATUS' using errcode = '22023';
  end if;

  insert into public.tenant_migration_runs (
    tenant_id,
    provisioning_step_id,
    project_ref,
    runner_mode,
    status,
    last_error_code,
    last_error_summary,
    started_at,
    completed_at,
    created_by
  )
  values (
    p_tenant_id,
    p_provisioning_step_id,
    lower(trim(p_project_ref)),
    lower(trim(coalesce(p_runner_mode, 'verify_only'))),
    v_status,
    p_error_code,
    p_error_summary,
    now(),
    case when v_status in ('succeeded','failed','blocked','cancelled') then now() else null end,
    p_actor_id
  )
  returning * into v_run;

  return v_run;
end;
$$;

revoke all on function public.admin_create_tenant_migration_run(uuid, uuid, text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_create_tenant_migration_run(uuid, uuid, text, text, text, text, text, uuid) to service_role;

insert into public.tenant_events (tenant_id, event_type, metadata)
select null, 'control_plane.tenant_db_setup_automation_applied', jsonb_build_object(
  'tenantSecretRefs', true,
  'migrationRuns', true,
  'migrationItems', true,
  'vaultSecretReferences', true,
  'phi', false
)
where not exists (
  select 1
  from public.tenant_events
  where event_type = 'control_plane.tenant_db_setup_automation_applied'
);
