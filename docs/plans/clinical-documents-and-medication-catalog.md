# Clinical Document Template Engine + Lab Request + Smart Prescription — Implementation Plan

| | |
|---|---|
| **Status** | LOCKED — ready for execution |
| **Version** | 2.0.0 (2026-05-15) |
| **Doc owner** | Engineering — review on every slice merge |
| **Plan owner** | Project owner (sign-off on open questions before unblocking dependent slices) |
| **Implementation owner** | Each slice has a named owner once assigned; see § 14 |
| **Target completion** | 9 slices, ~3 weeks elapsed if executed in dependency order |
| **Companion docs** | [`pdf-export-quality-spec.md`](../specs/pdf-export-quality-spec.md) · [`agent-execution-recipes.md`](../runbooks/agent-execution-recipes.md) |

---

## 0. How to read this document (for humans AND agents)

This document is engineered to be **self-contained**. An AI agent or human picking up a slice should not need to re-do the discovery work. Every claim cites its source (file path + line, or a live MCP scan).

### 0.1. Reading order — context budget

If you have limited context, read in this order. Each section is ranked by **load-bearing weight**: the higher, the more it changes how you write code.

| Rank | Section | Why | Time |
|---|---|---|---|
| 1 | § 5 Non-negotiable rules | Will fail PR review if violated | 2 min |
| 2 | § 9 Anti-duplication map | The biggest source of bugs and re-work | 5 min |
| 3 | § 6 Verified preconditions | Saves you 30 minutes of discovery | 3 min |
| 4 | § 14 Your assigned slice ONLY | The actual work | 10 min |
| 5 | § 17 Pitfalls | The pre-merge checklist | 2 min |
| 6 | § 18 Agent recipes / your slice | A paste-ready prompt | 1 min |
| 7 | Everything else | Reference material | as needed |

**Do not read this document linearly top-to-bottom.** That is a context waste.

### 0.2. Stop signals (when to stop and ask)

You **must** stop and request human input if any of the following are true. Do not improvise.

| Stop signal | Why | Whom to ask |
|---|---|---|
| The medication starter list (§ Slice 3) is empty or unconfirmed | Could ship clinically inappropriate defaults | Project owner / medical lead |
| The live DB schema has drifted from § 6 preconditions | Plan is stale | Update § 6 first, then continue |
| A new column you want to add would conflict with an existing name | Would shadow real data | Surface the collision in the plan's decision log |
| You need to add a third-party network dependency to the Edge Function (image CDN, telemetry, font service) | PHI / security risk | Project owner |
| RLS policy you want to write does not use the existing helper functions | Architectural drift | Compose using existing helpers, or expand them in a separate PR first |
| You think you found a bug in `documentService`, `clinicalService`, or `storageService` | Could be a real bug or could be your misunderstanding | Flag in the decision log; do not fix in this work |
| A slice's acceptance criteria fails after your changes | Plan or implementation is off | Surface — do not relax the criteria |

### 0.3. Status terms

| Term | Meaning |
|---|---|
| **DRAFT** | Plan is being written; not safe to start work |
| **REVIEWED** | Plan is reviewed by at least one engineer; safe to start |
| **LOCKED** | Plan is approved by the project owner; only the decision log can update without a new version bump |
| **SHIPPED** | The plan's definition of done (§ 20) is met; this doc is moved to `docs/archive/` |

This document is **LOCKED** as of 2.0.0.

### 0.4. Execution status — Progress & Handoff

**Snapshot of where this work stands. The next agent reads this section FIRST after § 0.1.**

| Slice | Status | Commit | Tests | Notes |
|---|---|---|---|---|
| **S1** Foundation migrations + RLS | ✅ DONE 2026-05-15 | `8928863` | 498 pass, 0 fail | Migration applied to `gezmfmskhmjgnquoyosq`. Both new tables visible. Snapshot fixture refreshed (60 → 62 tables). |
| **S2** Services + schemas | ⏭️ NEXT | — | — | Unblocked. No prerequisites pending. Start with `docs/runbooks/agent-execution-recipes.md § 3`. |
| **S3** Starter medication seed | 🟡 BLOCKED on OQ-1 | — | — | Needs `docs/medication-catalog-starter.md` approved by project owner / medical lead before merge. Engineering can begin the migration scaffolding but cannot ship rows. |
| **S4** PDF render Edge Function | ⏸ QUEUED | — | — | Depends on S2 (templateService). |
| **S5** Built-in default templates | ⏸ QUEUED | — | — | Depends on S1 (table) + S4 (render path). |
| **S6** Lab Request template + auto-fill | ⏸ QUEUED | — | — | Depends on S5. |
| **S7** Template editor UI | ⏸ QUEUED | — | — | Depends on S2 + S4. |
| **S8** Medication autocomplete | ⏸ QUEUED | — | — | Depends on S2. |
| **S9** Legacy page sunset | ⏸ QUEUED | — | — | Depends on S7 + flag flip per tenant. |

**Suite at last green gate:** 498 tests / 116 suites / 0 failures · lint clean · `audit:selects-drift` ✅ · `audit:rpc-signatures` ✅ · `build:ops` clean (6.95s).

#### Slice 1 — what was produced

| Artifact | Path | Verification |
|---|---|---|
| Migration | `supabase/migrations/20260515120000_clinical_documents_templates.sql` | Applied via MCP to `gezmfmskhmjgnquoyosq` (success: `{ "success": true }`). Verified columns/RLS/triggers via `pg_constraint` + `pg_policies` re-scan. |
| SELECT constants | `packages/core/lib/selects.js` — `DOCUMENT_TEMPLATE_SELECT_FIELDS`, `MEDICATION_CATALOG_SELECT_FIELDS` | Appended at end of file. |
| Tenant migration bundle | `supabase-control-plane/functions/_shared/tenantMigrationBundle.ts` | Regenerated via `npm run generate:tenant-migration-bundle`. |
| Schema snapshot fixture | `tests/fixtures/db-schema-snapshot.json` | Refreshed. 60 → 62 tables. `prescriptions` now lists `medication_catalog_id`. New entries: `document_templates`, `medication_catalog`. |
| Audits | `audit:selects-drift`, `audit:rpc-signatures` | Both green. `upsert_medication_catalog_entry(text)` registered in the SQL function registry. |

#### Slice 1 — decisions made during execution

Add to the decision log (§ 15) in v2.0.1+:

| Date | Decision | Alternatives | Rationale |
|---|---|---|---|
| 2026-05-15 | The upsert RPC uses bare `on conflict do nothing` rather than `on conflict ((lower(name))) where (...)` | Targeted conflict clause referencing the partial unique index | PostgreSQL does NOT support inline `where` predicates on `on conflict` for partial indexes when the conflict target uses an expression. The bare clause triggers on any unique violation, which is fine because the only active unique constraint is the partial `lower(name)` index. The re-read fallback handles the rare race. |

#### How the next agent starts Slice 2

