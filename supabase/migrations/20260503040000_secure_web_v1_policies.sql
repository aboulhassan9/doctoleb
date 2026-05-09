begin;

alter table public.clinic_settings enable row level security;

drop policy if exists users_select_all on public.users;
drop policy if exists users_insert_all on public.users;
drop policy if exists users_update_all on public.users;
drop policy if exists users_self_or_staff_select on public.users;
drop policy if exists users_patient_signup_insert on public.users;
drop policy if exists users_self_or_staff_update on public.users;

create policy users_self_or_staff_select
on public.users
for select
using (
  public.current_domain_user_id() = id
  or public.is_staff()
);

create policy users_patient_signup_insert
on public.users
for insert
with check (
  auth.uid() is not null
  and role = 'patient'
);

create policy users_self_or_staff_update
on public.users
for update
using (
  public.current_domain_user_id() = id
  or public.has_role(array['secretary', 'admin'])
)
with check (
  public.current_domain_user_id() = id
  or public.has_role(array['secretary', 'admin'])
);

drop policy if exists doctors_select_all on public.doctors;
drop policy if exists doctors_insert_all on public.doctors;
drop policy if exists doctors_update_all on public.doctors;

create policy doctors_authenticated_select
on public.doctors
for select
using (auth.role() = 'authenticated');

create policy doctors_self_or_staff_insert
on public.doctors
for insert
with check (
  public.has_role(array['secretary', 'admin'])
  or user_id = public.current_domain_user_id()
);

create policy doctors_self_or_staff_update
on public.doctors
for update
using (
  public.has_role(array['secretary', 'admin'])
  or user_id = public.current_domain_user_id()
)
with check (
  public.has_role(array['secretary', 'admin'])
  or user_id = public.current_domain_user_id()
);

drop policy if exists patients_full_access on public.patients;
drop policy if exists patients_self_or_staff_select on public.patients;
drop policy if exists patients_self_or_staff_insert on public.patients;
drop policy if exists patients_self_or_staff_update on public.patients;

create policy patients_self_or_staff_select
on public.patients
for select
using (
  user_id = public.current_domain_user_id()
  or public.is_staff()
);

create policy patients_self_or_staff_insert
on public.patients
for insert
with check (
  user_id = public.current_domain_user_id()
  or public.has_role(array['secretary', 'admin'])
);

create policy patients_self_or_staff_update
on public.patients
for update
using (
  user_id = public.current_domain_user_id()
  or public.is_staff()
)
with check (
  user_id = public.current_domain_user_id()
  or public.is_staff()
);

drop policy if exists appointments_full_access on public.appointments;
drop policy if exists appointments_scoped_select on public.appointments;
drop policy if exists appointments_scoped_insert on public.appointments;
drop policy if exists appointments_scoped_update on public.appointments;

create policy appointments_scoped_select
on public.appointments
for select
using (
  public.is_staff()
  or patient_id in (
    select p.id
    from public.patients as p
    where p.user_id = public.current_domain_user_id()
  )
);

create policy appointments_scoped_insert
on public.appointments
for insert
with check (
  public.has_role(array['secretary', 'admin'])
  or (
    patient_id in (
      select p.id
      from public.patients as p
      where p.user_id = public.current_domain_user_id()
    )
    and booked_by = public.current_domain_user_id()
  )
);

create policy appointments_scoped_update
on public.appointments
for update
using (
  public.is_staff()
  or patient_id in (
    select p.id
    from public.patients as p
    where p.user_id = public.current_domain_user_id()
  )
)
with check (
  public.is_staff()
  or patient_id in (
    select p.id
    from public.patients as p
    where p.user_id = public.current_domain_user_id()
  )
);

drop policy if exists "Patients can view own consultations" on public.consultations;
drop policy if exists consultations_scoped_insert on public.consultations;
drop policy if exists consultations_scoped_update on public.consultations;
drop policy if exists consultations_scoped_delete on public.consultations;

create policy consultations_scoped_select
on public.consultations
for select
using (
  public.is_staff()
  or patient_id in (
    select p.id
    from public.patients as p
    where p.user_id = public.current_domain_user_id()
  )
);

create policy consultations_scoped_insert
on public.consultations
for insert
with check (
  public.has_role(array['doctor', 'predoctor', 'admin'])
);

create policy consultations_scoped_update
on public.consultations
for update
using (
  public.has_role(array['doctor', 'predoctor', 'admin'])
)
with check (
  public.has_role(array['doctor', 'predoctor', 'admin'])
);

create policy consultations_scoped_delete
on public.consultations
for delete
using (public.has_role(array['admin']));

drop policy if exists "Medical reports accessible to parties" on public.medical_reports;

create policy medical_reports_scoped_select
on public.medical_reports
for select
using (
  public.is_staff()
  or patient_id in (
    select p.id
    from public.patients as p
    where p.user_id = public.current_domain_user_id()
  )
);

create policy medical_reports_scoped_insert
on public.medical_reports
for insert
with check (
  public.has_role(array['doctor', 'predoctor', 'admin'])
);

create policy medical_reports_scoped_update
on public.medical_reports
for update
using (
  public.has_role(array['doctor', 'predoctor', 'admin'])
)
with check (
  public.has_role(array['doctor', 'predoctor', 'admin'])
);

create policy medical_reports_scoped_delete
on public.medical_reports
for delete
using (public.has_role(array['admin']));

drop policy if exists "Payments visible to parties" on public.payments;

create policy payments_scoped_select
on public.payments
for select
using (
  public.is_staff()
  or patient_id in (
    select p.id
    from public.patients as p
    where p.user_id = public.current_domain_user_id()
  )
);

