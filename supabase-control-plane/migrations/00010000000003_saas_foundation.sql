-- DoctoLeb Control Plane · SaaS foundation
-- Adds plan/entitlement/provisioning metadata only. NO PHI.
--
-- Apply only to the control-plane Supabase project:
--   xouqxgwccewvbtkqming

-- ───────────────────────────────────────────────────────────────────────────
-- role-aware super admins
-- ───────────────────────────────────────────────────────────────────────────

alter table public.super_admins
  add column if not exists role text not null default 'owner';

alter table public.super_admins
  drop constraint if exists super_admins_role_check;

alter table public.super_admins
  add constraint super_admins_role_check
  check (role in ('owner','operator','support','billing_admin'));

create index if not exists super_admins_role_active_idx
  on public.super_admins (role, is_active);

create or replace function public.has_super_admin_role(required_roles text[] default array[]::text[])
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
      and (
        cardinality(coalesce(required_roles, array[]::text[])) = 0
        or sa.role = 'owner'
        or sa.role = any(required_roles)
      )
  );
$$;

revoke all on function public.has_super_admin_role(text[]) from public;
grant execute on function public.has_super_admin_role(text[]) to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- plans
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.plans (
  code text primary key
    check (code ~ '^[a-z0-9](?:[a-z0-9_ -]{0,61}[a-z0-9])?$'),
  name text not null,
  status text not null default 'active'
    check (status in ('draft','active','archived')),
  billing_mode text not null default 'manual'
    check (billing_mode in ('manual','stripe')),
  price_label text,
  stripe_product_lookup_key text,
  description text,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plans_status_sort_idx
  on public.plans (status, sort_order);

comment on table public.plans is
  'Commercial SaaS plans for DoctoLeb clinics. NO PHI.';

-- ───────────────────────────────────────────────────────────────────────────
-- plan_entitlements
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.plan_entitlements (
  id uuid primary key default gen_random_uuid(),
  plan_code text not null references public.plans(code) on delete cascade,
  feature_code text not null
    check (feature_code ~ '^[a-z0-9](?:[a-z0-9_ -]{0,80}[a-z0-9])?$'),
  is_enabled boolean not null default false,
  limits jsonb not null default '{}'::jsonb
    check (jsonb_typeof(limits) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_code, feature_code)
);

create index if not exists plan_entitlements_feature_idx
  on public.plan_entitlements (feature_code);

comment on table public.plan_entitlements is
  'Default feature grants per commercial plan. NO PHI.';

-- ───────────────────────────────────────────────────────────────────────────
-- tenant_entitlements
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.tenant_entitlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  feature_code text not null
    check (feature_code ~ '^[a-z0-9](?:[a-z0-9_ -]{0,80}[a-z0-9])?$'),
  source text not null default 'manual_override'
    check (source in ('plan','addon','manual_override')),
  is_enabled boolean not null default true,
  limits jsonb not null default '{}'::jsonb
    check (jsonb_typeof(limits) = 'object'),
  reason text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, feature_code, source)
);

create index if not exists tenant_entitlements_tenant_feature_idx
  on public.tenant_entitlements (tenant_id, feature_code);
create index if not exists tenant_entitlements_enabled_idx
  on public.tenant_entitlements (is_enabled)
  where is_enabled = true;

comment on table public.tenant_entitlements is
  'Per-tenant add-ons and manual overrides. NO PHI.';

