begin;

alter table public.tenant_migration_items
  drop constraint if exists tenant_migration_items_version_check;

alter table public.tenant_migration_items
  drop constraint if exists tenant_migration_items_version_format;

alter table public.tenant_migration_items
  add constraint tenant_migration_items_version_format
  check (version ~ '^[0-9]{8,20}$');

create or replace function public.admin_upsert_tenant_migration_item(
  p_run_id uuid,
  p_sequence_no integer,
  p_version text,
  p_name text,
  p_checksum text,
  p_status text,
  p_error_code text,
  p_error_summary text
)
returns public.tenant_migration_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.tenant_migration_items%rowtype;
  v_status text := lower(trim(coalesce(p_status, 'pending')));
begin
  if v_status not in ('pending','running','succeeded','failed','skipped') then
    raise exception 'INVALID_MIGRATION_ITEM_STATUS' using errcode = '22023';
  end if;

  if p_sequence_no < 0 then
    raise exception 'INVALID_MIGRATION_SEQUENCE' using errcode = '22023';
  end if;

  insert into public.tenant_migration_items (
    run_id,
    sequence_no,
    version,
    name,
    checksum,
    status,
    error_code,
    error_summary,
    started_at,
    completed_at
  )
  values (
    p_run_id,
    p_sequence_no,
    trim(p_version),
    trim(p_name),
    p_checksum,
    v_status,
    p_error_code,
    p_error_summary,
    case when v_status in ('running','succeeded','failed','skipped') then now() else null end,
    case when v_status in ('succeeded','failed','skipped') then now() else null end
  )
  on conflict (run_id, version) do update
    set sequence_no = excluded.sequence_no,
        name = excluded.name,
        checksum = excluded.checksum,
        status = excluded.status,
        error_code = excluded.error_code,
        error_summary = excluded.error_summary,
        started_at = coalesce(public.tenant_migration_items.started_at, excluded.started_at),
        completed_at = excluded.completed_at,
        updated_at = now()
  returning * into v_item;

  return v_item;
end;
$$;

revoke all on function public.admin_upsert_tenant_migration_item(uuid, integer, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_upsert_tenant_migration_item(uuid, integer, text, text, text, text, text, text) to service_role;

create or replace function public.admin_finish_tenant_migration_run(
  p_run_id uuid,
  p_status text,
  p_source_checksum text,
  p_expected_migrations_count integer,
  p_applied_migrations_count integer,
  p_failed_migration_version text,
  p_failed_migration_name text,
  p_error_code text,
  p_error_summary text
)
returns public.tenant_migration_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.tenant_migration_runs%rowtype;
  v_status text := lower(trim(coalesce(p_status, 'blocked')));
begin
  if v_status not in ('queued','running','succeeded','failed','blocked','cancelled') then
    raise exception 'INVALID_MIGRATION_RUN_STATUS' using errcode = '22023';
  end if;

  update public.tenant_migration_runs
     set status = v_status,
         source_checksum = p_source_checksum,
         expected_migrations_count = greatest(coalesce(p_expected_migrations_count, 0), 0),
         applied_migrations_count = greatest(coalesce(p_applied_migrations_count, 0), 0),
         failed_migration_version = nullif(trim(coalesce(p_failed_migration_version, '')), ''),
         failed_migration_name = nullif(trim(coalesce(p_failed_migration_name, '')), ''),
         last_error_code = p_error_code,
         last_error_summary = p_error_summary,
         completed_at = case when v_status in ('succeeded','failed','blocked','cancelled') then now() else completed_at end,
         updated_at = now()
   where id = p_run_id
   returning * into v_run;

  if not found then
    raise exception 'TENANT_MIGRATION_RUN_NOT_FOUND' using errcode = '22023';
  end if;

  return v_run;
end;
$$;

revoke all on function public.admin_finish_tenant_migration_run(uuid, text, text, integer, integer, text, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_finish_tenant_migration_run(uuid, text, text, integer, integer, text, text, text, text) to service_role;

insert into public.tenant_events (tenant_id, event_type, metadata)
select null, 'control_plane.tenant_db_migration_runner_applied', jsonb_build_object(
  'migrationItemRpc', true,
  'migrationRunFinishRpc', true,
  'versionFormat', '8_to_20_digits',
  'phi', false
)
where not exists (
  select 1
  from public.tenant_events
  where event_type = 'control_plane.tenant_db_migration_runner_applied'
);

commit;
