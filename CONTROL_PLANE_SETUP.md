# DoctoLeb · Control Plane Setup Runbook

> **When to follow this**: when you are ready to onboard a second tenant, deploy custom domains, or build the SaaS super-admin UI. Not before. The runtime layer (ADR-004 Slices B–F, already shipped) works against a single tenant via DEV env fallback.
> **Companion docs**: `docs/decisions/ADR-004-domain-routing-and-control-plane-contract.md`, `BACKEND_CONTRACT_LEDGER.md`.
> **Estimated effort**: ½ day for steps 1–5 (control plane DB live + dev tenant in registry); +1 day for step 6 (resolver endpoint live); +2–3 days for step 7 (super-admin UI, optional v1).

---

## Activation status — 2026-05-08

- SaaS/control-plane project: `xouqxgwccewvbtkqming`.
- First tenant/clinical DB: `gezmfmskhmjgnquoyosq`.
- Seeded tenant slug: `dev`.
- Live resolver URL: `https://xouqxgwccewvbtkqming.supabase.co/functions/v1/tenant-resolve`.
- Resolver version: deployed as Supabase Edge Function version 2 with host normalization, public response validation, `nosniff`, `no-referrer`, no-index headers, success cache `public, max-age=60, s-maxage=300, stale-while-revalidate=60`, and `no-store` on errors.
- Admin tenant update version: `admin-update-tenant` Edge Function version 4, backed by service-role-only RPC `admin_update_tenant_atomic` so tenant/domain updates and audit insertion commit atomically.
- Active resolver hostnames for development: `localhost:3001`, `localhost:3002`.
- Future domain placeholders: `dev.doctoleb.com`, `dev.ops.doctoleb.com`.
- Domain readiness: **not ready for public DNS/production traffic yet** because `doctoleb.com` has not been purchased/verified. Keep the future domain rows `pending` until the domain is owned and DNS/SSL are verified.
- No-domain deployment mode is supported: Vercel-provided hosts can be categorized with `VITE_MARKETING_HOSTS`, `VITE_CONTROL_PLANE_HOSTS`, `VITE_PATIENT_TENANT_HOSTS`, and `VITE_OPS_TENANT_HOSTS` so the app can run before `doctoleb.com` exists.
- Current Vercel projects live under `aboulhassan-salehs-projects` and deploy from the GitHub repo `aboulhassan9/doctoleb` through GitHub Actions:
  - `doctoleb-patient-web` → `https://doctoleb-patient-web.vercel.app`
  - `doctoleb-clinic-ops` → `https://doctoleb-clinic-ops.vercel.app`
  - `doctoleb-control-plane` → `https://doctoleb-control-plane.vercel.app`
- Deployment automation lives in `.github/workflows/ci.yml`. Pushes to `main` run `npm run verify`, build each Vercel project with production Vercel env, block patient/ops bundles that contain tenant fallback key material, deploy all three projects, and smoke-test the stable Vercel aliases.
- Current scope intentionally excludes super-admin UI, billing, domain self-service, and automated tenant provisioning.

The migration source of truth starts at `supabase-control-plane/migrations/00010000000000_control_plane_baseline.sql`. It treats `maintenance` tenants as `TENANT_INACTIVE`, normalizes hostnames with `lower(trim(hostname))`, enforces case-insensitive hostname uniqueness, and revokes direct public execution of internal helper functions.

When the domain is purchased, activate the placeholder rows only after DNS and SSL are actually ready:

```sql
update public.tenant_domains
set status = 'active',
    dns_status = 'verified',
    ssl_status = 'issued',
    verified_at = now()
where hostname in ('dev.doctoleb.com', 'dev.ops.doctoleb.com');
```

---

## 0. Why a second Supabase project

Per ADR-004 §10:

- The control plane is a **separate Supabase project** (e.g. `doctoleb-control-plane`).
- It stores **routing/provisioning metadata only — no PHI**.
- It exposes a **public-safe resolver endpoint** that maps `(hostname, surface) → tenant Supabase connection`.
- It **never returns service-role keys** to the browser. Anon keys are public and may flow through it.

Tenant DBs (current: `gezmfmskhmjgnquoyosq`) remain unchanged. Each tenant gets its own isolated Supabase project with the full DoctoLeb schema. The control plane only knows *that they exist*, not *what is in them*.

---

## 1. Prerequisites

