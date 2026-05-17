-- Analytical-report runtime engine.
--
-- The `run_analytical_report` function compiles a validated definition
-- JSON into a parameterized SQL query, executes it as the LOGGED-IN USER
-- (SECURITY INVOKER), and returns the aggregated rows as JSONB.
--
-- Safety model:
--   1. Closed-set whitelists for every identifier the function emits —
--      data sources, columns per source, aggregation functions, filter
--      operators, time granularities, sort directions. The function
--      raises an exception the moment a non-allowlisted identifier
--      arrives.
--   2. Every identifier is interpolated with `format('%I', ...)` so even
--      a misconfigured allowlist cannot escape SQL syntax.
--   3. Every literal goes through `format('%L', ...)` (single-value
--      filters) or is passed as a USING parameter (the array `in`/`not_in`
--      operators). No user value reaches the query as raw text.
--   4. SECURITY INVOKER means the underlying clinical/financial RLS still
--      applies — a secretary running "revenue by doctor" only sees the
--      payment rows her RLS lets her see. The function NEVER bypasses
--      that, even when called by an admin.
--   5. Result cardinality is capped at the definition's `limit` (max 1000
--      per the JS schema). The query also pre-trims via the WHERE clause
--      whenever filters are present.
--
-- This function is the single execution surface for analytical reports.
-- Adding a new data source means adding (a) its table name to the
-- `v_source_table` CASE, (b) its column allowlist to the
-- `v_allowed_columns` CASE, and (c) any source-specific default filter.

create or replace function public.run_analytical_report(
  p_definition jsonb,
  p_filter_args jsonb default '{}'::jsonb
)
returns setof jsonb
language plpgsql
security invoker
volatile
set search_path = public, pg_temp
as $$
declare
  v_data_source text;
  v_source_table text;
  v_allowed_columns text[];
  v_allowed_aggregations text[] := array['count','count_distinct','sum','avg','min','max'];
  v_allowed_operators text[] := array['eq','neq','gt','gte','lt','lte','in','not_in','is_null','not_null'];
  v_allowed_granularities text[] := array['day','week','month','quarter','year'];
  v_default_filters jsonb;
  v_group_by jsonb;
  v_aggregations jsonb;
  v_filters jsonb;
  v_order_by jsonb;
  v_limit int;
  v_select_parts text[] := array[]::text[];
  v_group_parts text[] := array[]::text[];
  v_filter_parts text[] := array[]::text[];
  v_order_parts text[] := array[]::text[];
  v_sql text;
  v_record jsonb;
  v_result_array text[] := array[]::text[];  -- not used; placeholder for future
  v_row record;
  v_col text;
  v_alias text;
  v_fn text;
  v_op text;
  v_value jsonb;
  v_bind_key text;
  v_array_values text[];
  v_granularity text;
  v_dir text;
  v_ref text;
  v_resolved_keys text[] := array[]::text[];
  i int;
  v_in_params text[] := array[]::text[];  -- collects array-typed literals for IN / NOT IN
