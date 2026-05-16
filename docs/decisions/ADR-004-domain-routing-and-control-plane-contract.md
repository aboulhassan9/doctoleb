# ADR-004: Hostname-Based Tenant Routing And Control-Plane Contract

## Status
Accepted

## Date
2026-05-07

## Supersedes / Supplements
- Supplements [ADR-001](./ADR-001-single-clinic-multi-doctor.md): each ADR-001 "single-clinic, multi-doctor" deployment is now one *tenant* in a database-per-tenant SaaS. The clinical product model is unchanged; the deployment topology is multi-tenant.
- Supplements [ADR-002](./ADR-002-separate-patient-and-clinic-ops-apps.md): the patient-web vs clinic-ops boundary now also implies a hostname/surface boundary at runtime.
- Supplements [ADR-003](./ADR-003-tenant-branding-and-control-plane-config.md): tenant branding stays in tenant DB; tenant *routing* moves to a separate control plane.

## Context

`packages/core/lib/supabase.js` currently constructs one `supabase` client at module load from `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Every service imports that singleton. This is correct for a single-tenant development build but is the structural blocker to subdomain/custom-domain routing:

- A single Vercel deployment cannot serve `dr-hassan.doctoleb.com`, `dr-mona.doctoleb.com`, and `customclinic.com` because the Supabase project URL is fixed at build time.
- Re-deploying per tenant just to swap two env vars defeats the point of database-per-tenant SaaS.
- The Flutter patient app cannot share the web service contracts if those contracts assume a static tenant.

The product needs five hostnames working from one codebase:

```txt
doctoleb.com                    -> DoctoLeb marketing site (sells DoctoLeb to doctors)
console.doctoleb.com            -> SaaS super-admin / control plane (no PHI)
{tenant}.doctoleb.com           -> tenant patient web
{tenant}.ops.doctoleb.com       -> tenant clinic operations
customclinic.com                -> paid tenant patient web on custom domain
ops.customclinic.com            -> optional paid tenant ops on custom domain
```

Before `doctoleb.com` is purchased, the same runtime must also work on deployment-platform hostnames such as Vercel-provided `*.vercel.app` URLs. Those hosts are not tenant slugs and must not be guessed from hostname shape; they are explicitly categorized through public deployment env values.

The data model for solving this already exists in the live tenant DB (`tenant_profile`, `tenant_app_config`, `feature_flags`, `get_public_tenant_app_config` RPC, `BrandContext` consuming it). What is missing is the layer **before** the tenant DB connection: how the browser learns which tenant DB to talk to in the first place.

That layer is the control plane — a separate Supabase project that maps hostname → tenant Supabase project ref + URL + anon key.

## Decision

DoctoLeb adopts a **hostname-driven runtime tenant resolution model** with three boundaries:

1. **Hostname → Surface classification** happens entirely client-side from `window.location.hostname` against a pure-function parser. No network call. The pure parser accepts optional deployment-host allowlists; the browser `classifyCurrentLocation` wrapper may read public env values for Vercel/no-domain deployment hosts.
2. **Hostname → Tenant connection** happens through a public-safe HTTP endpoint backed by a control-plane database. The browser caches the result in memory for ~5 minutes per session.
3. **Tenant connection → Supabase client** happens through a runtime client factory (`configureSupabaseClient`/`getSupabaseClient`) that replaces the current static `supabase` singleton.

All existing tenant-DB contracts (services, RLS, RPCs, state machines, idempotency, soft-delete) remain unchanged. The split is additive.

### Architecture

```txt
window.location.hostname
        ↓ pure parser (packages/core)
{ surface: 'patient' | 'ops' | 'marketing' | 'control-plane', tenantSlug?: string }
        ↓ HTTP GET /api/tenant-resolve?host=…&surface=…
        ↓ (control-plane DB lookup — no PHI)
{ tenantId, slug, supabaseUrl, supabaseAnonKey, schemaVersion, status }
        ↓ configureSupabaseClient({ url, anonKey })
        ↓ existing services in packages/core
        ↓ AuthProvider, BrandProvider, app routes
