-- DoctoLeb Control Plane · normalize_tenant_auth_settings provisioning step
-- Inserts a new step between seed_tenant_profile and seed_first_doctor_admin
-- so newly provisioned tenants get their Supabase Auth config normalized
-- (OTP length 8, redirect URL allowlist, site URL) before the first doctor
-- invite is sent. The runner Edge Function uses the tenant's Supabase provider
-- connection PAT to call the Supabase Management API. No raw tokens are
-- stored in control-plane tables.

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
        'normalize_tenant_auth_settings',
        'supabase',
        'pending',
        jsonb_build_object('requiresSupabaseProject', true, 'requiresSupabaseConnection', true),
        jsonb_build_object('tenantAuthConfigNormalized', false),
        'restore_previous_value',
        jsonb_build_object('restorePreviousAuthConfig', true, 'externalResourceKind', 'supabase_auth_config'),
        null
      ),
      (
        'seed_first_doctor_admin',
        'tenant_db',
        'pending',
        jsonb_build_object('requiresTenantProfile', true, 'requiresTenantAuthConfigNormalized', true),
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

comment on function public.admin_seed_tenant_provisioning_steps(uuid, uuid, text, uuid, uuid) is
  'Seeds the canonical provisioning step ledger for a tenant job. As of 2026-05-13 this includes normalize_tenant_auth_settings between seed_tenant_profile and seed_first_doctor_admin so first-doctor invite emails use a normalized Supabase Auth config (OTP length 8, redirect URL allowlist).';
