# Security Definer Function Review

Date: 2026-05-09
Project: tenant Supabase `gezmfmskhmjgnquoyosq`
Scope: live `public` schema functions where `SECURITY DEFINER` is still executable by `anon` or `authenticated`.

## Why This Exists

Supabase security advisors correctly warn when `SECURITY DEFINER` functions are callable through PostgREST RPC. Some of these functions are intentional API boundaries, but each one must stay documented, tested, and periodically re-reviewed. Trigger-only helpers must not be RPC-callable.

This review also records the staff lifecycle hardening from the top-20 fix pass: `enforce_staff_members_server_lifecycle()` and `handle_auth_user_created()` are trigger helpers and direct `anon`/`authenticated` execution is revoked by `20260509015000_staff_lifecycle_trigger_execute_revoke.sql`.

## Current Advisor Summary

| Category | Count | Status |
| --- | ---: | --- |
| `anon` executable `SECURITY DEFINER` functions | 1 | Needs explicit public-data justification and response-shape test. |
| `authenticated` executable `SECURITY DEFINER` functions | 25 | Some are intended API/RLS helper boundaries; each needs a focused contract test or revocation decision. |
| New staff trigger helpers executable externally | 0 | Fixed in this pass. |
| Clinical note draft read RPC executable externally | 0 | Revoked in `20260509024500_revoke_clinical_note_draft_read_rpc.sql`; browser reads use RLS table select. |
| Supabase leaked password protection | 1 warning | Platform/plan-deferred for now; keep as launch-readiness item, not a code blocker. |
| Staff invite resend service-role RPCs | 2 | Added in `20260509030000_staff_invite_resend_lifecycle.sql`; direct `anon`/`authenticated` execution is revoked. |
| Staff reactivation service-role RPC | 1 | Added in `20260509031000_staff_member_reactivation_lifecycle.sql`; direct `anon`/`authenticated` execution is revoked. |

## Allowed For Now

These functions are allowed temporarily because current app code depends on them. "Allowed for now" is not permanent approval; it means no immediate revoke was made in this slice because it would risk breaking active flows.

| Function | Caller | Reason | Required proof before production |
| --- | --- | --- | --- |
| `get_public_tenant_app_config()` | `anon`, `authenticated` | Public tenant branding/config read. Should return only safe public metadata. | Add response contract proving no PHI, secrets, staff-only feature flags, or service-role data. |
| `book_slot(...)` | `authenticated` | Canonical appointment booking RPC with atomic slot booking. | Add live race/idempotency test and actor spoof denial. |
| `cancel_appointment(...)` | `authenticated` | Appointment lifecycle mutation. | Add state-transition and ownership tests. |
| `start_encounter(...)` | `authenticated` | Encounter lifecycle mutation. | Add doctor ownership and invalid-transition tests. |
| `complete_encounter(...)` | `authenticated` | Encounter lifecycle mutation. | Add completed-state immutability and summary validation tests. |
| `cancel_encounter(...)` | `authenticated` | Encounter lifecycle mutation. | Add ownership, state-transition, and audit tests. |
| `finalize_clinical_document(...)` | `authenticated` | Clinical document lifecycle mutation. | Add author/doctor ownership and immutable-final test. |
| `void_clinical_document(...)` | `authenticated` | Clinical document lifecycle mutation. | Add void reason, authorization, and no-delete proof. |
| `get_available_slots(...)` | `authenticated` | Slot availability query boundary. | Confirm it does not expose hidden/private slots outside intended scope. |
| `get_my_appointments(...)` | `authenticated` | Patient/staff scoped appointment read. | Add cross-user denial test. |
| `get_my_medical_summary()` | `authenticated` | Patient scoped summary read. | Add cross-patient denial and field-minimization test. |
| `get_my_notifications(...)` | `authenticated` | Scoped notification read. | Add cross-user denial test. |
| `mark_notification_read(...)` | `authenticated` | Notification lifecycle mutation. | Add ownership and idempotency test. |
| `register_patient_device(...)` | `authenticated` | Device registration boundary. | Add patient ownership and token replacement tests. |
| `notify_role_event(...)` | `authenticated` | Internal role notification helper currently exposed to signed-in users. | Re-review. Prefer service-role-only worker path unless a concrete signed-in caller is required. |
| `save_clinical_note_draft(...)` | `authenticated` | Doctor-owned clinical draft autosave RPC. It validates signed-in domain user, doctor role, encounter ownership, active encounter status, note type, and content length before upsert. | Add browser E2E for autosave/resume and live RLS denial for non-author/non-doctor. |
| `discard_clinical_note_draft(...)` | `authenticated` | Doctor-owned clinical draft discard/converted-state RPC. It validates signed-in domain user, doctor role, author ownership, and allowed status before clearing active draft content. | Add browser E2E for discard and successful note save converting the draft. |

## Service-Role-Only Lifecycle RPCs

These functions are intentionally not browser-callable. They are invoked only by authenticated Edge Functions after caller JWT validation and server-side precondition checks.

| Function | Edge Function | Reason |
| --- | --- | --- |
| `create_staff_invite_resend_event(...)` | `staff-invite-resend` | Reserves or reuses an idempotent pending resend event after validating the actor doctor owns the pending invite. |
| `finish_staff_invite_resend_event(...)` | `staff-invite-resend` | Finalizes the resend event as `sent` or `failed`, updates resend metadata only on success, and writes an audit event. |
| `reactivate_staff_member_domain_identity(...)` | `staff-member-reactivate` | Reactivates only previously accepted disabled staff, updates linked domain user active state, and writes an audit event. |

## Helper Functions To Re-Review

These are mostly helper/RLS functions. They may not need direct PostgREST RPC access even if they are used inside policies and other functions.

| Function | Current caller | Preferred decision |
| --- | --- | --- |
| `current_domain_user_id()` | `authenticated` | Revoke direct execute if RLS policies continue to work through function ownership. |
| `current_user_role()` | `authenticated` | Revoke direct execute unless UI has a documented RPC caller. |
| `current_patient_id()` | `authenticated` | Revoke direct execute unless UI has a documented RPC caller. |
| `current_doctor_id()` | `authenticated` | Revoke direct execute unless UI has a documented RPC caller. |
| `has_role(allowed_roles text[])` | `authenticated` | Revoke direct execute if only used by policies/functions. |
| `is_staff()` | `authenticated` | Revoke direct execute if only used by policies/functions. |
| `can_access_conversation(p_conversation_id uuid)` | `authenticated` | Revoke direct execute if only used by policies/functions, or add a no-PHI boolean contract test if kept public to signed-in users. |

## Rules For Future Changes

- Do not add a new `SECURITY DEFINER` function callable by `anon` or `authenticated` without adding it to this review document.
- Trigger helpers must always revoke direct `public`, `anon`, and `authenticated` execute.
- Lifecycle mutation RPCs must validate actor identity, ownership, state transition, and postconditions inside the function.
- Public/anon functions must return only non-PHI, non-secret, non-clinical metadata and should have a response-shape regression test.
- Service-role-only RPCs should explicitly `revoke all` from `public`, `anon`, and `authenticated`, then grant only to `service_role`.

## Next Actions

1. Convert the "Helper Functions To Re-Review" group into a migration that revokes direct execute where app code does not call them as RPCs.
2. Add tests for every kept `authenticated` lifecycle RPC: ownership denial, invalid transition denial, and safe successful mutation.
3. Revisit Supabase leaked password protection when the project plan supports it, then document the dashboard action in the launch checklist.
4. Re-run Supabase security advisors after each DDL change and update this document.
