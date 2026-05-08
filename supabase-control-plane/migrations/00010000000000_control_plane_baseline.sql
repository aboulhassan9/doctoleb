-- ─── DoctoLeb Control Plane · baseline ───
-- Stores tenant routing/provisioning metadata only. NO PHI.
--
-- This migration is for the SEPARATE control-plane Supabase project
-- (e.g. `doctoleb-control-plane`). It MUST NOT be applied to any tenant DB.
--
-- @see CONTROL_PLANE_SETUP.md §3
-- @see docs/decisions/ADR-004-domain-routing-and-control-plane-contract.md

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- tenants
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.tenants (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text unique not null
    check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'),
  display_name          text not null,
  status                text not null default 'provisioning'
    check (status in ('provisioning','active','inactive','suspended','maintenance')),
  plan                  text default 'starter',
  release_channel       text not null default 'stable'
    check (release_channel in ('stable','beta')),
  supabase_project_ref  text not null,
  supabase_url          text not null,
  supabase_anon_key     text not null,    -- anon keys are public; never store service-role here
  schema_version        text,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists tenants_status_idx on public.tenants (status);

comment on table public.tenants is
  'Tenant registry. One row per DoctoLeb tenant (clinic). NO PHI.';
comment on column public.tenants.supabase_anon_key is
  'Anon (publishable) key only. Service-role keys must never be stored here.';

-- ───────────────────────────────────────────────────────────────────────────
-- tenant_domains
-- One tenant may have multiple hostnames (subdomain + custom).
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.tenant_domains (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete restrict,
  hostname            text not null,
  surface             text not null check (surface in ('patient','ops')),
  status              text not null default 'pending'
    check (status in ('pending','active','disabled')),
  dns_status          text check (dns_status in ('verified','pending','failed')),
  ssl_status          text check (ssl_status in ('issued','pending','failed')),
  constraint tenant_domains_hostname_normalized_chk
    check (hostname = lower(trim(hostname))),
  verification_token  text,
  verified_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create or replace function public.normalize_tenant_domain_hostname()
returns trigger
language plpgsql
as $$
begin
  new.hostname = lower(trim(new.hostname));
  return new;
end;
$$;

revoke all on function public.normalize_tenant_domain_hostname() from public;
revoke execute on function public.normalize_tenant_domain_hostname() from public, anon, authenticated;

drop trigger if exists tenant_domains_normalize_hostname on public.tenant_domains;
create trigger tenant_domains_normalize_hostname
  before insert or update of hostname on public.tenant_domains
  for each row execute function public.normalize_tenant_domain_hostname();

create index if not exists tenant_domains_tenant_idx on public.tenant_domains (tenant_id);
create unique index if not exists tenant_domains_hostname_lower_unique_idx
  on public.tenant_domains (lower(hostname));
create index if not exists tenant_domains_hostname_active_idx
  on public.tenant_domains (lower(hostname))
  where status = 'active';

comment on table public.tenant_domains is
  'Hostname → tenant surface mapping. Drives the resolver endpoint.';

-- ───────────────────────────────────────────────────────────────────────────
-- super_admins
-- DoctoLeb owners/operators. Linked to control-plane auth.users.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.super_admins (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid unique not null,   -- references auth.users(id) — soft FK
  display_name    text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  last_login_at   timestamptz
);

create index if not exists super_admins_active_idx on public.super_admins (is_active);

-- ───────────────────────────────────────────────────────────────────────────
-- tenant_events (audit log for control-plane actions)
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.tenant_events (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid references public.tenants(id) on delete set null,
  event_type   text not null,
  actor_id     uuid,                                -- super_admins.id, or null for system
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists tenant_events_tenant_idx on public.tenant_events (tenant_id, created_at desc);
create index if not exists tenant_events_type_idx on public.tenant_events (event_type, created_at desc);

-- ───────────────────────────────────────────────────────────────────────────
-- updated_at trigger helper
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.touch_updated_at() from public;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

drop trigger if exists tenants_touch_updated_at on public.tenants;
create trigger tenants_touch_updated_at
  before update on public.tenants
  for each row execute function public.touch_updated_at();

drop trigger if exists tenant_domains_touch_updated_at on public.tenant_domains;
create trigger tenant_domains_touch_updated_at
  before update on public.tenant_domains
  for each row execute function public.touch_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- is_super_admin() helper
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.super_admins sa
    where sa.auth_user_id = auth.uid()
      and sa.is_active = true
  );
$$;

revoke all on function public.is_super_admin() from public;
grant execute on function public.is_super_admin() to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- RLS
-- ───────────────────────────────────────────────────────────────────────────

alter table public.tenants enable row level security;
alter table public.tenant_domains enable row level security;
alter table public.super_admins enable row level security;
alter table public.tenant_events enable row level security;

-- tenants — super-admins only
drop policy if exists tenants_super_admin_select on public.tenants;
create policy tenants_super_admin_select on public.tenants
  for select to authenticated
  using (public.is_super_admin());

drop policy if exists tenants_super_admin_insert on public.tenants;
create policy tenants_super_admin_insert on public.tenants
  for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists tenants_super_admin_update on public.tenants;
create policy tenants_super_admin_update on public.tenants
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists tenants_super_admin_delete on public.tenants;
create policy tenants_super_admin_delete on public.tenants
  for delete to authenticated
  using (public.is_super_admin());

-- tenant_domains — super-admins only
drop policy if exists tenant_domains_super_admin_select on public.tenant_domains;
create policy tenant_domains_super_admin_select on public.tenant_domains
  for select to authenticated
  using (public.is_super_admin());

drop policy if exists tenant_domains_super_admin_insert on public.tenant_domains;
create policy tenant_domains_super_admin_insert on public.tenant_domains
  for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists tenant_domains_super_admin_update on public.tenant_domains;
create policy tenant_domains_super_admin_update on public.tenant_domains
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists tenant_domains_super_admin_delete on public.tenant_domains;
create policy tenant_domains_super_admin_delete on public.tenant_domains
  for delete to authenticated
  using (public.is_super_admin());

-- super_admins — self-read; super-admin write
drop policy if exists super_admins_self_select on public.super_admins;
create policy super_admins_self_select on public.super_admins
  for select to authenticated
  using (auth_user_id = auth.uid() or public.is_super_admin());

drop policy if exists super_admins_super_admin_insert on public.super_admins;
create policy super_admins_super_admin_insert on public.super_admins
  for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists super_admins_super_admin_update on public.super_admins;
create policy super_admins_super_admin_update on public.super_admins
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- tenant_events — super-admins read; service-role-only insert (no client policy)
drop policy if exists tenant_events_super_admin_select on public.tenant_events;
create policy tenant_events_super_admin_select on public.tenant_events
  for select to authenticated
  using (public.is_super_admin());

-- ───────────────────────────────────────────────────────────────────────────
-- Public-safe resolver function
--
-- Returns { data, error } as jsonb. Callable by anon because hostnames and
-- anon keys are inherently public; the security boundary is RLS on the
-- tenant DB, which the anon key cannot bypass.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.resolve_tenant(
  p_host text,
  p_surface text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row record;
  v_canonical text;
begin
  if p_host is null or length(trim(p_host)) = 0 then
    return jsonb_build_object('data', null, 'error', 'INVALID_REQUEST');
  end if;

  if p_surface not in ('patient','ops') then
    return jsonb_build_object('data', null, 'error', 'INVALID_REQUEST');
  end if;

  select
    t.id            as tenant_id,
    t.slug,
    t.status        as tenant_status,
    t.supabase_url,
    t.supabase_anon_key,
    t.schema_version,
    d.surface       as domain_surface,
    d.status        as domain_status,
    d.hostname
  into v_row
  from public.tenant_domains d
  join public.tenants t on t.id = d.tenant_id
  where lower(d.hostname) = lower(trim(p_host))
  limit 1;

  if not found then
    return jsonb_build_object('data', null, 'error', 'TENANT_NOT_FOUND');
  end if;

  if v_row.domain_surface <> p_surface then
    return jsonb_build_object('data', null, 'error', 'SURFACE_MISMATCH');
  end if;

  if v_row.tenant_status <> 'active'
     or v_row.domain_status <> 'active' then
    return jsonb_build_object('data', null, 'error', 'TENANT_INACTIVE');
  end if;

  -- Pick the first active domain of this surface as the canonical host.
  select hostname into v_canonical
  from public.tenant_domains
  where tenant_id = v_row.tenant_id
    and surface = p_surface
    and status = 'active'
  order by created_at asc
  limit 1;

  return jsonb_build_object(
    'data', jsonb_build_object(
      'tenantId', v_row.tenant_id,
      'slug', v_row.slug,
      'surface', p_surface,
      'status', v_row.tenant_status,
      'supabaseUrl', v_row.supabase_url,
      'supabaseAnonKey', v_row.supabase_anon_key,
      'schemaVersion', coalesce(v_row.schema_version, 'unknown'),
      'canonicalHost', coalesce(v_canonical, v_row.hostname)
    ),
    'error', null
  );
end;
$$;

revoke all on function public.resolve_tenant(text, text) from public;
grant execute on function public.resolve_tenant(text, text) to anon, authenticated;

comment on function public.resolve_tenant(text, text) is
  'Public-safe tenant connection resolver. Returns { data, error } jsonb. NO PHI.';
