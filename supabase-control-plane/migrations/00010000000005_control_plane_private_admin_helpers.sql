-- DoctoLeb Control Plane · private admin helpers
-- Moves RBAC helpers out of the exposed public API schema while keeping them
-- usable by RLS policies.

create schema if not exists control_plane_private;

revoke all on schema control_plane_private from public, anon, authenticated;
grant usage on schema control_plane_private to authenticated;

create or replace function control_plane_private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.super_admins sa
    where sa.auth_user_id = (select auth.uid())
      and sa.is_active = true
  );
$$;

create or replace function control_plane_private.has_super_admin_role(required_roles text[] default array[]::text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.super_admins sa
    where sa.auth_user_id = (select auth.uid())
      and sa.is_active = true
      and (
        cardinality(coalesce(required_roles, array[]::text[])) = 0
        or sa.role = 'owner'
        or sa.role = any(required_roles)
      )
  );
$$;

revoke all on function control_plane_private.is_super_admin() from public, anon;
revoke all on function control_plane_private.has_super_admin_role(text[]) from public, anon;
grant execute on function control_plane_private.is_super_admin() to authenticated;
grant execute on function control_plane_private.has_super_admin_role(text[]) to authenticated;

revoke all on function public.is_super_admin() from public, anon, authenticated;
revoke all on function public.has_super_admin_role(text[]) from public, anon, authenticated;

-- Existing registry tables.
drop policy if exists tenants_super_admin_select on public.tenants;
create policy tenants_super_admin_select on public.tenants
  for select to authenticated
  using (control_plane_private.is_super_admin());

drop policy if exists tenants_super_admin_insert on public.tenants;
create policy tenants_super_admin_insert on public.tenants
  for insert to authenticated
  with check (control_plane_private.is_super_admin());

drop policy if exists tenants_super_admin_update on public.tenants;
create policy tenants_super_admin_update on public.tenants
  for update to authenticated
  using (control_plane_private.is_super_admin())
  with check (control_plane_private.is_super_admin());

drop policy if exists tenants_super_admin_delete on public.tenants;
create policy tenants_super_admin_delete on public.tenants
  for delete to authenticated
  using (control_plane_private.is_super_admin());

drop policy if exists tenant_domains_super_admin_select on public.tenant_domains;
create policy tenant_domains_super_admin_select on public.tenant_domains
  for select to authenticated
  using (control_plane_private.is_super_admin());

drop policy if exists tenant_domains_super_admin_insert on public.tenant_domains;
create policy tenant_domains_super_admin_insert on public.tenant_domains
  for insert to authenticated
  with check (control_plane_private.is_super_admin());

drop policy if exists tenant_domains_super_admin_update on public.tenant_domains;
create policy tenant_domains_super_admin_update on public.tenant_domains
  for update to authenticated
  using (control_plane_private.is_super_admin())
  with check (control_plane_private.is_super_admin());

drop policy if exists tenant_domains_super_admin_delete on public.tenant_domains;
create policy tenant_domains_super_admin_delete on public.tenant_domains
  for delete to authenticated
  using (control_plane_private.is_super_admin());

drop policy if exists super_admins_self_select on public.super_admins;
create policy super_admins_self_select on public.super_admins
  for select to authenticated
  using (auth_user_id = (select auth.uid()) or control_plane_private.is_super_admin());

drop policy if exists super_admins_super_admin_insert on public.super_admins;
create policy super_admins_super_admin_insert on public.super_admins
  for insert to authenticated
  with check (control_plane_private.has_super_admin_role(array['owner']));

drop policy if exists super_admins_super_admin_update on public.super_admins;
create policy super_admins_super_admin_update on public.super_admins
  for update to authenticated
  using (control_plane_private.has_super_admin_role(array['owner']))
  with check (control_plane_private.has_super_admin_role(array['owner']));

drop policy if exists tenant_events_super_admin_select on public.tenant_events;
create policy tenant_events_super_admin_select on public.tenant_events
  for select to authenticated
  using (control_plane_private.is_super_admin());

