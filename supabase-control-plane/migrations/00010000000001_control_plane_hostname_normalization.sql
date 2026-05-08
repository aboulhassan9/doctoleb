-- ─── DoctoLeb Control Plane · hostname normalization hardening ───
-- Keeps tenant domain routing rows canonical at the database boundary.

create or replace function public.normalize_tenant_domain_hostname()
returns trigger
language plpgsql
as $$
begin
  new.hostname = lower(trim(new.hostname));
  return new;
end;
$$;

revoke all on function public.normalize_tenant_domain_hostname() from public;
revoke execute on function public.normalize_tenant_domain_hostname() from public, anon, authenticated;

update public.tenant_domains
set hostname = lower(trim(hostname))
where hostname <> lower(trim(hostname));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tenant_domains_hostname_normalized_chk'
      and conrelid = 'public.tenant_domains'::regclass
  ) then
    alter table public.tenant_domains
      add constraint tenant_domains_hostname_normalized_chk
      check (hostname = lower(trim(hostname)));
  end if;
end;
$$;

drop trigger if exists tenant_domains_normalize_hostname on public.tenant_domains;
create trigger tenant_domains_normalize_hostname
  before insert or update of hostname on public.tenant_domains
  for each row execute function public.normalize_tenant_domain_hostname();

revoke all on function public.touch_updated_at() from public;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
