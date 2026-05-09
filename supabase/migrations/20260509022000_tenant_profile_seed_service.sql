-- Tenant profile seed service for SaaS provisioning.
-- Keeps tenant branding/profile data seedable before the first doctor/admin exists.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tenant_profile'
      and column_name = 'doctor_id'
      and is_nullable = 'NO'
  ) then
    alter table public.tenant_profile
      alter column doctor_id drop not null;
  end if;
end $$;

create or replace function public.service_seed_tenant_profile(
  p_tenant_slug text,
  p_display_name text,
  p_branding jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_slug text := lower(trim(coalesce(p_tenant_slug, '')));
  v_display_name text := trim(coalesce(p_display_name, ''));
  v_branding jsonb := coalesce(p_branding, '{}'::jsonb);
  v_enabled_locales text[] := array['en']::text[];
  v_default_locale text := 'en';
  v_primary_color text := nullif(trim(coalesce(v_branding ->> 'primary_color', '')), '');
  v_secondary_color text := nullif(trim(coalesce(v_branding ->> 'secondary_color', '')), '');
  v_splash_logo_url text := nullif(left(trim(coalesce(v_branding ->> 'splash_logo_url', '')), 2000), '');
  v_icon_url text := nullif(left(trim(coalesce(v_branding ->> 'icon_url', '')), 2000), '');
  v_profile record;
  v_app_config record;
begin
  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     or v_display_name = ''
     or char_length(v_display_name) > 160
     or jsonb_typeof(v_branding) <> 'object' then
    return jsonb_build_object('data', null, 'error', 'INVALID_REQUEST');
  end if;

  if jsonb_typeof(v_branding -> 'enabled_locales') = 'array' then
    select coalesce(array_agg(locale_value), array['en']::text[])
    into v_enabled_locales
    from (
      select distinct lower(trim(value)) as locale_value
      from jsonb_array_elements_text(v_branding -> 'enabled_locales') as value
      where lower(trim(value)) ~ '^[a-z]{2}(-[a-z]{2})?$'
      order by 1
    ) as normalized_locales;
  end if;

  v_default_locale := coalesce(v_enabled_locales[1], 'en');
  v_primary_color := case when v_primary_color ~ '^#[0-9A-Fa-f]{6}$' then v_primary_color else null end;
  v_secondary_color := case when v_secondary_color ~ '^#[0-9A-Fa-f]{6}$' then v_secondary_color else null end;
  v_splash_logo_url := case when v_splash_logo_url ~ '^https://[^[:space:]]+$' then v_splash_logo_url else null end;
  v_icon_url := case when v_icon_url ~ '^https://[^[:space:]]+$' then v_icon_url else null end;

  insert into public.tenant_profile (
    tenant_slug,
    display_name,
    default_locale,
    schema_version,
    status
  )
  values (
    v_slug,
    v_display_name,
    v_default_locale,
    'tier2',
    'active'
  )
  on conflict (tenant_slug) do update
    set display_name = excluded.display_name,
        default_locale = excluded.default_locale,
        updated_at = now()
  returning id, tenant_slug, display_name, default_locale, status, schema_version
  into v_profile;

  insert into public.tenant_app_config (
    profile_id,
    app_name,
    app_tagline,
    splash_logo_url,
    icon_url,
    primary_color,
    secondary_color,
    support_phone,
    support_email,
    enabled_locales,
    maintenance_message
  )
  values (
    v_profile.id,
    coalesce(nullif(left(trim(coalesce(v_branding ->> 'app_name', '')), 160), ''), v_display_name),
    nullif(left(trim(coalesce(v_branding ->> 'app_tagline', '')), 240), ''),
    v_splash_logo_url,
    v_icon_url,
    v_primary_color,
    v_secondary_color,
    nullif(left(trim(coalesce(v_branding ->> 'support_phone', '')), 80), ''),
    nullif(left(trim(coalesce(v_branding ->> 'support_email', '')), 240), ''),
    v_enabled_locales,
    nullif(left(trim(coalesce(v_branding ->> 'maintenance_message', '')), 1000), '')
  )
  on conflict (profile_id) do update
    set app_name = excluded.app_name,
        app_tagline = excluded.app_tagline,
        splash_logo_url = excluded.splash_logo_url,
        icon_url = excluded.icon_url,
        primary_color = excluded.primary_color,
        secondary_color = excluded.secondary_color,
        support_phone = excluded.support_phone,
        support_email = excluded.support_email,
        enabled_locales = excluded.enabled_locales,
        maintenance_message = excluded.maintenance_message,
        updated_at = now()
  returning id, profile_id, app_name
  into v_app_config;

  return jsonb_build_object(
    'data', jsonb_build_object(
      'profileId', v_profile.id,
      'appConfigId', v_app_config.id,
      'tenantSlug', v_profile.tenant_slug,
      'tenantProfileSeeded', true,
      'tenantAppConfigSeeded', true
    ),
    'error', null
  );
end;
$$;

revoke all on function public.service_seed_tenant_profile(text, text, jsonb) from public;
revoke execute on function public.service_seed_tenant_profile(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.service_seed_tenant_profile(text, text, jsonb) to service_role;

comment on function public.service_seed_tenant_profile(text, text, jsonb) is
  'Service-role-only seed path for SaaS provisioning. Creates or updates tenant_profile and tenant_app_config before first doctor/admin creation without storing PHI.';
