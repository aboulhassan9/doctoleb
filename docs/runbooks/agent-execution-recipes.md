# Agent Execution Recipes — Clinical Documents & Medication Catalog

| | |
|---|---|
| **Status** | LOCKED |
| **Version** | 1.0.0 (2026-05-15) |
| **Parent** | [`clinical-documents-and-medication-catalog.md`](../plans/clinical-documents-and-medication-catalog.md) |
| **Audience** | AI agents and humans who want a paste-ready prompt to start a slice without re-doing the discovery |

This doc is engineered for **paste-and-go**. Each slice has:

1. A **context budget**: the files an agent must read first (rank-ordered, capped).
2. A **paste-ready prompt** template the operator can hand to a fresh agent.
3. **Stop signals**: when the agent must pause and ask for human input.
4. A **pre-commit checklist** the agent must verify before opening a PR.

---

## 0. How to use this document

**You (operator):**

1. Pick a slice from the plan's § 14 that has no outstanding dependencies (other dependent slices merged).
2. Copy that slice's prompt template (below) into a fresh agent session.
3. Watch for the "stop signals" — if the agent surfaces one, answer it before proceeding.
4. Before approving the PR, run the pre-commit checklist.

**Agent (you):**

1. Read the context budget files in order.
2. Read the parent plan's § 5 (Non-negotiable rules), § 9 (Anti-duplication map), § 14.SX (your slice) — nothing else from the plan unless needed.
3. Execute the slice end to end, including tests.
4. Run the pre-commit checklist before opening the PR.
5. Update the plan's § 15 Decision log if you made any non-trivial choice.

---

## 1. Universal context budget (every slice reads these)

Before any slice-specific work, read **once** per session:

| Rank | File | Why |
|---|---|---|
| 1 | `docs/plans/clinical-documents-and-medication-catalog.md` § 5 (Non-negotiable rules) | Hard constraints |
| 2 | `docs/plans/clinical-documents-and-medication-catalog.md` § 9 (Anti-duplication map) | What NOT to recreate |
| 3 | `doctoleb/CLAUDE.md` § Testing | The mock pattern + relative-imports rule |
| 4 | `packages/core/services/api.js` | The `apiCall`/`apiPaged` envelope contract |

Reading this universal context costs ~10 minutes and saves hours of re-discovery.

---

## 2. Slice 1 — Foundation migrations + RLS

### 2.1. Context budget for slice 1

| File | Why |
|---|---|
| `supabase/migrations/20260506150820_tier2_product_core_foundation.sql` | RLS helper functions live here — copy the exact `is_staff()`/`has_role()` patterns |
| `supabase/migrations/20260506190000_legacy_compatibility_burndown.sql` | How the `clinical_documents.document_type` enum was extended — mirror the pattern |
| `scripts/audit-selects-drift.mjs` | How the snapshot is consulted |
| `scripts/audit-rpc-signatures.mjs` | How the RPC arg names get verified |
| `docs/runbooks/refresh-schema-snapshot.md` | How to refresh the fixture |
| `tests/fixtures/db-schema-snapshot.json` | The current snapshot (you will refresh this) |

### 2.2. Paste-ready prompt

```
You are implementing Slice 1 of the Clinical Documents plan
(docs/plans/clinical-documents-and-medication-catalog.md, § 14, Slice 1).

Context budget — read in this order before writing code:
  1. docs/plans/clinical-documents-and-medication-catalog.md § 5, § 9, § 14 Slice 1
  2. doctoleb/CLAUDE.md § Testing
  3. supabase/migrations/20260506150820_tier2_product_core_foundation.sql
     (find the RLS helper functions and the document_attachments/clinical_documents tables — your new tables follow this pattern)
  4. scripts/audit-selects-drift.mjs (so you know what the audit reads)
  5. docs/runbooks/refresh-schema-snapshot.md

Slice 1 goal: create document_templates + medication_catalog tables,
the medication_catalog_id nullable FK on prescriptions, and the
upsert_medication_catalog_entry(text) RPC. RLS uses existing helpers.

Files to create:
  - supabase/migrations/<YYYYMMDDhhmmss>_clinical_documents_templates.sql
  - packages/core/lib/selects.js: add DOCUMENT_TEMPLATE_SELECT_FIELDS,
    MEDICATION_CATALOG_SELECT_FIELDS

Files to refresh:
  - supabase-control-plane/functions/_shared/tenantMigrationBundle.ts via
    npm run generate:tenant-migration-bundle
  - tests/fixtures/db-schema-snapshot.json via the runbook procedure
    (use MCP if you have it: jsonb_object_agg query in
    docs/runbooks/refresh-schema-snapshot.md)

Stop and ask before:
  - Adding any column not present in the plan's § 14 Slice 1 SQL block.
  - Adding any RLS policy that does NOT use is_staff() or has_role() helpers.

Pre-commit checklist:
  - [ ] `npm run audit:selects-drift` exits 0
  - [ ] `npm run audit:rpc-signatures` exits 0
    (the new RPC must be detected)
  - [ ] `npm run lint`, `npm run test:unit`, `npm run build:ops` all green
  - [ ] tests/fixtures/db-schema-snapshot.json updated and committed

When done, write a Master Plan entry like:
"Session N — Clinical documents foundation | ..."
following the format in master_100_plan.md.

Open one PR. Reference Slice 1 in the title.
```

