# DoctoLeb SaaS Foundation Phase Handoff

> **Date prepared:** 2026-05-08  
> **Prepared for:** Incoming senior engineer / senior agent  
> **Repo:** `G:\project\doctoleb`  
> **Workspace rules:** `G:\project\AGENTS.md`  
> **Clinical tenant Supabase:** `gezmfmskhmjgnquoyosq`  
> **SaaS control-plane Supabase:** `xouqxgwccewvbtkqming`  
> **Status:** SaaS/control-plane foundation exists; next work must harden, split, test, and activate in small reversible slices.

---

## 1. Mission

You are taking over the next DoctoLeb SaaS foundation phase. Treat this as production-bound healthcare SaaS engineering, not a prototype, demo, or UI mockup.

The goal is to make DoctoLeb a clean, reversible, zero-PHI SaaS platform:

- `doctoleb.com` will become the doctor/clinic-owner marketing site.
- `console.doctoleb.com` will become the SaaS super-admin console.
- `{tenant}.doctoleb.com` will be the patient-facing tenant app.
- `{tenant}.ops.doctoleb.com` will be the clinic operations tenant app.
- Tenant clinical/PHI data stays only in tenant Supabase projects.
- The control plane stores only SaaS metadata, routing, domains, plans, entitlements, provisioning state, audit events, and operational health metadata.

The real public domain is **not ready yet**. `doctoleb.com` is not purchased or verified, so all real public domain rows must remain `pending`. Localhost smoke-test domains can remain active. Vercel-provided deployment hosts are supported through explicit public env allowlists, which lets the project finish and deploy before domain purchase without changing the later custom-domain path.

---

## 2. Mandatory Rules

Read and follow `G:\project\AGENTS.md` and `G:\project\doctoleb\CLAUDE.md` before editing.

Non-negotiable operating rules:

- No prototype, mockup, fake production data, temporary shortcut, dead code, or uncategorized file.
- No duplicated DB table, service, API contract, feature-state table, validation schema, UI primitive, or business logic path.
- No business logic in React pages/components. UI renders state and calls hooks/services only.
- No raw Supabase, fetch, payment, AI, storage, or analytics calls from UI components/pages.
- No service-role key, management token, tenant admin credential, PHI-only secret, or clinical secret in browser-visible code/config.
- No PHI in the control plane.
- No `tenant_id` columns in tenant DB tables. DoctoLeb uses database-per-tenant isolation.
- Every create/provision/mutate action must be designed for undo, rollback, cancel, archive, disable, or compensation.
- Preconditions belong at the system boundary. Invariants belong in DB constraints/RLS/triggers/RPCs. Postconditions must be explicit and auditable.
- Every behavior change needs tests or a documented verification path.

If these rules conflict with speed, choose the rules.

---

## 3. Mandatory Read Order

Read these first, in order:

```txt
G:\project\AGENTS.md
G:\project\doctoleb\CLAUDE.md
G:\project\doctoleb\HANDOFF_REVIEW_AND_STATUS.md
G:\project\doctoleb\SYSTEM_DESIGN_DEEP_DIVE.MD
G:\project\doctoleb\PRODUCT.md
G:\project\doctoleb\DESIGN.md
G:\project\doctoleb\BACKEND_CONTRACT_LEDGER.md
G:\project\doctoleb\BACKEND_DUPLICATION_AUDIT.md
G:\project\doctoleb\CONTROL_PLANE_SETUP.md
G:\project\doctoleb\NEXT_STEPS_PLAN.md
G:\project\doctoleb\docs\decisions\ADR-004-domain-routing-and-control-plane-contract.md
G:\project\doctoleb\docs\decisions\ADR-005-saas-admin-entitlements-and-provisioning.md
```

Then inspect these implementation areas:

```txt
G:\project\doctoleb\apps\control-plane\
G:\project\doctoleb\apps\patient-web\src\App.jsx
G:\project\doctoleb\apps\patient-web\src\pages\LandingPage.jsx
G:\project\doctoleb\apps\clinic-ops\src\App.jsx
G:\project\doctoleb\packages\core\lib\entitlements.js
G:\project\doctoleb\packages\core\lib\logger.js
G:\project\doctoleb\packages\core\services\tenantResolver.js
G:\project\doctoleb\packages\core\services\tenantConfig.js
G:\project\doctoleb\packages\ui\contexts\TenantBootstrap.jsx
G:\project\doctoleb\packages\ui\components\consent\PatientConsentGate.jsx
G:\project\doctoleb\packages\ui\components\messaging\MessagingPage.jsx
G:\project\doctoleb\supabase-control-plane\
G:\project\doctoleb\scripts\backend-contract-audit.mjs
```

---

## 4. Current Known State

Current repo worktree is broad and dirty. Do not assume every change is yours. Inspect before changing and do not revert unrelated work.

Known implemented foundation:

- Runtime tenant resolver exists.
- `tenant-resolve` Edge Function exists and is public with `verify_jwt=false`.
- Control-plane project `xouqxgwccewvbtkqming` exists.
- First clinical tenant remains `gezmfmskhmjgnquoyosq`.
- Control-plane tables include SaaS/control-plane metadata only.
- New `apps/control-plane` exists as the super-admin app foundation.
- Entitlement helpers exist in `packages/core/lib/entitlements.js`.
- Doctor-facing landing page direction exists in `apps/patient-web/src/pages/LandingPage.jsx`.
- Admin Edge Functions exist under `supabase-control-plane/functions`.
- ADR-005 records the SaaS admin, entitlements, and manual provisioning direction.

Known quality risks to address before adding more features:

