-- DoctoLeb Control Plane · provisioning job idempotency
-- Prevents duplicate manual provisioning jobs when a super-admin retries the
-- same create request after a network timeout or client refresh.

alter table public.tenant_provisioning_jobs
  add column if not exists client_request_id text;

alter table public.tenant_provisioning_jobs
  drop constraint if exists tenant_provisioning_jobs_client_request_id_check;

alter table public.tenant_provisioning_jobs
  add constraint tenant_provisioning_jobs_client_request_id_check
  check (
    client_request_id is null
    or client_request_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  );

create unique index if not exists tenant_provisioning_jobs_client_request_id_key
  on public.tenant_provisioning_jobs (client_request_id)
  where client_request_id is not null;

comment on column public.tenant_provisioning_jobs.client_request_id is
  'Idempotency key supplied by the admin console for retry-safe job creation. NO PHI.';

insert into public.tenant_events (tenant_id, event_type, metadata)
select null, 'control_plane.provisioning_job_idempotency_applied', jsonb_build_object(
  'table', 'tenant_provisioning_jobs',
  'clientRequestIdUnique', true,
  'phi', false
)
where not exists (
  select 1
  from public.tenant_events
  where event_type = 'control_plane.provisioning_job_idempotency_applied'
);
