-- Clinical document templates + medication catalog foundation.
-- See docs/plans/clinical-documents-and-medication-catalog.md § 14 Slice 1.
--
-- This migration:
--   1. Creates `document_templates` (per-tenant library of reusable
--      clinical-document layouts).
--   2. Creates `medication_catalog` (per-tenant drug list that grows
--      from doctor usage).
--   3. Adds `prescriptions.medication_catalog_id` (nullable FK).
--   4. Adds `upsert_medication_catalog_entry(text) returns uuid` RPC
--      for the slice-8 fire-and-forget auto-insert.
--   5. Adds a trigger that protects `is_default = true` templates
--      from DELETE and from archive.
--
-- RLS uses the existing helpers `is_staff()`, `has_role(text[])`, and
-- `current_domain_user_id()` defined in
-- 20260506150820_tier2_product_core_foundation.sql.
--
-- Soft-delete pattern is `is_archived` / `archived_at` / `archived_by`,
-- matching every other clinical table.

------------------------------------------------------------------------
-- 1. document_templates
------------------------------------------------------------------------

create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 240),
  template_type text not null
    check (template_type in ('referral','report','certificate','lab_request','prescription','custom')),
  description text,
  sections jsonb not null default '[]'::jsonb
    check (jsonb_typeof(sections) = 'array'),
  is_default boolean not null default false,
  created_by uuid not null references public.users(id) on delete restrict,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One active default template per type.
create unique index if not exists document_templates_default_per_type_unique
  on public.document_templates (template_type)
  where is_default = true and is_archived = false;

-- Hot lookup: active templates of a type for the editor list view.
create index if not exists document_templates_type_active_idx
  on public.document_templates (template_type)
  where is_archived = false;

alter table public.document_templates enable row level security;

create policy document_templates_staff_select on public.document_templates
  for select using (
    (select is_staff()) or (select has_role(array['admin']))
  );

create policy document_templates_doctor_insert on public.document_templates
  for insert with check (
    (select has_role(array['doctor','admin']))
    and created_by = (select current_domain_user_id())
  );

create policy document_templates_doctor_update on public.document_templates
  for update
  using ((select has_role(array['doctor','admin'])))
  with check ((select has_role(array['doctor','admin'])));

-- Trigger that protects is_default=true rows from delete + from being
-- archived without first clearing is_default.
create or replace function public.guard_default_document_templates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and old.is_default then
    raise exception 'Cannot delete a default template. Clear is_default first.'
      using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE'
     and old.is_default
     and new.is_default = true
     and new.is_archived = true
     and old.is_archived = false then
    raise exception 'Cannot archive a default template. Clear is_default first.'
      using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists document_templates_default_guard on public.document_templates;
create trigger document_templates_default_guard
before delete or update on public.document_templates
for each row execute function public.guard_default_document_templates();

comment on table public.document_templates is
  'Per-tenant library of reusable clinical-document layouts. Renders to PDF via the render-clinical-document Edge Function. See docs/plans/clinical-documents-and-medication-catalog.md.';

comment on column public.document_templates.sections is
  'JSONB array of {key, title, fields:[{key,label,type,...}]} objects. Schema enforced by documentTemplateCreateSchema in packages/core/schemas/documentTemplates.js.';

------------------------------------------------------------------------
-- 2. medication_catalog
------------------------------------------------------------------------

create table if not exists public.medication_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 240),
  generic_name text,
  dosage_forms text[] not null default '{}'::text[],
  common_dosages text[] not null default '{}'::text[],
  notes text,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Case-insensitive uniqueness on the active set. Slice 8's
-- auto-insert relies on the partial index for the dedup check.
create unique index if not exists medication_catalog_name_active_unique
  on public.medication_catalog (lower(name))
  where is_archived = false;

-- Hot lookup: ILIKE 'asp%' for the autocomplete.
create index if not exists medication_catalog_name_search_idx
  on public.medication_catalog (lower(name) text_pattern_ops)
  where is_archived = false;

alter table public.medication_catalog enable row level security;

create policy medication_catalog_staff_select on public.medication_catalog
  for select using (
    (select is_staff()) or (select has_role(array['admin']))
  );

create policy medication_catalog_doctor_insert on public.medication_catalog
  for insert with check (
    (select has_role(array['doctor','admin']))
  );

create policy medication_catalog_doctor_update on public.medication_catalog
  for update
  using ((select has_role(array['doctor','admin'])))
  with check ((select has_role(array['doctor','admin'])));

comment on table public.medication_catalog is
  'Per-tenant medication catalog. Seeded with ~50 entries on tenant provision (slice 3) and self-populates from doctor usage (slice 8) via the upsert_medication_catalog_entry RPC.';

------------------------------------------------------------------------
-- 3. prescriptions.medication_catalog_id
------------------------------------------------------------------------

alter table public.prescriptions
  add column if not exists medication_catalog_id uuid
    references public.medication_catalog(id) on delete set null;

create index if not exists prescriptions_medication_catalog_id_idx
  on public.prescriptions (medication_catalog_id)
  where medication_catalog_id is not null;

comment on column public.prescriptions.medication_catalog_id is
  'Optional link to the medication catalog entry the doctor selected. Nullable so historical free-text prescriptions stay valid.';

------------------------------------------------------------------------
-- 4. upsert_medication_catalog_entry RPC
------------------------------------------------------------------------

create or replace function public.upsert_medication_catalog_entry(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_normalized text := nullif(trim(p_name), '');
  v_existing uuid;
  v_inserted uuid;
begin
  if v_normalized is null then
    raise exception 'medication name is required' using errcode = '22023';
  end if;

  -- Fast path: existing active row.
  select id into v_existing
    from public.medication_catalog
   where lower(name) = lower(v_normalized)
     and is_archived = false
   limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  -- Insert path. The partial unique index serializes concurrent
  -- callers; on conflict we re-read.
  insert into public.medication_catalog (name)
  values (v_normalized)
  on conflict do nothing
  returning id into v_inserted;

  if v_inserted is null then
    -- Lost the race; re-read.
    select id into v_inserted
      from public.medication_catalog
     where lower(name) = lower(v_normalized)
       and is_archived = false
     limit 1;
  end if;

  return v_inserted;
end;
$$;

revoke all on function public.upsert_medication_catalog_entry(text) from public;
grant execute on function public.upsert_medication_catalog_entry(text) to authenticated;

comment on function public.upsert_medication_catalog_entry(text) is
  'Slice-8 fire-and-forget catalog upsert. Returns the canonical row id (existing or newly inserted). Case-insensitive dedup on lower(name) over the active set.';
