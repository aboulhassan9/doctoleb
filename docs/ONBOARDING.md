# DoctoLeb · Engineer Onboarding

> Last updated: 2026-05-13. If this guide drifts from the code, the code wins.

This guide gets a new engineer from `git clone` to "I can ship a small change"
without needing to ask 30 questions. It does NOT replace the deeper
architectural docs (`CLAUDE.md`, `SAAS_FOUNDATION_PHASE_HANDOFF.md`, the ADRs)
— those should still be read.

---

## 1. What DoctoLeb is

A multi-tenant healthcare SaaS. Each clinic gets its own **isolated Postgres
project** under Supabase. A separate **zero-PHI control plane** handles
routing, plans, entitlements, provisioning, and audit. Two patient-facing apps
(`patient-web`, `clinic-ops`) plus a super-admin console (`control-plane`) and
the public marketing site (`marketing`) live in the same monorepo.

Read in order:

1. [CLAUDE.md](./CLAUDE.md) — repo rules, service-layer contract, SELECT
   conventions, the three non-optional rules.
2. [SAAS_FOUNDATION_PHASE_HANDOFF.md](./SAAS_FOUNDATION_PHASE_HANDOFF.md) —
   tenant architecture and the active migration path.
3. [docs/decisions/](./docs/decisions/) — every architectural decision lives
   here. ADR-001 through ADR-008 in order.
4. [master_100_plan.md](../master_100_plan.md) — the audit-score remediation
   plan still in flight.

---

## 2. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20 LTS or 24 | `npm` ships with Node. We use ES modules everywhere. |
| Supabase CLI | latest | `npm install -g supabase` — needed for local DB stack and Edge Function deploy. |
| git | any recent | Hooks are local-only — no pre-push gating yet. |
| Editor | VS Code or your taste | If you use VS Code, install the ESLint and Tailwind CSS extensions. |

You do **not** need Docker installed for daily work. The disposable local
Supabase stack used in CI lives on the GitHub runners; locally you point at the
shared dev project via `.env.local`.

---

## 3. First-time setup

```bash
git clone https://github.com/aboulhassan9/doctoleb.git
cd doctoleb
npm ci
cp .env.example .env.local   # fill in the dev Supabase URL and anon key
```

Sanity check:

```bash
npm run verify
```

`verify` runs lint + all four builds + the tenant migration bundle check +
unit tests + backend-contract audit + DB-contract test + `npm audit --high`.
If it's green, the working tree matches what CI expects.

---

## 4. The map

```text
apps/
  patient-web/       — public patient-facing app, port 3001
  clinic-ops/        — staff-facing app (doctor, secretary, predoctor), port 3002
  control-plane/     — super-admin console at console.doctoleb.com, port 3004
  marketing/         — public marketing landing for doctoleb.com, port 3000

packages/
  core/              — @doctoleb/core: services, schemas, lib, hooks
    services/        — every external/DB call goes through one of these
    schemas/         — Zod validation, one file per domain
    lib/             — selects.js (DNA), supabase client, helpers
    hooks/           — shared utility hooks; features/ has per-domain hooks
  ui/                — @doctoleb/ui: shared React primitives + contexts

supabase/
  migrations/        — tenant-DB schema (applied per-clinic at provisioning)
  functions/         — currently empty by design; tenant-side Edge Functions are retired

supabase-control-plane/
  migrations/        — control-plane DB schema
  functions/         — admin & resolver Edge Functions (tenant-resolve, admin-*, marketing-capture-lead)

scripts/             — CI classifier, deploy scripts, smoke tests, audits
tests/unit/          — node:test contract tests (242 tests)
docs/decisions/      — ADRs (numbered, accepted, immutable)
docs/runbooks/       — operational how-tos per feature
```

---

## 5. Key commands

| Command | What it does |
|---|---|
| `npm run dev:patient` | Patient app at http://localhost:3001 |
| `npm run dev:ops` | Clinic-ops app at http://localhost:3002 |
| `npm run dev:control-plane` | Control plane at http://localhost:3004 |
| `npm run dev:marketing` | Marketing landing at http://localhost:3000 |
| `npm run build:<app>` | Production build of that app |
| `npm run lint` | ESLint everything |
| `npm run test:unit` | All unit + contract tests (~1 second locally) |
| `npm run audit:backend-contract` | Static analysis of the service-layer contract |
| `npm run check:tenant-migration-bundle` | Verify the tenant migration bundle is up to date with `supabase/migrations/` |
| `npm run smoke:browser:deployed` | Hit the deployed apps with Playwright; reads `DEPLOYED_APP_URL` |
| `npm run verify` | The full pre-PR gate (everything above) |

