create or replace function public.get_public_tenant_app_config()
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
    coalesce(tac.primary_color, '#0891b2'),
    coalesce(tac.secondary_color, '#0f172a'),
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
  'Public zero-PHI tenant branding contract. App name comes from tenant_app_config; linked doctor display comes from doctor/user metadata, never hardcoded.';
