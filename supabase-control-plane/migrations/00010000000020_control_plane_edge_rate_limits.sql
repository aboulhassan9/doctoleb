-- DoctoLeb Control Plane · Edge Function rate limiting
--
-- Stores only zero-PHI operational counters for Supabase Edge Functions.
-- Raw IP addresses, emails, tokens, request bodies, and clinical content must
-- never be inserted here. Edge Functions pass a SHA-256 hash of their rate
-- key plus safe route metadata.

create table if not exists public.edge_rate_limit_buckets (
  id bigserial primary key,
  route text not null,
  key_hash text not null,
  window_start timestamptz not null,
  window_seconds integer not null,
  request_count integer not null default 1,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint edge_rate_limit_route_chk check (
    route = lower(route)
    and route ~ '^[a-z0-9][a-z0-9_-]{0,119}$'
  ),
  constraint edge_rate_limit_key_hash_chk check (
    key_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint edge_rate_limit_window_seconds_chk check (
    window_seconds between 10 and 3600
  ),
  constraint edge_rate_limit_request_count_chk check (
    request_count >= 0
  )
);

create unique index if not exists edge_rate_limit_bucket_unique_idx
  on public.edge_rate_limit_buckets (route, key_hash, window_start, window_seconds);

create index if not exists edge_rate_limit_buckets_expires_idx
  on public.edge_rate_limit_buckets (expires_at);

alter table public.edge_rate_limit_buckets enable row level security;

revoke all on table public.edge_rate_limit_buckets from public, anon, authenticated;
grant select, insert, update, delete on table public.edge_rate_limit_buckets to service_role;

create or replace function public.check_edge_rate_limit(
  p_route text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_route text := lower(trim(coalesce(p_route, '')));
  v_key_hash text := lower(trim(coalesce(p_key_hash, '')));
  v_limit integer := greatest(1, least(coalesce(p_limit, 60), 10000));
  v_window_seconds integer := greatest(10, least(coalesce(p_window_seconds, 60), 3600));
  v_window_start timestamptz;
  v_reset_at timestamptz;
  v_count integer;
begin
  if v_route !~ '^[a-z0-9][a-z0-9_-]{0,119}$' or v_key_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object(
      'data', null,
      'error', 'INVALID_RATE_LIMIT_KEY'
    );
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / v_window_seconds) * v_window_seconds
  );
  v_reset_at := v_window_start + make_interval(secs => v_window_seconds);

  if random() < 0.01 then
    delete from public.edge_rate_limit_buckets
    where expires_at < now();
  end if;

  insert into public.edge_rate_limit_buckets (
    route,
    key_hash,
    window_start,
    window_seconds,
    request_count,
    expires_at
  )
  values (
    v_route,
    v_key_hash,
    v_window_start,
    v_window_seconds,
    1,
    v_reset_at + interval '5 minutes'
  )
  on conflict (route, key_hash, window_start, window_seconds)
  do update set
    request_count = public.edge_rate_limit_buckets.request_count + 1,
    expires_at = excluded.expires_at,
    updated_at = now()
  returning request_count into v_count;

  return jsonb_build_object(
    'data', jsonb_build_object(
      'allowed', v_count <= v_limit,
      'limit', v_limit,
      'remaining', greatest(v_limit - v_count, 0),
      'resetAt', v_reset_at,
      'retryAfterSeconds', greatest(ceil(extract(epoch from (v_reset_at - now())))::integer, 1)
    ),
    'error', null
  );
exception
  when others then
    return jsonb_build_object(
      'data', null,
      'error', 'RATE_LIMIT_CHECK_FAILED'
    );
end;
$$;

revoke all on function public.check_edge_rate_limit(text, text, integer, integer) from public;
revoke execute on function public.check_edge_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_edge_rate_limit(text, text, integer, integer) to service_role;

comment on table public.edge_rate_limit_buckets is
  'Zero-PHI Edge Function rate-limit buckets. Stores route names, hashed keys, counts, and expiry only.';

comment on function public.check_edge_rate_limit(text, text, integer, integer) is
  'Private service-role RPC that increments and evaluates a zero-PHI Edge Function rate-limit bucket.';

insert into public.tenant_events (tenant_id, event_type, metadata)
select null, 'control_plane.edge_rate_limits_applied', jsonb_build_object(
  'table', 'edge_rate_limit_buckets',
  'function', 'check_edge_rate_limit',
  'serviceRoleOnly', true,
  'rawIpStored', false,
  'phi', false
)
where not exists (
  select 1
  from public.tenant_events
  where event_type = 'control_plane.edge_rate_limits_applied'
);
