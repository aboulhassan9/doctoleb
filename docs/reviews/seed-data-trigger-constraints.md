# Seed Data — Trigger & State Machine Constraints

**Date**: 2026-05-17
**Source**: Live DB triggers/checks on MCP-accessible reference tenant `gezmfmskhmjgnquoyosq` + `packages/core/lib/stateMachines.js`

## Verification Boundary For `aaaa` / Assad

This document verifies the reference tenant and code state. The `aaaa` / Assad tenant project `rpfhdbtyzuznhfcudrgt` is not directly accessible through Supabase MCP. For `aaaa`, treat trigger/check/RLS state as verified only through SaaS tenant migration-run evidence plus successful clinic-ops/API behavior.

## State Machines: JS ↔ DB Alignment — ALL MATCH ✅

| Entity | JS States | DB Enforcement | Match |
|---|---|---|---|
| encounter | planned→in_progress/cancelled/entered_in_error; in_progress→completed/cancelled/entered in error | `enforce_tier2_status_transition` trigger | ✅ |
| clinicalDocument | draft→final/void; final→superseded/void | `enforce_tier2_status_transition` trigger | ✅ |
| prescription | draft→active/cancelled; active→completed/stopped/cancelled | `enforce_tier2_status_transition` trigger + `enforce_prescription_requires_diagnosis` | ✅ |
| order (lab/imaging) | draft→ordered/cancelled; ordered→in_progress/resulted/cancelled | `enforce_tier2_status_transition` trigger | ✅ |
| careTask | open→in_progress/done/cancelled; in_progress→done/cancelled | `enforce_tier2_status_transition` trigger | ✅ |
| appointment | scheduled→confirmed/cancelled/no_show; confirmed→pre_check/cancelled/no_show; pre_check→in_consultation/cancelled; in_consultation→completed/cancelled | CHECK constraint only | ✅ |
| payment | pending→completed/failed; completed→refunded | CHECK constraint only | ✅ |
| precheck | draft→submitted; submitted→reviewed; reviewed→completed | CHECK constraint only | ✅ |

## Triggers That Block Direct INSERT (Seed Must Route Through Service/RPC)

| Trigger | Table | Effect | Seed Routing |
|---|---|---|---|
| `handle_auth_user_created` | `auth.users` → `users`+`patients` | Auto-creates user+patient rows from auth metadata | Must use `authService.signUp()` — no direct INSERT on `users`/`patients` |
| `enforce_staff_members_server_lifecycle` | `staff_members` | Blocks direct INSERT/UPDATE (service_role only) | Must use Edge Functions (`staff-invite`, `staff-member-disable`, `staff-member-reactivate`) |
| `prevent_system_catalog_mutation` | 11 catalog tables | Protects `is_system=true` rows from modification | Seed must NOT modify system-seeded catalog rows |
| `guard_default_document_templates` | `document_templates` | Prevents deleting/archiving `is_default=true` templates | Seed must NOT archive default templates |
| `prevent_appointment_identity_mutation` | `appointments` | Makes booking fields (doctor, patient, slot, scheduled_at) immutable after creation | Seed must use `book_slot` RPC for creation; no UPDATE on identity fields |
| `enforce_prescription_requires_diagnosis` | `prescriptions` | Blocks prescription INSERT without linked diagnosis | Must create diagnosis BEFORE prescription |
| `enforce_clinical_note_draft_scope` | `clinical_note_drafts` | Validates draft scope matches encounter | Must use `save_clinical_note_draft` RPC |
| `enforce_message_redaction` | `messages` | Makes redacted messages immutable | Seed must not UPDATE redacted messages |

## Auto-Normalization Triggers (Seed Input Gets Modified)

| Trigger | Table | Effect | Seed Implication |
|---|---|---|---|
| `normalize_encounter_from_appointment` | `encounters` | Auto-fills `clinic_id`, `visit_type_id`, `doctor_id`, `patient_id` from appointment | Seed only needs `appointment_id` + optional `chief_complaint` |
| `normalize_medical_intake_workflow` | `medical_intake` | Auto-sets `completed_at`/`reopened_at`; enforces admin-only reopen | Seed must be doctor/admin to reopen |
| `propagate_medical_intake_status` | `medical_intake` → `patients` | Updates `patients.intake_completed_at` on intake completion | Side effect: patient row gets updated |
| `set_updated_at` | All tables with `updated_at` | Auto-updates `updated_at` on any row change | Seed doesn't need to set `updated_at` manually |

## DB CHECK Constraints (Enum Validation)

| Table | Constraint | Allowed Values |
|---|---|---|
| `appointments` | `appointment_status_check` | scheduled, confirmed, pre_check, in_consultation, completed, cancelled, no_show |
| `appointments` | `appointment_booking_role_check` | doctor, secretary, predoctor, admin, patient, system |
| `payments` | `payment_status_check` | pending, completed, failed, refunded |
| `precheck_forms` | `precheck_forms_status_check` | draft, submitted, reviewed, completed |
| `encounters` | `encounter_status_check` | planned, in_progress, completed, cancelled, entered_in_error |
| `clinical_documents` | `document_type_check` | report, certificate, referral, prescription, insurance_claim, insurance_form, lab_request, lab_result, imaging_result, other |
| `clinical_documents` | `clinical_document_status_check` | draft, final, superseded, void |
| `clinical_notes` | `clinical_note_visibility_check` | clinical, doctor_private |
| `prescriptions` | `prescription_status_check` | draft, active, completed, stopped, cancelled |
| `lab_orders` / `imaging_orders` | `order_status_check` | draft, ordered, in_progress, resulted, cancelled |
| `care_tasks` | `care_task_type_check` | follow_up, call_patient, review_result, insurance, admin, other |
| `care_tasks` | `care_task_priority_check` | low, normal, high, urgent |
| `care_tasks` | `care_task_status_check` | open, in_progress, done, cancelled |
| `diagnoses` | `diagnosis_type_check` | primary, secondary, differential |
| `diagnoses` | `diagnosis_status_check` | active, resolved, ruled_out, suspected |
| `staff_members` | `staff_member_role_check` | secretary, predoctor |
| `conversation_participants` | `participant_role_check` | patient, doctor, secretary, predoctor, admin |
| `feature_flags` | `feature_flag_audience_check` | public, patient, staff, admin |
