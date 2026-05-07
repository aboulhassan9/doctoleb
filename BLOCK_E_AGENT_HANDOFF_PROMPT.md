# DoctoLeb Block E Agent Handoff Prompt

> Purpose: paste this into the next senior agent session.
> Date: 2026-05-07.
> Current state: backend/Tier 2.5 foundation is in place, legacy compatibility burn-down is complete in repo/live DB, Block D static cleanup is verified, and browser runtime testing is still gated on a known doctor login.

---

## Your Role

Act as a senior React systems engineer + backend/API contract reviewer + Supabase/RLS-aware product engineer.

Your job is **not** to build random UI. Your job is to continue the hardening path without reintroducing duplicate concepts, old tables, page-level business logic, or legacy service drift.

Work in small slices. After each slice, run verification.

---

## Mandatory Context To Read First

Read these before editing:

- `CLAUDE.md`
- `BACKEND_CONTRACT_LEDGER.md`
- `BACKEND_DUPLICATION_AUDIT.md`
- `LEGACY_REMOVAL_COMPLETED.md`
- `BLOCK_C_PLAN.md`
- `BLOCK_D_PLAN.md`
- `BLOCK_D_AGENT_HANDOFF_PROMPT.md`
- `TIER2_PRODUCT_ARCHITECTURE_PLAN.md`
- `TIER2_5_HARDENING_PLAN.md`
- `TIER3_PLAN.md`

If docs disagree, prefer this priority:

1. Live Supabase schema / latest migrations.
2. `BACKEND_CONTRACT_LEDGER.md`.
3. `BACKEND_DUPLICATION_AUDIT.md`.
4. `CLAUDE.md`.
5. Older tier docs as historical context only.

---

## Non-Negotiable Rules

- Do not recreate or reference removed legacy tables/services: `consultations`, `notifications`, `doctor_brand`, `clinic_settings`, `medical_reports`, `certificates`, `referrals`.
- Do not use page-level `supabase.from(...)`, `supabase.rpc(...)`, `supabase.auth`, or `supabase.storage` calls.
- Appointment creation must stay slot-backed through the `book_slot` RPC via services.
- Encounter and clinical-document lifecycle changes must go through RPC-backed service methods.
- Referrals/certificates/reports/lab requests are now `clinical_documents` document types, not separate workflow tables.
- Notification inbox state lives in `notification_deliveries`; notification source events live in `notification_events`.
- Tenant/branding config lives in `tenant_profile` + `tenant_app_config`.
- Services own DB selectors, normalizers, RPC calls, and DB-to-UI shape.
- List service methods return `{ data, meta, error }`; single reads/writes return `{ data, error }`.
- Every write validates with Zod before touching Supabase.
- Keep one Supabase project/database per doctor tenant; no `tenant_id` inside tenant DB.
- There is no production data yet, so dead/duplicate code can be removed after consumers are migrated. Do not keep dead code “just in case.”

---

## What Already Happened

### Backend / DB Foundation

- Supabase live project: `gezmfmskhmjgnquoyosq` (`clinic-website`).
- Tier 1 doctor-branded practice schema was added.
- Tier 2 product core schema was added for:
  - encounters,
  - clinical notes,
  - diagnoses,
  - prescriptions,
  - lab/imaging orders,
  - clinical documents,
  - care tasks,
  - messaging,
  - notification events/deliveries/devices,
  - tenant/mobile config,
  - consents/content/feature flags.
- Tier 2.5 hardening added lifecycle RPCs, idempotency, tighter RLS/security, and backend contract tests.
- Legacy burn-down migration removed duplicate legacy surfaces:
  - `consultations`,
  - `notifications`,
  - `doctor_brand`,
  - `clinic_settings`,
  - `medical_reports`,
  - `certificates`,
  - `referrals`.

### Frontend / Service Foundation

- Old role sidebars were removed and replaced by canonical `AppSidebar` / layout direction.
- Old doctor consultation page/route was removed.
- Legacy document/notification/brand services were removed.
- Canonical services now include:
  - `clinicalService`,
  - `documentService`,
  - `notificationCoreService`,
  - `tenantConfigService`,
  - `intakeService`,
  - `insuranceService`,
  - `scheduleService`,
  - `staffService`.
- `DoctorEncounterPage` exists and uses encounter tabs/components/hooks.
- `PreDoctorCheckPage` now marks appointments `pre_check` after precheck submission.
- `DoctorAppointmentsPage` opens `/doctor-encounter/:appointmentId`.
- `appointmentService.markPreChecked()` exists.
- `useEncounterDocuments()` exists and is exported.
- Encounter tab hooks now load current encounter scope before patient-wide fallback.

### Block D Static Cleanup

- Remaining relative imports in source were standardized to the `@/` alias.
- `src/lib/stateMachines.js` no longer exports stale consultation/referral state machines.
- `supabase/functions/_shared/status.ts` no longer exports stale consultation/referral states.
- `CLAUDE.md`, `BACKEND_CONTRACT_LEDGER.md`, `BLOCK_D_PLAN.md`, and `TIER3_PLAN.md` were updated to reflect the current canonical architecture.

---

## Latest Verification

Latest known full verification passed on 2026-05-06:

```bash
npm run verify
```

That includes:

- `npm run lint`
- `npm run build`
- `npm run audit:backend-contract`
- `npm run test:backend-db-contract`
- `npm run audit:high`

Known notes from the latest verify:

- Backend contract audit passed.
- Only tracked warnings were repeated function names across migration history, expected for `create or replace` migration evolution.
- DB contract tests skipped external branch DB checks because `BACKEND_TEST_DATABASE_URL` and Supabase test env vars were not set.
- `npm audit --audit-level=high` found 0 vulnerabilities.

Run these scans before claiming a slice is complete:

```bash
npm run verify
rg -n "\\.\\./" src/pages src/components src/hooks src/services src/contexts src/lib
rg -n "supabase\\.(from|rpc|auth|storage)" src/pages
rg -n "consultationService|notificationService|reportService|certificateService|referralService|brandService" src
rg -n "CONSULTATION_STATUSES|REFERRAL_STATUSES|STATE_MACHINES\\.consultation|STATE_MACHINES\\.referral" src supabase/functions
```

Expected:

- `npm run verify` exits 0.
- No source relative imports in the scanned folders.
- No page-level raw Supabase calls.
- No executable references to removed legacy services/state machines.

---

## Current Runtime Blocker

Browser-level encounter testing is still not complete because the previous session did not have a known doctor password.

Known live Auth/domain users exist:

- `doctor@doctoleb.com`
- `secretary@doctoleb.com`
- `predoctor@doctoleb.com`

Do **not** reset passwords silently. If the user explicitly approves a development credential reset, do it intentionally and document that it was a dev-only auth reset. Do not commit passwords or secrets.

---

## Runtime Test Route From Synthetic Backend Validation

A previous backend lifecycle validation created a synthetic slot-backed appointment and started an encounter:

```txt
/doctor-encounter/dcbe4a02-4ce6-4717-b75c-34c0bd54120d
```

The backend validation confirmed:

- `book_slot` created a slot-backed appointment.
- `start_encounter` started the encounter.
- Appointment moved to `in_consultation`.
- Encounter moved to `in_progress`.

Use this route only as a dev/runtime verification aid. Do not expose patient details in public summaries.

---

## Next Work Order

### Step 1 — Browser Runtime Verification

Once a known doctor login exists, use the in-app browser or Playwright.

Verify:

- Doctor login works.
- `/doctor-appointments` loads.
- Synthetic appointment appears, if still present and visible.
- Start Encounter opens `/doctor-encounter/:appointmentId`.
- Patient tab renders patient, clinic, visit type, and previous visits.
- Notes tab saves and reloads.
- Diagnoses tab saves and reloads.
- Prescriptions tab saves and reloads.
- Orders tab creates lab and imaging orders.
- Tasks tab creates and completes a care task.
- Documents tab creates and finalizes a document.
- Complete Encounter moves encounter to `completed` and appointment to `completed`.

If browser testing finds data-shape bugs, fix only selectors/services/hooks. Do not redesign the UI in this step.

Likely files:

- `src/lib/selects.js`
- `src/services/clinical.js`
- `src/services/documents.js`
- `src/hooks/features/useEncounter*.js`
- `src/components/encounter/*.jsx`
- `src/pages/DoctorEncounterPage.jsx`

### Step 2 — Tier 3 Phase 3: Hook Adoption

If browser runtime is still blocked by login, continue with safe static/frontend hardening from `TIER3_PLAN.md`.

Start with one vertical page/hook slice at a time.

Recommended first target:

- `PatientsPage.jsx` or `BillingPage.jsx`, because hooks already exist (`usePatients`, `useBilling`) and the risk is lower than `AppointmentsPage.jsx`.

Rules:

- Do not rewrite the whole page.
- Extract one repeated data-loading concern into an existing or new feature hook.
- Keep page behavior unchanged.
- Run `npm run verify`.
- Then proceed to the next page.

Do not create these stale hooks from the old plan:

- `useConsultation`
- legacy `useReports` backed by `medical_reports`

Use current canonical names instead:

- `useEncounter`
- `useDoctorEncounterTimeline`
- `useEncounterDocuments`
- `useCertificates` and `useReferrals` may remain as UI-label adapters over `documentService` until the UI names are redesigned.

### Step 3 — Shared UI/State Cleanup

After each hook-adoption slice:

- Replace repeated loading markup with a shared loading/error/empty-state component only when the pattern appears in 2+ places.
- Move repeated input/button class strings into `src/lib/styles.js`.
- Keep abstractions small. If a pattern appears only once, keep it local.

### Step 4 — Route Code Splitting

Only after hook adoption is stable:

- Convert route imports in `src/App.jsx` to `React.lazy()`.
- Add `Suspense` fallback.
- Verify build chunks.
- Keep `npm run verify` green.

---

## Worktree Warning

The worktree is intentionally very dirty from multiple agents and large architectural migrations. Do not revert unrelated changes.

Many modified/deleted/untracked files are part of the current implementation:

- new docs,
- new scripts,
- new services,
- new migrations,
- removed legacy services/pages/functions,
- generated `dist` artifacts.

Before editing:

```bash
git status --short
```

When changing files, touch only the current slice. Do not run destructive git commands.

---

## Supabase Operational Cleanup Still Needed

Repo source for legacy Edge Functions is removed, and backing tables are gone. The live Supabase dashboard may still show deployed legacy functions:

- `consultations`
- `referrals`

Deleting those deployed functions previously required project-owner privileges. If the user has owner access, delete them from the Supabase dashboard or CLI. Do not rebuild them.

---

## What Not To Do Next

- Do not start mobile app work yet.
- Do not build messaging UI yet.
- Do not build push delivery worker yet.
- Do not build tenant settings UI yet.
- Do not add new database tables unless a backend contract audit proves the concept is missing.
- Do not reintroduce legacy compatibility systems because an old page name says “referrals” or “certificates.” Those are document types now.

---

## Definition Of Done For The Next Slice

A slice is done only when:

- The change is narrow and understandable.
- No removed legacy surface is referenced in executable code.
- No page-level raw Supabase calls are introduced.
- Services still use `apiCall()` / `apiPaged()`.
- Write paths still validate through Zod.
- `npm run verify` passes.
- The handoff docs are updated if the next agent would otherwise misunderstand the new state.
