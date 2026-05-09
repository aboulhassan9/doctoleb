# DoctoLeb Top 20 Percent Fix Pass

Date: 2026-05-09
Basis: `FULL_FLOW_QA_CONFIDENCE_MATRIX_20260509.md`, `DESIGN_CODE_SECURITY_GAP_REVIEW_20260509.md`, and `FULL_FLOW_180_POINT_EXAMINATION_20260509.md`.

## Scope Selected

This pass addressed the highest-impact confirmed failures from the review docs, not the entire backlog:

| Priority | Review item | Why it was selected |
| --- | --- | --- |
| 1 | T-050 / EXAM-001: deployed ops Patient Portal link resolved to `/r/login` | Confirmed deployed user-facing navigation defect. Patients could land on a broken page from staff login. |
| 2 | T-169 / EXAM-002 / GAP-005: tenant records exposed browser DELETE policies | Confirmed live DB security/reversibility gap for clinical, financial, messaging, consent, scheduling, runtime, catalog, and lookup records. |
| 3 | EXAM-004 / GAP-007: live DB contract checks could skip silently | CI could pass without proving pgTAP/RPC behavior when DB envs were absent. |
| 4 | T-062 / GAP-001: unsupported staff roles were creatable | Doctor UI/schema/DB allowed roles with no v1 dashboard, route model, or tested workflow. |
| 5 | Missing regression automation around these issues | Without tests, failures could reappear silently after deployment or migration drift. |

## Changes Made

| Area | Change | Files / systems |
| --- | --- | --- |
| Browser smoke | Added link-level assertions for unsafe control characters and expected routes on patient and clinic-ops public pages. | `scripts/browser-smoke.mjs` |
| Vercel env | Cleaned clinic-ops `VITE_PATIENT_WEB_URL` for production and preview. | Vercel project `doctoleb-clinic-ops` |
| Vercel deploy | Redeployed clinic-ops production after env cleanup and source normalization. | `https://doctoleb-clinic-ops.vercel.app` |
| Tenant DB migration | Revoked browser hard-delete policies from protected clinical, financial, messaging, consent, scheduling, runtime, catalog, and lookup records. | `supabase/migrations/20260509010000_revoke_browser_hard_delete_policies.sql` |
| Live tenant DB | Applied the migration to tenant project `gezmfmskhmjgnquoyosq`. | Supabase MCP |
| CI DB contract guard | Added required mode so CI fails when live DB contract checks are skipped, and wired the required envs into GitHub Actions. | `scripts/backend-db-contract-tests.mjs`, `.github/workflows/ci.yml` |
| Staff role scope | Constrained v1 staff roles to `secretary` and `predoctor` in shared constants, schema validation, UI options, and live DB constraints. | `packages/core/lib/roles.js`, `packages/core/schemas/index.js`, `apps/clinic-ops/src/pages/DoctorStaffPage.jsx`, `supabase/migrations/20260509011000_staff_roles_v1_scope.sql` |
| Staff invite lifecycle | Moved staff invite creation and disable/cancel access lifecycle behind authenticated Edge Functions and service-role RPCs. Browser code can no longer insert staff identities or mutate lifecycle/auth-link fields directly. | `supabase/functions/staff-invite`, `supabase/functions/staff-member-disable`, `packages/core/services/staff.js`, `supabase/migrations/20260509012000_staff_invite_lifecycle.sql`, `20260509013000_staff_member_disable_lifecycle.sql`, `20260509014000_staff_invite_auth_trigger_role_fix.sql`, `20260509015000_staff_lifecycle_trigger_execute_revoke.sql` |
| Control-plane admin CORS | Removed wildcard CORS default, added explicit Vercel/local console origins, rejected unknown browser origins before RBAC, set the live allowlist secret, and redeployed all admin Edge Functions. | `supabase-control-plane/functions/_shared/admin.ts`, `scripts/control-plane-admin-cors-smoke.mjs`, `.github/workflows/ci.yml` |
| Control-plane zero-PHI audit | Added a backend-contract audit guard so future control-plane migrations/functions cannot introduce tenant clinical tables, PHI-owned columns, or direct clinical table access. | `scripts/backend-contract-audit.mjs`, `tests/unit/saasFoundationContracts.test.mjs` |
| Error message normalization | Added a shared helper and applied it to visible appointment/slot/patient-create flows that could previously treat string errors as objects. | `packages/core/lib/errors.js`, `tests/unit/errorMessage.test.mjs`, selected clinic-ops pages |
| CSP rollout start | Added report-only CSP to the Vercel app shell. This is intentionally report-only until browser/auth/print flows are observed after deploy. | `vercel.json`, `tests/unit/saasFoundationContracts.test.mjs` |
| Tenant resolver post-deploy smoke | Added a reusable live HTTP contract script and GitHub Actions job for patient/ops Vercel hosts, uppercase host, unknown host, wrong surface, pending not-purchased domains, and secret-marker response checks. | `scripts/tenant-resolver-smoke.mjs`, `.github/workflows/ci.yml`, `package.json` |
| Bundle secret audit | Replaced the patient/ops-only YAML grep with a reusable all-app audit. Patient/ops block tenant fallback material; all apps block service/provider/payment secret markers. | `scripts/bundle-secret-audit.mjs`, `.github/workflows/ci.yml`, `package.json` |
| Contract tests | Added unit contracts for policy revocation, required DB-contract CI behavior, and supported staff-role scope. | `tests/unit/saasFoundationContracts.test.mjs` |
| Review docs | Updated the confidence matrix, gap review, and 180-point examination with fixed status and fresh evidence. | Root markdown review docs |