```

### Hard rails (non-negotiable)

These are inherited from the next-tier handoff and ADR-002/ADR-003. ADR-004 codifies them so future agents cannot regress:

1. **Database-per-tenant.** No `tenant_id` columns inside any tenant DB table. Tenant isolation is at the project level, not the row level.
2. **Control plane stores no PHI.** It holds tenant routing/provisioning metadata only. Anon key in control plane is acceptable (anon keys are public). Service-role keys never touch a frontend response.
3. **Tenant branding/config stays in the tenant DB** (per ADR-003). The control plane does not duplicate `tenant_app_config`. Branding only flows through `get_public_tenant_app_config` once the tenant client is configured.
4. **The resolver endpoint is public** but returns only what bootstrap needs. PHI must never flow through it.
5. **Static one-tenant `.env` config is a development fallback only.** Production must resolve via hostname.
6. **The split is a runtime boundary, not a code-duplication boundary.** Patient web and clinic ops keep importing services from `packages/core`. The runtime Supabase client is shared.
7. **Control-plane authentication is separate.** Super-admin auth uses the control-plane Supabase project's auth; it does not reuse a tenant identity.

### No-Domain Deployment Mode

Until the real domain is bought and verified, deployment hostnames are categorized explicitly:

```txt
VITE_MARKETING_HOSTS        -> doctor-facing marketing app, no resolver call
VITE_CONTROL_PLANE_HOSTS    -> SaaS console app, no resolver call
VITE_PATIENT_TENANT_HOSTS   -> patient tenant app, resolver surface patient
VITE_OPS_TENANT_HOSTS       -> clinic-ops tenant app, resolver surface ops
VITE_PUBLIC_PRIMARY_DOMAIN  -> canonical purchased domain family, default doctoleb.com
```

These values are public routing metadata, not secrets. They can contain comma-separated hostnames or URLs. Tenant Vercel hosts still require matching `tenant_domains` rows in the control plane when they should resolve to a tenant. Real `doctoleb.com` rows stay `pending` until ownership, DNS, and SSL are verified.

### No-Domain Path Routing

Before a tenant owns a domain, the shared Vercel apps may also route by tenant slug:

```txt
https://doctoleb-patient-web.vercel.app/t/{tenantSlug}
https://doctoleb-clinic-ops.vercel.app/t/{tenantSlug}
```

This path mode is additive. Host/domain routing remains the preferred production path once a real domain is purchased and verified. In path mode:

- The browser extracts `/t/{tenantSlug}` before tenant bootstrap.
- The patient app uses resolver surface `patient`; the clinic-ops app uses resolver surface `ops`.
- React Router runs with `basename="/t/{tenantSlug}"`, so existing routes still behave as `/login`, `/patient-dashboard`, `/doctor-dashboard`, etc. inside the app.
- The resolver receives `host`, `surface`, and `slug`; if `slug` is present, the control plane resolves by `tenants.slug` and does not require an active `tenant_domains` row.
- Only `active` tenants resolve by slug. `draft`, `provisioning`, `inactive`, `suspended`, and `maintenance` return `TENANT_INACTIVE`.
- `/t/{tenantSlug}` is not stored in `tenant_domains`; it is a path route, not a domain.

## Tenant Resolver Contract

### Request

```txt
GET /api/tenant-resolve?host={hostname}&surface=patient|ops
GET /api/tenant-resolve?host={hostname}&surface=patient|ops&slug={tenantSlug}
```

`host` is required. `surface` is required and must be `patient` or `ops`. `slug` is optional and is used only for no-domain path routing. Other surfaces (marketing, control-plane) do not call this endpoint.

### Response (success)

```json
{
  "data": {
    "tenantId": "uuid",
    "slug": "dr-hassan",
    "surface": "patient",
    "status": "active",
    "supabaseUrl": "https://tenant-ref.supabase.co",
    "supabaseAnonKey": "public-anon-key",
    "schemaVersion": "20260507",
    "canonicalHost": "dr-hassan.doctoleb.com"
  },
  "error": null
}
```

The response shape mirrors the rest of the codebase's contract: `{ data, error }` for single reads. The resolver never returns `meta` because it is a single lookup, not a paged list.

### Response (error)

```txt
404 TENANT_NOT_FOUND       -> hostname is not mapped to any tenant
403 SURFACE_MISMATCH       -> hostname belongs to a different surface (e.g. patient host hit /ops)
423 TENANT_INACTIVE        -> tenant exists but is suspended/inactive/maintenance
503 TENANT_RESOLVER_DOWN   -> control plane is unreachable
```

`{ data: null, error: <code> }` in every error case. The `error` value is a stable machine-readable code, not a stack trace; the client maps it to UI copy.

### Caching

- Successful resolution is cacheable for **5 minutes** in browser memory (not localStorage; not a service worker).
- A failed resolution is cached for **30 seconds** to avoid hammering the control plane during outages.
- Cache key is `(host, surface, mode)`, where mode is either host routing or slug routing.
- The resolver itself may set `Cache-Control: max-age=300, public` on success and `Cache-Control: no-store` on error.

### Local development fallback

When `import.meta.env.DEV` is true and `VITE_DEV_TENANT_SLUG` is set, the resolver client returns synthesized data from `.env` instead of calling the network:

```txt
localhost:3001 + DEV  -> patient surface, tenant slug from VITE_DEV_TENANT_SLUG
localhost:3002 + DEV  -> ops surface, same tenant
```

Production builds (`import.meta.env.PROD`) must never use the env fallback. The resolver client throws if both the network call fails *and* no DEV fallback is available.

## Control-Plane Data Contract

A separate Supabase project, distinct from any tenant DB. Recommended schema:

### `tenants`

```txt
id                        uuid primary key
slug                      text unique not null         -- 'dr-hassan'
display_name              text not null
status                    text not null check (status in ('active','inactive','suspended','provisioning','maintenance'))
plan                      text                          -- 'starter' | 'pro' | etc.
release_channel           text default 'stable'        -- 'stable' | 'beta'
supabase_project_ref      text not null                -- 'abc123xyz'
supabase_url              text not null                -- 'https://abc123xyz.supabase.co'
supabase_anon_key         text not null                -- public anon key only
schema_version            text                          -- migration version baseline
created_at                timestamptz default now()
updated_at                timestamptz default now()
```

### `tenant_domains`

```txt
id                  uuid primary key
tenant_id           uuid not null references tenants(id) on delete restrict
hostname            text unique not null              -- 'dr-hassan.doctoleb.com', 'customclinic.com'
surface             text not null check (surface in ('patient','ops'))
status              text not null check (status in ('pending','active','disabled'))
dns_status          text                               -- 'verified' | 'pending' | 'failed'
ssl_status          text                               -- 'issued' | 'pending' | 'failed'
verification_token  text                               -- TXT record value
verified_at         timestamptz
created_at          timestamptz default now()
updated_at          timestamptz default now()
```

The resolver endpoint joins `tenant_domains` → `tenants` on `(hostname, surface)` and returns the connection blob.

### `tenant_deployments` (optional, Phase 4+)

```txt
id                uuid primary key
tenant_id         uuid not null references tenants(id) on delete restrict
surface           text not null check (surface in ('patient','ops'))
provider          text                               -- 'vercel' | 'cloudflare' | etc.
deployment_url    text
deployed_version  text
health_status     text
last_checked_at   timestamptz
```

### `tenant_migration_runs` (optional, Phase 4+)

```txt
id                  uuid primary key
tenant_id           uuid not null references tenants(id) on delete restrict
migration_version   text not null
status              text not null
started_at          timestamptz
finished_at         timestamptz
error_summary       text
```

### `tenant_events` (audit log for control-plane actions)

```txt
id          uuid primary key
tenant_id   uuid references tenants(id) on delete set null
event_type  text not null
actor_id    uuid                                   -- super_admin user id
metadata    jsonb
created_at  timestamptz default now()
```

### What the control plane MUST NOT store

- Patient records, appointment records, clinical documents
- Notes, diagnoses, prescriptions, lab/imaging orders
- Patient messages or message attachments
- Insurance policy numbers, claim amounts, billing rows that reveal patient care
- Staff clinical activity logs
- Any column that could let an attacker reconstruct a clinical visit

### What the control plane MAY store

- Tenant slug, display name, plan/subscription status (no patient names)
- Supabase project ref / URL / anon key (anon keys are public)
- Domain verification metadata
- Deployment health pings
- Schema version per tenant
- Super-admin audit events (with tenant_id, never patient_id)

### Service-role keys

Control-plane writes and tenant provisioning need a Supabase service-role key. **It must never reach a frontend response.** Acceptable storage:

- Server-side environment variable on the control-plane backend (e.g. Vercel server function, Deno Edge runtime, Node service)
- A dedicated secret manager (Supabase Vault, AWS Secrets Manager, etc.)

Reading the service-role key from a browser response is a P0 vulnerability and must fail the contract audit.

## Implementation Slices

ADR-004 is implemented in six small slices. Each slice ships independently and keeps `npm run verify`, `npm run build:patient`, and `npm run build:ops` green.

### Slice A — Documentation and ADR ✅ (this ADR)

- This file.
- Current cross-reference: `docs/CORE_CONTEXT.md`. Older root plan files were removed during the documentation cleanup; use Git history for historical traces.
- No executable code change.

### Slice B — Hostname/Surface Parser

`packages/core/lib/hostnameSurface.js` (or extend `appBoundaries.js`) exporting:

```js
classifyHostname(hostname): {
  surface: 'marketing' | 'control-plane' | 'patient-tenant' | 'ops-tenant' | 'custom-domain' | 'local-patient' | 'local-ops' | 'unknown',
  tenantSlug: string | null,
  isLocal: boolean,
}
```

Classification table:

```txt
doctoleb.com                  -> marketing
www.doctoleb.com              -> marketing
console.doctoleb.com          -> control-plane
{slug}.doctoleb.com           -> patient-tenant, tenantSlug = slug
{slug}.ops.doctoleb.com       -> ops-tenant, tenantSlug = slug
customclinic.com              -> custom-domain (resolver lookup needed)
ops.customclinic.com          -> custom-domain ops (resolver lookup needed)
localhost:3001 / 127.0.0.1    -> local-patient
localhost:3002                -> local-ops
```

Pure function, no side effects, fully unit-testable. No production tenant slug hardcoded — fixtures use `dr-test`.

### Slice C — Tenant Resolver Client

`packages/core/services/tenantResolver.js`:

```js
export const tenantResolverService = {
  async resolve({ host, surface }): Promise<{ data, error }>,
};
```

- Returns `{ data, error }` envelope identical to other services.
- 5-minute success cache, 30-second error cache (in-memory).
- DEV fallback via `VITE_DEV_TENANT_SLUG` + existing `.env` Supabase URL/key.
- No service-role secrets in code.
- The control-plane HTTP API itself is not built here — Slice C only defines the browser client. Slice C ships against a stub endpoint (or DEV fallback) until the control plane exists.

### Slice D — Runtime Supabase Client Factory

Refactor `packages/core/lib/supabase.js`:

```js
let _client = null;

