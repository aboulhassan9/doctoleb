# DoctoLeb Tier 2.5 Hardening Plan

> Status: Block A implemented and applied to live Supabase on 2026-05-06.
> Source: Claude senior architecture review after Tier 2 product-core migration.
> Depends on: `TIER2_PRODUCT_ARCHITECTURE_PLAN.md`, live migration `20260506150820_tier2_product_core_foundation`.
> Gate: Block A passed `npm run lint`, `npm run build`, and live DB verification. Proceed to Block B doctor encounter UI only after one final code review.

## 0. Review Verdict

The Tier 2 foundation is structurally sound. Live DB verification found the expected Tier 2 tables, RLS, policies, helper functions, audit coverage, and public-safe tenant config RPC. No P0 PHI-leak findings were reported.

The main risk is not the table design. The main risk is building UI on top of contracts that are not yet strong enough for medical workflows and mobile retry behavior. Tier 2.5 exists to close those gaps before the product grows.

## 1. P1 Findings To Close Before UI

| ID | Finding | Impact | Required fix |
|---|---|---|---|
| P1-1 | No atomic lifecycle RPCs for encounters and clinical documents | Doctors can mutate lifecycle states directly; completed encounters/documents can be moved backward | Add `start_encounter`, `complete_encounter`, `cancel_encounter`, `finalize_clinical_document`, and document revision RPCs with server-side state transitions. |
| P1-2 | Tier 2 PHI tables have no explicit admin DELETE path | Default-deny is safe, but operational purge/offboarding/GDPR workflows have no controlled route | Either add admin DELETE policies or document/build a service-role purge Edge Function. Prefer service-role purge for PHI; admin DELETE only where safe. |
| P1-3 | Service layer does not match `{ data, meta, error }` architecture envelope | Mobile/web clients will consume the wrong shape if UI starts now | Add `apiPaged()` and refactor list methods before UI adopts them. |
| P1-4 | Mobile-retry writes lack idempotency keys | Flaky mobile/offline retries can duplicate messages, notifications, care tasks, and documents | Add `client_request_id uuid` plus partial unique indexes and service payload support. |
| P1-5 | Some service write methods bypass Zod validation | Inconsistent boundary validation and future rot | Add schemas for attachments, participants, deliveries, and care-task updates. |

## 2. P2/P3 Findings To Track

| ID | Finding | Decision |
|---|---|---|
| P2-1 | `doctor_brand` overlaps with `tenant_profile` and `tenant_app_config` | Mark `doctor_brand` deprecated; migrate consumers to tenant config before dropping. |
| P2-2 | `feature_flags` SELECT is open to all authenticated users | Add `audience` and role/platform filtering before sensitive flags are introduced. |
| P2-3 | No state machines for Tier 2 lifecycles | Add shared client state helpers and server-side RPC enforcement. |
| P2-4 | Messages can be edited indefinitely | Prefer redact-only model; avoid silent rewrite of patient-staff history. |
| P2-5 | System-originated notifications need a clean source model | Add nullable `created_by` plus `source` or seed a system user. Prefer nullable + `source`. |
| P2-6 | Consent acceptance can lack a clear actor/method | Add `accepted_by_user_id not null` and `acceptance_method`. |
| P2-7 | Messaging/notification realtime helpers are missing | Add subscription methods before chat UI. |
| P2-8 | Helper function anon EXECUTE surface should be reduced | Revoke anon from internal helper functions; keep only public config RPC anon-readable. |
| P2-9 | `set_updated_at` execute grant should be restricted | Revoke from PUBLIC as defense-in-depth. |
| P3-1 | Enforce one `tenant_profile` per doctor | Verify unique constraint; add if missing. |
| P3-2 | Location geospatial search not indexed | Defer until "near me" location search exists. |
| P3-3 | Message full-text search missing | Defer until messaging MVP proves search need. |
| P3-4 | Audit log has no UI | Defer until compliance/admin UI phase. |
| P3-5 | Tier 2 clinical/messaging/mobile APIs not yet exposed as Edge Functions | Decide before mobile app work. |

## 3. Block A — Pre-UI Hardening

Complete these before Slice 1 doctor encounter UI.

**Implementation status:** completed in repo and live DB.

Applied live migrations:

- `20260506155237_tier2_5_lifecycle_idempotency_hardening`
- `20260506155321_revoke_set_updated_at_execute`
- repo `20260506170000_backend_contract_advisor_cleanup` / live history `20260506180442_backend_contract_advisor_cleanup`
- repo `20260506171000_backend_contract_query_path_indexes` / live history `20260506180458_backend_contract_query_path_indexes`

