begin;

-- The app reads active drafts through the RLS-protected table select path.
-- Keep the read helper available only to service-role/server maintenance code.
revoke all on function public.get_active_clinical_note_draft(uuid) from public, anon, authenticated;
grant execute on function public.get_active_clinical_note_draft(uuid) to service_role;

commit;
