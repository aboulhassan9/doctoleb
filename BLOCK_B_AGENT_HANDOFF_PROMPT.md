# DoctoLeb Block B → Block C Agent Handoff Prompt

> **Purpose**: Paste this prompt into the next senior agent session after Block B (Doctor Encounter MVP) is done.
> **Required role**: Senior full-stack/product engineer with Supabase/Postgres RLS, React component architecture, healthcare workflow judgment, and clinical UX experience.
> **Current milestone**: Tier 2.5 verified. Block B implemented and compiling. Next work is Block C: encounter integration testing, doctor appointment flow wiring, and Tier 3 frontend hardening.

---

## MANDATORY: Read Before You Write A Single Line

**You MUST read and understand the following files before making any changes.**
Do not skim — read every word. Each file contains decisions and constraints that will prevent you from making costly architectural mistakes.

### Architecture & Planning Documents

| File | Purpose | Read Priority |
|---|---|---|
| `TIER1_DOCTOR_PIVOT_PLAN.md` | Doctor-branded SaaS product direction | 🔴 Must |
| `TIER1_SCHEMA_DESIGN.md` | Complete database schema and relationships | 🔴 Must |
| `TIER2_PRODUCT_ARCHITECTURE_PLAN.md` | Product core foundation architecture | 🔴 Must |
| `TIER2_5_HARDENING_PLAN.md` | Lifecycle RPCs, idempotency, RLS hardening design | 🔴 Must |
| `TIER2_5_AGENT_HANDOFF_PROMPT.md` | Previous handoff (your predecessor prompt) | 🔴 Must |
| `TIER3_PLAN.md` | Frontend production hardening roadmap | 🟡 Read before refactoring |

### Live Migration SQL

| File | Purpose |
|---|---|
| `supabase/migrations/20260506150820_tier2_product_core_foundation.sql` | Tier 2 schema: 26 clinical/messaging/notification/tenant tables |
| `supabase/migrations/20260506155237_tier2_5_lifecycle_idempotency_hardening.sql` | Lifecycle RPCs, triggers, idempotency indexes, redaction enforcement |
| `supabase/migrations/20260506155321_revoke_set_updated_at_execute.sql` | Grant lockdown |

### Service Layer (API Contracts)

| File | What It Provides |
|---|---|
| `src/services/api.js` | `apiCall()` and `apiPaged()` envelope utilities |
| `src/services/clinical.js` | Encounter lifecycle RPCs, notes, diagnoses, prescriptions, orders, tasks, documents |
| `src/services/messaging.js` | Conversations, messages, redaction-aware messaging |
| `src/services/notificationCore.js` | Notification events and deliveries |
| `src/services/tenantConfig.js` | Tenant profile, app config, feature flags, content, consent |

### Frontend Infrastructure

| File | What It Provides |
|---|---|
| `src/schemas/index.js` | Zod validation schemas for all entities |
| `src/lib/selects.js` | Canonical field selection constants |
| `src/lib/stateMachines.js` | State machine definitions for encounters, documents, orders, prescriptions, care tasks |
| `src/lib/styles.js` | Shared CSS class constants (INPUT_CLASS, BUTTON_PRIMARY, CARD_CLASS, etc.) |
| `src/hooks/index.js` | Barrel export of all 12+ feature hooks |

---

## MANDATORY: Create A Plan Before You Build

**DO NOT start coding immediately.** The previous agents (including the one writing this prompt) made implementation choices that a fresh review might improve. You must:

1. **Create `BLOCK_C_PLAN.md`** in the project root before writing any component or service code.
2. The plan must include:
   - What you reviewed and what you found (good and bad).
   - Specific files you will create, modify, or delete.
   - Exact routes, hooks, and components affected.
   - What tests or verifications you will run.
   - Any architectural questions or risks you identified.
3. **Wait for user approval** on the plan before implementing.
4. If the plan changes mid-implementation, **update the plan file first**, then continue.

This is not optional. Unplanned work creates debt that the next agent has to clean up.

---

## What Is Live And Verified

