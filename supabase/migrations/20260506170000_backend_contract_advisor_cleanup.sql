-- Backend contract advisor cleanup.
-- Safe intent: reduce exposed RPC surface for trigger-only functions and remove
-- duplicate policy/index definitions reported by Supabase advisors.

-- Trigger-only SECURITY DEFINER functions should not be callable through REST RPC.
revoke execute on function public.enforce_message_redaction() from public, anon, authenticated;
revoke execute on function public.enforce_tier2_status_transition() from public, anon, authenticated;
revoke execute on function public.normalize_encounter_from_appointment() from public, anon, authenticated;
revoke execute on function public.normalize_medical_intake_workflow() from public, anon, authenticated;
revoke execute on function public.prevent_appointment_identity_mutation() from public, anon, authenticated;
revoke execute on function public.prevent_system_catalog_mutation() from public, anon, authenticated;
revoke execute on function public.propagate_medical_intake_status() from public, anon, authenticated;

-- Keep the table-constraint-backed unique indexes and drop duplicate custom indexes.
drop index if exists public.idx_doctor_brand_doctor_id_unique;
drop index if exists public.idx_tenant_profile_doctor_id_unique;

-- Tier 2.5 introduced a broad admin-delete policy; remove the duplicate table-specific one.
drop policy if exists reminder_rules_admin_delete on public.reminder_rules;