-- SaaS foundation tables.
drop policy if exists plans_super_admin_select on public.plans;
create policy plans_super_admin_select on public.plans
  for select to authenticated
  using (control_plane_private.is_super_admin());

drop policy if exists plans_billing_insert on public.plans;
create policy plans_billing_insert on public.plans
  for insert to authenticated
  with check (control_plane_private.has_super_admin_role(array['billing_admin']));
drop policy if exists plans_billing_update on public.plans;
create policy plans_billing_update on public.plans
  for update to authenticated
  using (control_plane_private.has_super_admin_role(array['billing_admin']))
  with check (control_plane_private.has_super_admin_role(array['billing_admin']));
drop policy if exists plans_billing_delete on public.plans;
create policy plans_billing_delete on public.plans
  for delete to authenticated
  using (control_plane_private.has_super_admin_role(array['billing_admin']));

drop policy if exists plan_entitlements_super_admin_select on public.plan_entitlements;
create policy plan_entitlements_super_admin_select on public.plan_entitlements
  for select to authenticated
  using (control_plane_private.is_super_admin());

drop policy if exists plan_entitlements_billing_insert on public.plan_entitlements;
create policy plan_entitlements_billing_insert on public.plan_entitlements
  for insert to authenticated
  with check (control_plane_private.has_super_admin_role(array['billing_admin']));
drop policy if exists plan_entitlements_billing_update on public.plan_entitlements;
create policy plan_entitlements_billing_update on public.plan_entitlements
  for update to authenticated
  using (control_plane_private.has_super_admin_role(array['billing_admin']))
  with check (control_plane_private.has_super_admin_role(array['billing_admin']));
drop policy if exists plan_entitlements_billing_delete on public.plan_entitlements;
create policy plan_entitlements_billing_delete on public.plan_entitlements
  for delete to authenticated
  using (control_plane_private.has_super_admin_role(array['billing_admin']));

drop policy if exists tenant_entitlements_super_admin_select on public.tenant_entitlements;
create policy tenant_entitlements_super_admin_select on public.tenant_entitlements
  for select to authenticated
  using (control_plane_private.is_super_admin());

drop policy if exists tenant_entitlements_operator_insert on public.tenant_entitlements;
create policy tenant_entitlements_operator_insert on public.tenant_entitlements
  for insert to authenticated
  with check (control_plane_private.has_super_admin_role(array['operator','billing_admin']));
drop policy if exists tenant_entitlements_operator_update on public.tenant_entitlements;
create policy tenant_entitlements_operator_update on public.tenant_entitlements
  for update to authenticated
  using (control_plane_private.has_super_admin_role(array['operator','billing_admin']))
  with check (control_plane_private.has_super_admin_role(array['operator','billing_admin']));
drop policy if exists tenant_entitlements_operator_delete on public.tenant_entitlements;
create policy tenant_entitlements_operator_delete on public.tenant_entitlements
  for delete to authenticated
  using (control_plane_private.has_super_admin_role(array['operator','billing_admin']));

drop policy if exists tenant_provisioning_jobs_super_admin_select on public.tenant_provisioning_jobs;
create policy tenant_provisioning_jobs_super_admin_select on public.tenant_provisioning_jobs
  for select to authenticated
  using (control_plane_private.is_super_admin());

drop policy if exists tenant_provisioning_jobs_operator_insert on public.tenant_provisioning_jobs;
create policy tenant_provisioning_jobs_operator_insert on public.tenant_provisioning_jobs
  for insert to authenticated
  with check (control_plane_private.has_super_admin_role(array['operator']));
drop policy if exists tenant_provisioning_jobs_operator_update on public.tenant_provisioning_jobs;
create policy tenant_provisioning_jobs_operator_update on public.tenant_provisioning_jobs
  for update to authenticated
  using (control_plane_private.has_super_admin_role(array['operator']))
  with check (control_plane_private.has_super_admin_role(array['operator']));
drop policy if exists tenant_provisioning_jobs_operator_delete on public.tenant_provisioning_jobs;
create policy tenant_provisioning_jobs_operator_delete on public.tenant_provisioning_jobs
  for delete to authenticated
  using (control_plane_private.has_super_admin_role(array['operator']));
