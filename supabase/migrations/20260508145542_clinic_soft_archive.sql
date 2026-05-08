-- Clinic records are clinical operating history. Archive them instead of
-- allowing browser clients to hard-delete practice locations referenced by
-- appointments, slots, and schedule templates.

alter table public.clinics
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.users(id);

create index if not exists idx_clinics_active_name
  on public.clinics (lower(name), id)
  where is_archived = false;

create index if not exists idx_clinics_archived_by
  on public.clinics (archived_by)
  where archived_by is not null;

drop policy if exists clinics_staff_delete on public.clinics;