export function configureSupabaseClient({ url, anonKey }) {
  _client = createClient(url, anonKey);
  return _client;
}

export function getSupabaseClient() {
  if (!_client) throw new Error('Supabase client not configured. Call configureSupabaseClient first.');
  return _client;
}

// Compatibility shim — preserve existing imports during migration
export const supabase = new Proxy({}, {
  get(_, prop) {
    return getSupabaseClient()[prop];
  },
});
```

The Proxy lets every existing `import { supabase } from '@/lib/supabase'` keep working. No service-by-service rewrite. The shim throws if the client is not yet configured, which surfaces ordering bugs immediately rather than silently using a stale client.

DEV fallback: `main.jsx` (or a bootstrap module) calls `configureSupabaseClient` from `.env` before rendering. Production: `main.jsx` resolves the tenant first, *then* configures.

### Slice E — Tenant Bootstrap Provider

A new `<TenantBootstrap>` wrapper at the top of each app's `App.jsx`. Pseudocode:

```jsx
function TenantBootstrap({ surface, children }) {
  const [state, setState] = useState({ status: 'resolving' });

  useEffect(() => {
    classifyHostname(window.location.hostname);
    tenantResolverService.resolve({ host, surface }).then(({ data, error }) => {
      if (error) return setState({ status: 'error', code: error });
      configureSupabaseClient({ url: data.supabaseUrl, anonKey: data.supabaseAnonKey });
      setState({ status: 'ready', tenant: data });
    });
  }, [surface]);

  if (state.status === 'resolving') return <ResolvingTenantSplash />;
  if (state.status === 'error') return <TenantUnavailable code={state.code} />;
  return children;
}
```

`AuthProvider` and `BrandProvider` mount inside `TenantBootstrap`, so they always operate against an already-configured client. Loading/not-found/inactive states render before any service call is attempted.

### Slice F — Verification and Guardrails

Extend `scripts/backend-contract-audit.mjs` with three new checks:

1. **No hardcoded tenant Supabase URLs in executable code** (regex `https://[a-z0-9]{20}\.supabase\.co` outside `.env*` and `docs/`).
2. **No service-role key string patterns in frontend packages** (regex `eyJ[A-Za-z0-9_\-]+\.eyJ[A-Za-z0-9_\-]+\.` outside `apps/*/dist/` etc., combined with role-name hints).
3. **No `tenant_id` columns added to tenant DB migrations** (regex `tenant_id\s+(?:uuid|text|int)` in `supabase/migrations/`).

