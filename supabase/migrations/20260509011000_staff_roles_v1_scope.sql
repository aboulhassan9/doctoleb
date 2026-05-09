-- Scope clinic staff roles to the app surfaces that exist in v1.
--
-- Production rule:
--   Doctors must not be able to create staff roles that have no login
--   destination, dashboard, route permissions, or tested workflow.
--
-- Reversibility:
--   Existing unsupported role rows are disabled, not deleted, and their role
--   value is preserved. A future migration can re-enable these roles after
--   adding dashboards, route guards, RLS policy coverage, and invite tests.

update public.staff_members
set
  is_active = false,
  invite_status = 'disabled',
  updated_at = now()
where role not in ('secretary', 'predoctor')
  and (is_active is distinct from false or invite_status <> 'disabled');

alter table public.staff_members
  drop constraint if exists staff_members_role_check;

alter table public.staff_members
  add constraint staff_members_role_check
  check (role in ('secretary', 'predoctor'));

alter table public.conversation_participants
  drop constraint if exists conversation_participants_role_check;

alter table public.conversation_participants
  add constraint conversation_participants_role_check
  check (role in ('patient', 'doctor', 'secretary', 'predoctor', 'admin'));

comment on column public.staff_members.role is
  'v1 supported clinic staff roles are secretary and predoctor. Additional staff roles require app routes, RLS policy coverage, and invite lifecycle tests before activation.';

comment on column public.conversation_participants.role is
  'v1 supported participant roles match active app roles: patient, doctor, secretary, predoctor, and admin.';
