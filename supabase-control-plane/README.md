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
    └── tenant-resolve/
        └── index.ts                   ← public-safe HTTP resolver
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
| `control_plane_private.is_super_admin()` | RLS helper for authenticated super-admin reads |
| `resolve_tenant(text, text)` | Public-safe RPC. Returns `{ data, error }` jsonb |
| `admin_update_tenant_atomic(uuid, uuid, jsonb, jsonb)` | Private service-role RPC for atomic admin tenant/domain updates |
| `tenant-resolve` Edge Function | HTTP wrapper around `resolve_tenant`. Public; no JWT verification |

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

# Deploy the resolver Edge Function. --no-verify-jwt is correct; the
# endpoint is intentionally public.
supabase functions deploy tenant-resolve --no-verify-jwt

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
- The current UI remains manual-assisted until dedicated authorization and automation Edge Functions are built.