## Verification

| Check | Result |
| --- | --- |
| `node --test tests/unit/saasFoundationContracts.test.mjs` | PASS, 36 tests |
| `node --test tests/unit/errorMessage.test.mjs` | PASS, 3 tests |
| `npm run smoke:control-plane-admin-cors` | PASS, allowed console origin receives exact `Access-Control-Allow-Origin`; unknown origin returns `ORIGIN_NOT_ALLOWED` |
| `npm run smoke:tenant-resolver` | PASS, Vercel patient/ops hosts resolve, uppercase host resolves, unknown host/wrong surface/pending domains return the expected errors, and no forbidden secret markers are returned |
| `npm run audit:bundle-secrets` against patient/ops/control-plane build outputs | PASS, all three current bundles scanned with app-specific rules |
| `npm run smoke:browser:deployed` before deploy | FAIL, proved clinic-ops Patient Portal link contained unsafe control characters |
| `npm run smoke:browser:deployed` after deploy | PASS, all three apps desktop/mobile; report written to `output/playwright/deployed-ui-qa-report.json` |
| Supabase MCP DELETE policy count | PASS, `total_delete_policy_count=0` and empty DELETE policy list |
| Supabase MCP staff role constraints | PASS, `staff_members_role_check` allows only `secretary`/`predoctor`; unsupported `nurse` insert probe rejected |
| Supabase MCP staff lifecycle probes | PASS, rollback-wrapped create -> disable is idempotent, stores previous invite status, writes audit event, creates no accidental patient row, and accepted-user disable preserves the Auth link |
| Supabase MCP browser mutation probes | PASS, direct authenticated `staff_members` insert fails with `STAFF_INVITE_REQUIRED`; direct lifecycle update fails with `STAFF_LIFECYCLE_REQUIRES_SERVER` |
| Supabase Edge Function checks | PASS, `staff-invite` and `staff-member-disable` are active with `verify_jwt=true`; unauthenticated `staff-member-disable` returns gateway `401 UNAUTHORIZED_NO_AUTH_HEADER` |
| `BACKEND_DB_CONTRACT_REQUIRED=true npm run test:backend-db-contract` without DB secrets | PASS as negative proof, command fails with `REQUIRED BUT SKIPPED` |
| `npm run build:ops` | PASS after staff-role scope changes |
| `npm run audit:backend-contract` | PASS, tracked warnings only |
| `npm run verify` | PASS, lint, unified build, 167 unit tests, backend audit, local DB contract harness, and high-severity npm audit |

## Remaining From The High-Risk Slice

| Item | Status | Next action |
| --- | --- | --- |
| Live DB contract secrets in GitHub | Wiring complete, secrets still required; `gh secret list --repo aboulhassan9/doctoleb` currently shows auth smoke and Vercel secrets, but no `BACKEND_TEST_*` secrets. | Configure `BACKEND_TEST_DATABASE_URL`, `BACKEND_TEST_SUPABASE_URL`, and `BACKEND_TEST_SUPABASE_ANON_KEY` against a safe branch/test project. CI will intentionally fail until these exist. |
| Auth smoke secrets in local shell | Still open | Load `AUTH_SMOKE_*` locally or rely on GitHub Actions with `AUTH_SMOKE_REQUIRED=true`. |
| Staff invite/auth lifecycle | Partially closed | Invite creation and disable/cancel are now server-owned and live-proven. Still add resend invite, accepted invite email-link browser login proof, and a future reactivation/undo function before production staff onboarding. |
| Supabase auth/advisor hardening | Partially closed | `docs/security/SECURITY_DEFINER_ALLOWLIST_20260509.md` now records current SECURITY DEFINER warnings and decisions. Leaked password protection still requires project-owner dashboard/API action, and helper-function execute revokes still need a follow-up migration after caller audit. |
| CSP enforcement | Partially closed | Report-only CSP is now configured. Enforcement is intentionally deferred until deployed violation reports/auth/print flows are reviewed. |
| Error-shape cleanup | Partially closed | Shared helper exists and first visible flows are fixed. Remaining hooks/pages should be converted in small tested slices. |

## Top 40/60/80 Follow-On Completed In This Pass

The next bands were not treated as cosmetic backlog. I completed the code-owned security and quality items that could be safely finished now:

| Band | Completed item | Evidence |
| --- | --- | --- |
| Next 20% | Control-plane admin CORS wildcard removed and deployed. | Source test, live Supabase Edge redeploy, `npm run smoke:control-plane-admin-cors`. |
| Next 20% | Control-plane zero-PHI drift guard added to backend audit. | `npm run audit:backend-contract`, `npm run verify`. |
| Next 20% | Visible error-shape misuse corrected with shared helper. | `tests/unit/errorMessage.test.mjs`, `npm run build:ops`. |
| Next 20% | CSP rollout started as report-only. | `vercel.json` contract test plus all app builds. |
| Next 20% | Tenant resolver HTTP contract added as a post-deploy CI smoke. | `scripts/tenant-resolver-smoke.mjs`, live `npm run smoke:tenant-resolver`. |
| Next 20% | Production bundle secret scan now covers all three Vercel apps. | `scripts/bundle-secret-audit.mjs`, local scans for patient, ops, and control-plane bundles. |

Anything still open in the top 80% is either intentionally partial because it needs a safe live test account/secret, or it is a larger phase that should not be rushed into a fake implementation.