- `apps/control-plane/src/App.jsx` is currently too large and mixes concerns.
- `packages/ui/components/messaging/MessagingPage.jsx` is large and should be split carefully.
- `packages/ui/components/consent/PatientConsentGate.jsx` is also large enough to deserve extraction.
- `apps/clinic-ops/src/pages/CreateBillPage.jsx` contains mock/demo-style coverage logic and must be reviewed or gated before production.
- There are many changed/untracked files, including generated `dist/` output and Vite cache paths. Confirm what is intentionally tracked before committing.

---

## 5. External Source Baselines

Use current official docs when implementing or reviewing these areas:

- React architecture: pure components, extraction of state logic, and no hidden side effects in render paths.
- Supabase RLS: every exposed table needs RLS and explicit policies.
- Supabase Edge Functions auth: public functions only when responses are safe; privileged functions must validate auth or server-side secrets.
- Stripe Entitlements: feature lookup keys and webhook-driven grant/revoke model.
- Vercel multi-tenant routing: root marketing, subdomains, custom domains, DNS, and SSL management.
- OWASP secure coding guidance: validation, authorization, error handling, logging, data protection, and database security.

Do not rely on memory for platform behavior that may have changed.

---

## 6. Target Architecture

The platform boundary is:

```txt
Browser host
  -> tenant resolver
  -> runtime tenant Supabase config
  -> tenant-scoped Supabase client
  -> packages/core services/RPCs
  -> patient-web or clinic-ops UI
```

The SaaS admin boundary is:

```txt
Control-plane admin app
  -> authenticated control-plane Supabase session
  -> admin Edge Function
  -> control-plane DB mutation
  -> audit event
  -> optional secure tenant DB sync through server-side tenant service secret
```

Do not let React components call privileged APIs directly. Do not let control-plane UI mutate tenant DBs directly.

---

## 7. Phased Work Plan

### Phase 0: Freeze, Inventory, And Quality Gate

Purpose: create a safe baseline before more feature work.

Tasks:

- Run `git status --short` and classify changes as source, docs, migrations, generated output, local env, or unknown.
- Run `npm run verify`.
- Run `npm run build:patient`.
- Run `npm run build:ops`.
- Run `npm run build:control-plane`.
- Run `npm run audit:backend-contract`.
- Search for service-role keys, hardcoded tenant URLs, `.select('*')`, hard deletes, raw UI calls, and mock/demo production logic.
- Check whether `dist/` or Vite cache files are unintentionally present in git status.

Acceptance criteria:

- The incoming engineer knows exactly what is dirty and why.
- Any failing command is logged with file/line-level cause.
- No new implementation starts until the baseline is understood.

Undo/reversibility:

- Documentation-only inventory is reversible by editing the handoff.
- Do not run destructive cleanup until generated/untracked ownership is verified.

---

### Phase 1: Architecture Cleanup Before Expansion

Purpose: make current SaaS foundation maintainable before adding capability.

Tasks:

- Split `apps/control-plane/src/App.jsx` into focused files:
  - API client stays in `apps/control-plane/src/lib/controlPlaneApi.js`.
  - Auth/session state belongs in a hook.
  - Tenant list state belongs in a hook.
  - Tenant detail state belongs in a hook.
  - Panels belong in `apps/control-plane/src/components`.
  - Static SaaS catalog data stays in `apps/control-plane/src/data`.
- Split messaging UI into smaller components without changing behavior.
- Split consent gate loading/error/acceptance state from modal rendering.
- Add or adjust unit tests for extracted pure logic.
- Keep behavior unchanged in this phase unless a bug is discovered and documented.

Acceptance criteria:

- No large catch-all control-plane component remains.
- Pages/components render and delegate; hooks/services own state and side effects.
- No duplicate logic is introduced.
- Existing builds and tests pass.

Verification:

```bash
npm run verify
npm run build:control-plane
npm run build:patient
npm run build:ops
```

Undo/reversibility:

- Refactor commits must be behavior-preserving.
- If a split fails, revert only the refactor slice, not unrelated user work.

---

### Phase 2: Reversible State Machine And Mutation Contracts

Purpose: every create/update/provision/sync path must be safe to undo or compensate.

State machines to document and enforce:

- Tenant lifecycle: `draft`, `provisioning`, `active`, `maintenance`, `suspended`, `inactive`, `archived`.
- Domain lifecycle: `pending`, `active`, `disabled`, plus DNS/SSL `pending`, `verified/issued`, `failed`.
- Provisioning job lifecycle: `pending`, `running`, `blocked`, `completed`, `failed`, `cancelled`, `archived`.
- Entitlement lifecycle: plan default, add-on, manual override, disabled, revoked.
- Branding sync lifecycle: pending, synced, failed, rolled back/compensated.

Tasks:

- Review control-plane migrations for constraints and indexes matching the lifecycle model.
- Ensure admin Edge Functions validate preconditions before mutation.
- Ensure every mutation writes `tenant_events` or a documented equivalent.
- Ensure every mutation returns the canonical updated state.
- Ensure idempotency is explicit for retryable create/sync actions.
- Add tests for invalid transitions and blocked activation when domain is pending.

Acceptance criteria:

- Creation and mutation paths preserve enough identity/history to undo later.
- Domain activation cannot accidentally happen before ownership/DNS/SSL readiness.
- Maintenance/inactive/suspended/provisioning tenants resolve as `TENANT_INACTIVE`.
- Audit events do not contain PHI or secrets.

Verification:

```bash
npm run test:unit
npm run audit:backend-contract
npm run verify
```

Undo/reversibility:

- Prefer status changes over hard deletes.
- Provisioning jobs can be cancelled or archived.
- Entitlement changes can be revoked by another audit-backed mutation.
- Branding sync must support a future restore of the previous tenant config snapshot.

