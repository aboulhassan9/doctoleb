-- ─── DoctoLeb Control Plane · internal helper execute hardening ───
-- Internal trigger helpers should run through triggers only, not as browser-callable RPCs.

revoke execute on function public.normalize_tenant_domain_hostname() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
