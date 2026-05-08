-- DoctoLeb Control Plane · atomic tenant update
-- Keeps admin tenant/domain updates transaction-backed and auditable. This is
-- a private service-role RPC: browser clients must continue using the
-- admin-update-tenant Edge Function, which performs auth/RBAC first.

create or replace function public.admin_update_tenant_atomic(
  p_actor_id uuid,
  p_tenant_id uuid,
  p_patch jsonb default '{}'::jsonb,
  p_domains jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patch jsonb := coalesce(p_patch, '{}'::jsonb);
  v_domains jsonb := coalesce(p_domains, '[]'::jsonb);
  v_patch_keys text[] := array[]::text[];
  v_key text;
  v_existing_status text;
  v_domain jsonb;
  v_domain_id uuid;
  v_domain_tenant_id uuid;
  v_hostname text;
  v_surface text;
  v_status text;
  v_dns_status text;
  v_ssl_status text;
  v_is_local_domain boolean;
  v_domain_count integer := 0;
  v_tenant jsonb;
  v_updated_domains jsonb;
begin
  if p_actor_id is null or p_tenant_id is null then
    return jsonb_build_object('data', null, 'error', 'INVALID_REQUEST');
  end if;

  if jsonb_typeof(v_patch) <> 'object' or jsonb_typeof(v_domains) <> 'array' then
    return jsonb_build_object('data', null, 'error', 'INVALID_REQUEST');
  end if;

  select coalesce(array_agg(key order by key), array[]::text[])
  into v_patch_keys
  from jsonb_object_keys(v_patch) as keys(key);

  if cardinality(v_patch_keys) = 0 and jsonb_array_length(v_domains) = 0 then
    return jsonb_build_object('data', null, 'error', 'INVALID_REQUEST');
  end if;

  foreach v_key in array v_patch_keys loop
    if v_key not in ('display_name', 'status', 'plan', 'release_channel', 'schema_version', 'notes') then
      return jsonb_build_object('data', null, 'error', 'INVALID_REQUEST');
    end if;
  end loop;

  if v_patch ? 'display_name' and nullif(trim(v_patch ->> 'display_name'), '') is null then
    return jsonb_build_object('data', null, 'error', 'INVALID_REQUEST');
  end if;

  if v_patch ? 'status'
     and coalesce(v_patch ->> 'status', '') not in ('draft', 'provisioning', 'active', 'inactive', 'suspended', 'maintenance', 'archived') then
    return jsonb_build_object('data', null, 'error', 'INVALID_REQUEST');
  end if;

  if v_patch ? 'release_channel'
     and coalesce(v_patch ->> 'release_channel', '') not in ('stable', 'beta') then
    return jsonb_build_object('data', null, 'error', 'INVALID_REQUEST');
  end if;

  select status
  into v_existing_status
  from public.tenants
  where id = p_tenant_id
  for update;

  if not found then
    return jsonb_build_object('data', null, 'error', 'TENANT_NOT_FOUND');
  end if;

  for v_domain in
    select item.value
    from jsonb_array_elements(v_domains) as item(value)
  loop
    if jsonb_typeof(v_domain) <> 'object' then
      return jsonb_build_object('data', null, 'error', 'INVALID_REQUEST');
    end if;

    v_hostname := lower(trim(coalesce(v_domain ->> 'hostname', '')));
    v_surface := coalesce(v_domain ->> 'surface', '');
    v_status := coalesce(nullif(v_domain ->> 'status', ''), 'pending');
    v_dns_status := nullif(v_domain ->> 'dns_status', '');
    v_ssl_status := nullif(v_domain ->> 'ssl_status', '');

    if v_hostname = ''
       or v_surface not in ('patient', 'ops')
       or v_status not in ('pending', 'active', 'disabled')
       or (v_dns_status is not null and v_dns_status not in ('verified', 'pending', 'failed'))
       or (v_ssl_status is not null and v_ssl_status not in ('issued', 'pending', 'failed')) then
      return jsonb_build_object('data', null, 'error', 'INVALID_REQUEST');
    end if;

    v_is_local_domain := v_hostname like 'localhost:%' or v_hostname like '127.0.0.1:%';
    if v_status = 'active' and not (v_is_local_domain or (v_dns_status = 'verified' and v_ssl_status = 'issued')) then
      v_status := 'pending';
    end if;

    select id, tenant_id
    into v_domain_id, v_domain_tenant_id
    from public.tenant_domains
    where lower(hostname) = v_hostname
    for update;

    if found and v_domain_tenant_id <> p_tenant_id then
      return jsonb_build_object(
        'data', null,
        'error', 'DOMAIN_TAKEN',
        'details', jsonb_build_object('hostname', v_hostname)
      );
    end if;

    if found then
      update public.tenant_domains
      set tenant_id = p_tenant_id,
          hostname = v_hostname,
          surface = v_surface,
          status = v_status,
          dns_status = v_dns_status,
          ssl_status = v_ssl_status,
          verified_at = case
            when v_status = 'active' and verified_at is null then now()
            else verified_at
          end
      where id = v_domain_id;
    else
      insert into public.tenant_domains (
        tenant_id,
        hostname,
        surface,
        status,
        dns_status,
        ssl_status,
        verified_at
      )
      values (
        p_tenant_id,
        v_hostname,
        v_surface,
        v_status,
        v_dns_status,
        v_ssl_status,
        case when v_status = 'active' then now() else null end
      );
    end if;

    v_domain_count := v_domain_count + 1;
  end loop;

  if cardinality(v_patch_keys) > 0 then
    update public.tenants
    set display_name = case when v_patch ? 'display_name' then trim(v_patch ->> 'display_name') else display_name end,
        status = case when v_patch ? 'status' then v_patch ->> 'status' else status end,
        plan = case when v_patch ? 'plan' then v_patch ->> 'plan' else plan end,
        release_channel = case when v_patch ? 'release_channel' then v_patch ->> 'release_channel' else release_channel end,
        schema_version = case when v_patch ? 'schema_version' then v_patch ->> 'schema_version' else schema_version end,
        notes = case when v_patch ? 'notes' then v_patch ->> 'notes' else notes end
    where id = p_tenant_id;
  end if;

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

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'tenant_id', tenant_id,
      'hostname', hostname,
      'surface', surface,
      'status', status,
      'dns_status', dns_status,
      'ssl_status', ssl_status,
      'verified_at', verified_at
    )
    order by created_at
  ), '[]'::jsonb)
  into v_updated_domains
  from public.tenant_domains
  where tenant_id = p_tenant_id;

  insert into public.tenant_events (
    tenant_id,
    event_type,
    actor_id,
    metadata
  )
  values (
    p_tenant_id,
    'tenant.updated',
    p_actor_id,
    jsonb_build_object(
      'patchKeys', to_jsonb(v_patch_keys),
      'domainCount', v_domain_count,
      'atomic', true
    )
  );

  return jsonb_build_object(
    'data', jsonb_build_object(
      'tenant', v_tenant,
      'domains', v_updated_domains
    ),
    'error', null
  );
