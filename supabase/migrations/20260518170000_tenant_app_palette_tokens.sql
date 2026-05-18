begin;

alter table public.tenant_app_config
  add column if not exists accent_color text check (accent_color ~ '^#[0-9A-Fa-f]{6}$' or accent_color is null),
  add column if not exists surface_color text check (surface_color ~ '^#[0-9A-Fa-f]{6}$' or surface_color is null),
  add column if not exists text_color text check (text_color ~ '^#[0-9A-Fa-f]{6}$' or text_color is null);

comment on column public.tenant_app_config.accent_color is
  'Tenant-controlled accent color for patient-facing emphasis, payment/readiness states, and warm highlights.';
comment on column public.tenant_app_config.surface_color is
  'Tenant-controlled app surface color. Must remain zero-PHI and safe for public bootstrap.';
comment on column public.tenant_app_config.text_color is
  'Tenant-controlled primary text color for branded app surfaces.';

drop function if exists public.get_public_tenant_app_config();

create function public.get_public_tenant_app_config()
returns table (
  tenant_slug text,
  tenant_status text,
  display_name text,
  timezone text,
  default_locale text,
  app_name text,
  app_tagline text,
  splash_logo_url text,
  icon_url text,
  primary_color text,
  secondary_color text,
  accent_color text,
  surface_color text,
  text_color text,
  maintenance_message text,
  min_supported_version text,
  force_update_version text,
  enabled_locales text[],
  support_phone text,
  support_email text,
  doctor_display_name text,
  doctor_tagline text,
  doctor_logo_url text,
  doctor_contact_phone text,
  doctor_contact_email text,
  doctor_website_url text,
  doctor_about_md text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    tp.tenant_slug,
    tp.status,
    tp.display_name,
    tp.timezone,
    tp.default_locale,
    coalesce(tac.app_name, tp.display_name),
    tac.app_tagline,
    tac.splash_logo_url,
    tac.icon_url,
    coalesce(tac.primary_color, '#455548'),
    coalesce(tac.secondary_color, '#263126'),
    coalesce(tac.accent_color, '#9b6a3f'),
    coalesce(tac.surface_color, '#fcf9f2'),
    coalesce(tac.text_color, '#1c1c18'),
    tac.maintenance_message,
    tac.min_supported_version,
    tac.force_update_version,
    coalesce(tac.enabled_locales, array[tp.default_locale]::text[]),
    tac.support_phone,
    tac.support_email,
    nullif(trim(concat_ws(' ', u.first_name, u.last_name)), ''),
    coalesce(nullif(trim(d.specialization), ''), tac.app_tagline),
    tac.splash_logo_url,
    tac.support_phone,
    tac.support_email,
    null::text,
    null::text
  from public.tenant_profile as tp
  left join public.tenant_app_config as tac on tac.profile_id = tp.id
  left join public.doctors as d on d.id = tp.doctor_id
  left join public.users as u on u.id = d.user_id
  where tp.status in ('active', 'maintenance')
  order by tp.created_at asc
  limit 1;
$$;

revoke execute on function public.get_public_tenant_app_config() from public;
grant execute on function public.get_public_tenant_app_config() to anon, authenticated, service_role;

comment on function public.get_public_tenant_app_config() is
  'Public zero-PHI tenant branding contract. Includes patient/ops palette tokens from tenant_app_config.';

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
  v_accent_color text := nullif(trim(coalesce(v_branding ->> 'accent_color', '')), '');
  v_surface_color text := nullif(trim(coalesce(v_branding ->> 'surface_color', '')), '');
  v_text_color text := nullif(trim(coalesce(v_branding ->> 'text_color', '')), '');
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
  v_accent_color := case when v_accent_color ~ '^#[0-9A-Fa-f]{6}$' then v_accent_color else null end;
  v_surface_color := case when v_surface_color ~ '^#[0-9A-Fa-f]{6}$' then v_surface_color else null end;
  v_text_color := case when v_text_color ~ '^#[0-9A-Fa-f]{6}$' then v_text_color else null end;
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
    accent_color,
    surface_color,
    text_color,
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
    v_accent_color,
    v_surface_color,
    v_text_color,
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
        accent_color = excluded.accent_color,
        surface_color = excluded.surface_color,
        text_color = excluded.text_color,
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
  'Service-role-only seed path for SaaS provisioning. Creates or updates tenant_profile and tenant_app_config branding palette before first doctor/admin creation without storing PHI.';

commit;
