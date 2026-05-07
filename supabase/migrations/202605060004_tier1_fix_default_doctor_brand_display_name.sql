begin;

update public.doctor_brand as b
set display_name = case
  when trim(concat_ws(' ', u.first_name, u.last_name)) ~* '^dr\.?\s+'
    then trim(concat_ws(' ', u.first_name, u.last_name))
  else trim(concat('Dr. ', concat_ws(' ', u.first_name, u.last_name)))
end,
updated_at = now()
from public.doctors as d
join public.users as u on u.id = d.user_id
where b.doctor_id = d.id
  and b.display_name ~* '^dr\.\s+dr\.?\s+';

commit;
