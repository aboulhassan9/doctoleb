-- DoctoLeb Control Plane · tenant runtime config
-- Stores public tenant connection metadata needed by the resolver. NO PHI.
-- Service-role tenant credentials remain in Edge Function env/Vault only.

create or replace function public.admin_set_tenant_runtime_config_atomic(
  p_actor_id uuid,
  p_tenant_id uuid,
  p_supabase_project_ref text,
  p_supabase_url text,
  p_supabase_anon_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_ref text := lower(trim(coalesce(p_supabase_project_ref, '')));
  v_url text := lower(trim(coalesce(p_supabase_url, '')));
  v_anon_key text := trim(coalesce(p_supabase_anon_key, ''));
  v_tenant jsonb;
begin
  v_url := regexp_replace(v_url, '/+$', '');

  if p_actor_id is null
     or p_tenant_id is null
     or v_project_ref !~ '^[a-z0-9]{20}$'
     or v_url <> ('https://' || v_project_ref || '.supabase.co')
     or length(v_anon_key) < 20
     or length(v_anon_key) > 4096
     or v_anon_key ~ '\s' then
    return jsonb_build_object('data', null, 'error', 'INVALID_REQUEST');
  end if;

  perform 1
  from public.tenants
  where id = p_tenant_id
  for update;

  if not found then
    return jsonb_build_object('data', null, 'error', 'TENANT_NOT_FOUND');
  end if;

  update public.tenants
  set supabase_project_ref = v_project_ref,
      supabase_url = v_url,
      supabase_anon_key = v_anon_key
  where id = p_tenant_id;

  update public.tenant_provisioning_jobs
  set checklist = coalesce(checklist, '{}'::jsonb) || jsonb_build_object('storeTenantRuntimeConfig', true)
  where tenant_id = p_tenant_id
    and status not in ('cancelled', 'archived');

  insert into public.tenant_events (
    tenant_id,
    event_type,
    actor_id,
    metadata
  )
  values (
    p_tenant_id,
    'tenant.runtime_config_set',
    p_actor_id,
    jsonb_build_object(
      'supabaseProjectRef', v_project_ref,
      'supabaseUrlHost', v_project_ref || '.supabase.co',
      'hasAnonKey', true,
      'phi', false
    )
  );

  select jsonb_build_object(
    'id', id,
    'slug', slug,
    'display_name', display_name,
    'status', status,
    'plan', plan,
    'release_channel', release_channel,
    'supabase_project_ref', supabase_project_ref,
    'supabase_url', supabase_url,
    'schema_version', schema_version,
    'notes', notes,
    'updated_at', updated_at
  )
  into v_tenant
  from public.tenants
  where id = p_tenant_id;

  return jsonb_build_object(
    'data', jsonb_build_object('tenant', v_tenant),
    'error', null
  );
exception
  when check_violation then
    return jsonb_build_object('data', null, 'error', 'INVALID_REQUEST');
  when others then
    return jsonb_build_object('data', null, 'error', 'TENANT_RUNTIME_CONFIG_SAVE_FAILED');
end;
$$;

revoke all on function public.admin_set_tenant_runtime_config_atomic(uuid, uuid, text, text, text) from public;
revoke execute on function public.admin_set_tenant_runtime_config_atomic(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_set_tenant_runtime_config_atomic(uuid, uuid, text, text, text) to service_role;

comment on function public.admin_set_tenant_runtime_config_atomic(uuid, uuid, text, text, text) is
  'Private service-role RPC for setting public tenant runtime connection metadata. NO PHI; no service-role keys.';

insert into public.tenant_events (tenant_id, event_type, metadata)
select null, 'control_plane.tenant_runtime_config_applied', jsonb_build_object(
  'function', 'admin_set_tenant_runtime_config_atomic',
  'serviceRoleOnly', true,
  'storesServiceRoleKey', false,
  'phi', false
)
where not exists (
  select 1
  from public.tenant_events
  where event_type = 'control_plane.tenant_runtime_config_applied'
);
