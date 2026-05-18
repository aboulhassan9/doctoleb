-- Scheduled / automated analytical-report runs (review FEAT-4).
-- See docs/plans/clinical-documents-and-medication-catalog.md § 8B.
--
-- Goal:
--   Let a doctor / admin schedule a saved report to run automatically
--   (daily / weekly / monthly). Each scheduled execution lands in the
--   existing `analytical_report_runs` ledger, so the owner sees it in the
--   viewer's "Your recent runs" panel.
--
-- Architecture (free-hosting friendly — no always-on worker):
--   - `pg_cron` fires `run_due_report_schedules()` every 15 minutes.
--   - That executor is SECURITY DEFINER. It collects due schedules while
--     privileged, then DOWNGRADES to the `authenticated` role and runs each
--     report under the SCHEDULE OWNER's JWT claims. So `run_analytical_report`
--     (SECURITY INVOKER) is RLS-scoped exactly as if the owner ran it
--     manually — a scheduled run can never aggregate rows the owner could
--     not see. This is FAIL-CLOSED: if owner claims are missing the report
--     query simply returns nothing.
--
-- DEPLOY NOTE: the `pg_cron` setup at the bottom is best-effort. If the
-- extension is unavailable the migration still succeeds (table + executor
-- land); enable pg_cron and schedule run_due_report_schedules() manually.

------------------------------------------------------------------------
-- 1. analytical_report_schedules
------------------------------------------------------------------------

create table if not exists public.analytical_report_schedules (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.analytical_reports(id) on delete cascade,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  hour smallint not null default 8 check (hour between 0 and 23),
  -- weekly: 0 = Sunday … 6 = Saturday
  day_of_week smallint check (day_of_week is null or day_of_week between 0 and 6),
  -- monthly: capped at 28 so every month has the day
  day_of_month smallint check (day_of_month is null or day_of_month between 1 and 28),
  timezone text not null default 'UTC',
  is_active boolean not null default true,
  next_run_at timestamptz,
  last_run_at timestamptz,
  last_status text check (last_status is null or last_status in ('succeeded', 'failed')),
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One schedule per report keeps the viewer's Schedule panel unambiguous.
  unique (report_id),
  constraint analytical_report_schedules_weekly_dow_check
    check (frequency <> 'weekly' or day_of_week is not null),
  constraint analytical_report_schedules_monthly_dom_check
    check (frequency <> 'monthly' or day_of_month is not null)
);

-- Cron polls on this — only active, due rows.
create index if not exists analytical_report_schedules_due_idx
  on public.analytical_report_schedules (next_run_at)
  where is_active = true;

comment on table public.analytical_report_schedules is
  'Automated run schedules for analytical reports. pg_cron drives run_due_report_schedules(); each run lands in analytical_report_runs.';

------------------------------------------------------------------------
-- 2. compute_next_report_run — timezone-correct next occurrence
------------------------------------------------------------------------

create or replace function public.compute_next_report_run(
  p_frequency text,
  p_hour int,
  p_dow int,
  p_dom int,
  p_tz text,
  p_from timestamptz
)
returns timestamptz
language plpgsql
stable
as $$
declare
  v_tz text := coalesce(nullif(p_tz, ''), 'UTC');
  v_hour int := coalesce(p_hour, 8);
  v_next timestamptz;
  v_guard int := 0;
begin
  if p_frequency = 'daily' then
    v_next := (date_trunc('day', p_from at time zone v_tz)
               + make_interval(hours => v_hour)) at time zone v_tz;
    while v_next <= p_from loop
      v_next := v_next + interval '1 day';
    end loop;

  elsif p_frequency = 'weekly' then
    v_next := (date_trunc('day', p_from at time zone v_tz)
               + make_interval(hours => v_hour)) at time zone v_tz;
    while (v_next <= p_from
           or extract(dow from v_next at time zone v_tz)::int <> coalesce(p_dow, 1))
          and v_guard < 14 loop
      v_next := v_next + interval '1 day';
      v_guard := v_guard + 1;
    end loop;

  elsif p_frequency = 'monthly' then
    v_next := (date_trunc('month', p_from at time zone v_tz)
               + make_interval(days => coalesce(p_dom, 1) - 1, hours => v_hour)) at time zone v_tz;
    while v_next <= p_from loop
      v_next := (date_trunc('month', (v_next at time zone v_tz) + interval '1 month')
                 + make_interval(days => coalesce(p_dom, 1) - 1, hours => v_hour)) at time zone v_tz;
    end loop;

  else
    return null;
  end if;

  return v_next;
end;
$$;

grant execute on function public.compute_next_report_run(text, int, int, int, text, timestamptz)
  to authenticated;

------------------------------------------------------------------------
-- 3. Keep next_run_at in sync with the schedule definition
------------------------------------------------------------------------

create or replace function public.set_report_schedule_next_run()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT'
     or new.frequency is distinct from old.frequency
     or new.hour is distinct from old.hour
     or new.day_of_week is distinct from old.day_of_week
     or new.day_of_month is distinct from old.day_of_month
     or new.timezone is distinct from old.timezone
     or (new.is_active and not old.is_active) then
    new.next_run_at := public.compute_next_report_run(
      new.frequency, new.hour, new.day_of_week, new.day_of_month, new.timezone, now());
  end if;
  -- A paused schedule is never due.
  if not new.is_active then
    new.next_run_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists analytical_report_schedules_next_run on public.analytical_report_schedules;