---

### Phase 3: SaaS Console Vertical Slices

Purpose: build the super-admin console as real operations software, not a mock dashboard.

Implement in this order:

1. Read-only tenant list.
2. Read-only tenant detail.
3. Tenant status control with audit.
4. Domain readiness and pending-domain checklist.
5. Plan/entitlement editor.
6. Branding editor with secure tenant sync.
7. Manual provisioning checklist.
8. Health checks and audit-event viewer.

Rules:

- Every UI mutation goes through an admin Edge Function.
- Every Edge Function verifies active super-admin role.
- Role checks must support `owner`, `operator`, `support`, and `billing_admin`.
- `support` must not gain write access by accident.
- Billing/plan actions must not require PHI access.
- Console must never display patient charts, messages, diagnoses, appointments, documents, or clinical notes.

Acceptance criteria:

- Each slice has one end-to-end path and tests/verification.
- No privileged secret reaches the browser.
- Failed writes render a safe error and leave state recoverable.
- Console does not contain fake analytics, fake tenants, or mocked production data.

Verification:

```bash
npm run build:control-plane
npm run test:unit
npm run audit:backend-contract
```

Undo/reversibility:

- Tenant status changes can be changed back according to the allowed state machine.
- Domain rows can be disabled, not deleted.
- Provisioning jobs can be cancelled or archived.
- Plan/entitlement changes must be auditable and reversible through another change.

---

### Phase 4: Runtime Entitlement Enforcement

Purpose: feature plans must be enforced by shared logic and backend boundaries, not only hidden in UI.

Tasks:

- Keep entitlement resolution in `packages/core`.
- Define canonical feature codes for AI, BI, reporting, messaging, custom branding, custom domains, advanced exports, and any future premium feature.
- Ensure React hides disabled UI only as a UX convenience.
- Ensure service/API/RPC/Edge Function paths reject disabled features with a documented error.
- Add tests for plan defaults, add-ons, manual overrides, disabled plans, missing feature codes, and invalid feature codes.
- Add backend enforcement before enabling paid/premium behaviors.

Acceptance criteria:

- A disabled paid feature cannot run through direct API use.
- Missing/unknown feature codes fail closed.
- Entitlement shape is ready to map to Stripe later.
- No duplicate feature state table is created in the tenant DB.

Verification:

```bash
npm run test:unit
npm run audit:backend-contract
npm run verify
```

Undo/reversibility:

- Feature grants can be revoked.
- Manual overrides can be replaced by plan defaults.
- Future Stripe webhook revoke/grant can map to the same control-plane model.

---

### Phase 5: Doctor-Facing Marketing Site

Purpose: DoctoLeb marketing targets doctors and clinic owners, not patients.

Tasks:

- Keep root marketing separate from tenant patient bootstrap.
- Build copy around clinic workflow, patient experience, staff operations, white-labeling, security posture, and early access.
- Add CTAs for demo/early access, not fake live checkout.
- Prepare pricing-plan sections without enabling billing promises before enforcement is complete.
- Keep localization-ready structure for Arabic/French later.

Acceptance criteria:

- No patient-buying language on DoctoLeb root marketing.
- No fake customer claims, fake doctors, fake logos, or fake AI promises.
- Landing page works desktop and mobile.
- Root marketing does not require tenant resolution.

Verification:

```bash
npm run build:patient
```

Manual browser QA:

```txt
http://localhost:3001
```

Undo/reversibility:

- Marketing content is isolated from tenant runtime logic.
- Pricing/CTA content can be changed without touching patient or ops apps.

---

### Phase 6: Observability, Security, And Operations

Purpose: prepare production operations without leaking PHI or secrets.

Tasks:

- Use the safe logger abstraction only.
- Tag logs with safe metadata only: `tenantId`, `tenantSlug`, `surface`, `route`, `featureCode`, `appVersion`.
- Never log PHI, medical text, messages, documents, secrets, access tokens, or service keys.
- Add resolver, Edge Function, tenant DB, and config-sync health checks.
- Add browser QA for patient, ops, console, and marketing flows.
- Run Supabase advisors for tenant and control-plane projects before DB release.
- Document restore/PITR and incident-response runbooks.

Acceptance criteria:

- No PHI appears in control-plane events/logs.
- Operational errors are observable without exposing secrets.
- Health check failures are actionable.
- Backup/restore path is documented before real PHI production launch.

Verification:

```bash
npm run verify
npm run audit:backend-contract
```

Undo/reversibility:

- Observability config can be disabled or redirected without product-code rewrites.
- Incident events are auditable and do not require deleting clinical records.

---

## 8. Immediate First Work Packet

Start here. Do not jump to new features.

### Task 1: Baseline Quality Gate

Files likely touched:

- No source files unless documenting findings.
- Optional: append findings to this handoff or `NEXT_STEPS_PLAN.md`.

Verification:

```bash
git status --short
npm run verify
npm run build:patient
npm run build:ops
npm run build:control-plane
npm run audit:backend-contract
```

Acceptance criteria:

- Current failures and dirty state are known.
- Generated files and local env changes are not accidentally committed.

### Task 2: Control-Plane App Refactor Plan

Files likely touched:

```txt
apps/control-plane/src/App.jsx
apps/control-plane/src/hooks/*
apps/control-plane/src/components/*
apps/control-plane/src/lib/*
tests/unit/*
```

Acceptance criteria:

- Written small-file extraction plan exists before editing.
- No behavior change is mixed into the refactor unless separately tested.

### Task 3: First Behavior-Preserving Extraction

Recommended first extraction:

- Move control-plane session/auth state out of `App.jsx` into a hook.
- Keep API calls through existing `controlPlaneApi`.
- Add focused tests only if logic is pure/testable at this point.

Acceptance criteria:

- `App.jsx` becomes smaller.
- UI still builds.
- No new raw external calls in components.

---

## 9. Security Review Checklist

Before approving a slice, answer:

- Does this create, move, or expose PHI outside tenant DBs?
- Does this add browser-visible service-role or management credentials?
- Does this bypass RLS or Edge Function authorization?
- Does this add a direct UI-to-Supabase mutation where a service/API should exist?
- Does this introduce a duplicate config or feature-state source of truth?
- Does this allow activating a pending public domain before DNS/SSL readiness?
- Does this allow a disabled entitlement to run through a backend path?
- Does this log patient data, clinical text, messages, documents, or secrets?
- Does this have a rollback, cancel, archive, disable, or compensation path?

If any answer is unsafe, stop and fix the design before coding.

---

## 10. Anti-Goals

Do not do these in this phase:

- Do not build automated Supabase Management API tenant provisioning yet.
- Do not enable live Stripe checkout before entitlement enforcement is complete.
- Do not activate `doctoleb.com` rows until the domain is purchased, verified, and SSL is issued.
- Do not create a marketplace.
- Do not build a patient-targeted root marketing page.
- Do not create duplicate branding tables.
- Do not create duplicate feature flag/entitlement tables in the tenant DB.
- Do not add `tenant_id` to tenant tables.
- Do not move clinical data to the control plane.
- Do not create super-admin access to patient charts/messages/documents.
- Do not perform broad rewrites across patient, ops, control-plane, DB, and functions in one change.

---

## 11. Required Verification Commands

Use the smallest relevant verification after each slice, and the full chain before handoff.

```bash
npm run verify
npm run build:patient
npm run build:ops
npm run build:control-plane
npm run audit:backend-contract
npm run test:unit
npm run test:backend-db-contract
```

Expected caveat:

- `test:backend-db-contract` may skip branch/local SQL and pgTAP checks unless `BACKEND_TEST_DATABASE_URL` is set. Treat skips as a coverage gap, not proof.

Browser QA targets:

```txt
http://localhost:3001
http://localhost:3002
control-plane dev server from npm run dev:control-plane
```

---

## 12. Handoff Completion Template

When the incoming engineer finishes a pass, append:

```md
## Senior Pass Completed — YYYY-MM-DD

### Scope Completed
- ...

### Verification
- `npm run verify`: pass/fail/skip notes
- `npm run build:patient`: pass/fail
- `npm run build:ops`: pass/fail
- `npm run build:control-plane`: pass/fail
- `npm run audit:backend-contract`: pass/fail

### Security Notes
- ...

### Reversibility Notes
- ...

### Remaining Risks
- ...

### Recommended Next Slice
- ...
```

---

## 13. Final Instruction To The Incoming Senior

Challenge this handoff. Verify the repo and live systems. If a document conflicts with the code or live Supabase shape, trust verified evidence and update the document.

Move in small slices. Keep every change reversible. Keep the control plane zero-PHI. Keep business logic out of UI. Keep tests close to behavior. Do not add anything that you cannot explain, undo, test, and maintain.

---

## 14. Phase 0 Baseline Findings — 2026-05-08

> Per §8 Task 1: documented baseline of the repo before any new implementation.
> Goal: incoming engineer knows exactly what is dirty, why, and what blocks progress.

### 14.1 Verify chain — green

```
✓ lint                           clean
✓ build                          ✓ built (Vite, root unified shell)
✓ test:unit                      15/15 passing  (hostnameSurface, tenantResolver)
✓ audit:backend-contract         14 PASS / 0 FAIL
✓ test:backend-db-contract       14 PASS  (anon RPC matrix)
✓ audit:high                     0 vulnerabilities
```

**Two SKIPs in `test:backend-db-contract`**, gated on `BACKEND_TEST_DATABASE_URL`:
- `DB introspection SQL audit` — needs a branch/local DB
- `pgTAP RLS contract suite` — needs the same

These are **coverage gaps, not failures**. Setting `BACKEND_TEST_DATABASE_URL` against a Supabase branch unlocks both. Phase 0 acceptance criteria do not require closing this; flagging it for Phase 6 (observability/security/operations).

### 14.2 Per-app builds — green

| App | Build time | Status |
|---|---|---|
| `npm run build:patient` | ~5.25s | ✓ |
| `npm run build:ops` | ~4.69s | ✓ |
| `npm run build:control-plane` | ~4.21s | ✓ |

`build:patient` emits a chunk-size warning (>500 kB) — pre-existing. Code-splitting is a deferred optimization, not a blocker.
`build:ops` emits a similar warning. Same disposition.

### 14.3 Generated files — properly ignored

`.gitignore` correctly excludes `node_modules`, `dist`, `dist-ssr`, `*.local`. `git status` shows zero generated artifacts. ✅ Clean.

### 14.4 Dirty file inventory (50 items: 33 modified, 17 untracked)

**Modified docs (intentional, prior + this session — 7):**
- `AGENT_HANDOFF_TIER2_STATUS.md`, `BACKEND_CONTRACT_LEDGER.md`, `BACKEND_DUPLICATION_AUDIT.md`, `CLAUDE.md`, `FRONTEND_APP_SPLIT_PLAN.md`, `NEXT_STEPS_PLAN.md`, `PRODUCT.md`

**Modified local env (uncommittable; ignored — 2):**
- `.env.example`, `.env.local` (the `.local` file is `.gitignore`d)

