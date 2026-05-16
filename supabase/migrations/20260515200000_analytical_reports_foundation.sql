-- Analytical-report foundation: per-tenant definitions + immutable versions.
-- See docs/plans/clinical-documents-and-medication-catalog.md § 8B.
--
-- Goal:
--   Doctors / admins / secretaries (per RBAC) build saved, reusable
--   reports of clinic activity (e.g. "completed appointments by doctor
--   last 30 days", "revenue by payment method", "active prescriptions by
--   medication"). Each definition is a structured JSON contract the JS
--   layer compiles to a SAFE, RLS-enforced PostgREST/RPC query.
--
-- Why this is separate from clinical_documents + document_templates:
--   Clinical documents are PER-PATIENT exports (referral, prescription,
--   lab request). Analytical reports are AGGREGATIONS across many rows.
--   Sharing a table would conflate two very different access patterns and
--   RLS shapes. They cite each other via reference but never share a row.
--
-- RLS posture:
--   - SELECT: every staff member (is_staff()) can read every report
--     definition. Reports are a tenant-wide library; we don't share them
--     across tenants because they're already per-tenant DB rows.
--   - INSERT: only doctor + admin can author. (Future: a permission like
--     `analytical_reports:create` could open this to clinic admins or
--     dedicated analysts.)
--   - UPDATE: only the original author or an admin can edit.
--   - DELETE: never. Reports archive instead (is_archived = true). The
--     R1-style guard trigger protects default/built-in reports.
--
-- The version table mirrors document_template_versions: immutable after
-- publish, one current version per (report_id, locale), structural
-- consistency enforced by trigger.

------------------------------------------------------------------------
-- 1. analytical_reports
------------------------------------------------------------------------

create table if not exists public.analytical_reports (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 240),
  description text check (description is null or char_length(description) <= 2000),
  -- Closed set of report categories. Adding a category is a deliberate
  -- plan change so the editor UX can offer the right templates by category.
  category text not null
    check (category in (
      'clinical_activity',     -- visits, encounters, diagnoses
      'medication_usage',      -- prescriptions, catalog, refills
      'lab_workflow',          -- lab orders, results, turnaround
      'financial',             -- payments, billing, insurance claims
      'operational',           -- staff utilization, scheduling, no-shows
      'custom'                 -- doctor-built one-off; not in default library
    )),
  -- Audience gates the UI. RLS still enforces what each role can READ
  -- from underlying tables — this is only a "who can run this from the
  -- Reports page" hint, not a security boundary.
  audience text not null default 'staff'
    check (audience in ('doctor', 'admin', 'staff', 'public_safe')),
  is_default boolean not null default false,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references public.users(id) on delete set null,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Built-in default reports per category — at most one default per category
-- so the seeded library stays predictable.
create unique index if not exists analytical_reports_default_per_category_unique
  on public.analytical_reports (category)
  where is_default = true and is_archived = false;

create index if not exists analytical_reports_category_active_idx
  on public.analytical_reports (category)
  where is_archived = false;

alter table public.analytical_reports enable row level security;

create policy analytical_reports_staff_select on public.analytical_reports
  for select using (
    (select is_staff()) or (select has_role(array['admin']))
  );

create policy analytical_reports_doctor_admin_insert on public.analytical_reports
  for insert with check (
    (select has_role(array['doctor', 'admin']))
    and created_by = (select current_domain_user_id())
  );

create policy analytical_reports_author_or_admin_update on public.analytical_reports
  for update
  using (
    (select has_role(array['admin']))
    or created_by = (select current_domain_user_id())
  )
  with check (
    (select has_role(array['admin']))
    or created_by = (select current_domain_user_id())
  );

-- Same guard pattern as document_templates: never DELETE; archive only;
-- default reports are extra-protected from accidental archive.
create or replace function public.guard_analytical_reports_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and old.is_default then
    raise exception 'Cannot delete a default analytical report. Clear is_default first.'
      using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE'
     and old.is_default
     and new.is_default = true
     and new.is_archived = true
     and old.is_archived = false then
    raise exception 'Cannot archive a default analytical report. Clear is_default first.'
      using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists analytical_reports_default_guard on public.analytical_reports;
create trigger analytical_reports_default_guard
before delete or update on public.analytical_reports
for each row execute function public.guard_analytical_reports_default();

comment on table public.analytical_reports is
  'Per-tenant library of saved analytical-report definitions. The actual definition JSON lives on analytical_report_versions for immutability; this table is the catalog card.';

------------------------------------------------------------------------
-- 2. analytical_report_versions
------------------------------------------------------------------------

create table if not exists public.analytical_report_versions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.analytical_reports(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'superseded', 'archived')),
  is_current boolean not null default false,
  schema_version text not null default '1' check (schema_version = '1'),
  -- The full report definition. Validated by
  -- packages/core/schemas/analyticalReports.js before insert/update.
  definition jsonb not null check (jsonb_typeof(definition) = 'object'),
  -- Canonical SHA-256 of the definition (stable stringify) — same trick we
  -- use for document_template_versions. Lets a future renderer prove which
  -- version produced a saved run.
  definition_checksum text not null check (definition_checksum ~ '^[a-f0-9]{64}$'),
  created_by uuid not null references public.users(id) on delete restrict,
  published_by uuid references public.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A published version must record who published and when.
  constraint analytical_report_versions_publish_actor_check
    check (status <> 'published' or published_by is not null),
  constraint analytical_report_versions_publish_time_check
    check (status <> 'published' or published_at is not null),
  -- Only PUBLISHED versions may be marked current — same invariant as
  -- document_template_versions.
  constraint analytical_report_versions_current_check
    check (is_current = false or status = 'published')
);

