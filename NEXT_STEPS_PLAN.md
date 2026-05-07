# DoctoLeb · Next Steps Plan

> **Date**: 2026-05-07.
> **Companion docs**: `CLAUDE.md`, `TIER2_REVIEW.md`, `TIER2_REVIEW_ADDENDUM.md`, `TIER2_INDEX_AND_PERF_PLAN.md`, `BLOCK_F_AGENT_HANDOFF_PROMPT.md`.
> **Purpose**: forward roadmap covering ERD export readiness, UX flows, business logic, and API contracts. Consumes the open items already cataloged in the review docs; does not re-litigate them.

---

## §A · What just shipped (this slice — 2026-05-07)

| Area | Action | Result |
|---|---|---|
| Burn-down audit | 4 `rg` scans (relative imports, page-level Supabase, legacy services, legacy state machines) + `npm run verify` | All clean (0 matches × 4; verify exit 0) |
| Index/perf | Wrote `TIER2_INDEX_AND_PERF_PLAN.md` (9 sections, < 500 lines, no SQL applied) | 6 net new index recs + 2 drops + audit-log partitioning trigger documented |
| Security | Updated `TIER2_REVIEW_ADDENDUM.md` reconciling P1 / P2 / P3 / H findings through Block F | Original P1/P2 findings are closed; RLS automated tests and purge orchestration remain |
| Bugfix | Added `import { motion } from 'framer-motion'` to `DoctorMedicalHistoryPage.jsx` | Page no longer crashes at runtime when motion blocks render |
| Encounter lifecycle | Hardened `complete_encounter` and prescription creation via `20260507103747_tier2_encounter_completion_contract.sql` | Completion now requires no draft documents plus either clinical notes or a summary; prescriptions require an encounter diagnosis |
| Encounter UI | Tightened `DoctorEncounterPage` and prescriptions tab | Direct encounter resume can start from loaded appointment context; completion/prescribing rules surface before DB rejection |
| Encounter notes | Added `useEncounterDraft` and wired `EncounterNotesTab` | Unsaved clinical-note drafts persist locally per encounter and autosave every 30 seconds |
| Repo hygiene | `git rm --cached -r dist/` (5 files) | Build artifacts no longer tracked; `.gitignore` already had `dist` |
| Schema replay | Added `20240625000000_baseline_core_tables.sql` before the old scheduling migration | Fresh tenants get the pre-history core tables plus temporary legacy shells needed by older migrations |
| Schema replay cleanup | Added `20240627000000_cleanup_bootstrap_scheduling_artifacts.sql` | Drops prototype RLS policies and transient `patients.created_by` immediately after the 2024 scheduling migration |
| Feature flags | Added/applied `20260507092109_feature_flags_audience.sql` and exposed `audience` in `tenantConfigService.getFeatureFlags()` | Feature flags are audience-gated (`public`, `patient`, `staff`, `admin`) instead of visible to every authenticated user |
| Storage security | Added/applied `20260507092121_storage_rls_and_private_buckets.sql` plus `storageService` signed URL helpers | Clinical and message attachments use private buckets and short-lived signed URLs, not public file URLs |
| Redaction model | Documented message redaction in `CLAUDE.md` | Current behavior is scrub: `messages.body` is overwritten with `[redacted]`, original content unrecoverable |
| RLS tests | Added `supabase/tests/pgtap_rls.sql` and wired it into `test:backend-db-contract`; runner now loads `.env.test.local` / `.env.local` / `.env` | Live anon RPC exposure diagnostics run from existing Supabase URL/key; branch/local SQL audit + pgTAP still require `BACKEND_TEST_DATABASE_URL` |
| ERD inventory | Added `docs/erd/README.md` and `docs/erd/tables.txt` | Active public table inventory is captured; full `schema_dump.sql`/`erd.png` still need branch/local DB export |
| Advisor cleanup | Added/applied `20260507090455_revoke_anon_notify_role_event.sql` | Live `notify_role_event` is no longer executable by `anon`; authenticated/service-role access remains |
| Legacy DB cleanup | Added/applied `20260507091235_drop_legacy_helpers_and_views.sql` | Dropped unused old views (`doctor_dashboard_summary`, `doctor_patients`, `upcoming_appointments`) and old helper RPCs (`get_user_full_name`, `get_next_appointment`, `get_doctor_info`) |
| Edge source burn-down | Removed local source for retired V1 Edge Functions and added `supabase/functions/README.md` | No canonical Edge Functions remain in repo; future functions must be designed as workers/proxies, not duplicate wrappers |
| Edge deploy cleanup | Deleted live retired Edge Functions: `auth`, `appointments`, `patients`, `process-payment`, `consultations`, `referrals` | Supabase CLI and MCP both now show zero deployed Edge Functions |
| Verify | `npm run verify` after cleanup | exit 0; lint + build + 2 contract audits + npm audit all green |

