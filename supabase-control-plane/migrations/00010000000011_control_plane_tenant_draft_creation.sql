-- DoctoLeb Control Plane · tenant draft creation
-- Creates a one-click, zero-PHI SaaS tenant draft transaction. Browser clients
-- still call the admin Edge Function; this RPC is service-role only.

alter table public.tenants
  alter column supabase_project_ref drop not null,
  alter column supabase_url drop not null,
  alter column supabase_anon_key drop not null;

alter table public.tenants
  drop constraint if exists tenants_active_runtime_config_required;

alter table public.tenants
  add constraint tenants_active_runtime_config_required
  check (
    status <> 'active'
    or (
      nullif(trim(coalesce(supabase_project_ref, '')), '') is not null
      and nullif(trim(coalesce(supabase_url, '')), '') is not null
      and nullif(trim(coalesce(supabase_anon_key, '')), '') is not null
    )
  );

create or replace function public.admin_create_tenant_draft_atomic(
  p_actor_id uuid,
  p_client_request_id uuid,
  p_requested_slug text,
  p_requested_display_name text,
  p_requested_plan text default 'starter',
  p_requested_domains jsonb default '[]'::jsonb,
  p_initial_branding jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text := lower(trim(coalesce(p_requested_slug, '')));
  v_display_name text := trim(coalesce(p_requested_display_name, ''));
  v_plan text := lower(trim(coalesce(nullif(p_requested_plan, ''), 'starter')));
  v_domains jsonb := coalesce(p_requested_domains, '[]'::jsonb);
  v_initial_branding jsonb := coalesce(p_initial_branding, '{}'::jsonb);
  v_domain jsonb;
  v_hostname text;
  v_surface text;
  v_seen_hosts text[] := array[]::text[];
  v_tenant_id uuid;
  v_existing_tenant_id uuid;
  v_job_id uuid;
  v_created boolean := true;
  v_domain_count integer := 0;
  v_tenant jsonb;
  v_domain_rows jsonb;
  v_job jsonb;
begin
  if p_actor_id is null then
    return jsonb_build_object('data', null, 'error', 'INVALID_REQUEST');
  end if;

  if v_slug !~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'
     or v_display_name = ''
     or jsonb_typeof(v_domains) <> 'array'
     or jsonb_typeof(v_initial_branding) <> 'object' then
    return jsonb_build_object('data', null, 'error', 'INVALID_REQUEST');
  end if;

  if not exists (
    select 1
    from public.plans
    where code = v_plan
      and status = 'active'
  ) then
    return jsonb_build_object('data', null, 'error', 'INVALID_PLAN');
  end if;

  if p_client_request_id is not null then
    select tenant_id, id
    into v_existing_tenant_id, v_job_id
    from public.tenant_provisioning_jobs
    where client_request_id = p_client_request_id::text;

    if found then
      if v_existing_tenant_id is null then
        return jsonb_build_object('data', null, 'error', 'TENANT_DRAFT_CREATE_FAILED');
      end if;

      v_tenant_id := v_existing_tenant_id;
      v_created := false;
    end if;
  end if;

  if v_tenant_id is null then
    for v_domain in
      select item.value
      from jsonb_array_elements(v_domains) as item(value)
    loop
      if jsonb_typeof(v_domain) <> 'object' then
        return jsonb_build_object('data', null, 'error', 'INVALID_REQUEST');
      end if;

      v_hostname := lower(trim(coalesce(v_domain ->> 'hostname', '')));
      v_surface := lower(trim(coalesce(v_domain ->> 'surface', '')));

      if v_hostname = ''
         or v_surface not in ('patient', 'ops')
         or v_hostname = any(v_seen_hosts) then
        return jsonb_build_object('data', null, 'error', 'INVALID_REQUEST');
      end if;

      v_seen_hosts := array_append(v_seen_hosts, v_hostname);

      if exists (
        select 1
        from public.tenant_domains
        where lower(hostname) = v_hostname
      ) then
        return jsonb_build_object(
          'data', null,
          'error', 'DOMAIN_TAKEN',
          'details', jsonb_build_object('hostname', v_hostname)
        );
      end if;
    end loop;

    v_seen_hosts := array[]::text[];

    insert into public.tenants (
      slug,
      display_name,
      status,
      plan,
      release_channel,
      supabase_project_ref,
      supabase_url,
      supabase_anon_key,
      schema_version,
      notes
    )
    values (
      v_slug,
      v_display_name,
      'draft',
      v_plan,
      'stable',
      null,
      null,
      null,
      null,
      'Created by SaaS tenant draft workflow. Runtime tenant database is not configured yet.'
    )
    returning id into v_tenant_id;

    for v_domain in
      select item.value
      from jsonb_array_elements(v_domains) as item(value)
    loop
      v_hostname := lower(trim(coalesce(v_domain ->> 'hostname', '')));
      v_surface := lower(trim(coalesce(v_domain ->> 'surface', '')));

      v_seen_hosts := array_append(v_seen_hosts, v_hostname);

      insert into public.tenant_domains (
        tenant_id,
        hostname,
        surface,
        status,
        dns_status,
        ssl_status
      )
      values (
        v_tenant_id,
        v_hostname,
        v_surface,
        'pending',
        case when v_hostname like 'localhost:%' or v_hostname like '127.0.0.1:%' then null else 'pending' end,
        case when v_hostname like 'localhost:%' or v_hostname like '127.0.0.1:%' then null else 'pending' end
      );

      v_domain_count := v_domain_count + 1;
    end loop;

    insert into public.tenant_provisioning_jobs (
      client_request_id,
      tenant_id,
      requested_slug,
      requested_display_name,
      requested_plan,
      requested_domains,
      initial_branding,
      status,
      checklist,
      assigned_admin_id
    )
    values (
      p_client_request_id::text,
      v_tenant_id,
      v_slug,
      v_display_name,
      v_plan,
      v_domains,
      v_initial_branding,
      'ready_for_manual_provisioning',
      jsonb_build_object(
        'createControlPlaneTenantDraft', true,
        'addPendingDomainRows', v_domain_count > 0,
        'choosePlan', true,
        'createSupabaseProject', false,
        'applyTenantMigrations', false,
        'seedTenantProfile', false,
        'seedFirstDoctorAdmin', false,
        'configureStorageAndFunctions', false,
        'storeTenantRuntimeConfig', false,
        'smokeTestResolver', false,
        'activateTenant', false
      ),
      p_actor_id
    )
    returning id into v_job_id;

    insert into public.tenant_events (
      tenant_id,
      event_type,
      actor_id,
      metadata
    )
    values (
      v_tenant_id,
      'tenant.draft_created',
      p_actor_id,
      jsonb_build_object(
        'jobId', v_job_id,
        'clientRequestId', p_client_request_id,
        'requestedSlug', v_slug,
        'requestedPlan', v_plan,
        'domainCount', v_domain_count,
        'runtimeConfigured', false,
        'phi', false
      )
    );
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
    'created_at', created_at,
    'updated_at', updated_at
  )
  into v_tenant
  from public.tenants
  where id = v_tenant_id;

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
  into v_domain_rows
  from public.tenant_domains
  where tenant_id = v_tenant_id;

  select jsonb_build_object(
    'id', id,
    'client_request_id', client_request_id,
    'tenant_id', tenant_id,
    'requested_slug', requested_slug,
    'requested_display_name', requested_display_name,
    'requested_plan', requested_plan,
    'requested_domains', requested_domains,
    'initial_branding', initial_branding,
    'status', status,
    'checklist', checklist,
    'assigned_admin_id', assigned_admin_id,
    'last_error', last_error,
    'created_at', created_at,
    'updated_at', updated_at,
    'completed_at', completed_at
  )
  into v_job
  from public.tenant_provisioning_jobs
  where id = v_job_id;

  return jsonb_build_object(
    'data', jsonb_build_object(
      'created', v_created,
      'tenant', v_tenant,
      'domains', v_domain_rows,
      'provisioningJob', v_job
    ),
    'error', null
  );
