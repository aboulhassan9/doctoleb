# Runbook · Staging Environment

> **TL;DR:** We don't have a separate "staging" Supabase project. Staging is
> Vercel preview deploys against the same control plane as production, with
> the **`dev`** tenant acting as the shared staging tenant. This runbook
> documents how that works and how to use it safely.

## What exists

| Surface | Production URL | Staging | How staging differs |
|---|---|---|---|
| Marketing | (future `doctoleb.com`) | Vercel preview URL per PR | New app — first deploy pending |
| Patient web | `doctoleb-patient-web.vercel.app` | `doctoleb-patient-web-git-<branch>-<team>.vercel.app` | Same tenant resolver |
| Clinic ops | `doctoleb-clinic-ops.vercel.app` | `doctoleb-clinic-ops-git-<branch>-<team>.vercel.app` | Same tenant resolver |
| Control plane | `doctoleb-control-plane.vercel.app` | Preview URL per PR | **Shared** with prod (same Supabase project) |
| Tenant resolver Edge Function | Control plane project | Same | Public, cached |
| Control plane DB | `xouqxgwccewvbtkqming` | Same | No separate staging DB |
| Tenant DBs | Per-tenant Supabase projects | Same | Use the `dev` tenant for staging work |

## Why no separate staging Supabase project

1. **Cost.** Each Supabase project carries a monthly bill. Duplicating the
   control plane would double our Supabase spend before we have revenue.
2. **Synchronization burden.** Per-tenant Supabase projects (the real
   clinical data) are already isolated, which is the only isolation that
   actually matters for PHI. A separate "staging control plane" would
   need synced migrations + entitlement seeds + plan rows, with all the
   drift that implies.
3. **Edge Function versioning is already per-deploy.** Preview deploys hit
   the same Edge Function endpoint, but only after `supabase functions
   deploy` runs against the project — which only happens on the
   `main` branch in CI. Preview deploys against the prod Edge Function
   set are read-only-equivalent.

## The `dev` tenant

In the control plane there's a single tenant whose slug is **`dev`**. Its
Supabase backing project is `gezmfmskhmjgnquoyosq` (the legacy
`clinic-website` project that pre-dates the SaaS split). Every contributor
exercises new flows against this tenant.

Implications:

- **Resetting `dev` data is on the contributor.** Tests that need a clean
  state should clean up after themselves.
- **`dev` is publicly accessible** at `doctoleb-clinic-ops.vercel.app` and
  `doctoleb-patient-web.vercel.app` because those are registered as its
  active domains. There is no auth gate at the network level — only the
  Supabase Auth gate.
- **`dev` has localhost domains active too** so local dev hits the right
  tenant without explicit slug entry.

## Deploying a change for staging review

1. Push your branch.
2. Open a PR. The tiered CI pipeline runs based on the change classifier
   lane (see `scripts/ci-change-classifier.mjs`).
3. Vercel auto-deploys a preview for any frontend change. The URL is in
   the PR check.
4. Share the preview URL for review. Reviewers hit the same `dev` tenant
   data.
5. **Do NOT deploy Edge Functions or apply control-plane migrations from
   the branch.** Those land on the prod control plane on merge to `main`.

## Deploying a control-plane Edge Function for review

Option A (preferred): land it on `main` and ship. The change classifier
plus deploy scripts handle the rest.

Option B (manual, last resort):

```bash
supabase functions deploy <function-name> \
  --project-ref xouqxgwccewvbtkqming \
  --no-verify-jwt   # only if the function is intentionally public
```

This **replaces** the production version. Do NOT do this unless you
understand the rollback path (re-deploy the prior `main` HEAD version).

## Applying a control-plane migration for review

Option A (preferred): land it on `main`.

Option B (manual): use the MCP `mcp__supabase__apply_migration` tool against
project `xouqxgwccewvbtkqming`. Migrations are append-only and idempotent;
this is safe to do mid-PR for testing, but the migration file MUST still
be in the PR — otherwise the next `npm run check:tenant-migration-bundle`
will flag drift.

## Per-tenant DB staging

For testing against a fresh tenant, **provision a new tenant** with a
disposable slug (`test_<your_initials>_<date>`) through the control-plane
console. After the test, archive it via the admin API. Don't reuse the
`dev` tenant for breaking changes — too many other contributors rely on
its state.

## Teardown checklist (when retiring a test tenant)

1. Open the control-plane console.
2. Find the test tenant.
3. Run `admin-archive-tenant` (cancels the provisioning job, marks the
   tenant `archived`, leaves the tenant Supabase project intact for 30
   days as a data retention buffer).
4. After 30 days, manually delete the tenant Supabase project from the
   Supabase dashboard. This step intentionally requires human approval.

## Smoke tests

The CI runs these against the **deployed** apps after every successful
deploy of `main`:

- `npm run smoke:browser:deployed` — Playwright headless against the
  three app URLs.
- `npm run smoke:auth:deployed` — auth flow on `dev`.
- `npm run smoke:csp:deployed` — CSP headers present.
- `npm run smoke:tenant-resolver` — resolver returns valid data for `dev`.

You can run any of these locally against a preview URL by setting the
appropriate env var (see the script headers).

## When prod is on fire

- Roll back via Vercel ("Promote a previous deployment").
- Re-deploy the prior `main` HEAD on the Edge Functions you changed.
- Control-plane migrations are append-only — you cannot "unmigrate." If a
  migration breaks prod, write a forward-fix migration immediately.