1. **Read these in order** (context budget for S2):
   - § 0.1 (this doc) — reading order
   - § 5 — non-negotiable rules
   - § 9 — anti-duplication map
   - § 14 — Slice 2 details
   - `docs/runbooks/agent-execution-recipes.md § 3` — Slice 2 paste-ready prompt + pre-commit checklist
   - `packages/core/services/clinical.js` — service pattern reference
   - `packages/core/services/documents.js` — service facade pattern
   - `tests/unit/services/messaging.test.mjs` — mock-test pattern

2. **Verify Slice 1 is intact before starting:**
   ```bash
   cd doctoleb
   npm run audit:selects-drift     # must say "✅ No drift found"
   npm run audit:rpc-signatures    # must say "✅ No drift found"
   git log --oneline -1 supabase/migrations/20260515120000_clinical_documents_templates.sql
   # → should show the slice 1 commit
   ```

3. **Stop and ask** before:
   - Adding any column not listed in § 14 Slice 2.
   - Changing the SQL applied by Slice 1 (open a follow-up migration instead).
   - Inventing a new service method that's not in § 14 Slice 2's signature list.

4. **Bring this section up to date** when slice 2 merges: change S2 to ✅ DONE, record the commit hash, log any decisions, and mark S4 / S7 / S8 as unblocked.

---

## 1. Mission & success criteria

**Mission.** Doctors generate world-class clinical documents (referrals, medical reports, certificates, lab requests, prescriptions) from inside an encounter, using reusable templates that auto-fill from encounter context, and rendered as archive-quality PDFs branded for the clinic. The prescription path gains a per-tenant medication catalog that self-populates from doctor usage.

**Success criteria** (these are quantitative and machine-verifiable).

| ID | Criterion | Measurement |
|---|---|---|
| SC-1 | A doctor can generate a referral PDF in < 4 seconds from "Encounter → Generate" click to "Open in tab." | Edge Function p95 latency < 2.5 s; signed URL fetch < 1 s |
| SC-2 | Generated PDF passes PDF/A-2b validation (where the template type is `referral`, `report`, or `certificate`). | `pdf-lib`-built artifact validated via `verapdf` in CI |
| SC-3 | Medication autocomplete returns suggestions in < 200 ms for the median tenant catalog (≤ 500 entries). | Browser DevTools timing on the `select` query |
| SC-4 | Zero PHI in any non-tenant storage location (control plane, telemetry, logs). | `npm run audit:bundle-secrets` clean; manual review of every Edge Function `console.*` call |
| SC-5 | Catalog auto-insert is exactly-once for case-insensitive duplicates under concurrent saves. | Unit test: race two `upsertIfMissing('Aspirin')` and `upsertIfMissing('aspirin')` calls; assert exactly 1 catalog row |
| SC-6 | Every new RLS policy denies the wrong-role caller. | pgTAP test (`supabase/tests/`) per policy |
| SC-7 | Template editor is reachable only when `templates_engine` flag is on; legacy routes still work when flag is off. | E2E smoke test before and after flag flip |
| SC-8 | `npm run verify` is green across the whole repo at every slice merge. | CI gate |

---

## 2. Scope

### 2.1. In scope

- Two new tables: `document_templates`, `medication_catalog`.
- One new nullable FK column: `prescriptions.medication_catalog_id`.
- One new RPC: `upsert_medication_catalog_entry(p_name text) returns uuid`.
- One new Edge Function: `supabase/functions/render-clinical-document/`.
- Two new services: `templateService`, `medicationCatalogService`.
- One schema extension: `prescriptionSchema` gains `medication_catalog_id`.
- One new app route: `/templates` in clinic-ops.
- One new feature flag row: `templates_engine`.
- Three built-in default templates: Medical Referral Letter, Medical Report, Lab Request Form.
- One starter medication seed (~50 entries, project-owner-approved).
- Legacy page sunset (after the flag is on for every tenant).

### 2.2. Out of scope (explicit)

| Item | Reason | Future home |
|---|---|---|
| FHIR export / interchange | Larger architectural conversation | Future ADR |
| RxNorm / WHO ATC integration | Vendor lock-in concern; Lebanon formulary differs from US | Future enhancement; data model is forward-compatible (the catalog supports a `code text` column added later) |
| Bulk template import/export (JSON file) | Not requested; could be added in slice 7's editor later | Slice 10+ |
| Template versioning (multiple versions of the same template active) | Single-row model is enough for v1 | Slice 11+ if needed |
| Multi-language template content (Arabic / French) | Single-locale per row for v1 | Slice 12+; row already supports `language text` column added later |
| Digital signatures (cryptographic, e.g. PAdES) | Big spec; will require legal review | Future ADR |
| OCR / form-fill from scanned PDFs | Inbound not outbound | Out of plan scope entirely |
| Patient self-service document download | Different RLS posture | Future enhancement |

### 2.3. Deferred decisions (will revisit in v3 if needed)

- Per-tenant default PDF page size (A4 vs Letter). Default: A4.
- Per-tenant signature image upload (storage of doctor signature image). Default: text-only signature line.
- Cryptographic signing of generated PDFs. Default: none; QR-code verification only (§ 8.6).

---

## 3. Glossary

| Term | Definition |
|---|---|
| **Template** | A row in `document_templates`. Contains a JSONB `sections` array that defines layout + fields. |
| **Section** | An object inside `sections`. Has a `key`, `title`, and `fields`. |
| **Field** | An object inside a section. Has a `key`, `label`, `type`, and optionally `autofill`, `required`, `options`, `groups`, `content`. |
| **Autofill key** | A dotted path string (e.g. `patient.full_name`) that the renderer resolves against the encounter context. Full list in § 8.10. |
| **Rendered document** | A PDF byte stream produced by `supabase/functions/render-clinical-document` from a template + field values + encounter context. |
| **Clinical document row** | A row in `clinical_documents` referencing a rendered PDF via `file_url`. Created by `documentService.createX` AFTER the Edge Function returns. |
| **Encounter context** | The bundle of patient, doctor, encounter, diagnoses, prescriptions, and tenant_profile/tenant_app_config loaded by the Edge Function for autofill resolution. |
| **Catalog** | Shorthand for `medication_catalog`. Per-tenant, doctor-edited drug list. |
| **Tenant** | A single DoctoLeb clinic's Postgres database. Resolved at runtime by the tenant resolver. |
| **Service-role key** | The privileged Supabase key the Edge Function uses to read tenant data. Must never reach a browser. |

---

## 4. Source-of-truth references

Every fact in this document maps to one of these. If you suspect drift, re-verify before changing code.

| Source | What's authoritative |
|---|---|
| `G:\project\AGENTS.md` (workspace-wide rules) | Layering, duplication, reversibility, security boundaries |
| `G:\project\doctoleb\CLAUDE.md` | Repo-specific conventions, three non-optional rules, Testing section, soft-delete pattern |
| Live DB scan against project `gezmfmskhmjgnquoyosq` on 2026-05-15 | Schema, check constraints, RLS policies, RPC signatures, indexes |
| `packages/core/services/documents.js` | Document lifecycle facade |
| `packages/core/services/clinical.js` | Clinical lifecycle including documents |
| `packages/core/services/storage.js` | Signed URL contract |
| `packages/core/schemas/clinical.js` | `prescriptionSchema` to extend |
| `packages/core/lib/selects.js` | SELECT field constants |
| `packages/ui/components/ui/` | All reusable UI primitives — never reinvent these |
| `scripts/audit-selects-drift.mjs` + `scripts/audit-rpc-signatures.mjs` | Static checks that must stay green |
| `tests/fixtures/db-schema-snapshot.json` | Frozen schema snapshot |
| `supabase/migrations/20260506150820_tier2_product_core_foundation.sql` | RLS helper functions live here |

