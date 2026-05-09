begin;

create or replace function public.cancel_appointment(
  appointment_id uuid,
  cancellation_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid;
  v_role text;
  v_appointment public.appointments%rowtype;
  v_reason text := nullif(trim(cancellation_reason), '');
  v_is_staff boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized' using errcode = '28000';
  end if;

  select u.id, u.role
  into v_actor, v_role
  from public.users as u
  where u.auth_user_id = auth.uid()
    and coalesce(u.is_active, true) = true
  limit 1;

  if v_actor is null then
    raise exception 'Unauthorized: caller has no active domain profile' using errcode = '28000';
  end if;

  if v_reason is not null and length(v_reason) > 1000 then
    raise exception 'Cancellation reason is too long' using errcode = '22001';
  end if;

  select a.*
  into v_appointment
  from public.appointments as a
  where a.id = cancel_appointment.appointment_id
  for update;

  if not found then
    raise exception 'Appointment not found' using errcode = 'no_data_found';
  end if;

  v_is_staff := v_role in ('secretary', 'admin', 'doctor', 'predoctor');

  if not v_is_staff and not exists (
    select 1
    from public.patients as p
    where p.id = v_appointment.patient_id
      and p.user_id = v_actor
  ) then
    raise exception 'Unauthorized: appointment does not belong to caller' using errcode = 'insufficient_privilege';
  end if;

  if v_appointment.status = 'cancelled' then
    return true;
  end if;

  if v_is_staff then
    if v_appointment.status not in ('scheduled', 'confirmed', 'pre_check', 'in_consultation') then
      raise exception 'Appointment can no longer be cancelled from status %', v_appointment.status
        using errcode = 'check_violation';
    end if;
  elsif v_appointment.status not in ('scheduled', 'confirmed') then
    raise exception 'Appointment can no longer be cancelled by patient' using errcode = 'check_violation';
  end if;

  update public.appointments
  set status = 'cancelled',
      notes = case
        when v_reason is null then notes
        when coalesce(notes, '') = '' then v_reason
        when position(v_reason in notes) > 0 then notes
        else concat_ws(E'\n\n', notes, v_reason)
      end,
      updated_at = now()
  where id = v_appointment.id;

  update public.secretary_slots as s
  set is_active = true
  where s.id = v_appointment.slot_id
    and s.date >= current_date
    and v_appointment.status in ('scheduled', 'confirmed')
    and not exists (
      select 1
      from public.appointments as a
      where a.slot_id = s.id
        and a.id <> v_appointment.id
        and a.status <> 'cancelled'
    );

  begin
    perform public.notify_role_event(
      'doctor',
      'Appointment Cancelled',
      'A patient appointment was cancelled.',
      'appointment',
      'appointment',
      v_appointment.id,
      'info'
    );
  exception when others then
    -- Cancellation is the critical mutation; notification delivery is retryable.
    null;
  end;

  return true;
end;
$$;

revoke all on function public.cancel_appointment(uuid, text) from public;
revoke all on function public.cancel_appointment(uuid, text) from anon;
revoke all on function public.cancel_appointment(uuid, text) from authenticated;
grant execute on function public.cancel_appointment(uuid, text) to authenticated, service_role;

commit;
