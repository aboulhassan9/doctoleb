# Tier 2 Review — Addendum (post Tier 2.5)

> **Companion to**: `TIER2_REVIEW.md` (the original 10-section review).
> **Date**: 2026-05-07.
> **Purpose**: reconcile every P1 / P2 / P3 finding against what was actually shipped in:
> - `20260506155237_tier2_5_lifecycle_idempotency_hardening.sql`
> - `20260506155321_revoke_set_updated_at_execute.sql`
> - `20260506170000_backend_contract_advisor_cleanup.sql`
> - `20260506190000_legacy_compatibility_burndown.sql`
> Also: surface any new findings observed while verifying closure.
> **Verdict**: **all P1 closed. Original P2 items are closed after Block F follow-up. 1 of 5 P3 closed.** Remaining work is defense-in-depth/ops: branch/local execution of the RLS test suite, purge orchestration, and the deferred document-type role matrix.

---

## §A · Status reconciliation

Legend: ✅ closed · ⚠️ partial · ❌ open · ⏸ deferred (intentional).

### P1 — high

| # | Title | Status | Evidence |
|---|---|---|---|
| P1-1 | Atomic lifecycle RPCs missing | ✅ closed | `start_encounter`, `complete_encounter`, `cancel_encounter`, `finalize_clinical_document`, `void_clinical_document` shipped (Tier 2.5 lines 290–630). All `SECURITY DEFINER`, `REVOKE FROM public, anon`, `GRANT TO authenticated, service_role`. `enforce_tier2_status_transition` BEFORE-UPDATE trigger covers encounters, clinical_documents, lab_orders, imaging_orders, prescriptions, care_tasks (lines 162–243). |
| P1-2 | No DELETE policies on Tier 2 PHI | ✅ closed | `tier2_admin_delete` policy added to all 24 Tier 2 tables (Tier 2.5 lines 119–156). Policy: `using ((select public.has_role(array['admin'])))`. |
| P1-3 | Service envelope `{data, meta, error}` not implemented | ✅ closed | `apiPaged()` in `src/services/api.js` lines 24–60 returns the documented envelope. All Tier 2 list methods (`clinical.js`, `messaging.js`, `notificationCore.js`, `tenantConfig.js`) use it. |
| P1-4 | No idempotency keys on mobile-retried writes | ✅ closed | `client_request_id uuid` added to `messages`, `notification_events`, `notification_deliveries`, `care_tasks`, `clinical_documents` (Tier 2.5 lines 25–110). Five partial-unique indexes (`WHERE client_request_id IS NOT NULL`). |
| P1-5 | Five service methods missing Zod validation | ✅ closed | All five schemas exist in `src/schemas/index.js` and are wired: `documentAttachmentSchema`, `careTaskUpdateSchema`, `conversationParticipantSchema`, `messageAttachmentSchema`, `notificationDeliverySchema`. |

### P2 — medium

