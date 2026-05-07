# DoctoLeb Block C Plan — Encounter Wiring And Runtime Verification

> Status: implemented; static verification passed, backend lifecycle validation passed.
> Created: 2026-05-06.
> Source prompt: `BLOCK_B_AGENT_HANDOFF_PROMPT.md`.
> Goal: make the Block B Doctor Encounter MVP reachable, runtime-safe, and ready for real doctor appointment flow testing.

---

## 1. What I Reviewed

### Planning and architecture context

- `TIER1_DOCTOR_PIVOT_PLAN.md`
- `TIER1_SCHEMA_DESIGN.md`
- `TIER2_PRODUCT_ARCHITECTURE_PLAN.md`
- `TIER2_5_HARDENING_PLAN.md`
- `TIER2_5_AGENT_HANDOFF_PROMPT.md`
- `TIER3_PLAN.md`
- `BLOCK_B_AGENT_HANDOFF_PROMPT.md`

### Live Supabase verification

Live project: `gezmfmskhmjgnquoyosq` (`clinic-website`)

Verified with Supabase MCP:

- Migrations include:
  - `20260506150820_tier2_product_core_foundation`
  - `20260506155237_tier2_5_lifecycle_idempotency_hardening`
  - `20260506155321_revoke_set_updated_at_execute`
- Tier 2.5 hardening checks:
  - 14 expected hardening columns exist.
  - 7 lifecycle/redaction functions exist.
  - 24 `tier2_admin_delete` policies exist.
  - 6 idempotency/tenant uniqueness indexes exist.
  - Lifecycle RPCs are `SECURITY DEFINER`.
  - Lifecycle RPCs have `search_path=public, pg_temp`.
  - `anon` cannot execute lifecycle RPCs.
  - `set_updated_at()` cannot be executed by `anon` or `authenticated`.
- Current live test-data counts:
  - `doctors`: 1
  - `patients`: 2
  - active `secretary_slots`: 1
  - `appointments`: 0
  - `encounters`: 0

### Source files inspected

- `src/App.jsx`
- `src/pages/DoctorAppointmentsPage.jsx`
- `src/pages/DoctorEncounterPage.jsx`
- `src/services/clinical.js`
- `src/hooks/features/useEncounter.js`
- `src/hooks/features/useDoctorEncounterTimeline.js`
- `src/hooks/features/useEncounterNotes.js`
- `src/hooks/features/useEncounterDiagnoses.js`
- `src/hooks/features/useEncounterPrescriptions.js`
- `src/hooks/features/useEncounterOrders.js`
- `src/hooks/features/useEncounterCareTasks.js`
- `src/components/encounter/EncounterPatientContext.jsx`
- `src/components/encounter/EncounterDocumentsTab.jsx`
- `src/components/ui/StatusBadge.jsx`

### Commands already run

- `npm run lint` passed.
- `npm run build` passed.
- `rg "supabase\.from" src/pages` returned no raw page-level Supabase table queries.

---

## 2. What Looks Good

- `DoctorEncounterPage` exists and is route-mounted:
  - `/doctor-encounter/:appointmentId`
  - `/doctor-encounter-id/:encounterId`
- `App.jsx` lazy-loads the encounter page.
- The main encounter hooks/components exist and compile.
- `ENCOUNTER_SELECT_FIELDS` includes the important joins needed by `EncounterPatientContext`:
  - `appointments`
  - `patients`
  - `doctors`
  - `clinics`
  - `visit_types`
- Tier 2.5 lifecycle RPCs are live and callable by authenticated users only.
- The encounter page correctly intends to use RPC lifecycle methods rather than raw encounter status table updates.
- There are no raw `supabase.from(...)` calls in `src/pages`.

---

## 3. Findings To Fix Before Runtime Testing

### P1 — Doctor appointment UI still routes to the legacy consultation page

File: `src/pages/DoctorAppointmentsPage.jsx`

Findings:

- The row action still calls `navigate('/doctor-consultation')`.
- The floating action button also calls `navigate('/doctor-consultation')`.
- This makes Block B mostly unreachable from the real doctor workflow.

Fix:

- Change appointment-row action to `navigate(`/doctor-encounter/${appt.id}`)`.
- Rename visible label from `Start Consultation` to `Start Encounter`.
- Do not create an encounter without an appointment. The floating `Start New Consultation` button should be removed, disabled, or changed to a safe route that asks the doctor to select/book an appointment first.

### P1 — `useEncounter.startEncounter()` reloads with the wrong value

File: `src/hooks/features/useEncounter.js`

Finding:

- `clinicalService.startEncounter()` calls `start_encounter`, whose RPC returns the encounter row.
- The hook then calls `clinicalService.getEncounterById(data)`, treating `data` like an ID.
- That can produce a failed query or no encounter after starting.

Fix:

- Use `data.id` when reloading, or set the returned encounter and then reload via `data.id` only if needed.
- Keep the reload because the RPC return row may not include joined relations.

### P1 — Encounter documents tab calls missing service methods

File: `src/components/encounter/EncounterDocumentsTab.jsx`

Findings:

- Calls `clinicalService.getDocumentsByEncounter(encounterId)`, but `clinical.js` only exposes `getDocuments(patientId, ...)`.
- Calls `clinicalService.createClinicalDocument(...)`, but `clinical.js` exposes `createDocument(...)`.
- This tab will fail at runtime even though the build passes.

Fix:

- Prefer extracting `useEncounterDocuments(encounterId)` to match the rest of Block B.
- Add service methods:
  - `clinicalService.getDocumentsByEncounter(encounterId, options)`
  - Either use `clinicalService.createDocument(...)` from the hook/component or add a backward-compatible alias only if needed.
- Keep finalization through `clinicalService.finalizeClinicalDocument()`.

### P1 — No live appointment exists for runtime testing

Live DB currently has no appointments.

Fix:

- Create or use a test appointment through the canonical slot-backed booking flow.
- Do not directly insert into `appointments`.
- If using MCP for test setup, call the canonical booking RPC rather than inserting a row.
- Then test `/doctor-encounter/:appointmentId` against that appointment.

### P2 — Encounter tabs mix current-encounter records with patient-wide history

Files:

- `useEncounterDiagnoses.js`
- `useEncounterPrescriptions.js`
- `useEncounterOrders.js`
- `useEncounterCareTasks.js`

Finding:

- These hooks currently fetch by `patientId`, not by `encounterId`.
- That may be okay for a history sidebar, but inside the current encounter tabs it can mix old records with this visit's records.

Fix:

- For Block C, make encounter tabs show current-encounter records by default.
- Add patient-wide history through `useDoctorEncounterTimeline` or a clearly labeled history panel.

### P2 — `useDoctorEncounterTimeline` is unused

Finding:

- The timeline hook exists but is not consumed.

Fix:

- Wire it into `EncounterPatientContext` or add a compact "Previous Visits" panel on the patient tab.
- Keep this secondary to the P1 runtime blockers.

### P2 — `StatusBadge` lacks several Tier 2 lifecycle statuses

File: `src/components/ui/StatusBadge.jsx`

Missing or default-gray statuses include:

- `planned`
- `entered_in_error`
- `ordered`
- `resulted`
- `superseded`
- `void`
- `open`
- `done`

Fix:

- Add explicit visual mappings for Tier 2 statuses.
- Keep colors consistent with lifecycle meaning.

### P2 — Care task status update should be reviewed against lifecycle guardrail

Files:

- `EncounterCareTasksTab.jsx`
- `useEncounterCareTasks.js`
- `clinicalService.updateCareTask()`

Finding:

- The UI toggles care task status through `updateCareTask`.
- DB triggers enforce allowed transitions, but there is no dedicated care-task lifecycle RPC.

Fix:

- For Block C, at minimum use client state-machine validation before calling the service.
- If strict server-RPC lifecycle parity is required, add a small `transition_care_task` RPC in a later hardening migration. I recommend not adding that DB migration inside this UI wiring slice unless review says it is mandatory.

### P3 — Legacy consultation flow still overlaps with encounter flow

Files:

- `src/pages/DoctorConsultationPage.jsx`
- `src/App.jsx`

Finding:

- The old consultation page remains route-mounted.
- It still contains old appointment status logic.

Fix:

- Do not delete it in Block C.
- Document it as deprecated once encounter runtime is working.
- Later migration/slice can redirect or retire the old route.

---

## 4. Proposed Implementation Scope After Approval

### Step 1 — Fix the encounter service/hook contract

Modify:

- `src/services/clinical.js`
- `src/hooks/features/useEncounter.js`

Changes:

- Add `getDocumentsByEncounter(encounterId, options)` using explicit select fields and `apiPaged()`.
- Use existing `createDocument()` from document logic.
- Fix `startEncounter()` reload to use `data.id`.

### Step 2 — Add a document hook and simplify the documents tab

Create:

- `src/hooks/features/useEncounterDocuments.js`

Modify:

- `src/hooks/index.js`
- `src/components/encounter/EncounterDocumentsTab.jsx`

Changes:

- Move fetch/create/finalize state into the hook.
- Keep component focused on UI.
- Use `clinicalService.createDocument`.
- Use `clinicalService.finalizeClinicalDocument`.

### Step 3 — Wire doctor appointments to the encounter route

Modify:

- `src/pages/DoctorAppointmentsPage.jsx`

Changes:

- Daily row action navigates to `/doctor-encounter/${appt.id}`.
- Label becomes `Start Encounter`.
- Floating "Start New Consultation" action is removed or converted to a safe non-encounter action.
- Preserve the old `/doctor-consultation` route for now.

### Step 4 — Make encounter tabs current-visit-first

Modify:

- `src/services/clinical.js`
- `src/hooks/features/useEncounterDiagnoses.js`
- `src/hooks/features/useEncounterPrescriptions.js`
- `src/hooks/features/useEncounterOrders.js`
- `src/hooks/features/useEncounterCareTasks.js`
- `src/pages/DoctorEncounterPage.jsx`

Changes:

- Add encounter-scoped list methods where needed:
  - `getDiagnosesByEncounter`
  - `getPrescriptionsByEncounter`
  - `getOrdersByEncounter`
  - `getCareTasksByEncounter`
