begin;

-- Function EXECUTE is granted to PUBLIC by default unless explicitly revoked.
-- Revoke both PUBLIC and anon so the slot-booking RPC is authenticated-only.
revoke execute on function public.book_slot(uuid, uuid, uuid, text, text, integer) from public;
revoke execute on function public.book_slot(uuid, uuid, uuid, text, text, integer) from anon;

grant execute on function public.book_slot(uuid, uuid, uuid, text, text, integer) to authenticated, service_role;

commit;
