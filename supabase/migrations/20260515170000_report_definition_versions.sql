-- Advanced clinical report-definition foundation.
-- See docs/plans/clinical-documents-and-medication-catalog.md § 8A.
--
-- This migration adds immutable template versions, safe asset refs,
-- render jobs, and render artifacts. It does not deploy a renderer.
-- Browser code stores structured definitions only; final rendering stays
-- in privileged server-side code.

------------------------------------------------------------------------
-- 1. document_template_versions
------------------------------------------------------------------------

create table if not exists public.document_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.document_templates(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft'
    check (status in ('draft','published','superseded','archived')),
  is_current boolean not null default false,
  schema_version text not null default '2' check (schema_version = '2'),
  authoring_mode text not null
    check (authoring_mode in ('fixed_canvas','flow_document')),
  render_profile text not null
    check (render_profile in ('edge_pdf_lib','gotenberg_html')),
  locale text not null default 'en'
    check (locale in ('en','ar-LB','fr')),
  direction text not null default 'ltr'
    check (direction in ('ltr','rtl')),
  definition jsonb not null
    check (jsonb_typeof(definition) = 'object'),
  definition_checksum text not null
    check (definition_checksum ~ '^[a-f0-9]{64}$'),
  created_by uuid not null references public.users(id) on delete restrict,
  published_by uuid references public.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_template_versions_arabic_renderer_check
    check (locale <> 'ar-LB' or (direction = 'rtl' and render_profile = 'gotenberg_html')),
  constraint document_template_versions_non_arabic_direction_check
    check (locale = 'ar-LB' or direction = 'ltr'),
  constraint document_template_versions_publish_actor_check
    check (status <> 'published' or published_by is not null),
  constraint document_template_versions_publish_time_check
    check (status <> 'published' or published_at is not null),
  constraint document_template_versions_current_status_check
    check (status = 'published' or is_current = false)
);

create unique index if not exists document_template_versions_template_version_unique
  on public.document_template_versions (template_id, version_number);

create unique index if not exists document_template_versions_current_unique
  on public.document_template_versions (template_id, locale)
  where is_current = true and status = 'published';

create index if not exists document_template_versions_template_status_idx
  on public.document_template_versions (template_id, status, created_at desc);

alter table public.document_template_versions enable row level security;

create policy document_template_versions_staff_select on public.document_template_versions
  for select using (
    (select is_staff()) or (select has_role(array['admin']))
  );

create policy document_template_versions_doctor_insert on public.document_template_versions
  for insert with check (
    (select has_role(array['doctor','admin']))
    and created_by = (select current_domain_user_id())
    and (published_by is null or published_by = (select current_domain_user_id()))
  );

create policy document_template_versions_doctor_update on public.document_template_versions
  for update
  using ((select has_role(array['doctor','admin'])))
  with check (
    (select has_role(array['doctor','admin']))
    and (published_by is null or published_by = (select current_domain_user_id()))
  );

create or replace function public.guard_document_template_version_immutability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if OLD.status in ('published','superseded','archived') then
    if NEW.template_id is distinct from OLD.template_id
      or NEW.version_number is distinct from OLD.version_number
      or NEW.schema_version is distinct from OLD.schema_version
      or NEW.authoring_mode is distinct from OLD.authoring_mode
      or NEW.render_profile is distinct from OLD.render_profile
      or NEW.locale is distinct from OLD.locale
      or NEW.direction is distinct from OLD.direction
      or NEW.definition is distinct from OLD.definition
      or NEW.definition_checksum is distinct from OLD.definition_checksum
      or NEW.created_by is distinct from OLD.created_by
      or NEW.published_by is distinct from OLD.published_by
      or NEW.published_at is distinct from OLD.published_at
      or NEW.created_at is distinct from OLD.created_at then
      raise exception 'Published document template versions are immutable.'
        using errcode = '23514';
    end if;

    if NEW.status not in ('published','superseded','archived') then
      raise exception 'Published document template versions cannot return to draft.'
        using errcode = '23514';
    end if;
  end if;

  NEW.updated_at = now();
  return NEW;
end;
$$;

drop trigger if exists document_template_versions_immutability_guard
  on public.document_template_versions;

create trigger document_template_versions_immutability_guard
  before update on public.document_template_versions
  for each row
  execute function public.guard_document_template_version_immutability();

comment on table public.document_template_versions is
  'Immutable versioned report definitions for clinical documents. Definitions are structured JSON, not executable HTML/SQL.';

comment on column public.document_template_versions.definition is
  'ReportDefinition v2 JSON. Validated by packages/core/schemas/reportDefinitions.js before insert/update.';

comment on column public.document_template_versions.definition_checksum is
  'SHA-256 of the canonical report definition JSON, computed by the application/renderer boundary.';

------------------------------------------------------------------------
-- 2. document_template_assets
------------------------------------------------------------------------

