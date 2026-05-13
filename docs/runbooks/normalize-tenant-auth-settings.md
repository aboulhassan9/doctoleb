# Runbook · Normalize Tenant Auth Settings

**Step code:** `normalize_tenant_auth_settings`
**Position:** between `seed_tenant_profile` and `seed_first_doctor_admin`
**Provider:** `supabase` (calls Supabase Management API)
**Added:** 2026-05-13

## What it does

Calls `PATCH /v1/projects/{ref}/config/auth` on the tenant's Supabase project to normalize Auth settings before the first-doctor invite goes out. Currently sets:

- `mailer_otp_length`: **6** (matches the OTP input UI in `OpsLoginPage.jsx`)
- `mailer_otp_exp`: **600 seconds** (10-minute OTP validity)
- `site_url`: the active ops domain (or `/t/<slug>` no-domain fallback)
- `uri_allow_list`: every `/login` and `/reset-password` URL the tenant can be reached at across both surfaces and routing modes

The Personal Access Token (PAT) used to authenticate the Management API call is read **server-side only** from the tenant job's `supabase_connection_id` via `provisioning_provider_connections.secret_ref` (Vault or Edge Function secret). The browser never sees the PAT.

## Prerequisites

1. The tenant job must reference a `supabase` provider connection with:
   - `status = 'active'`
   - `is_automation_enabled = true`
   - A valid `secret_ref` pointing to a stored Supabase PAT (Vault row or Edge Function env var name)
2. `apply_tenant_migrations` and `seed_tenant_profile` must have succeeded.
3. `configure_vercel_project` OR the tenant's slug + Supabase runtime config must give the resolver at least one routable surface (custom domain or `/t/<slug>` path routing).

If the tenant has no provider connection (automation_mode is `manual`), this step fails with `PROVIDER_CONNECTION_REQUIRED`. That's expected for manual-mode tenants — operators must configure OTP length in the Supabase dashboard themselves.

## How to run for a NEW tenant

Already automatic. As of migration `00010000000027`, every newly provisioned tenant gets this step seeded into its `tenant_provisioning_steps` ledger. Running through the control-plane UI's "Run setup" buttons advances through it the same as every other step.

## How to retrofit an EXISTING tenant (e.g. the `aaaa`/assad tenant)

The migration only changes what's seeded for NEW jobs. Existing jobs have a ledger that does not include this step. To run it against an already-provisioned tenant, you have two paths:

### Fastest path: one-time dashboard fix

1. Open the tenant's Supabase dashboard project (for assad: `https://supabase.com/dashboard/project/rpfhdbtyzuznhfcudrgt`)
2. Auth → Providers → Email → set OTP Length to 6
3. Done

This is the recommended path for tenants that already exist and don't yet have a provider connection wired up.

### Architected path: backfill the step row and run it

Only do this once a Supabase provider connection exists for the tenant.

```sql
-- Run in the control plane (xouqxgwccewvbtkqming) as service_role.
-- Replace the values with the target tenant + its provisioning job.

insert into public.tenant_provisioning_steps (
  provisioning_job_id,
  tenant_id,
  step_code,
  provider,
  status,
  idempotency_key,
  preconditions,
  postconditions,
  undo_strategy,
  undo_payload
)
values (
  '<job_id>'::uuid,
  '<tenant_id>'::uuid,
  'normalize_tenant_auth_settings',
  'supabase',
  'pending',
  '<job_id>:normalize_tenant_auth_settings',
  jsonb_build_object('requiresSupabaseProject', true, 'requiresSupabaseConnection', true),
  jsonb_build_object('tenantAuthConfigNormalized', false),
  'restore_previous_value',
  jsonb_build_object('restorePreviousAuthConfig', true, 'externalResourceKind', 'supabase_auth_config')
)
on conflict (provisioning_job_id, step_code) do nothing;
```

Then invoke `admin-run-provisioning-step` from the control-plane UI (or directly via the Edge Function) for that step. It will read the job's `supabase_connection_id`, pull the PAT from Vault, and PATCH the Auth config.

## Error codes

| Error | Meaning | Fix |
|---|---|---|
| `PROVIDER_CONNECTION_REQUIRED` | Job has no supabase_connection_id, or connection is not automation-ready | Upsert a Supabase provider connection with a valid PAT secret_ref and link it to the job |
| `PROVIDER_AUTH_FAILED` | PAT was rejected by Supabase (401/403) | Token is wrong, expired, or lacks org access. Rotate via `admin-store-provider-secret` |
| `PROVIDER_RATE_LIMITED` | Management API rate limit | Wait and retry |
| `TENANT_ROUTING_REQUIRED` | No active patient/ops routing found | Run `configure_vercel_project` first, or add active domain rows |
| `INVALID_PROJECT_REF` | Tenant's supabase_project_ref is malformed | Fix tenant row; project ref must match `^[a-z0-9]{20}$` |
| `AUTH_CONFIG_UPDATE_FAILED` | Generic non-OK response from Management API | Check `details.status` in the step result, then Management API status page |

## Security posture

- PAT never leaves the Edge Function process. Stored in Vault or Edge Function env, read at call time, discarded after the fetch.
- No raw token is written to `tenant_provisioning_steps.postconditions` or any control-plane table — the secret_ref pattern is enforced by a CHECK constraint on `provisioning_provider_connections`.
- The step output records only the project ref, the field names applied, and counts — no values.

## Reversibility

`undo_strategy = restore_previous_value` is declared but **the runner currently does not snapshot the previous Auth config before patching**. The compensation step today is a no-op placeholder. Document this as a follow-up if you need true rollback. Most fields are idempotent (setting OTP length back to its prior value is safe), so the practical risk is bounded.