-- ───────────────────────────────────────────────────────────────────────────
-- tenant_provisioning_jobs
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.tenant_provisioning_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  requested_slug text not null
    check (requested_slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'),
  requested_display_name text not null,
  requested_plan text not null default 'starter',
  requested_domains jsonb not null default '[]'::jsonb
    check (jsonb_typeof(requested_domains) = 'array'),
  initial_branding jsonb not null default '{}'::jsonb
    check (jsonb_typeof(initial_branding) = 'object'),
  status text not null default 'draft'
    check (status in ('draft','ready_for_manual_provisioning','provisioning','blocked','completed','cancelled')),
  checklist jsonb not null default '{}'::jsonb
    check (jsonb_typeof(checklist) = 'object'),
  assigned_admin_id uuid references public.super_admins(id) on delete set null,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists tenant_provisioning_jobs_status_idx
  on public.tenant_provisioning_jobs (status, created_at desc);
create index if not exists tenant_provisioning_jobs_tenant_idx
  on public.tenant_provisioning_jobs (tenant_id);

comment on table public.tenant_provisioning_jobs is
  'Manual-assisted tenant onboarding checklist. Contains SaaS metadata only. NO PHI.';

-- ───────────────────────────────────────────────────────────────────────────
-- updated_at triggers
-- ───────────────────────────────────────────────────────────────────────────

drop trigger if exists plans_touch_updated_at on public.plans;
create trigger plans_touch_updated_at
  before update on public.plans
  for each row execute function public.touch_updated_at();

drop trigger if exists plan_entitlements_touch_updated_at on public.plan_entitlements;
create trigger plan_entitlements_touch_updated_at
  before update on public.plan_entitlements
  for each row execute function public.touch_updated_at();

drop trigger if exists tenant_entitlements_touch_updated_at on public.tenant_entitlements;
create trigger tenant_entitlements_touch_updated_at
  before update on public.tenant_entitlements
  for each row execute function public.touch_updated_at();

drop trigger if exists tenant_provisioning_jobs_touch_updated_at on public.tenant_provisioning_jobs;
create trigger tenant_provisioning_jobs_touch_updated_at
  before update on public.tenant_provisioning_jobs
  for each row execute function public.touch_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- RLS
-- ───────────────────────────────────────────────────────────────────────────

alter table public.plans enable row level security;
alter table public.plan_entitlements enable row level security;
alter table public.tenant_entitlements enable row level security;
alter table public.tenant_provisioning_jobs enable row level security;

drop policy if exists plans_super_admin_select on public.plans;
create policy plans_super_admin_select on public.plans
  for select to authenticated
  using (public.is_super_admin());

drop policy if exists plans_billing_write on public.plans;
create policy plans_billing_write on public.plans
  for all to authenticated
  using (public.has_super_admin_role(array['billing_admin']))
  with check (public.has_super_admin_role(array['billing_admin']));

drop policy if exists plan_entitlements_super_admin_select on public.plan_entitlements;
create policy plan_entitlements_super_admin_select on public.plan_entitlements
  for select to authenticated
  using (public.is_super_admin());

drop policy if exists plan_entitlements_billing_write on public.plan_entitlements;
create policy plan_entitlements_billing_write on public.plan_entitlements
  for all to authenticated
  using (public.has_super_admin_role(array['billing_admin']))
  with check (public.has_super_admin_role(array['billing_admin']));

drop policy if exists tenant_entitlements_super_admin_select on public.tenant_entitlements;
create policy tenant_entitlements_super_admin_select on public.tenant_entitlements
  for select to authenticated
  using (public.is_super_admin());

drop policy if exists tenant_entitlements_operator_write on public.tenant_entitlements;
create policy tenant_entitlements_operator_write on public.tenant_entitlements
  for all to authenticated
  using (public.has_super_admin_role(array['operator','billing_admin']))
  with check (public.has_super_admin_role(array['operator','billing_admin']));

drop policy if exists tenant_provisioning_jobs_super_admin_select on public.tenant_provisioning_jobs;
create policy tenant_provisioning_jobs_super_admin_select on public.tenant_provisioning_jobs
  for select to authenticated
  using (public.is_super_admin());

drop policy if exists tenant_provisioning_jobs_operator_write on public.tenant_provisioning_jobs;
create policy tenant_provisioning_jobs_operator_write on public.tenant_provisioning_jobs
  for all to authenticated
  using (public.has_super_admin_role(array['operator']))
  with check (public.has_super_admin_role(array['operator']));

-- ───────────────────────────────────────────────────────────────────────────
-- seed current commercial defaults
-- ───────────────────────────────────────────────────────────────────────────

insert into public.plans (code, name, status, billing_mode, price_label, description, sort_order)
values
  ('starter', 'Starter Clinic', 'active', 'manual', 'Manual pilot', 'Core scheduling, patient portal, and clinic messaging for an early clinic tenant.', 10),
  ('growth', 'Growth Clinic', 'active', 'manual', 'Manual pilot', 'Adds custom branding, larger staff teams, and operational reporting.', 20),
  ('scale', 'Scale Clinic', 'active', 'manual', 'Manual pilot', 'Adds AI, BI, custom domains, and advanced reporting controls.', 30)
on conflict (code) do update
set
  name = excluded.name,
  status = excluded.status,
  billing_mode = excluded.billing_mode,
  price_label = excluded.price_label,
  description = excluded.description,
  sort_order = excluded.sort_order;

insert into public.plan_entitlements (plan_code, feature_code, is_enabled, limits)
values
  ('starter', 'messaging', true, '{"monthlyThreads": 100}'::jsonb),
  ('starter', 'staff_accounts', true, '{"maxStaff": 2}'::jsonb),
  ('starter', 'custom_branding', false, '{}'::jsonb),
  ('starter', 'custom_domain', false, '{}'::jsonb),
  ('starter', 'ai_clinical_summary', false, '{}'::jsonb),
  ('starter', 'bi_dashboard', false, '{}'::jsonb),
  ('starter', 'advanced_reports', false, '{}'::jsonb),
  ('growth', 'messaging', true, '{"monthlyThreads": 1000}'::jsonb),
  ('growth', 'staff_accounts', true, '{"maxStaff": 8}'::jsonb),
  ('growth', 'custom_branding', true, '{}'::jsonb),
  ('growth', 'custom_domain', false, '{}'::jsonb),
  ('growth', 'ai_clinical_summary', false, '{}'::jsonb),
  ('growth', 'bi_dashboard', false, '{}'::jsonb),
  ('growth', 'advanced_reports', true, '{"savedReports": 10}'::jsonb),
  ('scale', 'messaging', true, '{"monthlyThreads": 10000}'::jsonb),
  ('scale', 'staff_accounts', true, '{"maxStaff": 50}'::jsonb),
  ('scale', 'custom_branding', true, '{}'::jsonb),
  ('scale', 'custom_domain', true, '{"maxDomains": 3}'::jsonb),
  ('scale', 'ai_clinical_summary', true, '{"monthlyRuns": 250}'::jsonb),
  ('scale', 'bi_dashboard', true, '{"dashboards": 5}'::jsonb),
  ('scale', 'advanced_reports', true, '{"savedReports": 50}'::jsonb)
on conflict (plan_code, feature_code) do update
set
  is_enabled = excluded.is_enabled,
  limits = excluded.limits;

insert into public.tenant_events (tenant_id, event_type, metadata)
select null, 'saas_foundation.migration_applied', jsonb_build_object(
  'tables', array['plans','plan_entitlements','tenant_entitlements','tenant_provisioning_jobs'],
  'phi', false
)
where not exists (
  select 1
  from public.tenant_events
  where event_type = 'saas_foundation.migration_applied'
);