**No legacy tables remained to drop.** The legacy-compatibility burndown migration (`20260506190000`) had already removed `consultations`, `notifications`, `doctor_brand`, `clinic_settings`, `medical_reports`, `certificates`, `referrals`. Every code reference cross-checks against canonical surfaces only.

---

## §B · Schema-drift baseline — closed before ERD export

### What was found

Searching `supabase/migrations/**` for `create table public.<X>` finds explicit creates for 49 tables. **It does not find creates for**:

- `users`
- `doctors`
- `predoctors`
- `payments`
- `precheck_forms`

Those five tables were the visible gap, but review against the full migration chain found a deeper replay problem: the first tracked migration (`20240626_create_scheduling_tables.sql`) also creates prototype versions of `clinics`, `secretary_slots`, `appointments`, and `patients`, while later secure-v1 migrations assume the newer domain-shaped columns (`patients.user_id`, `appointments.scheduled_at`, `duration_minutes`, `reason`, `notes`). Older Tier 0 / Tier 1 migrations also still reference legacy tables before the legacy burn-down drops them: `consultations`, `medical_reports`, `certificates`, `referrals`, `notifications`, and `clinic_settings`.

**Implication**: applying `supabase/migrations/*.sql` against a fresh empty Supabase project would fail or replay unsafe prototype policies unless the baseline is inserted before the 2024 scheduling migration.

### Remediation shipped

Two migrations now close the replay gap:

- `supabase/migrations/20240625000000_baseline_core_tables.sql`
- `supabase/migrations/20240627000000_cleanup_bootstrap_scheduling_artifacts.sql`

The baseline intentionally runs before `20240626_create_scheduling_tables.sql`, so the old migration becomes a no-op for table creation while still allowing its historical RPC definitions to be replaced by later secure migrations. It includes:

- Live core domain tables: `users`, `doctors`, `patients`, `clinics`, `secretary_slots`, `appointments`, `predoctors`, `precheck_forms`, `payments`.
- Temporary legacy shells needed only for migration replay: `consultations`, `medical_reports`, `certificates`, `referrals`, `notifications`, `clinic_settings`.
- RLS enabled on every baseline table.
- Indexes required by current query paths and FK checks.

The cleanup migration immediately removes unsafe prototype policies created by `20240626_create_scheduling_tables.sql` and drops the transient `patients.created_by` column. Durable secure policies are created later by secure-v1 migrations.

Validation performed through Supabase MCP on project `gezmfmskhmjgnquoyosq`: wrapped both migrations in `BEGIN … ROLLBACK`; syntax and dependency order passed without leaving objects behind.

### Sanity check after baseline lands

```bash
# create a throwaway local Postgres db and apply migrations:
createdb doctoleb_baseline_test
supabase db push --db-url postgresql://localhost/doctoleb_baseline_test
# if it succeeds, the migration directory is a complete recipe.
```

This remains the recommended full replay proof before declaring the migration directory SaaS-onboarding ready.

---

## §C · ERD export — three procedures

Pick whichever fits the current context.

### C-1 · Supabase Studio (fastest, visual)

1. Open the project at `https://supabase.com/dashboard/project/gezmfmskhmjgnquoyosq`.
2. Database → **Schema Visualizer** (left rail).
3. Filter to `public` schema. The visualizer lays out tables and FKs.
4. Top-right → **Export as PNG/SVG**. Embed in `docs/erd/`.

