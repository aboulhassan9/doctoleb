-- Fix: revoke unauthenticated access to slot and booking RPCs.
-- The original migration granted these to anon, allowing any internet user
-- to enumerate doctor schedules and book/deactivate slots without authentication.
REVOKE EXECUTE ON FUNCTION public.get_available_slots(uuid, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.book_slot(uuid, uuid, uuid, text) FROM anon;
