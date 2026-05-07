-- Tier 2 encounter contract hardening.
-- Keeps the canonical lifecycle rules in the database, not only in React.

create or replace function public.complete_encounter(
  p_encounter uuid,
  p_summary text default null
)
returns public.encounters
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doctor uuid;
  v_encounter public.encounters%rowtype;
begin
  v_doctor := public.current_doctor_id();

  if public.current_domain_user_id() is null or not public.has_role(array['doctor', 'admin']) then
    raise exception 'Only doctors can complete encounters' using errcode = 'insufficient_privilege';
  end if;

  select *
  into v_encounter
  from public.encounters
  where id = p_encounter
  for update;

  if not found then
    raise exception 'Encounter not found' using errcode = 'no_data_found';
  end if;

  if public.current_user_role() = 'doctor' and v_encounter.doctor_id is distinct from v_doctor then
    raise exception 'Cannot complete another doctor''s encounter' using errcode = 'insufficient_privilege';
  end if;

  if v_encounter.status = 'completed' then
    return v_encounter;
  end if;

  if v_encounter.status <> 'in_progress' then
    raise exception 'Encounter cannot be completed from status %', v_encounter.status
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1
    from public.clinical_documents as cd
    where cd.encounter_id = p_encounter
      and cd.status = 'draft'
      and coalesce(cd.is_archived, false) = false
  ) then
    raise exception 'Finalize or void draft documents before completing this encounter'
      using errcode = 'check_violation';
  end if;

  if nullif(trim(coalesce(p_summary, '')), '') is null
     and not exists (
       select 1
       from public.clinical_notes as cn
       where cn.encounter_id = p_encounter
         and coalesce(cn.is_archived, false) = false
     ) then
    raise exception 'Encounter completion requires at least one clinical note or a completion summary'
      using errcode = 'check_violation';
  end if;

  update public.encounters
  set status = 'completed',
      ended_at = coalesce(ended_at, now()),
      summary = coalesce(nullif(p_summary, ''), summary),
      updated_at = now()
  where id = p_encounter
  returning * into v_encounter;

  update public.appointments
  set status = 'completed',
      updated_at = now()
  where id = v_encounter.appointment_id
    and status in ('scheduled', 'confirmed', 'pre_check', 'in_consultation');

  return v_encounter;
end;
$$;

create or replace function public.enforce_prescription_requires_diagnosis()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(new.is_archived, false) = true then
    return new;
  end if;

  if new.encounter_id is null then
    raise exception 'Prescription must be linked to an encounter'
      using errcode = 'not_null_violation';
  end if;

  if not exists (
    select 1
    from public.diagnoses as d
    where d.encounter_id = new.encounter_id
      and coalesce(d.is_archived, false) = false
  ) then
    raise exception 'Record a diagnosis before prescribing medication for this encounter'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_prescription_requires_diagnosis on public.prescriptions;
create trigger enforce_prescription_requires_diagnosis
before insert or update of encounter_id, is_archived, status on public.prescriptions
for each row
execute function public.enforce_prescription_requires_diagnosis();

revoke execute on function public.complete_encounter(uuid, text) from public, anon;
grant execute on function public.complete_encounter(uuid, text) to authenticated, service_role;

revoke execute on function public.enforce_prescription_requires_diagnosis() from public, anon, authenticated;
grant execute on function public.enforce_prescription_requires_diagnosis() to service_role;
