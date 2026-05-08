-- DoctoLeb Control Plane · SaaS advisor cleanup
-- Tightens helper function grants/search paths and splits write policies so
-- SELECT paths stay single-purpose.

create or replace function public.normalize_tenant_domain_hostname()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.hostname = lower(trim(new.hostname));
  return new;
end;
$$;

revoke all on function public.normalize_tenant_domain_hostname() from public, anon, authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.touch_updated_at() from public, anon, authenticated;

revoke execute on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;

revoke execute on function public.has_super_admin_role(text[]) from public, anon;
grant execute on function public.has_super_admin_role(text[]) to authenticated;

create index if not exists tenant_provisioning_jobs_assigned_admin_idx
  on public.tenant_provisioning_jobs (assigned_admin_id);

drop policy if exists super_admins_self_select on public.super_admins;
create policy super_admins_self_select on public.super_admins
  for select to authenticated
  using (auth_user_id = (select auth.uid()) or public.is_super_admin());

drop policy if exists plans_billing_write on public.plans;
create policy plans_billing_insert on public.plans
  for insert to authenticated
  with check (public.has_super_admin_role(array['billing_admin']));
create policy plans_billing_update on public.plans
  for update to authenticated
  using (public.has_super_admin_role(array['billing_admin']))
  with check (public.has_super_admin_role(array['billing_admin']));
create policy plans_billing_delete on public.plans
  for delete to authenticated
  using (public.has_super_admin_role(array['billing_admin']));

drop policy if exists plan_entitlements_billing_write on public.plan_entitlements;
create policy plan_entitlements_billing_insert on public.plan_entitlements
  for insert to authenticated
  with check (public.has_super_admin_role(array['billing_admin']));
create policy plan_entitlements_billing_update on public.plan_entitlements
  for update to authenticated
  using (public.has_super_admin_role(array['billing_admin']))
  with check (public.has_super_admin_role(array['billing_admin']));
create policy plan_entitlements_billing_delete on public.plan_entitlements
  for delete to authenticated
  using (public.has_super_admin_role(array['billing_admin']));

drop policy if exists tenant_entitlements_operator_write on public.tenant_entitlements;
create policy tenant_entitlements_operator_insert on public.tenant_entitlements
  for insert to authenticated
  with check (public.has_super_admin_role(array['operator','billing_admin']));
create policy tenant_entitlements_operator_update on public.tenant_entitlements
  for update to authenticated
  using (public.has_super_admin_role(array['operator','billing_admin']))
  with check (public.has_super_admin_role(array['operator','billing_admin']));
create policy tenant_entitlements_operator_delete on public.tenant_entitlements
  for delete to authenticated
  using (public.has_super_admin_role(array['operator','billing_admin']));

drop policy if exists tenant_provisioning_jobs_operator_write on public.tenant_provisioning_jobs;
create policy tenant_provisioning_jobs_operator_insert on public.tenant_provisioning_jobs
  for insert to authenticated
  with check (public.has_super_admin_role(array['operator']));
create policy tenant_provisioning_jobs_operator_update on public.tenant_provisioning_jobs
  for update to authenticated
  using (public.has_super_admin_role(array['operator']))
  with check (public.has_super_admin_role(array['operator']));
create policy tenant_provisioning_jobs_operator_delete on public.tenant_provisioning_jobs
  for delete to authenticated
  using (public.has_super_admin_role(array['operator']));
