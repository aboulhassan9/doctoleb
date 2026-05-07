-- Backend contract audit queries.
-- Read-only. Run against a Supabase branch/local DB before backend contract freeze.

-- 1. Public inventory counts.
select 'tables' as item, count(*) as count
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'
union all
select 'functions', count(*)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
union all
select 'triggers', count(*)
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not t.tgisinternal
union all
select 'policies', count(*)
from pg_policies
where schemaname = 'public'
union all
select 'indexes', count(*)
from pg_indexes
where schemaname = 'public';

-- 2. Protected tables with RLS disabled.
select c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity = false
order by c.relname;

-- 3. RLS-enabled tables with no policies.
select c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p on p.schemaname = n.nspname and p.tablename = c.relname
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity = true
group by c.relname
having count(p.policyname) = 0
order by c.relname;

-- 4. Permissive bypass policies that should not exist in protected tables.
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and (
    qual in ('true', '(true)')
    or with_check in ('true', '(true)')
  )
order by tablename, policyname;

-- 5. Duplicate public function names. Expected result: zero rows.
select p.proname as function_name, count(*) as overload_count
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
group by p.proname
having count(*) > 1
order by overload_count desc, function_name;

-- 6. SECURITY DEFINER functions executable by anon.
select n.nspname as schema_name, p.proname as function_name, p.proacl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and has_function_privilege('anon', p.oid, 'execute')
order by p.proname;

-- 7. Foreign keys without a left-prefix index on the referencing columns.
with fk_cols as (
  select
    con.oid as constraint_oid,
    con.conname,
    con.conrelid,
    con.conrelid::regclass::text as table_name,
    array_agg(att.attname order by ord.ordinality) as columns,
    con.conkey
  from pg_constraint con
  join lateral unnest(con.conkey) with ordinality as ord(attnum, ordinality) on true
  join pg_attribute att on att.attrelid = con.conrelid and att.attnum = ord.attnum
  where con.contype = 'f'
  group by con.oid, con.conname, con.conrelid, con.conkey
),
indexed as (
  select
    fk.constraint_oid,
    exists (
      select 1
      from pg_index i
      where i.indrelid = fk.conrelid
        and (string_to_array(i.indkey::text, ' ')::smallint[])[1:array_length(fk.conkey, 1)] = fk.conkey
    ) as has_index
  from fk_cols fk
)
select fk.table_name, fk.conname, fk.columns
from fk_cols fk
join indexed i on i.constraint_oid = fk.constraint_oid
where not i.has_index
order by fk.table_name, fk.conname;

-- 8. Contract-critical status columns. Review enums/checks for duplicate lifecycle meanings.
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and column_name = 'status'
order by table_name;
