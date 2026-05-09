-- DoctoLeb Control Plane · provider-aware tenant draft steps
-- Extends tenant draft creation so a SaaS operator can select provider
-- connections and receive an undoable provisioning step ledger immediately.
-- This migration does not call external provider APIs. The future runner will
-- execute these idempotent steps server-side using secret references only.

create or replace function public.admin_seed_tenant_provisioning_steps(
  p_provisioning_job_id uuid,
  p_tenant_id uuid,
  p_automation_mode text,
  p_supabase_connection_id uuid default null,
  p_vercel_connection_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text := lower(trim(coalesce(p_automation_mode, 'manual')));
  v_connections_selected boolean := p_supabase_connection_id is not null or p_vercel_connection_id is not null;
begin
  if p_provisioning_job_id is null or p_tenant_id is null then
    raise exception 'INVALID_REQUEST';
  end if;

  if v_mode not in ('manual', 'assisted', 'automatic') then
    raise exception 'INVALID_REQUEST';
  end if;

  insert into public.tenant_provisioning_steps (
    provisioning_job_id,
    tenant_id,
    step_code,
    provider,
    status,
    idempotency_key,
    preconditions,
    postconditions,
    undo_strategy,
    undo_payload,
    completed_at
  )
  select
    p_provisioning_job_id,
    p_tenant_id,
    step_code,
    provider,
    status,
    p_provisioning_job_id::text || ':' || step_code,
    preconditions,
    postconditions,
    undo_strategy,
    undo_payload,
    completed_at
  from (
    values
      (
        'tenant_draft_created',
        'doctoleb',
        'succeeded',
        jsonb_build_object('tenantId', p_tenant_id),
        jsonb_build_object('tenantDraftCreated', true),
        'manual_review',
        jsonb_build_object('recommendedUndo', 'archive_tenant_and_pending_domains', 'tenantId', p_tenant_id),
        now()
      ),
      (
        'provider_connections_selected',
        'doctoleb',
        case when v_connections_selected then 'succeeded' else 'pending' end,
        jsonb_build_object('automationMode', v_mode),
        jsonb_build_object(
          'supabaseConnectionId', p_supabase_connection_id,
          'vercelConnectionId', p_vercel_connection_id,
          'connectionsSelected', v_connections_selected
        ),
        'restore_previous_value',
        jsonb_build_object('previousSupabaseConnectionId', null, 'previousVercelConnectionId', null),
        case when v_connections_selected then now() else null end
      ),
      (
        'create_supabase_project',
        'supabase',
        'pending',
        jsonb_build_object('requiresSupabaseConnection', true, 'automationMode', v_mode),
        jsonb_build_object('projectRefStoredInRuntimeConfig', false),
        'delete_external_resource',
        jsonb_build_object('requiresManualApprovalBeforeDelete', true, 'externalResourceKind', 'supabase_project'),
        null
      ),
      (
        'apply_tenant_migrations',
        'tenant_db',
        'pending',
        jsonb_build_object('requiresSupabaseProject', true),
        jsonb_build_object('tenantMigrationsApplied', false),
        'manual_review',
        jsonb_build_object('recommendedUndo', 'restore_database_from_pre_migration_backup'),
        null
      ),
      (
        'seed_tenant_profile',
        'tenant_db',
        'pending',
        jsonb_build_object('requiresTenantMigrations', true),
        jsonb_build_object('tenantProfileSeeded', false, 'tenantAppConfigSeeded', false),
        'restore_previous_value',
        jsonb_build_object('restoreTenantProfileSnapshot', true, 'restoreTenantAppConfigSnapshot', true),
        null
      ),
      (
        'seed_first_doctor_admin',
        'tenant_db',
        'pending',
        jsonb_build_object('requiresTenantProfile', true),
        jsonb_build_object('firstDoctorAdminInviteCreated', false),
        'disable_external_resource',
        jsonb_build_object('recommendedUndo', 'disable_first_doctor_admin_invite'),
        null
      ),
      (
        'configure_vercel_project',
        'vercel',
        'pending',
        jsonb_build_object('requiresVercelConnection', true, 'domainCanRemainPending', true),
        jsonb_build_object('routingConfigured', false),
        'restore_previous_value',
        jsonb_build_object('restorePreviousVercelEnvAndDomainState', true),
        null
      ),
      (
        'store_runtime_config',
        'doctoleb',
        'pending',
        jsonb_build_object('requiresTenantAnonKey', true),
        jsonb_build_object('resolverRuntimeConfigStored', false),
        'restore_previous_value',
        jsonb_build_object('restorePreviousTenantRuntimeConfig', true),
        null
      ),
      (
        'smoke_test_resolver',
        'doctoleb',
        'pending',
        jsonb_build_object('requiresRuntimeConfig', true),
        jsonb_build_object('resolverSmokePassed', false),
        'none',
        '{}'::jsonb,
        null
      ),
      (
        'activate_tenant',
        'doctoleb',
        'pending',
        jsonb_build_object('requiresResolverSmoke', true, 'requiresRuntimeConfig', true),
        jsonb_build_object('tenantActivated', false),
        'restore_previous_value',
        jsonb_build_object('previousTenantStatus', 'draft', 'previousDomainStatuses', 'pending'),
        null
      )
  ) as steps(
    step_code,
    provider,
    status,
    preconditions,
    postconditions,
    undo_strategy,
    undo_payload,
    completed_at
  )
  on conflict (provisioning_job_id, step_code) do nothing;
end;
$$;

revoke all on function public.admin_seed_tenant_provisioning_steps(uuid, uuid, text, uuid, uuid) from public;
revoke execute on function public.admin_seed_tenant_provisioning_steps(uuid, uuid, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_seed_tenant_provisioning_steps(uuid, uuid, text, uuid, uuid) to service_role;

create or replace function public.admin_create_tenant_draft_atomic(
  p_actor_id uuid,
  p_client_request_id uuid,
  p_requested_slug text,
  p_requested_display_name text,
  p_requested_plan text default 'starter',
  p_requested_domains jsonb default '[]'::jsonb,
  p_initial_branding jsonb default '{}'::jsonb,
  p_supabase_connection_id uuid default null,
  p_vercel_connection_id uuid default null,
  p_automation_mode text default 'manual'
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
  v_automation_mode text := lower(trim(coalesce(nullif(p_automation_mode, ''), 'manual')));
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
     or jsonb_typeof(v_initial_branding) <> 'object'
     or v_automation_mode not in ('manual', 'assisted', 'automatic') then
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

  if p_supabase_connection_id is not null then
    if not exists (
      select 1
      from public.provisioning_provider_connections
      where id = p_supabase_connection_id
        and provider = 'supabase'
    ) then
      return jsonb_build_object('data', null, 'error', 'INVALID_PROVIDER_CONNECTION');
    end if;

    if not exists (
      select 1
      from public.provisioning_provider_connections
      where id = p_supabase_connection_id
        and provider = 'supabase'
        and status = 'active'
        and is_automation_enabled = true
        and secret_storage <> 'none'
        and nullif(trim(coalesce(secret_ref, '')), '') is not null
    ) then
      return jsonb_build_object('data', null, 'error', 'PROVIDER_CONNECTION_NOT_READY');
    end if;
  end if;

  if p_vercel_connection_id is not null then
    if not exists (
      select 1
      from public.provisioning_provider_connections
      where id = p_vercel_connection_id
        and provider = 'vercel'
    ) then
      return jsonb_build_object('data', null, 'error', 'INVALID_PROVIDER_CONNECTION');
    end if;

    if not exists (
      select 1
      from public.provisioning_provider_connections
      where id = p_vercel_connection_id
        and provider = 'vercel'
        and status = 'active'
        and is_automation_enabled = true
        and secret_storage <> 'none'
        and nullif(trim(coalesce(secret_ref, '')), '') is not null
    ) then
      return jsonb_build_object('data', null, 'error', 'PROVIDER_CONNECTION_NOT_READY');
    end if;
  end if;

  if v_automation_mode in ('assisted', 'automatic')
     and (p_supabase_connection_id is null or p_vercel_connection_id is null) then
    return jsonb_build_object('data', null, 'error', 'PROVIDER_CONNECTION_REQUIRED');
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
      supabase_connection_id,
      vercel_connection_id,
      requested_slug,
      requested_display_name,
      requested_plan,
      requested_domains,
      initial_branding,
      status,
      automation_mode,
      automation_status,
      provider_state,
      checklist,
      assigned_admin_id
    )
    values (
      p_client_request_id::text,
      v_tenant_id,
      p_supabase_connection_id,
      p_vercel_connection_id,
      v_slug,
      v_display_name,
      v_plan,
      v_domains,
      v_initial_branding,
      'ready_for_manual_provisioning',
      v_automation_mode,
      case when v_automation_mode = 'manual' then 'not_started' else 'ready' end,
      jsonb_build_object(
        'automationMode', v_automation_mode,
        'supabaseConnectionId', p_supabase_connection_id,
        'vercelConnectionId', p_vercel_connection_id,
        'runnerImplemented', false,
        'phi', false
      ),
      jsonb_build_object(
        'createControlPlaneTenantDraft', true,
        'addPendingDomainRows', v_domain_count > 0,
        'choosePlan', true,
        'selectProviderConnections', p_supabase_connection_id is not null or p_vercel_connection_id is not null,
        'seedProvisioningSteps', true,
        'createSupabaseProject', false,
        'applyTenantMigrations', false,
        'seedTenantProfile', false,
        'seedFirstDoctorAdmin', false,
        'configureStorageAndFunctions', false,
        'configureVercelRouting', false,
        'storeTenantRuntimeConfig', false,
        'smokeTestResolver', false,
        'activateTenant', false
      ),
      p_actor_id
    )
    returning id into v_job_id;

    perform public.admin_seed_tenant_provisioning_steps(
      v_job_id,
      v_tenant_id,
      v_automation_mode,
      p_supabase_connection_id,
      p_vercel_connection_id
    );

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
        'automationMode', v_automation_mode,
        'supabaseConnectionSelected', p_supabase_connection_id is not null,
        'vercelConnectionSelected', p_vercel_connection_id is not null,
        'domainCount', v_domain_count,
        'runtimeConfigured', false,
        'provisioningStepsSeeded', true,
        'phi', false
      )
    );
  else
    perform public.admin_seed_tenant_provisioning_steps(
      v_job_id,
      v_tenant_id,
      v_automation_mode,
      p_supabase_connection_id,
      p_vercel_connection_id
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
    'supabase_connection_id', supabase_connection_id,
    'vercel_connection_id', vercel_connection_id,
    'requested_slug', requested_slug,
    'requested_display_name', requested_display_name,
    'requested_plan', requested_plan,
    'requested_domains', requested_domains,
    'initial_branding', initial_branding,
    'status', status,
    'automation_mode', automation_mode,
    'automation_status', automation_status,
    'provider_state', provider_state,
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

revoke all on function public.admin_create_tenant_draft_atomic(uuid, uuid, text, text, text, jsonb, jsonb, uuid, uuid, text) from public;
revoke execute on function public.admin_create_tenant_draft_atomic(uuid, uuid, text, text, text, jsonb, jsonb, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_create_tenant_draft_atomic(uuid, uuid, text, text, text, jsonb, jsonb, uuid, uuid, text) to service_role;

comment on function public.admin_seed_tenant_provisioning_steps(uuid, uuid, text, uuid, uuid) is
  'Private service-role helper that creates an undoable zero-PHI provisioning step ledger.';

comment on function public.admin_create_tenant_draft_atomic(uuid, uuid, text, text, text, jsonb, jsonb, uuid, uuid, text) is
  'Private service-role RPC for provider-aware zero-PHI tenant draft creation. NO PHI.';

insert into public.tenant_events (tenant_id, event_type, metadata)
select null, 'control_plane.provider_aware_draft_steps_applied', jsonb_build_object(
  'function', 'admin_create_tenant_draft_atomic',
  'stepLedgerSeeded', true,
  'providerConnectionSelection', true,
  'serviceRoleOnly', true,
  'phi', false
)
where not exists (
  select 1
  from public.tenant_events
  where event_type = 'control_plane.provider_aware_draft_steps_applied'
);
