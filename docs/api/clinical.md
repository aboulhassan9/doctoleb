# `clinicalService` — encounters, notes, diagnoses, prescriptions, orders, documents

**File:** `packages/core/services/clinical.js`
**Schemas:** `packages/core/schemas/clinical.js`

This is the biggest service in the codebase. The encounter is the
container; every other clinical artifact (notes, diagnoses, prescriptions,
lab orders, imaging orders, care tasks, clinical documents) hangs off the
encounter.

## Method index

| Method | Domain |
|---|---|
| `createEncounter`, `updateEncounter`, `getEncounter`, `listEncountersForPatient` | Encounters |
| `saveClinicalNoteDraft`, `getActiveClinicalNoteDraft`, `discardClinicalNoteDraft`, `commitClinicalNote` | Clinical notes (with autosaving draft model) |
| `addDiagnosis`, `removeDiagnosis` | Diagnoses |
| `addPrescription`, `updatePrescription` | Prescriptions |
| `addLabOrder`, `addImagingOrder`, `updateOrderStatus` | Orders (lab + imaging) |
| `createClinicalDocument`, `updateClinicalDocument`, `listClinicalDocuments` | Clinical documents |
| `createCareTask`, `updateCareTask` | Care tasks |
| `subscribeToEncounter` | Realtime |

## Encounter lifecycle

Encounters have a strict state machine enforced in DB:

```
planned → in_progress → completed
                  ↘ entered_in_error
                  ↘ cancelled
```

Use `assertTransition()` from `lib/stateMachines.js` before any UI
optimistic update. The DB check constraint will reject illegal moves, but
catching them client-side prevents a round-trip.

## Note draft model (autosave-safe)

Clinical notes have a separate **draft** lifecycle to avoid persisting
unfinished PHI to the main `clinical_notes` table:

1. `saveClinicalNoteDraft(encounterId, content)` writes to
   `clinical_note_drafts` via the `save_clinical_note_draft` RPC. RLS
   restricts read/write to the encounter's doctor.
2. `getActiveClinicalNoteDraft(encounterId)` fetches the latest draft.
3. `commitClinicalNote(encounterId)` promotes the draft into
   `clinical_notes` and **discards** the draft.
4. `discardClinicalNoteDraft(encounterId)` deletes the draft without
   committing.

Drafts have a TTL (see `20260509025000_schedule_clinical_note_draft_ttl.sql`)
so they don't pile up if a doctor closes their tab.

## Completion contract

`completeEncounter(encounterId)` requires:

- All clinical documents in `draft` status are either `final`, `superseded`,
  or `void`. The DB enforces this via the
  `20260507103747_tier2_encounter_completion_contract.sql` migration.
- Either at least one clinical note is committed OR the encounter has a
  `summary` field set.
- Diagnoses for prescriptions: every prescription must reference a
  diagnosis recorded on the same encounter. This prevents "phantom
  prescriptions" without a clinical justification.

If any precondition fails, the RPC returns a typed error string the UI
surfaces directly.

## Conventions specific to this service

- **Realtime via `subscribeToEncounter`.** Doctor encounter pages stream
  changes (new orders coming back resulted, etc.) without polling.
- **Symptoms live on `precheck_forms`, NOT on encounter rows.** Common
  confusion that caused a ghost-column bug in the old consultation model
  — this is also called out in `CLAUDE.md`.
- **Soft delete only.** Archive a clinical artifact, never hard-delete. The
  `tier2_admin_delete` policies for these tables were intentionally
  revoked in `20260509010000_revoke_browser_hard_delete_policies.sql`.

## Hooks

This service backs the encounter hooks in `packages/core/hooks/features/`:

- `useEncounter` — full encounter state + status transitions
- `useEncounterDraft` — local autosave for the active clinical note
- `useEncounterNotes`, `useEncounterDiagnoses`,
  `useEncounterPrescriptions`, `useEncounterOrders`,
  `useEncounterDocuments`, `useEncounterCareTasks` — domain sub-collections
- `useDoctorEncounterTimeline` — chronological view across encounters

UI components should consume the hooks, not call this service directly.

## Related migrations

- `20260507103747_tier2_encounter_completion_contract.sql` — completion
  preconditions.
- `20260509024000_clinical_note_drafts.sql` — draft table + RPCs.
- `20260509025000_schedule_clinical_note_draft_ttl.sql` — TTL job.
- `20260509010000_revoke_browser_hard_delete_policies.sql` — hard-delete
  ban.