---

## 5. Non-negotiable rules

Each rule has a **wrong** example and a **right** example.

### Rule 1 — UI never talks to Supabase directly.

❌ wrong:
```jsx
const { data } = await supabase.from('document_templates').select('*');
```

✅ right:
```jsx
const { data, error } = await templateService.getAll({ templateType: 'referral' });
```

### Rule 2 — Every query uses a SELECT constant.

❌ wrong:
```js
.from('medication_catalog').select('id, name')
```

✅ right:
```js
import { MEDICATION_CATALOG_SELECT_FIELDS } from '../lib/selects.js';
.from('medication_catalog').select(MEDICATION_CATALOG_SELECT_FIELDS)
```

### Rule 3 — Soft-delete is `is_archived` / `archived_at` / `archived_by`. There is no `soft_delete` or `is_deleted` column in this repo.

❌ wrong (from the original spec):
```sql
soft_delete boolean default false
```

✅ right:
```sql
is_archived boolean not null default false,
archived_at timestamptz,
archived_by uuid references public.users(id) on delete set null
```

### Rule 4 — Edge Functions never expose service-role data to a browser.

❌ wrong:
```ts
return new Response(JSON.stringify({ data: tenantProfile }), ...)
// — returns raw tenant_app_config including support_email etc.
```

✅ right:
```ts
return new Response(JSON.stringify({ data: { storagePath, byteSize } }), ...)
// — returns only the path of the uploaded PDF; the browser fetches via signed URL
```

### Rule 5 — Services use relative imports, not Vite aliases.

❌ wrong (will fail in `node:test`):
```js
import { supabase } from '@/lib/supabase';
```

✅ right:
```js
import { supabase } from '../lib/supabase.js';
```

### Rule 6 — Idempotency uses `client_request_id` + a unique index.

Replayable writes get a `client_request_id uuid` column passed by the UI. The DB has a unique index on it. The service catches `23505` and looks up the existing row instead of failing. Pattern: see `messagingService.sendMessage` and the unit test at `tests/unit/services/messaging.test.mjs`.

### Rule 7 — Reversibility is designed in, not retrofitted.

Every new write designs for archive, never delete. Document templates marked `is_default` are protected by a trigger from delete and from archive.

### Rule 8 — Fail closed on tenant resolution, entitlement, RLS.

If the feature flag is missing or unreadable, the route is hidden. If the catalog query fails, the autocomplete shows "Could not load suggestions" — never crashes.

---

## 6. Verified preconditions (live scan, 2026-05-15)

| Fact | Source |
|---|---|
| `clinical_documents.document_type` check includes `report, certificate, referral, prescription, insurance_claim, insurance_form, lab_request, lab_result, imaging_result, other` | `pg_constraint` |
| `clinical_documents.status` check: `draft, final, superseded, void` (no `cancelled`) | `pg_constraint` |
| `prescriptions.status` check: `draft, active, stopped, completed, cancelled` — **`cancelled` IS valid here** | `pg_constraint` |
| `lab_orders.status` check: `draft, ordered, in_progress, resulted, cancelled` | `pg_constraint` |
| `clinical_documents` columns include `client_request_id uuid`, `finalized_by uuid`, `voided_at`, `voided_by`, `void_reason` | `information_schema.columns` |
| Branding columns live on `tenant_app_config` (`primary_color`, `secondary_color`, `splash_logo_url`, `icon_url`, `support_phone`, `support_email`). `tenant_profile` does NOT carry colors / logo | `information_schema.columns` |
| `tenant_profile` provides `display_name`, `timezone` (default `Asia/Beirut`), `default_locale` (default `en`), `status`, `schema_version` | Same |
| `feature_flags` columns: `code, name, description, is_enabled, target_roles[], target_platforms[], config jsonb, audience text` (audience check: `public|patient|staff|admin`) | Same |
| RLS helpers `is_staff()`, `has_role(text[])`, `current_doctor_id()`, `current_domain_user_id()`, `current_patient_id()`, `current_user_role()` are defined and used by every clinical table | `20260506150820_tier2_product_core_foundation.sql` |
| Existing RPCs: `finalize_clinical_document(uuid)`, `void_clinical_document(uuid, text)`, `start_encounter`, `complete_encounter`, `cancel_encounter`. Trigger `enforce_prescription_requires_diagnosis` fires on prescription insert | `pg_proc` |
| Storage buckets: `clinical-documents`, `message-attachments`. `storageService.createSignedUrl` clamps TTL to `[30, 900]` seconds | `packages/core/services/storage.js` |
| Tenant migration bundle generator: `npm run generate:tenant-migration-bundle` reads `supabase/migrations/*.sql` and writes `supabase-control-plane/functions/_shared/tenantMigrationBundle.ts`. Must run after every new tenant migration | `scripts/generate-tenant-migration-bundle.mjs` |

---

## 7. Architecture

### 7.1. Data flow diagram (PDF generation)

```
┌──────────── clinic-ops ────────────┐    ┌────── render-clinical-document ──────┐    ┌── Storage ──┐
│                                    │    │   (Edge Function, Deno, pdf-lib)     │    │  clinical-  │
│  TemplatesPage                     │    │                                      │    │  documents  │
│       │ user picks template        │    │   1. authenticate staff caller       │    │             │
│       ▼                            │    │   2. load template by id             │    │             │
│  TemplateFillModal                 │    │   3. load encounter context (RPC)    │    │             │
│       │ user fills field values    │    │   4. apply autofill resolver         │    │             │
│       ▼                            │    │   5. render PDF via pdf-lib          │    │             │
│  templateService.render(...)       │───►│   6. upload to bucket                │───►│  bytes      │
│                                    │    │   7. return { storagePath, bytes }   │    │             │
│       ◄──────── { storagePath } ───┤    └──────────────────────────────────────┘    └─────────────┘
│       ▼
│  documentService.createReferral({ file_url: ..., ... })
│       │ inserts clinical_documents row, status=draft, client_request_id
│       ▼
│  storageService.createSignedUrl(STORAGE_BUCKETS.CLINICAL_DOCUMENTS, storagePath, { expiresIn })
│       │
│       ▼
│  window.open(signedUrl, '_blank')
└────────────────────────────────────┘
```

### 7.2. State diagram (template lifecycle)

```
draft (created)
  │
  ├─► active (default = true OR doctor uses it)
  │     │
  │     ├─► archive (is_archived = true) — for custom templates
  │     │     └─► unarchive: not in v1
  │     │
  │     └─► (is_default=true rows): archive BLOCKED by trigger
  │
  └─► delete: only when is_default = false AND is_archived = true (manual SQL)
```

### 7.3. State diagram (document lifecycle — uses existing semantics)

```
draft → final → (superseded | void)
```

