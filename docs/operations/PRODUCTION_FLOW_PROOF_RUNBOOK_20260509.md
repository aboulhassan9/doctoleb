# Production Flow Proof Runbook - 2026-05-09

## Purpose

This runbook covers the first-band production flow proof for DoctoLeb's no-domain SaaS foundation. It verifies deployed Vercel aliases, Supabase resolver routing, authenticated browser flows, and the control-plane admin API boundary without requiring ownership of `doctoleb.com`.

The execution backlog for the remaining flow-proof work lives in `docs/operations/NEXT_PHASE_FLOW_PROOF_BACKLOG_20260509.md`.

## Required Gates

- `npm run verify`
- `npm run build:patient`
- `npm run build:ops`
- `npm run build:control-plane`
- `npm run audit:backend-contract`
- `npm run audit:bundle-secrets`
- `npm run smoke:tenant-resolver`
- `npm run smoke:control-plane-admin-cors`
- `npm run smoke:browser:deployed`
- `npm run smoke:auth:deployed`
- `npm run smoke:flows:deployed`
- `npm run smoke:csp:deployed`

`npm run audit:bundle-secrets` scans local build outputs by default: `dist`, `apps/patient-web/dist`, `apps/clinic-ops/dist`, `apps/control-plane/dist`, and any existing `.vercel/output/static`. In CI, `BUNDLE_DIR=.vercel/output/static` stays explicit and strict so a missing Vercel build artifact fails instead of silently skipping.

## CI Backend Contract Database

GitHub Actions no longer needs a paid Supabase branch or a second Supabase project for backend DB contract checks. The `verify` job starts a disposable local Supabase stack, applies the tenant migrations with `supabase db reset --local --no-seed`, exports the local DB/API/anon values from `supabase status -o env`, and then runs `npm run test:backend-db-contract` with `BACKEND_DB_CONTRACT_REQUIRED=true`.

This keeps the SQL audit and pgTAP RLS suite away from the live tenant database. Do not point `BACKEND_TEST_DATABASE_URL` at the live tenant pooler URL because `supabase/tests/pgtap_rls.sql` seeds synthetic rows inside a transaction and is documented as disposable-only.

Local developer runs still skip DB-backed checks when Docker/`psql` are unavailable and `BACKEND_DB_CONTRACT_REQUIRED` is not set. CI is the required proof path for the local disposable DB contract suite.

## CI Secrets

The deployed browser/auth/flow smokes also require:

- `AUTH_SMOKE_PATIENT_EMAIL`
- `AUTH_SMOKE_PATIENT_PASSWORD`
- `AUTH_SMOKE_DOCTOR_EMAIL`
- `AUTH_SMOKE_DOCTOR_PASSWORD`
- `AUTH_SMOKE_SECRETARY_EMAIL`
- `AUTH_SMOKE_SECRETARY_PASSWORD`
- `AUTH_SMOKE_PREDOCTOR_EMAIL`
- `AUTH_SMOKE_PREDOCTOR_PASSWORD`
- `AUTH_SMOKE_CONTROL_OWNER_EMAIL`
- `AUTH_SMOKE_CONTROL_OWNER_PASSWORD`

## Flow Smoke Modes

`npm run smoke:flows:deployed` is safe by default. It logs into each app, verifies first-band pages, opens critical modals/forms, checks no forbidden secret markers render in browser text, captures screenshots, and writes `output/playwright/deployed-flow-qa-report.json`.

Optional mutation flags are disabled by default:

- `FLOW_SMOKE_MUTATE_APPOINTMENTS=true` attempts patient booking UI mutation when a future slot exists.
- `FLOW_SMOKE_MUTATE_STAFF=true` creates a QA pending staff invite, resends it, cancels it, shows inactive staff, and reissues the invite.
- `FLOW_SMOKE_MUTATE_CONTROL_PLANE=true` creates a QA tenant draft and attempts a cancellation path when available.

Mutation mode must use `qa-e2e-*` identifiers and reversible states only. Do not enable mutation mode in CI until the target QA tenant has disposable records, stable slots, and cleanup proof.

## Rate Limiting

Control-plane Edge rate limiting is backed by `public.edge_rate_limit_buckets` in `xouqxgwccewvbtkqming`.

The table stores only zero-PHI operational metadata:

- route name
- SHA-256 key hash
- time window
- request count
- expiry

The public resolver keeps its existing error union. When throttled, it returns HTTP `429` with `{ data: null, error: "TENANT_RESOLVER_DOWN" }` and rate-limit headers. Admin functions return `{ data: null, error: "RATE_LIMITED" }`.

## No-Domain Rule

Real `doctoleb.com` domains remain `pending` until the domain is purchased, DNS is verified, and SSL is active. Vercel aliases remain acceptable production placeholders for this phase.

## Manual Blockers

- Supabase leaked-password protection is deferred because the current Supabase plan does not support it.
- Email-link invite acceptance proof needs a safe test inbox or a dedicated mutable accepted staff QA account.
- Fully automatic Supabase project creation and Vercel REST project/env/custom-domain mutation remain deferred until provider-token storage, cost control, org/region selection, and compensation are designed.
