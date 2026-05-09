-- DoctoLeb backend RLS contract suite.
--
-- Run only against a disposable Supabase branch/local database. This file seeds
-- synthetic rows inside one transaction, impersonates Supabase authenticated
-- users through JWT claim settings, and rolls everything back at the end.
--
-- Example:
--   psql "$BACKEND_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/pgtap_rls.sql

begin;

create extension if not exists pgtap;

set local search_path = public, extensions, pg_temp;

select no_plan();

create temp table rls_ids (
  doctor_auth uuid,
  patient_a_auth uuid,
  patient_b_auth uuid,
  admin_auth uuid,
  doctor_user uuid,
  patient_a_user uuid,
  patient_b_user uuid,
  admin_user uuid,
  doctor uuid,
  patient_a uuid,
  patient_b uuid,
  clinic uuid,
  slot uuid,
  appointment uuid,
  encounter uuid,
  vaccine uuid,
  surgery_type uuid,
  disease uuid,
  family_relation smallint,
  insurance_provider uuid,
  patient_policy uuid,
  conversation uuid,
  message uuid,
  clinical_document uuid,
  notification_event uuid,
  patient_device uuid,
  consent_document uuid
);

insert into rls_ids values (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa8',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9',
  901,
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
  'ffffffff-ffff-4fff-8fff-fffffffffff1',
  'ffffffff-ffff-4fff-8fff-fffffffffff2',
  '99999999-9999-4999-8999-999999999991',
  '99999999-9999-4999-8999-999999999992',
  '99999999-9999-4999-8999-999999999993'
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select doctor_auth, 'authenticated', 'authenticated', 'rls-doctor@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
from rls_ids
union all
select patient_a_auth, 'authenticated', 'authenticated', 'rls-patient-a@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
from rls_ids
union all
select patient_b_auth, 'authenticated', 'authenticated', 'rls-patient-b@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
from rls_ids
union all
select admin_auth, 'authenticated', 'authenticated', 'rls-admin@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
from rls_ids
on conflict (id) do nothing;

insert into public.users (id, auth_user_id, email, role, first_name, last_name, is_active)
select doctor_user, doctor_auth, 'rls-doctor@example.test', 'doctor', 'RLS', 'Doctor', true
from rls_ids
union all
select patient_a_user, patient_a_auth, 'rls-patient-a@example.test', 'patient', 'Patient', 'A', true
from rls_ids
union all
select patient_b_user, patient_b_auth, 'rls-patient-b@example.test', 'patient', 'Patient', 'B', true
from rls_ids
union all
select admin_user, admin_auth, 'rls-admin@example.test', 'admin', 'RLS', 'Admin', true
from rls_ids;

insert into public.doctors (id, user_id, department, specialization, license_number)
select doctor, doctor_user, 'RLS', 'Contract Medicine', 'RLS-DOCTOR-001'
from rls_ids;

insert into public.patients (id, user_id, date_of_birth, sex)
select patient_a, patient_a_user, date '1990-01-01', 'female'
from rls_ids
union all
select patient_b, patient_b_user, date '1991-01-01', 'male'
from rls_ids;

insert into public.clinics (id, name, address)
select clinic, 'RLS Test Clinic', 'Synthetic address'
from rls_ids;

insert into public.secretary_slots (id, doctor_id, clinic_id, date, start_time, end_time, created_by)
select slot, doctor, clinic, current_date + 1, time '09:00', time '09:30', doctor_user
from rls_ids;

insert into public.appointments (id, slot_id, doctor_id, patient_id, booked_by, clinic_id, scheduled_at, duration_minutes, status, reason)
select appointment, slot, doctor, patient_a, patient_a_user, clinic, now() + interval '1 day', 30, 'scheduled', 'RLS appointment'
from rls_ids;

insert into public.encounters (id, appointment_id, patient_id, doctor_id, clinic_id, status, created_by)
select encounter, appointment, patient_a, doctor, clinic, 'planned', doctor_user
from rls_ids;

insert into public.vaccines (id, code, name, is_system, is_active)
select vaccine, 'rls-vaccine', 'RLS Vaccine', false, true
from rls_ids;

insert into public.surgery_types (id, code, name, is_system, is_active)
select surgery_type, 'rls-surgery', 'RLS Surgery', false, true
from rls_ids;

insert into public.diseases (id, code, name, is_system, is_active)
select disease, 'rls-disease', 'RLS Disease', false, true
from rls_ids;

insert into public.family_relations (id, code, name, is_system, is_active)
select family_relation, 'rls-relation', 'RLS Relation', false, true
from rls_ids;

insert into public.medical_intake (patient_id, status, collected_by, notes)
select patient_a, 'draft', doctor_user, 'RLS intake'
from rls_ids;

insert into public.patient_vaccinations (patient_id, vaccine_id, status, given_at, recorded_by)
select patient_a, vaccine, 'received', current_date, doctor_user
from rls_ids;

insert into public.patient_surgeries (patient_id, surgery_type_id, performed_at, recorded_by)
select patient_a, surgery_type, current_date - 30, doctor_user
from rls_ids;

insert into public.patient_diseases (patient_id, disease_id, status, severity, recorded_by)
select patient_a, disease, 'active', 'mild', doctor_user
from rls_ids;

insert into public.patient_family_history (patient_id, relation_id, disease_id, recorded_by)
select patient_a, family_relation, disease, doctor_user
from rls_ids;

insert into public.precheck_forms (patient_id, status, symptoms)
select patient_a, 'draft', 'RLS symptom'
from rls_ids;

insert into public.payments (patient_id, doctor_id, appointment_id, amount, status)
select patient_a, doctor, appointment, 25.00, 'pending'
from rls_ids;

insert into public.insurance_providers (id, code, name, is_system, is_active)
select insurance_provider, 'rls-provider', 'RLS Provider', false, true
from rls_ids;

insert into public.patient_insurance_policies (id, patient_id, provider_id, policy_number, policyholder_name, is_primary)
select patient_policy, patient_a, insurance_provider, 'RLS-POLICY-001', 'Patient A', true
from rls_ids;

insert into public.insurance_claims (patient_id, doctor_id, policy_id, amount, status, created_by, encounter_id)
select patient_a, doctor, patient_policy, 25.00, 'draft', doctor_user, encounter
from rls_ids;

insert into public.clinical_notes (encounter_id, patient_id, doctor_id, author_user_id, note_type, content, visibility)
select encounter, patient_a, doctor, doctor_user, 'general', 'RLS clinical note', 'clinical'
from rls_ids;

insert into public.diagnoses (encounter_id, patient_id, doctor_id, disease_id, diagnosis_type, status, recorded_by)
select encounter, patient_a, doctor, disease, 'primary', 'active', doctor_user
from rls_ids;

insert into public.prescriptions (encounter_id, patient_id, doctor_id, medication_name, prescribed_by)
select encounter, patient_a, doctor, 'RLS medication', doctor_user
from rls_ids;

insert into public.lab_orders (encounter_id, patient_id, doctor_id, title, ordered_by)
select encounter, patient_a, doctor, 'RLS lab', doctor_user
from rls_ids;

insert into public.imaging_orders (encounter_id, patient_id, doctor_id, imaging_type, ordered_by)
select encounter, patient_a, doctor, 'RLS imaging', doctor_user
from rls_ids;

insert into public.clinical_documents (id, patient_id, encounter_id, doctor_id, document_type, title, status, created_by)
select clinical_document, patient_a, encounter, doctor, 'report', 'RLS report', 'draft', doctor_user
from rls_ids;

insert into public.document_attachments (document_id, patient_id, uploaded_by, file_url, file_name, storage_bucket, storage_path)
select clinical_document, patient_a, doctor_user, 'clinical-documents/rls/report.pdf', 'report.pdf', 'clinical-documents', 'rls/report.pdf'
from rls_ids;

insert into public.care_tasks (patient_id, encounter_id, appointment_id, assigned_to, created_by, task_type, title)
select patient_a, encounter, appointment, doctor_user, doctor_user, 'follow_up', 'RLS task'
from rls_ids;

insert into public.conversations (id, patient_id, subject, conversation_type, created_by)
select conversation, patient_a, 'RLS conversation', 'patient_staff', doctor_user
from rls_ids;

insert into public.conversation_participants (conversation_id, user_id, patient_id, role)
select conversation, patient_a_user, patient_a, 'patient'
from rls_ids
union all
select conversation, doctor_user, null, 'doctor'
from rls_ids;

insert into public.messages (id, conversation_id, sender_patient_id, body)
select message, conversation, patient_a, 'RLS message'
from rls_ids;

insert into public.message_attachments (message_id, uploaded_by, file_url, file_name, storage_bucket, storage_path)
select message, doctor_user, 'message-attachments/rls/message.pdf', 'message.pdf', 'message-attachments', 'rls/message.pdf'
from rls_ids;

insert into public.message_read_receipts (message_id, user_id)
select message, doctor_user
from rls_ids;

insert into public.patient_devices (id, patient_id, user_id, platform, push_token, device_label)
select patient_device, patient_a, patient_a_user, 'web', 'rls-device-token-a', 'RLS Browser'
from rls_ids;

insert into public.notification_events (id, user_id, patient_id, title, body, event_type, severity, status, created_by)
select notification_event, patient_a_user, patient_a, 'RLS notification', 'RLS body', 'rls_contract', 'info', 'queued', doctor_user
from rls_ids;

insert into public.notification_deliveries (event_id, user_id, device_id, channel, status)
select notification_event, patient_a_user, patient_device, 'in_app', 'queued'
from rls_ids;

insert into public.consent_documents (id, code, title, body_md, version, audience, is_required, is_active)
select consent_document, 'rls-consent', 'RLS Consent', 'Synthetic consent text', 'v1', 'patient', true, true
from rls_ids;

insert into public.patient_consents (patient_id, consent_document_id, accepted_by_user_id, acceptance_method)
select patient_a, consent_document, patient_a_user, 'patient_self'
from rls_ids;

insert into public.feature_flags (code, name, audience, is_enabled)
values
  ('rls-public-flag', 'RLS Public Flag', 'public', true),
  ('rls-patient-flag', 'RLS Patient Flag', 'patient', true),
  ('rls-staff-flag', 'RLS Staff Flag', 'staff', true),
  ('rls-admin-flag', 'RLS Admin Flag', 'admin', true);

create or replace function pg_temp.use_auth(p_auth_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_auth_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', p_auth_user_id::text,
      'role', 'authenticated',
      'aud', 'authenticated'
    )::text,
    true
  );
