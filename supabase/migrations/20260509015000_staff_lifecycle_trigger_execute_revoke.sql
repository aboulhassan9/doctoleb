-- Staff lifecycle trigger helper execution hardening.
--
-- Trigger functions are implementation details. They must run only through
-- their owning table triggers, not through PostgREST RPC calls.

revoke all on function public.enforce_staff_members_server_lifecycle()
from public, anon, authenticated;

revoke all on function public.handle_auth_user_created()
from public, anon, authenticated;