### Supabase Project

- **Project ref**: `gezmfmskhmjgnquoyosq`
- **Project name**: `clinic-website`

### Live Migrations (3 applied, all verified)

| Migration | Status |
|---|---|
| `20260506150820_tier2_product_core_foundation` | ✅ Live |
| `20260506155237_tier2_5_lifecycle_idempotency_hardening` | ✅ Live |
| `20260506155321_revoke_set_updated_at_execute` | ✅ Live |

### Tier 2.5 Verification Results (Last checked: 2026-05-06)

| Check | Result |
|---|---|
| 14 hardening columns exist | ✅ |
| 6 lifecycle/redaction functions exist with SECURITY DEFINER + search_path | ✅ |
| 24 admin delete policies exist | ✅ |
| 5 idempotency indexes exist | ✅ |
| `anon` cannot execute lifecycle RPCs | ✅ |
| `set_updated_at()` locked from direct execution | ✅ |
| No raw `supabase.from()` in pages | ✅ |
| No direct status updates on clinical tables in pages | ✅ |
| `npm run lint` | ✅ Exit 0 |
| `npm run build` | ✅ Exit 0 |

> ⚠️ **Run these checks again before building on top of this.** Schema drift or service-layer regressions can happen between sessions.

---

## What Block B Built

Block B implemented the **Doctor Encounter MVP** — a complete clinical encounter page accessible from doctor appointments.

### New Feature Hooks (7 files)

| Hook | File | Purpose |
|---|---|---|
| `useEncounter` | `src/hooks/features/useEncounter.js` | Core: loads encounter, exposes start/complete/cancel RPC methods |
| `useDoctorEncounterTimeline` | `src/hooks/features/useDoctorEncounterTimeline.js` | Paginated encounter history for a patient |
| `useEncounterNotes` | `src/hooks/features/useEncounterNotes.js` | Clinical notes CRUD for an encounter |
| `useEncounterDiagnoses` | `src/hooks/features/useEncounterDiagnoses.js` | Diagnoses management |
| `useEncounterPrescriptions` | `src/hooks/features/useEncounterPrescriptions.js` | Prescription management |
| `useEncounterOrders` | `src/hooks/features/useEncounterOrders.js` | Lab + imaging order management |
| `useEncounterCareTasks` | `src/hooks/features/useEncounterCareTasks.js` | Care task CRUD with toggle-done |

### New Encounter Tab Components (8 files)

| Component | File | Purpose |
|---|---|---|
| `EncounterPatientContext` | `src/components/encounter/EncounterPatientContext.jsx` | Read-only patient summary, demographics, allergies, visit context |
| `EncounterNotesTab` | `src/components/encounter/EncounterNotesTab.jsx` | SOAP note type selector, color-coded note cards, add form |
| `EncounterDiagnosesTab` | `src/components/encounter/EncounterDiagnosesTab.jsx` | Diagnosis form with ICD-10 code, type, status |
| `EncounterPrescriptionsTab` | `src/components/encounter/EncounterPrescriptionsTab.jsx` | Medication form with dosage/route/frequency/duration |
| `EncounterOrdersTab` | `src/components/encounter/EncounterOrdersTab.jsx` | Lab/imaging toggle, add form, grouped list |
| `EncounterCareTasksTab` | `src/components/encounter/EncounterCareTasksTab.jsx` | Task list with toggle-done, priority badges |
| `EncounterDocumentsTab` | `src/components/encounter/EncounterDocumentsTab.jsx` | Document create/finalize with RPC lifecycle |
| Barrel export | `src/components/encounter/index.js` | Component barrel |

### New Page (1 file)

| Page | Route | Purpose |
|---|---|---|
| `DoctorEncounterPage` | `/doctor-encounter/:appointmentId` | Primary appointment-driven encounter entry |
| | `/doctor-encounter-id/:encounterId` | Direct encounter resume entry |

### Modified Files (2 files)

| File | Change |
|---|---|
| `src/App.jsx` | Added lazy import + 2 routes for DoctorEncounterPage |
| `src/hooks/index.js` | Added 7 encounter hook barrel exports |