end;
$$;

create or replace function pg_temp.visible_count(p_table text, p_row_id uuid)
returns integer
language plpgsql
as $$
declare
  n integer;
begin
  execute format('select count(*)::integer from public.%I where id = $1', p_table)
    into n
    using p_row_id;
  return n;
end;
$$;

create or replace function pg_temp.assert_patient_row_visibility(
  p_table text,
  p_row_id uuid,
  p_label text
)
returns setof text
language plpgsql
as $$
declare
  ids rls_ids%rowtype;
begin
  select * into ids from rls_ids limit 1;

  perform pg_temp.use_auth(ids.patient_a_auth);
  return next is(pg_temp.visible_count(p_table, p_row_id), 1, p_label || ': patient owner can read own row');

  perform pg_temp.use_auth(ids.patient_b_auth);
  return next is(pg_temp.visible_count(p_table, p_row_id), 0, p_label || ': other patient cannot read row');

  perform pg_temp.use_auth(ids.doctor_auth);
  return next is(pg_temp.visible_count(p_table, p_row_id), 1, p_label || ': staff can read row');
end;
$$;

set local role authenticated;

select t.*
from rls_ids, lateral pg_temp.assert_patient_row_visibility('patients', patient_a, 'patients') as t;

select t.*
from rls_ids, lateral pg_temp.assert_patient_row_visibility('appointments', appointment, 'appointments') as t;

