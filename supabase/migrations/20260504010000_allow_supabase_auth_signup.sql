begin;

-- Supabase Auth owns passwords now. Keep the legacy column only for historical
-- compatibility until a later cleanup migration can remove it entirely.
alter table public.users
  alter column password_hash drop not null;

commit;