Plus the existing `assertLegacyCompatibilitySurfacesRemoved` continues to block old surface names.

Manual verification per slice:

```bash
npm run verify
npm run build:patient
npm run build:ops
# Browser smoke
http://localhost:3001 -> patient web resolves DEV tenant, renders landing
http://localhost:3002/login -> clinic ops resolves same DEV tenant, renders login
```

## Hostname/Surface Reference

```txt
doctoleb.com                  marketing             apps/marketing-site (future, out of scope here)
www.doctoleb.com              marketing             same
console.doctoleb.com          control-plane         apps/control-plane (future)
{slug}.doctoleb.com           patient-tenant        apps/patient-web   + resolver
{slug}.ops.doctoleb.com       ops-tenant            apps/clinic-ops    + resolver
customclinic.com              patient-tenant        apps/patient-web   + resolver (custom domain)
ops.customclinic.com          ops-tenant            apps/clinic-ops    + resolver (custom domain)
localhost:3001                local-patient         apps/patient-web   + DEV fallback
localhost:3002                local-ops             apps/clinic-ops    + DEV fallback
```

## Consequences

### Positive

- New tenants onboard by writing one row in `tenants` + one row in `tenant_domains`. No frontend rebuild.
- Patient web, clinic ops, and the future Flutter app share one resolver contract.
- The control plane never accesses tenant PHI; even a control-plane breach exposes routing metadata only.
- Migrating between tenant Supabase projects becomes a control-plane edit instead of a deploy.
- The compatibility shim in `supabase.js` preserves the existing `import { supabase } from '@/lib/supabase'` pattern across ~20 services with zero churn.

