# DoctoLeb Tier 2 Architecture Review

> **Reviewer role**: senior product architect + DBA + Supabase RLS reviewer + React systems engineer + healthcare workflow analyst + SaaS platform architect.
> **Verified against**: live Supabase project `gezmfmskhmjgnquoyosq` (clinic-website), migration `20260506150820_tier2_product_core_foundation` plus all preceding Tier 0 / Tier 1 migrations.
> **Verdict**: foundation is **structurally sound** and meets the architecture doc's claims. There are **no critical PHI leak findings**. There are notable gaps in atomic lifecycle RPCs, service-layer envelope, idempotency, and several smaller hardening items detailed below.
> **Recommendation**: do not start large UI work yet. Close 4 high-priority gaps first (§4–§5), then start Slice 1 (encounter workflow hooks) per §10.

> **Implementation note — 2026-05-06**: Tier 2.5 Block A and backend-contract cleanup have since been implemented and applied to the live development Supabase project. Treat the findings below as the original review trail; check `TIER2_5_HARDENING_PLAN.md`, `BACKEND_CONTRACT_FREEZE_IMPLEMENTATION.md`, and `SUPABASE_ADVISOR_SNAPSHOT_20260506.md` for current status.

---

## 1. Findings — ordered by severity

Severity scale: **P0** = blocker / data risk · **P1** = high / address before next slice · **P2** = medium / address during next slice · **P3** = low / track in backlog.

### P0 — none

No P0 findings. RLS is correctly applied with `(SELECT helper())` wrappers. PHI FKs are `RESTRICT`. DELETE policies on PHI/financial tables are admin-only. Audit triggers cover 31 tables. The `get_public_tenant_app_config` RPC is correctly anon-granted and only exposes safe fields. RLS spoof checks (clinical_notes / diagnoses / prescriptions enforcing `author_user_id = current_domain_user_id()`; messages enforcing `sender_user_id = current_domain_user_id() OR sender_patient_id = current_patient_id()`; patient_devices enforcing both `user_id` and `patient_id` match) are real and prevent the obvious spoof attacks.

### P1

**P1-1 — No atomic lifecycle RPCs for encounters / clinical_documents** *(architecture doc §2 promises them; not implemented)*
- `clinicalService.createEncounter` and `updateEncounter` are direct table mutations.
- A doctor can move an encounter `completed → in_progress` arbitrarily; no state machine guard.
- **Impact**: clinical record integrity. Documents finalized then "un-finalized" silently. No audit trail of who reverted.
- **Fix**: add SECURITY DEFINER RPCs `start_encounter(appointment_id, …)`, `complete_encounter(encounter_id)`, `finalize_clinical_document(document_id)` that enforce status transitions per a state machine; revoke direct INSERT/UPDATE on the status column from authenticated.

**P1-2 — No DELETE policies on Tier 2 PHI tables** *(currently DELETE is implicitly denied — but no admin escape valve)*
- All 24 Tier 2 tables have RLS on with INSERT/SELECT/UPDATE policies but **zero DELETE policies**. Default deny works. But admin needs a path for legitimate purges (GDPR right-to-be-forgotten, tenant offboarding).
- **Impact**: real-world ops will hit a wall. Tier 1 has `*_admin_delete` policies; Tier 2 doesn't.
- **Fix**: add `*_admin_delete` policies to Tier 2 PHI tables consistent with Tier 1 pattern: `USING ((SELECT public.has_role(ARRAY['admin']))).` OR document that purges happen via a service-role Edge Function and add the Edge Function.

**P1-3 — Service layer doesn't return the `{data, meta, error}` envelope** *(architecture doc §10)*
- All four new services return raw `{data, count, error}` from `apiCall`. The doc specifies `{data, meta:{pagination:{page,pageSize,totalItems,totalPages}}, error}` for mobile/web parity.
- **Impact**: mobile clients will hit a different shape than the doc and tests expect. Pagination cursors/limits are not surfaced. Refactoring later is cheap *now*, expensive after UI adopts the wrong shape.
- **Fix**: introduce `apiPaged()` wrapper alongside `apiCall()` that produces the documented envelope. Adopt in all `getX` methods that take `limit`. Keep `apiCall` for single-row writes.