select t.*
from rls_ids, lateral pg_temp.assert_patient_row_visibility('encounters', encounter, 'encounters') as t;

select t.*
from rls_ids, lateral pg_temp.assert_patient_row_visibility(
  'medical_intake',
  (select id from public.medical_intake where patient_id = rls_ids.patient_a limit 1),
  'medical_intake'
) as t;

select t.*
from rls_ids, lateral pg_temp.assert_patient_row_visibility(
  'patient_vaccinations',
  (select id from public.patient_vaccinations where patient_id = rls_ids.patient_a limit 1),
  'patient_vaccinations'
) as t;

select t.*
from rls_ids, lateral pg_temp.assert_patient_row_visibility(
  'patient_surgeries',
  (select id from public.patient_surgeries where patient_id = rls_ids.patient_a limit 1),
  'patient_surgeries'
) as t;

select t.*
from rls_ids, lateral pg_temp.assert_patient_row_visibility(
  'patient_diseases',
  (select id from public.patient_diseases where patient_id = rls_ids.patient_a limit 1),
  'patient_diseases'
) as t;

select t.*
from rls_ids, lateral pg_temp.assert_patient_row_visibility(
  'patient_family_history',
  (select id from public.patient_family_history where patient_id = rls_ids.patient_a limit 1),
  'patient_family_history'
) as t;

