begin;

drop policy if exists users_patient_signup_insert on public.users;
create policy users_patient_signup_insert
on public.users
for insert
with check (
  (select auth.uid()) is not null
  and role = 'patient'
);

drop policy if exists doctors_authenticated_select on public.doctors;
create policy doctors_authenticated_select
on public.doctors
for select
using (
  (select auth.role()) = 'authenticated'
);

drop policy if exists "Anyone can view active billable services" on public.billable_services;
drop policy if exists "Secretaries and admins can manage billable services" on public.billable_services;

create policy "Billable services scoped select"
on public.billable_services
for select
using (
  is_active = true
  or (select public.has_role(array['secretary', 'admin']))
);

create policy "Staff can insert billable services"
on public.billable_services
for insert
with check (
  (select public.has_role(array['secretary', 'admin']))
);

create policy "Staff can update billable services"
on public.billable_services
for update
using (
  (select public.has_role(array['secretary', 'admin']))
)
with check (
  (select public.has_role(array['secretary', 'admin']))
);

create policy "Staff can delete billable services"
on public.billable_services
for delete
using (
  (select public.has_role(array['secretary', 'admin']))
);

commit;
