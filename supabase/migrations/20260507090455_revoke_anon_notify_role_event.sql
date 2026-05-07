-- The canonical role-notification RPC is for authenticated staff workflows only.
-- It performs its own role checks, but anon callers should not be able to reach
-- the SECURITY DEFINER body through PostgREST at all.

revoke execute on function public.notify_role_event(text, text, text, text, text, uuid, text)
  from anon;

revoke execute on function public.notify_role_event(text, text, text, text, text, uuid, text)
  from public;

grant execute on function public.notify_role_event(text, text, text, text, text, uuid, text)
  to authenticated, service_role;