**P1-4 — No idempotency keys on writes that mobile retries**
- `notificationCoreService.createDelivery` / `updateDelivery` accept raw payloads without an idempotency token. Same for `clinicalService.createCareTask`, `messagingService.sendMessage`, `notificationCoreService.createEvent`.
- **Impact**: mobile offline retry will create duplicate notifications, duplicate messages on flaky networks. Architecture doc §13 lists this as "later" — for messaging and notifications it should be **now**, before any UI.
- **Fix**: add `client_request_id uuid` (nullable) to `messages`, `notification_events`, `notification_deliveries`, `care_tasks`, `clinical_documents`. Partial-unique index on `(client_request_id) where client_request_id is not null`. Service layer accepts and forwards.

**P1-5 — `clinicalService.addDocumentAttachment`, `messagingService.addParticipant`, `messagingService.addAttachment`, `notificationCoreService.createDelivery`/`updateDelivery`, `clinicalService.updateCareTask` — no Zod validation**
- Most service methods use `parseWithSchema(...)`. These five accept raw payload.
- **Impact**: client-side validation skipped; only RLS catches malformed/spoofed inserts. Inconsistent with the rest of the service layer; will rot.
- **Fix**: add Zod schemas (`documentAttachmentSchema`, `conversationParticipantSchema`, `messageAttachmentSchema`, `notificationDeliverySchema`, `careTaskUpdateSchema`); wire `parse(...)`.

### P2

**P2-1 — `doctor_brand` (Tier 1) is now redundant with `tenant_profile` + `tenant_app_config` (Tier 2)**
- The architecture doc maps "Doctor → tenant_profile" and "Doctor → doctor_brand" was the Tier 1 brand surface. The doc never explicitly deprecates `doctor_brand`. Two truth-of-record tables for branding is a maintenance trap.
- **Fix**: pick `tenant_profile` + `tenant_app_config` as canonical (richer, mobile-aware). Mark `doctor_brand` as deprecated in `CLAUDE.md` and the schema design doc; plan a Tier 2.5 migration that copies any populated fields and drops `doctor_brand` table after consumers migrate. The `BrandContext` planned in Tier 1 should read from `tenant_profile` / `tenant_app_config` instead.

