-- Seeded default analytical reports — one per category. These give every
-- tenant a starting library so the Reports page is never empty.
--
-- Pattern matches `20260515140000_seed_default_templates.sql`:
--   - is_default = true so the catalog protection trigger applies
--   - created_by resolved to the first doctor user (admin fallback)
--   - ON CONFLICT DO NOTHING for idempotency
--
-- Each report gets a v1 published version with is_current = true so the
-- runtime can resolve report_id → version directly.

do $$
declare
  v_created_by uuid;
  v_report_id uuid;
  v_definition jsonb;
  v_now timestamptz := now();
begin
  select u.id into v_created_by
    from public.users u
    join public.doctors d on d.user_id = u.id
   order by u.created_at asc
   limit 1;

  if v_created_by is null then
    select id into v_created_by
      from public.users
     order by created_at asc
     limit 1;
  end if;

  if v_created_by is null then
    raise notice 'No users found — skipping analytical reports seed.';
    return;
  end if;

  -- 1. Clinical activity — Completed visits by doctor
  v_definition := jsonb_build_object(
    'schemaVersion', '1',
    'dataSource', 'appointments',
    'groupBy', jsonb_build_array(jsonb_build_object('column', 'doctor_id')),
    'aggregations', jsonb_build_array(jsonb_build_object('fn','count','as','visits')),
    'filters', jsonb_build_array(jsonb_build_object('column','status','operator','eq','value','completed')),
    'orderBy', jsonb_build_array(jsonb_build_object('ref','visits','dir','desc')),
    'limit', 50,
    'visualization', jsonb_build_object('type','bar'),
    'header', jsonb_build_object('title','Completed visits by doctor','subtitle','All-time, completed status only','showFilters',true)
  );

  insert into public.analytical_reports (name, description, category, audience, is_default, created_by)
  values ('Completed visits by doctor', 'Number of completed appointments grouped per doctor. Bar chart, descending.', 'clinical_activity', 'staff', true, v_created_by)
  on conflict do nothing
  returning id into v_report_id;

  if v_report_id is not null then
    insert into public.analytical_report_versions (report_id, version_number, status, is_current, definition, definition_checksum, created_by, published_by, published_at)
    values (v_report_id, 1, 'published', true, v_definition, encode(digest(v_definition::text, 'sha256'), 'hex'), v_created_by, v_created_by, v_now);
  end if;
  v_report_id := null;

  -- 2. Medication usage — Active prescriptions by medication
  v_definition := jsonb_build_object(
    'schemaVersion', '1',
    'dataSource', 'prescriptions',
    'groupBy', jsonb_build_array(jsonb_build_object('column','medication_catalog_id')),
    'aggregations', jsonb_build_array(jsonb_build_object('fn','count','as','active_count')),
    'filters', jsonb_build_array(jsonb_build_object('column','status','operator','eq','value','active')),
    'orderBy', jsonb_build_array(jsonb_build_object('ref','active_count','dir','desc')),
    'limit', 30,
    'visualization', jsonb_build_object('type','bar'),
    'header', jsonb_build_object('title','Active prescriptions by medication','subtitle','Status=active, not archived','showFilters',true)
  );
  insert into public.analytical_reports (name, description, category, audience, is_default, created_by)
  values ('Active prescriptions by medication', 'Count of active prescriptions grouped per catalog medication. Bar chart.', 'medication_usage', 'staff', true, v_created_by)
  on conflict do nothing
  returning id into v_report_id;
  if v_report_id is not null then
    insert into public.analytical_report_versions (report_id, version_number, status, is_current, definition, definition_checksum, created_by, published_by, published_at)
    values (v_report_id, 1, 'published', true, v_definition, encode(digest(v_definition::text, 'sha256'), 'hex'), v_created_by, v_created_by, v_now);
  end if;
  v_report_id := null;

  -- 3. Lab workflow — Lab orders by status
  v_definition := jsonb_build_object(
    'schemaVersion', '1',
    'dataSource', 'lab_orders',
    'groupBy', jsonb_build_array(jsonb_build_object('column','status')),
    'aggregations', jsonb_build_array(jsonb_build_object('fn','count','as','order_count')),
    'orderBy', jsonb_build_array(jsonb_build_object('ref','order_count','dir','desc')),
    'limit', 10,
    'visualization', jsonb_build_object('type','pie'),
    'header', jsonb_build_object('title','Lab orders by status','subtitle','All non-archived lab orders','showFilters',false)
  );
  insert into public.analytical_reports (name, description, category, audience, is_default, created_by)
  values ('Lab orders by status', 'Distribution of lab-order statuses (draft, ordered, in_progress, resulted, cancelled).', 'lab_workflow', 'staff', true, v_created_by)
  on conflict do nothing
  returning id into v_report_id;
  if v_report_id is not null then
    insert into public.analytical_report_versions (report_id, version_number, status, is_current, definition, definition_checksum, created_by, published_by, published_at)
    values (v_report_id, 1, 'published', true, v_definition, encode(digest(v_definition::text, 'sha256'), 'hex'), v_created_by, v_created_by, v_now);
  end if;
  v_report_id := null;

  -- 4. Financial — Revenue by payment method
  v_definition := jsonb_build_object(
    'schemaVersion', '1',
    'dataSource', 'payments',
    'groupBy', jsonb_build_array(jsonb_build_object('column','payment_method')),
    'aggregations', jsonb_build_array(jsonb_build_object('fn','sum','column','amount','as','revenue')),
    'filters', jsonb_build_array(jsonb_build_object('column','status','operator','eq','value','completed')),
    'orderBy', jsonb_build_array(jsonb_build_object('ref','revenue','dir','desc')),
    'limit', 10,
    'visualization', jsonb_build_object('type','bar'),
    'header', jsonb_build_object('title','Revenue by payment method','subtitle','Completed payments only','showFilters',true)
  );
  insert into public.analytical_reports (name, description, category, audience, is_default, created_by)
  values ('Revenue by payment method', 'Sum of completed payment amounts grouped by payment method.', 'financial', 'admin', true, v_created_by)
  on conflict do nothing
  returning id into v_report_id;
  if v_report_id is not null then
    insert into public.analytical_report_versions (report_id, version_number, status, is_current, definition, definition_checksum, created_by, published_by, published_at)
    values (v_report_id, 1, 'published', true, v_definition, encode(digest(v_definition::text, 'sha256'), 'hex'), v_created_by, v_created_by, v_now);
  end if;
  v_report_id := null;

  -- 5. Operational — Appointment no-shows by clinic
  v_definition := jsonb_build_object(
    'schemaVersion', '1',
    'dataSource', 'appointments',
    'groupBy', jsonb_build_array(jsonb_build_object('column','clinic_id')),
    'aggregations', jsonb_build_array(jsonb_build_object('fn','count','as','no_show_count')),
    'filters', jsonb_build_array(jsonb_build_object('column','status','operator','eq','value','no_show')),
    'orderBy', jsonb_build_array(jsonb_build_object('ref','no_show_count','dir','desc')),
    'limit', 20,
    'visualization', jsonb_build_object('type','bar'),
    'header', jsonb_build_object('title','No-shows by clinic','subtitle','Status=no_show across all time','showFilters',true)
  );
  insert into public.analytical_reports (name, description, category, audience, is_default, created_by)
  values ('No-shows by clinic', 'Count of no-show appointments grouped by clinic to surface operational hot spots.', 'operational', 'admin', true, v_created_by)
  on conflict do nothing
  returning id into v_report_id;
  if v_report_id is not null then
    insert into public.analytical_report_versions (report_id, version_number, status, is_current, definition, definition_checksum, created_by, published_by, published_at)
    values (v_report_id, 1, 'published', true, v_definition, encode(digest(v_definition::text, 'sha256'), 'hex'), v_created_by, v_created_by, v_now);
  end if;

end;
$$;
