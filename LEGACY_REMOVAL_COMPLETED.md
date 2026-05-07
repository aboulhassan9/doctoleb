# DoctoLeb Legacy Removal Completed

> Status: completed for the no-production-data development phase.
> Migrations:
> - `20260506190000_legacy_compatibility_burndown.sql`
> - `20260507091235_drop_legacy_helpers_and_views.sql`

## Removed Surfaces

The duplicate legacy backend surfaces are no longer canonical and were removed from executable code and the live Supabase schema:

- `consultations` table and `consultationService`
- `notifications` table and `notificationService`
- `doctor_brand` table, `brandService`, and `get_public_doctor_brand`
- `clinic_settings` table and settings service methods
- `medical_reports` table and `reportService`
- `certificates` table and `certificateService`
- `referrals` table and `referralService`
- Legacy V1 Edge Function source directories: `auth`, `appointments`, `patients`, `process-payment`, `consultations`, `referrals`
- Legacy summary views: `doctor_dashboard_summary`, `doctor_patients`, `upcoming_appointments`
- Legacy helper RPCs: `get_user_full_name`, `get_next_appointment`, `get_doctor_info`

## Canonical Replacements

- Clinical visits/history: `encounters`, `clinical_notes`, `diagnoses`, `prescriptions`, orders, and care tasks through `clinicalService`.
- Printable/generated documents: `clinical_documents` through `documentService`.
- Notifications/inbox: `notification_events` plus `notification_deliveries` through `notificationCoreService` and `notify_role_event`.
- Branding/app config: `tenant_profile` plus `tenant_app_config` through `tenantConfigService` and `BrandContext`.
- Insurance claims now link to `encounter_id`, not `consultation_id`.

## Guardrail

`npm run audit:backend-contract` now fails if executable code reintroduces legacy table calls, old service imports, old selector constants, legacy dashboard views/helper RPCs, retired V1 Edge Function source directories, `consultation_id`, or `get_public_doctor_brand`.

## Important Notes

There is no production data, so no compatibility backfill was required. If a future product decision needs a separate referral workflow again, it must be designed as a new canonical domain and recorded in `BACKEND_DUPLICATION_AUDIT.md` before implementation.

The local repo source for all retired V1 Edge Functions is removed. Live deletes were attempted with `supabase functions delete`, but Supabase returned `403` because the currently authenticated CLI account lacks the project permission for Edge Function deletion. A defensive overwrite attempt through the Supabase MCP deploy tool also failed with a Supabase internal deployment error. A project owner should delete these deployed functions from the Supabase Dashboard or rerun the commands below from an owner-authenticated CLI profile:

```bash
supabase functions delete auth --project-ref gezmfmskhmjgnquoyosq --yes
supabase functions delete appointments --project-ref gezmfmskhmjgnquoyosq --yes
supabase functions delete consultations --project-ref gezmfmskhmjgnquoyosq --yes
supabase functions delete patients --project-ref gezmfmskhmjgnquoyosq --yes
supabase functions delete referrals --project-ref gezmfmskhmjgnquoyosq --yes
supabase functions delete process-payment --project-ref gezmfmskhmjgnquoyosq --yes
```

Until the deployed functions are deleted, they should be treated as retired and unsupported. The app has no repo consumer for them; current web behavior goes through the service layer, canonical RPCs, and RLS-protected tables.
