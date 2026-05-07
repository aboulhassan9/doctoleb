begin;

insert into public.blood_groups (id, code, name, is_system, is_active) values
  (1, 'BG_A_POS', 'A+', true, true),
  (2, 'BG_A_NEG', 'A-', true, true),
  (3, 'BG_B_POS', 'B+', true, true),
  (4, 'BG_B_NEG', 'B-', true, true),
  (5, 'BG_AB_POS', 'AB+', true, true),
  (6, 'BG_AB_NEG', 'AB-', true, true),
  (7, 'BG_O_POS', 'O+', true, true),
  (8, 'BG_O_NEG', 'O-', true, true),
  (9, 'BG_OTHER', 'Other / Unknown', true, true)
on conflict do nothing;

insert into public.family_relations (id, code, name, is_system, is_active) values
  (1, 'mother', 'Mother', true, true),
  (2, 'father', 'Father', true, true),
  (3, 'sibling', 'Sibling', true, true),
  (4, 'child', 'Child', true, true),
  (5, 'grandparent', 'Grandparent', true, true),
  (6, 'spouse', 'Spouse', true, true),
  (7, 'aunt_uncle', 'Aunt / Uncle', true, true),
  (8, 'cousin', 'Cousin', true, true),
  (9, 'other', 'Other', true, true),
  (10, 'unknown', 'Unknown', true, true)
on conflict do nothing;

insert into public.cities (code, name, country, is_system, is_active) values
  ('CITY_BEIRUT', 'Beirut', 'Lebanon', true, true),
  ('CITY_TRIPOLI', 'Tripoli', 'Lebanon', true, true),
  ('CITY_SIDON', 'Sidon', 'Lebanon', true, true),
  ('CITY_TYRE', 'Tyre', 'Lebanon', true, true),
  ('CITY_ZAHLE', 'Zahle', 'Lebanon', true, true),
  ('CITY_JOUNIEH', 'Jounieh', 'Lebanon', true, true),
  ('CITY_BYBLOS', 'Byblos', 'Lebanon', true, true),
  ('CITY_BAALBEK', 'Baalbek', 'Lebanon', true, true),
  ('CITY_NABATIEH', 'Nabatieh', 'Lebanon', true, true),
  ('CITY_BATROUN', 'Batroun', 'Lebanon', true, true),
  ('CITY_ALEY', 'Aley', 'Lebanon', true, true),
  ('CITY_CHOUF', 'Chouf', 'Lebanon', true, true),
  ('CITY_METN', 'Metn', 'Lebanon', true, true),
  ('CITY_KESERWAN', 'Keserwan', 'Lebanon', true, true),
  ('CITY_OTHER', 'Other / Unknown', 'Lebanon', true, true)
on conflict do nothing;

insert into public.occupations (code, name, category, is_system, is_active) values
  ('OCC_STUDENT', 'Student', 'education', true, true),
  ('OCC_TEACHER', 'Teacher', 'education', true, true),
  ('OCC_HEALTHCARE', 'Healthcare worker', 'medical', true, true),
  ('OCC_ENGINEER', 'Engineer', 'office', true, true),
  ('OCC_OFFICE', 'Office worker', 'office', true, true),
  ('OCC_LABOR', 'Manual laborer', 'labor', true, true),
  ('OCC_DRIVER', 'Driver', 'labor', true, true),
  ('OCC_BUSINESS_OWNER', 'Business owner', 'office', true, true),
  ('OCC_HOMEMAKER', 'Homemaker', 'other', true, true),
  ('OCC_UNEMPLOYED', 'Unemployed', 'unemployed', true, true),
  ('OCC_RETIRED', 'Retired', 'retired', true, true),
  ('OCC_OTHER', 'Other / Unknown', 'other', true, true)
on conflict do nothing;

