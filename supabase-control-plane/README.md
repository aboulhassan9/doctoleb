# DoctoLeb Control Plane

> **This tree is for the SEPARATE Supabase project that backs the SaaS layer.**
> It is NOT a tenant DB. It stores routing/provisioning metadata only — no PHI.
>
> **Do not** apply these migrations to a tenant project.
> **Do not** add patient/clinical/billing/messaging tables here.
>
> Setup runbook: see `../CONTROL_PLANE_SETUP.md` in the repo root.
> Architecture: see `../docs/decisions/ADR-004-domain-routing-and-control-plane-contract.md`
> and `../docs/decisions/ADR-006-provider-connected-tenant-provisioning.md`.

## Activated Projects

| Role | Supabase project ref | Notes |
|---|---|---|
| SaaS/control plane | `xouqxgwccewvbtkqming` | Owns this schema and the public resolver. No PHI. |
| First tenant DB | `gezmfmskhmjgnquoyosq` | Existing clinical/PHI database seeded as tenant slug `dev`. |

Live resolver URL:

```bash
https://xouqxgwccewvbtkqming.supabase.co/functions/v1/tenant-resolve
```

Domain readiness:

- `localhost:3001` and `localhost:3002` are active resolver rows for development.
- `dev.doctoleb.com` and `dev.ops.doctoleb.com` are placeholder rows only.
- Keep those future domain rows `pending` until `doctoleb.com` is purchased and DNS/SSL are verified.
- The SaaS DB, resolver API, frontend bootstrap, and system design are ready for that moment; public domain traffic is intentionally not ready yet.
- Hostnames are normalized at the DB boundary (`lower(trim(hostname))`) and protected by a case-insensitive unique index, so mixed-case or whitespace variants cannot become duplicate tenant routes.
- The live resolver is Edge Function version 2. It normalizes host input, validates the public response envelope, uses short success caching, and sends `no-store` for errors.
- Browser traffic must use the `tenant-resolve` Edge Function. Direct `public.resolve_tenant(text,text)` RPC execution is revoked from `public`, `anon`, and `authenticated`; the Edge Function calls it with service-role access.
- The live `admin-update-tenant` function is version 4 and delegates compound tenant/domain writes to `admin_update_tenant_atomic`, a service-role-only RPC that commits metadata updates and audit insertion atomically.

## Layout

```
supabase-control-plane/
├── README.md                          ← this file
├── migrations/
│   ├── 00010000000000_control_plane_baseline.sql
│   ├── 00010000000001_control_plane_hostname_normalization.sql
│   └── 00010000000002_control_plane_internal_function_execute_revoke.sql
└── functions/
    ├── tenant-resolve/
    │   └── index.ts                   ← public-safe HTTP resolver
    ├── admin-*-tenant/
    │   └── index.ts                   ← authenticated super-admin APIs
    └── admin-*-provider-connection/
        └── index.ts                   ← provider connection metadata APIs
```

## What lives here

| Surface | Purpose |
|---|---|
| `tenants` | Per-tenant routing rows: slug, Supabase project ref, URL, anon key, status, plan |
| `tenant_domains` | Hostname → tenant + surface mapping (patient vs ops) |
| `super_admins` | DoctoLeb owners/operators (linked to control-plane `auth.users`) |
| `tenant_events` | Audit log for control-plane actions |
| `provisioning_provider_connections` | Authorized Supabase/Vercel account handles for future tenant automation. Secret references only, no raw tokens |
| `tenant_provisioning_steps` | Step-level provisioning ledger with idempotency, external resource ids, and undo metadata |
| `tenant_secret_refs` | Tenant setup secret metadata: Vault/Edge/external secret references only, never raw service keys or DB URLs |
| `tenant_migration_runs` | Tenant DB setup/migration run ledger with status, checksum/error metadata, and retry visibility |
| `tenant_migration_items` | Per-migration status rows under a setup run; metadata only |
| `control_plane_private.is_super_admin()` | RLS helper for authenticated super-admin reads |
| `resolve_tenant(text, text)` | Public-safe RPC. Returns `{ data, error }` jsonb |
| `admin_update_tenant_atomic(uuid, uuid, jsonb, jsonb)` | Private service-role RPC for atomic admin tenant/domain updates |
| `tenant-resolve` Edge Function | HTTP wrapper around `resolve_tenant`. Public; no JWT verification |
| `admin-list-provider-connections` Edge Function | Authenticated metadata list. Returns secret-reference booleans, never raw provider tokens |
| `admin-upsert-provider-connection` Edge Function | Operator-only create/update for safe provider connection metadata |
| `admin-store-provider-secret` Edge Function | Operator-only one-way provider token/key storage into Vault; response is sanitized |
| `admin-archive-provider-connection` Edge Function | Operator-only reversible archive path that blocks active provisioning jobs |
| `admin-upsert-tenant-secret` Edge Function | Operator-only one-way tenant service/database secret storage into Vault or secret-reference metadata |
| `admin-list-tenant-db-setup` Edge Function | Super-admin read model for tenant secret-reference flags and migration run history |
| `admin-revoke-tenant-secret` Edge Function | Operator-only reversible revoke path for tenant setup secrets |
| `admin-update-first-doctor-admin` Edge Function | Operator-only first doctor login update. Updates tenant Auth and tenant user metadata; never returns tenant service keys |
| `tenantMigrationBundle.ts` | Generated server-only migration bundle from `supabase/migrations`; never edit by hand |