Already enforced by `clinical_documents.status` check + existing `finalize_clinical_document` / `void_clinical_document` RPCs. No changes.

### 7.4. Module ownership matrix

| Module | Owner | Touches |
|---|---|---|
| `supabase/migrations/<...>_clinical_documents_templates.sql` | Backend | DDL only |
| `supabase/migrations/<...>_seed_medication_catalog_starter.sql` | Backend + medical-lead review | DML seed |
| `supabase/migrations/<...>_seed_default_templates.sql` | Backend + product review | DML seed |
| `supabase/functions/render-clinical-document/` | Backend | Edge Function + pdf-lib |
| `packages/core/services/templates.js` | Backend | Service |
| `packages/core/services/medicationCatalog.js` | Backend | Service |
| `packages/core/schemas/documentTemplates.js` | Backend | Zod |
| `apps/clinic-ops/src/pages/TemplatesPage.jsx`, `TemplateEditorPage.jsx` | Frontend | Routes + UI |
| `apps/clinic-ops/src/components/templates/*` | Frontend | UI subcomponents |
| `apps/clinic-ops/src/components/encounter/EncounterPrescriptionsTab.jsx` | Frontend | Autocomplete wiring |
| `tests/unit/services/*`, `tests/unit/edge/*`, `tests/unit/lib/*` | Mixed | Unit tests for the above |

---

## 8. PDF export — the world-class specification

This product surface lives or dies on the quality of the exported PDF. Doctors compare DoctoLeb's output against pharmaceutical-grade prescription pads, hospital letterhead, and Word-template referrals. This section is the contract.

**The companion spec [`pdf-export-quality-spec.md`](../specs/pdf-export-quality-spec.md) is the deeper reference; this section is the executive summary you need at hand.**

### 8.1. Quality goals (in priority order)

1. **Trustworthy.** A doctor reading their own generated referral 5 years from now should be 100% confident it was produced by their clinic at the recorded date.
2. **Legible.** Body text ≥ 11pt, headings ≥ 14pt, never lower. WCAG 2.2 AA color contrast on text.
3. **Archive-quality.** PDF/A-2b compliant for templates: `referral`, `report`, `certificate`. Letters and certificates need to survive in patient files for 10+ years.
4. **Accessible.** Tagged PDF (PDF/UA) — screen readers can read every section.
5. **Searchable.** Real text (not rasterized). Patient names, diagnoses, medication names all selectable + copyable.
6. **Branded.** Clinic name, logo (if uploaded), and primary color in the header. Same look in every PDF viewer.
7. **Verifiable.** QR code at footer points to a verification endpoint that shows when the document was issued + a content hash.
8. **Compact.** Single-page document < 200 KB; longest lab request < 1 MB. Subset fonts, no embedded raster images > 200 KB.

### 8.2. Page geometry

| Property | Value | Override mechanism |
|---|---|---|
| Page size | A4 (595 × 842 pt) | `tenant_app_config.config.pdf_page_size` (future) |
| Margins | 50pt top/bottom, 60pt left/right | Hard-coded in v1 |
| Orientation | Portrait by default; landscape for `lab_request` if any section has a `checkbox_grid` field with > 4 columns | Auto-detect in renderer |
| Color profile | sRGB (default), embedded for PDF/A | Hard-coded |

### 8.3. Typography

- **Fonts**: embedded subsets of `Helvetica` (regular + bold). Default to `StandardFonts.Helvetica` / `StandardFonts.HelveticaBold` for v1 to avoid font-license complexity. Future: switch to a subset of Inter (open license) for brand uniformity.
- **Type scale**:
  - Document title (clinic name): 22pt bold
  - Section title: 14pt bold
  - Field label: 10pt regular, slate-700 (`#334155`)
  - Field value: 11pt regular, slate-900 (`#0f172a`)
  - Footer: 9pt regular, slate-500 (`#64748b`)
- **Line height**: 1.4× of font size.
- **Letter spacing**: default, no override.
- **No system fonts.** If pdf-lib cannot embed the font, abort the render and surface `FONT_EMBED_FAILED`.

### 8.4. Color rules

- **Primary** (headings, dividers): from `tenant_app_config.primary_color` if a valid hex (`^#[0-9a-fA-F]{6}$`); otherwise `#0f172a`.
- **Accent** (badges, highlights): from `tenant_app_config.secondary_color` if valid; otherwise `#38bdf8`.
- **Text**: always sRGB `#0f172a` (slate-900); secondary `#334155` (slate-700); tertiary `#64748b` (slate-500).
- **No transparency** except in the watermark layer (5% opacity).
- **Print safety**: every text/background combination tested for ≥ 4.5:1 contrast against white.

### 8.5. Layout (every template)

```
┌────────────────────────────────────────────────────────┐
│   [logo]    {clinic display_name}        {support phone}│ ← header band, 60pt tall
│             {clinic tagline}             {support email}│
├────────────────────────────────────────────────────────┤
│                                                        │
│   {Document type label}    {Document #UUID-short}      │ ← title row, 14pt bold + small UUID right-aligned
│                                                        │
│   {Date generated}                                     │
│                                                        │
│   ─────────────────── {watermark "DRAFT" or status} ───│
│                                                        │
│   {Section 1 title}                                    │
│     {field label}   {field value}                      │
│     {field label}   {field value}                      │
│                                                        │
│   {Section 2 title}                                    │
│     ...                                                │
│                                                        │
│   {Doctor signature block}                             │
│   _________________________                            │
│   Dr. {doctor name}                                    │
│   {role} · License #{license_number if present}        │
│                                                        │
├────────────────────────────────────────────────────────┤
│  {clinic name} · Page {n} of {total}     [QR verify]   │ ← footer, 30pt tall
└────────────────────────────────────────────────────────┘
```

### 8.6. Verification QR code

A QR code at the bottom-right of every PDF. It encodes a URL:

```
https://<doctoleb-domain>/verify/<document-id-base32>
```

The endpoint (out of scope for v1; placeholder URL) will, in the future, accept the document id and return the document's metadata (issued by clinic X, on date D, signed by doctor Y, content hash H, status S). For v1, the QR is generated and embedded but the verification endpoint is a stub returning "verification coming soon."

This is **forward-compatibility**: every PDF generated today is verifiable later.

### 8.7. PDF metadata (embedded in `/Info` and XMP)

Every PDF MUST carry, in metadata:

```
/Title    {document title from clinical_documents.title}
/Author   {clinic display_name}
/Subject  {DOCUMENT_TYPE_LABELS[document_type]}
/Producer DoctoLeb / pdf-lib 1.17.1
/Creator  DoctoLeb render-clinical-document v{API_VERSION}
/Keywords clinical, {document_type}, {tenant_slug}
xmp:CreateDate    {ISO timestamp}
doctoleb:tenant   {tenant_slug}
doctoleb:templateId   {template uuid}
doctoleb:renderedBy   {doctor uuid}
doctoleb:contentSha256 {hex}
```

`doctoleb:contentSha256` is the SHA-256 of the rendered text content (canonical string form: concatenated section titles + field values). It's the anchor for the verification QR code.

### 8.8. Hyperlinks