- A Supabase account that can create new projects (the same account that owns `gezmfmskhmjgnquoyosq`, or a separate org account if you want billing isolation).
- The Supabase CLI installed locally: `npm install -g supabase` (or use `npx supabase`).
- A code editor with access to this repo at `G:\project\doctoleb`.
- The current dev tenant's Supabase project ref + URL + anon key. In this workspace they live in `.env.local`:

```bash
# Existing values — read from G:\project\doctoleb\.env.local
VITE_SUPABASE_URL=https://gezmfmskhmjgnquoyosq.supabase.co
VITE_SUPABASE_ANON_KEY=<existing-anon-key>
VITE_DEV_TENANT_SLUG=dev
VITE_TENANT_RESOLVER_URL=https://xouqxgwccewvbtkqming.supabase.co/functions/v1/tenant-resolve
VITE_TENANT_RESOLVER_TIMEOUT_MS=6000
VITE_PUBLIC_PRIMARY_DOMAIN=doctoleb.com
VITE_MARKETING_HOSTS=
VITE_CONTROL_PLANE_HOSTS=
VITE_PATIENT_TENANT_HOSTS=
VITE_OPS_TENANT_HOSTS=
VITE_PATIENT_WEB_URL=http://127.0.0.1:3001
VITE_CLINIC_OPS_URL=http://127.0.0.1:3002
```

No-domain production/preview deployment:

- Put the exact Vercel marketing deployment hostname in `VITE_MARKETING_HOSTS`; that host renders the doctor-facing marketing site and never calls the tenant resolver.
- Put the exact Vercel SaaS console deployment hostname in `VITE_CONTROL_PLANE_HOSTS`; that host renders the zero-PHI control-plane console.
- Put tenant patient/ops Vercel deployment hostnames in `VITE_PATIENT_TENANT_HOSTS` / `VITE_OPS_TENANT_HOSTS` only when those hosts should resolve through `tenant-resolve`.
- For tenant Vercel hostnames, insert matching `tenant_domains` rows in the control plane with the correct `surface`. The real `dev.doctoleb.com` rows still stay `pending` until ownership, DNS, and SSL are verified.
- The SaaS console domain panel can update existing `tenant_domains.status`, `dns_status`, and `ssl_status` rows. It will keep a non-local domain pending unless DNS is `verified` and SSL is `issued`; the `admin_update_tenant_atomic` RPC enforces the same rule server-side.
- When `doctoleb.com` is purchased later, set DNS/SSL, activate the real domain rows, set `VITE_PUBLIC_PRIMARY_DOMAIN=doctoleb.com`, and remove the temporary Vercel hostnames after traffic is migrated.

GitHub-to-Vercel deployment automation:

- GitHub repo: `aboulhassan9/doctoleb`.
- GitHub secret required: `VERCEL_TOKEN` (do not print or commit it; store the raw token only, with no BOM or surrounding whitespace).
- GitHub variable required: `VERCEL_ORG_ID=team_7UDdQ1lrRxxkah4dh5Jw95RE`.
- The workflow writes `.vercel/project.json` inside the ephemeral GitHub runner for each matrix project. This avoids committing `.vercel/` metadata and keeps the three Vercel project IDs controlled in one workflow.
- Keep `package-lock.json` compatible with the workflow's Node/npm runner before changing deployment dependencies; Vite/Rolldown optional native packages must pass `npm ci` on GitHub's Linux runner.
- Root `vercel.json` owns the shared Vite SPA fallback, rewriting direct app routes such as `/login` to `/index.html` after static assets are considered.
- Vercel project settings still own app-specific build commands and public runtime env values. Do not add service-role keys to Vite env variables.
- Undo path: disable or delete `.github/workflows/ci.yml` deployment jobs, remove the GitHub secret/variable, and continue using manual `vercel deploy --prebuilt --prod` until a replacement deploy path exists.

Tier choice:
- **Free tier**: fine for development and the first few weeks. Auto-pauses after a week of inactivity, which is unsafe for production. 2 projects free per org.
- **Pro tier ($25/mo per project)**: required before any real tenant data lands. Provides PITR, daily backups, no auto-pause. Healthcare data without these is not safe.

---

## 2. Create the control-plane project

In the Supabase dashboard:

1. Click **New project**.
2. Name: `doctoleb-control-plane`.
3. Region: same region as your tenant DBs (lower latency for cross-project automation later).
4. Database password: generate a strong one and save it to your password manager.
5. Wait ~2 minutes for provisioning.
6. Once green, copy:
   - **Project ref** (e.g. `abcd1234efgh5678ijkl`)
   - **API URL** (https://`<ref>`.supabase.co)
   - **anon (public) key** — Settings → API
   - **service_role key** — Settings → API → "Reveal" — **store securely; never commit; never expose to a browser**

Add a new repo folder for control-plane code (this stays sibling to the existing `supabase/migrations/` for the tenant DB):

```bash
mkdir supabase-control-plane
mkdir supabase-control-plane/migrations
mkdir supabase-control-plane/functions
```

> Why a sibling tree, not `supabase/control-plane/`: the Supabase CLI scopes itself to a single project ref via `supabase/config.toml`. Keeping the two projects' SQL/functions in physically separate trees lets you `supabase link` each one independently without confusion.

---

## 3. Control-plane schema

Create `supabase-control-plane/migrations/00010000000000_control_plane_baseline.sql` with the following content. Apply it via `supabase db push` after `supabase link --project-ref <new-ref>`, or paste it into the SQL editor in the dashboard for the control-plane project.

```sql
-- ─── DoctoLeb Control Plane · baseline ───
-- Stores tenant routing/provisioning metadata only. NO PHI.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ── tenants ──
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null
    check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'),
  display_name text not null,
  status text not null default 'provisioning'
    check (status in ('provisioning','active','inactive','suspended','maintenance')),
  plan text default 'starter',
  release_channel text not null default 'stable'
    check (release_channel in ('stable','beta')),
  supabase_project_ref text not null,
  supabase_url text not null,
  supabase_anon_key text not null,
  schema_version text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tenants_status_idx on public.tenants (status);

-- ── tenant_domains ──
-- One tenant may have multiple hostnames (subdomain + custom).
create table if not exists public.tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  hostname text unique not null,
  surface text not null check (surface in ('patient','ops')),
  status text not null default 'pending'
    check (status in ('pending','active','disabled')),
  dns_status text check (dns_status in ('verified','pending','failed')),
  ssl_status text check (ssl_status in ('issued','pending','failed')),
  verification_token text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tenant_domains_tenant_idx on public.tenant_domains (tenant_id);
create index if not exists tenant_domains_hostname_active_idx
  on public.tenant_domains (hostname)
  where status = 'active';

-- ── super_admins ──
-- DoctoLeb owners/operators. Linked to control-plane auth.users.
create table if not exists public.super_admins (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null,  -- references auth.users(id) — soft FK, auth schema is owned by Supabase
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create index if not exists super_admins_active_idx on public.super_admins (is_active);

-- ── tenant_events (audit log) ──
create table if not exists public.tenant_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  event_type text not null,
  actor_id uuid,                    -- super_admins.id (for human actions) or null (system)
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tenant_events_tenant_idx on public.tenant_events (tenant_id, created_at desc);
create index if not exists tenant_events_type_idx on public.tenant_events (event_type, created_at desc);

-- ── updated_at triggers ──
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tenants_touch_updated_at on public.tenants;
create trigger tenants_touch_updated_at
  before update on public.tenants
  for each row execute function public.touch_updated_at();

drop trigger if exists tenant_domains_touch_updated_at on public.tenant_domains;
create trigger tenant_domains_touch_updated_at
  before update on public.tenant_domains
  for each row execute function public.touch_updated_at();

-- ── Helper: is_super_admin() ──
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

-- ── RLS ──
alter table public.tenants enable row level security;
alter table public.tenant_domains enable row level security;
alter table public.super_admins enable row level security;
alter table public.tenant_events enable row level security;

-- tenants: super-admins can read/write; nobody else.
create policy tenants_super_admin_select on public.tenants
  for select to authenticated
  using (public.is_super_admin());

create policy tenants_super_admin_insert on public.tenants
  for insert to authenticated
  with check (public.is_super_admin());

create policy tenants_super_admin_update on public.tenants
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy tenants_super_admin_delete on public.tenants
  for delete to authenticated
  using (public.is_super_admin());

-- tenant_domains: same.
create policy tenant_domains_super_admin_select on public.tenant_domains
  for select to authenticated
  using (public.is_super_admin());

create policy tenant_domains_super_admin_insert on public.tenant_domains
  for insert to authenticated
  with check (public.is_super_admin());

create policy tenant_domains_super_admin_update on public.tenant_domains
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy tenant_domains_super_admin_delete on public.tenant_domains
  for delete to authenticated
  using (public.is_super_admin());

-- super_admins: each user can read their own row; only existing super-admins can write.
create policy super_admins_self_select on public.super_admins
  for select to authenticated
  using (auth_user_id = auth.uid() or public.is_super_admin());

create policy super_admins_super_admin_write on public.super_admins
  for insert to authenticated
  with check (public.is_super_admin());

create policy super_admins_super_admin_update on public.super_admins
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- tenant_events: super-admins read all; insert is service-role only (via Edge Function).
create policy tenant_events_super_admin_select on public.tenant_events
  for select to authenticated
  using (public.is_super_admin());

-- ── Public-safe resolver function ──
-- Returns the tenant connection blob for a given (hostname, surface).
-- Callable by anon (because hostnames are inherently public) — and that's
-- fine because anon keys are also public; the actual security boundary is
-- RLS on the tenant DB, which the anon key cannot bypass.
--
-- Returns shape (matches the resolver client contract):
--   { tenantId, slug, surface, status, supabaseUrl, supabaseAnonKey,
--     schemaVersion, canonicalHost }
-- ...via JSON.

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
  where lower(d.hostname) = lower(p_host)
  limit 1;

  if not found then
    return jsonb_build_object('data', null, 'error', 'TENANT_NOT_FOUND');
  end if;

  if v_row.domain_surface <> p_surface then
    return jsonb_build_object('data', null, 'error', 'SURFACE_MISMATCH');
  end if;

  if v_row.tenant_status not in ('active','maintenance')
     or v_row.domain_status <> 'active' then
    return jsonb_build_object('data', null, 'error', 'TENANT_INACTIVE');
  end if;

  -- Pick the first active patient/ops domain for this tenant as the canonical host.
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
```

Apply it:

```bash
# Option A: via Supabase CLI from the repo root
supabase link --project-ref <new-control-plane-ref>
# (CLI will pick up supabase-control-plane/migrations/ if you set the
#  config.toml workdir; alternatively, use the Studio SQL editor)

# Option B: paste into the Studio SQL editor for the control-plane project.
```

Verify in the Studio that:
- 4 tables exist: `tenants`, `tenant_domains`, `super_admins`, `tenant_events`.
- RLS is enabled on all four.
- `resolve_tenant(text, text)` is callable.

---

## 4. Seed the dev tenant as row #1

Open the SQL editor in the **control-plane** project and run:

```sql
-- Seed: existing dev project becomes "tenant 1" in the registry.
-- Replace the anon key below with the actual key from your tenant project's
-- Settings → API page (the one currently in your apps' .env).

insert into public.tenants (
  id, slug, display_name, status, plan, release_channel,
  supabase_project_ref, supabase_url, supabase_anon_key,
  schema_version, notes
) values (
  gen_random_uuid(),
  'dev',                                                -- slug
  'DoctoLeb Development Tenant',                        -- display name
  'active',
  'starter',
  'stable',
  'gezmfmskhmjgnquoyosq',                               -- project ref
  'https://gezmfmskhmjgnquoyosq.supabase.co',           -- URL
  '<paste-tenant-anon-key-here>',                       -- anon key (NOT service-role)
  'tier-2.5',
  'First tenant. Was the all-in-one dev DB before ADR-004 split.'
)
returning id;
-- Copy the returned UUID; you need it for tenant_domains below.

-- Map both surface hostnames to that tenant.
-- Replace <tenant-uuid> with the UUID returned above.

insert into public.tenant_domains (tenant_id, hostname, surface, status, dns_status, ssl_status, verified_at)
values
  ('<tenant-uuid>', 'dev.doctoleb.com', 'patient', 'active', 'verified', 'issued', now()),
  ('<tenant-uuid>', 'dev.ops.doctoleb.com', 'ops', 'active', 'verified', 'issued', now());

-- Quick check
select id, slug, status, supabase_url from public.tenants;
select hostname, surface, status from public.tenant_domains order by hostname;

-- Smoke-test the resolver
select public.resolve_tenant('dev.doctoleb.com', 'patient');
-- Expected: { "data": { tenantId, slug:"dev", supabaseUrl, ... }, "error": null }

select public.resolve_tenant('dev.doctoleb.com', 'ops');
-- Expected: { "data": null, "error": "SURFACE_MISMATCH" }

select public.resolve_tenant('nope.doctoleb.com', 'patient');
-- Expected: { "data": null, "error": "TENANT_NOT_FOUND" }
```

---

## 5. Make yourself a super-admin

In the control-plane project's Studio:

1. **Auth → Users → Add user**: create a super-admin account with email + password (or magic link).
2. Note the auth user UUID (Studio shows it in the user details).
3. Run in SQL editor:

```sql
-- Replace <auth-user-uuid> with the UUID from Auth → Users.
insert into public.super_admins (auth_user_id, display_name, is_active)
values ('<auth-user-uuid>', 'You', true);

select * from public.super_admins;
```

Now signing into the control-plane Supabase project with that account makes `is_super_admin()` return true and the registry tables become readable/writable.

---

## 6. Resolver HTTP endpoint

The resolver client (`packages/core/services/tenantResolver.js`) wants `VITE_TENANT_RESOLVER_URL` to point at a public HTTP endpoint that returns `{ data, error }`. Two options:

### Option A — Supabase Edge Function (recommended for v1)

Source of truth: `supabase-control-plane/functions/tenant-resolve/index.ts`.

Do not duplicate the Edge Function body in this runbook. The checked-in function normalizes and bounds host input, validates the `resolve_tenant` envelope before returning it publicly, sets production-safe JSON/security headers, caches only successful resolver responses briefly, and uses `no-store` for all errors.

Deploy:

```bash
supabase link --project-ref <control-plane-ref>
supabase functions deploy tenant-resolve --no-verify-jwt
```

`--no-verify-jwt` is correct here: the resolver is intentionally public (anon hostnames are public, anon keys are public; the security boundary is tenant-DB RLS).

The function URL will be:
```
https://<control-plane-ref>.supabase.co/functions/v1/tenant-resolve
```

### Option B — Vercel serverless function

If you'd rather host the resolver next to your frontend deployment (e.g. for shared logging, or to use Vercel Edge Network), drop equivalent logic into `apps/control-plane/api/tenant-resolve.ts` (Next.js / SvelteKit / Hono / etc). The contract is identical; the implementation reads `SUPABASE_SERVICE_ROLE_KEY` from a Vercel project env var (encrypted) and calls `resolve_tenant` via the Supabase client. Don't ship the service-role key to the browser.

For v1, **stick with Option A**. It runs inside the control-plane project itself, so the service-role key never leaves Supabase's environment.

### Configure the apps to use it

In `G:\project\doctoleb\.env` (or your hosting platform's env vars):

```bash
VITE_TENANT_RESOLVER_URL=https://<control-plane-ref>.supabase.co/functions/v1/tenant-resolve
VITE_TENANT_RESOLVER_TIMEOUT_MS=6000
```

Restart `npm run dev:patient` / `npm run dev:ops`. The browser now calls the real resolver. The DEV env fallback still works as a backup if the resolver fails.

---

## 7. Onboarding tenant #2 (console-assisted playbook)

The control-plane console now owns the SaaS metadata workflow. Use raw SQL only for emergency repair.

Preferred flow:

1. Sign in to `apps/control-plane` as an active `owner` or `operator`.
2. In **New doctor tenant**, enter clinic name, slug, and plan, then create the tenant draft. This creates the control-plane `tenants`, pending `tenant_domains`, `tenant_provisioning_jobs`, and audit event in one idempotent transaction.
3. Create the tenant Supabase project and apply tenant DB migrations. This remains manual until Management API automation is approved.
4. In **Runtime connection**, save the tenant project ref, tenant Supabase URL, and tenant anon key. Never paste a service-role key into the browser.
5. In **Domains**, keep `doctoleb.com` rows pending until the domain is purchased and verified. Before domain purchase, add the Vercel free-domain aliases for the current tenant if you need hosted smoke tests.
6. Sync branding and entitlements only after runtime config exists.
7. Activate the tenant only after it has runtime config and at least one active domain row for the target surface.

Legacy SQL playbook, for emergency repair only:

```bash
# Step 1 — Create a fresh Supabase project for tenant 2.
# Supabase Dashboard → New project → name: doctoleb-tenant-<slug>
# Save: project ref, URL, anon key, service-role key.

# Step 2 — Apply tenant DB migrations.
# From the existing repo (tenant migrations live in supabase/migrations/):
supabase link --project-ref <tenant-2-ref>
supabase db push

# Step 3 — Seed tenant identity.
# In the new tenant's Studio SQL editor:
#   - Insert one row in tenant_profile with the doctor/clinic display name + status='active'
#   - Insert one row in tenant_app_config with brand colors, locales, etc.
#   - Create the doctor's user account via Auth → Users (or seed users + doctors row directly)

# Step 4 — Register tenant in the control plane.
# In the CONTROL PLANE Studio SQL editor:
INSERT INTO public.tenants (
  slug, display_name, status, plan, release_channel,
  supabase_project_ref, supabase_url, supabase_anon_key, schema_version
) VALUES (
  'dr-hassan',
  'Dr. Hassan Clinic',
  'active',
  'starter',
  'stable',
  '<tenant-2-ref>',
  'https://<tenant-2-ref>.supabase.co',
  '<tenant-2-anon-key>',     -- NOT service-role
  '<latest-migration-version>'
)
RETURNING id;

# Step 5 — Map hostnames.
# Once DNS is configured (CNAME for subdomain, or custom domain verification):
INSERT INTO public.tenant_domains (tenant_id, hostname, surface, status, dns_status, ssl_status, verified_at)
VALUES
  ('<tenant-2-uuid>', 'dr-hassan.doctoleb.com', 'patient', 'active', 'verified', 'issued', now()),
  ('<tenant-2-uuid>', 'dr-hassan.ops.doctoleb.com', 'ops', 'active', 'verified', 'issued', now());

# Step 6 — Smoke test.
# In the resolver:
SELECT public.resolve_tenant('dr-hassan.doctoleb.com', 'patient');
# In a browser: visit https://dr-hassan.doctoleb.com → TenantBootstrap resolves → app loads.

# Step 7 — Audit log entry.
INSERT INTO public.tenant_events (tenant_id, event_type, metadata)
VALUES ('<tenant-2-uuid>', 'tenant.provisioned', jsonb_build_object('provisioned_by', 'manual'));
```

Each step takes a few minutes. End-to-end: ~1 hour for the first tenant, ~30 minutes once you're practiced. Automation comes later (a "create tenant" button in the super-admin UI, calling Supabase Management API to create the project, run migrations, seed config, register routing).

---

## 8. Verification checklist

After steps 1–6, check each item:

- [ ] Control-plane project shows only zero-PHI SaaS/control-plane tables (`tenants`, `tenant_domains`, `super_admins`, `tenant_events`, `plans`, `plan_entitlements`, `tenant_entitlements`, `tenant_provisioning_jobs`) with RLS enabled.
- [ ] `select public.resolve_tenant('localhost:3001', 'patient')` returns `{ data: { tenantId, slug:'dev', supabaseUrl, ... }, error: null }`.
- [ ] While the domain is not purchased, `select public.resolve_tenant('dev.doctoleb.com', 'patient')` returns `{ data: null, error: 'TENANT_INACTIVE' }`.
- [ ] `select public.resolve_tenant('nope', 'patient')` returns `{ data: null, error: 'TENANT_NOT_FOUND' }`.
- [ ] Edge Function `tenant-resolve` deployed (visible in Studio → Edge Functions).
- [ ] `curl 'https://<control-plane-ref>.supabase.co/functions/v1/tenant-resolve?host=localhost:3001&surface=patient'` returns 200 with `{ data, error: null }`.
- [ ] `curl 'https://<control-plane-ref>.supabase.co/functions/v1/tenant-resolve?host=dev.doctoleb.com&surface=patient'` returns 423 with `{ data: null, error: 'TENANT_INACTIVE' }` until the domain is purchased and activated.
- [ ] `curl 'https://<control-plane-ref>.supabase.co/functions/v1/tenant-resolve?host=nope&surface=patient'` returns 404 with `{ data: null, error: 'TENANT_NOT_FOUND' }`.
- [ ] After setting `VITE_TENANT_RESOLVER_URL`, `npm run dev:patient` boots and TenantBootstrap shows the splash for less than a second before the app renders.
- [ ] Removing `VITE_DEV_TENANT_SLUG` and intentionally setting a bad `VITE_TENANT_RESOLVER_URL` causes the apps to render the `<TenantUnavailable>` view with `TENANT_RESOLVER_DOWN`. (Then put the env back.)

---

## 9. Common gotchas

| Symptom | Cause | Fix |
|---|---|---|
| Resolver always returns `TENANT_NOT_FOUND` for valid host | Hostname casing mismatch — host stored as `Dev.DoctoLeb.com` | Hostnames are case-insensitive in `resolve_tenant`; double-check the row was inserted with the value you expect. `select hostname from tenant_domains where lower(hostname) = lower('your-host')` |
| App shows `RESOLVER_NOT_CONFIGURED` in production | Neither `VITE_TENANT_RESOLVER_URL` nor DEV fallback set | Set `VITE_TENANT_RESOLVER_URL` in your hosting platform's env config and redeploy |
| App boots fine in dev but `TENANT_RESOLVER_DOWN` in prod | CORS — Edge Function rejecting the prod origin | Set `TENANT_RESOLVE_ALLOWED_ORIGINS` on the Edge Function to exact prod origins, or `*` while iterating |
| Can read `tenants` table while logged out | RLS not enabled — re-run the migration's `enable row level security` lines | `select tablename, rowsecurity from pg_tables where schemaname='public'` |
| Edge Function crashes with "service-role key undefined" | Function deployed without env vars | `supabase secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...` (the URL/key inside the control-plane project — Supabase auto-injects these for Edge Functions but verify) |
| `resolve_tenant` returns inactive | Tenant or domain `status` ≠ active | `update tenants set status='active' where id='...';` and same for `tenant_domains` |

---

## 10. What this runbook does NOT cover

- **Custom domain DNS verification UX**. For now, `tenant_domains.dns_status` is set manually. A future step automates the TXT/CNAME verification handshake.
- **Stripe billing integration**. `tenants.plan` and `tenants.status` are the contract; the billing webhook can flip `status` to `'suspended'` on payment failure. Out of scope for v1.
- **Auto-provisioning via Supabase Management API**. Step 7 is manual today. Eventually replace it with a `provision-tenant` Edge Function that calls `POST https://api.supabase.com/v1/projects` and runs `supabase db push --project-ref <new>` programmatically. Requires a Management API token, stored as a control-plane Edge Function secret only.
- **Full automated super-admin provisioning**. `apps/control-plane/` now covers tenant list/detail, status/domain controls, runtime config, branding sync, entitlement sync, and draft creation. Supabase project creation, tenant DB migration execution, first doctor invite automation, and custom-domain verification automation are still follow-up work.
- **Cross-tenant analytics**. Counts/MRR/dashboards that aggregate across tenants need a service-role aggregator Edge Function in the control plane that fans out to each tenant DB. Out of scope.

---

## 11. Where this fits in the roadmap

| Tier | What it adds | Status |
|---|---|---|
| **Tier 2.5 hardening** | Encounter MVP, Storage RLS, redaction, baseline migration | Largely done |
| **ADR-004 runtime layer** | Hostname parser, resolver client, runtime Supabase factory, TenantBootstrap, audit guards | Done (Slices A–F) |
| **This runbook (control plane v1)** | Second Supabase project, schema, dev tenant in registry, resolver endpoint | Pending — execute when you onboard tenant #2 |
| **Control plane v2** | Super-admin React UI, manual provisioning workflow surfaced as a button | In progress — console-assisted draft/runtime workflow exists |
| **Control plane v3** | Auto-provisioning via Supabase Management API, custom domain verification flows | Pending |
| **Phase 5** | Flutter app reuses the same resolver | Pending |

---

## 12. Quick reference: env vars per environment

| Variable | DEV (today) | DEV (after control plane up) | PROD |
|---|---|---|---|
| `VITE_SUPABASE_URL` | tenant URL (dev fallback) | tenant URL (dev fallback) | omit (or unused) |
| `VITE_SUPABASE_ANON_KEY` | tenant anon key (dev fallback) | tenant anon key (dev fallback) | omit (or unused) |
| `VITE_TENANT_RESOLVER_URL` | omit | control-plane Edge Function URL | control-plane Edge Function URL |
| `VITE_TENANT_RESOLVER_TIMEOUT_MS` | optional, defaults to `6000` | optional, defaults to `6000` | optional, defaults to `6000` |
| `VITE_DEV_TENANT_SLUG` | omit (defaults to `'dev'`) | omit (defaults to `'dev'`) | **must omit** — DEV fallback is disabled in PROD |
| `SUPABASE_SERVICE_ROLE_KEY` | **never set in apps** | **never set in apps** | **never set in apps** — only in the Edge Function secrets |

---

**End of CONTROL_PLANE_SETUP.md.** Follow steps 1–6 in order when ready. Step 7 onward repeats per new tenant.