create trigger analytical_report_schedules_next_run
before insert or update on public.analytical_report_schedules
for each row execute function public.set_report_schedule_next_run();

------------------------------------------------------------------------
-- 4. RLS — staff read; the report owner / admin manage
------------------------------------------------------------------------

alter table public.analytical_report_schedules enable row level security;

create policy analytical_report_schedules_staff_select on public.analytical_report_schedules
  for select using (
    (select is_staff()) or (select has_role(array['admin']))
  );

create policy analytical_report_schedules_owner_insert on public.analytical_report_schedules
  for insert with check (
    created_by = (select current_domain_user_id())
    and (
      (select has_role(array['admin']))
      or exists (
        select 1 from public.analytical_reports r
        where r.id = analytical_report_schedules.report_id
          and r.created_by = (select current_domain_user_id())
      )
    )
  );

create policy analytical_report_schedules_owner_update on public.analytical_report_schedules
  for update
  using (
    (select has_role(array['admin']))
    or created_by = (select current_domain_user_id())
  )
  with check (
    (select has_role(array['admin']))
    or created_by = (select current_domain_user_id())
  );

create policy analytical_report_schedules_owner_delete on public.analytical_report_schedules
  for delete using (
    (select has_role(array['admin']))
    or created_by = (select current_domain_user_id())
  );

------------------------------------------------------------------------
-- 5. run_due_report_schedules — the cron-driven executor
------------------------------------------------------------------------
--
-- SECURITY DEFINER so it can see every tenant's due schedules, but it
-- downgrades to `authenticated` before running any report so RLS scopes
-- each run to the schedule owner. The owner's identity is supplied via
-- `request.jwt.claims`, swapped per schedule.

create or replace function public.run_due_report_schedules()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_due jsonb;
  v_item jsonb;
  v_owner_auth uuid;
  v_rows jsonb;
  v_status text;
  v_started timestamptz;
begin
  -- Phase 1 (privileged): collect due schedules + each owner's auth id +
  -- the report's current published definition.
  select coalesce(jsonb_agg(jsonb_build_object(
           'schedule_id', s.id,
           'report_id',   s.report_id,
           'version_id',  v.id,
           'definition',  v.definition,
           'owner_id',    s.created_by,
           'owner_auth',  u.auth_user_id,
           'frequency',   s.frequency,
           'hour',        s.hour,
           'dow',         s.day_of_week,
           'dom',         s.day_of_month,
           'tz',          s.timezone
         )), '[]'::jsonb)
    into v_due
  from public.analytical_report_schedules s
  join public.users u on u.id = s.created_by
  join public.analytical_report_versions v
    on v.report_id = s.report_id
   and v.is_current = true
   and v.status = 'published'
  where s.is_active = true
    and s.next_run_at is not null
    and s.next_run_at <= now();

  -- Phase 2: drop privileges. Every report query below runs under RLS as
  -- `authenticated` — fail-closed if owner claims are missing.
  set local role authenticated;

  -- Phase 3: run each due schedule as its owner.
  for v_item in select value from jsonb_array_elements(v_due) loop
    v_owner_auth := nullif(v_item->>'owner_auth', '')::uuid;
    if v_owner_auth is null then
      continue; -- owner has no auth identity; skip
    end if;

    -- Impersonate the owner — RLS now scopes exactly as a manual run would.
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', v_owner_auth, 'role', 'authenticated')::text,
      true);

    v_started := clock_timestamp();
    v_status := 'succeeded';
    begin
      select coalesce(jsonb_agg(r), '[]'::jsonb)
        into v_rows
      from public.run_analytical_report((v_item->'definition')::jsonb, '{}'::jsonb) r;
    exception when others then
      v_status := 'failed';
      v_rows := null;
    end;

    insert into public.analytical_report_runs
      (report_id, version_id, filter_args, result_summary, status,
       requested_by, started_at, completed_at, latency_ms)
    values (
      (v_item->>'report_id')::uuid,
      (v_item->>'version_id')::uuid,
      '{}'::jsonb,
      case when v_status = 'succeeded' then jsonb_build_object('rows', v_rows) else null end,
      v_status,
      (v_item->>'owner_id')::uuid,
      v_started,
      clock_timestamp(),
      greatest(0, (extract(epoch from (clock_timestamp() - v_started)) * 1000)::int)
    );

    update public.analytical_report_schedules
       set last_run_at = now(),
           last_status = v_status,
           next_run_at = public.compute_next_report_run(
             v_item->>'frequency', (v_item->>'hour')::int,
             nullif(v_item->>'dow', '')::int, nullif(v_item->>'dom', '')::int,
             v_item->>'tz', now())
     where id = (v_item->>'schedule_id')::uuid;
  end loop;
end;
$$;

-- Only the cron job (which runs as the function owner) should call this.
revoke all on function public.run_due_report_schedules() from public;

comment on function public.run_due_report_schedules() is
  'Cron-driven. Runs every due report schedule under its owner''s RLS scope and records the result in analytical_report_runs.';

------------------------------------------------------------------------
-- 6. Schedule the executor via pg_cron (best-effort — see DEPLOY NOTE)
------------------------------------------------------------------------

do $$
begin
  execute 'create extension if not exists pg_cron';
  perform cron.schedule(
    'run-due-analytical-reports',
    '*/15 * * * *',
    'select public.run_due_report_schedules();');
exception when others then
  raise notice 'pg_cron scheduling skipped: %. Enable pg_cron and schedule public.run_due_report_schedules() every 15 minutes manually.', sqlerrm;
end
$$;
