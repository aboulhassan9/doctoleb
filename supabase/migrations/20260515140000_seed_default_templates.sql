-- Slice 5 — Seed built-in default templates: Medical Referral Letter + Medical Report.
-- See docs/plans/clinical-documents-and-medication-catalog.md § 14 Slice 5.
--
-- This migration:
--   1. Inserts two default document_templates with is_default = true.
--   2. Uses ON CONFLICT DO NOTHING for idempotency (safe to re-run).
--   3. created_by is resolved dynamically to the first doctor-role user
--      in the tenant (the user who provisioned the clinic).
--
-- The JSONB sections match the companion specs at:
--   docs/specs/default-templates/medical-referral.json
--   docs/specs/default-templates/medical-report.json

do $$
declare
  v_created_by uuid;
begin
  -- Resolve created_by: first user with doctor role, or first user period.
  select u.id into v_created_by
    from public.users u
    join public.doctors d on d.user_id = u.id
   order by u.created_at asc
   limit 1;

  -- Fallback: any user (e.g. admin-only tenant with no doctors yet)
  if v_created_by is null then
    select id into v_created_by
      from public.users
     order by created_at asc
     limit 1;
  end if;

  -- If no users exist at all, skip seeding silently.
  -- Templates will be seeded on first doctor provisioning.
  if v_created_by is null then
    raise notice 'No users found — skipping default template seed.';
    return;
  end if;

  -- ── Medical Referral Letter ────────────────────────────────────
  insert into public.document_templates (
    name,
    template_type,
    description,
    sections,
    is_default,
    created_by
  ) values (
    'Medical Referral Letter',
    'referral',
    'Standard medical referral letter for specialist consultation. Auto-fills patient and doctor details from encounter context.',
    '[
      {
        "key": "patient_info",
        "title": "Patient Information",
        "fields": [
          {"key": "patient_name", "label": "Patient Name", "type": "text", "autofill": "patient.full_name", "required": true},
          {"key": "patient_dob", "label": "Date of Birth", "type": "date", "autofill": "patient.date_of_birth"},
          {"key": "patient_gender", "label": "Gender", "type": "select", "autofill": "patient.gender", "options": ["Male", "Female", "Other"]},
          {"key": "patient_phone", "label": "Phone", "type": "text", "autofill": "patient.phone"}
        ]
      },
      {
        "key": "referral_details",
        "title": "Referral Details",
        "fields": [
          {"key": "referring_doctor", "label": "Referring Doctor", "type": "text", "autofill": "doctor.full_name", "required": true},
          {"key": "referring_specialization", "label": "Specialization", "type": "text", "autofill": "doctor.specialization"},
          {"key": "referred_to", "label": "Referred To (Doctor / Facility)", "type": "text", "required": true},
          {"key": "referred_specialty", "label": "Referred Specialty", "type": "text"},
          {"key": "urgency", "label": "Urgency", "type": "select", "options": ["Routine", "Urgent", "Emergency"]}
        ]
      },
      {
        "key": "clinical_summary",
        "title": "Clinical Summary",
        "fields": [
          {"key": "chief_complaint", "label": "Chief Complaint", "type": "textarea", "autofill": "encounter.chief_complaint"},
          {"key": "diagnosis", "label": "Diagnosis / Impression", "type": "textarea", "required": true},
          {"key": "relevant_history", "label": "Relevant History & Findings", "type": "textarea"},
          {"key": "current_medications", "label": "Current Medications", "type": "textarea"}
        ]
      },
      {
        "key": "reason_for_referral",
        "title": "Reason for Referral",
        "fields": [
          {"key": "reason", "label": "Reason for Referral", "type": "textarea", "required": true},
          {"key": "specific_request", "label": "Specific Request / Question", "type": "textarea"}
        ]
      },
      {
        "key": "additional_notes",
        "title": "Additional Notes",
        "fields": [
          {"key": "notes", "label": "Additional Notes", "type": "textarea"},
          {"key": "attachments_note", "label": "Attached Documents", "type": "static_text", "content": "Please see any attached lab results, imaging, or previous reports."}
        ]
      },
      {
        "key": "signature",
        "title": "Signature",
        "fields": [
          {"key": "doctor_signature", "label": "Doctor Signature", "type": "signature"}
        ]
      }
    ]'::jsonb,
    true,
    v_created_by
  )
  on conflict do nothing;

  -- ── Medical Report ─────────────────────────────────────────────
  insert into public.document_templates (
    name,
    template_type,
    description,
    sections,
    is_default,
    created_by
  ) values (
    'Medical Report',
    'report',
    'Standard medical report documenting clinical findings, diagnosis, and treatment recommendations. Auto-fills patient and doctor details from encounter context.',
    '[
      {
        "key": "patient_info",
        "title": "Patient Information",
        "fields": [
          {"key": "patient_name", "label": "Patient Name", "type": "text", "autofill": "patient.full_name", "required": true},
          {"key": "patient_dob", "label": "Date of Birth", "type": "date", "autofill": "patient.date_of_birth"},
          {"key": "patient_gender", "label": "Gender", "type": "select", "autofill": "patient.gender", "options": ["Male", "Female", "Other"]},
          {"key": "patient_phone", "label": "Phone", "type": "text", "autofill": "patient.phone"},
          {"key": "patient_email", "label": "Email", "type": "text", "autofill": "patient.email"}
        ]
      },
      {
        "key": "encounter_details",
        "title": "Encounter Details",
        "fields": [
          {"key": "encounter_date", "label": "Date of Visit", "type": "date", "autofill": "encounter.started_at"},
          {"key": "chief_complaint", "label": "Chief Complaint", "type": "textarea", "autofill": "encounter.chief_complaint"},
          {"key": "examining_doctor", "label": "Examining Doctor", "type": "text", "autofill": "doctor.full_name", "required": true},
          {"key": "doctor_specialization", "label": "Specialization", "type": "text", "autofill": "doctor.specialization"}
        ]
      },
      {
        "key": "clinical_findings",
        "title": "Clinical Findings",
        "fields": [
          {"key": "history_of_present_illness", "label": "History of Present Illness", "type": "textarea"},
          {"key": "physical_examination", "label": "Physical Examination", "type": "textarea"},
          {"key": "vital_signs", "label": "Vital Signs", "type": "textarea"}
        ]
      },
      {
        "key": "diagnosis_section",
        "title": "Diagnosis",
        "fields": [
          {"key": "primary_diagnosis", "label": "Primary Diagnosis", "type": "textarea", "required": true},
          {"key": "secondary_diagnoses", "label": "Secondary / Differential Diagnoses", "type": "textarea"}
        ]
      },
      {
        "key": "treatment_plan",
        "title": "Treatment & Recommendations",
        "fields": [
          {"key": "treatment", "label": "Treatment Plan", "type": "textarea", "required": true},
          {"key": "medications_prescribed", "label": "Medications Prescribed", "type": "textarea"},
          {"key": "follow_up", "label": "Follow-up Instructions", "type": "textarea"},
          {"key": "referrals", "label": "Referrals / Further Investigations", "type": "textarea"}
        ]
      },
      {
        "key": "additional_notes",
        "title": "Additional Notes",
        "fields": [
          {"key": "notes", "label": "Additional Notes", "type": "textarea"}
        ]
      },
      {
        "key": "signature",
        "title": "Signature",
        "fields": [
          {"key": "doctor_signature", "label": "Doctor Signature", "type": "signature"}
        ]
      }
    ]'::jsonb,
    true,
    v_created_by
  )
  on conflict do nothing;

end;
$$;

comment on table public.document_templates is
  'Per-tenant library of reusable clinical-document layouts. Renders to PDF via the render-clinical-document Edge Function. See docs/plans/clinical-documents-and-medication-catalog.md. Default templates seeded by slice 5 migration.';
