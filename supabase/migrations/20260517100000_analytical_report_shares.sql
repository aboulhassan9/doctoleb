-- Analytical-report sharing + ownership transfer (review FEAT-3).
-- See docs/plans/clinical-documents-and-medication-catalog.md § 8B.
--
-- Why:
--   Every staff member can already READ every report (the catalog is a
--   tenant-wide library). What was missing is a way to grant a SPECIFIC
--   colleague edit rights on a report they did not author, and a way to
--   reassign ownership when a doctor leaves the clinic.
--
--   `analytical_report_shares` records an explicit grant. An 'edit' grant
--   extends the analytical_reports UPDATE policy so the grantee can edit
--   the report's metadata and publish new versions. A 'view' grant is a
--   recorded baseline — it has no RLS effect today (the catalog is already
--   staff-readable) but documents intent and becomes meaningful if
--   audience-scoped catalog RLS is introduced later.
--
--   Ownership transfer is an UPDATE of analytical_reports.created_by. A
--   guard trigger makes that change admin-only — a plain owner or an
--   edit-shared collaborator cannot reassign ownership.

------------------------------------------------------------------------
-- 1. analytical_report_shares
------------------------------------------------------------------------

create table if not exists public.analytical_report_shares (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.analytical_reports(id) on delete cascade,
  shared_with_user_id uuid not null references public.users(id) on delete cascade,
  permission_level text not null default 'edit'
    check (permission_level in ('view', 'edit')),
  granted_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  -- One grant per (report, user); change the level with UPDATE, not a duplicate.
  unique (report_id, shared_with_user_id)
);

create index if not exists analytical_report_shares_user_idx
  on public.analytical_report_shares (shared_with_user_id);

alter table public.analytical_report_shares enable row level security;

-- Visible to: an admin, the grantee, or the report's owner.
create policy analytical_report_shares_select on public.analytical_report_shares
  for select using (
    (select has_role(array['admin']))
    or shared_with_user_id = (select current_domain_user_id())
    or exists (
      select 1 from public.analytical_reports r
      where r.id = analytical_report_shares.report_id
        and r.created_by = (select current_domain_user_id())
    )
  );

-- Granted by: an admin or the report's owner. granted_by must be the actor.
create policy analytical_report_shares_insert on public.analytical_report_shares
  for insert with check (
    granted_by = (select current_domain_user_id())
    and (
      (select has_role(array['admin']))
      or exists (
        select 1 from public.analytical_reports r
        where r.id = analytical_report_shares.report_id
          and r.created_by = (select current_domain_user_id())
      )
    )
  );

create policy analytical_report_shares_update on public.analytical_report_shares
  for update
  using (
    (select has_role(array['admin']))
    or exists (
      select 1 from public.analytical_reports r
      where r.id = analytical_report_shares.report_id
        and r.created_by = (select current_domain_user_id())
    )
  )
  with check (
    (select has_role(array['admin']))
    or exists (
      select 1 from public.analytical_reports r
      where r.id = analytical_report_shares.report_id
        and r.created_by = (select current_domain_user_id())
    )
  );

create policy analytical_report_shares_delete on public.analytical_report_shares
  for delete using (
    (select has_role(array['admin']))
    or exists (
      select 1 from public.analytical_reports r
      where r.id = analytical_report_shares.report_id
        and r.created_by = (select current_domain_user_id())
    )
  );

comment on table public.analytical_report_shares is
  'Explicit per-report access grants. An edit grant extends the analytical_reports UPDATE policy to the grantee; the catalog itself is already staff-wide readable.';

------------------------------------------------------------------------
-- 2. Extend analytical_reports UPDATE so edit-shared colleagues can edit.
------------------------------------------------------------------------

drop policy if exists analytical_reports_author_or_admin_update on public.analytical_reports;

create policy analytical_reports_author_or_admin_update on public.analytical_reports
  for update
  using (
    (select has_role(array['admin']))
    or created_by = (select current_domain_user_id())
    or exists (
      select 1 from public.analytical_report_shares s
      where s.report_id = analytical_reports.id
        and s.shared_with_user_id = (select current_domain_user_id())
        and s.permission_level = 'edit'
    )
  )
  with check (
    (select has_role(array['admin']))
    or created_by = (select current_domain_user_id())
    or exists (
      select 1 from public.analytical_report_shares s
      where s.report_id = analytical_reports.id
        and s.shared_with_user_id = (select current_domain_user_id())
        and s.permission_level = 'edit'
    )
  );

------------------------------------------------------------------------
-- 3. Ownership transfer is admin-only.
--    The UPDATE policy above lets owners / edit-shared collaborators edit,
--    but RLS WITH CHECK cannot see OLD vs NEW — so a trigger enforces that
--    only an admin may change created_by. Extends the existing guard.
------------------------------------------------------------------------

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
  -- Ownership transfer is admin-only. A non-admin (owner or edit-shared
  -- collaborator) cannot reassign created_by.
  if tg_op = 'UPDATE'
     and new.created_by is distinct from old.created_by
     and not (select public.has_role(array['admin'])) then
    raise exception 'Only an admin can transfer report ownership.'
      using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;