### Negative / risks

- The resolver endpoint becomes a runtime dependency. If the control plane is down, no tenant page loads. Mitigations: 30s error cache, status-page wiring, eventually a stale-while-revalidate strategy.
- The compatibility Proxy in `supabase.js` adds one layer of indirection per call. Real-world impact is negligible (one property lookup), but it does mean a misconfigured boot sequence throws at first DB call rather than at module load. That is on balance a feature, not a bug.
- Control-plane operations (provisioning, billing, domain verification) still need to be built. ADR-004 only covers the runtime resolution path. The provisioning workflow is its own future ADR.

### Out of scope for ADR-004

- Building the control-plane Supabase project itself (Phase 2 of the historical roadmap).
- Building the SaaS super-admin UI (Phase 6).
- Custom domain DNS verification UX.
- Stripe billing wiring.
- Cross-tenant analytics (would require service-role aggregator edge function).
- Flutter app implementation.
- Migrating existing tenant `gezmfmskhmjgnquoyosq` away from being treated as the dev tenant.

These remain on the roadmap; ADR-004 is the runtime contract that makes them implementable later.

## Alternatives Considered

### Per-tenant Vercel deployment with hardcoded env vars

**Pros:** Simplest possible model; no resolver, no control plane.

**Cons:** Every new tenant requires a deploy. No custom domains without per-tenant Vercel projects. Releases must be promoted across N deployments. Defeats SaaS economics.

