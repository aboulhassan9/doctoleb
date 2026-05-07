-- Private Storage buckets and RLS policies for PHI-bearing files.
--
-- Database RLS on clinical_documents/message tables does not protect file
-- bytes. These buckets must stay private, with short-lived signed URLs issued
-- only after storage.objects SELECT policies confirm row-level access.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'clinical-documents',
    'clinical-documents',
    false,
    10485760,
    array[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp'
    ]::text[]
  ),
  (
    'message-attachments',
    'message-attachments',
    false,
    10485760,
    array[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp'
    ]::text[]
  )
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types,
    updated_at = now();

drop policy if exists clinical_documents_storage_select on storage.objects;
create policy clinical_documents_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'clinical-documents'
  and exists (
    select 1
    from public.document_attachments as attachment
    where attachment.storage_bucket = storage.objects.bucket_id
      and attachment.storage_path = storage.objects.name
      and coalesce(attachment.is_archived, false) = false
      and (
        (select public.is_staff())
        or attachment.patient_id in (
          select patient.id
          from public.patients as patient
          where patient.user_id = (select public.current_domain_user_id())
        )
      )
  )
);

drop policy if exists clinical_documents_storage_insert on storage.objects;
create policy clinical_documents_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'clinical-documents'
  and (select public.is_staff())
);

drop policy if exists clinical_documents_storage_delete on storage.objects;
create policy clinical_documents_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'clinical-documents'
  and (select public.has_role(array['admin']))
);

drop policy if exists message_attachments_storage_select on storage.objects;
create policy message_attachments_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'message-attachments'
  and exists (
    select 1
    from public.message_attachments as attachment
    join public.messages as message
      on message.id = attachment.message_id
    where attachment.storage_bucket = storage.objects.bucket_id
      and attachment.storage_path = storage.objects.name
      and (select public.can_access_conversation(message.conversation_id))
  )
);

drop policy if exists message_attachments_storage_insert on storage.objects;
create policy message_attachments_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'message-attachments'
  and case
    when coalesce((storage.foldername(name))[1], '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (select public.can_access_conversation(((storage.foldername(name))[1])::uuid))
    else false
  end
);

drop policy if exists message_attachments_storage_delete on storage.objects;
create policy message_attachments_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'message-attachments'
  and (select public.has_role(array['admin']))
);

create index if not exists idx_document_attachments_storage_ref
  on public.document_attachments (storage_bucket, storage_path)
  where storage_bucket is not null and storage_path is not null;

create index if not exists idx_message_attachments_storage_ref
  on public.message_attachments (storage_bucket, storage_path)
  where storage_bucket is not null and storage_path is not null;
