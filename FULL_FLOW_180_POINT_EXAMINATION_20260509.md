# DoctoLeb 180-Point Detailed Examination

Date: 2026-05-09
Basis: `FULL_FLOW_180_POINT_TEST_EXPANSION_20260509.md`
Posture: production-bound review. No prototype assumptions. Scores below are evidence confidence, not a guarantee that defects cannot exist.

## Review Method

This pass examines every granular test point from T-001 to T-180 and scores it against current proof:

| Score | Meaning |
| --- | --- |
| 95-100 | Proven by current automated verification, live browser/API/DB evidence, and source review. |
| 85-94 | Strong evidence exists, but one edge, dashboard setting, mutation branch, or live run is still missing. |
| 70-84 | Code and contracts look good, but detailed live browser mutation or live DB proof is partial. |
| 50-69 | Feature path exists, but real end-to-end action proof is weak or missing. |
| 0-49 | Confirmed gap, not implemented, not safely testable, or directly failing in this pass. |

Status codes:

| Status | Meaning |
| --- | --- |
| PASS | Current evidence is strong enough for this phase. |
| PARTIAL | Some evidence exists, but not enough for production confidence. |
| FAIL | Current evidence shows a real defect or policy violation. |
| BLOCKED | Cannot be proven until secrets, dashboard settings, domain purchase, or automation exists. |
| NOT BUILT | The planned feature or automation is documented but not implemented yet. |

## Evidence Refreshed In This Pass

| Check | Result | Notes |
| --- | --- | --- |
| `npm run verify` | PASS | Lint, unified build, 167 unit tests, backend-contract audit, DB contract script, and high-severity npm audit passed. |
| `npm run build:patient` | PASS | Standalone patient app build passed. |
| `npm run build:ops` | PASS | Standalone ops app build passed. |
| `npm run build:control-plane` | PASS | Standalone SaaS console build passed. |
| `npm run smoke:browser:deployed` | PASS | Patient, ops, and control-plane deployed aliases pass desktop/mobile smoke with no console/page/network failures. |
| `npm run smoke:auth:deployed` | SKIPPED LOCALLY | Current shell lacks `AUTH_SMOKE_*` secrets and `AUTH_SMOKE_REQUIRED` is not true. Previous report exists, but this pass could not refresh it. |
| Focused CTA browser probe | PASS AFTER FIX | Browser smoke now validates patient CTA links and clinic-ops Patient Portal links. Clinic-ops was redeployed after correcting `VITE_PATIENT_WEB_URL`; deployed smoke passes. |
| `npm run smoke:tenant-resolver` | PASS | Vercel patient/ops hosts resolve. Uppercase host resolves. Unknown host returns 404. Wrong surface returns 403. Pending real domains return 423. Response bodies are scanned for forbidden secret markers. |
| `npm run audit:bundle-secrets` against current app build outputs | PASS | Patient, ops, and control-plane bundles scanned with app-specific rules. Patient/ops block tenant fallback material; all apps block service/provider/payment secret markers. |
| Provider-aware provisioning rollback smoke | PASS | Live transaction verified assisted tenant draft creation with active Supabase/Vercel provider connection metadata and 10 seeded provisioning steps, then rolled back. |
| Local control-plane browser smoke | PASS | Local console login shell loaded without runtime errors; authenticated provisioning UI actions remain blocked by unavailable local credentials. |
| Supabase MCP control-plane tables | PASS | 10 expected zero-PHI SaaS/control-plane tables, all RLS-enabled. |
| Supabase MCP control-plane Edge Functions | PASS | `tenant-resolve` is public by design; admin functions have `verify_jwt=true`. |
| Control-plane admin CORS smoke | PASS | Live preflight accepts `https://doctoleb-control-plane.vercel.app` exactly and rejects `https://evil.example` with `ORIGIN_NOT_ALLOWED`. |
| Supabase MCP tenant tables | PASS | Tenant tables have RLS enabled. Browser DELETE policies were revoked from the public tenant schema; live `pg_policies` DELETE count is now 0. |
| Supabase MCP staff lifecycle probes | PASS | Rollback-wrapped staff invite -> disable is idempotent, stores previous invite status, writes audit, creates no accidental patient row, and blocks direct browser insert/lifecycle mutation. |
| Supabase security advisor review | PARTIAL | New staff trigger helpers no longer appear as externally executable. Remaining SECURITY DEFINER warnings are documented in `docs/security/SECURITY_DEFINER_ALLOWLIST_20260509.md`; leaked password protection still needs project-owner action. |
| Control-plane zero-PHI audit | PASS | Backend-contract audit now blocks tenant clinical table names, PHI-owned columns, and control-plane functions touching tenant clinical tables. |
| CI workflow source review | PARTIAL | GitHub Actions quality-gates deploys to three Vercel projects. `vercel.json` has `git.deploymentEnabled=false`, so this is GitHub Actions driven, not Vercel direct Git auto-deploy. |