**Modified executable code (intentional — ~24):**
- 3 `App.jsx` (patient-web, clinic-ops, root unified shell) — wired `<TenantBootstrap>`, routes, classification-based shell selection
- 7 clinic-ops pages — pre-existing changes from prior sessions; not in this session's scope
- 1 patient-web page (`PatientMedicalHistoryPage.jsx`) — Slice 2 rewrite
- 11 `packages/*` files — runtime layer (`supabase.js`, `dateUtils.js`, services, contexts, sidebar, ProtectedRoute, etc.)
- 2 root config (`eslint.config.js`, `package.json`) — verify-chain extension
- 1 audit script (`scripts/backend-contract-audit.mjs`) — 3 new ADR-004 guards

**Untracked new (intentional — 17):**
- 5 architecture/handoff docs (this file + ADR-004/005 + SYSTEM_DESIGN_DEEP_DIVE + HANDOFF_REVIEW_AND_STATUS + CONTROL_PLANE_SETUP + NEXT_TIER_AGENT_HANDOFF)
- 1 new app: `apps/control-plane/`
- 4 new pages (StaffMessages, PatientMessages — each in their app)
- 7 new package files: `entitlements.js`, `env.js`, `hostnameSurface.js`, `tenantResolver.js`, `TenantBootstrap.jsx`, plus `consent/`, `messaging/`, `patient/` component directories
- `supabase-control-plane/` (control-plane SQL + Edge Functions)
- `tests/` (new unit test directory)

All untracked items map directly to ADRs 004/005 or this session's slices. Nothing orphan.

### 14.5 Forbidden-pattern scan — three findings

#### FINDING-1 (NIT) — `.select('*')` in control-plane Edge Function

**Location:** `supabase-control-plane/functions/admin-get-tenant/index.ts:94-95`

```ts
context.client.from('plans').select('*').order('sort_order', { ascending: true }),
context.client.from('plan_entitlements').select('*').order('feature_code', { ascending: true }),
```

**Why it matters:** AGENTS.md §Validation rule says "Every query must use the established select constants/service wrappers where the repo requires them." The audit guard `assertNoMatches('Services and Edge Functions must not use wildcard selects')` already covers `supabase/functions/`, but `supabase-control-plane/functions/` is not in its scan path — that's why it's not flagged in CI.

**Severity:** NIT for now (admin path, super-admin only, not patient-reachable). Should be cleaned up in **Phase 1** (architecture cleanup) along with the rest of the control-plane refactor. Add explicit field lists like `id, code, name, sort_order, ...`.

**Reversibility:** trivial — just spell out the columns. No data risk.

#### FINDING-2 (BLOCKING) — Hard delete on `clinics` table violates soft-delete rule

**Location:** `packages/core/services/clinics.js:46-50`

```js
async delete(id) {
  return apiCall(
    supabase.from('clinics').delete().eq('id', id)
  );
},
```

**Why it matters:** CLAUDE.md §Three rules that are not optional / Rule 3: "Clinical and financial data is soft-deleted, never hard-deleted. Tables with `is_archived` (patients, encounters, clinical documents…) — always archive, never DELETE." Clinics are practice locations referenced by `appointments`, `secretary_slots`, `doctor_schedule_templates` — deleting one would either fail FK constraints or orphan historical visits.

**Severity:** BLOCKING for production. The method exists but is **unlikely to be called** today (clinic-ops UI tends to use `archive`-style flows); a `grep` for `clinicService.delete` should confirm. Either way, the method itself is footgun-shaped: it would hard-delete a clinic if any caller touched it.

**Two acceptable resolutions:**

a. Replace with `archive(id)` that sets `is_archived = true, archived_at = now()`. This requires the `clinics` table to have those columns (verify via Supabase MCP).
b. If the column doesn't exist, add it via migration AND change the service. Migration first, code second.

Phase 1 candidate. Single-file change once the schema is verified.

**Reversibility:** removing or renaming the method is reversible by reverting the commit. The migration to add `is_archived` is forward-compatible (defaults to `false`).

#### FINDING-3 (BLOCKING) — Mock coverage logic in `CreateBillPage.jsx`

**Location:** `apps/clinic-ops/src/pages/CreateBillPage.jsx:79-83`

```js
const insuranceCoverage = useMemo(() => {
  if (paymentMethod !== 'insurance') return 0;
  // Mock coverage: Total - copay (simplified for demo)
  return Math.max(0, subtotal - insurance.copay);
}, [subtotal, paymentMethod, insurance.copay]);
```

**Why it matters:**
- AGENTS.md §Change Discipline: "No prototype, mockup, fake data, temporary shortcuts, or dead code in production paths."
- This computes the patient's insurance share — a **financial computation in a React page**, not in a service or RPC. Layering rule violation (§Layering Rules: "UI components and pages render state and call hooks/services only. They must not contain business rules…or complex calculations.").
- The repo already has an insurance domain: `insurance_providers`, `doctor_insurance_contracts`, `patient_insurance_policies`, `insurance_claims`, `claim_form_templates`, plus `insuranceService` in `packages/core/services/insurance.js`. The real coverage rules belong there.

**Severity:** BLOCKING for production. A clinic running on the current code would generate **wrong bills** for any patient whose policy is more nuanced than a flat copay.

**Two acceptable resolutions:**

a. **Gate behind an entitlement.** Per ADR-005 + `packages/core/lib/entitlements.js`, hide the "insurance" payment method when the tenant doesn't have insurance billing enabled. Default tenants compute cash bills only. Insurance flow becomes opt-in until the real coverage logic ships.
b. **Implement real coverage.** Move the calc into a `billingService.computeCoverage(patientId, services)` call that reads `patient_insurance_policies` + `claim_form_templates` and applies the contract terms.

