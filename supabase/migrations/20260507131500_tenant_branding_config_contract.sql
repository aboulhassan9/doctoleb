begin;

-- Tenant branding is provisioned by the SaaS/control-plane workflow.
-- The tenant DB keeps only neutral fallbacks so new web/mobile clients do not
-- inherit platform or seed doctor branding before tenant config is filled.

alter table if exists public.tenant_app_config
  alter column app_name set default 'Clinic Portal';

update public.tenant_profile
set
  display_name = 'Clinic Portal',
  updated_at = now()
where lower(trim(display_name)) in ('doctoleb', 'doctor practice', 'dr. smith');

update public.tenant_app_config
set
  app_name = 'Clinic Portal',
  updated_at = now()
where lower(trim(app_name)) in ('doctoleb', 'doctor practice', 'dr. smith');

commit;