| # | Title | Status | Evidence |
|---|---|---|---|
| P2-1 | `doctor_brand` redundant with `tenant_profile`/`tenant_app_config` | ✅ closed | `drop table if exists public.doctor_brand cascade` (burndown line 266). `get_public_tenant_app_config` rewritten to remove the `doctor_brand` join (burndown lines 45–107). |
| P2-2 | `feature_flags` SELECT open to all authenticated; flag-name leak | ✅ closed | `20260507010000_feature_flags_audience.sql` adds `audience` (`public`, `patient`, `staff`, `admin`) and replaces the broad authenticated SELECT with audience-gated RLS. `tenantConfigService.getFeatureFlags()` can filter by audience. |
| P2-3 | No state-machine helpers for Tier 2 lifecycles | ✅ closed | `src/lib/stateMachines.js` exposes `canTransition*` for `encounter`, `clinicalDocument`, `order`, `prescription`, `careTask`. State maps match the DB trigger 1:1. `clinicalService.transitionCareTask` and `clinicalService.updateEncounter` use `assertTransition` server-side proxy (clinical.js lines 461–478, 179–181). |
| P2-4 | `messages.UPDATE` allows silent edits | ✅ closed | `enforce_message_redaction` BEFORE-UPDATE trigger blocks body edits and forces redact-only. The scrub model is now explicitly documented in `CLAUDE.md`: original content is unrecoverable after redaction. |
| P2-5 | `notification_events.created_by NOT NULL` blocks system events | ✅ closed | Column nullable + `source` column with check `source = 'system' OR created_by IS NOT NULL` (Tier 2.5 lines 30–54). |
| P2-6 | `patient_consents.accepted_by_user_id` may be NULL | ✅ closed | Backfilled then `SET NOT NULL` (Tier 2.5 lines 73–90). `acceptance_method` column added with check `IN ('patient_self','staff_assisted','kiosk')` (lines 70–71). |
| P2-7 | No realtime helpers in `messagingService` / `notificationCoreService` | ✅ closed | `messagingService.subscribeToConversation` exists (`messaging.js:149`). `notificationCoreService.subscribeToEvents` / `subscribeToNotifications` / `subscribeToDeliveries` exist (`notificationCore.js:231–280`). |
| P2-8 | `current_doctor_id` / `current_patient_id` / `can_access_conversation` granted to anon | ✅ closed | `revoke execute … from anon, public` (Tier 2.5 lines 11–13). Re-granted only to `authenticated, service_role`. |
| P2-9 | `set_updated_at` ACL leak | ✅ closed | `revoke execute on function public.set_updated_at() from anon, public, authenticated, service_role` (`20260506155321_…`). Trigger functions don't need EXECUTE; trigger fires under owner privileges. Defense-in-depth applied. |

### P3 — low

| # | Title | Status |
|---|---|---|
| P3-1 | `tenant_profile.doctor_id` UNIQUE | ✅ closed (table-level `UNIQUE` on column already enforces; the duplicate `idx_tenant_profile_doctor_id_unique` was correctly dropped in advisor cleanup) |
| P3-2 | GIST index on clinic lat/lng | ⏸ deferred (no "near me" feature yet) |
| P3-3 | Messages full-text search | ⏸ deferred |
| P3-4 | `audit_log` UI | ⏸ deferred |
| P3-5 | Edge Function parity for clinical/messaging/notifications | ⏸ deferred (mobile not yet in scope; retired V1 source removed from repo) |

### Hardening list (§5 of original review)

| # | Item | Status |
|---|---|---|
| H1 | Admin DELETE on Tier 2 PHI | ✅ closed (= P1-2) |
| H2 | Revoke anon EXECUTE on identity helpers | ✅ closed (= P2-8) |
| H3 | `feature_flags` audience-gated SELECT | ✅ closed (= P2-2) |
| H4 | Messages redact-only | ✅ closed (= P2-4; scrub model documented) |
| H5 | `notification_events.created_by` nullable | ✅ closed (= P2-5) |
| H6 | `patient_consents` tightening | ✅ closed (= P2-6) |
| H7 | RLS pgTAP test suite | 🟡 **scaffolded** (`supabase/tests/pgtap_rls.sql`; branch/local execution pending) |
| H8 | "Purge a patient" Edge Function | ❌ **open** (admin DELETE policy exists; orchestration does not) |
| H9 | Storage bucket policies + signed-URL discipline | ✅ closed (`20260507020000_storage_rls_and_private_buckets.sql` + `storageService` signed URL helpers) |

---

## §B · New findings from reading the post-review migrations

### B-1 · `finalize_clinical_document` over-permits secretaries (NEW · P2)

`finalize_clinical_document` (Tier 2.5 line 524) admits `doctor`, `secretary`, `admin`. Rationale: secretaries finalize insurance forms, certificates, lab requests. **But**: the RPC does **not** restrict by `document_type`. A secretary can therefore finalize a `document_type = 'prescription'` or `document_type = 'report'` (clinical content normally doctor-only).

In the current single-doctor, single-secretary tenant, this is a small abuse surface — an insider risk, not an external one. It becomes meaningful when:

- multi-staff tenants exist (Phase 2+);
- compliance audit asks "who finalized this prescription" and the answer is the secretary.

**Recommendation (defer until multi-staff)**: extend the RPC with a per-document-type role matrix:

```sql
-- pseudo-code
case v_document.document_type
  when 'prescription', 'report', 'imaging_result', 'lab_result' then
    if not public.has_role(array['doctor', 'admin']) then …
  when 'certificate', 'referral', 'lab_request' then
    if not public.has_role(array['doctor', 'admin']) then …
  when 'insurance_claim', 'insurance_form' then
    if not public.has_role(array['doctor', 'secretary', 'admin']) then …
  else -- 'other'
    if not public.has_role(array['doctor', 'secretary', 'admin']) then …
end case;
```

Audit-log already tracks `clinical_documents` updates (foundation lines 757–789), so the trail exists; tightening the gate adds prevention.

### B-2 · `enforce_message_redaction` overwrites `body` in place (NEW · P2)

The redaction trigger sets `new.body := '[redacted]'` (Tier 2.5 line 273). Original content is lost. Audit triggers are intentionally OFF for messaging tables (foundation lines 757–789 explicitly exclude `messages`, `message_attachments`, `message_read_receipts`).

Implications:

- **Scrub model** (current): privacy-favoring. Once redacted, the original is gone forever, even from admins. Consistent with "right to be forgotten" thinking.
- **Compliance model** (alternative): regulators sometimes want the original retained but invisible to non-admins.

Both are defensible; the chosen one should be documented. If the answer is "scrub" (current), add a one-line comment to that effect in the migration. If "compliance," add an admin-readable shadow:

```sql
-- compliance variant (NOT recommended for first launch)
create table public.messages_redaction_log (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete restrict,
  original_body text not null,
  redacted_at timestamptz not null,
  redacted_by uuid not null references public.users(id) on delete restrict
);
-- + RLS: admin-only SELECT; INSERT only via the redaction trigger.
```

**Action**: confirm with the product owner which model is intended; document the choice in `CLAUDE.md` rule 3 (the soft-delete rule already lives there).

### B-3 · `get_public_tenant_app_config` v2 hardcodes color fallbacks (NEW · P3)

Burndown line 87–88:

```sql
coalesce(tac.primary_color, '#0891b2')
coalesce(tac.secondary_color, '#0f172a')
```

These colors are baked into the SQL. If a tenant has no `tenant_app_config` row, the pre-login UI gets cyan / slate. Fine for now; will be a paper-cut when DoctoLeb's marketing brand colors change. Move to a config table or document the choice in `CLAUDE.md`.

### B-4 · Trigger-only functions are correctly walled off (NEW · positive)

The advisor cleanup migration explicitly REVOKEs EXECUTE on every BEFORE/AFTER trigger function from `public, anon, authenticated`:

- `enforce_message_redaction`
- `enforce_tier2_status_transition`
- `normalize_encounter_from_appointment`
- `normalize_medical_intake_workflow`
- `prevent_appointment_identity_mutation`
- `prevent_system_catalog_mutation`
- `propagate_medical_intake_status`

These functions cannot be called as RPC. This closes a class of "user calls a trigger function with crafted NEW.* row" attacks. ✅ Defensive design, called out as positive evidence.

### B-5 · `notify_role_event` enforces patient → staff scoping correctly (NEW · positive)

Burndown lines 184–196 check that, when caller is a patient, the notification:

- targets `('doctor', 'predoctor', 'secretary')` (no patient → patient broadcast);
- has `event_type = 'appointment'`;
- references an appointment whose `patients.user_id` equals the caller's user id.

Anything else from a patient is rejected. Closes the obvious "spam-the-clinic" / "spoof-other-patient" abuses. ✅

### B-6 · Legacy dashboard views removed after source audit (NEW · closed)

The temporary `doctor_dashboard_summary`, `doctor_patients`, and `upcoming_appointments` views were not consumed by executable code. They were dropped by `20260507091235_drop_legacy_helpers_and_views.sql` together with the unused display helper RPCs `get_user_full_name`, `get_next_appointment`, and `get_doctor_info`.

---

## §C · Remaining open items, ranked

### C-1 · H9 — Storage RLS + signed URLs · ✅ closed

`20260507020000_storage_rls_and_private_buckets.sql` creates private `clinical-documents` and `message-attachments` buckets, adds `storage.objects` SELECT/INSERT/DELETE policies, and indexes attachment storage references. `storageService` wraps `createSignedUrl(..., 300)` with a bounded TTL, and `clinicalService`, `documentService`, and `messagingService` expose signed URL helpers.