Recommend **(a) first** — it's reversible, ships in one slice, and stops the bleeding. Then schedule **(b)** as a dedicated billing slice with its own ADR.

**Reversibility:** the gate is a one-line entitlement check + a UI conditional. Trivial to revert.

#### Other patterns checked — clean

| Check | Result |
|---|---|
| `service_role` literal in `apps/`, `packages/`, `src/` | ✅ Clean (only in docs and audit script) |
| `https://[a-z0-9]{20}\.supabase\.co` in executable code | ✅ Clean (only in docs + test fixtures using `devtenantref01234567`) |
| `.select('*')` in tenant services | ✅ Clean |
| `console.error` in services | ✅ Clean |
| Raw `supabase.from/rpc/auth/storage/channel` in pages | ✅ Clean |
| Hard delete in clinical/financial services | ✅ FINDING-2 closed in §18 |
| Hard delete elsewhere | ✅ All operational (slots/templates), gated on no-active-references |

### 14.6 Recommended next slice

**Phase 0 is complete.** Verify chain green, baseline understood, three findings recorded, no new implementation needed.

**Recommended Phase 1 first slice (per §8 Task 3):** *Move control-plane session/auth state out of `apps/control-plane/src/App.jsx` into a hook.* Behavior-preserving, smallest reversible change, sets pattern for the rest of the control-plane refactor.

Three other small-but-valuable fixes to fold into Phase 1, in this order:

1. **FINDING-3 (entitlement gate on insurance payment method)** — ~30 min. Reversible. Stops billing risk immediately.
2. **FINDING-1 (`.select('*')` in admin-get-tenant)** — ~10 min. NIT. Bundle with the control-plane refactor since you're touching that area anyway.
3. **FINDING-2 (`clinicService.delete` → `archive`)** — closed in §18. Live schema was missing archive columns, so the fix shipped migration-first, then service changes.

Each is a separate commit, each independently reversible.

### 14.7 What was NOT done in Phase 0 (correct per handoff scope)

- ✗ No source files edited (Task 1 specifically excludes source changes)
- ✗ No control-plane refactor started (Task 2 = write the plan, Task 3 = execute first extraction)
- ✗ No new features
- ✗ No commits

The next agent should pick up at **§8 Task 2 (Control-Plane App Refactor Plan)**, treating §14 above as the verified starting state.

---

## 15. Phase 2 Progress Update — 2026-05-08

Completed the first Phase 2 hardening slice and deployed it to the control-plane project:

- Control-plane Edge Functions now use explicit select contracts through `supabase-control-plane/functions/_shared/selects.ts`.
- `scripts/backend-contract-audit.mjs` now scans `supabase-control-plane/functions` and fails on wildcard or bare `.select()` calls.
- `admin-update-tenant` now validates tenant existence, blocks activation when no active/safely activating domain exists, prevents hostname takeover across tenants, and returns canonical updated tenant/domain state.
- Applied migration `00010000000006_control_plane_write_boundaries_and_job_transitions.sql` to `xouqxgwccewvbtkqming`; live RLS now exposes read policies only for authenticated super-admin reads, while mutations go through audited Edge Functions.
- Live DB verification confirmed the provisioning-job transition trigger exists, the updated status check allows `failed` and `archived`, and an invalid `ready_for_manual_provisioning -> completed` transition fails inside a rolled-back smoke transaction.
- Deployed updated admin Edge Functions to `xouqxgwccewvbtkqming`: `admin-get-tenant`, `admin-update-tenant`, `admin-create-provisioning-job`, `admin-sync-tenant-config`, and `admin-sync-entitlements`.
- Added unit contract coverage for explicit select lists, write-boundary migration, provisioning transitions, and tenant-update preconditions.
- Added and applied migration `00010000000007_control_plane_provisioning_job_idempotency.sql`; `tenant_provisioning_jobs.client_request_id` is now UUID-validated and protected by a partial unique index.
- `admin-create-provisioning-job` now returns the existing provisioning job on retries with the same `clientRequestId` instead of creating duplicates; the console generates a stable request id for each draft create action.
- Live DB verification confirmed the idempotency column, check constraint, unique index, migration history entry, and rolled-back invalid/duplicate-key smoke tests.
- Redeployed `admin-create-provisioning-job` to `xouqxgwccewvbtkqming`; it is active at version 3.
- Added and applied migration `00010000000008_control_plane_tenant_lifecycle_transitions.sql`; tenant statuses now include the documented `draft`, `provisioning`, `active`, `maintenance`, `suspended`, `inactive`, and `archived` lifecycle.
- Tenant activation is now guarded in both DB trigger and `admin-update-tenant`: activation requires an active tenant domain, `archived` is terminal, and invalid lifecycle transitions return `INVALID_TENANT_STATUS_TRANSITION`.
- Live DB verification confirmed invalid active insert fails, activation without active domain fails, activation after active domain succeeds, archived exit fails, and all smoke rows roll back to zero.
- Redeployed `admin-update-tenant` to `xouqxgwccewvbtkqming`; it is active at version 3.
- `admin-sync-tenant-config` now records `tenant_config.sync_started` and includes `previousSnapshot`/`currentSnapshot` in audit metadata so future branding rollback can be implemented without duplicate branding tables.
- Redeployed `admin-sync-tenant-config` to `xouqxgwccewvbtkqming`; it is active at version 3.
- Added explicit no-domain deployment host routing in `packages/core/lib/hostnameSurface.js`: `VITE_MARKETING_HOSTS`, `VITE_CONTROL_PLANE_HOSTS`, `VITE_PATIENT_TENANT_HOSTS`, and `VITE_OPS_TENANT_HOSTS` categorize Vercel-provided hosts before `doctoleb.com` is purchased. `classifyHostname` remains pure; only `classifyCurrentLocation` reads these public runtime env values.
- Updated `.env.example` and `CONTROL_PLANE_SETUP.md` with the no-domain deployment path. Temporary Vercel tenant hosts must still be represented by `tenant_domains` rows; real `doctoleb.com` rows remain `pending` until ownership, DNS, and SSL are verified.
- Added and applied migration `00010000000009_control_plane_atomic_tenant_update.sql`; `admin_update_tenant_atomic` now performs tenant/domain updates and the `tenant.updated` audit event in one service-role-only Postgres transaction.
- Redeployed `admin-update-tenant` to `xouqxgwccewvbtkqming`; it is active at version 4 and calls `admin_update_tenant_atomic` instead of mutating `tenant_domains` and `tenants` through multiple Edge Function calls.
- Added the first Phase 3 console domain-readiness slice: `DomainsPanel` now lets super-admin operators update existing domain `status`, `dns_status`, and `ssl_status` rows through `controlPlaneApi.updateTenant`, not direct Supabase calls. The shared `domainDrafts` helper mirrors activation readiness for operator feedback while the DB/RPC remains the enforcement boundary.
- Added unit coverage for control-plane domain drafts: host normalization, readiness-gated activation, localhost smoke-domain behavior, immutable draft updates, and blocked-activation messaging.