Limitations: can't customize layout; large schemas overlap. Good for a "current state" snapshot.

### C-2 · `pg_dump` + dbdiagram.io (clean, customizable, shareable)

```bash
# 1. Schema-only dump
pg_dump "$DATABASE_URL" --schema-only --schema=public \
  --no-owner --no-privileges \
  > docs/erd/schema_dump.sql

# 2. Convert to DBML (a Postgres → DBML converter; e.g. dbdiagram.io paste box accepts SQL directly)
# 3. Open https://dbdiagram.io/d → Import → SQL → paste schema_dump.sql
# 4. Auto-generate ERD; export as PNG/PDF/DBML
```

Recommended for the ERD that lands in onboarding docs and the SaaS pitch deck.

### C-3 · Postgres `\d+` reflection (text-only, scriptable)

```bash
psql "$DATABASE_URL" -c "\dt public.*"          # tables
psql "$DATABASE_URL" -c "\d public.encounters"  # one table's columns + FKs + indexes
```

Useful for CI checks: regenerate the listing, diff against committed `docs/erd/tables.txt`, fail PR if drift detected. Lightweight version of the schema-drift detector mentioned in `TIER2_REVIEW.md` §9.

### C-4 · Recommended deliverable for this milestone

Three artifacts under `docs/erd/`:

- `docs/erd/schema_dump.sql` — full DDL from `pg_dump --schema-only` (pending branch/local DB export)
- `docs/erd/erd.png` — visual from dbdiagram.io (pending branch/local DB export)
- `docs/erd/tables.txt` — committed active-table inventory for CI drift checks

Ship `docs/erd/` after §B (baseline migration) lands; otherwise the schema dump and the migration directory will disagree.

---

## §D · Open work consolidated by priority

This is the working backlog for the next 4–6 weeks. Each row points back to its detailed description in the source doc.

### Block A residue — pre-UI hardening (½ week)

| # | Item | Source | Effort |
|---|---|---|---|
| A1 | `feature_flags.audience` column + audience-gated SELECT (P2-2 / H3) | Addendum §C-3 | ✅ Done |
| A2 | Storage RLS migration + signed-URL helpers in `clinicalService` and `messagingService` (H9) | Addendum §C-1 | ✅ Done |
| A3 | pgTAP RLS test suite (H7) | Review §10 Block G | ✅ Scaffolded; live anon RPC diagnostics active; branch/local SQL audit + pgTAP execution pending |
| A4 | Document message-redaction model (scrub vs compliance — B-2) | Addendum §B-2 | ✅ Done |
| A5 | Fresh-replay baseline migration for pre-history core tables and temporary legacy shells | This doc §B | ✅ Done |

### Block B — Index/perf (parallel; deploy when traffic justifies)

See `TIER2_INDEX_AND_PERF_PLAN.md` §8 for migration order. Blocks A + C are now applied in `20260507102119_tier2_index_block_a_c.sql`; the migration also dropped the two redundant clinical-note indexes while the tenant has no production rows. Defer the rest behind telemetry triggers documented in §6 of that plan.

### Block C — Slices 1 → 7 (3–4 months total)

Detailed in `TIER2_REVIEW.md` §7 and §10. Summary:

- **Slice 1 — Doctor encounter MVP** (6–8 days): the headline doctor workflow. All Tier 2.5 RPCs already shipped; build the page + hooks.
- **Slice 2 — Patient documents + lab/imaging viewer** (4–5 days): blocked on A2 (Storage RLS).
- **Slice 3 — Patient ↔ staff messaging MVP** (5–7 days): redaction trigger already in place.
- **Slice 4 — Consent onboarding** (3 days).
- **Slice 5 — Notification send worker** (Edge Function, 5–7 days): unblocks mobile push.
- **Slice 6 — Tenant config admin UI** (3–4 days): wire `BrandContext` to `tenant_app_config`.
- **Slice 7 — RLS automated tests + audit-log viewer** (1 week): see A3.

### Block D — Tier 2.5 deferred items

See `TIER2_REVIEW.md` §4 items 6–10:

- Walk-in encounter path (`encounters.appointment_id` nullable + `is_walk_in`).
- Clinical note amendments table.
- Prescription refill model.
- Insurance pre-authorization model.
- Guardian/dependent model.

None block first launch. Each is its own sub-tier when product validates the need.

### Block E — Tier 3 control plane

Per `TIER2_PRODUCT_ARCHITECTURE_PLAN.md` §15 / `TIER3_PLAN.md`. Out of scope for the next 6 weeks.

---

## §E · UX roadmap — what users do, in order

This section translates the slices into user-visible flows. Each flow is a contract with the UX team: page boundaries, primary actions, success criteria.

### E-1 · Doctor encounter (Slice 1)

```
[ Doctor opens /doctor-appointments ]
            ↓ click an appointment row
[ /doctor-encounter/:appointmentId ]
            ↓ "Start encounter"
        [ start_encounter() RPC; appointment → 'in_consultation' ]
            ↓ tab UI: Notes · Diagnoses · Prescriptions · Orders · Care tasks · Documents
            ↓ doctor types notes (auto-saved every 30s via useEncounterDraft) ✅
            ↓ "Complete encounter"
        [ confirm modal: summary + signature panel ]
            ↓ complete_encounter() RPC; appointment → 'completed'
[ Toast: "Encounter completed" → redirect to appointments list ]
```

Edge cases the UX must handle:

- Doctor leaves the page mid-encounter → encounter persists in `in_progress` until next visit.
- Network drops while saving a note → idempotency key (`client_request_id`) prevents duplicates on retry.
- Doctor tries `complete` while a draft document is open → block with a clear message.
- Wrong doctor (admin overriding) → admin DELETE RPC available; UX shows audit trail.

### E-2 · Patient document viewing (Slice 2)

```
[ Patient opens /patient-history ]
        ↓ list of clinical_documents WHERE patient_id = me AND is_archived = false
        ↓ click document
[ Document preview modal — fetched via createSignedUrl(file_url, ttl=300) ]
        ↓ "Download PDF" → fresh signed URL each time
```

Edge cases:

- Document `voided_at IS NOT NULL` → render as "Voided on …" with reason; no download.
- Document `superseded` by a later version → link to the replacement.
- Storage 404 (file missing) → "Document is being prepared, please try again" toast; log to `audit_log`.

### E-3 · Patient ↔ staff messaging (Slice 3)

```
[ /messages — list of conversations for current user (RLS-scoped) ]
        ↓ click thread
[ Thread view: messages + read receipts + composer ]
        ↓ patient sends "Q about prescription"
        ↓ idempotency token via crypto.randomUUID()
        ↓ realtime: subscribeToConversation pushes to both sides
[ Sender 5 minutes later: "Actually, redact that" ]
        ↓ messagingService.redactMessage() → trigger overwrites body to '[redacted]'
        ↓ realtime push updates both viewers
```

Edge cases:

- Patient writes profanity / PHI to wrong thread → redact-only model (current). Original lost on redact (B-2 documented).
- Staff member tries to edit message → blocked at trigger; UI surfaces a clear message.
- Patient logs out, reopens → unread counts recompute via `useUnreadCounts`.

### E-4 · Consent onboarding (Slice 4)

```
[ Patient signs up, then: ]
[ /consent-onboarding — list active consent_documents WHERE audience = 'patient' AND is_required = true ]
        ↓ patient reads + scrolls (track scroll completion)
        ↓ "I agree" button enabled at the bottom
        ↓ patient_consents row inserted with acceptance_method = 'patient_self'
[ All required consents accepted → redirect to /patient-dashboard ]
```

Edge cases:

- New consent version published → re-prompt on next login.
- Patient rejects required → cannot proceed; clear messaging.
- Staff capturing on patient's behalf (kiosk) → `acceptance_method = 'kiosk'` or `'staff_assisted'`.

### E-5 · Tenant settings (Slice 6)

```
[ Doctor admin opens /tenant-settings ]
        ↓ form bound to tenant_profile + tenant_app_config rows
        ↓ logo upload via Storage
        ↓ primary_color / secondary_color picker
        ↓ "Save"
[ tenantConfigService.updateAppConfig(); BrandContext re-renders without reload ]
```