Rejected.

### `tenant_id` columns + RLS isolation in one shared Supabase project

**Pros:** Single Supabase project; no resolver needed.

**Cons:** PHI from all tenants lives in one DB. One RLS policy bug exposes every tenant. Backup/restore is global instead of per-tenant. ADR-001 + ADR-002 + ADR-003 + the explicit "no `tenant_id`" rule across all docs all reject this. Healthcare compliance pressures (PITR per tenant, isolated backups, deletion-on-churn) all favor project isolation.

Rejected, hard.

### Subdomain detection without a control plane (env-mapped lookup)

**Pros:** No control-plane DB; the patient-web build embeds a static `{slug: supabaseUrl}` map.

**Cons:** New tenant onboarding still needs a frontend rebuild. Custom domains are awkward (rebuild on every domain purchase). Doesn't compose with billing/status changes. Marginal short-term benefit, large long-term cost.

Rejected.

### Returning service-role keys from the resolver

**Pros:** Front-end can call privileged operations.

**Cons:** Makes the public resolver endpoint a key-distribution service. Browser DevTools exposes the key. One leaked key compromises the entire tenant DB regardless of RLS. Anon keys + RLS + RPCs are sufficient for everything the browser needs.

Rejected, P0.

## Verification

Acceptance criteria for "Slice A complete":

- This ADR exists and is committed.
- `docs/CORE_CONTEXT.md` references ADR-004 and the resolver/control-plane contract where relevant. Older root plan files were removed during the documentation cleanup.
- `docs/CORE_CONTEXT.md` states the current database-per-tenant SaaS topology.
- `npm run verify` exits 0.

Acceptance criteria for "ADR-004 fully implemented" (Slices A–F):

- Patient web at `localhost:3001` boots through `TenantBootstrap`, resolves a DEV tenant, and renders a landing page.
- Clinic ops at `localhost:3002` boots through `TenantBootstrap`, resolves the same DEV tenant, and renders a login.
- `packages/core/lib/supabase.js` exports `configureSupabaseClient` and `getSupabaseClient`. The legacy `supabase` named export still works via a Proxy shim.
- No service file imports raw env vars to construct a Supabase client. Only the bootstrap path does.
- `scripts/backend-contract-audit.mjs` includes the three new guard checks from Slice F and they all pass.
- The resolver client has unit tests covering: success, 404, 403, 423, 503, DEV fallback.
- The hostname parser has unit tests covering: every row of the classification table.
- `npm run verify`, `npm run build:patient`, `npm run build:ops` all exit 0.

## Follow-up Work

- Build the control-plane Supabase project schema as a separate migration set in `supabase/control-plane/migrations/` (or a new repo). Follow-up ADR.
- Build the resolver HTTP endpoint (Vercel serverless function or Supabase Edge Function in the control-plane project). Follow-up ADR.
- Add a runtime smoke test in the existing playwright wiring that boots both apps and waits for `TenantBootstrap` to resolve.
- Wire `BrandContext.refresh()` to re-fetch when `tenantResolverService.resolve()` returns a new `tenantId` (multi-tenant browsing in dev tools).
- Document the disaster-recovery runbook for "control plane down" — graceful degradation, status page, manual fallback.
- Plan the migration of `gezmfmskhmjgnquoyosq` from "the dev tenant" to "tenant 1 in the control-plane registry" without downtime.
