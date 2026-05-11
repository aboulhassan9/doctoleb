-- DoctoLeb Control Plane · retry-safe tenant secret storage column qualification
-- Keeps raw tenant credentials in Vault only, but makes repeated saves
-- idempotent so a failed browser retry does not strand the setup flow.

create or replace function public.admin_store_tenant_secret_ref(
  p_tenant_id uuid,
  p_project_ref text,
  p_secret_kind text,
  p_secret_storage text,
  p_secret_value text,
  p_secret_ref text,
  p_actor_id uuid
)
returns table (
  id uuid,
  tenant_id uuid,
  project_ref text,
  secret_kind text,
  secret_storage text,
  secret_ref text,
  status text,
  secret_last_rotated_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_existing public.tenant_secret_refs%rowtype;
  v_has_existing boolean := false;
  v_previous_vault_secret_id uuid;
  v_secret_id uuid;
  v_secret_name text;
  v_secret_description text := 'DoctoLeb tenant setup secret. Metadata only is stored in public tables.';
  v_secret_ref text;
  v_project_ref text := lower(trim(coalesce(p_project_ref, '')));
  v_secret_kind text := lower(trim(coalesce(p_secret_kind, '')));
  v_secret_storage text := lower(trim(coalesce(p_secret_storage, '')));
begin
  if v_project_ref !~ '^[a-z0-9]{20}$' then
    raise exception 'INVALID_PROJECT_REF' using errcode = '22023';
  end if;

  if v_secret_kind not in ('service_role_key','database_url') then
    raise exception 'INVALID_SECRET_KIND' using errcode = '22023';
  end if;

  if v_secret_storage not in ('supabase_vault','edge_function_secret','external_secret_manager') then
    raise exception 'INVALID_SECRET_STORAGE' using errcode = '22023';
  end if;

  if not exists (select 1 from public.tenants t where t.id = p_tenant_id) then
    raise exception 'TENANT_NOT_FOUND' using errcode = '22023';
  end if;

  select *
  into v_existing
  from public.tenant_secret_refs as ref
  where ref.tenant_id = p_tenant_id
    and ref.secret_kind = v_secret_kind
    and ref.status = 'active'
  for update;
  v_has_existing := found;

  if v_secret_storage = 'supabase_vault' then
    if nullif(p_secret_value, '') is null or char_length(p_secret_value) < 20 then
      raise exception 'SECRET_VALUE_REQUIRED' using errcode = '22023';
    end if;

    v_secret_name := 'tenant/' || p_tenant_id::text || '/' || v_project_ref || '/' || v_secret_kind;

    if v_has_existing
      and v_existing.secret_storage = 'supabase_vault'
      and v_existing.secret_ref ~* '^vault:[0-9a-f-]{36}$'
    then
      select secrets.id
      into v_secret_id
      from vault.secrets
      where secrets.id = replace(v_existing.secret_ref, 'vault:', '')::uuid
      limit 1;
    end if;

    if v_secret_id is null then
      select secrets.id
      into v_secret_id
      from vault.secrets
      where secrets.name = v_secret_name
      order by secrets.updated_at desc nulls last, secrets.created_at desc
      limit 1;
    end if;

    if v_secret_id is not null then
      perform vault.update_secret(v_secret_id, p_secret_value, v_secret_name, v_secret_description);
    else
      v_secret_id := vault.create_secret(p_secret_value, v_secret_name, v_secret_description);
    end if;

    v_secret_ref := 'vault:' || v_secret_id::text;
  else
    v_secret_ref := trim(coalesce(p_secret_ref, ''));
    if nullif(v_secret_ref, '') is null or v_secret_ref ~* '(eyJ|sbp_|vcp_|sk_live_|sk_test_|postgres(ql)?://)' then
      raise exception 'SECRET_REF_INVALID' using errcode = '22023';
    end if;
  end if;

  if v_has_existing then
    if v_existing.secret_storage = 'supabase_vault'
      and v_existing.secret_ref ~* '^vault:[0-9a-f-]{36}$'
      and v_existing.secret_ref <> v_secret_ref
    then
      v_previous_vault_secret_id := replace(v_existing.secret_ref, 'vault:', '')::uuid;
      if exists (select 1 from vault.secrets where secrets.id = v_previous_vault_secret_id) then
        perform vault.update_secret(
          v_previous_vault_secret_id,
          'rotated:' || v_existing.id::text,
          null,
          'Rotated DoctoLeb tenant setup secret reference.'
        );
      end if;
    end if;

    return query
    update public.tenant_secret_refs as ref
    set project_ref = v_project_ref,
        secret_storage = v_secret_storage,
        secret_ref = v_secret_ref,
        status = 'active',
        revoked_at = null,
        secret_last_rotated_at = now(),
        last_verified_at = null,
        last_error_code = null,
        last_error_summary = null,
        updated_by = p_actor_id,
        updated_at = now()
    where ref.id = v_existing.id
    returning
      ref.id,
      ref.tenant_id,
      ref.project_ref,
      ref.secret_kind,
      ref.secret_storage,
      ref.secret_ref,
      ref.status,
      ref.secret_last_rotated_at,
      ref.created_at,
      ref.updated_at;
    return;
  end if;

  return query
  insert into public.tenant_secret_refs (
    tenant_id,
    project_ref,
    secret_kind,
    secret_storage,
    secret_ref,
    status,
    created_by,
    updated_by
  )
  values (
    p_tenant_id,
    v_project_ref,
    v_secret_kind,
    v_secret_storage,
    v_secret_ref,
    'active',
    p_actor_id,
    p_actor_id
  )
  returning
    tenant_secret_refs.id,
    tenant_secret_refs.tenant_id,
    tenant_secret_refs.project_ref,
    tenant_secret_refs.secret_kind,
    tenant_secret_refs.secret_storage,
    tenant_secret_refs.secret_ref,
    tenant_secret_refs.status,
    tenant_secret_refs.secret_last_rotated_at,
    tenant_secret_refs.created_at,
    tenant_secret_refs.updated_at;
end;
$$;

revoke all on function public.admin_store_tenant_secret_ref(uuid, text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_store_tenant_secret_ref(uuid, text, text, text, text, text, uuid) to service_role;

insert into public.tenant_events (tenant_id, event_type, metadata)
select null, 'control_plane.tenant_secret_vault_upsert_column_qualification_applied', jsonb_build_object(
  'updatesExistingVaultSecret', true,
  'recoversNamedVaultSecret', true,
  'qualifiesTenantSecretColumns', true,
  'rawSecretStoredInPublicTable', false
)
where not exists (
  select 1
  from public.tenant_events
  where event_type = 'control_plane.tenant_secret_vault_upsert_column_qualification_applied'
);