begin
  -- 1. Data source allowlist + table resolution.
  v_data_source := coalesce(p_definition->>'dataSource', '');
  case v_data_source
    when 'appointments'    then v_source_table := 'public.appointments';   v_allowed_columns := array['id','doctor_id','patient_id','clinic_id','visit_type_id','scheduled_at','duration_minutes','status','booked_by','created_at','updated_at'];
    when 'encounters'      then v_source_table := 'public.encounters';     v_allowed_columns := array['id','appointment_id','patient_id','doctor_id','clinic_id','visit_type_id','status','started_at','ended_at','created_by','is_archived','created_at','updated_at'];
    when 'diagnoses'       then v_source_table := 'public.diagnoses';      v_allowed_columns := array['id','encounter_id','patient_id','doctor_id','disease_id','icd10_code','diagnosis_type','status','onset_date','resolved_at','recorded_by','is_archived','created_at','updated_at'];
    when 'prescriptions'   then v_source_table := 'public.prescriptions';  v_allowed_columns := array['id','encounter_id','patient_id','doctor_id','medication_catalog_id','route','frequency','duration','status','start_date','end_date','prescribed_by','is_archived','created_at','updated_at'];
    when 'lab_orders'      then v_source_table := 'public.lab_orders';     v_allowed_columns := array['id','encounter_id','patient_id','doctor_id','status','ordered_at','resulted_at','ordered_by','is_archived','created_at','updated_at'];
    when 'imaging_orders'  then v_source_table := 'public.imaging_orders'; v_allowed_columns := array['id','encounter_id','patient_id','doctor_id','imaging_type','body_area','status','ordered_at','resulted_at','ordered_by','is_archived','created_at','updated_at'];
    when 'payments'        then v_source_table := 'public.payments';       v_allowed_columns := array['id','patient_id','doctor_id','appointment_id','amount','currency','status','payment_method','created_at','updated_at'];
    when 'patients'        then v_source_table := 'public.patients';       v_allowed_columns := array['id','user_id','date_of_birth','sex','blood_type','is_archived','intake_completed_at','established_at','created_at','updated_at'];
    when 'care_tasks'      then v_source_table := 'public.care_tasks';     v_allowed_columns := array['id','patient_id','encounter_id','appointment_id','assigned_to','created_by','task_type','priority','status','due_at','completed_at','is_archived','created_at','updated_at'];
    when 'medical_intake'  then v_source_table := 'public.medical_intake'; v_allowed_columns := array['id','patient_id','status','collected_by','completed_by','completed_at','reopened_by','reopened_at','occupation_id','blood_group_id','marital_status','smoking_status','alcohol_use','exercise_frequency','is_archived','created_at','updated_at'];
    else
      raise exception 'Unknown data source: %', v_data_source using errcode = '22023';
  end case;

  v_group_by := coalesce(p_definition->'groupBy', '[]'::jsonb);
  v_aggregations := coalesce(p_definition->'aggregations', '[]'::jsonb);
  v_filters := coalesce(p_definition->'filters', '[]'::jsonb);
  v_order_by := coalesce(p_definition->'orderBy', '[]'::jsonb);
  v_limit := least(coalesce((p_definition->>'limit')::int, 100), 1000);

  if jsonb_array_length(v_aggregations) < 1 then
    raise exception 'At least one aggregation is required' using errcode = '22023';
  end if;

  -- 2. GROUP BY columns. `granularity` triggers date_trunc bucketing.
  for i in 0 .. jsonb_array_length(v_group_by) - 1 loop
    v_col := v_group_by->i->>'column';
    v_alias := coalesce(v_group_by->i->>'alias', v_col);
    v_granularity := v_group_by->i->>'granularity';

    if not (v_col = any(v_allowed_columns)) then
      raise exception 'Column "%" not allowed on source "%"', v_col, v_data_source using errcode = '22023';
    end if;
    if v_alias = any(v_resolved_keys) then
      raise exception 'Duplicate result key "%"', v_alias using errcode = '22023';
    end if;
    v_resolved_keys := array_append(v_resolved_keys, v_alias);

    if v_granularity is not null then
      if not (v_granularity = any(v_allowed_granularities)) then
        raise exception 'Granularity "%" not allowed', v_granularity using errcode = '22023';
      end if;
      v_select_parts := array_append(v_select_parts,
        format('date_trunc(%L, %I) as %I', v_granularity, v_col, v_alias));
      v_group_parts := array_append(v_group_parts,
        format('date_trunc(%L, %I)', v_granularity, v_col));
    else
      v_select_parts := array_append(v_select_parts, format('%I as %I', v_col, v_alias));
      v_group_parts := array_append(v_group_parts, format('%I', v_col));
    end if;
  end loop;

  -- 3. Aggregations.
  for i in 0 .. jsonb_array_length(v_aggregations) - 1 loop
    v_fn := v_aggregations->i->>'fn';
    v_col := v_aggregations->i->>'column';
    v_alias := v_aggregations->i->>'as';

    if not (v_fn = any(v_allowed_aggregations)) then
      raise exception 'Aggregation function "%" not allowed', v_fn using errcode = '22023';
    end if;
    if v_alias is null or v_alias = '' then
      raise exception 'Aggregation alias is required' using errcode = '22023';
    end if;
    if v_alias = any(v_resolved_keys) then
      raise exception 'Duplicate result key "%"', v_alias using errcode = '22023';
    end if;
    v_resolved_keys := array_append(v_resolved_keys, v_alias);

    if v_fn = 'count' then
      v_select_parts := array_append(v_select_parts, format('count(*) as %I', v_alias));
    else
      if v_col is null then
        raise exception 'Aggregation "%" requires a column', v_fn using errcode = '22023';
      end if;
      if not (v_col = any(v_allowed_columns)) then
        raise exception 'Column "%" not allowed on source "%"', v_col, v_data_source using errcode = '22023';
      end if;
      if v_fn = 'count_distinct' then
        v_select_parts := array_append(v_select_parts, format('count(distinct %I) as %I', v_col, v_alias));
      else
        v_select_parts := array_append(v_select_parts, format('%s(%I) as %I', v_fn, v_col, v_alias));
      end if;
    end if;
  end loop;

  -- 4. Filters (closed-operator allowlist; literals via format('%L', ...)).
  for i in 0 .. jsonb_array_length(v_filters) - 1 loop
    v_col := v_filters->i->>'column';
    v_op := v_filters->i->>'operator';
    v_value := v_filters->i->'value';
    v_bind_key := v_filters->i->>'bind';

    if not (v_col = any(v_allowed_columns)) then
      raise exception 'Filter column "%" not allowed on source "%"', v_col, v_data_source using errcode = '22023';
    end if;
    if not (v_op = any(v_allowed_operators)) then
      raise exception 'Filter operator "%" not allowed', v_op using errcode = '22023';
    end if;

    -- Resolve bind: caller's filter_args overrides the definition's value.
    if v_bind_key is not null and p_filter_args ? v_bind_key then
      v_value := p_filter_args->v_bind_key;
    end if;

    if v_op = 'is_null' then
      v_filter_parts := array_append(v_filter_parts, format('%I is null', v_col));
    elsif v_op = 'not_null' then
      v_filter_parts := array_append(v_filter_parts, format('%I is not null', v_col));
    elsif v_op in ('in', 'not_in') then
      if v_value is null or jsonb_typeof(v_value) <> 'array' then
        raise exception 'Operator "%" requires an array value', v_op using errcode = '22023';
      end if;
      -- Convert the JSON array to a quoted text[] literal. The compared
      -- column is cast to text so UUID/date/numeric sources work uniformly.
      select array_agg(value::text) into v_array_values
      from jsonb_array_elements_text(v_value);
      v_filter_parts := array_append(v_filter_parts, format(
        '%I::text %s (%L::text[])',
        v_col,
        case when v_op = 'in' then '= any' else '<> all' end,
        coalesce(v_array_values, array[]::text[])
      ));
    else
      -- eq / neq / gt / gte / lt / lte
      if v_value is null then
        raise exception 'Operator "%" requires a value', v_op using errcode = '22023';
      end if;
      v_filter_parts := array_append(v_filter_parts, format(
        '%I %s %L',
        v_col,
        case v_op
          when 'eq'  then '='
          when 'neq' then '<>'
          when 'gt'  then '>'
          when 'gte' then '>='
          when 'lt'  then '<'
          when 'lte' then '<='
        end,
        -- Strip surrounding JSON quotes for string literals; numbers/bools
        -- pass through as-is (Postgres will coerce on comparison).
        case jsonb_typeof(v_value)
          when 'string' then v_value #>> '{}'
          else v_value::text
        end
      );
    end if;
  end loop;

  -- Source-specific default filter — always exclude archived rows where
  -- the source carries `is_archived`.
  if 'is_archived' = any(v_allowed_columns) then
    v_filter_parts := array_append(v_filter_parts, 'is_archived = false');
  end if;

  -- 5. ORDER BY — references an alias from group_by or aggregations.
  for i in 0 .. jsonb_array_length(v_order_by) - 1 loop
    v_ref := v_order_by->i->>'ref';
    v_dir := coalesce(v_order_by->i->>'dir', 'desc');

    if not (v_ref = any(v_resolved_keys)) then
      raise exception 'ORDER BY ref "%" must reference a group_by or aggregation alias', v_ref using errcode = '22023';
    end if;
    if v_dir not in ('asc', 'desc') then
      raise exception 'ORDER BY direction "%" invalid', v_dir using errcode = '22023';
    end if;
    v_order_parts := array_append(v_order_parts, format('%I %s', v_ref, upper(v_dir)));
  end loop;

  -- 6. Assemble + execute.
  v_sql := 'select to_jsonb(row.*) from (select ' ||
    array_to_string(v_select_parts, ', ') ||
    ' from ' || v_source_table;

  if array_length(v_filter_parts, 1) > 0 then
    v_sql := v_sql || ' where ' || array_to_string(v_filter_parts, ' and ');
  end if;
  if array_length(v_group_parts, 1) > 0 then
    v_sql := v_sql || ' group by ' || array_to_string(v_group_parts, ', ');
  end if;
  if array_length(v_order_parts, 1) > 0 then
    v_sql := v_sql || ' order by ' || array_to_string(v_order_parts, ', ');
  end if;
  v_sql := v_sql || ' limit ' || v_limit::text || ') as row';

  -- Defense in depth: cap statement timeout for this execution so a
  -- pathological filter set can never tie up a tenant's connection pool.
  set local statement_timeout = '5s';

  return query execute v_sql;
end;
$$;

revoke all on function public.run_analytical_report(jsonb, jsonb) from public;
grant execute on function public.run_analytical_report(jsonb, jsonb) to authenticated;

comment on function public.run_analytical_report(jsonb, jsonb) is
  'Closed-set analytical-report compiler. Validates the JSON definition against per-source column allowlists, builds a parameterized SQL query, executes as the logged-in user (SECURITY INVOKER → RLS still scopes rows), and returns aggregated rows as JSONB. The only execution surface for the analytical-report engine.';

-- Seed the analytical_reports feature flag — disabled by default; tenants
-- opt in once they've configured the reports they want.
insert into public.feature_flags (code, name, description, is_enabled, target_roles, target_platforms, audience)
values (
  'analytical_reports',
  'Analytical Reports',
  'Doctor / admin / staff saved-report engine. When on, the Reports sidebar entry is visible.',
  false,
  array['doctor','admin','secretary'],
  array['web'],
  'staff'
)
on conflict (code) do nothing;
