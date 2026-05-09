-- Revoke browser-exposed hard-delete policies from tenant records.
--
-- Production rule:
--   Clinical, financial, messaging, consent, scheduling, tenant runtime,
--   catalog, and lookup records must use reversible lifecycle states or
--   audited service-role RPCs. Browser sessions must not be able to
--   hard-delete these records directly, even when the user has a clinic
--   admin/staff role.
--
-- Reversibility:
--   This migration only drops RLS DELETE policies. It does not delete data,
--   remove tables, or remove service-role/database-owner capabilities. If a
--   future workflow needs deletion, add a narrow audited RPC with explicit
--   preconditions, postconditions, and compensation semantics.

-- Clinical encounter and chart records.
drop policy if exists tier2_admin_delete on public.encounters;
drop policy if exists tier2_admin_delete on public.clinical_notes;
drop policy if exists tier2_admin_delete on public.diagnoses;
drop policy if exists tier2_admin_delete on public.prescriptions;
drop policy if exists tier2_admin_delete on public.lab_orders;
drop policy if exists tier2_admin_delete on public.imaging_orders;
drop policy if exists tier2_admin_delete on public.care_tasks;
drop policy if exists tier2_admin_delete on public.clinical_documents;
drop policy if exists tier2_admin_delete on public.document_attachments;

-- Medical history and intake records.
drop policy if exists medical_intake_admin_delete on public.medical_intake;
drop policy if exists patient_vaccinations_admin_delete on public.patient_vaccinations;
drop policy if exists patient_surgeries_admin_delete on public.patient_surgeries;
drop policy if exists patient_diseases_admin_delete on public.patient_diseases;
drop policy if exists patient_family_history_admin_delete on public.patient_family_history;

-- Consent and patient-device records.
drop policy if exists tier2_admin_delete on public.consent_documents;
drop policy if exists tier2_admin_delete on public.patient_consents;
drop policy if exists tier2_admin_delete on public.patient_devices;

-- Messaging and notification records.
drop policy if exists tier2_admin_delete on public.conversations;
drop policy if exists tier2_admin_delete on public.conversation_participants;
drop policy if exists tier2_admin_delete on public.messages;
drop policy if exists tier2_admin_delete on public.message_attachments;
drop policy if exists tier2_admin_delete on public.message_read_receipts;
drop policy if exists tier2_admin_delete on public.notification_events;
drop policy if exists tier2_admin_delete on public.notification_deliveries;
drop policy if exists tier2_admin_delete on public.reminder_rules;

-- Financial and insurance records.
drop policy if exists payments_scoped_delete on public.payments;
drop policy if exists insurance_claims_admin_delete on public.insurance_claims;
drop policy if exists patient_insurance_policies_admin_delete on public.patient_insurance_policies;
drop policy if exists doctor_insurance_contracts_admin_delete on public.doctor_insurance_contracts;
drop policy if exists "Staff can delete billable services" on public.billable_services;

-- Scheduling records. Current app behavior uses reversible deactivation.
drop policy if exists secretary_slots_secretary_delete on public.secretary_slots;
drop policy if exists doctor_schedule_templates_staff_delete on public.doctor_schedule_templates;

-- Tenant runtime/config records. Control-plane sync and audited updates should
-- replace destructive browser deletes.
drop policy if exists tier2_admin_delete on public.tenant_profile;
drop policy if exists tier2_admin_delete on public.tenant_app_config;
drop policy if exists tier2_admin_delete on public.feature_flags;
drop policy if exists tier2_admin_delete on public.content_pages;

-- Catalog and lookup records. Current app behavior uses is_active toggles for
-- reversible deactivation/reactivation instead of hard deletes.
drop policy if exists catalog_admin_delete on public.cities;
drop policy if exists catalog_admin_delete on public.blood_groups;
drop policy if exists catalog_admin_delete on public.occupations;
drop policy if exists catalog_admin_delete on public.specialties;
drop policy if exists catalog_admin_delete on public.vaccines;
drop policy if exists catalog_admin_delete on public.diseases;
drop policy if exists catalog_admin_delete on public.surgery_types;
drop policy if exists catalog_admin_delete on public.family_relations;
drop policy if exists catalog_admin_delete on public.visit_types;
drop policy if exists catalog_admin_delete on public.insurance_providers;
drop policy if exists catalog_admin_delete on public.claim_form_templates;
drop policy if exists doctor_specialties_admin_delete on public.doctor_specialties;

comment on schema public is
  'DoctoLeb tenant schema. Browser hard deletes are revoked for protected clinical, financial, messaging, consent, scheduling, tenant runtime, catalog, and lookup records.';