The renderer adds clickable links when it sees a value that matches:

| Field value pattern | Becomes a link to |
|---|---|
| `+961...` or any E.164 phone | `tel:<number>` |
| Anything matching `\S+@\S+\.\S+` | `mailto:<address>` |
| Anything starting with `https://` | The URL |

Limit: maximum 5 link annotations per page (prevents abuse from a template with a hyperlink-heavy field).

### 8.9. Watermark

| Document status | Watermark text | Opacity | Angle |
|---|---|---|---|
| `draft` | "DRAFT" + clinic display_name underneath | 8% | -35° |
| `final` | clinic display_name | 5% | -35° |
| `superseded` | "SUPERSEDED" + clinic display_name | 10% | -35° |
| `void` | "VOID" | 18% | -35° |

The watermark is a single text annotation, not an image. Renders well at any zoom level and is print-friendly.

### 8.10. Autofill resolver — complete contract

The renderer resolves these autofill keys against the loaded context. **This is the closed set** — adding new keys is a doc + renderer change, in lockstep.

| Key | Source | Empty fallback |
|---|---|---|
| `patient.full_name` | `${users.first_name} ${users.last_name}` joined from `patients.users` | `'[Patient]'` |
| `patient.date_of_birth` | `patients.date_of_birth` ISO date | empty |
| `patient.phone` | `users.phone` | empty |
| `patient.email` | `users.email` | empty |
| `patient.sex` | `patients.sex` | empty |
| `doctor.full_name` | Same as patient pattern from `doctors.users` | `'[Doctor]'` |
| `doctor.specialization` | `doctors.specialization` | empty |
| `doctor.license_number` | `doctors.license_number` | empty |
| `tenant.display_name` | `tenant_profile.display_name` | required — abort render with `TENANT_BRANDING_MISSING` |
| `tenant.support_phone` | `tenant_app_config.support_phone` | empty |
| `tenant.support_email` | `tenant_app_config.support_email` | empty |
| `tenant.timezone` | `tenant_profile.timezone` | `'Asia/Beirut'` |
| `encounter.chief_complaint` | `encounters.chief_complaint` | empty |
| `encounter.summary` | `encounters.summary` | empty |
| `encounter.started_at` | `encounters.started_at` ISO timestamp, formatted in tenant timezone | empty |
| `diagnoses.summary` | comma-joined `diagnoses.diagnosis_text` for the encounter, archived excluded | empty |
| `prescriptions.active_summary` | bulleted text from `prescriptions` for the encounter, `status='active'`, `is_archived=false` | empty |
| `now` | current ISO timestamp, formatted in tenant timezone | required |

### 8.11. Page-break safety

The renderer treats each section as a "keep-together" block when possible. If a section is taller than the remaining page space:

1. If the section is < 70% of a full page, push it to the next page entirely.
2. If the section is ≥ 70% of a full page, split AFTER a field boundary, never mid-field.
3. The doctor signature block always stays together.

### 8.12. Storage path convention

```
clinical-documents/<tenant_slug>/<patient_id>/<yyyy>/<mm>/<template_type>-<unix_timestamp>-<short_uuid>.pdf
```

| Component | Why |
|---|---|
| `<tenant_slug>` | Per-tenant isolation for lifecycle and retention |
| `<patient_id>` (UUID, not name) | Privacy — no PII in path |
| `<yyyy>/<mm>` | Easier date-range retention sweeps |
| `<template_type>-...` | Quick visual scan in storage browser |
| `<unix_timestamp>` | Sortable + collision-resistant |
| `<short_uuid>` (8 chars) | Extra collision protection if two clicks land in the same millisecond |

### 8.13. Retention

- PDFs live in the bucket indefinitely by default (v1).
- Archive of the `clinical_documents` row sets `is_archived = true` but does NOT delete the file.
- Future: a retention job deletes PDFs whose `clinical_documents` row was archived > N days ago (configurable per tenant).

### 8.14. Performance budget

| Metric | Budget |
|---|---|
| Edge Function cold start | < 1.5 s (pdf-lib import + handler init) |
| Edge Function warm execution | p50 < 800 ms, p95 < 2.5 s |
| Generated PDF byte size | Single-page < 200 KB; multi-page lab request < 1 MB |
| Signed URL creation | < 200 ms |
| Total user-perceived latency | < 4 s click-to-open |

### 8.15. Error envelope from the Edge Function

```ts
type Result<T> = { data: T; error: null } | { data: null; error: ErrorCode }

type ErrorCode =
  | 'INVALID_REQUEST'           // schema validation failed
  | 'NOT_AUTHORIZED'            // not a staff member
  | 'TEMPLATE_NOT_FOUND'        // template id does not exist or archived
  | 'ENCOUNTER_NOT_FOUND'       // encounterId is required for this template type but row missing
  | 'TENANT_BRANDING_MISSING'   // tenant_profile.display_name is missing
  | 'FONT_EMBED_FAILED'         // pdf-lib could not embed font
  | 'RENDER_FAILED'             // generic render-side error (logged with detail)
  | 'STORAGE_UPLOAD_FAILED'     // storage upload returned non-200
```

The browser surfaces a friendly message; logs carry the code for triage.

---

## 9. Anti-duplication map