create unique index if not exists analytical_report_versions_report_version_unique
  on public.analytical_report_versions (report_id, version_number);

-- At most one CURRENT published version per report.
create unique index if not exists analytical_report_versions_current_unique
  on public.analytical_report_versions (report_id)
  where is_current = true and status = 'published';

create index if not exists analytical_report_versions_report_status_idx
  on public.analytical_report_versions (report_id, status, created_at desc);

alter table public.analytical_report_versions enable row level security;

create policy analytical_report_versions_staff_select on public.analytical_report_versions
  for select using (
    (select is_staff()) or (select has_role(array['admin']))
  );

create policy analytical_report_versions_doctor_admin_insert on public.analytical_report_versions
  for insert with check (
    (select has_role(array['doctor', 'admin']))
    and created_by = (select current_domain_user_id())
  );

create policy analytical_report_versions_doctor_admin_update on public.analytical_report_versions
  for update
  using ((select has_role(array['doctor', 'admin'])))
  with check (
    (select has_role(array['doctor', 'admin']))
    and (status <> 'published' or published_by = (select current_domain_user_id()))
  );

-- Immutability trigger — published / superseded / archived versions cannot
-- have their definition rewritten. Same pattern as
-- document_template_versions.
create or replace function public.guard_analytical_report_version_immutability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status in ('published','superseded','archived') then
    if new.report_id is distinct from old.report_id
      or new.version_number is distinct from old.version_number
      or new.schema_version is distinct from old.schema_version
      or new.definition is distinct from old.definition
      or new.definition_checksum is distinct from old.definition_checksum
      or new.created_by is distinct from old.created_by
      or new.published_by is distinct from old.published_by
      or new.published_at is distinct from old.published_at
      or new.created_at is distinct from old.created_at then
      raise exception 'Published analytical report versions are immutable.'
        using errcode = '23514';
    end if;

    if new.status not in ('published','superseded','archived') then
      raise exception 'Published analytical report versions cannot return to draft.'
        using errcode = '23514';
    end if;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists analytical_report_versions_immutability_guard
  on public.analytical_report_versions;

create trigger analytical_report_versions_immutability_guard
before update on public.analytical_report_versions
for each row execute function public.guard_analytical_report_version_immutability();

comment on table public.analytical_report_versions is
  'Immutable JSON definitions for analytical reports. Definitions are structured (closed-set data sources, columns, aggregations); never raw SQL.';

comment on column public.analytical_report_versions.definition is
  'Validated by packages/core/schemas/analyticalReports.js. Compiled to a SAFE, RLS-respecting query by the JS service layer — never interpolated into a raw SQL string.';

------------------------------------------------------------------------
-- 3. analytical_report_runs (operational ledger — cached results, audit)
------------------------------------------------------------------------
--
-- A "run" is a single execution of a version with a specific filter set.
-- The result_summary is small enough to store (aggregated rows, not raw
-- PHI rows). Detailed per-row data stays in the source tables.

create table if not exists public.analytical_report_runs (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.analytical_reports(id) on delete cascade,
  version_id uuid not null references public.analytical_report_versions(id) on delete restrict,
  -- Caller's filter args (date range, doctor filter, etc.). Bound at run
  -- time, not at version time, so the same version can answer "this month"
  -- and "last month" without two versions.
  filter_args jsonb not null default '{}'::jsonb
    check (jsonb_typeof(filter_args) = 'object'),
  -- The aggregated result, capped by the schema's max_result_rows.
  result_summary jsonb,
  -- Number of source rows the aggregation scanned (for cost / SLO tracking).
  scanned_row_estimate integer check (scanned_row_estimate is null or scanned_row_estimate >= 0),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  error_code text,
  safe_error_summary text check (safe_error_summary is null or char_length(safe_error_summary) <= 500),
  requested_by uuid not null references public.users(id) on delete restrict,
  started_at timestamptz,
  completed_at timestamptz,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint analytical_report_runs_terminal_time_check
    check (status not in ('succeeded','failed','cancelled') or completed_at is not null)
);

create index if not exists analytical_report_runs_report_idx
  on public.analytical_report_runs (report_id, created_at desc);

create index if not exists analytical_report_runs_status_idx
  on public.analytical_report_runs (status, created_at)
  where status in ('queued','running');

alter table public.analytical_report_runs enable row level security;

-- Run rows are scoped to the requester so a doctor's "saved runs" list
-- never shows another doctor's parameter history (which could itself
-- reveal which patients/payers they query for).
create policy analytical_report_runs_self_select on public.analytical_report_runs
  for select using (
    requested_by = (select current_domain_user_id())
    or (select has_role(array['admin']))
  );

create policy analytical_report_runs_staff_insert on public.analytical_report_runs
  for insert with check (
    (select is_staff())
    and requested_by = (select current_domain_user_id())
  );

comment on table public.analytical_report_runs is
  'One row per report execution. Stores aggregated result_summary only — never raw PHI rows. Scoped to requester for visibility; admins see all.';