insert into public.specialties (code, name, description, is_system, is_active) values
  ('SPEC_INTERNAL_MEDICINE', 'Internal Medicine', 'Adult primary and complex medical care', true, true),
  ('SPEC_CARDIOLOGY', 'Cardiology', 'Heart and vascular medicine', true, true),
  ('SPEC_FAMILY_MEDICINE', 'Family Medicine', 'Continuity care for all ages', true, true),
  ('SPEC_PEDIATRICS', 'Pediatrics', 'Child and adolescent medicine', true, true),
  ('SPEC_OBGYN', 'Obstetrics and Gynecology', 'Women health and pregnancy care', true, true),
  ('SPEC_DERMATOLOGY', 'Dermatology', 'Skin, hair, and nail care', true, true),
  ('SPEC_ORTHOPEDICS', 'Orthopedics', 'Bone, joint, and musculoskeletal care', true, true),
  ('SPEC_ENT', 'ENT', 'Ear, nose, and throat care', true, true),
  ('SPEC_NEUROLOGY', 'Neurology', 'Brain, nerve, and neurologic care', true, true),
  ('SPEC_OTHER', 'Other / Unknown', 'Other specialty', true, true)
on conflict do nothing;

insert into public.vaccines (code, name, description, typical_doses, is_system, is_active) values
  ('VAC_HEPB', 'Hepatitis B', 'Hepatitis B vaccine', 3, true, true),
  ('VAC_MMR', 'MMR', 'Measles, mumps, and rubella vaccine', 2, true, true),
  ('VAC_TETANUS', 'Tetanus / Td / Tdap', 'Tetanus-containing vaccine', 1, true, true),
  ('VAC_INFLUENZA', 'Influenza', 'Seasonal influenza vaccine', 1, true, true),
  ('VAC_COVID19', 'COVID-19', 'COVID-19 vaccine', 1, true, true),
  ('VAC_VARICELLA', 'Varicella', 'Chickenpox vaccine', 2, true, true),
  ('VAC_POLIO', 'Polio', 'Poliovirus vaccine', 4, true, true),
  ('VAC_HPV', 'HPV', 'Human papillomavirus vaccine', 2, true, true),
  ('VAC_PNEUMOCOCCAL', 'Pneumococcal', 'Pneumococcal vaccine', 1, true, true),
  ('VAC_OTHER', 'Other / Unknown', 'Other vaccine', null, true, true)
on conflict do nothing;

insert into public.diseases (code, name, icd10_code, is_system, is_active) values
  ('DIS_HYPERTENSION', 'Hypertension', 'I10', true, true),
  ('DIS_DIABETES_TYPE_2', 'Type 2 Diabetes', 'E11', true, true),
  ('DIS_DIABETES_TYPE_1', 'Type 1 Diabetes', 'E10', true, true),
  ('DIS_ASTHMA', 'Asthma', 'J45', true, true),
  ('DIS_COPD', 'COPD', 'J44', true, true),
  ('DIS_CORONARY_ARTERY_DISEASE', 'Coronary Artery Disease', 'I25', true, true),
  ('DIS_HEART_FAILURE', 'Heart Failure', 'I50', true, true),
  ('DIS_STROKE', 'Stroke', 'I63', true, true),
  ('DIS_KIDNEY_DISEASE', 'Chronic Kidney Disease', 'N18', true, true),
  ('DIS_HYPOTHYROIDISM', 'Hypothyroidism', 'E03', true, true),
  ('DIS_HYPERTHYROIDISM', 'Hyperthyroidism', 'E05', true, true),
  ('DIS_ANEMIA', 'Anemia', 'D64', true, true),
  ('DIS_DEPRESSION', 'Depression', 'F32', true, true),
  ('DIS_ANXIETY', 'Anxiety Disorder', 'F41', true, true),
  ('DIS_MIGRAINE', 'Migraine', 'G43', true, true),
  ('DIS_EPILEPSY', 'Epilepsy', 'G40', true, true),
  ('DIS_ARTHRITIS', 'Arthritis', 'M19', true, true),
  ('DIS_GERD', 'GERD', 'K21', true, true),
  ('DIS_ALLERGIC_RHINITIS', 'Allergic Rhinitis', 'J30', true, true),
  ('DIS_OTHER', 'Other / Unknown', null, true, true)