create table if not exists public.document_template_assets (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.document_templates(id) on delete cascade,
  template_version_id uuid references public.document_template_versions(id) on delete cascade,
  asset_type text not null
    check (asset_type in ('logo','stamp','signature','background')),
  storage_bucket text not null check (char_length(trim(storage_bucket)) between 1 and 80),
  storage_path text not null
    check (
      char_length(trim(storage_path)) between 1 and 500
      and storage_path not like '/%'
      and storage_path not like '%..%'
      and storage_path not like '%://%'
      and position(chr(92) in storage_path) = 0
    ),
  content_type text not null
    check (content_type in ('image/png','image/jpeg','image/svg+xml')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 2097152),
  checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
  image_width_px integer not null check (image_width_px > 0 and image_width_px <= 4096),
  image_height_px integer not null check (image_height_px > 0 and image_height_px <= 4096),
  scan_status text not null default 'passed' check (scan_status = 'passed'),
  uploaded_by uuid not null references public.users(id) on delete restrict,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_template_assets_owner_check
    check (template_id is not null or template_version_id is not null)
);

create index if not exists document_template_assets_template_idx
  on public.document_template_assets (template_id, asset_type)
  where is_archived = false;

create index if not exists document_template_assets_version_idx
  on public.document_template_assets (template_version_id, asset_type)
  where is_archived = false;

alter table public.document_template_assets enable row level security;

create policy document_template_assets_staff_select on public.document_template_assets
  for select using (
    (select is_staff()) or (select has_role(array['admin']))
  );

create policy document_template_assets_doctor_insert on public.document_template_assets
  for insert with check (
    (select has_role(array['doctor','admin']))
    and uploaded_by = (select current_domain_user_id())
  );

create policy document_template_assets_doctor_update on public.document_template_assets
  for update
  using ((select has_role(array['doctor','admin'])))
  with check ((select has_role(array['doctor','admin'])));

comment on table public.document_template_assets is
  'Safe tenant-local image assets for clinical report templates. Stores validated storage refs, dimensions, scan status, and checksums only; no inline binary content or remote URLs.';

------------------------------------------------------------------------
-- 3. document_render_jobs
------------------------------------------------------------------------

create table if not exists public.document_render_jobs (
  id uuid primary key default gen_random_uuid(),
  clinical_document_id uuid not null references public.clinical_documents(id) on delete cascade,
  template_version_id uuid not null references public.document_template_versions(id) on delete restrict,
  render_profile text not null
    check (render_profile in ('edge_pdf_lib','gotenberg_html')),
  status text not null default 'queued'
    check (status in ('queued','running','succeeded','failed','cancelled')),
  attempts integer not null default 0 check (attempts >= 0 and attempts <= 5),
  requested_by uuid not null references public.users(id) on delete restrict,
  error_code text,
  safe_error_summary text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_render_jobs_terminal_time_check
    check (status not in ('succeeded','failed','cancelled') or completed_at is not null)
);

create index if not exists document_render_jobs_document_idx
  on public.document_render_jobs (clinical_document_id, created_at desc);

create index if not exists document_render_jobs_status_idx
  on public.document_render_jobs (status, created_at)
  where status in ('queued','running');

alter table public.document_render_jobs enable row level security;

create policy document_render_jobs_staff_select on public.document_render_jobs
  for select using (
    (select is_staff()) or (select has_role(array['admin']))
  );

create policy document_render_jobs_doctor_insert on public.document_render_jobs
  for insert with check (
    (select has_role(array['doctor','admin']))
    and requested_by = (select current_domain_user_id())
    and exists (
      select 1
      from public.clinical_documents as cd
      where cd.id = public.document_render_jobs.clinical_document_id
    )
    and exists (
      select 1
      from public.document_template_versions as version
      where version.id = public.document_render_jobs.template_version_id
        and version.status = 'published'
        and version.is_current = true
        and version.render_profile = public.document_render_jobs.render_profile
    )
  );

comment on table public.document_render_jobs is
  'Server-side clinical document render job ledger. Contains safe status/error metadata only; no PHI payload.';

------------------------------------------------------------------------
-- 4. document_render_artifacts
------------------------------------------------------------------------

create table if not exists public.document_render_artifacts (
  id uuid primary key default gen_random_uuid(),
  render_job_id uuid not null references public.document_render_jobs(id) on delete cascade,
  clinical_document_id uuid not null references public.clinical_documents(id) on delete cascade,
  artifact_type text not null
    check (artifact_type in ('pdfa','preview_image','text_extraction','validation_report','encrypted_copy')),
  storage_bucket text not null check (char_length(trim(storage_bucket)) between 1 and 80),
  storage_path text not null
    check (
      char_length(trim(storage_path)) between 1 and 500
      and storage_path not like '/%'
      and storage_path not like '%..%'
      and storage_path not like '%://%'
      and position(chr(92) in storage_path) = 0
    ),
  byte_size integer not null check (byte_size > 0 and byte_size <= 10485760),
  checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
  validation_status text
    check (validation_status in ('not_required','pending','passed','failed')),
  created_at timestamptz not null default now()
);

create unique index if not exists document_render_artifacts_job_type_unique
  on public.document_render_artifacts (render_job_id, artifact_type);

create index if not exists document_render_artifacts_document_idx
  on public.document_render_artifacts (clinical_document_id, created_at desc);

alter table public.document_render_artifacts enable row level security;

create policy document_render_artifacts_staff_select on public.document_render_artifacts
  for select using (
    (select is_staff()) or (select has_role(array['admin']))
  );

comment on table public.document_render_artifacts is
  'Produced PDF/preview/validation artifacts for clinical document rendering. Stores private storage refs only.';