### 2.3. Stop signals for slice 1

- The plan's § 6 (Verified preconditions) claims something that the live DB no longer says. Update § 6 first.
- A helper function (`is_staff()`, etc.) is missing or has changed signature.
- The seed list of users does not include a doctor (needed for `created_by` in slice 5; but slice 1 should not block on this — flag for slice 5).

### 2.4. Pre-commit checklist (slice 1)

- [ ] Two new tables created with `enable row level security`.
- [ ] Both tables use `is_archived` + `archived_at` + `archived_by` (not `soft_delete`).
- [ ] `medication_catalog` has the partial unique index on `lower(name)` where `is_archived = false`.
- [ ] `document_templates` has the partial unique index on `template_type` where `is_default = true and is_archived = false`.
- [ ] Trigger `guard_default_document_templates` blocks DELETE on `is_default=true` rows.
- [ ] `upsert_medication_catalog_entry(p_name text) returns uuid` exists and is `authenticated`-callable.
- [ ] `prescriptions.medication_catalog_id` added, nullable, FK to `medication_catalog.id`.
- [ ] `audit:selects-drift` and `audit:rpc-signatures` green.
- [ ] Schema snapshot refreshed.
- [ ] Bundle regenerated.

---

## 3. Slice 2 — Services + schemas

### 3.1. Context budget for slice 2

| File | Why |
|---|---|
| `packages/core/services/clinical.js` | The closest pattern reference (mock-tested service) |
| `packages/core/services/documents.js` | Document facade — your `templateService` mirrors its shape |
| `packages/core/schemas/clinical.js` | Where `prescriptionSchema` lives; you extend it |
| `packages/core/schemas/index.js` | The barrel; you add new exports |
| `tests/unit/services/__helpers__/supabaseMock.mjs` | The mock pattern |
| `tests/unit/services/messaging.test.mjs` | A clean reference: input validation + happy path + RPC arg assertion |

### 3.2. Paste-ready prompt

```
You are implementing Slice 2 of the Clinical Documents plan
(docs/plans/clinical-documents-and-medication-catalog.md, § 14, Slice 2).

Context budget — read in this order:
  1. Universal context (docs/runbooks/agent-execution-recipes.md § 1)
  2. The parent plan's § 14 Slice 2
  3. packages/core/services/clinical.js (the closest existing service)
  4. packages/core/services/documents.js (the facade you mirror)
  5. tests/unit/services/messaging.test.mjs (reference test file)

Slice 2 goal: ship templateService + medicationCatalogService, extend
prescriptionSchema with medication_catalog_id, and unit-test both
services using the established supabaseMock pattern.

Files to create:
  - packages/core/services/templates.js
  - packages/core/services/medicationCatalog.js
  - packages/core/schemas/documentTemplates.js
  - tests/unit/services/templates.test.mjs
  - tests/unit/services/medicationCatalog.test.mjs

Files to modify:
  - packages/core/schemas/clinical.js (extend prescriptionSchema)
  - packages/core/schemas/index.js (export new schemas)

Mandatory:
  - Use relative imports (../lib/supabase.js, ./api.js, ../schemas/index.js).
    NEVER @/lib aliases in service files.
  - apiCall / apiPaged envelope. No raw try/catch.
  - SELECT constants from packages/core/lib/selects.js (added in slice 1).

Stop and ask before:
  - Inventing a new schema not listed in § 14 Slice 2.
  - Adding a service method not listed in § 14 Slice 2.
  - Skipping a unit test from the AT list (AT-2.1 through AT-2.4).

Pre-commit checklist (slice 2):
  - [ ] All AT-2.x tests green
  - [ ] templateService.create rejects an empty sections array
  - [ ] medicationCatalogService.search('') returns [] without a DB call
  - [ ] medicationCatalogService.upsertIfMissing(' ') rejects without RPC
  - [ ] `npm run audit:rpc-signatures` confirms the new RPC call shape
  - [ ] All builds + lint + unit tests green
```

