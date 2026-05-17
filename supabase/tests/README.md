# Supabase Backend Contract Tests

These tests are for a disposable Supabase branch or local database. They must
not run SQL audit or pgTAP against the live development tenant.

## How To Run

```bash
BACKEND_TEST_DATABASE_URL="postgresql://..." npm run test:backend-db-contract
```

In GitHub Actions, the repository uses the free-plan-safe path: it starts a
disposable local Supabase stack, runs `supabase db reset --local --no-seed`, and
exports the local `DB_URL`, `API_URL`, and `ANON_KEY` from `supabase status -o
env` before executing this runner with `BACKEND_DB_CONTRACT_REQUIRED=true`.
Before the disposable database starts, CI also runs
`npm run check:tenant-migration-bundle` and
`npm run audit:tenant-migration-flow`; this proves the SaaS runner bundle is
exactly generated from tracked tenant migration SQL and that no local-only
migration file can pass without being committed.

The runner loads `.env.test.local` / `.env.local` / `.env` automatically. If
`BACKEND_TEST_SUPABASE_URL` and `BACKEND_TEST_SUPABASE_ANON_KEY` are not set, it
falls back to `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

The runner executes:

- `supabase/sql/backend_contract_audit.sql` for schema/policy/index inventory.
- `supabase/tests/pgtap_rls.sql` for synthetic RLS assertions.
- anon RPC exposure checks when `BACKEND_TEST_SUPABASE_URL` and
  `BACKEND_TEST_SUPABASE_ANON_KEY` are also set.

If `BACKEND_TEST_DATABASE_URL` is absent, `npm run verify` skips these DB-backed
checks by design unless `BACKEND_DB_CONTRACT_REQUIRED=true`. Set
`BACKEND_TEST_ALLOW_LIVE_ANON_RPC=true` only when intentionally running read-only
anon RPC exposure diagnostics against the live development tenant; SQL audit and
pgTAP must still use a disposable branch/local DB URL.

## RLS Coverage

`pgtap_rls.sql` seeds two synthetic patients plus doctor/admin users in one
transaction, switches JWT claims with `set_config(...)`, and rolls back at the
end.

| Domain | Tables Covered |
|---|---|
| Identity and booking | `patients`, `appointments` |
| Intake and patient history | `medical_intake`, `patient_vaccinations`, `patient_surgeries`, `patient_diseases`, `patient_family_history`, `precheck_forms` |
| Billing and insurance | `payments`, `patient_insurance_policies`, `insurance_claims` |
| Encounter and clinical care | `encounters`, `clinical_notes`, `diagnoses`, `prescriptions`, `lab_orders`, `imaging_orders`, `clinical_documents`, `document_attachments`, `care_tasks` |
| Messaging | `conversations`, `conversation_participants`, `messages`, `message_attachments`, `message_read_receipts` |
| Mobile and notifications | `patient_devices`, `notification_events`, `notification_deliveries` |
| Legal and tenant config | `patient_consents`, `feature_flags` |

Each patient-scoped row gets three assertions: owner can read, another patient
cannot read, and staff can read. The suite also checks forbidden direct
appointment inserts, message sender spoofing, device ownership spoofing, clinical
note author spoofing, and audience-gated feature flags.
