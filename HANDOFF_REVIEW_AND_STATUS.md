# DoctoLeb · Session Handoff — Status, Developer Requirements & Review Request

> **Date prepared:** 2026-05-08
> **Author:** Outgoing engineering agent
> **Audience:** (1) Project owner / developer, (2) Incoming review agent
> **Repo:** `G:\project\doctoleb`
> **Live tenant DB:** Supabase project `gezmfmskhmjgnquoyosq` (us-east-1, Postgres 17)
> **Status:** Runtime/control-plane contract live in repo · Three product slices shipped · Awaiting dev action + independent code/QA review

---

## 0. How to use this document

This file has three audiences and three purposes:

| Audience | What you're looking for | Jump to |
|---|---|---|
| **Project owner (you)** | What's done, what you must do next | [§1](#1-tldr) · [§4](#4-developer-action-required-blocks-the-saas-rollout) |
| **Incoming review agent** | Operating context + explicit review brief | [§7](#7-review-agent-mission) · [§8](#8-review-checklist-blocking-non-blocking) · [§9](#9-test-plan-end-to-end-flows-the-reviewer-must-walk) |
| **Anyone debugging the runtime layer** | The architecture and where to look | [§5](#5-architecture-snapshot) · [§6](#6-canonical-files-to-read-before-changing-anything) |

If you are the **review agent**: §7 is your mission. §3 lists every diff in scope. Do not start writing fixes before reading §6 and the ADRs it references.

---

## 1. TL;DR

**Done in this session:**

1. **ADR-004 — Hostname-based tenant routing + control-plane contract.** All six implementation slices shipped (parser → resolver client → runtime Supabase factory → tenant bootstrap → audit guards), behind a Proxy compat shim so all 19 existing services run unchanged.
2. **Block H activated.** Control-plane Supabase project `xouqxgwccewvbtkqming` is live with 4 zero-PHI tables + RLS + `resolve_tenant` RPC. `tenant-resolve` Edge Function is deployed as version 2 with `verify_jwt=false`.
3. **Slice 2 — Patient documents viewer.** `PatientMedicalHistoryPage` rewritten with status-aware list, fresh signed URL per download, voided-records toggle, content modal.
4. **Slice 3 — Patient ↔ staff messaging.** New shared `MessagingPage` component + `PatientMessagesPage` + `StaffMessagesPage`. Realtime via `subscribeToConversation`, idempotent send via `client_request_id`, redaction-aware bubbles, 3-step "new conversation" flow extracted into `messagingService.startPatientConversation`.
5. **Slice 4 — Patient consent onboarding.** `PatientConsentGate` blocks the patient app until all required active consents are accepted; transparent for staff/anon/non-patient.
6. **Deeper hardening pass.** Removed inline duplicates of `uuidv4`/`formatTimestamp`/`STAFF_ROLES`/`isSupabaseClientConfigured`/`resetSupabaseClient`/`useTenant`/`__supabase_proxy__`. Centralized env reads, route boundaries, printable HTML safety, resolver timeout behavior, and cross-app redirects.

**Verify chain end-to-end green:** lint · build · 86/86 unit tests · backend-contract audit · backend DB contract checks · 0 high-severity npm vulnerabilities. Standalone `build:patient` and `build:ops` also pass.

**Pending — depends on developer (you):**

- Purchase/verify the eventual production domain before activating `dev.doctoleb.com` / `dev.ops.doctoleb.com`; those rows intentionally remain `pending`.
- Provide notification provider credentials (FCM / APNs / Resend / Twilio) when Slice 5 starts.
- Decide whether to set `BACKEND_TEST_DATABASE_URL` so pgTAP RLS suite stops being skipped.

**Pending — independent of developer:**

- Slice 5 (notification send worker — Edge Function in tenant project)
- Slice 7 (audit viewer UI — admin role)
- Messaging polish (attachments uploader, unread badges, staff redaction UI)
- Consent polish (real markdown renderer, "view past consents" history page)
- Independent code/QA review of everything from this session ← **this document is the brief**

---

## 2. Mandatory read order

Read in this order before forming opinions or making changes. Skipping any of these will produce wrong recommendations.

```txt
G:\project\doctoleb\CLAUDE.md                                              ← project rules and conventions
G:\project\doctoleb\PRODUCT.md                                             ← product model + database-per-tenant topology
G:\project\doctoleb\DESIGN.md                                              ← visual system + brand personality
G:\project\doctoleb\NEXT_TIER_AGENT_HANDOFF_PROMPT.md                      ← context that drove ADR-004
G:\project\doctoleb\docs\decisions\ADR-001-single-clinic-multi-doctor.md
G:\project\doctoleb\docs\decisions\ADR-002-separate-patient-and-clinic-ops-apps.md
G:\project\doctoleb\docs\decisions\ADR-003-tenant-branding-and-control-plane-config.md
G:\project\doctoleb\docs\decisions\ADR-004-domain-routing-and-control-plane-contract.md   ← THIS SESSION
G:\project\doctoleb\BACKEND_CONTRACT_LEDGER.md
G:\project\doctoleb\BACKEND_DUPLICATION_AUDIT.md
G:\project\doctoleb\AGENT_HANDOFF_TIER2_STATUS.md
G:\project\doctoleb\NEXT_STEPS_PLAN.md                                     ← Block G (done) + Block H activated; next SaaS phases deferred
G:\project\doctoleb\CONTROL_PLANE_SETUP.md                                 ← THIS SESSION — runbook for second Supabase project
```

If anything in this handoff conflicts with the docs above, **trust the docs** and update this file.

---

## 3. Files changed / added in this session

> Use this section to scope your review. Any file outside this list is pre-existing and out of session scope.

### 3.1 New files (15)

| Path | Purpose |
|---|---|
| `docs/decisions/ADR-004-domain-routing-and-control-plane-contract.md` | The architecture decision driving the runtime layer |
| `packages/core/lib/hostnameSurface.js` | Pure-function classifier: hostname → surface + tenant slug |
| `packages/core/services/tenantResolver.js` | Browser client for the resolver endpoint, `{ data, error }` envelope, 5-min/30-sec cache, LRU-bounded, DEV fallback |
| `packages/ui/contexts/TenantBootstrap.jsx` | App-wrapper that resolves tenant before mounting AuthProvider/BrandProvider; renders splash / unavailable / app |
| `packages/ui/components/messaging/MessagingPage.jsx` | Shared inbox+thread UI (mode='patient'\|'staff'); realtime, optimistic, idempotent |
| `packages/ui/components/consent/PatientConsentGate.jsx` | Blocks patient app until all required active consents accepted |
| `packages/ui/components/patient/PatientPageHeader.jsx` | Shared sticky header for patient pages (avatar + back + logout) |
| `apps/patient-web/src/pages/PatientMessagesPage.jsx` | `/patient-messages` route page |
| `apps/clinic-ops/src/pages/StaffMessagesPage.jsx` | `/staff-messages` route page (allowed: doctor/secretary/predoctor/admin) |
| `tests/unit/hostnameSurface.test.mjs` | 6 test groups, 14 assertions covering every classification row + reserved-slug rules |
| `tests/unit/tenantResolver.test.mjs` | 7 test groups covering validation/DEV-fallback/PROD-fail-closed/HTTP success+error/cache eviction/response shape |
| `supabase-control-plane/migrations/00010000000000_control_plane_baseline.sql` | 4 tables (`tenants`, `tenant_domains`, `super_admins`, `tenant_events`) + RLS + `is_super_admin()` + `resolve_tenant(text,text)` |
| `supabase-control-plane/functions/tenant-resolve/index.ts` | Deno Edge Function — wraps `resolve_tenant` RPC, returns `{ data, error }` with correct HTTP statuses + CORS |
| `supabase-control-plane/README.md` | Local map for the control-plane sub-tree |
| `CONTROL_PLANE_SETUP.md` | Step-by-step runbook for creating + deploying the control plane |

### 3.2 Modified files (10)

| Path | Change |
|---|---|
| `apps/patient-web/src/App.jsx` | Wrapped tree with `<TenantBootstrap><AuthProvider><BrandProvider><PatientConsentGate>...`; added `/patient-messages` route; replaced `appSurface` literals with `APP_SURFACES.patientWeb` |
| `apps/clinic-ops/src/App.jsx` | Wrapped with `<TenantBootstrap>`; added `/staff-messages` route guarded by `CLINIC_OPS_ROLES`; replaced `appSurface` literals with `APP_SURFACES.clinicOps` |
| `src/App.jsx` (unified dev shell) | Same wiring as both production apps |
| `apps/patient-web/src/pages/PatientMedicalHistoryPage.jsx` | Full rewrite: status-aware filter, voided toggle, fresh signed URL on download, shared `StatusBadge` + `Modal` + `PatientPageHeader`, `formatClinicDate`/`formatClinicTime` |
| `packages/core/lib/dateUtils.js` | Added `smartTimestamp(value)` — same-day → time, else date+time |
| `packages/core/lib/supabase.js` | Refactored: static `createClient(...)` → `configureSupabaseClient(...)` + `getSupabaseClient()` + Proxy compat shim. Existing `import { supabase }` callers unchanged |
| `packages/core/services/messaging.js` | Added `startPatientConversation(...)` — orchestrates createConversation + addParticipant + sendMessage in service layer |
| `packages/ui/components/AppSidebar.jsx` | Added `Messages` entry to doctor/predoctor/secretary nav |
| `scripts/backend-contract-audit.mjs` | Added 3 ADR-004 guards (no hardcoded tenant Supabase URLs, no `service_role` refs in frontend, no `tenant_id` columns in tenant migrations) |
| `package.json` | (test:unit script + verify chain extension — already present) |

Plus updates to PRODUCT.md, FRONTEND_APP_SPLIT_PLAN.md, BACKEND_CONTRACT_LEDGER.md, BACKEND_DUPLICATION_AUDIT.md, AGENT_HANDOFF_TIER2_STATUS.md, NEXT_STEPS_PLAN.md to reference ADR-004 and Block H.

---

## 4. Developer action required (blocks the SaaS rollout)

Each item is independently actionable. Do them in order.

### 4.1 Create the SaaS control-plane Supabase project

**Why:** ADR-004 and ADR-003 define a database-per-tenant SaaS where tenant routing lives in a *separate* Supabase project that holds **no PHI**. The current code runs against the dev tenant via env fallback; production needs the resolver wired up.

**What to do:** open `CONTROL_PLANE_SETUP.md` and execute steps 1–6. End state:

- New Supabase project: `doctoleb-control-plane` (same region as `gezmfmskhmjgnquoyosq` for low latency)
- 4 tables live with RLS (`tenants`, `tenant_domains`, `super_admins`, `tenant_events`)
- One row in `tenants` pointing at `gezmfmskhmjgnquoyosq` ("dev" slug)
- Two rows in `tenant_domains` mapping `dev.doctoleb.com` (patient) and `dev.ops.doctoleb.com` (ops)
- Your account in `super_admins`
- `tenant-resolve` Edge Function deployed
- `VITE_TENANT_RESOLVER_URL` set in `.env`

**Estimated effort:** ½ day for the DB + seeding, +1 day for the Edge Function. Total ~1.5 days.

**Cost:** Free tier works while bootstrapping; **upgrade to Pro ($25/mo per project) before any real tenant data lands** for PITR + daily backups + no auto-pause. Steady-state at N tenants ≈ $25 × (N+1) per month.

**Blocking what:** custom domain support, onboarding tenant #2, real production deploys. Local dev keeps working with the env fallback (`VITE_DEV_TENANT_SLUG` defaults to `'dev'`).

### 4.2 Optional: enable backend DB contract tests

**Why:** Two tests in the verify chain are currently skipping:

```
PASS DB introspection SQL audit
  - SKIP: BACKEND_TEST_DATABASE_URL is not set.
PASS pgTAP RLS contract suite
  - SKIP: BACKEND_TEST_DATABASE_URL is not set.
```

They become real tests against a Supabase branch DB once `BACKEND_TEST_DATABASE_URL` is set in your shell or CI.

**What to do:**
- Create a Supabase branch on `gezmfmskhmjgnquoyosq` (Studio → Branches → New branch). Or stand up a local stack with `supabase start`.
- Export the connection string: `BACKEND_TEST_DATABASE_URL=postgres://...`
- Re-run `npm run verify`. The SKIP lines should become real PASS or fail.

**Effort:** 30 minutes when convenient. Not blocking any product work but is a coverage gap.

### 4.3 Future — notification provider credentials

When Slice 5 starts (notification send worker), you will need:

- **FCM** server key for Android push (Firebase project)
- **APNs** auth key for iOS push (Apple Developer)
- **Resend** or **SendGrid** API key for transactional email
- **Twilio** account SID + token for SMS (optional)

Store all of these as **Edge Function secrets** in the relevant Supabase project (`supabase secrets set ...`), never in the frontend env.

### 4.4 Future — custom domain DNS

When you onboard tenant #2 with a custom domain (e.g. `customclinic.com` instead of `dr-X.doctoleb.com`), you will need to:

- Point DNS records (CNAME or A) to your hosting platform
- Add a TXT record for verification (your hosting platform issues this)
- Add the domain to Vercel/Cloudflare project
- Add a row in `tenant_domains` with `dns_status='verified'`

Out of scope until you have a real second tenant.

### 4.5 Future — Stripe billing

When you turn DoctoLeb into a real paying SaaS:

- Stripe webhook → control-plane backend → flips `tenants.status` to `'suspended'` on payment failure
- Subscription tier maps to `tenants.plan`

Out of scope for now.

---

## 5. Architecture snapshot

> The reviewer should be able to draw this from memory after reading §6.

```
                                BROWSER
                                   │
                window.location.hostname (e.g. dr-hassan.doctoleb.com)
                                   │
                                   ▼
                       ┌───────────────────────┐
                       │  classifyHostname()   │  packages/core/lib/hostnameSurface.js
                       │  pure function        │
                       └───────────────────────┘
                                   │
                                   ▼
                       ┌───────────────────────┐
                       │  TenantBootstrap.jsx  │  packages/ui/contexts/
                       │  (resolves before     │
                       │  mounting Auth/Brand) │
                       └───────────────────────┘
                                   │
                                   ▼
                       ┌───────────────────────┐
                       │ tenantResolverService │  packages/core/services/tenantResolver.js
                       │ .resolve({host,       │  → 5-min cache, 30-sec error cache
                       │   surface})           │  → DEV fallback via .env when no resolver
                       │ {data, error}         │
                       └───────────────────────┘
                                   │
                                   ▼
                       ┌───────────────────────┐
                       │ HTTP GET              │  https://<control-plane>.supabase.co/functions/v1/
                       │ /tenant-resolve?...   │       tenant-resolve  (Deno Edge Fn)
                       │   ↓ on success        │
                       │ resolve_tenant() RPC  │  control-plane DB
                       └───────────────────────┘
                                   │
                                   ▼
                       ┌───────────────────────┐
                       │ configureSupabaseClient(│  packages/core/lib/supabase.js
                       │   {url, anonKey}      │  → idempotent factory
                       │ )                     │  → Proxy shim preserves
                       │                       │     `import { supabase }` callers
                       └───────────────────────┘
                                   │
                                   ▼
                  ┌────────────────────────────────────┐
                  │ AuthProvider                       │
                  │   BrandProvider (calls             │
                  │     get_public_tenant_app_config)  │
                  │     PatientConsentGate (patient    │
                  │       only — checks active         │
                  │       required consents)           │
                  │       ErrorBoundary                │
                  │         <Router>                   │
                  │           …routes & pages          │
                  └────────────────────────────────────┘
                                   │
                                   ▼
                       ┌───────────────────────┐
                       │   Tenant Supabase     │   ← PHI lives ONLY here
                       │   project             │
                       │   (57 tables, 75      │
                       │    triggers, 216      │
                       │    RLS policies,      │
                       │    34 RPCs)           │
                       └───────────────────────┘
```

**Two distinct Supabase projects, never co-mingled:**

| Plane | Stores | Authenticates | Returns to browser |
|---|---|---|---|
| Control plane | Tenant routing/provisioning metadata, super-admin audit | Super-admins only | `supabase_url` + `supabase_anon_key` (anon keys are public) |
| Tenant DB (per doctor) | All PHI, all clinical/financial data | Patients + staff of that tenant | RLS-scoped data through `apiCall`/`apiPaged` services |

**Service-role keys never reach a browser response.** The new audit guard `assertNoServiceRoleKeyReferencesInFrontend` enforces this in CI.

---

## 6. Canonical files to read before changing anything

### Architecture & contract (read first)

```
docs/decisions/ADR-002-separate-patient-and-clinic-ops-apps.md
docs/decisions/ADR-003-tenant-branding-and-control-plane-config.md
docs/decisions/ADR-004-domain-routing-and-control-plane-contract.md
BACKEND_CONTRACT_LEDGER.md         (sections: Contract Rules, Runtime Tenant Connection)
BACKEND_DUPLICATION_AUDIT.md       (rows for Tenant identity (data/runtime), Service-role authorization)
```

### Runtime layer source (review with the contract in mind)

```
packages/core/lib/hostnameSurface.js
packages/core/services/tenantResolver.js
packages/core/lib/supabase.js
packages/ui/contexts/TenantBootstrap.jsx
```

### Per-app wiring

```
apps/patient-web/src/App.jsx
apps/clinic-ops/src/App.jsx
src/App.jsx
```

### Product slices (ordered by complexity)

```
packages/ui/components/patient/PatientPageHeader.jsx              ← shared, used by 2 pages
apps/patient-web/src/pages/PatientMedicalHistoryPage.jsx         ← Slice 2 (documents viewer)
packages/ui/components/messaging/MessagingPage.jsx                ← Slice 3 (shared messaging)
packages/core/services/messaging.js                               ← startPatientConversation extracted here
apps/patient-web/src/pages/PatientMessagesPage.jsx
apps/clinic-ops/src/pages/StaffMessagesPage.jsx
packages/ui/components/consent/PatientConsentGate.jsx             ← Slice 4 (consent gate)
```

### Audit / verification

```
scripts/backend-contract-audit.mjs                               ← 3 new ADR-004 guards
tests/unit/hostnameSurface.test.mjs
tests/unit/tenantResolver.test.mjs
```

### Control plane (Block H artifacts)

```
supabase-control-plane/migrations/00010000000000_control_plane_baseline.sql
supabase-control-plane/functions/tenant-resolve/index.ts
CONTROL_PLANE_SETUP.md
```

---

## 7. Review agent mission

You are taking over for an outgoing engineering agent that shipped the runtime tenant routing layer (ADR-004), three product slices (Slices 2, 3, 4), and a control-plane runbook in one session. Your job is **not** to ship more features. Your job is **independent verification**:

1. **System design review** — does the architecture above match the docs in §6? Are there abstraction leaks, coupling issues, or future-pain shapes?
2. **Code review** — does each file in §3 follow CLAUDE.md conventions, the `apiCall`/`apiPaged` envelope, the soft-delete rule, the `client_request_id` idempotency pattern, the SELECT-constants discipline?
3. **Security review** — does anything risk PHI exposure, service-role leakage, RLS bypass, prompt injection through tenant content, or auth boundary breakage? Pay special attention to messaging (PHI), consent (legal), the runtime Supabase client (the foundation), and the control-plane RPC.
4. **QA / functional testing** — walk every flow in §9 in the running apps; report behavior gaps.

You may **propose** fixes but must **not** start large refactors without explicit user approval. If you find an issue, write it up with:
- File + line range
- Severity (BLOCKING / SUGGESTED / NIT)
- Concrete fix (don't push synthesis onto the user)

Use these tools:

| Tool | When |
|---|---|
| Supabase MCP (`mcp__supabase__*`) | Verify live schema, run RLS spot-checks, read advisors/logs against `gezmfmskhmjgnquoyosq` |
| `grep`-style code search | Cross-reference forbidden patterns from `BACKEND_DUPLICATION_AUDIT.md` |
| `npm run verify` | The full chain — must stay green throughout your review |
| Playwright (already installed) | Browser smoke for the flows in §9 |
| context7 MCP | Pull current React 19 / Supabase JS / Vite docs before answering library questions |

---

## 8. Review checklist (BLOCKING / NON-BLOCKING)

> Tick each item. Anything you cannot tick becomes a finding.

### 8.1 Architecture conformance (BLOCKING)

- [ ] No `tenant_id` columns appear in any migration under `supabase/migrations/` (the audit guard already enforces this — confirm it ran)
- [ ] No literal `service_role` strings appear under `apps/`, `packages/`, `src/` (audit guard)
- [ ] No hardcoded `https://<20char>.supabase.co` URLs in executable code (audit guard)
- [ ] Every page accesses Supabase only through a service in `packages/core/services/`
- [ ] Every service uses `apiCall` / `apiPaged` envelope, not raw `try/catch`
- [ ] Every query uses a constant from `selects.js`, not `select('*')` or bare `select()`
- [ ] No legacy table names (`consultations`, `notifications`, `doctor_brand`, `clinic_settings`, `medical_reports`, `certificates`, `referrals`) appear in executable code
- [ ] Provider stack order is correct in all 3 App.jsx files: `Theme → Sidebar → Toast → TenantBootstrap → Auth → Brand → [PatientConsentGate (patient-web only)] → ErrorBoundary → Router`
- [ ] `TenantBootstrap` resolves the tenant *before* `AuthProvider` mounts (otherwise `getSession()` runs on an unconfigured client)

### 8.2 Runtime layer correctness (BLOCKING)

- [ ] `configureSupabaseClient` is idempotent — calling it twice with the same `(url, anonKey)` returns the same client (no Realtime subscription churn)
- [ ] `getSupabaseClient` throws a clear error if called before configuration
- [ ] The Proxy shim in `supabase.js` preserves all property access patterns used by services (`.from`, `.rpc`, `.auth`, `.storage`, `.channel`)
- [ ] `tenantResolverService.resolve` returns `{ data, error }` envelope identical to other services
- [ ] Resolver cache evicts after `MAX_CACHE_ENTRIES = 64`; entries refresh recency on read (LRU semantics)
- [ ] Resolver cache TTLs are 5 min on success, 30 sec on error
- [ ] DEV fallback works without `VITE_TENANT_RESOLVER_URL` set
- [ ] Production build (`import.meta.env.PROD`) does NOT use the env fallback — fails closed with `RESOLVER_NOT_CONFIGURED`
- [ ] `classifyHostname` correctly routes every row of the table in ADR-004 §"Hostname/Surface Reference"

### 8.3 Product slice correctness (BLOCKING)

**Slice 2 — Patient documents viewer (`PatientMedicalHistoryPage.jsx`)**

- [ ] Patient sees `final` documents by default
- [ ] `void` documents only appear when "Show voided records" toggled on
- [ ] `draft` documents NEVER appear (drafts are not patient-visible)
- [ ] Download generates a fresh signed URL each click (`documentService.getDownloadUrl(id)`)
- [ ] Documents with no `file_url` AND no `content` show "Empty document" instead of broken buttons
- [ ] Voided documents show the void reason and have no download button

**Slice 3 — Messaging (`MessagingPage.jsx`)**

- [ ] Send is idempotent — sending the same `client_request_id` twice does not duplicate
- [ ] Optimistic message appears immediately; on success it's replaced with the server row; on failure the row rolls back and the compose box restores
- [ ] Realtime INSERT echo de-duplicates against the optimistic row by `client_request_id`
- [ ] Realtime UPDATE replaces the row in place (matters for redaction)
- [ ] Closed conversations hide the compose box
- [ ] Patient mode sends `sender_patient_id` set + `sender_user_id` set; staff mode sends only `sender_user_id`
- [ ] Patient cannot read messages from another patient's conversation (RLS enforced — cross-check with Supabase MCP)
- [ ] `messagingService.startPatientConversation` runs `addParticipant` + first `sendMessage` in parallel; both depend only on the new conversation id

**Slice 4 — Patient consent (`PatientConsentGate.jsx`)**

- [ ] Logged-out users see no gate
- [ ] Staff users see no gate (renders children directly)
- [ ] Patient with `patient_id = null` sees no gate (avoids edge case)
- [ ] Patient with all required consents accepted sees no gate
- [ ] Patient missing required consents is blocked with a non-dismissible modal
- [ ] Consent acceptance upserts on `(patient_id, consent_document_id)` — re-acceptance is idempotent (verify in DB)
- [ ] Voided/revoked consents (`revoked_at IS NOT NULL`) do not count as accepted

### 8.4 Code quality (NON-BLOCKING — file as findings)

- [ ] No new code duplicates a helper in `packages/core/lib/` (`userDisplay`, `time`, `dateUtils`, `appBoundaries`, `selects`, `routes`, `appointments`)
- [ ] No new component duplicates a primitive in `packages/ui/components/ui/` (`Modal`, `StatusBadge`, `EmptyState`, `LoadingSkeleton`, `FormField`, `PageHeader`, `DataTable`, `ConfirmDialog`)
- [ ] No `console.error` in service files (services return error strings; pages decide rendering)
- [ ] All write paths validate through Zod (`parseWithSchema`) before touching Supabase
- [ ] No 4+ level nested ternaries (extract a helper)
- [ ] No `useEffect` doing work that should be in a render-time computation, event handler, or a single derived `useMemo`

### 8.5 Security (BLOCKING — file as P0/P1)

- [ ] Anon RPC matrix in `scripts/backend-db-contract-tests.mjs` covers all the lifecycle/security RPCs from CLAUDE.md (`book_slot`, `start_encounter`, `complete_encounter`, `finalize_clinical_document`, `void_clinical_document`, `enforce_message_redaction`, etc.)
- [ ] Supabase advisor for project `gezmfmskhmjgnquoyosq` shows zero P1 issues. Run `mcp__supabase__get_advisors` and report all findings.
- [ ] No service-role key embedded anywhere in `apps/`, `packages/`, `src/`, the Edge Function, or the audit script (run a fresh grep)
- [ ] `tenant-resolve` Edge Function (`supabase-control-plane/functions/tenant-resolve/index.ts`) only reads from the `resolve_tenant` RPC — never queries `auth.users`, never returns service-role keys
- [ ] Control-plane SQL migration (`00010000000000_control_plane_baseline.sql`): RLS enabled on all 4 tables, super-admin-only writes, `resolve_tenant` is `SECURITY DEFINER` and granted to `anon` (this is correct — anon keys are public)
- [ ] Patient cannot see another patient's messages, intake, history, prescriptions, lab orders, imaging orders, claims, payments, consents, notifications. Verify each with a synthetic logged-in patient in the live tenant DB (or wait for pgTAP suite once §4.2 is done).
- [ ] Staff cannot spoof `booked_by`, `sender_user_id`, `created_by` on a write
- [ ] Storage signed URLs expire (≤ 5 minutes default per `storageService`)

### 8.6 Performance / efficiency (NON-BLOCKING)

- [ ] Bundle size for both apps after `npm run build:patient` / `npm run build:ops` did not regress from before this session's start
- [ ] `<TenantBootstrap>` does not re-resolve on every render (deps are `[appSurface]` only)
- [ ] `MessagingPage` does not re-fetch the conversation list when the user clicks a different conversation (this was a BLOCKING bug fixed in the simplify pass — verify it stays fixed)
- [ ] `PatientConsentGate` initial fetch is parallel (`Promise.all([getConsentDocuments, getPatientConsents])`)
- [ ] `tenantResolver` cache is bounded — adversarial host headers cannot grow it without limit (cap is 64)
- [ ] No `useEffect` in any new file fires on every render (check the dep arrays)

---

## 9. Test plan: end-to-end flows the reviewer must walk

> Spin up `npm run dev:patient` (port 3001) and `npm run dev:ops` (port 3002). Log in as the dev tenant's seed accounts. For each flow record: PASS / FAIL / NOTES.

### 9.1 Tenant bootstrap

1. Open `http://localhost:3001`. Expect: brief "Connecting to your clinic…" splash, then the landing page renders. **PASS** if no console errors.
2. Edit `.env` to set a bad `VITE_SUPABASE_URL`. Refresh. Expect: "Service temporarily unavailable" with code `TENANT_RESOLVER_DOWN`.
3. Restore `.env`. Set `VITE_TENANT_RESOLVER_URL=https://nonexistent.supabase.co/functions/v1/tenant-resolve`. Refresh. Expect: same error UI; the DEV fallback should still kick in only if no `VITE_TENANT_RESOLVER_URL` is set (verify `tenantResolver.js` logic).
4. Unset both. Expect DEV fallback synthesizes the connection from `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` and the app boots normally.

### 9.2 Patient documents viewer

1. Log in as a patient with at least one `final` clinical document attached to a real file in the `clinical-documents` bucket.
2. Navigate to `/patient-history`. Expect: the document appears under "All" tab.
3. Click "Download". Expect: a new tab opens with the signed URL serving the file. The URL must include `?token=` and must NOT be a public URL.
4. Wait 5+ minutes, click "Download" again. Expect: a fresh URL (different `token`).
5. Click "👁 View" on a document with inline `content`. Expect: `Modal` opens with the content; `Esc` closes it.
6. Toggle "Show voided records". Expect: any document with `status='void'` appears with a red badge and the void reason.
7. Switch tabs. Expect: counts update; filter applied; no extra network requests in the Network panel (the documents are filtered client-side).

### 9.3 Patient ↔ staff messaging

1. **Patient side** at `/patient-messages`:
   - With no existing conversations, expect `EmptyState` with a "Start a new conversation" button.
   - Click "+ New". Modal opens.
   - Submit with body only (no subject). Expect: a new conversation appears in the left rail, becomes active, and the modal closes. The first message appears in the thread.
   - Type and Enter. Expect: optimistic bubble appears immediately at full opacity, then re-renders with the server-confirmed timestamp. No duplicate.
2. **Staff side** at `/staff-messages` (log in as a doctor or secretary in another browser/incognito):
   - Expect to see the patient's conversation in the left rail in real time.
   - Click it; thread loads.
   - Send a reply. Expect: appears immediately in the patient's thread (other browser) without refresh.
3. **Redaction**: invoke the SQL `update messages set redacted_at = now() where id = '<id>'` directly via Supabase Studio against a recent message. Expect both sides re-render that bubble as italic "[redacted]" within seconds.
4. **Patient isolation**: log in as a different patient. Open `/patient-messages`. Expect: empty list. Do not see the previous patient's conversations. (RLS enforced.)

### 9.4 Consent gate

1. Insert a row into `consent_documents` (audience='patient', is_active=true, is_required=true, body_md='Test consent v1').
2. Reload `/patient-dashboard` as a patient who has not accepted it. Expect: the entire patient app is gated behind the consent modal; the route renders behind the modal but is unreachable.
3. Click "I accept". Expect: the modal closes (or advances to the next required consent). A row exists in `patient_consents` for `(patient_id, consent_document_id)` with `acceptance_method = 'patient_self'`.
4. Insert another required consent. Reload. Expect: the gate appears with "Required consent · 1 of 1" header for the new doc.
5. Mark the first consent revoked: `update patient_consents set revoked_at = now() where ...`. Reload. Expect: gate appears again for the revoked consent.

### 9.5 Tenant boundary smoke

1. Confirm the patient web (`localhost:3001`) does NOT include any clinic-ops bundle: open Network panel, search loaded chunks for "DoctorEncounter", "Secretary", etc. Expected: not found.
2. Confirm clinic-ops (`localhost:3002`) does NOT include patient-web pages.
3. Try logging in as a `doctor` user from `localhost:3001/login`. Expected: redirect to `localhost:3002/login` (or clear "use the staff portal" message).
4. Try logging in as a `patient` from `localhost:3002/login`. Expected: redirect to `localhost:3001/login`.

---

## 10. Anti-goals (do not do these without explicit user approval)

1. Do not add `tenant_id` columns to any tenant DB table. The audit guard will fail.
2. Do not move `tenant_profile` / `tenant_app_config` to the control plane. Branding lives per-tenant per ADR-003.
3. Do not return service-role keys from any frontend-reachable endpoint or store them in any frontend env var.
4. Do not recreate the deleted legacy tables (`consultations`, `notifications`, `doctor_brand`, `clinic_settings`, `medical_reports`, `certificates`, `referrals`) under any name.
5. Do not remove the Proxy shim in `packages/core/lib/supabase.js`. ~20 services depend on it; replacing them all is a separate planned migration.
6. Do not start AppShell extraction across the three `App.jsx` files. Two are intentionally different (one has `<PatientConsentGate>`, the other doesn't); the third is a unified dev shell. Defer until a third concrete duplication appears.
7. Do not pull a markdown parser dependency just to render `consent_documents.body_md`. The current pre-formatted text is intentional MVP.
8. Do not delete the resolver DEV fallback. It's the only thing keeping local development fast for new contributors.
9. Do not bypass `apiCall`/`apiPaged` for "performance". The error envelope is the contract.
10. Do not commit `.env` files. Do not commit any Supabase service-role key.

---

## 11. Inheritance from prior agents

This session inherited a substantial amount of prior work — credit where due, and so the reviewer doesn't conflate it with this session's scope:

- **Pre-session:** All 57 tables, RLS, lifecycle RPCs, 5 mobile RPCs, audit triggers on 31 tables, soft-delete pattern, `apiCall`/`apiPaged` envelope, monorepo split, BrandContext, AppSidebar, ProtectedRoute, all earlier Tier 1/2 work.
- **This session:** Everything in §3 (the runtime layer + 3 product slices + 2 cleanup passes + control-plane runbook).
- **Boundary:** if the reviewer finds an issue in `packages/core/services/{patients,appointments,clinical,prechecks,intakes,insurance,...}.js`, it's likely pre-existing and out of session scope. File it but mark "PRE-SESSION" so the user knows.

---

## 12. Verification commands the reviewer will run

```bash
# Repo health
cd G:\project\doctoleb
git status
git log --oneline -20

# Static analysis
npm run lint
npm run audit:backend-contract
npm run audit:high

# Build
npm run build
npm run build:patient
npm run build:ops

# Tests
npm run test:unit
npm run test:backend-db-contract       # SKIPs without BACKEND_TEST_DATABASE_URL

# Full chain
npm run verify
```

Expected end state: every command exits 0. If any fails, that is your first finding.

For database-side checks, use the Supabase MCP:

```
mcp__supabase__list_tables(project_id='gezmfmskhmjgnquoyosq', schemas=['public'], verbose=true)
mcp__supabase__get_advisors(project_id='gezmfmskhmjgnquoyosq', type='security')
mcp__supabase__get_advisors(project_id='gezmfmskhmjgnquoyosq', type='performance')
mcp__supabase__execute_sql(project_id='gezmfmskhmjgnquoyosq', query='select pg_get_constraintdef(c.oid) from pg_constraint c ...')
```

---

## 13. Open questions / follow-up tracking

These are explicitly **not** for the review agent to answer — they are for the **user** when the time comes:

| # | Question | When it becomes urgent |
|---|---|---|
| 1 | Is the dev tenant slug `'dev'` or do you want to pre-rename it (e.g. `'demo'`)? | At control-plane seeding (§4.1) |
| 2 | What's the SaaS marketing domain — `doctoleb.com`, `doctoleb.app`, `doctoleb.health`? | Before tenant #2 onboarding |
| 3 | Custom-domain support: per-tenant Vercel project, or one Vercel project + custom domain alias? | Phase 4 (Flutter + custom domains) |
| 4 | Mobile app: one app with tenant picker, or per-tenant App Store listings? | Phase 5 |
| 5 | Notification provider preferences — Resend vs SendGrid for email; OneSignal vs raw FCM/APNs? | Slice 5 start |
| 6 | Markdown parser for consents — `react-markdown` (small) or `markdown-it` (more features)? | Consent polish slice |
| 7 | Does the encounter `complete_encounter` RPC need a follow-up `start_next_visit` flow, or do patients book the next visit themselves? | Encounter polish |

---

## 14. Handoff sign-off checklist (for the review agent to fill in)

When you complete the review, append a section to this file with:

```md
## 15. Review pass — completed YYYY-MM-DD

### Findings summary
- BLOCKING: <count>
- SUGGESTED: <count>
- NIT: <count>

### Top 5 most important findings
1. ...
2. ...
3. ...
4. ...
5. ...

### Recommended next slice
Either ✅ "Slice 5 ready to start" or ❌ "Block on findings #N before starting next slice."

### Did npm run verify stay green throughout the review?
✅ / ❌ / N/A

### Did the live tenant DB advisors show zero P1?
✅ / ❌ — paste the advisor JSON

### Reviewer notes
<freeform — anything the next agent must know>
```

---

## 15. Review pass — completed 2026-05-08

### Findings summary
- BLOCKING: 2
- SUGGESTED: 5
- NIT: 1

### Top 5 most important findings
1. `packages/ui/components/consent/PatientConsentGate.jsx` fails open when required consent documents or existing consent rows fail to load. Because errors leave `requiredDocuments` empty, the gate eventually renders `children`; consent verification should fail closed with a blocking retry/error state.
2. `packages/core/services/tenantConfig.js` re-accepts consent without clearing `revoked_at`. A previously revoked `patient_consents` row can remain revoked after upsert, so the modal may close locally but return after reload.
3. `supabase-control-plane/migrations/00010000000000_control_plane_baseline.sql` lets `tenant_status = 'maintenance'` resolve as usable tenant config, while ADR-004 and `TenantBootstrap` copy treat maintenance as `TENANT_INACTIVE`.
4. `tenant_domains.hostname` is unique case-sensitively, but `resolve_tenant` looks up hostnames with `lower(...)` and `limit 1`. Mixed-case duplicates could make tenant resolution ambiguous; use normalized storage, `citext`, or a unique index on `lower(hostname)`.
5. `packages/core/services/messaging.js` has a unique `client_request_id` database constraint, but retrying the same send returns a duplicate-key error instead of the existing message. That weakens the stated idempotent send/retry contract.

### Recommended next slice
❌ Block on findings #1-#4 before starting Slice 5. Finding #5 can be handled as messaging polish, but should be fixed before calling idempotent send/retry complete.

### Did npm run verify stay green throughout the review?
✅ Yes. `npm run verify`, `npm run build:patient`, `npm run build:ops`, and `npm run audit:backend-contract` all exited 0.

### Did the live tenant DB advisors show zero P1?
✅ Yes for tenant project `gezmfmskhmjgnquoyosq`. Supabase advisors showed no P1/high/critical issues; remaining security items were WARN-level `SECURITY DEFINER`/password-protection advisories and performance items were INFO-level index advisories.

### Reviewer notes
- `xouqxgwccewvbtkqming` is now in the repo/runbook as the live SaaS/control-plane project. It has only SaaS tables and the `tenant-resolve` Edge Function deployed.
- Direct anon/authenticated execute on `rls_auto_enable()`, `normalize_tenant_domain_hostname()`, and `touch_updated_at()` has been revoked in the control-plane project.
- The standalone clinic-ops patient-role login loop has been fixed with shared cross-app URL helpers.
- `/patient-messages` and `/staff-messages` are now present in the route boundary constants.
- Clinic-ops printable document flows no longer call `document.write()` directly; printing is centralized behind `packages/core/lib/html.js` with escaping, sanitization, and print CSP.
- Browser E2E was not completed because seeded login credentials were not included in the current handoff. Runtime/static review covered the route, tenant bootstrap, consent, messaging, document, and control-plane contracts.

---

## 16. Glossary (so terms aren't ambiguous)

- **Surface** — A user-facing app boundary: `patient-web`, `clinic-ops`, `marketing`, `control-plane`. Different code, different hostnames, sometimes different auth.
- **Tenant** — A single doctor's deployment of DoctoLeb. Each tenant has its own Supabase project (= its own DB, its own auth, its own storage).
- **Tenant DB** — The Supabase project that holds one tenant's PHI + clinical data. Currently `gezmfmskhmjgnquoyosq` is "tenant 1 (dev)".
- **Control plane** — The separate Supabase project that maps hostnames to tenant DBs and stores SaaS-level metadata. **Holds zero PHI.**
- **Resolver** — The HTTP endpoint (Edge Function) inside the control plane that the browser calls on first load to learn which tenant DB it should connect to.
- **TenantBootstrap** — The React wrapper that does the hostname → resolver → `configureSupabaseClient` dance before any other provider renders.
- **Slice** — A discrete vertical-feature increment. ADR-004 had Slices A–F (the runtime layer). Tier 2.5 had Slices 1–7 (the product features). Some have shipped, some are pending.
- **Block** — A larger work cluster. Block G = ADR-004 implementation. Block H = control-plane setup. Block I+ = future SaaS work.

---

**End of HANDOFF_REVIEW_AND_STATUS.md.** Treat this as the operating context for any follow-up engineering or review work in the next agent session.
