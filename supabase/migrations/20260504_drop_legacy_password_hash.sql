begin;

-- Passwords are owned exclusively by Supabase Auth (`auth.users`).
-- The legacy public profile column is not used by login and must not remain
-- exposed in the API schema.
alter table public.users
  drop column if exists password_hash;

commit;