**P2-2 — `feature_flags` and `tenant_app_config` SELECT is open to all authenticated**
- Both have `auth.role() = 'authenticated'` SELECT policies. Patients can list every flag and config row (not catastrophic; rows aren't secrets). But a flag named e.g. `enable_super_admin_panel` would leak its existence to patients.
- **Fix**: split SELECT — public-safe rows via the `get_public_tenant_app_config` RPC (already done for app config); add an `audience` enum to feature_flags (`public | patient | staff | admin`) and gate SELECT by `audience` × current role.

**P2-3 — No state machine helper for encounters / documents / orders / prescriptions / care_tasks**
- `lib/appointments.js` already encodes a state machine with `canTransitionAppointmentStatus`. Tier 2 lifecycles have no parallel.
- **Fix**: extend `src/lib/states.js` (new) with `canTransitionEncounter`, `canTransitionDocument`, `canTransitionOrder`, `canTransitionPrescription`, `canTransitionCareTask`. Use server-side in the new RPCs (P1-1) AND client-side in services for fast UX.

**P2-4 — `messages.UPDATE` lets sender edit indefinitely; no audit, no redaction window**
- Messages UPDATE policy: sender or admin. No timestamp guard ("can't edit after 60s") and no `edited_at` column. Audit trigger is intentionally OFF for messaging.
- **Impact**: a staff member can quietly rewrite history in a patient conversation.
- **Fix**: add `edited_at timestamptz`, `original_body text` (or store a `messages_history` audit shadow table for messaging only). Add a 5-minute UPDATE window via trigger or revoke UPDATE entirely (recommended: revoke; allow only "redact" via setting `body = NULL, redacted_at = NOW(), redacted_by = …`).

**P2-5 — `notification_events.created_by` is `RESTRICT FK NOT NULL`, blocking system-originated events**
- A future Edge Function worker (architecture doc §13) will need to fan out reminders. With `created_by NOT NULL FK users(id)`, the worker must impersonate a real user.
- **Fix**: either (a) make `created_by` nullable for `source = 'system'`, or (b) seed a system user with role `'admin'` and `email = 'system@internal'` and document that all system events use this user. (a) is cleaner.

**P2-6 — `patient_consents.accepted_by_user_id` may be NULL on INSERT** *(per the policy I read)*
- Allows "consent recorded without identifying who clicked accept." Useful for kiosk mode? Risky for compliance.
- **Fix**: require non-null at the schema level (`NOT NULL`) and accept either patient (`accepted_by_user_id = patient.user_id`) or staff capturing consent on patient's behalf. Add `acceptance_method text CHECK (… IN ('patient_self','staff_assisted','kiosk'))`.

**P2-7 — No realtime subscription helpers in `messagingService` or `notificationCoreService`**
- Live chat MVP needs `subscribeToConversation(conversationId, callback)` and "new message" channel; existing `notificationService.subscribeToUserNotifications` pattern is the model.
- **Fix**: add `messagingService.subscribeToConversation(id, cb)` and `notificationCoreService.subscribeToEvents(userId, cb)` mirroring the existing pattern.

**P2-8 — `current_doctor_id()` / `current_patient_id()` / `can_access_conversation()` granted to `anon`**
- These functions return NULL when called without a session, which is harmless. But granting EXECUTE to anon expands the public attack surface for no benefit. Other auth helpers (`current_domain_user_id`, `current_user_role`, `is_staff`, `has_role`) are correctly authenticated-only.
- **Fix**: `REVOKE EXECUTE … FROM anon` on these three. They're only ever called by RLS policies, and RLS only fires for authenticated requests on protected tables.

**P2-9 — `set_updated_at` trigger function has a NULL grantee in pg_proc.proacl**
- Means it's effectively granted to PUBLIC. Trigger functions don't need EXECUTE grants — they run via the trigger owner. Not exploitable, but defense-in-depth.
- **Fix**: `REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC;`

### P3

**P3-1 — `tenant_profile` is 1:1 with the (single) doctor in this silo, but FK is `RESTRICT` not `UNIQUE`**
- Schema permits multiple `tenant_profile` rows per doctor. Architecture is "one tenant DB = one doctor", so this should be enforced.
- **Fix**: `ALTER TABLE tenant_profile ADD CONSTRAINT tenant_profile_doctor_id_unique UNIQUE (doctor_id);` Likewise for `tenant_app_config (profile_id)` if 1:1 expected.

**P3-2 — `clinics` (location) has no GIST index for `(latitude, longitude)`**
- Patient-facing "find clinic near me" later. Add when feature lands.

**P3-3 — `messages` has no full-text search**
- Future "search my conversations" needs `tsvector` column + GIN index. Defer until messaging UX validated.

**P3-4 — `audit_log` has no UI**
- Compliance staff need a viewer. Defer until first audit request.

**P3-5 — Edge Functions still on Tier 1 list — Tier 2 mobile parity not yet exposed**
- Tier 0 had 6 edge functions. Tier 1 plan added more. Tier 2 has not added edge functions for clinical/messaging/notifications. Mobile clients will hit Supabase JS directly for now — fine, but parity needs deciding before mobile build.

---

## 2. Live DB verification summary

| Check | Status | Notes |
|---|---|---|
| Tier 1 + Tier 2 tables exist | ✅ 23 + 24 = 47 new tables | All present in `public` schema |
| RLS enabled | ✅ on all 47 | `relrowsecurity = true` |
| Tier 2 policy count | ✅ 72 | matches architecture doc |
| Helpers exist | ✅ all 12 | `current_patient_id`, `current_doctor_id`, `set_updated_at`, `is_staff` (updated), `can_access_conversation`, `get_public_tenant_app_config`, plus existing `book_slot`, `cancel_appointment`, `current_domain_user_id`, `current_user_role`, `has_role`, `update_patient_profile` |
| `book_slot` extended | ✅ accepts `p_visit_type uuid` | snapshot of `visit_type_id` on appointments |
| `appointments` snapshot columns | ✅ `clinic_id`, `visit_type_id` both present | nullable; backfill done |
| `secretary_slots.schedule_template_id` | ✅ present | links materialized slots to template |
| FK ON DELETE on PHI | ✅ RESTRICT everywhere | spot-checked encounters, clinical_*, prescriptions, lab/imaging, documents, attachments, care_tasks, patient_consents, patient_devices, notifications. Cascades only on owning-aggregate edges (conversation → participants → messages → attachments → receipts) which is correct |
| Audit triggers | ✅ 31 tables fully covered | INSERT/UPDATE/DELETE on PHI/legal/financial/tenant-config; messaging intentionally excluded |
| Anon access | ✅ only `get_public_tenant_app_config`, `can_access_conversation`, `current_doctor_id`, `current_patient_id`, `set_updated_at` | last 4 should be revoked from anon (P2-8/P2-9) |
| RLS perf style | ✅ `(SELECT helper())` everywhere | spot-checked 13 tables |
| Spoof-safe writes | ✅ clinical_notes/diagnoses/prescriptions/messages/patient_devices all enforce author/sender/owner identity inside `WITH CHECK` |
| `is_staff()` widening | ⚠️ unverified in this pass | architecture doc says updated; Tier 1 plan deferred — confirm via `pg_get_functiondef` next pass |

**Confidence**: high. The foundation does what the architecture doc says it does.

---

## 3. Missing use cases & unexpected scenarios

These belong in the next slice's design or as backlog items.

### Patient
- **Document download/share**: how does a patient receive a prescription PDF? Storage URLs need signed URLs with TTL, not direct anon-readable buckets. Not designed yet.
- **Lab result viewing**: a patient with `lab_orders.status = 'resulted'` and a linked `result_document_id` — how do they actually view the result? UI not designed.
- **Late cancellation**: patient cancels 2 hours before appointment. Fee policy? Block? Notify staff differently? Not modeled.
- **Family member booking on behalf of patient**: parent booking for child. No "guardian" model. Will hit immediately when parents try to register.
- **Patient changes phone / loses access to old email**: account recovery beyond Supabase Auth's reset email. Operational gap.

### Doctor
- **Encounter resumed across sessions**: doctor starts encounter at 10am, gets pulled into emergency, finishes at 2pm. Session timeout will log them out. Encounter must persist; auto-save needed; conflict resolution if another staff edits in the gap. Not designed.
- **Encounter for walk-in (no appointment)**: `encounters.appointment_id` is `RESTRICT FK NOT NULL`. Walk-ins via `paymentService.createWalkIn` produce a patient but no appointment → no encounter possible. Common ER/clinic flow blocked.
- **Co-signed notes**: junior doctor or nurse adds a note that requires doctor counter-signing. No `requires_cosign` / `cosigned_by` field.
- **Amendment vs correction of a finalized note**: medical-record integrity requires you keep the original and append an amendment, not edit. `clinical_notes` lacks an amendment table.

### Secretary / Predoctor / Nurse
- **Walk-in registration → first visit → intake flow**: walk-in patient gets a synthetic email, no auth account. `current_patient_id()` returns NULL for them. They can't open patient portal. Process is staff-mediated only — fine, but nothing in the schema records "this patient is staff-mediated, no portal". Useful flag.
- **Insurance pre-authorization**: claims model exists. Pre-auth (separate workflow before service is rendered) doesn't.
- **Recurring prescriptions / refills**: `prescriptions` is single-issue. Refill counts and refill events aren't modeled.
- **Lab result import (file upload)**: secretary receives a lab PDF by email and uploads to a `lab_orders.result_document_id`. Workflow exists tablewise; UX undefined.
- **Patient no-show penalty / blacklist**: no-show count per patient is queryable but no policy or auto-action. Operational gap.

### Insurance
- **Multi-policy claim split**: patient has primary + secondary insurance. Architecture currently allows one `policy_id` per claim. Real claims often split.
- **Co-pay vs deductible**: claim amounts track `amount`, `amount_paid_by_insurer`, `amount_paid_by_patient` — but not `deductible_applied`, `copay`. Insurer rejection often hits deductible first; need this for accurate balances.

### System
- **Backup / restore drill**: who tested? Architecture doesn't reference. Healthcare data needs documented PITR validation.
- **Service-account key rotation**: when control plane is built, service-role keys rotate quarterly. Process undefined.
- **Migration drift between tenants**: doc mentions `tenant_profile.schema_version` but no automation to verify it. Real-world Tier 2+ tenants will drift.

---

## 4. DB / ERD improvement plan (post-Tier 2)

Bundle these as **Tier 2.5 hardening** before Slice 1:

1. **Atomic lifecycle RPCs** (P1-1) — `start_encounter`, `complete_encounter`, `cancel_encounter`, `finalize_clinical_document`, `revise_clinical_document`. SECURITY DEFINER. Status transitions enforced by helpers in the function body. Revoke direct UPDATE on `encounters.status` and `clinical_documents.status` from authenticated.
2. **Admin DELETE policies** (P1-2) — add explicit admin DELETE on every Tier 2 PHI table (parallel to Tier 1 pattern).
3. **Idempotency columns** (P1-4) — `client_request_id uuid` on `messages`, `notification_events`, `notification_deliveries`, `care_tasks`, `clinical_documents`. Partial unique index where not null. Service-layer plumbing to forward token.
4. **`doctor_brand` deprecation** (P2-1) — explicit DROP migration after consumers migrate to `tenant_profile`/`tenant_app_config`. Plan one Tier 2.5 migration; don't drop in same migration that introduces consumer changes.
5. **`tenant_profile.doctor_id` UNIQUE** (P3-1) — prevent multi-profile-per-doctor.
6. **Walk-in encounter path** — make `encounters.appointment_id` nullable; add `encounters.is_walk_in boolean` and `encounters.walk_in_reason text`. RLS unchanged (still doctor + patient scoped). Update `start_encounter` RPC to accept either path.
7. **Guardian/dependent model** — new `patient_guardians (patient_id, guardian_user_id, relationship, can_book, can_view_records, valid_from, valid_to)` junction. Relax patient-scoped RLS to include "patient_id IN guardian.patient_id where guardian_user_id = current_domain_user_id() AND can_view_records". Significant work; can defer to Tier 3.
8. **Clinical note amendments** — new `clinical_note_amendments (note_id, body, amended_by, amended_at, reason)`. `clinical_notes.body` becomes immutable post-finalization (enforced by a trigger that blocks UPDATE on body when `is_finalized = true`).
9. **Prescription refill model** — `prescription_refills (prescription_id, refill_number, refilled_at, refilled_by, pharmacy_text)`. `prescriptions.refills_remaining smallint` countdown.
10. **Pre-auth model** — new `insurance_preauthorizations (patient_id, provider_id, policy_id, requested_service text, status, valid_from, valid_to, …)`.

---

## 5. RLS / security hardening plan

| # | Action | Why | Effort |
|---|---|---|---|
| H1 | Add admin DELETE policies on all 24 Tier 2 PHI tables (P1-2) | Operational purges blocked; consistent with Tier 1 | 1h |
| H2 | Revoke EXECUTE on `current_doctor_id`, `current_patient_id`, `can_access_conversation`, `set_updated_at` from `anon` (P2-8/P2-9) | Surface reduction | 15 min |
| H3 | Add `audience` to `feature_flags`; gate SELECT by audience × role (P2-2) | Stop leaking staff-only feature names to patients | 2h |
| H4 | Tighten `messages.UPDATE` to redact-only (P2-4) | Prevent silent message rewrites | 1h |
| H5 | Make `notification_events.created_by` nullable + add `source text CHECK ('user' OR 'system')` (P2-5) | Enable system-originated reminder events | 30 min |
| H6 | `patient_consents.accepted_by_user_id` NOT NULL + `acceptance_method` (P2-6) | Compliance, audit clarity | 30 min |
| H7 | RLS test suite — pgTAP or sql-style tests asserting "patient B cannot read patient A's encounter" for every PHI table (architecture doc §14) | Drive correctness; we have no automated coverage | 1 day |
| H8 | Document and codify "purge a patient" path — Edge Function with service role | Right-to-be-forgotten compliance | 0.5 day |
| H9 | Storage bucket policies for `clinical_documents` + `message_attachments` — signed URLs only, no public buckets, RLS on `storage.objects` joining `document_attachments.patient_id` | When document UI lands | 0.5 day |

---

## 6. API / service / frontend layering plan

### Service-layer corrections (do these before any UI)
1. **Adopt `{data, meta, error}` envelope** — introduce `apiPaged()` alongside `apiCall()`; refactor every `getX` method that takes a `limit`. (P1-3)
2. **Zod-validate every write path** (P1-5) — fix the 5 named methods. Same `parseWithSchema` pattern.
3. **Add idempotency parameter** to writes that mobile retries (P1-4).
4. **Add realtime subscribe helpers** in messaging + notificationCore (P2-7).
5. **State machine helpers** in `src/lib/states.js` (P2-3) — encounter/document/order/prescription/care_task. Call from services for fast client UX even when server enforces.

### Service modules to split before they grow
- `clinicalService` is already 350 lines and covers 9 tables. Split into:
  - `encounterService` (encounters, clinical_notes, diagnoses, care_tasks)
  - `prescriptionService` (prescriptions, refills)
  - `orderService` (lab + imaging + result-document linkage)
  - `documentService` (clinical_documents, document_attachments, signed-URL fetch)
- `tenantConfigService` is fine — keep as is.
- `messagingService` is fine but small; will grow when realtime + redaction land.
- `notificationCoreService` is fine.

### Feature hooks (next layer above services — start ONLY after corrections above)
Build these hooks first, then pages consume them:
- `useEncounter(appointmentOrEncounterId)` — load + subscribe to changes
- `useDoctorEncounterTimeline(patientId)` — paginated history
- `usePatientDocuments(patientId)` — list + signed-URL helper
- `useConversation(conversationId)` — messages + participants + realtime
- `useUnreadCounts()` — for sidebar badges
- `usePatientConsents(patientId)` — list + accept

### Pages — what NOT to do
- Do NOT put `supabase.from(...)` calls in pages (existing rule, holds).
- Do NOT call services directly in pages without going through a hook for any data that may need realtime / cache invalidation.
- Do NOT hardcode `select` strings in pages — already enforced via `selects.js`.

### Pages — what TO build first
See §10 implementation order.

---

## 7. UX implementation plan (vertical slices)

Each slice = thin end-to-end vertical, shippable independently. Each leaves the system **better** than before, even if work pauses after.

### Slice 1: Doctor encounter MVP (the headline doctor workflow)
- New page `/doctor-encounter/:appointmentId` (creates encounter on entry if not exists) and `/doctor-encounter-id/:encounterId` (resume).
- Tabs: **Visit summary** (read-only patient context) · **Notes** (add/edit) · **Diagnoses** (add) · **Prescriptions** (add) · **Orders** (lab/imaging) · **Care tasks** · **Documents**.
- "Start encounter" → calls `start_encounter` RPC (P1-1).
- "Complete encounter" → opens a confirm + signature panel → calls `complete_encounter` RPC.
- Auto-save notes every 30s; resume on reload.
- Ships: feature hooks, encounter RPCs, doctor sidebar entry, `lib/states.js` for encounter transitions.
- Effort: 6–8 days.

### Slice 2: Patient documents + lab/imaging viewer
- Patient-facing: `/patient-documents` lists `clinical_documents` they're authorized to see; click → signed-URL preview.
- Doctor-facing: in encounter, "create document" → choose template (prescription, certificate, lab order, referral) → fill → finalize.
- Ships: storage bucket policies (H9), `documentService`, signed-URL helper, `useDocument(id)` hook.
- Effort: 4–5 days.

### Slice 3: Patient ↔ staff messaging MVP
- Conversation list (`/messages`): patient sees own; staff sees all.
- Thread view: messages, sender label, attachments, read receipts.
- Compose, send, mark-read.
- Realtime via `subscribeToConversation`.
- Unread count badge in sidebar.
- Redact-only edit policy (H4) enforced.
- Ships: messaging realtime, redaction migration, idempotency (P1-4), `useConversation`, `useUnreadCounts`.
- Effort: 5–7 days.

### Slice 4: Consent onboarding
- Pre-login (after registration, before first booking): show active consent documents, require accept-all to proceed.
- Track via `patient_consents` with `acceptance_method = 'patient_self'`.
- Re-prompt when a new version is published.
- Ships: `useActiveConsents`, `useMyConsentStatus`, consent acceptance flow page.
- Effort: 3 days.

### Slice 5: Notification send worker (Edge Function)
- Edge Function: scans `notification_events` where `status = 'pending'`, fans out to channels (push via FCM; email via Resend; SMS later), writes `notification_deliveries` rows.
- Retry rules in `reminder_rules`.
- Reminder generator: scheduled function that creates events from `appointments` + reminder rules.
- Push token registration UI (`patient_devices`) on first patient login.
- Ships: Edge Function, push registration, reminder generator cron.
- Effort: 5–7 days.

### Slice 6: Tenant config admin UI
- `/tenant-settings` (doctor/admin): edit `tenant_profile` + `tenant_app_config` (display name, logo, primary color, languages, public copy).
- Branding context (`BrandContext`) that reads `tenant_app_config` (replacing the Tier 1 plan to read from `doctor_brand`).
- Ships: `BrandContext`, settings page, logo upload to Storage.
- Effort: 3–4 days.

### Slice 7: RLS automated tests
- pgTAP or sql-runner tests asserting all PHI boundaries (architecture doc §14).
- CI integration.
- Ships: test suite + GitHub Action.
- Effort: 2–3 days.

---

## 8. Mobile readiness plan

Tier 2 added the right scaffolding (`tenant_app_config`, `patient_devices`, `notification_events/deliveries`) but it's not yet "ready." Gaps:

- **Pagination contract** — needed before mobile lists any feed. Implement P1-3.
- **Idempotency keys** — P1-4. Critical for offline flaky-network retries.
- **Signed URLs for media** — H9. Mobile cannot use direct Supabase URLs without RLS-validated short-lived signing.
- **Push notification send worker** — Slice 5. Without it, push tokens accumulate but no actual notifications go out.
- **Force-update gate** — `tenant_app_config.min_supported_version` exists. Mobile splash screen must call `get_public_tenant_app_config()` and compare; block UI if too old. Test path needed before app store release.
- **Maintenance mode** — `tenant_app_config.maintenance_message` exists. Mobile must respect and show banner.
- **Locale** — `tenant_app_config.enabled_locales` exists. Mobile picks user preferred and falls back. App copy via `content_pages` (slug-keyed). UI plumbing not yet built.
- **Edge Function parity** — recommend deploying `clinical/`, `messaging/`, `notifications/`, `tenant-config/` Edge Functions per tenant in Phase 4 of the SaaS plan, mirroring services. Until then, mobile uses Supabase JS directly with same anon key per tenant URL.

---

## 9. SaaS / control-plane plan (forward-only sketch)

The architecture doc §15 lists what belongs in the future control plane. Confirming and tightening:

### Stays inside tenant DB (NEVER moves out)
- All PHI: patients, appointments, encounters, clinical_*, medical_intake, patient_*, prescriptions, orders, documents, messages, consents, devices, deliveries.
- Catalogs (cities, vaccines, etc.) — per-tenant copies.
- Insurance subsystem — per-tenant.
- `staff_members`, `doctor_brand`, `doctor_specialties`, `doctor_insurance_contracts`.

### Moves to control plane (later)
- `tenants` registry: `(id, doctor_name, supabase_project_ref, supabase_url, region, plan, status, schema_version, created_at)`. Stores no PHI; stores tenant routing info.
- `subscriptions` (Stripe-linked).
- `super_admins` + their auth.
- `audit_events` (cross-tenant: who provisioned what; not patient audit).
- `migration_runs` (which migrations applied to which tenant when).
- `app_releases` (mobile app versions, force-update settings cross-tenant defaults).

### Schema-drift detection
Tier 2 sets up `tenant_profile.schema_version`. Build a small Edge Function on the control plane that loops `tenants`, calls each tenant's `tenant_profile` row, and reports drift. Run hourly in production.

### Migration-as-code
All `supabase/migrations/*.sql` are tenant-applicable. New tenant onboarding = create project + `supabase db push --project-ref <new>`. Don't store migration logic in any one tenant DB.

### Edge Functions
Phase 4 (per the original SaaS plan): two patterns possible.
- **(D1)** Deploy identically per tenant — simpler ops, more deployment work, no service-role-key sharing risk.
- **(D2)** One central API service that fans out to tenant DBs via stored service-role keys — cleaner observability, harder security.
- **Recommendation**: ship D1 first; migrate to D2 only when scale demands it (6+ tenants).

### Cost
Pro tier per tenant ($25/mo) + control plane ($25) + Vercel Pro org (~$20). Already documented.

---

## 10. Safe implementation order (small slices, in order)

This is the recommended forward path. Each step is shippable. **Do not skip the hardening blocks.**

### Block A — pre-UI hardening (1 week total)
1. **Day 1**: H1 (admin DELETE on Tier 2 PHI), H2 (revoke anon EXECUTE), H5 (notification_events.created_by nullable), H6 (patient_consents tightening), P3-1 (tenant_profile UNIQUE on doctor_id).
2. **Day 2**: P1-1 (atomic lifecycle RPCs: `start_encounter`, `complete_encounter`, `finalize_clinical_document`).
3. **Day 3**: P1-3 (`apiPaged()` + envelope refactor).
4. **Day 4**: P1-4 (idempotency columns + service layer plumbing).
5. **Day 5**: P1-5 (Zod for the 5 missing methods) + P2-3 (state machines in `lib/states.js`) + P2-7 (realtime helpers).

### Block B — Slice 1: doctor encounter MVP (1.5–2 weeks)
Use everything from Block A. Build `useEncounter`, `useDoctorEncounterTimeline`, the encounter page, the lifecycle buttons.

### Block C — Slice 2: patient documents + signed URLs (1 week)
Includes H9 (storage bucket policy).

### Block D — Slice 3: messaging MVP (1.5 weeks)
Includes H4 (redact-only), realtime, idempotency.

### Block E — Slice 4: consent onboarding (3 days) + Slice 6: tenant config UI (3 days)
These are short and can run in parallel with Slice 5.

### Block F — Slice 5: notification send worker (1.5 weeks)
Edge Function + reminder cron + push registration.

### Block G — Slice 7: RLS automated tests + audit log viewer (1 week)

### Block H — Tier 2.5 deferred items
- `doctor_brand` deprecation (after BrandContext migrated to `tenant_profile`).
- Walk-in encounter path (encounters.appointment_id nullable).
- Clinical note amendment model.
- Prescription refill model.
- Insurance pre-auth model.
- Guardian/dependent model.

### Block I — Tier 3 (control plane, not yet started)
Per architecture doc §15. Follow the SaaS plan unchanged.

---

## Summary — the headline answers

**Is the Tier 2 foundation production-grade?** Yes for the foundation it claims to be. RLS is correct, audit coverage is strong, helpers are right, anon surface is mostly correct. **No P0 findings.**

**Is the product done?** No. The architecture doc is honest about §13 ("What is still missing"). The list above is the engineering version of that.

**What's the riskiest thing to do next?** Building UI on top of services that don't yet enforce the documented mobile contract (envelope, idempotency, lifecycle RPCs). UI built today will need rewriting when those land. Block A solves it in 1 week.

**Where can the user spend time NOW with low risk?**
- Reviewing this report and pushing back where my severity rating is wrong.
- Producing copy / branding / consent legal text in parallel — that's not blocking.
- Validating the SaaS pricing assumption ($25/tenant) with Supabase support.

**Where should the user NOT spend time?**
- Designing the control plane in detail before Tier 2.5 is closed. Premature.
- Building mobile shells. Wait for Slice 5 + envelope.
- Adding more clinical workflows. Tier 2 is enough; ship the existing surface first.