This is where Phase 4 (white-label) starts paying off.

### E-6 · Doctor schedule (already shipped)

Already covered by `SecretarySlotsPage` + `SecretaryBookingPage` + Tier 1 schedule templates. No new UX work; just polish and walk-through validation.

### E-7 · UX cross-cutting concerns

- **Loading states**: every page uses `<LoadingSkeleton>` (already in `App.jsx` Suspense fallback). New pages must render skeletons matching shape, not blank.
- **Error states**: every service returns `{ data, error }`. Pages must render error toasts via `useToast` and an inline retry. Pattern documented in CLAUDE.md.
- **Empty states**: every list page must have an "empty" view with a primary CTA, not a blank table.
- **Mobile responsiveness**: build with Tailwind responsive classes from day one; the marketing brief says mobile-first.
- **i18n**: Lebanese-Arabic locale is on the roadmap (`TIER2_REVIEW.md` §13 OOS list). Build copy through a constant module so the swap is mechanical when i18n lands.

---

## §F · Logic roadmap — business rules to encode

Where SQL state machines and DB triggers don't already enforce something, the rule belongs here. Order: most critical first.

### F-1 · State machines (DB + client mirrored)

Already shipped:

- Encounter: `planned → in_progress → completed | cancelled | entered_in_error` (DB trigger + `lib/stateMachines.js`).
- Clinical document: `draft → final → superseded | void` (same).
- Lab/imaging order: `draft → ordered → in_progress → resulted | cancelled` (same).
- Prescription: `draft → active → completed | stopped | cancelled` (same).
- Care task: `open → in_progress → done | cancelled` (same).
- Appointment: existing Tier 0 enum, enforced by `book_slot` + `cancel_appointment` RPCs.
- Payment: `pending → completed | failed; completed → refunded` (`stateMachines.js`).

**New rules to add when their slice ships**:

- **F-1a** Patient gated by intake completion (Tier 1 plan §1.2). The `book_slot` RPC already raises `INTAKE_REQUIRED`. Surface message in `appointmentService` + booking pages.
- **F-1b** Encounter cannot be completed without at least one note **or** an explicit "no-note encounter" reason. Enforce in `complete_encounter` body or in the UI confirm modal.
- **F-1c** Prescription requires diagnosis on the same encounter. Either a soft warning (UI) or a hard check (RPC).
- **F-1d** Insurance claim cannot leave `draft` without an attached signed-PDF claim form. Trigger or RPC guard.

### F-2 · Authorization rules (beyond RLS)

RLS handles row-level access. Some business logic needs application-side checks:

- **F-2a** Secretary can finalize **only** insurance / certificate / referral / lab-request documents. Currently `finalize_clinical_document` accepts secretary for all types (Addendum B-1). Tighten when multi-staff tenants exist.
- **F-2b** Predoctor can edit `precheck_forms.status = draft|submitted` only. Once `reviewed`, doctor-only.
- **F-2c** Patient cannot cancel an appointment within 2 hours of `scheduled_at`. Surface in `appointmentService.cancel`; mirror in DB trigger if business owner wants hard enforcement.
- **F-2d** Admin DELETE on Tier 2 PHI must always also write an `audit_log` row tagged `purge` (currently audit trigger fires on DELETE; add the explicit `purge` reason via Edge Function). See review H8.

### F-3 · Workflow orchestration

These are multi-step flows the user owns; the system enforces ordering:

- **F-3a** First-visit lifecycle: book → check-in (predoctor precheck) → consultation (doctor encounter) → checkout (payment) → secretary creates `medical_intake` (one-time). Patient becomes `established` only after intake completes. Already wired; need an end-to-end test.
- **F-3b** Lab result lifecycle: doctor orders (`lab_orders.status = 'ordered'`) → secretary uploads PDF (`document_attachments` linked to `lab_orders.result_document_id`) → status auto-flips to `'resulted'` via trigger or service. **Trigger not yet shipped.**
- **F-3c** Reminder fan-out: cron Edge Function reads `appointments` 24h before `scheduled_at`, generates `notification_events` per `reminder_rules`. Slice 5.
- **F-3d** Consent re-prompt: on every patient login, check `patient_consents` against active `consent_documents`; if any required version newer than accepted → redirect to onboarding. Slice 4.

