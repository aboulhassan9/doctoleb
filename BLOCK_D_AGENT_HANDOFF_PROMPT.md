# DoctoLeb Block D Agent Handoff Prompt

> Purpose: paste this into the next senior agent session after Block C.
> Current status: Block C implemented, `npm run verify` green.
> Next recommended work: browser-level encounter runtime verification, then Tier 3 frontend hardening in small slices.

---

## Mandatory Context

Read these before editing:

- `BACKEND_CONTRACT_LEDGER.md`
- `BACKEND_DUPLICATION_AUDIT.md`
- `LEGACY_REMOVAL_COMPLETED.md`
- `BLOCK_C_PLAN.md`
- `TIER2_PRODUCT_ARCHITECTURE_PLAN.md`
- `TIER2_5_HARDENING_PLAN.md`
- `TIER3_PLAN.md`

Rules that still matter:

- Do not rebuild or reference removed legacy tables/services: `consultations`, `notifications`, `doctor_brand`, `clinic_settings`, `medical_reports`, `certificates`, `referrals`.
- Pages must not import or call raw Supabase clients.
- Appointment creation remains slot-backed through `book_slot`.
- Encounter/document lifecycle changes go through RPC-backed service methods.
- Keep one Supabase project/database per doctor tenant; no `tenant_id` inside tenant DB.

---

## What Block C Completed

Doctor encounter reachability and predoctor handoff are now wired:

- `DoctorAppointmentsPage` opens `/doctor-encounter/:appointmentId`.
- `DoctorDashboardPage` already has a Start Encounter action.
- Encounter tabs now load current-encounter diagnoses, prescriptions, orders, care tasks, and documents.
- `useEncounterDocuments()` was added and exported.
- `EncounterDocumentsTab` is UI-only and uses hook-provided actions.
- `EncounterPatientContext` shows compact previous visits.
- `StatusBadge` covers Tier 2 lifecycle statuses.
- `appointmentService.markPreChecked()` safely handles `scheduled -> confirmed -> pre_check`.
- `PreDoctorAppointmentsPage` passes patient and appointment state into `PreDoctorCheckPage`.
- `PreDoctorCheckPage` marks the appointment `pre_check` after submission and notifies the doctor with appointment context.

Verification already run:

- `npm run verify` passed.
- Backend lifecycle validation passed with synthetic dev data:
  - `book_slot` created a slot-backed appointment.
  - `start_encounter` started the encounter.
  - Appointment became `in_consultation`.
  - Encounter became `in_progress`.

Synthetic test route created during validation:

```txt
/doctor-encounter/dcbe4a02-4ce6-4717-b75c-34c0bd54120d
```

---

## Remaining Block C Runtime Gap

Browser-level verification is still not completed because this session did not have a known doctor password.

There are real Auth rows for:

- `doctor@doctoleb.com`
- `secretary@doctoleb.com`
- `predoctor@doctoleb.com`

Do not reset their passwords silently unless the user explicitly approves a dev-only credential reset. If approved, record the reset in a local/private note, not in committed code.

---

## Next Work Order

### Step 1: Browser Runtime Verification

Use the in-app browser or Playwright after a doctor login is available.

Verify:

- Doctor login works.
- `/doctor-appointments` shows the synthetic appointment.
- Start Encounter opens `/doctor-encounter/:appointmentId`.
- Patient tab renders patient, clinic, visit type, and previous visits.
- Notes tab saves and reloads.
- Diagnoses tab saves and reloads.
- Prescriptions tab saves and reloads.
- Orders tab creates lab and imaging orders.
- Tasks tab creates and completes a care task.
- Documents tab creates and finalizes a document.
- Complete Encounter moves the encounter to `completed` and appointment to `completed`.

### Step 2: Fix Runtime Shape Bugs Only

If browser testing finds join/shape issues, fix selectors/services/hooks. Do not redesign UI yet.

Likely files:

- `src/lib/selects.js`
- `src/services/clinical.js`
- `src/hooks/features/useEncounter*.js`
- `src/components/encounter/*.jsx`
- `src/pages/DoctorEncounterPage.jsx`

### Step 3: Tier 3 Frontend Hardening

After runtime verification, proceed through `TIER3_PLAN.md` in small slices:

- Layout consolidation.
- Import standardization.
- Hook adoption for large pages with inline fetch logic.
- Shared style constants.
- Final grep/audit checks.

Do not start storage signed URLs, messaging UI, push delivery, consent onboarding, or tenant settings until the encounter runtime path is proven.

---

## Required Verification

Run before claiming completion:

```bash
npm run verify
rg -n "supabase\\.from" src/pages
rg -n "doctor-consultation|Start Consultation|consultationService|notificationService|reportService|certificateService|referralService|brandService" src
```

Expected:

- `npm run verify` exits 0.
- No page-level raw Supabase table calls.
- No executable code points back to removed legacy services.

---

## Known Operational Cleanup

Live Supabase still needs project-owner deletion of deployed legacy Edge Functions if they appear in the dashboard:

```bash
supabase functions delete consultations --project-ref gezmfmskhmjgnquoyosq --yes
supabase functions delete referrals --project-ref gezmfmskhmjgnquoyosq --yes
```

The repo source and backing tables are already removed.