Verified live:

- 11 expected hardening columns exist.
- 7 lifecycle/redaction functions exist.
- 24 `tier2_admin_delete` policies exist.
- 6 idempotency/tenant uniqueness indexes exist.
- `anon` cannot execute internal helper/lifecycle functions.
- `set_updated_at()` cannot be executed by `anon` or `authenticated` clients.
- Trigger-only functions are no longer reported by Supabase Security Advisor as REST-callable.
- Duplicate index and duplicate `reminder_rules` delete-policy advisor findings are cleared.
- Query-path indexes exist for encounter tabs, messaging participant lookup, notification send-attempt/device lookup, and schedule-by-location reads.

### A1. Database hardening migration

Implemented migrations:

- `supabase/migrations/20260506155237_tier2_5_lifecycle_idempotency_hardening.sql`
- `supabase/migrations/20260506155321_revoke_set_updated_at_execute.sql`

They:

- Revoke anon/public execute from internal helpers:
  - `current_doctor_id()`
  - `current_patient_id()`
  - `can_access_conversation(uuid)`
  - `set_updated_at()`
- Keep anon execute only on `get_public_tenant_app_config()`.
- Add `client_request_id uuid` to:
  - `messages`
  - `notification_events`
  - `notification_deliveries`
  - `care_tasks`
  - `clinical_documents`
- Add partial unique indexes on each `client_request_id where client_request_id is not null`.
- Add `source text` to `notification_events` with allowed values `user`, `system`; make `created_by` nullable for `source = 'system'`.
- Add `accepted_by_user_id not null` and `acceptance_method` to `patient_consents` if live data allows; otherwise migrate in two steps.
- Add or verify `tenant_profile.doctor_id` unique.
- Add redact-only fields for messaging:
  - `redacted_at timestamptz`
  - `redacted_by uuid references users(id)`
  - Consider `original_body` only if legal/product decides to preserve redacted text in a separate restricted table.
- Add lifecycle RPCs:
  - `start_encounter(p_appointment uuid, p_chief_complaint text default null)`
  - `complete_encounter(p_encounter uuid, p_summary text default null)`
  - `cancel_encounter(p_encounter uuid, p_reason text)`
  - `finalize_clinical_document(p_document uuid)`
  - `void_clinical_document(p_document uuid, p_reason text)`
- RPCs must be `SECURITY DEFINER`, use `SET search_path = public, pg_temp`, validate caller role, validate scoped doctor ownership, and enforce allowed transitions.
- Add triggers that reject illegal lifecycle transitions and enforce redact-only message changes.

### A2. State machine module

Implemented in existing shared module `src/lib/stateMachines.js`:

- `ENCOUNTER_STATUS`
- `CLINICAL_DOCUMENT_STATUS`
- `ORDER_STATUS`
- `PRESCRIPTION_STATUS`
- `CARE_TASK_STATUS`
- `canTransitionEncounter(current, target)`
- `canTransitionClinicalDocument(current, target)`
- `canTransitionOrder(current, target)`
- `canTransitionPrescription(current, target)`
- `canTransitionCareTask(current, target)`

Client state machines are UX helpers only. The database/RPC layer must remain authoritative.

### A3. API envelope

Implemented paged API helper while preserving current write semantics:

- Keep `apiCall()` for single-row reads/writes where no pagination is needed.
- Add `apiPaged(query, { page, pageSize })` or equivalent.
- Output shape:

```js
{
  data,
  meta: {
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages
    }
  },
  error
}
```

Refactored Tier 2 list methods before UI consumes them:

- `clinicalService.getEncountersByPatient`
- `clinicalService.getNotes`
- `clinicalService.getDiagnoses`
- `clinicalService.getPrescriptions`
- `clinicalService.getOrders`
- `clinicalService.getDocuments`
- `clinicalService.getCareTasks`
- `messagingService.getConversations`
- `messagingService.getMessages`
- `notificationCoreService.getDevices`
- `notificationCoreService.getEvents`
- `notificationCoreService.getDeliveries`
- `tenantConfigService.getFeatureFlags`
- `tenantConfigService.getContentPages`
- `tenantConfigService.getConsentDocuments`
- `tenantConfigService.getPatientConsents`

### A4. Zod validation completion

Added and wired schemas for:

- `documentAttachmentSchema`
- `conversationParticipantSchema`
- `messageAttachmentSchema`
- `notificationDeliverySchema`
- `careTaskUpdateSchema`

Methods requiring validation:

- `clinicalService.addDocumentAttachment`
- `clinicalService.updateCareTask`
- `messagingService.addParticipant`
- `messagingService.addAttachment`
- `notificationCoreService.createDelivery`
- `notificationCoreService.updateDelivery`

### A5. Realtime helpers

Added:

- `messagingService.subscribeToConversation(conversationId, callback)`
- `notificationCoreService.subscribeToEvents(userId, callback)`
- `notificationCoreService.subscribeToDeliveries(userId, callback)`

Mirror the existing subscription style in `notificationService`.

### A6. Advisor cleanup and query-path indexes

Implemented migrations:

- `supabase/migrations/20260506170000_backend_contract_advisor_cleanup.sql`
- `supabase/migrations/20260506171000_backend_contract_query_path_indexes.sql`

They:

- Revoke REST-callable execute privileges from trigger-only `SECURITY DEFINER` functions.
- Keep intentional public/config RPCs and authenticated lifecycle RPCs callable.
- Drop duplicate custom unique indexes while keeping constraint-backed unique indexes.
- Drop the duplicate `reminder_rules_admin_delete` policy while keeping the broad Tier 2 admin-delete policy.
- Add narrow, query-driven indexes instead of blindly indexing every advisor-reported FK.

## 4. Block B — Doctor Encounter MVP

Start only after Block A passes lint/build and live DB verification.

Deliver:

- Feature hook: `useEncounter(appointmentIdOrEncounterId)`.
- Feature hook: `useDoctorEncounterTimeline(patientId)`.
- Doctor page for starting/resuming an encounter.
- Tabs:
  - patient context
  - notes
  - diagnoses
  - prescriptions
  - lab/imaging orders
  - care tasks
  - documents
- Start/complete lifecycle buttons call RPCs, not raw table updates.
- Notes auto-save or explicit save with clear draft state.
- Complete encounter requires confirmation and summary.

## 5. Block C — Patient Documents

Deliver:

- `documentService` if `clinicalService` becomes too broad.
- Patient document list/detail.
- Signed URL strategy for Supabase Storage.
- Storage policies for clinical document files.
- Doctor/secretary document finalization flow.

## 6. Block D — Messaging MVP

Deliver:

- Conversation list for patient and staff.
- Thread view.
- Send message with idempotency key.
- Read receipts.
- Realtime updates.
- Redact-only message correction model.
- Unread count hook for navigation badges.

## 7. Block E — Consent And Tenant Config

Deliver:

- Patient consent onboarding.
- Re-prompt on new consent document version.
- Tenant/mobile config admin UI.
- Move branding consumers toward `tenant_profile` + `tenant_app_config`.
- Mark `doctor_brand` deprecated in docs and code comments.

## 8. Block F — Notification Delivery Worker

Deliver:

- Edge Function that processes queued `notification_events`.
- Creates `notification_deliveries`.
- Supports retry/failure recording.
- Integrates push provider later.
- Reminder generator using `reminder_rules`.

## 9. Block G — Automated RLS Tests

Add DB/security tests for:

- Patient cannot read another patient's encounters, documents, messages, devices, consents.
- Secretary cannot create diagnoses/prescriptions.
- Predoctor/nurse boundaries match intended workflow.
- Anon can only read public config RPC.
- Staff cannot spoof sender/recipient/author fields.
- Direct appointment insert remains denied.

## 10. Deferred Tier 2.5 Items

These should not block Block A, but should be tracked:

- Walk-in encounter path.
- Guardian/dependent patient model.
- Clinical note amendments/co-signing.
- Prescription refill model.
- Insurance pre-authorization.
- Multi-policy insurance claim splits.
- Location geospatial search.
- Message full-text search.
- Audit log viewer.
- Control-plane schema drift automation.

## 11. Release Gate

Before starting large UI work:

- `npm run lint` passes.
- `npm run build` passes.
- New migration applied to a branch or approved live target.
- Live verification confirms helper grants, idempotency columns/indexes, and lifecycle RPCs.
- Manual smoke verifies existing booking and sign-in flows are not broken.

## 12. Engineering Notes

- Do not add a generic abstraction before the second/third concrete use case.
- Do not split services purely for aesthetics; split only where review/runtime pain appears.
- Do not remove `doctor_brand` until every current consumer is migrated.
- Do not add a control-plane table inside this tenant DB.
- Keep the tenant silo model.
- Keep PHI inside the tenant DB.
- Prefer additive migrations with explicit backfill and safe defaults.
- Any status/lifecycle change must be enforced in DB/RPC, not only in React.