Verification:

```txt
npm run test:unit              PASS
npm run audit:backend-contract PASS
npm run lint                   PASS
npm run build:control-plane    PASS
npm run verify                 PASS
npm run build:patient          PASS
npm run build:ops              PASS
```

Remaining Phase 2 risk:

- The documented tenant/domain update atomicity risk is closed for `admin-update-tenant`.
- Future compound admin mutations should follow this same pattern: Edge Function owns auth/RBAC/request validation; service-role RPC owns transactionality, DB invariants, and audit insert.

---

## 16. Deployment Automation Update — 2026-05-08

Completed the GitHub-to-Vercel deployment slice after the initial manual Vercel deploy:

- Confirmed the three Vercel projects were created under `aboulhassan-salehs-projects`, but were not Git-linked through Vercel's native Git integration.
- Added deployment automation to `.github/workflows/ci.yml` so pushes to `main` from `aboulhassan9/doctoleb` run the release gate, build each project from the GitHub checkout, and deploy to Vercel production.
- Added a patient/ops production bundle guard in CI that fails deployment if tenant fallback key material is present in `.vercel/output/static`.
- Normalized `package-lock.json` with npm 11.11 optional dependency metadata so GitHub's Linux `npm ci` can install Vite/Rolldown consistently under the Node 24 deployment runner.
- Added root `vercel.json` SPA fallback routing so direct app routes like `/login` resolve to the built Vite app shell on all three Vercel projects.
- Added post-deploy alias smoke checks for:
  - `https://doctoleb-patient-web.vercel.app/login`
  - `https://doctoleb-clinic-ops.vercel.app/login`
  - `https://doctoleb-control-plane.vercel.app/`
- Stored the Vercel token as the GitHub Actions secret `VERCEL_TOKEN`.
- Stored the Vercel team id as the GitHub Actions variable `VERCEL_ORG_ID`.
- Kept `.vercel/` metadata out of the repository; the workflow writes `.vercel/project.json` in the runner for each Vercel matrix project.

Verification:

```txt
git diff --check                  PASS
npx --yes yaml-lint .github/workflows/ci.yml PASS
npm run verify                    PASS
```

Operational note:

- If native Vercel Git integration is connected later through the dashboard/import flow, avoid double-deploying from both Vercel Git and GitHub Actions. Keep one production deploy owner active at a time.

---

## 17. Billing Entitlement Gate Update — 2026-05-08

Completed the `FINDING-3` risk-reduction slice:

- Added canonical entitlement code `insurance_billing`.
- Registered `insurance_billing` in the SaaS console feature catalog and `admin-sync-entitlements` tenant feature-flag projection.
- Added control-plane migration `00010000000010_control_plane_insurance_billing_entitlement.sql`; all plans default this feature to disabled until the real insurance claims workflow is approved.
- Added shared billing entitlement helpers in `packages/core/lib/billingEntitlements.js`.
- Added `useEntitlements` in `packages/core/hooks/features/useEntitlements.js` so app UI reads tenant `feature_flags` through the existing service boundary.
- Updated `paymentService.create` to enforce payment-method entitlements before inserting payments.
- Updated `CreateBillPage` to hide insurance payments unless entitled and removed the fake coverage/copay calculation path.

Verification added:

```txt
tests/unit/billingEntitlements.test.mjs
tests/unit/entitlements.test.mjs
tests/unit/saasFoundationContracts.test.mjs
```

Operational note:

- This does not implement the real insurance claims engine. It makes the current billing page safe-by-default and reversible: disable `insurance_billing` to remove the UI path and block backend payment creation for insurance method.

---

## 18. Clinic Soft Archive Update — 2026-05-08

Completed the `FINDING-2` risk-reduction slice:

- Verified the live tenant project `gezmfmskhmjgnquoyosq` did not have `clinics.is_archived`, `clinics.archived_at`, or `clinics.archived_by`.
- Added tenant migration `20260508145542_clinic_soft_archive.sql` to store reversible archive state on `public.clinics`, index active clinic lists, and remove the browser-exposed `clinics_staff_delete` RLS policy.
- Updated `clinicService.getAll` to hide archived clinics by default while allowing explicit `includeArchived` reads for future admin recovery workflows.
- Replaced `clinicService.delete` with a compatibility alias that delegates to `clinicService.archive`; no browser service path hard-deletes clinics now.
- Added archive fields to `CLINIC_SELECT_FIELDS` so mutations return the canonical updated state needed for future undo/recovery UI.

