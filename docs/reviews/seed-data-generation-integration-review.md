# Seed Data Generation Integration Review

**Date**: 2026-05-17
**Purpose**: establish a safe, service-only path for high-volume tenant seed data and define the proof required before trusting any tenant database state.

## 1. Ground Truth Boundary

Direct Supabase MCP access is available for:

- Control-plane: `xouqxgwccewvbtkqming`
- Reference/dev tenant: `gezmfmskhmjgnquoyosq`

Direct Supabase MCP access is **not** available for:

- Assad / `aaaa` tenant: `rpfhdbtyzuznhfcudrgt`

Therefore, any document that says "aaaa has table X" or "aaaa is missing table X" is not direct database evidence. For `aaaa`, the only valid evidence sources are:

- The SaaS admin provisioning UI and its Edge Function responses.
- Control-plane tables such as `tenants`, `tenant_migration_runs`, and `tenant_migration_items`.
- Clinic-ops / patient-web behavior against the deployed tenant.

The control-plane currently records `aaaa` as an active tenant with project ref `rpfhdbtyzuznhfcudrgt`, but `tenants.schema_version` is `null`. Do not use that field alone as schema readiness proof.

## 2. Current Migration Evidence

Local repo audit:

- `npm run audit:tenant-migration-flow -- --skip-git-state` passes.
- The local migration set contains 67 migrations.
- The local final migration is `20260517110000_analytical_report_schedules.sql`.
- The local source checksum is `891c274ecaa818688046316db39f0234fefe5e0796662b190d65c31e7c1d0881`.

Control-plane ledger for `aaaa`:

- Latest visible `aaaa` run is `succeeded`.
- That run expected 66 migrations and applied 2 newly pending migrations.
- That run source checksum is `a1b57b68dd0237637ee8e4e663bb93ad6c7ed6bb2b8740b0fd601aaaeb6b81b6`.

Conclusion: the SaaS runner has successfully run against `aaaa`, but `aaaa` has **not been proven against the exact current local migration bundle checksum** in this workspace. If the current code depends on the 67th migration, the SaaS admin runner must run again after the current bundle is deployed.

## 3. Seed Runner Principle

The seed generator must be an integration test, not a bypass script.

Allowed:

- Call the same service functions used by frontend flows.
- Call the same Edge Functions used by privileged SaaS/admin flows.
- Call the same tenant RPCs that services call.
- Authenticate as realistic users and let RLS decide access.

Not allowed:

- Direct table inserts as a shortcut around service contracts.
- Service-role writes from the seed runner except where the production Edge Function path already uses service-role.
- Seeding tables that are not proven present in the target tenant.
- Ignoring state-machine transitions, RLS, triggers, or idempotency keys.

If seeding fails, treat it as useful evidence: either the seed sequence is wrong, or the same production path the UI depends on is broken.

## 4. Required Pre-Seed Capability Check

Before writing any data, the seed runner should check the target tenant through the same runtime it will seed:

1. Tenant resolver returns the expected tenant config for the chosen slug/domain.
2. Auth can create/sign in the intended seed actors.
3. Required tables and RPCs are present for the selected seed modules.
4. Required feature flags/entitlements are enabled in tenant runtime config.
5. Migration source checksum in control-plane matches the deployed runner bundle.
6. No latest migration run is `failed`, `blocked`, or from an older checksum when the app code requires newer schema.

For `aaaa`, this check cannot be replaced by MCP direct table queries because MCP access to `rpfhdbtyzuznhfcudrgt` is denied.

## 5. Codebase Findings That Affect Seed Design

Service imports are not uniformly Node-safe:

- Several `packages/core/services/*.js` files still use `@/` aliases.
- AGENTS.md requires relative service imports so `node:test` and Node-based tooling can load services without Vite.
- A service-import cleanup should happen before building a standalone seed runner.

Select/schema drift is real:

- The reference tenant does not prove the latest report/analytics tables exist everywhere.
- Current `selects.js` includes `clinical_documents.template_id`, but direct reference-tenant inspection did not show that column.
- The code and local schema snapshot appear ahead of the accessible reference tenant.

RPC docs were corrected:

- `discard_clinical_note_draft` uses encounter/status/converted-note args, not `p_draft_id`.
- `notify_role_event` uses `p_event_type`.
- `get_available_slots` uses `p_doctor`.
- Tenant provisioning RPCs are `service_seed_tenant_profile` and `service_seed_first_doctor_admin`.

## 6. Recommended Seed Flow

1. Resolve tenant and validate current migration checksum.
2. Create or verify first doctor/admin through SaaS provisioning, not normal patient signup.
3. Create staff through staff invite Edge Functions.
4. Create patient identities through patient auth/service paths.
5. Configure clinics, schedules, and slots through service functions.
6. Book appointments through `book_slot` / appointment services.
7. Move appointments through valid states only.
8. Start encounters through `start_encounter`.
9. Add diagnoses before prescriptions.
10. Add clinical notes, orders, documents, care tasks, payments, messages, notifications, and insurance records through their services.
11. Verify counts and relationship integrity through read services, not raw SQL.
12. Emit a seed report that lists created entity counts, failures, auth actor used per phase, and skipped modules.

## 7. Immediate Engineering Next Steps

1. Add a target-tenant migration readiness endpoint or admin UI panel that shows latest `tenant_migration_runs.source_checksum`, expected count, applied count, failed item, and whether it matches the deployed bundle.
2. Fix the remaining `@/` imports in `packages/core/services/*.js`.
3. Build the seed runner after service imports are Node-safe.
4. Start with a small deterministic seed profile before high-volume six-month data.
5. Add a `--dry-run-capabilities` mode that writes nothing and reports exactly which modules can run on a target tenant.
6. Keep all generated seed identities clearly marked as test data and never mix them with real PHI.

## 8. What This Means For Assad / `aaaa`

It is reasonable to test `aaaa` through SaaS UI and clinic-ops, but documentation must not claim direct DB facts about `aaaa`.

For the current report/analytics work, `aaaa` should be considered ready only after:

- The SaaS runner has run the currently deployed migration bundle.
- The latest migration-run checksum matches the bundle required by the deployed app.
- Clinic-ops no longer returns table-not-found or missing-RPC errors for report features.
- The report flow works through the normal UI with the entitlement enabled.