## What MUST NOT live here

- Patient records, appointments, encounters, clinical documents
- Notes, diagnoses, prescriptions, lab/imaging orders
- Patient messages or message attachments
- Insurance policies, claims, billing rows
- Staff clinical activity logs
- Any column or row that could let an attacker reconstruct a clinical visit

If you find yourself adding any of the above to a control-plane migration: stop. That data belongs in a tenant DB, not here.

## How the apps consume this

Browser path:

```
window.location.host
   → packages/core/lib/hostnameSurface.js (classifyHostname)
   → packages/core/services/tenantResolver.js (HTTP GET /tenant-resolve)
   → packages/core/lib/supabase.js (configureSupabaseClient)
   → existing services in packages/core/services/*.js
```

The resolver client calls the Edge Function with a bounded timeout (`VITE_TENANT_RESOLVER_TIMEOUT_MS`, default `6000`). It falls back to env vars (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` + optional `VITE_DEV_TENANT_SLUG`) in DEV when no `VITE_TENANT_RESOLVER_URL` is configured. PROD without the resolver fails closed.

## Deploying

After creating the control-plane Supabase project (see runbook §2):

```bash
# Link the CLI to the control-plane project (separate from any tenant project).
supabase link --project-ref <control-plane-ref>

# Apply the baseline migration.
supabase db push

# Keep the server-side tenant migration bundle aligned with tenant migrations.
npm run check:tenant-migration-bundle

# Deploy the resolver Edge Function. --no-verify-jwt is correct; the
# endpoint is intentionally public.
supabase functions deploy tenant-resolve --no-verify-jwt

# Deploy authenticated admin functions with JWT verification enabled.
supabase functions deploy admin-list-provider-connections
supabase functions deploy admin-upsert-provider-connection
supabase functions deploy admin-store-provider-secret
supabase functions deploy admin-archive-provider-connection
supabase functions deploy admin-upsert-tenant-secret
supabase functions deploy admin-list-tenant-db-setup
supabase functions deploy admin-revoke-tenant-secret
supabase functions deploy admin-update-first-doctor-admin
supabase functions deploy admin-run-provisioning-step
supabase functions deploy admin-cancel-provisioning-job
supabase functions deploy admin-resume-provisioning-job
supabase functions deploy admin-compensate-provisioning-step

# (Optional) tighten CORS to exact production origins once domains are live.
supabase secrets set TENANT_RESOLVE_ALLOWED_ORIGINS="https://dev.doctoleb.com,https://dev.ops.doctoleb.com"
```

Then in your app envs (Vercel project, `.env.production`, etc.):

```bash
VITE_TENANT_RESOLVER_URL=https://<control-plane-ref>.supabase.co/functions/v1/tenant-resolve
VITE_TENANT_RESOLVER_TIMEOUT_MS=6000
VITE_PATIENT_WEB_URL=https://<patient-web-origin>
VITE_CLINIC_OPS_URL=https://<clinic-ops-origin>
```

The runbook (`../CONTROL_PLANE_SETUP.md`) has the full sequence including seeding the dev tenant as row #1, smoke tests, and the manual playbook for onboarding tenant #2.

## Provider-connected provisioning direction

The control plane now has schema support for provider-flexible provisioning:

- Supabase and Vercel accounts can be represented as provider connections owned by DoctoLeb, a customer, or a partner.
- These rows store metadata and secret references only. Raw provider tokens, management API credentials, and tenant service-role keys stay server-side.
- Provisioning jobs can link to selected provider connections and record step-level idempotency plus undo metadata.
- Dedicated provider metadata Edge Functions now exist for list/upsert/archive. They reject raw token-shaped input, sanitize `secret_ref` out of responses, and use reversible archive semantics.
- Provider and tenant setup secrets can be stored through one-way Edge Function calls into Supabase Vault. Browser responses include only safe metadata such as `has_secret_ref`, storage type, status, and timestamps.
- `apply_tenant_migrations` now uses a server-side database connection string stored in Vault to apply the canonical tenant migrations from `supabase/migrations`, then records run/item status in `tenant_migration_runs` and `tenant_migration_items`.
- Tenant database setup refuses unknown non-empty public schemas unless a DoctoLeb/Supabase migration ledger already exists. This prevents the SaaS admin from accidentally modifying a customer database that was not prepared for DoctoLeb.
- `admin-run-provisioning-step` advances the assisted path through provider readiness, operator-linked tenant project verification, migration readiness, tenant profile/app config seed, first doctor/admin seed, Vercel/free-alias routing verification, resolver smoke, and guarded activation.
- `admin-cancel-provisioning-job`, `admin-resume-provisioning-job`, and `admin-compensate-provisioning-step` expose operator cancel/recovery/undo paths through authenticated admin functions only. A cancelled job remains terminal for audit; resume creates a new zero-PHI provisioning ledger for the same tenant and carries forward safe checkpoints.
- The current UI remains manual-assisted for external project creation. Supabase Management API project creation and Vercel REST project/env/custom-domain mutation are still gated behind provider credentials, cost/region/org selection, external resource IDs, and compensation rules.