### 3.3. Pre-commit checklist (slice 2)

- [ ] No `@/` aliases in any new service file.
- [ ] No raw `try/catch` around supabase calls; use `apiCall`/`apiPaged`.
- [ ] Tests cover input validation + happy path + at least one error path per public method.
- [ ] `mock.calls.from[i].modifiers` is asserted in at least one search test (depth-aware chain coverage).
- [ ] `prescriptionSchema` still accepts everything it accepted before.

---

## 4. Slice 3 — Starter medication seed

### 4.1. Context budget for slice 3

| File | Why |
|---|---|
| Previous seed migrations in `supabase/migrations/` matching pattern `*seed*` | Idempotency conventions |
| `docs/medication-catalog-starter.md` (you may need to create this first) | The list |
| `tests/unit/lib/medicationCatalogSeed.test.mjs` (new) | The parser test |

### 4.2. Paste-ready prompt

```
You are implementing Slice 3 of the Clinical Documents plan.

Pre-condition (BLOCKING): docs/medication-catalog-starter.md exists and
has been APPROVED by the project owner / medical lead. If it does not
exist or has not been approved, STOP and ask the operator to resolve
this before you proceed.

Once approved, your job is to:
  1. Convert docs/medication-catalog-starter.md into a SQL migration
     using INSERT ... ON CONFLICT (lower(name)) WHERE is_archived = false
     DO NOTHING.
  2. Write tests/unit/lib/medicationCatalogSeed.test.mjs that parses the
     migration file and asserts:
       - >= 50 rows inserted
       - no two rows share the same lower(name)
       - every row has at least one entry in dosage_forms
  3. npm run generate:tenant-migration-bundle to refresh the bundle.
  4. Apply migration to the dev project via MCP apply_migration and
     verify the seed count is correct.

Stop and ask before:
  - Making up dosages that are not in the approved markdown file.
  - Including any controlled substance that the approved list omits.
  - Renaming any drug from the approved list.

Pre-commit checklist (slice 3):
  - [ ] Test file passes
  - [ ] Migration is idempotent (apply twice on a fresh dev DB; second
        apply adds 0 rows)
  - [ ] Bundle regenerated
```

---

## 5. Slice 4 — PDF render Edge Function

### 5.1. Context budget for slice 4

| File | Why |
|---|---|
| `docs/specs/pdf-export-quality-spec.md` | **THE CONTRACT.** Read this in full before writing a line. |
| `supabase/functions/_shared/admin.ts` | CORS / preflight / requireAuthenticatedStaff pattern |
| `supabase/functions/_shared/rateLimit.ts` | If you wire rate limiting (recommended) |
| `supabase/functions/marketing-capture-lead/index.ts` | Pattern reference for a public-ish Edge Function |
| `packages/core/services/storage.js` | The signed-URL contract you'll integrate with from the client |
| `tests/unit/services/__helpers__/supabaseMock.mjs` | If you reuse mock patterns in the Edge-function unit tests |

### 5.2. Paste-ready prompt