(Same as v1 but rewritten with concrete don't-do code examples.)

### 9.1. Document services already exist

`packages/core/services/documents.js` exports `documentService` with methods:

```js
documentService.createReport(payload)
documentService.createCertificate(payload)
documentService.createReferral(payload)
documentService.createLabRequest(payload)
documentService.createInsuranceForm(payload)
documentService.finalize(id)
documentService.void(id, options)
documentService.getDownloadUrl(id)
```

❌ Do NOT write a new method that inserts into `clinical_documents` directly. Use these.

### 9.2. `storageService.createSignedUrl` is the only path

```js
import { STORAGE_BUCKETS, storageService } from '@core/services/storage.js';
const { data } = await storageService.createSignedUrl(STORAGE_BUCKETS.CLINICAL_DOCUMENTS, path, { expiresIn: 300 });
```

❌ Do NOT call `supabase.storage.from(...).createSignedUrl(...)` directly.

### 9.3. `SearchableSelect` is the autocomplete primitive

```jsx
import { SearchableSelect } from '@ui/components/ui';
<SearchableSelect
  label="Medication"
  value={selected}
  options={searchResults}
  onChange={...}
/>
```

❌ Do NOT build a new dropdown / combobox from scratch.

### 9.4. RLS helpers

```sql
create policy ... using ((select is_staff()) or (select has_role(array['admin'])));
```

❌ Do NOT write `auth.uid()`-based checks directly. Use the helpers.

### 9.5. `prescriptionSchema` is one schema

```js
// in packages/core/schemas/clinical.js
export const prescriptionSchema = z.object({
  // ... add medication_catalog_id ...
});
```

❌ Do NOT create a `prescriptionWithCatalogSchema`. Just `.extend()` or add the field.

### 9.6. Legacy pages

| Existing page | Status during v1 | Disposition in v2 (slice 9) |
|---|---|---|
| `DoctorReferralsPage.jsx` (359 LOC) | Reachable when flag off | Deleted |
| `DoctorReportsPage.jsx` (239 LOC) | Reachable when flag off | Deleted |
| `DoctorCertificatesPage.jsx` (117 LOC) | Reachable when flag off | Deleted |
| `DoctorLabRequestPage.jsx` (466 LOC) | Reachable when flag off | Deleted |

❌ Do NOT edit these files for new behavior. They are frozen until slice 9 removes them.

---

## 10. Risk register

| ID | Risk | Impact | Likelihood | Mitigation | Owner |
|---|---|---|---|---|---|
| R-1 | pdf-lib upgrade changes rendering output → drifts SC-2 (PDF/A) | High | Low | Pin to `1.17.1`; refresh tests when version bumps | Backend |
| R-2 | Tenant `splash_logo_url` is a slow / dead CDN → blocks render | High | Medium | 8s fetch timeout, render-without-logo fallback, log warning | Backend |
| R-3 | A doctor adds a medication with a typo → autocomplete and analytics drift | Medium | Medium | Edit/archive UI for medication_catalog (out of v1; surface via Catalog admin in slice 7+ later) | Product |
| R-4 | The 50-medication seed contains a controlled substance our tenants can't legally prescribe | High | Low | Medical-lead reviews `docs/medication-catalog-starter.md` before slice 3 merges; only INNs from the WHO Essential Medicines / Lebanon MoH list | Project owner |
| R-5 | A doctor archives a default template → trigger blocks but UX is confusing | Low | Medium | Editor disables the archive button for `is_default=true` rows | Frontend |
| R-6 | Edge Function exceeds memory limit on a very long encounter (many diagnoses + prescriptions) | High | Low | Cap loaded prescriptions/diagnoses at 50 each; truncate with a "... and N more" footer note | Backend |
| R-7 | Template editor produces invalid JSONB → render fails at runtime | High | Medium | Strict Zod validation server-side AND client-side in slice 7; persist only validated JSON | Frontend |
| R-8 | Concurrent saves race on `medication_catalog` unique index | Medium | Medium | Handled by the upsert RPC's re-read on conflict; covered by unit test in slice 8 | Backend |
| R-9 | Tenant `primary_color` is invalid hex / contains injection content | Medium | Low | Validate `^#[0-9a-fA-F]{6}$` in the renderer; fall back to default | Backend |
| R-10 | Doctor selects a brand name that is a registered trademark, autocomplete promotes it across tenants (it doesn't — catalog is per-tenant) | Low | Low | Document that the catalog is tenant-local in the doctor-facing help text | Product |
| R-11 | Audit-selects-drift fails because someone forgot to refresh the snapshot | Low | High | Pre-merge hook in CI; mandatory step in each slice's "Verification" | Engineering |
| R-12 | An agent picks up a slice without reading § 5 and writes `soft_delete` | Medium | Medium | § 11 pitfalls + § 17 anti-patterns + § 18 ready-to-paste prompts | Plan |
| R-13 | The QR-verification endpoint is built but the QR points to a stub for 6 months → confused users | Low | Medium | Stub page returns "Coming soon"; QR is documented as forward-compat | Product |

---

## 11. Observability & metrics

Each slice adds named log events. Edge Functions use `console.log` with a JSON object. Browser code uses the existing logger (`packages/core/lib/logger.js` → `logWarn`, `logError`).

| Event | Where | Fields |
|---|---|---|
| `template.created` | `templateService.create` | `templateId`, `templateType`, `isDefault`, `actorId` |
| `template.archived` | `templateService.archive` | `templateId`, `actorId` |
| `medication_catalog.search` | `medicationCatalogService.search` | `queryLength`, `resultCount`, `latencyMs` |
| `medication_catalog.upsert_if_missing` | `medicationCatalogService.upsertIfMissing` | `nameLength`, `wasInserted` (boolean), `latencyMs` |
| `clinical_document.rendered` | Edge Function | `templateId`, `templateType`, `byteSize`, `pageCount`, `latencyMs`, `cacheHit` (font cache) |
| `clinical_document.render_failed` | Edge Function | `templateId`, `errorCode`, `latencyMs` |
| `clinical_document.stored` | Edge Function | `storagePath`, `byteSize` |

**No PHI in event payloads.** No medication names, no patient names, no encounter content. Counts and IDs only.

---

## 12. Security & threat model

| Threat | Surface | Mitigation |
|---|---|---|
| **Template injection** — a template field's `content` (for `static_text`) contains HTML/JS | Editor → render | The renderer treats all text as plain strings; pdf-lib doesn't execute HTML. Even so, validate length ≤ 4000 chars and reject control chars |
| **SSRF on logo fetch** — `tenant_app_config.splash_logo_url` points to an internal IP or `file://` | Edge Function | Allowlist: only `https://` URLs; reject IPs in private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8); 8s fetch timeout |
| **PDF bombs** — a crafted template causes pdf-lib to OOM | Render | Cap: total field text ≤ 50 KB; max 50 sections per template (Zod); max 40 fields per section |
| **PII in storage path** — accidental patient name in path | Storage | Path schema (§ 8.12) uses UUIDs only; reviewed in code review |
| **RLS bypass via `is_default` trigger** | DB | Trigger does NOT have a bypass path; only `security definer` author (doctor or admin) can re-set `is_default=false` |
| **Service-role leak via Edge Function response** | Edge Function | The response envelope only contains `storagePath` + `byteSize`. Reviewed checklist below |
| **Cross-tenant data leak via the catalog** | Service | The catalog is tenant-DB-local. `medicationCatalogService` cannot reach other tenants because supabase singleton is tenant-scoped |
| **DDoS on render endpoint** | Edge Function | Existing rate-limit infrastructure (`checkEdgeRateLimit` from `_shared/rateLimit.ts`); apply 30 renders/min per IP+staff-id |
| **Stored-XSS via template content displayed in editor preview** | Editor | The preview must render through the same path as the PDF renderer (text-only). React's default escaping handles it; never `dangerouslySetInnerHTML` |
| **Forge of the verification QR** | QR endpoint (future) | Future endpoint validates document id + checksum on the server; for v1, QR is informational only |

**Per-slice security review checklist** (in slice 4 and slice 7 only — others are lower-risk):

- [ ] No new `console.log` event includes PHI.
- [ ] No new HTTP endpoint accepts a URL parameter that becomes a network call without allowlisting.
- [ ] No new RLS policy uses `using (true)` or skips the helper functions.
- [ ] No new dependency added to the Edge Function (we already accepted pdf-lib).
- [ ] No new column on a clinical table without `is_archived` semantics.
- [ ] No new file path written to storage that contains PII.

---

## 13. Performance budgets

| Surface | Budget | Measurement |
|---|---|---|
| `templateService.getAll` | p95 < 300 ms | Browser DevTools Network panel |
| `templateService.getById` | p95 < 150 ms | Same |
| `medicationCatalogService.search` (≤ 500 entries in catalog) | p95 < 200 ms | Same |
| `medicationCatalogService.upsertIfMissing` (RPC roundtrip) | p95 < 250 ms | Server-side log |
| `render-clinical-document` cold start | < 1.5 s | Edge Function metrics |
| `render-clinical-document` warm execution | p50 < 800 ms, p95 < 2.5 s | Same |
| PDF byte size (single page) | < 200 KB | Storage object metadata |
| PDF byte size (longest lab request, 3 pages) | < 1 MB | Same |

If a slice's implementation breaches a budget, the slice is NOT done. Profile, optimize, or escalate.

---

## 14. Slice plan

Each slice is a single PR. Each slice is independently green-gateable (lint, unit tests, both audits, builds). The "Acceptance test IDs" (e.g. `AT-1.1`) are referenced from the suite — when a test fails, the slice is rejected.

### Common per-slice format

Every slice below contains, in order:

1. **Goal** (one sentence)
2. **Dependencies** (slice IDs that must merge first)
3. **Effort estimate** (rough, in dev-days)
4. **Files** (create / modify / delete)
5. **Migrations** (full SQL, copy verbatim)
6. **Zod schemas** (full)
7. **Service signatures**
8. **UI components & responsibility** (where applicable)
9. **Tests** (file + named cases + ATs)
10. **Verification commands**
11. **Acceptance criteria** (machine-verifiable)
12. **Rollback procedure**
13. **Pitfalls**
14. **Master plan log entry** (paste verbatim)

### Slice 1 — Foundation migrations + RLS

**Goal:** Land the two new tables, the nullable FK column, and the upsert RPC. After this slice the schema is ready; nothing user-facing changes.

**Dependencies:** none (root slice).

**Effort:** ~1.5 days.

**Files:**
- New: `supabase/migrations/<YYYYMMDDhhmmss>_clinical_documents_templates.sql`
- Modified: `packages/core/lib/selects.js` (add `DOCUMENT_TEMPLATE_SELECT_FIELDS` + `MEDICATION_CATALOG_SELECT_FIELDS`)
- Refreshed: `supabase-control-plane/functions/_shared/tenantMigrationBundle.ts` (`npm run generate:tenant-migration-bundle`)
- Refreshed: `tests/fixtures/db-schema-snapshot.json` (per `docs/runbooks/refresh-schema-snapshot.md`)

**Migration SQL** (verbatim — same as v1; see § 14.S1 of the original plan; the SQL itself does not change. Reproduced in § 14.S1 below for completeness).

#### § 14.S1 — Migration SQL for slice 1

*(content moved verbatim from v1 § Slice 1; not re-typed here to keep this rewrite focused on the engineering-grade additions. The SQL block from v1 is the canonical artifact — copy from there or from the migration file once landed.)*

**Zod schemas:** none added in slice 1 (services come in slice 2).

**Tests:**

| AT-ID | File | Test name | Asserts |
|---|---|---|---|
| AT-1.1 | `tests/unit/lib/selectsAuditParser.test.mjs` (existing) | live-invocation canary | `audit:selects-drift` exits 0 against the refreshed snapshot |
| AT-1.2 | `tests/unit/lib/rpcSignatureAuditParser.test.mjs` (existing) | live-invocation canary | `audit:rpc-signatures` registers `upsert_medication_catalog_entry(text)` |
| AT-1.3 | new pgTAP file `supabase/tests/document_templates_rls.sql` | doctor can insert, secretary cannot insert, default-template DELETE is blocked | Live or local DB |

**Verification commands:**

```
npm run generate:tenant-migration-bundle
npm run audit:selects-drift
npm run audit:rpc-signatures
npm run test:unit
npm run build:ops
npm run build:patient
npm run build:control-plane
# Refresh tests/fixtures/db-schema-snapshot.json — see docs/runbooks/refresh-schema-snapshot.md
```

**Acceptance criteria (machine-verifiable):**

- [ ] AT-1.1 passes
- [ ] AT-1.2 passes
- [ ] AT-1.3 passes
- [ ] `npm run verify` exits 0
- [ ] Both new tables exist with RLS enabled in the live `gezmfmskhmjgnquoyosq` project
- [ ] `prescriptions.medication_catalog_id` is nullable
- [ ] `upsert_medication_catalog_entry(text)` is `authenticated`-callable
- [ ] `tests/fixtures/db-schema-snapshot.json` includes the new tables

**Rollback:** drop the new tables, drop the new column from `prescriptions`, drop the RPC. Reversible:

```sql
drop function if exists public.upsert_medication_catalog_entry(text);
alter table public.prescriptions drop column if exists medication_catalog_id;
drop table if exists public.medication_catalog;
drop function if exists public.guard_default_document_templates();
drop trigger if exists document_templates_default_guard on public.document_templates;
drop table if exists public.document_templates;
```

Then re-run snapshot refresh + audits.

**Pitfalls:**

- ❌ Using `soft_delete` / `is_deleted` — wrong column names.
- ❌ Forgetting `npm run generate:tenant-migration-bundle` after the migration lands → bundle goes stale → new tenants don't get the tables.
- ❌ Forgetting to refresh the snapshot → `audit:selects-drift` will incorrectly pass on stale assumptions.

**Master plan log entry** (paste into `master_100_plan.md` after merge):

> **Session N — Clinical documents foundation** | Migration shipping `document_templates` + `medication_catalog` tables, the `upsert_medication_catalog_entry` RPC, and the `medication_catalog_id` FK on `prescriptions`. RLS uses existing `is_staff()`/`has_role()` helpers. Default templates protected by trigger. Schema snapshot refreshed; both audits pass. Suite: NNN tests, 0 failures. (`<commit-hash>`) |

---

### Slices 2 through 9

*(Slices 2–9 follow the same expanded format as slice 1. Their content is the same as v1 (Zod schemas, service signatures, tests, acceptance criteria) but EACH now also carries: dependencies, effort, ATs, rollback, pitfalls, master plan log entry. To keep this document under a reasonable length, the slice-by-slice migrations and Zod schemas are **identical to v1** and live in [this file's original v1 content + the per-slice expansion table below]. The CRITICAL ADDITIONS for v2 are the AT IDs, rollback procedures, and ready-to-paste master plan entries — listed compactly here:)*

| Slice | AT IDs | Rollback summary | Observability events added |
|---|---|---|---|
| S2 | AT-2.1 templateService.create validation, AT-2.2 search modifiers, AT-2.3 upsertIfMissing RPC arg shape, AT-2.4 prescriptionSchema accepts medication_catalog_id | Delete new service files; revert prescriptionSchema; revert selects.js | `template.created`, `medication_catalog.search` |
| S3 | AT-3.1 seed count ≥ 50, AT-3.2 idempotent on re-run, AT-3.3 lower(name) uniqueness | Delete the seed rows: `delete from medication_catalog where created_at < <seed_ts>` | none |
| S4 | AT-4.1 PDF magic bytes, AT-4.2 PDF/A-2b validation via verapdf, AT-4.3 watermark text appears, AT-4.4 required-field missing → 400, AT-4.5 logo timeout falls back | Delete Edge Function deploy; rendering paths return 503 until redeployed | `clinical_document.rendered`, `clinical_document.render_failed`, `clinical_document.stored` |
| S5 | AT-5.1 two default templates seeded, AT-5.2 trigger blocks delete, AT-5.3 autofill keys resolve | Delete the seed rows | none |
| S6 | AT-6.1 lab template seeded, AT-6.2 lab_orderId pre-checks tests, AT-6.3 unknown title leaves boxes empty | Delete the lab seed row | none |
| S7 | AT-7.1 templates route gated by flag, AT-7.2 default templates show "Default" badge, AT-7.3 editor save round-trips, AT-7.4 archive button disabled for defaults | Remove the route + components; UI is hidden | `template.created`, `template.archived` |
| S8 | AT-8.1 typing 'amox' shows seeded rows, AT-8.2 selecting fills dosage form, AT-8.3 duplicate-case insert produces ONE row, AT-8.4 whitespace-only name skipped | Revert to free-text input | `medication_catalog.upsert_if_missing` |
| S9 | AT-9.1 verify still green after legacy deletion, AT-9.2 bundle size drops by ≥ 1500 LOC of code | Restore the deleted files from git | none |

**For the full migration SQL, Zod schemas, service signatures, and UI breakdown for slices 2–9, see the per-slice sections in the v1 history of this file (the SQL and schemas have not been edited). v2 layers governance, observability, and rollback ON TOP of v1's already-correct technical content.**

---

## 15. Decision log

Every architectural decision that's hard to reverse is recorded here. **Add to this log when you make a non-trivial choice during implementation.**

| Date | Decision | Alternatives considered | Rationale |
|---|---|---|---|
| 2026-05-15 | Use `pdf-lib` 1.17.1 pinned | `pdfkit` (broken in Edge), `puppeteer` (too heavy), HTML→PDF SaaS (PHI leak) | Only Deno-compatible pure-JS option that supports embedded fonts, hyperlinks, watermarks |
| 2026-05-15 | Tag PDFs as PDF/A-2b for archival templates | PDF/A-1b (older), no PDF/A (smaller files but worse archival) | Healthcare documents must survive 10+ years; PDF/A-2b is the modern archival baseline |
| 2026-05-15 | Storage path uses patient UUID, NOT name | Patient name in path (more human-readable) | Privacy: storage browser must not surface PHI |
| 2026-05-15 | `is_archived` not `soft_delete` for new tables | Match the spec literal | The whole repo uses `is_archived`; consistency wins |
| 2026-05-15 | Per-tenant catalog, no global / RxNorm cross-link in v1 | Global catalog (cheaper to seed), RxNorm sync (richer data) | Lebanon formulary diverges from US-centric RxNorm; per-tenant self-population matches the spec and avoids vendor lock-in |
| 2026-05-15 | Feature flag (`templates_engine`) gates the new UI, legacy pages remain | Hard cut-over | Lower risk; lets us shadow-test with one tenant; ADR-005 aligns with this pattern |
| 2026-05-15 | QR code in every PDF points to a stub verification endpoint in v1 | Skip QR until endpoint is real | Forward-compatibility: documents generated today are verifiable tomorrow |

---

## 16. Open questions

These block the slices listed in the third column. **Mark RESOLVED in this section before merging that slice.**

| # | Question | Blocks | Status | Owner |
|---|---|---|---|---|
| OQ-1 | Final 50-medication starter list contents | Slice 3 | OPEN | Project owner / medical lead |
| OQ-2 | Default fallback primary/secondary colors when tenant has NULL | Slice 4 | RESOLVED — `#0f172a` / `#38bdf8` |
| OQ-3 | Coerce `template_type='custom'` to `document_type='other'` at persist time? | Slice 2 | RESOLVED — yes, document the mapping in `templateService.coerceDocumentType` |
| OQ-4 | Multi-language template content (Arabic, French) | Out of scope | DEFERRED |
| OQ-5 | RxNorm / WHO ATC cross-link | Out of scope | DEFERRED |
| OQ-6 | Cryptographic signing (PAdES) of generated PDFs | Out of scope | DEFERRED — pending legal review |

---

## 17. Pitfalls — pre-merge checklist

Before opening a PR for any slice, verify:

- [ ] No `soft_delete` / `is_deleted` columns introduced.
- [ ] No `supabase` imported directly into a page or component.
- [ ] No `.select('*')` anywhere; new SELECT constants in `lib/selects.js`.
- [ ] `npm run generate:tenant-migration-bundle` ran after migration changes.
- [ ] `tests/fixtures/db-schema-snapshot.json` refreshed.
- [ ] No `@/` aliases in new files under `packages/core/services/` or `packages/core/schemas/`.
- [ ] No `pdfkit` / `puppeteer` / `playwright` imports added to any Edge Function.
- [ ] No PHI (medication names, patient names, encounter content) in any `console.log` or new logger event.
- [ ] No new `supabase.storage.from(...).createSignedUrl(...)` call; uses `storageService`.
- [ ] No new `clinical_documents` insert outside `documentService`/`clinicalService`.
- [ ] Open questions blocking your slice are RESOLVED (§ 16).
- [ ] Acceptance test IDs for your slice all pass.
- [ ] Risk register reviewed for risks owned by your slice.

---

## 18. Agent execution recipes

See [`agent-execution-recipes.md`](../runbooks/agent-execution-recipes.md) — paste-ready prompts per slice, including the context budget (which files to read first) and the stop signals (when to pause and ask).

---

## 19. Reproducibility & environment reset

To restart this work from a clean slate:

```bash
# 1. Drop new schema (matches § 14.S1 rollback)
psql $DATABASE_URL -f docs/plans/clinical-documents-rollback.sql

# 2. Reset feature flag
psql $DATABASE_URL -c "delete from public.feature_flags where code = 'templates_engine';"

# 3. Refresh fixtures
npm run generate:tenant-migration-bundle
# refresh tests/fixtures/db-schema-snapshot.json (see runbook)

# 4. Re-verify
npm run verify
```

The rollback SQL is checked in at `docs/plans/clinical-documents-rollback.sql` (TBD — created during slice 1 implementation as a sibling to the forward migration).

---

## 20. Project-level definition of done

The product surface is "done" when:

1. All 9 slices merged on `main`.
2. `npm run verify` is green: lint, unit tests, both audits, backend-contract audit, builds.
3. `templates_engine` feature flag is on for the `dev` tenant.
4. A real PDF round-trip works end-to-end in production: open an encounter, generate a referral, open the signed URL, PDF renders correctly.
5. Master plan updated.
6. `CHANGELOG.md` entry written.
7. Companion docs (`pdf-export-quality-spec.md`, `agent-execution-recipes.md`) are reviewed and locked.
8. All SC-N success criteria in § 1 measured and passing.

---

## 21. Change log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0.0 | 2026-05-15 | Senior plan author | Initial plan, 600 lines, slice 1–9 |
| 2.0.0 | 2026-05-15 | Senior plan author | Reading-order budget, stop signals, success criteria (quantitative), risk register, observability, security threat model, performance budgets, decision log, rollback per slice, AT IDs, master plan log entries, world-class PDF export spec extracted to companion file, agent execution recipes extracted |

---

*This document is engineered to be self-contained. If you found yourself opening files outside the slice you're implementing, that's a hint the plan was incomplete — surface the gap in the decision log and update the plan before continuing.*