select t.*
from rls_ids, lateral pg_temp.assert_patient_row_visibility(
  'precheck_forms',
  (select id from public.precheck_forms where patient_id = rls_ids.patient_a limit 1),
  'precheck_forms'
) as t;

select t.*
from rls_ids, lateral pg_temp.assert_patient_row_visibility(
  'payments',
  (select id from public.payments where patient_id = rls_ids.patient_a limit 1),
  'payments'
) as t;

select t.*
from rls_ids, lateral pg_temp.assert_patient_row_visibility(
  'patient_insurance_policies',
  (select id from public.patient_insurance_policies where patient_id = rls_ids.patient_a limit 1),
  'patient_insurance_policies'
) as t;

select t.*
from rls_ids, lateral pg_temp.assert_patient_row_visibility(
  'insurance_claims',
  (select id from public.insurance_claims where patient_id = rls_ids.patient_a limit 1),
  'insurance_claims'
) as t;

select t.*
from rls_ids, lateral pg_temp.assert_patient_row_visibility(
  'clinical_notes',
  (select id from public.clinical_notes where patient_id = rls_ids.patient_a limit 1),
  'clinical_notes'
) as t;

select t.*
from rls_ids, lateral pg_temp.assert_patient_row_visibility(
  'diagnoses',
  (select id from public.diagnoses where patient_id = rls_ids.patient_a limit 1),
  'diagnoses'
) as t;

select t.*
from rls_ids, lateral pg_temp.assert_patient_row_visibility(
  'prescriptions',
  (select id from public.prescriptions where patient_id = rls_ids.patient_a limit 1),
  'prescriptions'
) as t;

select t.*
from rls_ids, lateral pg_temp.assert_patient_row_visibility(
  'lab_orders',
  (select id from public.lab_orders where patient_id = rls_ids.patient_a limit 1),
  'lab_orders'
) as t;

select t.*
from rls_ids, lateral pg_temp.assert_patient_row_visibility(
  'imaging_orders',
  (select id from public.imaging_orders where patient_id = rls_ids.patient_a limit 1),
  'imaging_orders'
) as t;

select t.*
from rls_ids, lateral pg_temp.assert_patient_row_visibility('clinical_documents', clinical_document, 'clinical_documents') as t;

select t.*
from rls_ids, lateral pg_temp.assert_patient_row_visibility(
  'document_attachments',
  (select id from public.document_attachments where document_id = rls_ids.clinical_document limit 1),
  'document_attachments'
) as t;

select t.*
from rls_ids, lateral pg_temp.assert_patient_row_visibility(
  'care_tasks',
  (select id from public.care_tasks where patient_id = rls_ids.patient_a limit 1),
  'care_tasks'
) as t;

select t.*
from rls_ids, lateral pg_temp.assert_patient_row_visibility('conversations', conversation, 'conversations') as t;