Policy SQL was transaction-validated through Supabase MCP on the development project. Full branch/local replay is still recommended before ERD export or SaaS onboarding.

### C-2 · H7 — RLS automated tests · **defense-in-depth gap**

72 RLS policies now have a pgTAP scaffold in `supabase/tests/pgtap_rls.sql`, wired into `npm run test:backend-db-contract` when `BACKEND_TEST_DATABASE_URL` is set. It seeds synthetic patient A / patient B / doctor / admin identities in a transaction and asserts "patient B can't read patient A's encounter / clinical_note / diagnosis / prescription / lab_order / imaging_order / clinical_document / care_task / message / notification / consent / device", plus spoof/bypass write checks.

Remaining work: run it on a Supabase branch/local DB and wire that database URL into CI so the scaffold becomes a hard merge gate.

### C-3 · P2-2 / H3 — `feature_flags` audience leak · ✅ closed

Closed by `20260507010000_feature_flags_audience.sql`. The old broad authenticated SELECT policy is replaced by an audience-gated policy.

### C-4 · H8 — "Purge a patient" Edge Function · **operational gap**

Admin DELETE policies exist (P1-2 closed), but no orchestration. A right-to-be-forgotten request today would require a human to write a multi-table DELETE in the right order respecting `RESTRICT` FKs.

Build a small Edge Function `purge-patient` that:

1. Takes `patient_id` + admin JWT.
2. Verifies caller has role `admin`.
3. Soft-archives everything (sets `is_archived = true` cascading) — **default**.
4. Has a separate `--hard` flag that runs DELETE in dependency order (deliveries → events → messages → receipts → attachments → orders → prescriptions → diagnoses → notes → encounters → consents → devices → policies → claims → patient).
5. Writes an `audit_log` row tagged `'purge'`.

~1 day. Not blocking first launch (compliance request frequency is low).

### C-5 · B-1 — `finalize_clinical_document` document-type role matrix

Defer until multi-staff tenants. Tracked in `BACKLOG.md`.

### C-6 · B-2 — Document message-redaction model · ✅ closed

`CLAUDE.md` now documents scrub mode: `messages.body` is overwritten with `[redacted]`; original content is unrecoverable, even by admins.

---

## §D · Recommended next slice — Block A residue (½ week)

The original review's "Block A — pre-UI hardening (1 week)" is mostly done. What remains:

1. **C-2** — branch/local execution + CI wiring for the RLS pgTAP suite. *(0.5–1 day)*
2. **H8** — purge orchestration Edge Function/runbook. *(1 day)*
3. **B-1** — document-type role matrix for clinical document finalization. *(defer until multi-staff or implement before prescriptions go live)*

Block B (Slice 1: Doctor encounter MVP) is no longer blocked by H9/H3/C-6. The lifecycle RPCs, idempotency, redaction guard, state machines, pagination envelope, Zod coverage, Storage RLS, and signed URL discipline are in place.

C-4 (purge function) and B-1 (document-type role matrix) can run in parallel or after first launch. Neither blocks UI.

---

## §E · Summary — the headline updates

**What changed since the original review (2026-05-06 → 2026-05-07)?**

Tier 2.5 hardening + advisor cleanup + legacy burndown + Block F follow-up closed every original P1 and P2 finding. The codebase is materially safer than when the review was written.

**What's left that actually matters for security?**

The highest remaining security work is automated proof: running the branch/local RLS test suite and making it a CI gate. Storage RLS is now in repo and transaction-validated, but should still be verified through a full branch/local replay before any document UI is released.

**What's left that matters for ops?**

Purge orchestration (1 day), branch/local pgTAP/RLS execution + CI wiring (0.5–1 day), and the document-type role matrix when multi-staff prescribing becomes real. Order them by impact, not by alphabet.

**What's no longer worth re-litigating?**

P1-1 through P1-5, P2-1 through P2-9, P3-1, H1, H2, H3, H4 (scrub model documented), H5, H6, and H9. Move on.

---

**End of TIER2_REVIEW_ADDENDUM.md.**