```
You are implementing Slice 4 of the Clinical Documents plan — the
PDF render Edge Function. THE PDF EXPORT QUALITY SPEC IS THE CONTRACT:
read docs/specs/pdf-export-quality-spec.md in full before writing code.

Context budget — read in this order:
  1. Universal context (docs/runbooks/agent-execution-recipes.md § 1)
  2. docs/specs/pdf-export-quality-spec.md (every section — this is the
     contract for what "good" looks like)
  3. docs/plans/clinical-documents-and-medication-catalog.md § 14 Slice 4
  4. supabase/functions/_shared/admin.ts (auth helpers)
  5. packages/core/services/storage.js (bucket constants)

Files to create:
  - supabase/functions/render-clinical-document/index.ts
  - supabase/functions/render-clinical-document/pdfRenderer.ts
  - supabase/functions/render-clinical-document/contextLoader.ts
  - tests/unit/edge/renderClinicalDocument.test.mjs

Non-negotiables (from the quality spec):
  - pdf-lib pinned at 1.17.1 from esm.sh
  - PDF/A-2b conformance for referral/report/certificate templates
  - Embedded fonts (StandardFonts.Helvetica + Bold)
  - QR code in every PDF, encoding https://verify.doctoleb.com/v1/<base32-id>
  - Watermark text varies by status (DRAFT / clinic-name / SUPERSEDED / VOID)
  - Storage path: <tenant>/<patient_id>/<yyyy>/<mm>/<type>-<ts_ms>-<short>.pdf
  - NEVER include patient name in the storage path
  - NEVER log medication names / patient names / encounter content

Stop and ask before:
  - Adding any third-party network dependency (image CDN, font service,
    telemetry)
  - Adding any HTML→PDF rendering path
  - Storing PHI in `console.log` outputs

Pre-commit checklist (slice 4):
  - [ ] AT-4.1 PDF magic bytes (first 4 bytes are %PDF)
  - [ ] AT-4.2 verapdf PDF/A-2b validation passes for a referral fixture
  - [ ] AT-4.3 watermark text appears in the page draw operators
  - [ ] AT-4.4 missing required field returns 400 INVALID_REQUEST
  - [ ] AT-4.5 logo fetch timeout falls back to no-logo render
  - [ ] A real referral PDF opens cleanly in Acrobat + Chrome + Apple Preview
  - [ ] PDF byte size for a single-page referral < 200 KB
  - [ ] No PHI in any console output of the function
```

### 5.3. Stop signals for slice 4

- PDF/A validation tool (`verapdf`) isn't available in CI. Add it to CI in a separate PR before completing slice 4.
- pdf-lib doesn't expose a needed API (e.g. for low-level XMP injection). Document the workaround in the slice plan's Decision log.
- A tenant's logo URL is not `https://`. The spec says reject it; confirm the behavior is "render without logo" not "fail the entire render."

### 5.4. Pre-commit checklist (slice 4)

The quality spec's § 20 reviewer checklist is the canonical list. Run through all 14 items.

---

## 6. Slice 5 — Built-in default templates

### 6.1. Paste-ready prompt

```
You are implementing Slice 5 of the Clinical Documents plan.

This slice seeds two default templates: Medical Referral Letter and
Medical Report. The exact JSONB sections are defined in:
  - docs/specs/default-templates/medical-referral.json (you create this)
  - docs/specs/default-templates/medical-report.json (you create this)

For the JSONB content, copy verbatim from the parent plan's § 14 Slice
5 (the sections arrays are quoted in full there).

Files to create:
  - supabase/migrations/<YYYYMMDDhhmmss>_seed_default_templates.sql
  - docs/specs/default-templates/medical-referral.json
  - docs/specs/default-templates/medical-report.json

Each insert sets is_default = true. The trigger from slice 1 protects
these rows from DELETE; archive is also blocked by the trigger when
is_default = true.

The migration must be idempotent. Use ON CONFLICT (...) DO NOTHING with
a unique constraint we add in the same migration:

  alter table public.document_templates
    add constraint document_templates_name_unique_when_default
      unique (name) deferrable initially deferred;

Stop and ask before:
  - Adding any field with an autofill key not in § 8.10 of the parent plan.
  - Defining a field type not in the templateFieldSchema enum.

Pre-commit checklist (slice 5):
  - [ ] Both rows present after migration
  - [ ] Trigger blocks DELETE on either row
  - [ ] AT-5.1, AT-5.2, AT-5.3 all pass
  - [ ] Bundle regenerated
```

---

## 7. Slice 6 — Lab Request Form template + auto-fill hook

### 7.1. Paste-ready prompt

```
You are implementing Slice 6 of the Clinical Documents plan — the Lab
Request Form template with the checkbox-grid renderer and lab_order
auto-fill hook.

Files to create:
  - supabase/migrations/<YYYYMMDDhhmmss>_seed_lab_request_template.sql
  - docs/specs/default-templates/lab-request.json
  - packages/core/lib/labOrderToTestMap.js
  - tests/unit/services/labOrderAutoFill.test.mjs

Files to modify:
  - packages/core/services/documents.js (createLabRequest gains optional
    labOrderId; if present, read the lab_orders row and pre-populate
    fieldValues.examination_requested.tests via labOrderToTestMap)
  - supabase/functions/render-clinical-document/pdfRenderer.ts (gain a
    renderCheckboxGrid helper)

The labOrderToTestMap.js file maps substring patterns in lab_orders.title
to test value strings. Pattern table is the closed set in § 14 Slice 6.

Stop and ask before:
  - Adding a test value not in the lab-request.json `groups` definition.
  - Performing semantic NLP / fuzzy matching on lab order titles (v1 is
    plain substring on lowercase).

Pre-commit checklist (slice 6):
  - [ ] AT-6.1, AT-6.2, AT-6.3 pass
  - [ ] An end-to-end render of the lab template produces a valid PDF
  - [ ] If labOrderId is absent, behavior is unchanged from a blank lab
        request — verified by mock test
```