on conflict do nothing;

insert into public.surgery_types (code, name, body_system, is_system, is_active) values
  ('SURG_APPEND', 'Appendectomy', 'gastrointestinal', true, true),
  ('SURG_CSECTION', 'C-section', 'ob-gyn', true, true),
  ('SURG_CHOLE', 'Cholecystectomy', 'gastrointestinal', true, true),
  ('SURG_HERNIA', 'Hernia repair', 'general', true, true),
  ('SURG_TONSIL', 'Tonsillectomy', 'ent', true, true),
  ('SURG_CATARACT', 'Cataract surgery', 'ophthalmology', true, true),
  ('SURG_ANGIOPLASTY', 'Angioplasty / Stent', 'cardiac', true, true),
  ('SURG_BYPASS', 'Coronary bypass', 'cardiac', true, true),
  ('SURG_FRACTURE', 'Fracture repair', 'orthopedic', true, true),
  ('SURG_OTHER', 'Other / Unknown', 'other', true, true)
on conflict do nothing;

insert into public.visit_types (
  code,
  name,
  default_duration_minutes,
  default_fee,
  requires_intake,
  is_system,
  is_active
) values
  ('first_visit', 'First Visit', 30, null, false, true, true),
  ('follow_up', 'Follow-up', 20, null, true, true, true),
  ('urgent', 'Urgent Visit', 20, null, false, true, true),
  ('precheck', 'Pre-check', 15, null, false, true, true),
  ('procedure', 'Procedure', 45, null, true, true, true)
on conflict do nothing;

insert into public.insurance_providers (code, name, is_system, is_active) values
  ('INS_NSSF', 'National Social Security Fund', true, true),
  ('INS_COOP', 'Cooperative of Government Employees', true, true),
  ('INS_PRIVATE', 'Private Insurance', true, true),
  ('INS_SELF_PAY', 'Self Pay', true, true),
  ('INS_OTHER', 'Other / Unknown', true, true)
on conflict do nothing;

insert into public.claim_form_templates (
  provider_id,
  name,
  description,
  template_format,
  template_body,
  is_active,
  is_system
) values (
  null,
  'Generic Lebanese Claim',
  'Generic fallback insurance claim form for tenant onboarding.',
  'html',
  '<h1>Insurance Claim</h1><p>Patient: {{patient_name}}</p><p>Doctor: {{doctor_name}}</p><p>Diagnosis: {{diagnosis_code}}</p><p>Amount: {{amount}}</p>',
  true,
  true
)
on conflict do nothing;

insert into public.doctor_brand (
  doctor_id,
  display_name,
  tagline,
  primary_color,
  secondary_color,
  contact_phone,
  contact_email,
  languages
)
select
  d.id,
  case
    when trim(concat_ws(' ', u.first_name, u.last_name)) ~* '^dr\.?\s+'
      then trim(concat_ws(' ', u.first_name, u.last_name))
    else trim(concat('Dr. ', concat_ws(' ', u.first_name, u.last_name)))
  end,
  coalesce(nullif(d.specialization, ''), 'Doctor-branded care'),
  '#0891b2',
  '#0f172a',
  u.phone,
  u.email,
  array['en']
from public.doctors as d
join public.users as u on u.id = d.user_id
where not exists (
  select 1
  from public.doctor_brand as b
  where b.doctor_id = d.id
)
order by d.created_at asc
limit 1;

update public.appointments
set visit_type_id = (
  select id
  from public.visit_types
  where code = 'follow_up'
  limit 1
)
where visit_type_id is null;

commit;
