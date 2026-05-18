# Seed Data — RPC Signatures & Service Routing

**Date**: 2026-05-17
**Source**: Live DB `pg_proc` on MCP-accessible reference tenant `gezmfmskhmjgnquoyosq` + `packages/core/services/*.js`

## Verification Boundary For `aaaa` / Assad

The tenant project `rpfhdbtyzuznhfcudrgt` (`aaaa` / Assad) is not directly accessible through Supabase MCP in this workspace. This document verifies the reference tenant and code contracts only. For `aaaa`, RPC availability must be proven through the SaaS tenant migration runner ledger and clinic-ops/API behavior.

## RPCs the Seed Script Must Use (No Direct INSERT)

| RPC | DB Arguments | Service Function | Seed Usage |
|---|---|---|---|
| `book_slot` | `p_slot uuid, p_patient uuid, p_booked_by uuid, p_status text DEFAULT 'scheduled', p_reason text DEFAULT null, p_duration_minutes int DEFAULT null, p_visit_type uuid DEFAULT null` | `slotService.bookSlot()` → `appointmentService.bookFromSlot()` | Create appointments |
| `cancel_appointment` | `appointment_id uuid, cancellation_reason text DEFAULT null` | `appointmentService.cancel()` | Cancel appointments |
| `start_encounter` | `p_appointment uuid, p_chief_complaint text DEFAULT null` | `clinicalService.startEncounter()` | Start encounters from appointments |
| `complete_encounter` | `p_encounter uuid, p_summary text DEFAULT null` | `clinicalService.completeEncounter()` | Complete encounters |
| `cancel_encounter` | `p_encounter uuid, p_reason text DEFAULT null` | `clinicalService.cancelEncounter()` | Cancel encounters |
| `save_clinical_note_draft` | `p_encounter uuid, p_note_type text DEFAULT 'general', p_content text DEFAULT ''` | `clinicalService.saveNoteDraft()` | Save note drafts |
| `discard_clinical_note_draft` | `p_encounter uuid, p_status text DEFAULT 'discarded', p_converted_note uuid DEFAULT null` | `clinicalService.discardNoteDraft()` | Discard or convert active note drafts |
| `void_clinical_document` | `p_document uuid, p_reason text DEFAULT null` | `clinicalService.voidClinicalDocument()` | Void clinical documents |
| `notify_role_event` | `p_role text, p_title text, p_body text, p_event_type text DEFAULT 'system', p_related_type text DEFAULT null, p_related_id uuid DEFAULT null, p_severity text DEFAULT 'info'` | `notificationCoreService.notifyRole()` | Create role-targeted notifications |
| `get_available_slots` | `p_doctor uuid, p_date date` | `slotService.getAvailableSlots()` | Query available slots (read-only) |
| `service_seed_tenant_profile` | `p_tenant_slug text, p_display_name text, p_branding jsonb DEFAULT '{}'` | Edge Function `admin-sync-tenant-config` / provisioning runner | Seed tenant profile during SaaS provisioning |
| `service_seed_first_doctor_admin` | `p_invited_auth_user_id uuid, p_email text, p_display_name text, p_phone text DEFAULT null, p_client_request_id uuid DEFAULT null` | Edge Function `admin-update-first-doctor-admin` / provisioning runner | Seed first doctor admin during SaaS provisioning |

## Service Functions That Use Direct INSERT/UPDATE (Not RPC)

These services use `supabase.from(table).insert/update` directly. The seed script can call these service functions since RLS policies allow authenticated doctor/admin inserts.

