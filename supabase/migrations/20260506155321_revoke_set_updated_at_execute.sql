-- Trigger functions do not need direct client EXECUTE privileges.

revoke execute on function public.set_updated_at() from anon, public, authenticated, service_role;