exception
  when unique_violation then
    if position('tenants_slug' in sqlerrm) > 0 then
      return jsonb_build_object('data', null, 'error', 'TENANT_SLUG_TAKEN');
    end if;

    return jsonb_build_object('data', null, 'error', 'DOMAIN_TAKEN');
  when check_violation then
    return jsonb_build_object('data', null, 'error', 'INVALID_REQUEST');
  when others then
    return jsonb_build_object('data', null, 'error', 'TENANT_DRAFT_CREATE_FAILED');
end;
$$;

revoke all on function public.admin_create_tenant_draft_atomic(uuid, uuid, text, text, text, jsonb, jsonb) from public;
revoke execute on function public.admin_create_tenant_draft_atomic(uuid, uuid, text, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.admin_create_tenant_draft_atomic(uuid, uuid, text, text, text, jsonb, jsonb) to service_role;

comment on function public.admin_create_tenant_draft_atomic(uuid, uuid, text, text, text, jsonb, jsonb) is
  'Private service-role RPC for one-click zero-PHI tenant draft creation. NO PHI.';

insert into public.tenant_events (tenant_id, event_type, metadata)
select null, 'control_plane.tenant_draft_creation_applied', jsonb_build_object(
  'function', 'admin_create_tenant_draft_atomic',
  'serviceRoleOnly', true,
  'activeRuntimeConfigRequired', true,
  'phi', false
)
where not exists (
  select 1
  from public.tenant_events
  where event_type = 'control_plane.tenant_draft_creation_applied'
);
