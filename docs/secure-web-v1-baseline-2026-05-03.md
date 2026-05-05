# Secure Web V1 Baseline

- Verified against live Supabase project `gezmfmskhmjgnquoyosq` on `2026-05-03`
- Source of truth: live DB, not the older repo migration set
- Product model: one specific clinic with multiple doctors, not SaaS
- Scope: `patient`, `doctor`, `predoctor`, `secretary`
- Staff accounts are internal clinic accounts; patients are the only public self-registration role

## Branching Blocker

Supabase preview branching could not be created for this project because the connected account returned `403 Not authorized to enable preview branching.`  
Implementation in this repo is therefore **repo-first**:

- live edge functions were synced into `supabase/functions/`
- secure migrations were authored locally in `supabase/migrations/`
- frontend/service hardening was implemented against the inspected live schema

Before applying these migrations, branch-first rollout still needs one of:

1. Supabase branching enabled for the project/account
2. A separate development project cloned from live schema

## Live Findings Captured

- `users.password_hash` still exists and was being written by the frontend
- `public.users.id` and `auth.users.id` were not consistently aligned
- `clinic_settings` had no RLS
- `certificates`, `precheck_forms`, `predoctors`, and `referrals` had RLS enabled with no policies
- `appointments`, `patients`, `notifications`, and `secretary_slots` had permissive `true` policies
- `doctor_dashboard_summary`, `doctor_patients`, and `upcoming_appointments` were SECURITY DEFINER views
- `book_slot` and `get_available_slots` were callable by `anon`
- operational timestamps were mostly `timestamp without time zone`
- patient booking and secretary booking used different appointment-creation paths

## Repo Changes Landed In This Slice

- Shared auth identity helpers
- Shared appointment status/time/select contracts
- Zod validation layer
- `precheckService`
- Auth/session hardening and reset-password completion
- Slot-backed patient booking path
- Secretary booking unified onto the same booking service
- Doctor/predoctor appointment readers updated to canonical appointment fields
- Local secure migrations for auth linkage, timestamps, statuses, policies, views, functions, audit logging, and archive scaffolding

## Remaining Manual/Hosted Actions

- Enable leaked password protection in Supabase Auth
- Retire or redeploy the insecure hosted `auth` edge function
- Apply the new migrations on a branch or cloned development project first
- Re-run Supabase security advisors after migration application
