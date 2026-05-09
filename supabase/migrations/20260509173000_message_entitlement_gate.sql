-- Gate tenant messaging at the database boundary as well as the UI.
-- Feature flags remain tenant-local runtime config; missing rows fail closed.

create or replace function public.is_feature_enabled(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select ff.is_enabled
      from public.feature_flags as ff
      where ff.code = lower(trim(p_code))
      limit 1
    ),
    false
  );
$$;

revoke all on function public.is_feature_enabled(text) from public, anon, authenticated;
grant execute on function public.is_feature_enabled(text) to authenticated, service_role;

create or replace function public.can_access_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_feature_enabled('messaging')
    and coalesce(
      public.is_staff()
      or exists (
        select 1
        from public.conversation_participants as cp
        where cp.conversation_id = p_conversation_id
          and cp.is_active = true
          and cp.user_id = public.current_domain_user_id()
      )
      or exists (
        select 1
        from public.conversations as c
        where c.id = p_conversation_id
          and c.patient_id = public.current_patient_id()
      ),
      false
    );
$$;

revoke execute on function public.can_access_conversation(uuid) from public;
grant execute on function public.can_access_conversation(uuid) to authenticated, service_role;

drop policy if exists conversations_staff_insert on public.conversations;
create policy conversations_staff_insert on public.conversations
for insert with check (
  (select public.is_feature_enabled('messaging'))
  and ((select public.is_staff()) or patient_id = (select public.current_patient_id()))
);

drop policy if exists conversations_staff_update on public.conversations;
create policy conversations_staff_update on public.conversations
for update using (
  (select public.is_feature_enabled('messaging'))
  and ((select public.is_staff()) or (select public.can_access_conversation(id)))
)
with check (
  (select public.is_feature_enabled('messaging'))
  and ((select public.is_staff()) or (select public.can_access_conversation(id)))
);

drop policy if exists conversation_participants_staff_insert on public.conversation_participants;
create policy conversation_participants_staff_insert on public.conversation_participants
for insert with check (
  (select public.is_feature_enabled('messaging'))
  and ((select public.is_staff()) or patient_id = (select public.current_patient_id()))
);

drop policy if exists conversation_participants_self_update on public.conversation_participants;
create policy conversation_participants_self_update on public.conversation_participants
for update using (
  (select public.is_feature_enabled('messaging'))
  and (
    (select public.is_staff())
    or user_id = (select public.current_domain_user_id())
    or patient_id = (select public.current_patient_id())
  )
)
with check (
  (select public.is_feature_enabled('messaging'))
  and (
    (select public.is_staff())
    or user_id = (select public.current_domain_user_id())
    or patient_id = (select public.current_patient_id())
  )
);