| Service | Table | Operation | Notes |
|---|---|---|---|
| `clinicalService.addNote()` | `clinical_notes` | INSERT | Direct insert after draft conversion |
| `clinicalService.addDiagnosis()` | `diagnoses` | INSERT | Direct insert — must come BEFORE prescriptions |
| `clinicalService.addPrescription()` | `prescriptions` | INSERT | Direct insert — requires diagnosis first (trigger enforced) |
| `clinicalService.createOrder()` | `lab_orders`/`imaging_orders` | INSERT | Direct insert |
| `clinicalService.createDocument()` | `clinical_documents` | INSERT | Direct insert |
| `clinicalService.addDocumentAttachment()` | `document_attachments` | INSERT | Direct insert |
| `clinicalService.createCareTask()` | `care_tasks` | INSERT | Direct insert |
| `messagingService.createConversation()` | `conversations` | INSERT | Direct insert |
| `messagingService.addParticipant()` | `conversation_participants` | INSERT | Direct insert |
| `messagingService.sendMessage()` | `messages` | INSERT | Direct insert with `client_request_id` idempotency |
| `messagingService.addAttachment()` | `message_attachments` | INSERT | Direct insert |
| `notificationCoreService.registerDevice()` | `patient_devices` | INSERT | Direct insert |
| `notificationCoreService.createEvent()` | `notification_events` | INSERT | Direct insert |
| `notificationCoreService.createDelivery()` | `notification_deliveries` | INSERT | Direct insert |
| `paymentService.create()` | `payments` | INSERT | Direct insert |
| `precheckService.saveDraft()` / `.submit()` | `precheck_forms` | INSERT | Direct insert through service contract |
| `intakeService.saveDraft()` | `medical_intake` | INSERT/UPDATE | Direct upsert |
| `intakeService.addHistory()` | `patient_vaccinations`/`patient_surgeries`/`patient_diseases`/`patient_family_history` | INSERT | Direct insert per kind |
| `insuranceService.saveDoctorContract()` | `doctor_insurance_contracts` | INSERT/UPSERT | Direct upsert |
| `insuranceService.savePatientPolicy()` | `patient_insurance_policies` | INSERT | Direct insert |
| `insuranceService.createClaim()` | `insurance_claims` | INSERT | Direct insert |
| `documentService.createCertificate()`/`.createReferral()` | `clinical_documents` | INSERT | Direct insert |
| `catalogService.create()`/`.update()` | 9 catalog tables | INSERT/UPDATE | Direct — but `prevent_system_catalog_mutation` trigger blocks modifying `is_system=true` rows |
| `tenantConfigService.updateTenantProfile()` | `tenant_profile` | UPDATE | Direct update |
| `tenantConfigService.updateAppConfig()` | `tenant_app_config` | UPDATE | Direct update |
| `tenantConfigService.acceptConsent()` | `patient_consents` | INSERT | Direct insert |

## Auth Flow

The `handle_auth_user_created` trigger auto-creates tenant-domain profile rows from `auth.users` metadata. Normal patient signup goes through `authService.signUp()`. First doctor/admin creation is a separate SaaS provisioning path and must use `service_seed_first_doctor_admin` / the admin Edge Function, not a browser-side direct insert.

Seed implications:

1. Patient identities should be created through the same auth/service path the patient UI uses.
2. Doctor/admin identities should be created through the SaaS provisioning Edge Function path, because it owns service-role work and doctor profile linking.
3. Staff identities should be created through staff invite Edge Functions.
4. **No direct INSERT** on `users`, `patients`, `doctors`, or `staff_members` from a seed runner unless the documented service function itself performs that insert under the same contract the UI uses.

## Staff Members (Seed Must Use Edge Functions)

The `enforce_staff_members_server_lifecycle` trigger blocks direct INSERT/UPDATE on `staff_members`. Only `service_role` can bypass. Seed must use:

- `staff-invite` Edge Function for creating staff
- `staff-member-disable` Edge Function for deactivating
- `staff-member-reactivate` Edge Function for reactivating

These require service-role key, which the seed script must obtain from control-plane secrets or tenant config.

## Idempotency Keys

Several tables use `client_request_id` with unique partial indexes for idempotency. The seed script must generate unique `client_request_id` values for:

- `appointments` (via `book_slot` RPC)
- `clinical_documents`
- `care_tasks`
- `messages`
- `notification_events`
- `notification_deliveries`
