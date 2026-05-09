begin;

create extension if not exists pg_cron with schema extensions;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'expire_clinical_note_drafts'
  ) then
    perform cron.unschedule('expire_clinical_note_drafts');
  end if;
end $$;

select cron.schedule(
  'expire_clinical_note_drafts',
  '15 * * * *',
  $$select public.expire_clinical_note_drafts();$$
);

commit;
