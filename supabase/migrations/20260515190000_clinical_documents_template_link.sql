-- Link a clinical_documents row to the template that produced it.
-- See docs/plans/clinical-documents-and-medication-catalog.md § 8A & decision log.
--
-- Why this matters:
--   The render pipeline used to inverse-map clinical_documents.document_type
--   back to document_templates.template_type ("other" → "custom"). That
--   broke when multiple templates share a type, when a `referral` document
--   was hand-built without a template, and when v1 templates upgrade to v2
--   versioned definitions. Persisting the template id at insert time turns
--   that lookup into a direct FK read.
--
-- Why NULLABLE:
--   Historical documents created before this column exists must keep
--   working. The renderer falls back to its previous "find default template
--   for this document_type" path when template_id is null.
--
-- Why ON DELETE SET NULL:
--   Archiving a template should never cascade-delete the clinical
--   document rows it produced. We want the historical PDF to stay
--   available, and the renderer can fall back via document_type.
--
-- Index:
--   Partial — only non-null rows are interesting. Lets the renderer
--   contextLoader hit it directly without scanning the rest of the table.

alter table public.clinical_documents
  add column if not exists template_id uuid
    references public.document_templates(id) on delete set null;

create index if not exists clinical_documents_template_id_idx
  on public.clinical_documents (template_id)
  where template_id is not null;

comment on column public.clinical_documents.template_id is
  'Optional FK to document_templates row that produced this document. NULL for legacy/hand-built rows. The render Edge Function reads this directly to skip the document_type ⇄ template_type inverse-map lookup.';