Verification added:

```txt
tests/unit/saasFoundationContracts.test.mjs
```

Operational note:

- Archiving is intentionally soft and idempotent. Re-running archive on an already archived clinic returns the existing row instead of changing the first archive timestamp. A future restore action can safely clear `is_archived`, `archived_at`, and `archived_by` with the same service/RLS pattern.

---

## 19. Resolver Safe Logging Update — 2026-05-08

Completed a small Phase 6 observability hardening slice:

- Updated public Edge Function `tenant-resolve` so RPC failures no longer log the raw request host or raw Supabase error object.
- Added `safeRpcErrorMetadata(surface, error)` to keep resolver failure logs limited to safe tags: `surface` and a bounded `errorCode`.
- Kept public API behavior unchanged: resolver failures still return `{ data: null, error: 'TENANT_RESOLVER_DOWN' }` with HTTP 503.

Verification added:

```txt
tests/unit/controlPlaneActivation.test.mjs
```

Operational note:

- This is intentionally conservative. Hostnames can identify clinics before custom-domain privacy rules are finalized, so resolver error logs should not include raw hostnames unless a future runbook explicitly approves and hashes them.

---

## 20. Auth Fail-Closed Hardening Update — 2026-05-08

Completed a small senior security-review slice for tenant app authentication:

- Removed the legacy staff identity fallback that assigned `secretary`, `predoctor`, or `admin` users to the first doctor when no active `staff_members` assignment existed.
- Staff-like clinic roles now require an explicit active `staff_members.user_id -> doctor_id` assignment before the session user is built.
- Missing or broken staff-assignment reads now return an auth error instead of silently granting an unrelated clinic scope.
- `authService.signIn` and session-backed sign-up cleanup now sign out when app identity construction fails after Supabase Auth has already issued a session.
- Tightened the `SIGNED_IN` auth-state listener so a failed linked-profile load signs out, clears local user state, and fails closed instead of leaving the Supabase session alive.
- Normalized `authIdentity.js` to an explicit `.js` import so the auth identity module can be executed directly by Node unit tests.

Verification added:

```txt
tests/unit/authIdentity.test.mjs
tests/unit/authSecurityContracts.test.mjs
```

Operational note:

- This is an intentional security behavior change. A clinic staff account without an active assignment should be repaired through staff provisioning/invitation, not allowed into the app with guessed doctor scope.

---

## 21. Deployment Workflow Quality-Gate Update — 2026-05-08

Completed a CI/CD workflow consolidation slice:

- Renamed the workflow to `DoctoLeb CI/CD` while preserving the existing `verify` job id and `Lint, Build, Audit` check name to avoid surprising branch-protection rules.
- Expanded the verification job into explicit quality-gate steps: lint, unified build, unit tests, backend contract audit, backend DB contract checks, high-severity dependency audit, and all three app-specific builds.
- Kept production deployment in the same GitHub Actions workflow, gated by `needs: verify` and limited to pushes on `main`.
- Added workflow-level concurrency so newer pushes cancel older in-flight runs on the same ref; this prevents an older production deployment from finishing after a newer one.
- Centralized `NODE_VERSION` and `VERCEL_CLI_VERSION` as workflow env values and switched Vercel CLI calls to `npx --yes` for non-interactive CI behavior.
- Split Vercel alias smoke checks into a matrix so patient, ops, and control-plane production checks are visible independently in GitHub Actions.

Verification:

```txt
npx --yes yaml-lint .github/workflows/ci.yml PASS
```

Operational note:

- PRs run the full quality gate but do not deploy. Pushes to `main` run the same quality gate, deploy all three Vercel projects, then smoke the three Vercel free-domain aliases. This remains domain-ready without requiring purchased `doctoleb.com` yet.

---

## 22. Vercel Git Connection Update — 2026-05-08

Connected the three Vercel projects to the GitHub repository `aboulhassan9/doctoleb`:

- `doctoleb-patient-web` -> GitHub repo `aboulhassan9/doctoleb`, production branch `main`.
- `doctoleb-clinic-ops` -> GitHub repo `aboulhassan9/doctoleb`, production branch `main`.
- `doctoleb-control-plane` -> GitHub repo `aboulhassan9/doctoleb`, production branch `main`.

Kept GitHub Actions as the deployment owner:

- Added `git.deploymentEnabled: false` to root `vercel.json` so native Vercel Git auto-deployments do not bypass the GitHub quality gate.
- Kept the Git connection for project/repo visibility, deployment metadata, and future dashboard workflows.
- Added `.vercel` and `.env*.local` to `.gitignore` because the Vercel CLI writes local project metadata and downloaded env files during linking.
- Kept `vercel deploy --prebuilt --prod` non-interactive with the Vercel CLI `--yes` flag. `npx --yes` only confirms package execution; the deploy command itself must also skip prompts in CI.

Verification:

```txt
Vercel API project reads confirm all three projects link to GitHub repo doctoleb, repoId 1225596513, org aboulhassan9, productionBranch main.
tests/unit/saasFoundationContracts.test.mjs asserts Vercel Git auto-deploys stay disabled in vercel.json.
```

Operational note:

- Do not enable Vercel native Git auto-deployments while `.github/workflows/ci.yml` is the release owner. If native Vercel deploys are enabled later, remove or pause the GitHub Actions deploy job first to avoid duplicate production deploys.