- Pass `encounterId` into hooks.
- Keep patient-wide history for a separate timeline/history panel.

### Step 5 — Add compact encounter history

Modify:

- `src/components/encounter/EncounterPatientContext.jsx`
- possibly `src/pages/DoctorEncounterPage.jsx`

Changes:

- Use `useDoctorEncounterTimeline(patientId)` or pass preloaded timeline data.
- Show a compact previous-visits list.
- Avoid overloading the patient context with a large history table.

### Step 6 — Expand `StatusBadge`

Modify:

- `src/components/ui/StatusBadge.jsx`

Changes:

- Add Tier 2 status mappings:
  - `planned`
  - `entered_in_error`
  - `ordered`
  - `resulted`
  - `superseded`
  - `void`
  - `open`
  - `done`

### Step 7 — Runtime verification

Actions:

- Start app with `npm run dev`.
- Create or use a real appointment through canonical booking.
- Navigate doctor appointment list → encounter page.
- Verify:
  - encounter starts,
  - patient context renders,
  - notes save and list,
  - diagnoses save and list,
  - prescriptions save and list,
  - lab/imaging orders save and list,
  - care tasks save and toggle,
  - documents create and finalize,
  - encounter completes,
  - old appointment updates to completed via RPC.

---

## 5. Files Expected To Change

Planned code changes after approval:

- `src/services/clinical.js`
- `src/hooks/features/useEncounter.js`
- `src/hooks/features/useEncounterDocuments.js` *(new)*
- `src/hooks/features/useEncounterDiagnoses.js`
- `src/hooks/features/useEncounterPrescriptions.js`
- `src/hooks/features/useEncounterOrders.js`
- `src/hooks/features/useEncounterCareTasks.js`
- `src/hooks/index.js`
- `src/components/encounter/EncounterDocumentsTab.jsx`
- `src/components/encounter/EncounterPatientContext.jsx`
- `src/components/ui/StatusBadge.jsx`
- `src/pages/DoctorAppointmentsPage.jsx`
- `src/pages/DoctorEncounterPage.jsx`

No DB migration is planned for this Block C slice unless the runtime review proves a missing server contract.

---

## 6. Verification Plan

Run before claiming implementation complete:

```bash
npm run lint
npm run build
rg -n "supabase\\.from" src/pages
rg -n "getDocumentsByEncounter|createClinicalDocument" src
rg -n "navigate\\('/doctor-consultation'\\)" src/pages/DoctorAppointmentsPage.jsx
```

Expected:

- lint exits 0.
- build exits 0.
- no page-level raw Supabase table queries.
- no stale missing-method document calls.
- doctor appointment actions no longer point to the old consultation route.

Runtime:

- Verify with a real appointment created through the canonical booking path.
- If live DB remains empty, document exactly why runtime testing could not complete.

---

## 7. Risks And Open Questions

- Live DB currently has no appointments, so runtime testing requires creating test data through the booking flow.
- The old `DoctorConsultationPage` remains in the app and overlaps conceptually with the new encounter flow.
- Care task status transitions currently rely on service + DB trigger, not a dedicated RPC.
- Patient-wide history vs current-encounter records needs clear UX wording so doctors do not confuse old prescriptions/orders with today’s visit.
- This plan intentionally avoids Tier 3 broad refactoring until the clinical encounter runtime path is proven.

---

## 8. Implementation Results

Implemented in this pass:

- Doctor appointment row action now opens the canonical encounter route and uses the "Start Encounter" label.
- Encounter tabs now load current-encounter diagnoses, prescriptions, orders, and care tasks before falling back to patient-wide reads.
- Added `useEncounterDocuments()` so the documents tab follows the same hook-first pattern as the other encounter tabs.
- Encounter documents are created through `clinicalService.createDocument()` and finalized through the lifecycle RPC.
- Care task completion now goes through `clinicalService.transitionCareTask()` instead of a raw status update.
- Patient context now shows a compact previous-visit panel using `useDoctorEncounterTimeline()`.
- `StatusBadge` now covers Tier 2 lifecycle statuses.
- Predoctor appointment rows now pass appointment context into the pre-check form.
- Pre-check submit now marks the appointment as `pre_check` through `appointmentService.markPreChecked()`, which safely handles `scheduled -> confirmed -> pre_check`.
- Predoctor doctor notifications now reference appointment/encounter language instead of the removed consultation model.

Verification completed:

- `npm run lint` passed.
- `npm run build` passed.
- `npm run verify` passed.
- `rg "supabase\\.from" src/pages` returned no page-level table queries.
- Supabase backend validation created synthetic dev data through canonical paths:
  - `book_slot` created a slot-backed appointment.
  - `start_encounter` created an active encounter.
  - The appointment transitioned to `in_consultation`.
  - The encounter transitioned to `in_progress`.

Remaining runtime note:

- Browser-level verification still requires a real doctor login session. The backend IDs now exist for manual route testing, but this session did not have a known doctor password/token to drive the protected browser UI.

---

## 9. Closed Gate

The plan is no longer pending. Block C implementation has started and this document now records what changed plus what remains for browser-level verification.