## Critical Findings From The Detailed Pass

| ID | Severity | Related tests | Finding | Required action |
| --- | --- | --- | --- | --- |
| EXAM-001 | Fixed | T-050 | Deployed clinic-ops login had Patient Portal links with `https://doctoleb-patient-web.vercel.app\\r/login`, resolving to `/r/login`. | Fixed by correcting Vercel `VITE_PATIENT_WEB_URL`, redeploying clinic-ops, and adding deployed browser-smoke link assertions. |
| EXAM-002 | Fixed | T-071, T-077, T-086, T-097, T-169 | Live tenant DB had browser DELETE policies on protected and catalog records. | Fixed by migration `20260509010000_revoke_browser_hard_delete_policies.sql`, applied live and expanded to catalog/lookup records. Total public DELETE policy count is now 0. |
| EXAM-003 | High | T-052, T-053, T-054, T-126, T-180 | Current local auth smoke could not run because secrets are not loaded. Previous auth report exists, but this pass cannot treat auth as freshly proven. | Load local smoke secrets or rely on GitHub Actions `AUTH_SMOKE_REQUIRED=true` run, then attach current report. |
| EXAM-004 | Partially fixed | T-159, T-160, T-168, T-169 | Local `test:backend-db-contract` still skips without DB env vars, but GitHub Actions now sets `BACKEND_DB_CONTRACT_REQUIRED=true`, so required CI runs fail instead of accepting skipped live DB checks. | Configure safe backend DB test secrets in GitHub so the required CI job runs pgTAP and anon-RPC checks instead of failing for missing secrets. |
| EXAM-005 | Partially fixed | T-062, T-111 | Unsupported staff roles are constrained to secretary/predoctor, and invite creation plus disable/cancel now run through authenticated Edge Functions and service-role RPCs. Resend invite, accepted invite browser login proof, and reactivation/undo are still open. | Add resend invite, accepted invitation E2E login, and reactivation/undo lifecycle before production staff onboarding. |
| EXAM-006 | Partially fixed | T-144, T-146, T-147 | Provider-connected provisioning now has provider-aware draft creation, console provider metadata UI, and an undoable 10-step ledger. Actual Supabase/Vercel API execution runner is not built yet. | Implement server-side provider authorization, secret storage verification, idempotent step runner, and compensation logic. |
| EXAM-007 | Medium | T-174, T-176, T-177 | CSP, rate limiting, and backup/restore drills are not production-proven. Baseline headers exist, but healthcare launch needs stronger ops proof. | Add CSP rollout, resolver/admin throttling, and restore drill runbook with evidence. |
| EXAM-008 | Medium | T-173 | Current deployment is quality-gated GitHub Actions deployment, not Vercel direct Git integration. This may be acceptable, but it differs from the user's earlier stated expectation. | Decide and document: keep GitHub Actions as deployment authority, or enable Vercel Git integration only after preserving quality gates. |
| EXAM-009 | Fixed/partial | T-161, T-163, T-174 | Control-plane CORS and zero-PHI drift are now code-guarded and live-smoked; CSP rollout has started as report-only. CSP is not enforced yet. | Review report-only behavior after deploy, then enforce once auth/print/font flows are proven. |
| EXAM-010 | Fixed | T-139, T-149, T-150, T-151, T-152, T-153, T-154, T-162, T-164, T-172 | Resolver HTTP behavior and bundle secret posture were proven manually/source-only in parts, not fully CI-owned for all three apps. | Added tenant resolver smoke and all-app bundle secret audit to scripts, package commands, contract tests, and GitHub Actions. |
| EXAM-011 | Partially fixed | T-144, T-145, T-146, T-147 | Tenant creation needed to become easier through the SaaS console without hardcoding DoctoLeb-only infrastructure. | Added provider connection UI, provider-aware draft creation, provider selection validation, and provisioning step visibility. |

## Confidence Summary

| Band | Count | Meaning |
| --- | ---: | --- |
| 95-100 | 7 | Strong live proof. Mostly resolver HTTP behavior. |
| 85-94 | 39 | Strong source/unit/browser evidence, but not every mutation edge. |
| 70-84 | 74 | Good implementation evidence, incomplete detailed E2E proof. |
| 50-69 | 56 | Built or partly built, but missing live mutation/security proof. |
| 0-49 | 4 | Confirmed failing, blocked, or not production-ready. |

