-- Fix analytical-report RPC volatility.
--
-- The runtime compiler intentionally uses `set local statement_timeout = '5s'`
-- before executing dynamic aggregate SQL. PostgreSQL only allows SET inside
-- VOLATILE functions, so tenants that already received the runtime migration
-- need this additive repair migration before reports can execute.

alter function public.run_analytical_report(jsonb, jsonb) volatile;

comment on function public.run_analytical_report(jsonb, jsonb) is
  'Closed-set analytical-report compiler. VOLATILE because it sets a local statement_timeout before dynamic execution; SECURITY INVOKER preserves tenant RLS while returning aggregated rows as JSONB.';