---

## Known Issues And Gaps The Previous Agent Left Behind

**Be honest about what is NOT verified at runtime.** Block B compiled and lint-passed, but the following are known gaps:

### 1. No Runtime Testing Against Live Data

Block B's hooks call `clinicalService` methods like `getEncounterByAppointmentId`, `getEncounterById`, `getDocumentsByEncounter`, etc. These methods exist in `clinical.js`, but **their behavior against real Supabase data has not been tested in a running app**. The encounter may not load if:
- The select fields in `selects.js` don't match the actual join structure returned by Supabase.
- The RPC return value format from `start_encounter` doesn't match what `useEncounter` expects.
- The `patients` / `appointments` join keys on the encounter row don't resolve correctly.

**Your job**: Run the app, navigate to `/doctor-encounter/:appointmentId` with a real appointment ID, and verify the full lifecycle works. Fix any data-shape mismatches.

### 2. No Navigation Wiring From Appointments

The `DoctorAppointmentsPage` currently has a "Start Consultation" button that navigates to `/doctor-consultation`. **This was NOT updated to point to `/doctor-encounter/:appointmentId`.** The new encounter page exists but there's no way to reach it from the UI without typing the URL manually.

**Your job**: Wire the "Start Consultation" button (or rename to "Start Encounter") on `DoctorAppointmentsPage` to navigate to `/doctor-encounter/${appointmentId}`.

### 3. EncounterPatientContext Relies On Unverified Joins

The `EncounterPatientContext` component accesses `encounter.patients.users`, `encounter.clinics`, and `encounter.visit_types`. These assume the encounter select query joins these tables. **If `clinicalService.getEncounterById` does not include these joins in its select string, the patient context tab will render empty.**

**Your job**: Verify that `clinicalService.getEncounterById` (and `getEncounterByAppointmentId`) use a select string that includes `patients(*, users(*))`, `clinics(*)`, and `visit_types(*)`. If not, fix the select in `selects.js`.

### 4. EncounterDocumentsTab Uses Its Own Fetch

Unlike the other tabs that use hooks, `EncounterDocumentsTab` has inline state management and calls `clinicalService.getDocumentsByEncounter()` directly. This is inconsistent with the hook-first pattern. Consider extracting to a `useEncounterDocuments` hook for consistency.

### 5. `useDoctorEncounterTimeline` Is Created But Not Used

The timeline hook was built per the spec but is not consumed by any UI component in Block B. It should be wired into the patient context tab or a standalone timeline view.

### 6. StatusBadge May Not Cover All Encounter Statuses

The existing `StatusBadge` component maps statuses like `completed`, `in_progress`, `cancelled`, etc. to colors. But encounter-specific statuses like `planned` and `entered_in_error` may not have mappings and will fall back to the default gray. **Verify and add mappings if needed.**

### 7. Appointment Page Still Has Legacy Consultation Logic

`DoctorConsultationPage` is the old consultation flow. Block B's encounter page is the intended replacement. **Do not delete the consultation page yet** — but document the overlap and plan the migration.

---

## Non-Negotiable Guardrails

Follow these rules. Breaking any of them creates security or architectural debt:

1. **No custom auth.** Use `auth.users` linkage via `public.users.auth_user_id`. No plaintext passwords, no email-based identity inference.
2. **No direct status updates on clinical tables.** Encounters, documents, orders, prescriptions, care tasks — all lifecycle transitions go through RPCs or service methods that call RPCs. Never `supabase.from('encounters').update({ status: 'completed' })`.
3. **No raw Supabase queries in pages.** All data access goes through hooks → services. Pages are UI-only.
4. **Appointments are slot-backed.** No direct appointment inserts bypassing the booking flow.
5. **Zod validation at service boundaries.** Every write operation validates with the corresponding schema from `src/schemas/index.js`.
6. **Explicit select fields.** Never `select('*')` on sensitive tables. Use constants from `src/lib/selects.js`.
7. **State machines are advisory, DB is authoritative.** Use `canTransition()` for UI guards, but the DB triggers enforce the real constraints.
8. **`ON DELETE RESTRICT` for PHI/legal/financial.** Prefer archive over hard delete.
9. **No `tenant_id` inside tenant DB tables.** Each tenant has its own Supabase project. A future control-plane will manage cross-tenant concerns.
10. **No PHI in the future control plane.**
11. **Run `npm run lint` and `npm run build` before claiming done.** Both must exit 0.
12. **Preserve other agents' work.** Do not revert unrelated changes.