create policy payments_scoped_insert
on public.payments
for insert
with check (
  public.has_role(array['doctor', 'secretary', 'admin'])
);

create policy payments_scoped_update
on public.payments
for update
using (
  public.has_role(array['doctor', 'secretary', 'admin'])
)
with check (
  public.has_role(array['doctor', 'secretary', 'admin'])
);

create policy payments_scoped_delete
on public.payments
for delete
using (public.has_role(array['admin']));

drop policy if exists notifications_full_access on public.notifications;
drop policy if exists "Users can view own notifications" on public.notifications;

create policy notifications_own_select
on public.notifications
for select
using (user_id = public.current_domain_user_id());

create policy notifications_own_update
on public.notifications
for update
using (user_id = public.current_domain_user_id())
with check (user_id = public.current_domain_user_id());

create policy notifications_authenticated_insert
on public.notifications
for insert
with check (public.current_domain_user_id() is not null);

drop policy if exists slots_full_access on public.secretary_slots;

create policy secretary_slots_staff_or_active_patient_select
on public.secretary_slots
for select
using (
  public.is_staff()
  or (public.current_user_role() = 'patient' and is_active = true)
);

create policy secretary_slots_secretary_insert
on public.secretary_slots
for insert
with check (
  public.has_role(array['secretary', 'admin'])
  and created_by = public.current_domain_user_id()
);

create policy secretary_slots_secretary_update
on public.secretary_slots
for update
using (
  public.has_role(array['secretary', 'admin'])
)
with check (
  public.has_role(array['secretary', 'admin'])
);

create policy secretary_slots_secretary_delete
on public.secretary_slots
for delete
using (
  public.has_role(array['secretary', 'admin'])
);

drop policy if exists clinics_select_all on public.clinics;
drop policy if exists clinics_insert_all on public.clinics;

create policy clinics_public_select
on public.clinics
for select
using (true);

create policy clinics_staff_insert
on public.clinics
for insert
with check (
  public.has_role(array['secretary', 'admin'])
);

create policy clinics_staff_update
on public.clinics
for update
using (
  public.has_role(array['secretary', 'admin'])
)
with check (
  public.has_role(array['secretary', 'admin'])
);

create policy clinics_staff_delete
on public.clinics
for delete
using (
  public.has_role(array['secretary', 'admin'])
);

create policy clinic_settings_staff_select
on public.clinic_settings
for select
using (
  public.has_role(array['doctor', 'secretary', 'predoctor', 'admin'])
);

create policy clinic_settings_staff_insert
on public.clinic_settings
for insert
with check (
  public.has_role(array['doctor', 'secretary', 'admin'])
);

create policy clinic_settings_staff_update
on public.clinic_settings
for update
using (
  public.has_role(array['doctor', 'secretary', 'admin'])
)
with check (
  public.has_role(array['doctor', 'secretary', 'admin'])
);

drop policy if exists certificates_scoped_select on public.certificates;
drop policy if exists certificates_scoped_insert on public.certificates;
drop policy if exists certificates_scoped_update on public.certificates;

create policy certificates_scoped_select
on public.certificates
for select
using (
  public.has_role(array['doctor', 'predoctor', 'secretary', 'admin'])
);

create policy certificates_scoped_insert
on public.certificates
for insert
with check (
  public.has_role(array['doctor', 'admin'])
);

create policy certificates_scoped_update
on public.certificates
for update
using (
  public.has_role(array['doctor', 'admin'])
)
with check (
  public.has_role(array['doctor', 'admin'])
);

create policy certificates_scoped_delete
on public.certificates
for delete
using (public.has_role(array['admin']));

create policy predoctors_self_or_staff_select
on public.predoctors
for select
using (
  public.is_staff()
  or user_id = public.current_domain_user_id()
);

create policy predoctors_self_or_staff_insert
on public.predoctors
for insert
with check (
  public.has_role(array['secretary', 'admin'])
  or user_id = public.current_domain_user_id()
);

create policy predoctors_self_or_staff_update
on public.predoctors
for update
using (
  public.has_role(array['secretary', 'admin'])
  or user_id = public.current_domain_user_id()
)
with check (
  public.has_role(array['secretary', 'admin'])
  or user_id = public.current_domain_user_id()
);

create policy precheck_forms_scoped_select
on public.precheck_forms
for select
using (
  public.is_staff()
  or patient_id in (
    select p.id
    from public.patients as p
    where p.user_id = public.current_domain_user_id()
  )
);

create policy precheck_forms_staff_insert
on public.precheck_forms
for insert
with check (
  public.has_role(array['predoctor', 'doctor', 'admin'])
);

create policy precheck_forms_staff_update
on public.precheck_forms
for update
using (
  public.has_role(array['predoctor', 'doctor', 'admin'])
)
with check (
  public.has_role(array['predoctor', 'doctor', 'admin'])
);

create policy referrals_scoped_select
on public.referrals
for select
using (
  public.is_staff()
  or patient_id in (
    select p.id
    from public.patients as p
    where p.user_id = public.current_domain_user_id()
  )
);

create policy referrals_scoped_insert
on public.referrals
for insert
with check (
  public.has_role(array['doctor', 'admin'])
);

create policy referrals_scoped_update
on public.referrals
for update
using (
  public.has_role(array['doctor', 'admin'])
)
with check (
  public.has_role(array['doctor', 'admin'])
);

create policy referrals_scoped_delete
on public.referrals
for delete
using (public.has_role(array['admin']));

drop policy if exists audit_log_staff_select on public.audit_log;
create policy audit_log_staff_select
on public.audit_log
for select
using (
  public.has_role(array['doctor', 'predoctor', 'secretary', 'admin'])
);

commit;
