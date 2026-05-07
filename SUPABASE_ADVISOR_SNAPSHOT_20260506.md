# Supabase Advisor Snapshot — 2026-05-06

> Project: `gezmfmskhmjgnquoyosq`
> Mode: MCP advisor check + live development cleanup applied.

## Inventory

| Item | Count |
|---|---:|
| Public tables | 64 |
| Public functions | 31 |
| Public triggers | 78 |
| Public policies | 242 |
| Public indexes | 230 |

## Structural Checks

- Duplicate live public function overloads: none.
- RLS-enabled tables with zero policies: none.
- Active Edge Functions: `auth`, `appointments`, `consultations`, `patients`, `referrals`, `process-payment`.
- All active Edge Functions currently require JWT.

## Security Advisor Notes

The security advisor still warns about SECURITY DEFINER functions executable through REST. After applying the backend-contract cleanup, these warnings are now limited to intentional public/config RPCs and authenticated lifecycle/helper RPCs:

- **Intentional callable RPCs**: `book_slot`, `start_encounter`, `complete_encounter`, `cancel_encounter`, `finalize_clinical_document`, `void_clinical_document`, public config/brand read RPCs, and helper RPCs used by RLS.
- **Fixed in this pass**: trigger-only functions are no longer reported as REST-callable: `enforce_message_redaction`, `enforce_tier2_status_transition`, `normalize_encounter_from_appointment`, `normalize_medical_intake_workflow`, `prevent_appointment_identity_mutation`, `prevent_system_catalog_mutation`, `propagate_medical_intake_status`.

Applied live development migration:

- Repo file: `supabase/migrations/20260506170000_backend_contract_advisor_cleanup.sql`
- Live migration history: `20260506180442_backend_contract_advisor_cleanup`

This migration revokes REST-callable execute privileges from trigger-only functions and removes duplicate advisor findings for two indexes and the duplicate `reminder_rules` delete policy.

Remaining manual/auth item:

- Leaked password protection is still reported disabled in Supabase Auth.

## Performance Advisor Notes

The performance advisor reports many unindexed foreign keys, especially on newly introduced Tier 2 clinical/messaging/notification tables. This is not an immediate blocker for an empty/low-data tenant, but it should be handled before production data grows.

Important principle:

- Do not blindly add every possible FK index. Add indexes that match actual query paths, or the database will become write-heavy and noisy.

Priority areas for the next DB performance pass:

- Encounter/current-visit reads: `encounters`, `clinical_notes`, `diagnoses`, `prescriptions`, `lab_orders`, `imaging_orders`, `clinical_documents`, `care_tasks`.
- Messaging reads: `conversation_participants`, `messages`, `message_read_receipts`.
- Notification/mobile reads: `notification_events`, `notification_deliveries` (notification send-attempt records), `patient_devices`.

Applied live development migration:

- Repo file: `supabase/migrations/20260506171000_backend_contract_query_path_indexes.sql`
- Live migration history: `20260506180458_backend_contract_query_path_indexes`

This migration adds only query-path indexes that are expected to support the current/future service contracts.

Other advisor notes:

- Duplicate indexes on `doctor_brand.doctor_id` and `tenant_profile.doctor_id` are fixed; the cleanup migration kept the constraint-backed indexes and dropped custom duplicates.
- Duplicate permissive DELETE policy on `reminder_rules` is fixed; the cleanup migration kept the broad Tier 2 admin-delete policy.
- Many unused-index warnings are expected while the app has little/no real traffic. Do not drop those based only on first-run advisor output.
