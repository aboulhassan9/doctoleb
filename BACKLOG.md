# DoctoLeb Backlog

> **Status**: active backlog for work that is known but not part of the current slice.
> **Last updated**: 2026-05-07.
> **Source of truth for next execution order**: `NEXT_STEPS_PLAN.md`.

This file exists so deferred items do not stay scattered across tier plans, review addenda, and handoff prompts. Keep it short, update it when work closes, and do not add new features here unless they have a clear owner and dependency.

---

## Now / Next

| Item | Why it matters | Dependency | Status |
|---|---|---|---|
| Branch/local SQL audit + pgTAP execution | Turns the RLS scaffold into real proof against a disposable DB | `BACKEND_TEST_DATABASE_URL` for branch/local Postgres | Pending |
| Full fresh migration replay proof | Proves the migration directory can create a new doctor tenant from zero | Local Docker/Postgres or Supabase branch | Pending |
| ERD export | Gives humans/agents a visual schema truth for the doctor-branded tenant model | Fresh replay or branch schema dump | Pending |
| Index/perf Block A + C | Adds only the high-value indexes from `TIER2_INDEX_AND_PERF_PLAN.md` | Applied in `20260507102119_tier2_index_block_a_c.sql` | Done |
| Slice 1 doctor encounter MVP | Main doctor workflow after backend foundation | Backend proof preferred, not strictly blocked | Ready |

---

## Security / Operations

| Item | Decision | Notes |
|---|---|---|
| Purge orchestration | Build an admin/service-role runbook or Edge Function later | Admin DELETE policies exist; operational orchestration does not |
| Document-type role matrix | Defer until multi-staff prescribing/finalization is real | Current `clinical_documents` foundation is enough for V1 |
| Disaster recovery runbook | Add PITR/restore drill before real patient data | Healthcare data needs tested recovery, not just backups |
| CI RLS gate | Add branch/local DB test job after a disposable DB URL exists | `npm run verify` already runs contract checks and live anon RPC diagnostics |

---

## Product Slices

| Slice | Scope | Status |
|---|---|---|
| Slice 1 | Doctor encounter MVP: start/resume/complete encounter, notes, diagnoses, prescriptions, orders, documents, care tasks | In progress — lifecycle contract guards landed |
| Slice 2 | Patient documents + lab/imaging viewer with signed URLs | Ready after branch/local Storage RLS proof |
| Slice 3 | Patient-staff messaging MVP with realtime, read receipts, redact-only behavior | Ready after Slice 1/2 priority decision |
| Slice 4 | Consent onboarding after registration and on consent version changes | Deferred |
| Slice 5 | Notification send worker for push/email/SMS fan-out from `notification_events` | Deferred |
| Slice 6 | Tenant config admin UI + `BrandContext` over `tenant_profile` / `tenant_app_config` | Deferred |
| Slice 7 | RLS automated tests + audit-log viewer | Partially scaffolded |

---

## Deferred Domain Extensions

| Item | Why deferred |
|---|---|
| Walk-in encounter path | Common workflow, but not required for first doctor appointment MVP |
| Clinical note amendments | Needed for stronger medico-legal correction workflow after finalized notes |
| Prescription refills | Product needs refill rules before modeling events |
| Insurance pre-authorization | Separate workflow from claims; defer until insurer process is validated |
| Guardian/dependent model | Important for child/family accounts; large RLS change, should be its own tier |
| SaaS control plane | No PHI; start only after tenant app is stable and second tenant is real |

---

## Closed But Worth Remembering

| Item | Closed state |
|---|---|
| Legacy tables/services | Removed: `consultations`, `notifications`, `doctor_brand`, `clinic_settings`, `medical_reports`, `certificates`, `referrals` |
| Retired deployed Edge Functions | Deleted from live Supabase: `auth`, `appointments`, `patients`, `process-payment`, `consultations`, `referrals` |
| Private file buckets | `clinical-documents` and `message-attachments` exist and are private |
| Encounter completion contract | `complete_encounter` blocks draft documents and empty encounters; prescriptions require an encounter diagnosis |
| Encounter note draft | `useEncounterDraft` persists unsaved note text locally per encounter every 30 seconds |
| Live anon RPC exposure diagnostics | Active through `.env.test.local` + `.env.local`; SQL audit/pgTAP still need `BACKEND_TEST_DATABASE_URL` |