---

## 8. Slice 7 — Template editor UI

### 8.1. Context budget for slice 7

| File | Why |
|---|---|
| `apps/clinic-ops/src/App.jsx` | Where routes are registered + feature flags consumed |
| `packages/ui/components/ui/index.js` | The primitives barrel — use SearchableSelect, FormField, Modal, ConfirmDialog, LoadingSkeleton, EmptyState |
| `packages/core/hooks/features/` | Feature-flag hook pattern (or where to add one if missing) |
| `packages/ui/components/AppSidebar.jsx` | Where to add the new nav entry |

### 8.2. Paste-ready prompt

```
You are implementing Slice 7 of the Clinical Documents plan — the
Template Editor UI gated by the templates_engine feature flag.

Files to create:
  - apps/clinic-ops/src/pages/TemplatesPage.jsx
  - apps/clinic-ops/src/pages/TemplateEditorPage.jsx
  - apps/clinic-ops/src/components/templates/SectionEditor.jsx
  - apps/clinic-ops/src/components/templates/FieldEditor.jsx
  - apps/clinic-ops/src/components/templates/TemplatePreview.jsx
  - supabase/migrations/<YYYYMMDDhhmmss>_seed_templates_engine_flag.sql
  - packages/core/hooks/features/useFeatureFlag.js (if not already
    present — check first)
  - tests/unit/lib/templateAutofillResolver.test.mjs

Files to modify:
  - apps/clinic-ops/src/App.jsx (add the /templates routes behind the
    feature flag using useFeatureFlag('templates_engine'))
  - packages/ui/components/AppSidebar.jsx (add a "Templates" nav entry
    gated by the same flag)

NEVER invent new UI primitives. The editor composes ONLY from
packages/ui/components/ui/* — no new dropdowns, modals, tables.

Stop and ask before:
  - Adding a new field type to templateFieldSchema not listed in slice 2
  - Wiring the editor to anything other than templateService
  - Bypassing the feature flag for "convenience"

Pre-commit checklist (slice 7):
  - [ ] AT-7.1, AT-7.2, AT-7.3, AT-7.4 all pass
  - [ ] /templates is unreachable when the flag is off
  - [ ] is_default templates show a "Default" badge and the archive
        button is visually disabled
  - [ ] Live-preview matches the PDF render layout (same field order,
        same labels)
  - [ ] No new UI primitive files added to packages/ui/components/ui/
```

---

## 9. Slice 8 — Medication autocomplete

### 9.1. Context budget for slice 8

| File | Why |
|---|---|
| `apps/clinic-ops/src/components/encounter/EncounterPrescriptionsTab.jsx` | The component you modify |
| `packages/ui/components/ui/SearchableSelect.jsx` | The primitive you wire in — first real consumer |
| `packages/core/hooks/features/usePrescriptions.js` | The hook that handles the save flow; where the fire-and-forget upsert goes |
| `packages/core/services/medicationCatalog.js` | The service you call |

### 9.2. Paste-ready prompt

```
You are implementing Slice 8 — wiring medication autocomplete in the
encounter prescriptions tab using SearchableSelect. This is the FIRST
real consumer of the SearchableSelect primitive (defined in C3 but
never used).

Files to modify:
  - apps/clinic-ops/src/components/encounter/EncounterPrescriptionsTab.jsx
  - packages/core/hooks/features/usePrescriptions.js (or wherever the
    prescription save handler lives — verify before editing)

Files to create:
  - tests/unit/services/medicationAutoInsert.test.mjs

Behavior:
  - As doctor types (≥ 2 chars), debounce 200ms then call
    medicationCatalogService.search(query). Show top 8 results.
  - On select: populate medication_catalog_id, prefill dosage_forms[0]
    if available.
  - On submit: if the saved medication_name has no matching catalog row
    (case-insensitive), fire medicationCatalogService.upsertIfMissing
    WITHOUT awaiting. Silently swallow errors.

Stop and ask before:
  - Awaiting the upsert (it must be fire-and-forget — never block save)
  - Showing UI feedback for the auto-insert (it must be invisible)
  - Adding a "delete from catalog" UI in this slice (out of scope; v2)

Pre-commit checklist (slice 8):
  - [ ] AT-8.1, AT-8.2, AT-8.3, AT-8.4 pass
  - [ ] Typing 'amox' shows the seeded Amoxicillin rows (manual smoke)
  - [ ] Saving prescription with brand-new drug name produces exactly ONE
        new catalog row even under racing save (verified by unit test)
```