## Granular Examination Matrix

| ID | Status | Score | Examination result | Next proof or fix |
| --- | --- | ---: | --- | --- |
| T-001 | PASS | 92 | Deployed patient landing copy is clinic/patient focused and smoke excludes SaaS buyer copy. | Keep visual/content review in browser smoke. |
| T-002 | PASS | 91 | Desktop landing hero is proven by deployed smoke, heading assertion, and screenshot artifact. | Add visual diff threshold later. |
| T-003 | PASS | 90 | Mobile landing page loads and screenshots cleanly in deployed browser smoke. | Add mobile CTA click checks. |
| T-004 | PASS | 88 | Focused browser probe confirms Patient Registration CTA routes to `/signup`. | Add to committed Playwright suite. |
| T-005 | PASS | 88 | Focused browser probe confirms Patient Login CTA routes to `/login`. | Add to committed Playwright suite. |
| T-006 | PASS | 90 | Deployed browser smoke now proves the ops Patient Portal link is clean and routes to patient `/login`. | Keep CTA probe in CI browser smoke. |
| T-007 | PASS | 90 | Patient deployed smoke excludes ops/control-plane/wrong-portal text. | Add direct staff-route access test on patient host. |
| T-008 | PARTIAL | 88 | Resolver wrong-surface behavior is proven by HTTP; visual wrong-portal copy not retested here. | Add browser assertion for wrong portal page. |
| T-009 | PARTIAL | 72 | Signup form/schema exists, but no live empty-submit browser mutation proof. | Add Playwright validation test. |
| T-010 | PARTIAL | 76 | Auth schema validates email; no live account-disclosure proof in this pass. | Add invalid email and existing email tests. |
| T-011 | PARTIAL | 78 | Password schema exists; no browser proof of weak/mismatch UX in this pass. | Add Playwright validation test. |
| T-012 | PARTIAL | 60 | Signup code path exists, but no disposable live signup plus cleanup proof. | Build safe E2E signup test with rollback. |
| T-013 | PARTIAL | 76 | Auth service uses generic invalid credential message; no live invalid login probe here. | Add negative login smoke. |
| T-014 | PARTIAL | 84 | Previous auth smoke reached patient dashboard; current shell skipped auth smoke. | Refresh with `AUTH_SMOKE_*` loaded. |
| T-015 | PARTIAL | 68 | AuthRedirect exists; no browser proof for logged-in login redirect. | Add post-login redirect test. |
| T-016 | PARTIAL | 70 | Forgot-password service path exists; no live non-disclosure proof. | Add safe reset request test. |
| T-017 | PARTIAL | 70 | Reset page/schema exists; no token lifecycle test in this pass. | Add reset-token test with safe test user. |
| T-018 | PARTIAL | 70 | Logout code exists; no back-button/cache proof in this pass. | Add logout and back-button browser test. |
| T-019 | PARTIAL | 85 | Unit contract says consent gate fails closed; no browser load-state test here. | Add mocked consent-load browser test. |
| T-020 | PASS | 90 | Unit contract proves fail-closed consent load error and retry state. | Add live UI assertion. |
| T-021 | PARTIAL | 80 | Retry state is covered by contract; button behavior not browser-tested. | Add Playwright retry-click test. |
| T-022 | PASS | 86 | Unit contract verifies reaccept clears `revoked_at`; live DB mutation not performed. | Add DB integration proof. |
| T-023 | PARTIAL | 65 | Revocation logic expected, but no live revoked-consent scenario tested. | Add consent revoke/reaccept E2E. |
| T-024 | PARTIAL | 84 | Auth smoke artifact shows patient dashboard previously; current auth smoke skipped. | Refresh auth smoke and assert cards. |
| T-025 | PARTIAL | 78 | Empty-state likely present; not specifically proven. | Add seeded empty appointment scenario. |
| T-026 | PARTIAL | 76 | Profile service/page exists; no live profile-load action proof. | Add patient profile browser route smoke. |
| T-027 | PARTIAL | 72 | Profile validation exists in schema/UI patterns; not proven browser-side. | Add field validation tests. |
| T-028 | PARTIAL | 62 | Profile save path exists; no live DB update proof. | Add test patient profile save and rollback. |
| T-029 | PARTIAL | 64 | Failure handling pattern exists; no mocked failed-save UI proof. | Add service-failure test. |
| T-030 | PARTIAL | 78 | Appointment page builds; tab states not specifically asserted. | Add tab visual/DOM checks. |
| T-031 | PASS | 84 | Slot service and backend contracts exist; no live booking page proof here. | Add slot-load API/browser test. |
| T-032 | PARTIAL | 75 | Booking validation likely exists; reason requirement not deeply tested. | Add booking validation test. |
| T-033 | PARTIAL | 62 | Booking RPC path exists; no live appointment creation proof. | Add reversible booking E2E. |
| T-034 | PARTIAL | 80 | DB/RPC hardening exists; no concurrent live race test. | Add two-client race test. |
| T-035 | PARTIAL | 64 | Confirmation UX not specifically proven. | Add booking success DOM assertions. |
| T-036 | PARTIAL | 66 | Cancel UI exists; no confirmation-click proof. | Add cancel modal test. |
| T-037 | PARTIAL | 74 | State-transition posture exists; no live cancel result proof. | Add cancel DB assertion. |
| T-038 | PARTIAL | 70 | RLS enabled and services scoped; no cross-user history attack test. | Add anon/auth RLS matrix. |
| T-039 | PARTIAL | 76 | History page builds; empty state not specifically proven. | Add empty history fixture. |
| T-040 | PARTIAL | 68 | Storage/private-bucket migration exists; no live document list proof. | Add document RLS and signed URL test. |
| T-041 | PARTIAL | 64 | Signed URL design exists; expiration and scope not exercised. | Add short-lived signed URL test. |
| T-042 | PARTIAL | 62 | Error UX not directly tested. | Add expired-document browser test. |
| T-043 | PARTIAL | 68 | Messaging tables/services exist; no patient thread browser proof. | Add patient messages browser test. |
| T-044 | PARTIAL | 76 | Message validation likely covered by schema/service; no browser proof. | Add message validation unit/browser test. |
| T-045 | PARTIAL | 58 | Message create path exists; no live send proof. | Add reversible message send test. |
| T-046 | PASS | 88 | Unit contract proves retry with same `client_request_id` collapses. | Add live DB integration proof. |
| T-047 | PARTIAL | 82 | Safe logger tests exist; no live Edge log audit for message body. | Add no-PHI log audit. |
| T-048 | PARTIAL | 50 | Accessibility is not broadly tested. | Add keyboard/focus Playwright suite. |
| T-049 | PASS | 88 | Deployed ops smoke verifies staff-focused login copy. | Keep in smoke. |
| T-050 | PASS | 92 | Deployed browser smoke now asserts Patient Portal links contain no control characters and resolve to patient `/login`. | Keep link assertion in CI browser smoke. |
| T-051 | PARTIAL | 70 | Generic invalid login code exists; no live negative login probe. | Add invalid ops login test. |
| T-052 | PARTIAL | 82 | Previous auth report proves doctor dashboard login; current shell skipped. | Refresh auth smoke. |
| T-053 | PARTIAL | 82 | Previous auth report proves secretary dashboard login; current shell skipped. | Refresh auth smoke. |
| T-054 | PARTIAL | 82 | Previous auth report proves predoctor dashboard login; current shell skipped. | Refresh auth smoke. |
| T-055 | PARTIAL | 66 | Patient-role redirect code exists; no live cross-surface login test. | Add patient-on-ops browser test. |
| T-056 | PARTIAL | 72 | ProtectedRoute and role tests exist; no wrong-role direct URL browser matrix. | Add role-boundary E2E. |
| T-057 | PARTIAL | 66 | Logout buttons exist; no staff back-button proof. | Add logout/back-button test. |
| T-058 | PARTIAL | 62 | Auth fail-closed contracts exist; expired-session browser path not proven. | Add expired-session test. |
| T-059 | PARTIAL | 72 | Navigation builds; active route state not asserted. | Add route visual state checks. |
| T-060 | PARTIAL | 76 | Mobile ops smoke passes login page only, not inside dashboard navigation. | Add mobile authenticated nav smoke. |
| T-061 | PASS | 88 | Deployed smoke captures no console/page/network failures on login pages. | Extend to authenticated pages. |
| T-062 | PASS | 88 | Staff creation is constrained to supported v1 app roles: secretary and predoctor. UI, schema, migration, and live DB constraints now agree; unsupported role insert was rejected by Postgres. | Reopen only when adding nurse/assistant/junior doctor dashboards, routes, RLS, and tests. |
| T-063 | PARTIAL | 78 | Secretary dashboard reached in previous auth report, not deeply asserted now. | Refresh auth and assert widgets. |
| T-064 | PARTIAL | 68 | Services/build exist; pagination not proven live. | Add patient list pagination contract. |
| T-065 | PARTIAL | 80 | Backend audit and service patterns reduce SQL risk; no targeted search fuzzing. | Add search sanitization test. |
| T-066 | PARTIAL | 66 | Create-patient UI exists; validation not browser-proven. | Add empty/invalid create-patient test. |
| T-067 | PARTIAL | 58 | Patient create path exists; no live DB creation proof. | Add reversible create-patient E2E. |
| T-068 | PARTIAL | 55 | Walk-in creation code exists; collision behavior not proven. | Add walk-in duplicate test. |
| T-069 | PARTIAL | 50 | Transaction/rollback not proven for patient creation. | Move into RPC or add failure integration test. |
| T-070 | PARTIAL | 58 | Edit profile path exists; allowed-field enforcement not proven. | Add RLS/API field restriction test. |
| T-071 | PASS | 90 | Product path prefers archive and live tenant DB has zero public DELETE policies after the hard-delete revocation migration. | Add targeted mutation tests for archive/disable flows. |
| T-072 | PARTIAL | 70 | Calendar builds; timezone states not asserted. | Add timezone browser/API test. |
| T-073 | PARTIAL | 62 | Appointment patient selection exists; duplicate logic not proven. | Add appointment register/select test. |
| T-074 | PARTIAL | 65 | Slot chooser exists; disabled reason not asserted. | Add slot UI state test. |
| T-075 | PARTIAL | 60 | Secretary booking path exists; no live DB mutation proof. | Add reversible booking E2E. |
| T-076 | PARTIAL | 78 | DB/RPC design protects booking; no live concurrent proof. | Add concurrent booking integration test. |
| T-077 | PARTIAL | 80 | Cancellation path exists and the DELETE policy gap is closed, but the cancel flow still needs live DB assertion. | Add cancel appointment test with postcondition and cleanup. |
| T-078 | PARTIAL | 65 | Billing list builds; pagination/leakage not proven. | Add billing list RLS and pagination test. |
| T-079 | PARTIAL | 70 | Billing schema/service validation exists; no browser proof. | Add create bill validation test. |
| T-080 | PASS | 88 | Unit tests prove insurance billing entitlement gate. | Add live disabled/allowed payment API test. |
| T-081 | PARTIAL | 62 | Payment status path exists; transition/audit not deeply tested. | Add payment status state-machine test. |
| T-082 | PARTIAL | 68 | Clinics UI/service exists; all states not asserted. | Add clinic states browser test. |
| T-083 | PARTIAL | 70 | Clinic archive migration exists; create uniqueness not live-tested. | Add create/archive/restore-ready test. |
| T-084 | PARTIAL | 78 | Slot service validation and build exist; no live create proof. | Add slot create DB test. |
| T-085 | PARTIAL | 78 | Recurring slot/template logic exists; no live idempotency proof. | Add recurring materialization test. |
| T-086 | PASS | 90 | Unit contract proves schedule availability removal is reversible deactivation. | Add live DB assertion. |
| T-087 | PARTIAL | 82 | Previous doctor auth smoke reached dashboard; current shell skipped. | Refresh auth and assert dashboard cards. |
| T-088 | PARTIAL | 72 | Appointment list code/services exist; doctor scope not live-tested. | Add doctor appointment RLS test. |
| T-089 | PARTIAL | 66 | RLS enabled, but cross-provider appointment attack not proven. | Add cross-doctor denied test. |
| T-090 | PARTIAL | 62 | Encounter route exists; start preconditions not proven. | Add start encounter E2E. |
| T-091 | PARTIAL | 65 | Encounter validation likely exists; no field-level proof. | Add validation test. |
| T-092 | PARTIAL | 78 | Encounter page builds; individual tabs not route-tested. | Add tab smoke suite. |
| T-093 | PARTIAL | 70 | Service contracts exist; tab-level RLS not proven. | Add tab service/RLS tests. |
| T-094 | PASS | 90 | Unit contract proves clinical note drafts do not use localStorage. | Replace sessionStorage with DB draft long-term. |
| T-095 | PARTIAL | 72 | sessionStorage mitigation exists; cleanup on logout/discard not fully proven. | Add logout/discard draft test. |
| T-096 | PARTIAL | 58 | Save note path exists; no live note create/version proof. | Add clinical note DB integration test. |
| T-097 | PARTIAL | 78 | Cancel encounter path is RPC-backed and browser DELETE policies are gone, but live cancel proof is still missing. | Add reversible encounter cancel integration test. |
| T-098 | PARTIAL | 64 | Completion RPC contracts exist; no live completion proof. | Add complete encounter integration test. |
| T-099 | PARTIAL | 60 | Diagnosis UI/service exists; audit behavior not proven. | Add diagnosis create/edit test. |
| T-100 | PARTIAL | 58 | Prescription component exists; no live validation/RLS proof. | Add prescription service tests. |
| T-101 | PARTIAL | 58 | Lab order component exists; no live validation/RLS proof. | Add lab order tests. |
| T-102 | PARTIAL | 58 | Imaging order component exists; no live validation/RLS proof. | Add imaging order tests. |
| T-103 | PARTIAL | 58 | Care task code exists; transition rules not proven. | Add care task state tests. |
| T-104 | PARTIAL | 60 | Reports page exists; finalization restrictions not proven. | Add report draft/final test. |
| T-105 | PARTIAL | 78 | Print safety helper has unit tests; certificate page not browser-tested. | Add certificate print browser test. |
| T-106 | PARTIAL | 58 | Referral page exists; no validation/RLS proof. | Add referral tests. |
| T-107 | PARTIAL | 68 | RLS enabled; no cross-tenant chart attack proof. | Add live RLS matrix. |
| T-108 | PARTIAL | 72 | Chart context UI exists; no wrong-patient UX review. | Add UX checklist/browser assertion. |
| T-109 | PARTIAL | 84 | Schedule template logic builds and reversible tests exist; live create not proven. | Add template create integration test. |
| T-110 | PARTIAL | 82 | Materialization logic exists; no live duplicate-proof run. | Add idempotent materialization test. |
| T-111 | PARTIAL | 82 | Staff invite creation and disable/cancel are now server-owned: `staff-invite` and `staff-member-disable` are deployed with JWT verification, direct browser insert/update is blocked, Auth trigger is role-aware, and rollback DB probes prove invite -> disable, accepted disable, audit, idempotency, and no accidental patient row. | Add resend invite, accepted email-link browser login proof, and future reactivation/undo before production onboarding. |
| T-112 | PARTIAL | 70 | Branding/settings path exists; no full tenant sync render proof. | Add branding update-to-render integration test. |
| T-113 | PARTIAL | 82 | Previous predoctor auth smoke reached dashboard; current shell skipped. | Refresh auth and assert widgets. |
| T-114 | PARTIAL | 70 | Predoctor appointment code exists; scoped permissions not live-tested. | Add predoctor appointments RLS test. |
| T-115 | PARTIAL | 64 | RLS enabled; field minimization not proven. | Add predoctor field-access test. |
| T-116 | PARTIAL | 64 | Patient search page exists; paging/no-results not proven. | Add search browser/API test. |
| T-117 | PARTIAL | 66 | Vitals UI exists; required validation not proven. | Add validation test. |
| T-118 | PARTIAL | 64 | Range validation not proven. | Add abnormal/out-of-range test. |
| T-119 | PARTIAL | 58 | Draft save path not proven live. | Add precheck draft DB test. |
| T-120 | PARTIAL | 58 | Submit precheck path not proven live. | Add submit transition test. |
| T-121 | PARTIAL | 60 | Urgent flag behavior not proven. | Add abnormal flag workflow test. |
| T-122 | PARTIAL | 72 | Schedule page builds; timezone/status consistency not asserted. | Add visual/API checks. |
| T-123 | PARTIAL | 68 | ProtectedRoute exists; direct-route denial matrix missing. | Add route-boundary E2E. |
| T-124 | PARTIAL | 78 | Previous predoctor auth smoke had no runtime errors; current shell skipped. | Refresh auth smoke. |
| T-125 | PARTIAL | 78 | Missing env screen exists; deployed app has env, so fail-closed setup not browser-tested. | Add local env-missing browser test. |
| T-126 | PARTIAL | 84 | Previous control owner auth smoke passed; current shell skipped. | Refresh auth smoke. |
| T-127 | PARTIAL | 70 | RBAC function exists; non-admin browser/API negative not run here. | Add non-admin smoke. |
| T-128 | PARTIAL | 68 | Inactive admin logic exists; not live-tested. | Add inactive admin test. |
| T-129 | PARTIAL | 82 | Console source/API exists and owner auth previously reached console; list states not deeply tested. | Add tenant-list UI state tests. |
| T-130 | PARTIAL | 80 | Tenant detail components/API exist; not all panels asserted. | Add tenant-detail browser suite. |
| T-131 | PARTIAL | 82 | Status component extracted and statuses known; no unit snapshot. | Add status mapping test. |
| T-132 | PARTIAL | 84 | Atomic admin update RPC and Edge Function exist; no live status mutation run. | Add rollback-wrapped status test. |
| T-133 | PARTIAL | 84 | Activation/domain constraints exist; invalid transition not live-tested. | Add negative admin API test. |
| T-134 | PARTIAL | 82 | Domain drafts and live rows show pending real domains. | Add console edit flow test. |
| T-135 | PASS | 92 | Live resolver returns 423 for pending `dev.doctoleb.com`. | Keep public resolver contract in CI. |
| T-136 | PASS | 94 | Live resolver returns active tenant for localhost smoke domains. | Keep local domain rows documented. |
| T-137 | PASS | 92 | Unit contracts and DB constraints prove case-insensitive/normalized domain behavior. | Add duplicate insert DB negative test. |
| T-138 | PASS | 85 | Runtime config helpers validate inputs; live mutation not run. | Add admin API negative tests. |
| T-139 | PASS | 90 | Backend audit passes no service-role references in frontend packages/apps, and production bundle secret audit is now wired for all three Vercel apps. | Confirm next GitHub Actions deploy run artifact scan is green. |
| T-140 | PASS | 85 | Unit contract blocks draft tenants from sync before runtime config. | Add API negative test. |
| T-141 | PARTIAL | 68 | Branding sync function exists; no full tenant DB write-to-render proof. | Add branding sync integration test. |
| T-142 | PARTIAL | 74 | Entitlement panel exists; UI toggle/cancel not browser-tested. | Add console entitlement UI test. |
| T-143 | PARTIAL | 75 | Entitlement core and Edge Function exist; live projection not proven. | Add plan/feature flag sync test. |
| T-144 | PASS | 86 | Provisioning job idempotency, provider selections, and 10-step ledger are contract-tested and live rollback-smoked; actual worker not built. | Add authenticated API create/retry test with persisted rollback cleanup. |
| T-145 | PARTIAL | 80 | Console now renders provider metadata and provisioning steps; authenticated browser click-flow not refreshed locally. | Add authenticated provisioning UI test when credentials are available. |
| T-146 | PASS | 86 | Schema/API/UI helpers reject raw provider secrets and store secret refs only. | Add live negative provider token API test. |
| T-147 | PASS | 84 | Provider archive semantics covered by contracts/schema and console archive action exists; no persistent live row test. | Add archive/restore-ready integration test. |
| T-148 | PASS | 86 | Live tenant_events metadata shows `phi:false` and safe event metadata. | Add log/event schema validator. |
| T-149 | PASS | 96 | Live resolver 200 for Vercel patient host, now covered by `npm run smoke:tenant-resolver` and CI. | Keep resolver smoke mandatory. |
| T-150 | PASS | 96 | Live resolver 200 for Vercel ops host, now covered by `npm run smoke:tenant-resolver` and CI. | Keep resolver smoke mandatory. |
| T-151 | PASS | 96 | Live resolver 200 for uppercase host, now covered by `npm run smoke:tenant-resolver` and CI. | Keep resolver smoke mandatory. |
| T-152 | PASS | 96 | Live resolver 404 for unknown host, now covered by `npm run smoke:tenant-resolver` and CI. | Keep resolver smoke mandatory. |
| T-153 | PASS | 96 | Live resolver 403 for wrong surface, now covered by `npm run smoke:tenant-resolver` and CI. | Keep resolver smoke mandatory and add visual wrong-portal assertion. |
| T-154 | PASS | 96 | Live resolver 423 for pending real doctoleb domains; live DB rows are pending and CI smoke protects this while the domain is not purchased. | Update smoke expectations only after DNS/SSL/domain activation is intentionally completed. |
| T-155 | PASS | 90 | Unit contract covers maintenance/inactive/suspended/provisioning as inactive. | Add rolled-back live status test. |
| T-156 | PASS | 90 | Unit tests prove prod fails closed without resolver instead of fallback. | Add deployed outage browser simulation. |
| T-157 | PASS | 88 | Unit tests prove explicit local fallback behavior. | Keep env docs updated. |
| T-158 | PASS | 88 | Unit tests prove timeout maps to resolver-down error. | Add browser retry-state test. |
| T-159 | PASS | 92 | Supabase MCP shows all 10 control-plane tables have RLS enabled. | Add CI live DB assertion. |
| T-160 | PARTIAL | 90 | Supabase MCP shows tenant tables have RLS enabled; policy behavior still needs pgTAP/anon matrix. | Configure live DB contract envs. |
| T-161 | PASS | 94 | Control-plane zero-PHI backend-contract audit now blocks clinical table names, PHI-owned columns, and control-plane function access to tenant clinical tables. | Add live tenant event metadata linter later. |
| T-162 | PASS | 94 | Backend audit passes no service-role references in frontend packages/apps; CI bundle audit now covers patient, ops, and control-plane with app-specific rules. | Confirm next production CI deploy scan is green. |
| T-163 | PASS | 94 | Supabase MCP shows admin Edge Functions have `verify_jwt=true`; admin RPC grants are service_role/postgres only; admin CORS preflight rejects unknown origins. | Add non-admin and inactive-admin API tests. |
| T-164 | PASS | 96 | Public resolver returns safe routing metadata and no service-role key; resolver smoke scans response bodies for forbidden secret markers. | Keep response secret-marker scan in CI. |
| T-165 | PASS | 90 | Backend audit passes explicit select-list checks. | Keep audit mandatory in CI. |
| T-166 | PARTIAL | 78 | Some pagination contracts exist; not every list API/page has live proof. | Add list pagination performance tests. |
| T-167 | PARTIAL | 82 | Backend audit checks duplicate method names and raw route helpers; broad duplicate table/service review remains manual. | Add architecture audit checklist. |
| T-168 | PARTIAL | 78 | MCP/RPC grants spot checks pass for admin RPCs; full anon-RPC matrix skipped in local verify. | Configure anon-RPC CI secrets. |
| T-169 | PASS | 94 | Live tenant DB public DELETE policy count is now 0 after migration `20260509010000_revoke_browser_hard_delete_policies.sql` was expanded and applied. | Keep contract test and MCP verification in release checklist. |
| T-170 | PARTIAL | 78 | Storage hardening migration exists; live bucket policy not checked in this pass. | Verify buckets and signed URL behavior. |
| T-171 | BLOCKED | 45 | Supabase leaked password protection is still reported disabled by live advisors. SECURITY DEFINER warnings are now documented, but dashboard Auth hardening still needs project-owner action. | Enable/verify leaked password protection and admin MFA posture. |
| T-172 | PASS | 94 | CI workflow runs lint, build, unit, backend audit, DB contract script, high audit, three app builds, bundle secret audits, browser/auth smoke, admin CORS smoke, and tenant resolver smoke. | Configure live DB secrets so the required DB contract job can turn green. |
| T-173 | PARTIAL | 75 | GitHub Actions deploys three Vercel project IDs, but Vercel Git deploy is disabled. | Decide deployment authority and document it. |
| T-174 | PARTIAL | 82 | Baseline security headers exist and CSP rollout has started as `Content-Security-Policy-Report-Only`; enforcement is not enabled yet. | Review report-only behavior after deploy, test auth/print/font flows, then enforce. |
| T-175 | PARTIAL | 84 | Safe logger unit test exists; live log drain/Sentry proof missing. | Add observability integration and no-PHI log audit. |
| T-176 | BLOCKED | 45 | No implemented resolver/admin rate-limit proof found. | Add firewall/throttling or Edge rate-limit strategy. |
| T-177 | BLOCKED | 35 | Backup/restore drill not evidenced. | Run and document tenant DB restore drill. |
| T-178 | PARTIAL | 60 | Resolver cache/timeout tests exist; no load test. | Add resolver load/performance test. |
| T-179 | PARTIAL | 50 | Accessibility keyboard pass is not broadly automated. | Add axe/keyboard Playwright pass. |
| T-180 | PARTIAL | 87 | Current deployed UI smoke passes; resolver smoke is automated; local control-plane login shell smoke passes; auth smoke skipped locally but exists in CI workflow and previous report. | Refresh auth smoke with secrets and add post-login action assertions. |

## Immediate Next Review Slice

The next review pass should not add more checklist items. It should convert the lowest-confidence and failing points into concrete fixes or automated tests:

1. Configure live DB contract envs so T-159, T-160, T-168, and T-169 are tested in CI.
2. Refresh auth smoke with secrets loaded for T-014, T-052, T-053, T-054, T-126, and T-180.
3. Start the first deep mutation E2E suite: patient registration, consent, booking, and message idempotency.
4. Configure safe GitHub secrets for required live DB contract checks: `BACKEND_TEST_DATABASE_URL`, `BACKEND_TEST_SUPABASE_URL`, and `BACKEND_TEST_SUPABASE_ANON_KEY`.
5. Finish the remaining staff lifecycle proof for T-111: resend invite, accepted invite browser login, and reactivation/undo.
6. Review CSP report-only behavior after deploy and decide the enforcement-safe policy.
7. Confirm the next GitHub Actions production run passes the new resolver smoke and all-app bundle secret audit gates.