select t.*
from rls_ids, lateral pg_temp.assert_patient_row_visibility(
  'conversation_participants',
  (select id from public.conversation_participants where conversation_id = rls_ids.conversation and patient_id = rls_ids.patient_a limit 1),
  'conversation_participants'
) as t;

select t.*
from rls_ids, lateral pg_temp.assert_patient_row_visibility('messages', message, 'messages') as t;

select t.*
from rls_ids, lateral pg_temp.assert_patient_row_visibility(
  'message_attachments',
  (select id from public.message_attachments where message_id = rls_ids.message limit 1),
  'message_attachments'
) as t;

select t.*
from rls_ids, lateral pg_temp.assert_patient_row_visibility(
  'message_read_receipts',
  (select id from public.message_read_receipts where message_id = rls_ids.message limit 1),
  'message_read_receipts'
) as t;

select t.*
from rls_ids, lateral pg_temp.assert_patient_row_visibility('patient_devices', patient_device, 'patient_devices') as t;

select t.*
from rls_ids, lateral pg_temp.assert_patient_row_visibility('notification_events', notification_event, 'notification_events') as t;

select t.*
from rls_ids, lateral pg_temp.assert_patient_row_visibility(
  'notification_deliveries',
  (select id from public.notification_deliveries where event_id = rls_ids.notification_event limit 1),
  'notification_deliveries'
) as t;

select t.*
from rls_ids, lateral pg_temp.assert_patient_row_visibility(
  'patient_consents',
  (select id from public.patient_consents where patient_id = rls_ids.patient_a limit 1),
  'patient_consents'
) as t;

select pg_temp.use_auth(patient_a_auth) from rls_ids;

select is(
  (select count(*)::integer from public.feature_flags where code like 'rls-%'),
  2,
  'feature_flags: patient sees only public + patient audience flags'
);

select pg_temp.use_auth(doctor_auth) from rls_ids;

select is(
  (select count(*)::integer from public.feature_flags where code like 'rls-%'),
  2,
  'feature_flags: staff sees only public + staff audience flags'
);

select pg_temp.use_auth(admin_auth) from rls_ids;

select is(
  (select count(*)::integer from public.feature_flags where code like 'rls-%'),
  2,
  'feature_flags: admin sees only public + admin audience flags'
);

select pg_temp.use_auth(patient_a_auth) from rls_ids;

select throws_ok(
  format(
    $sql$
      insert into public.appointments (doctor_id, patient_id, scheduled_at, duration_minutes, status, reason)
      values (%L::uuid, %L::uuid, now() + interval '2 days', 30, 'scheduled', 'direct insert bypass')
    $sql$,
    (select doctor from rls_ids),
    (select patient_a from rls_ids)
  ),
  'patients cannot directly insert appointments without the canonical book_slot RPC'
);

select pg_temp.use_auth(patient_b_auth) from rls_ids;

select throws_ok(
  format(
    $sql$
      insert into public.messages (conversation_id, sender_patient_id, body)
      values (%L::uuid, %L::uuid, 'spoofed message')
    $sql$,
    (select conversation from rls_ids),
    (select patient_a from rls_ids)
  ),
  'other patients cannot spoof message sender identity'
);

select throws_ok(
  format(
    $sql$
      insert into public.patient_devices (patient_id, user_id, platform, push_token)
      values (%L::uuid, %L::uuid, 'web', 'rls-device-token-spoof')
    $sql$,
    (select patient_a from rls_ids),
    (select patient_b_user from rls_ids)
  ),
  'patients cannot register devices against another patient'
);

select pg_temp.use_auth(doctor_auth) from rls_ids;

select throws_ok(
  format(
    $sql$
      insert into public.clinical_notes (encounter_id, patient_id, doctor_id, author_user_id, note_type, content, visibility)
      values (%L::uuid, %L::uuid, %L::uuid, %L::uuid, 'general', 'spoofed author', 'clinical')
    $sql$,
    (select encounter from rls_ids),
    (select patient_a from rls_ids),
    (select doctor from rls_ids),
    (select patient_a_user from rls_ids)
  ),
  'doctor users cannot spoof clinical note author_user_id'
);

reset role;

select finish();

rollback;