---

## 10. Slice 9 — Legacy page sunset

### 10.1. Paste-ready prompt

```
You are implementing Slice 9 — removing the legacy referral/report/
certificate/lab-request pages now that templates_engine is on for all
tenants.

PRE-CONDITION (BLOCKING): templates_engine must be on for every tenant
in production. Verify with the operator before proceeding.

Files to delete:
  - apps/clinic-ops/src/pages/DoctorReferralsPage.jsx
  - apps/clinic-ops/src/pages/DoctorReportsPage.jsx
  - apps/clinic-ops/src/pages/DoctorCertificatesPage.jsx
  - apps/clinic-ops/src/pages/DoctorLabRequestPage.jsx
  - apps/clinic-ops/src/components/certificates/CertificateFormModal.jsx
  - apps/clinic-ops/src/components/certificates/certificatePrintTemplate.js
  - apps/clinic-ops/src/components/certificates/CertificateTable.jsx
  - apps/clinic-ops/src/components/reports/ReportFormSection.jsx
  - apps/clinic-ops/src/components/reports/ReportSidebar.jsx

Files to modify:
  - apps/clinic-ops/src/App.jsx (remove the legacy routes)
  - packages/ui/components/AppSidebar.jsx (remove legacy nav entries)

Stop and ask before:
  - Deleting any file with active references from non-legacy code (grep
    every component before delete; if a non-legacy file imports it, you
    must replace the usage first)
  - Removing the templates_engine flag itself (keep the flag for audit;
    it just becomes a no-op)

Pre-commit checklist (slice 9):
  - [ ] grep finds zero remaining imports of the deleted files
  - [ ] `npm run verify` still green
  - [ ] No broken links in clinic-ops (manual smoke: every doctor menu
        item routes to a real page)
```

---

## 11. Cross-cutting prompt template (use when starting any slice)

If the slice doesn't have a recipe yet, use this skeleton:

```
You are implementing Slice <N> of the Clinical Documents plan
(docs/plans/clinical-documents-and-medication-catalog.md).

Context budget — read in this order:
  1. Universal context (docs/runbooks/agent-execution-recipes.md § 1)
  2. The parent plan's § 5 (Non-negotiable rules)
  3. The parent plan's § 9 (Anti-duplication map)
  4. The parent plan's § 14 Slice <N>
  5. <slice-specific files from the slice's "Files to read first" table>

Slice <N> goal: <one sentence>

Stop and ask before:
  - <conditions listed in the slice's "Stop signals" section>
  - The dependent slices listed in the plan as predecessors have NOT
    merged yet
  - You find yourself wanting to recreate something from § 9's anti-
    duplication map

Pre-commit checklist:
  - [ ] All AT-<N>.x acceptance test IDs pass
  - [ ] `npm run verify` is green
  - [ ] No `soft_delete` / `is_deleted` columns introduced
  - [ ] No `@/` aliases in new service/schema files
  - [ ] No PHI in any new console.log / logger call
  - [ ] If you added a migration, the bundle is regenerated and the
        snapshot fixture is refreshed

When done:
  - Update the parent plan's § 15 Decision log if you made a non-trivial
    choice
  - Add a Session N entry to master_100_plan.md following the format of
    previous entries
  - Open ONE PR. Reference Slice <N> in the title.
```

---

## 12. Anti-prompt-patterns

Things that DO NOT work and should not be in any prompt you write:

- ❌ "Implement the clinical document feature" — too broad; never produces a focused PR.
- ❌ "Use your judgment for the schema" — invites drift from the plan.
- ❌ "If pdf-lib doesn't work, use puppeteer" — opens the door to a rejected slice. Stop and surface the blocker instead.
- ❌ "Skip the tests if the feature is small" — never. Every behavior change needs a test.
- ❌ "Add a small new utility for X" — invites duplication. Check `packages/ui/` and `packages/core/lib/` first.

---

## 13. Change log

| Version | Date | Changes |
|---|---|---|
| 1.0.0 | 2026-05-15 | Initial recipes for all 9 slices |

---

*If you opened a new agent session for a slice and you reached this end of this document, you've done your reading. Now: re-open § 1 (universal context), § <your slice>, and start work.*
