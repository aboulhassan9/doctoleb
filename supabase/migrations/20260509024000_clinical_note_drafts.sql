begin;

-- Clinical note drafts contain PHI and belong in the tenant database, not
-- browser storage. Only the drafting doctor can read/write their active draft.

create table if not exists public.clinical_note_drafts (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict,
  doctor_id uuid not null references public.doctors(id) on delete restrict,
  author_user_id uuid not null references public.users(id) on delete restrict,
  note_type text not null default 'general'
    check (note_type in ('subjective', 'objective', 'assessment', 'plan', 'general', 'private')),
  content text not null default '' check (char_length(content) <= 12000),
  status text not null default 'active'
    check (status in ('active', 'discarded', 'converted', 'expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  discarded_at timestamptz,
  converted_at timestamptz,
  converted_note_id uuid references public.clinical_notes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'active' and discarded_at is null and converted_at is null)
    or status <> 'active'
  )
);

create unique index if not exists unique_active_clinical_note_drafts
  on public.clinical_note_drafts (encounter_id, author_user_id)
  where status = 'active';

create index if not exists idx_clinical_note_drafts_author_active
  on public.clinical_note_drafts (author_user_id, updated_at desc)
  where status = 'active';

create index if not exists idx_clinical_note_drafts_expiry
  on public.clinical_note_drafts (expires_at)
  where status = 'active';