---

## 6. Common workflows

### Add a new page

1. Decide which app owns it (`patient-web`, `clinic-ops`, etc.).
2. Create `apps/<app>/src/pages/MyNewPage.jsx`. Use only `@core/services/*`
   and `@ui/components/*` — no raw `supabase.from(...)` calls, no inline
   business logic.
3. Add a route in `apps/<app>/src/App.jsx`. Wrap it in `<ProtectedRoute>` if
   it requires auth, and pass `appSurface="ops"` or `"patient"` to enforce
   the cross-surface boundary.
4. Run the app, hit the URL, verify.
5. `npm run lint && npm run test:unit && npm run build:<app>`.

### Add a new service method

1. Decide which service it belongs to (or create a new one if it's a fresh
   domain).
2. **First** add the input schema in `packages/core/schemas/<domain>.js`. Use
   `parseWithSchema` at the top of the method.
3. Use `apiCall()` or `apiPaged()` from `services/api.js` — never write raw
   try/catch unless wrapping multi-step logic.
4. Use the SELECT constant from `packages/core/lib/selects.js`. Never
   `.select('*')`.
5. If the method returns data the UI relies on, consider adding a response
   schema in `schemas/responses.js` and validating before return (F3
   pattern).

### Add a new migration

1. Decide: tenant DB (`supabase/migrations/`) or control plane
   (`supabase-control-plane/migrations/`).
2. Name: `YYYYMMDDHHMMSS_short_description.sql` (tenant) or
   `00010000000NNN_control_plane_short_description.sql` (control plane).
3. Always: `create table if not exists`, `alter table ... add column if not
   exists`, `create or replace function`. Migrations must be idempotent.
4. For tenant migrations: regenerate the bundle with
   `npm run generate:tenant-migration-bundle`. Commit both the SQL and the
   bundle. CI fails if they drift.
5. Apply locally (`supabase db push`) or via MCP for review.

### Add a new ADR

1. Take the next number in `docs/decisions/`.
2. Use the existing ADR template: Status, Date, Context, Decision, Security
   Rules (if applicable), Consequences, Alternatives Considered,
   Reversibility.
3. Keep it under 200 lines. ADRs that need more than that are usually two
   ADRs.

### Add a new tenant provisioning step

1. Decide where it slots in `PROVISIONING_STEP_ORDER` in
   `supabase-control-plane/functions/admin-run-provisioning-step/index.ts`.
2. Write a new migration that updates `admin_seed_tenant_provisioning_steps`
   with the new step. Existing jobs need backfilling (see the
   `normalize-tenant-auth-settings` runbook for an example).
3. Add the step to `SAFE_RUNNER_STEPS` and the dispatcher.
4. Add a `run<Name>` function with idempotency, preconditions, postconditions,
   and a sane undo strategy.
5. Update `ProvisioningStepsPanel.jsx` to render the new step.
6. Update `tests/unit/saasFoundationContracts.test.mjs` to assert the new
   step is in the order and references the right helper.
7. Apply the migration via MCP or CLI.

---

## 7. Three things that bite new engineers

1. **`payments.archive()` sets `status: 'failed'`, not `'cancelled'`.** The DB
   enum has no `cancelled`. Don't "fix" it.
2. **`auth_user_id` is not in `USER_PUBLIC_FIELDS`.** Auth lookups go through
   `lib/authIdentity.js`, not bulk selects.
3. **Some older migration files mention deleted tables.** That's history, not
   an active contract. The legacy burndown migration drops them.

---

## 8. When you get stuck

- For *what does this code do?* — read `CLAUDE.md` first; it answers most
  pattern questions.
- For *what is the architecture here?* — read the relevant ADR in
  `docs/decisions/`.
- For *what is the live DB shape?* — use the Supabase MCP `list_tables` tool
  against project `gezmfmskhmjgnquoyosq` (legacy clinical tenant) or
  `xouqxgwccewvbtkqming` (control plane). Trust the DB, not docs.
- For *what's left in the audit?* — `master_100_plan.md`.

---

## 9. Production deploy

We don't deploy from local. The tiered CI pipeline in
`.github/workflows/ci.yml` deploys to Vercel + applies Supabase migrations
based on the change-classifier lane. See `scripts/ci-change-classifier.mjs`
for the routing rules and the runbooks in `docs/runbooks/` for any
operational concerns.

Pushing to `main` triggers the pipeline; PRs run the appropriate verify
lane only.