exception
  when unique_violation then
    return jsonb_build_object('data', null, 'error', 'DOMAIN_TAKEN');
  when check_violation then
    if position('TENANT_ACTIVATION_REQUIRES_ACTIVE_DOMAIN' in sqlerrm) > 0 then
      return jsonb_build_object('data', null, 'error', 'TENANT_ACTIVATION_BLOCKED');
    end if;

    if position('INVALID_TENANT_STATUS_TRANSITION' in sqlerrm) > 0
       or position('INVALID_TENANT_INITIAL_STATUS' in sqlerrm) > 0 then
      return jsonb_build_object('data', null, 'error', 'INVALID_TENANT_STATUS_TRANSITION');
    end if;

    return jsonb_build_object('data', null, 'error', 'TENANT_UPDATE_FAILED');
  when others then
    return jsonb_build_object('data', null, 'error', 'TENANT_UPDATE_FAILED');
end;
$$;

revoke all on function public.admin_update_tenant_atomic(uuid, uuid, jsonb, jsonb) from public;
revoke execute on function public.admin_update_tenant_atomic(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.admin_update_tenant_atomic(uuid, uuid, jsonb, jsonb) to service_role;

comment on function public.admin_update_tenant_atomic(uuid, uuid, jsonb, jsonb) is
  'Private service-role RPC for atomic tenant/domain metadata updates. NO PHI.';

insert into public.tenant_events (tenant_id, event_type, metadata)
select null, 'control_plane.atomic_tenant_update_applied', jsonb_build_object(
  'function', 'admin_update_tenant_atomic',
  'serviceRoleOnly', true,
  'phi', false
)
where not exists (
  select 1
  from public.tenant_events
  where event_type = 'control_plane.atomic_tenant_update_applied'
);