### F-4 · Data retention

- **F-4a** `audit_log` retention: keep 7 years (healthcare default). Partition + drop old partitions when §4 of perf plan triggers.
- **F-4b** Soft-archived rows: retained indefinitely on production tenant. Right-to-be-forgotten Edge Function (H8) does hard purge with audit trail.
- **F-4c** Message redaction: current model overwrites body in place; admin cannot recover. Document explicitly (A4).
- **F-4d** PITR: confirm Supabase Pro tier covers 7-day PITR. Document the restore procedure as part of disaster-recovery runbook (currently absent — see review §3 "Backup / restore drill").

---

## §G · API roadmap — service + edge function contracts

### G-1 · Web service layer (already in good shape)

Adopt the contracts already encoded in `src/services/api.js` and `CLAUDE.md`:

- **List reads** → `apiPaged()` → `{ data, meta: { pagination: { page, pageSize, totalItems, totalPages } }, error }`.
- **Single reads/writes** → `apiCall()` → `{ data, error }`.
- **Validation** → `parseWithSchema()` before any DB write.
- **Error string** → user-facing string, not a stack trace; pages decide rendering.

The current 19 services already follow this. New services must too. Audit: `npm run audit:backend-contract` enforces this on CI.

### G-2 · Edge Function parity (Slice 5 + per-tier additions)

Today **no Edge Function source is canonical in the repo**. The old deployed V1 functions (`auth`, `appointments`, `patients`, `process-payment`, `consultations`, `referrals`) are retired, unsupported, and now deleted from the live Supabase project. Supabase CLI and MCP both show zero deployed Edge Functions. **Mobile clients can call Supabase JS directly with the anon key**, so parity is not blocking — but Phase 4 (white-label) and Phase 5 (mobile branded apps) may want a proxy/worker layer.

Plan when needed:

| Target | Edge Function | Mirrors |
|---|---|---|
| Slice 5 (today's blocker) | `notifications-worker` | scheduled function: scan `notification_events` queue → fan out to FCM/APNs/Resend → write `notification_deliveries` |
| Phase 4 prep | `clinical` | `clinicalService` methods |
| Phase 4 prep | `messaging` | `messagingService` methods |
| Phase 4 prep | `tenant-config` | `tenantConfigService` (already covered by `get_public_tenant_app_config` RPC for the public part) |
| Phase 4 prep | `purge-patient` | service-role admin DELETE orchestration (review H8) |

Each future Edge Function returns the **same envelope** as the matching service: lists → `{ data, meta, error }`; single → `{ data, error }`. Mobile client SDK is identical to web SDK on shape. Do not recreate the retired V1 wrappers unless the API contract is redesigned and documented first.

### G-3 · Idempotency contract

`client_request_id uuid` columns shipped on `messages`, `notification_events`, `notification_deliveries`, `care_tasks`, `clinical_documents`. **Service plumbing not yet propagated to all writes** — adopt during Slice 1/3 implementation: every write that mobile retries must accept and forward an idempotency token from the caller.

Pattern:

```js
async sendMessage(payload, { idempotencyKey } = {}) {
  const parsed = parse(messageCreateSchema, payload);
  if (parsed.error) return validationError(parsed.error);
  return apiCall(
    supabase
      .from('messages')
      .insert([{ ...parsed.data, client_request_id: idempotencyKey ?? null }])
      .select(MESSAGE_SELECT_FIELDS)
      .single()
  );
}
```

DB unique index on `(client_request_id) WHERE client_request_id IS NOT NULL` makes retries safe: second insert with the same key returns the original row (or a constraint violation the service maps to "already submitted").

### G-4 · Storage contract (A2 — pre-Slice 2)

After §A2 ships:

- **Read**: `documentService.getDownloadUrl(documentId)` → calls `supabase.storage.from('clinical-documents').createSignedUrl(path, 300)`. Never expose `file_url` directly to clients.
- **Write**: `documentService.uploadAttachment(file)` → upload to bucket → insert `document_attachments` row → return `{ data: row, error }`.
- **Bucket layout**:
  - `clinical-documents` (RLS-protected, signed URLs only)
  - `message-attachments` (RLS-protected, signed URLs only)
  - `tenant-assets` (public, logos / icons only)

### G-5 · Realtime contract

Already shipped:

- `messagingService.subscribeToConversation(conversationId, callback)`
- `notificationCoreService.subscribeToEvents / subscribeToUserNotifications / subscribeToNotifications / subscribeToDeliveries`

Pattern for new realtime endpoints: always return the unsubscribe function so callers can clean up:

```js
subscribeToFoo(id, callback) {
  return supabase
    .channel(`foo:${id}`)
    .on('postgres_changes', { ... }, callback)
    .subscribe();
}
// caller: const sub = service.subscribeToFoo(id, onChange); return () => sub.unsubscribe();
```

---

## §H · Process improvements (small but high-leverage)

| # | Item | Effort | Why |
|---|---|---|---|
| H-1 | Add `docs/erd/` to repo (after §B) — `schema_dump.sql`, `erd.png`, `tables.txt` | 1h | Visual truth; embeddable in pitches |
| H-2 | CI step: regenerate `docs/erd/tables.txt`, fail on diff | ½ day | Automated drift detector |
| H-3 | Add `BACKLOG.md` with the deferred items from §D and TIER2 review §4 | ✅ Done | Single backlog instead of scattered notes |
| H-4 | Move TIER0 / TIER0_V2 plans to `docs/archive/legacy-tier-plans/` (per Tier 1 plan §1.10) | ✅ Done | Stop misleading future readers with historical plans |
| H-5 | Add JSDoc/TS-doc on every service method (parameter shapes + return shape) | 1 day | Mobile/SDK consumers can autogenerate types |
| H-6 | `pre-commit` hook running `npm run audit:backend-contract` | 15 min | Catches drift at commit time, not CI |
| H-7 | Document the disaster-recovery runbook (PITR restore drill) | ½ day | Healthcare data without a tested restore is not safe |

---

## §I · Recommended order — next 4 weeks

| Week | Focus |
|---|---|
| **Week 1** | §A1–A4 (Block A residue) · full replay proof for §B baseline · finish `schema_dump.sql`/`erd.png` branch export · §H-3, H-4 (housekeeping) ✅ · Index/perf Blocks A+C ✅ |
| **Week 2** | Slice 1 — Doctor encounter MVP (E-1, F-1b/c) · pgTAP RLS suite (A3, runs alongside) |
| **Week 3** | Slice 2 — Patient documents (Storage RLS prerequisite is in repo; run branch/local proof before release) · Slice 3 prep |
| **Week 4** | Slice 3 — Patient ↔ staff messaging (E-3) |

After Week 4: Slices 4 (consent) + 6 (tenant config) in parallel; Slice 5 (notifications worker) immediately after.

---

## §J · Anti-goals (do not do these next)

- **Don't start the control plane (Tier 3).** Tier 2.5 closing first; control plane is premature without a second tenant in production.
- **Don't build mobile apps yet.** Slice 5 + envelope adoption come first.
- **Don't add new clinical workflows beyond `clinical_documents` types.** The current surface is enough; ship UI before extending DB.
- **Don't unify `predoctors` and `staff_members` tables.** They model different things (application/onboarding vs. employed staff hierarchy). Document the distinction in `CLAUDE.md` if confusion arises.
- **Don't accept `dist/` back into git.** `.gitignore` is now authoritative.
- **Don't skip the §B baseline migration.** Without it, multi-tenant onboarding is impossible.

---

## §K · Tracking

This document owns the next-4-weeks plan. Source-of-truth updates:

- **What changed in code** → commit + PR description.
- **What changed in the live DB** → new migration in `supabase/migrations/`, `npm run verify`.
- **What changed in plans** → update this file inline; old versions live in git.
- **What was decided in a meeting** → write it into CLAUDE.md or a TIER plan; do not lose it in chat.

---

**End of NEXT_STEPS_PLAN.md.** When the remaining §I Week 1 proof work is done, this doc gets a "v2" with the Slice 1 detailed-design appendix, ERD export, and branch/local replay result.
