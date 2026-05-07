-- Tier 2 index/perf Block A + C.
--
-- Scope:
-- - Add the RLS/query-path indexes identified in TIER2_INDEX_AND_PERF_PLAN.md.
-- - Add the hot conversation-message partial index for non-deleted reads.
-- - Drop two redundant clinical_notes single-column indexes.
--
-- NOTE: TIER2_INDEX_AND_PERF_PLAN.md prefers CONCURRENTLY for production
-- traffic. Supabase MCP/CLI migration application wraps SQL in a transaction,
-- and this tenant has no production rows yet, so this migration uses normal
-- idempotent index DDL. Use a non-transactional manual migration for future
-- high-volume tenant index changes.

create index if not exists idx_messages_sender_user_id
  on public.messages (sender_user_id)
  where sender_user_id is not null;

create index if not exists idx_messages_sender_patient_id
  on public.messages (sender_patient_id)
  where sender_patient_id is not null;

create index if not exists idx_document_attachments_patient_id
  on public.document_attachments (patient_id);

create index if not exists idx_patient_consents_consent_document_id
  on public.patient_consents (consent_document_id);

create index if not exists idx_lab_orders_result_document_id
  on public.lab_orders (result_document_id)
  where result_document_id is not null;

create index if not exists idx_imaging_orders_result_document_id
  on public.imaging_orders (result_document_id)
  where result_document_id is not null;

create index if not exists idx_messages_conversation_created_at_not_deleted
  on public.messages (conversation_id, created_at desc)
  where deleted_at is null;

drop index if exists public.idx_clinical_notes_patient_id;
drop index if exists public.idx_clinical_notes_doctor_id;
