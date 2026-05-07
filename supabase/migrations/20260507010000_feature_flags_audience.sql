-- Audience-gate feature flags so patients do not see staff/admin-only rollout
-- switches. Public flags are safe for pre-login/mobile bootstrapping; all other
-- audiences require an authenticated role match.

alter table public.feature_flags
  add column if not exists audience text not null default 'staff';

alter table public.feature_flags
  drop constraint if exists feature_flags_audience_check;

alter table public.feature_flags
  add constraint feature_flags_audience_check
  check (audience in ('public', 'patient', 'staff', 'admin'));

drop policy if exists feature_flags_authenticated_select on public.feature_flags;
drop policy if exists feature_flags_audience_select on public.feature_flags;

create policy feature_flags_audience_select
on public.feature_flags
for select
using (
  audience = 'public'
  or (
    (select auth.role()) = 'authenticated'
    and (
      (audience = 'patient' and (select public.current_user_role()) = 'patient')
      or (audience = 'staff' and (select public.is_staff()))
      or (audience = 'admin' and (select public.has_role(array['admin'])))
    )
  )
);

create index if not exists idx_feature_flags_audience_enabled
  on public.feature_flags (audience, is_enabled);