---

## Block C — Recommended Next Steps

Pick from these tasks in priority order. **Plan before you build.**

### Priority 1: Wire Encounter Into Appointments (Critical — Block B is unreachable without this)

- Update `DoctorAppointmentsPage` "Start Consultation" buttons to navigate to `/doctor-encounter/${appointment.id}`.
- Consider adding a "Start Encounter" action in the appointment row/card on other pages too.
- Test the full flow: appointment list → click → encounter page → start → add notes → complete.

### Priority 2: Runtime Data Shape Verification

- Run the app locally (`npm run dev`).
- Navigate to the encounter page with a real appointment.
- Verify all 7 tabs render correctly with real data.
- Fix any select field mismatches, join issues, or null-safety problems.

### Priority 3: Tier 3 Frontend Hardening (from `TIER3_PLAN.md`)

Reference `TIER3_PLAN.md` for the full task list. Key phases:

| Phase | What | Impact |
|---|---|---|
| Phase 1 | Layout consolidation — many pages still copy-paste sidebar/header | ~315 lines eliminated |
| Phase 2 | Import standardization — `../` → `@/` | Consistency |
| Phase 3 | Hook adoption — 8 large pages still have inline fetch logic | ~2000 lines eliminated |
| Phase 4 | Shared CSS classes already in `styles.js` — adopt in remaining pages | Consistency |
| Phase 6 | Final audit with automated grep checks | Quality gate |

> Phase 5 (code splitting) is already done — `App.jsx` uses `React.lazy()` for all pages.

### Priority 4: Fix Known Gaps Listed Above

Work through the 7 known issues listed in "Known Issues And Gaps" section.

---

## Known Deferred Items

**Do not accidentally treat these as done. Do not build them unless explicitly asked.**

- Storage bucket policies and signed URL strategy for clinical documents.
- Patient-facing document viewer.
- Messaging MVP UI.
- Notification delivery worker Edge Function.
- Push/email/SMS delivery integrations.
- Consent onboarding UI.
- Tenant settings/BrandContext migration from `doctor_brand` to `tenant_profile` / `tenant_app_config`.
- Feature flag audience hardening.
- Guardian/dependent model.
- Walk-in encounter model.
- Clinical note amendments.
- Prescription refill model.
- Insurance pre-authorization model.
- Control-plane SaaS project.
- RLS automated tests.
- Audit log viewer.

---

## Output Expected From You

### First output must be a plan document:

Create `BLOCK_C_PLAN.md` containing:
1. What you reviewed (files read, live queries run).
2. What you found (working correctly vs. issues).
3. Proposed changes with file list.
4. Verification steps.
5. Risks or open questions.

### After plan is approved, finish with:

1. Files created, modified, or deleted.
2. DB migrations applied, if any.
3. Commands run and their results (`lint`, `build`, grep checks).
4. Updated version of this handoff prompt for the next agent (if scope changed).
5. Any remaining risks or deferred items.

---

## How To Verify Your Own Work

Run these checks before claiming done:

```bash
# Lint
npm run lint

# Build
npm run build

# No raw supabase in pages
grep -r "supabase\.from" src/pages/

# No direct status updates in pages
grep -r "\.update(" src/pages/ | grep -i "status"

# No relative imports in pages
grep -r "from '\.\." src/pages/

# No inline loading state in pages (should be in hooks)
grep -r "setLoading" src/pages/
```

All must return 0 results (except `setLoading` for local UI toggles like form visibility, which is acceptable).