create or replace function public.enforce_clinical_note_draft_scope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_encounter record;
begin
  select e.patient_id, e.doctor_id
  into v_encounter
  from public.encounters as e
  where e.id = new.encounter_id;

  if not found then
    raise exception 'CLINICAL_DRAFT_ENCOUNTER_NOT_FOUND' using errcode = 'foreign_key_violation';
  end if;

  if new.patient_id <> v_encounter.patient_id or new.doctor_id <> v_encounter.doctor_id then
    raise exception 'CLINICAL_DRAFT_SCOPE_MISMATCH' using errcode = 'check_violation';
  end if;

  if new.converted_note_id is not null and not exists (
    select 1
    from public.clinical_notes as note
    where note.id = new.converted_note_id
      and note.encounter_id = new.encounter_id
      and note.author_user_id = new.author_user_id
  ) then
    raise exception 'CLINICAL_DRAFT_CONVERTED_NOTE_MISMATCH' using errcode = 'check_violation';
  end if;

  if new.status = 'discarded' then
    new.discarded_at := coalesce(new.discarded_at, now());
  elsif new.status = 'converted' then
    new.converted_at := coalesce(new.converted_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_clinical_note_draft_scope on public.clinical_note_drafts;
create trigger enforce_clinical_note_draft_scope
before insert or update on public.clinical_note_drafts
for each row execute function public.enforce_clinical_note_draft_scope();

drop trigger if exists set_clinical_note_drafts_updated_at on public.clinical_note_drafts;
create trigger set_clinical_note_drafts_updated_at
before update on public.clinical_note_drafts
for each row execute function public.set_updated_at();

drop trigger if exists audit_clinical_note_drafts_changes on public.clinical_note_drafts;
create trigger audit_clinical_note_drafts_changes
after insert or update on public.clinical_note_drafts
for each row execute function public.write_audit_log();

alter table public.clinical_note_drafts enable row level security;

drop policy if exists clinical_note_drafts_author_select on public.clinical_note_drafts;
create policy clinical_note_drafts_author_select on public.clinical_note_drafts
for select using (
  (select public.has_role(array['admin']))
  or (
    (select public.has_role(array['doctor']))
    and doctor_id = (select public.current_doctor_id())
    and author_user_id = (select public.current_domain_user_id())
  )
);

drop policy if exists clinical_note_drafts_doctor_insert on public.clinical_note_drafts;
create policy clinical_note_drafts_doctor_insert on public.clinical_note_drafts
for insert with check (
  (select public.has_role(array['doctor']))
  and doctor_id = (select public.current_doctor_id())
  and author_user_id = (select public.current_domain_user_id())
);

drop policy if exists clinical_note_drafts_doctor_update on public.clinical_note_drafts;
create policy clinical_note_drafts_doctor_update on public.clinical_note_drafts
for update using (
  (select public.has_role(array['doctor']))
  and doctor_id = (select public.current_doctor_id())
  and author_user_id = (select public.current_domain_user_id())
)
with check (
  (select public.has_role(array['doctor']))
  and doctor_id = (select public.current_doctor_id())
  and author_user_id = (select public.current_domain_user_id())
);

create or replace function public.save_clinical_note_draft(
  p_encounter uuid,
  p_note_type text default 'general',
  p_content text default ''
)
returns public.clinical_note_drafts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_doctor_id uuid;
  v_encounter record;
  v_note_type text;
  v_content text;
  v_draft public.clinical_note_drafts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'insufficient_privilege';
  end if;

  v_user_id := public.current_domain_user_id();
  v_doctor_id := public.current_doctor_id();

  if v_user_id is null or v_doctor_id is null or not (select public.has_role(array['doctor'])) then
    raise exception 'Only doctors can save clinical note drafts' using errcode = 'insufficient_privilege';
  end if;

  v_note_type := coalesce(nullif(trim(p_note_type), ''), 'general');
  if v_note_type not in ('subjective', 'objective', 'assessment', 'plan', 'general', 'private') then
    raise exception 'INVALID_NOTE_TYPE' using errcode = 'invalid_parameter_value';
  end if;

  v_content := coalesce(p_content, '');
  if char_length(v_content) > 12000 then
    raise exception 'CLINICAL_DRAFT_CONTENT_TOO_LONG' using errcode = 'string_data_right_truncation';
  end if;

  select e.patient_id, e.doctor_id, e.status
  into v_encounter
  from public.encounters as e
  where e.id = p_encounter;

  if not found or v_encounter.doctor_id <> v_doctor_id then
    raise exception 'CLINICAL_DRAFT_ENCOUNTER_NOT_FOUND' using errcode = 'insufficient_privilege';
  end if;

  if v_encounter.status <> 'in_progress' then
    raise exception 'CLINICAL_DRAFT_ENCOUNTER_NOT_ACTIVE' using errcode = 'invalid_parameter_value';
  end if;

  insert into public.clinical_note_drafts (
    encounter_id,
    patient_id,
    doctor_id,
    author_user_id,
    note_type,
    content,
    status,
    expires_at
  )
  values (
    p_encounter,
    v_encounter.patient_id,
    v_doctor_id,
    v_user_id,
    v_note_type,
    v_content,
    'active',
    now() + interval '7 days'
  )
  on conflict (encounter_id, author_user_id) where status = 'active'
  do update set
    note_type = excluded.note_type,
    content = excluded.content,
    expires_at = excluded.expires_at,
    discarded_at = null,
    converted_at = null,
    converted_note_id = null
  returning * into v_draft;

  return v_draft;
end;
$$;

create or replace function public.get_active_clinical_note_draft(p_encounter uuid)
returns public.clinical_note_drafts
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_draft public.clinical_note_drafts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'insufficient_privilege';
  end if;

  v_user_id := public.current_domain_user_id();
  if v_user_id is null then
    raise exception 'DOMAIN_USER_NOT_FOUND' using errcode = 'insufficient_privilege';
  end if;

  if not (select public.has_role(array['doctor', 'admin'])) then
    raise exception 'Only clinical staff can read clinical note drafts' using errcode = 'insufficient_privilege';
  end if;

  select draft.*
  into v_draft
  from public.clinical_note_drafts as draft
  where draft.encounter_id = p_encounter
    and draft.author_user_id = v_user_id
    and draft.status = 'active'
    and draft.expires_at > now()
  limit 1;

  return v_draft;
end;
$$;

create or replace function public.discard_clinical_note_draft(
  p_encounter uuid,
  p_status text default 'discarded',
  p_converted_note uuid default null
)
returns public.clinical_note_drafts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_status text;
  v_draft public.clinical_note_drafts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'insufficient_privilege';
  end if;

  v_user_id := public.current_domain_user_id();
  if v_user_id is null then
    raise exception 'DOMAIN_USER_NOT_FOUND' using errcode = 'insufficient_privilege';
  end if;

  if not (select public.has_role(array['doctor'])) then
    raise exception 'Only doctors can discard clinical note drafts' using errcode = 'insufficient_privilege';
  end if;

  v_status := coalesce(nullif(trim(p_status), ''), 'discarded');
  if v_status not in ('discarded', 'converted') then
    raise exception 'INVALID_CLINICAL_DRAFT_DISCARD_STATUS' using errcode = 'invalid_parameter_value';
  end if;

  update public.clinical_note_drafts
  set
    status = v_status,
    content = '',
    discarded_at = case when v_status = 'discarded' then now() else discarded_at end,
    converted_at = case when v_status = 'converted' then now() else converted_at end,
    converted_note_id = case when v_status = 'converted' then p_converted_note else null end
  where encounter_id = p_encounter
    and author_user_id = v_user_id
    and status = 'active'
  returning * into v_draft;

  return v_draft;
end;
$$;

create or replace function public.expire_clinical_note_drafts(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_expired_count integer := 0;
begin
  update public.clinical_note_drafts
  set
    status = 'expired',
    content = ''
  where status = 'active'
    and expires_at <= p_now;

  get diagnostics v_expired_count = row_count;
  return v_expired_count;
end;
$$;

revoke all on function public.enforce_clinical_note_draft_scope() from public, anon, authenticated;
revoke all on function public.save_clinical_note_draft(uuid, text, text) from public, anon, authenticated;
revoke all on function public.get_active_clinical_note_draft(uuid) from public, anon, authenticated;
revoke all on function public.discard_clinical_note_draft(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.expire_clinical_note_drafts(timestamptz) from public, anon, authenticated;

grant execute on function public.save_clinical_note_draft(uuid, text, text) to authenticated, service_role;
grant execute on function public.get_active_clinical_note_draft(uuid) to authenticated, service_role;
grant execute on function public.discard_clinical_note_draft(uuid, text, uuid) to authenticated, service_role;
grant execute on function public.expire_clinical_note_drafts(timestamptz) to service_role;

commit;
