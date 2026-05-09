# DoctoLeb Full-Flow QA Confidence Matrix

Date: 2026-05-09
Scope: SaaS control plane, patient web, clinic ops, resolver, tenant DB, control-plane DB, CI/CD, Vercel deployment, and current manual/assisted provisioning design.
Standard: production-bound review. No prototype assumptions. Scores are evidence confidence, not a promise that defects cannot exist.

## Confidence Scale

| Score | Meaning |
| --- | --- |
| 95-100 | Proven by source scan, automated tests, live/deployed browser checks, and live service/DB evidence. Only normal production unknowns remain. |
| 85-94 | Strong evidence exists, but at least one important edge, mutation flow, or operational drill is not fully proven. |
| 70-84 | Architecture and automated contracts are good, but full live end-to-end user action is partial. |
| 50-69 | Design/schema/code exists, but real user workflow or live external integration is not fully exercised. |
| 0-49 | Mostly planned or scaffolded; should not be treated as production-ready. |

Perspective columns:

| Code | Perspective |
| --- | --- |
| UI | UI/UX: rendering, responsive behavior, accessibility labels, copy, visible flow clarity. |
| API | Function/API/business code: validation, errors, service boundaries, idempotency, fail-closed behavior. |
| DB | DB/admin/data engineering: RLS, constraints, migrations, indexes, auditability, reversibility. |
| SYS | Sysadmin/deployment: CI/CD, envs, secrets, Vercel/Supabase runtime, rollback/deploy readiness. |
| BA | Business analyst: matches real clinic/SaaS workflow and plan/tenant requirements. |
| USER | Final user: doctor, staff, patient, or SaaS admin can complete the job without hidden developer steps. |
| OVERALL | Conservative confidence for the whole flow. |

## Evidence Scanned

- Repository structure: `apps/patient-web`, `apps/clinic-ops`, `apps/control-plane`, `packages/core`, `packages/ui`.
- App routers and boundaries: patient routes, ops routes, protected route guards, tenant bootstrap, brand/auth providers.
- Core services and contracts: auth identity, tenant resolver, entitlements, payments, logging, print safety, service access patterns.
- Control-plane UI: console session hook, tenant list/detail, draft creation, domain readiness, runtime config, branding, entitlements, provisioning panels.
- Supabase control-plane migrations/functions: tenants, domains, plans, entitlements, provisioning jobs, provider connections, provisioning steps, admin Edge Functions, resolver Edge Function.
- Tenant Supabase migrations: clinical tables, consent, messaging, feature flags, tenant profile/config, RLS, lifecycle RPCs.
- CI/CD: `.github/workflows/ci.yml`, `vercel.json`, Vercel project deployment matrix, browser/auth smoke jobs.
- Tests: 14 unit test files, backend contract audit, DB contract script, Playwright deployed UI/auth smoke scripts, control-plane admin CORS smoke, tenant resolver HTTP smoke, and bundle secret audit.
- Live Supabase MCP evidence: control-plane public tables all RLS-enabled, tenant public tables all RLS-enabled, control-plane Edge Functions active, resolver public by design.
- Live browser evidence: deployed UI smoke on desktop/mobile for all three apps. Local auth smoke could not run in the current shell because `AUTH_SMOKE_*` secrets are not loaded.

## Verification Commands And Results

| Check | Result | Notes |
| --- | --- | --- |
| `npm run verify` | PASS | 167 unit tests, lint, unified build, backend-contract audit, DB contract script, high-severity npm audit. |
| `npm run build:patient` | PASS | Standalone patient build passed after the cross-app URL fix. |
| `npm run build:ops` | PASS | Standalone ops build passed after the cross-app URL fix. |
| `npm run smoke:browser:deployed` | PASS | Desktop/mobile smoke for patient, ops, control-plane. Report: `output/playwright/deployed-ui-qa-report.json`. |
| `npm run smoke:auth:deployed` | SKIPPED LOCALLY | Current shell is missing `AUTH_SMOKE_*` variables and `AUTH_SMOKE_REQUIRED` is not true. GitHub Actions is wired to require these secrets. |
| `npm run smoke:control-plane-admin-cors` | PASS | Live control-plane admin preflight allows only the console Vercel origin and rejects an unknown origin with `ORIGIN_NOT_ALLOWED`. |
| `npm run smoke:tenant-resolver` | PASS | Vercel patient/ops hosts resolve, uppercase host resolves, unknown host returns 404, wrong surface returns 403, pending not-purchased domains return 423, and no forbidden secret markers are returned. |
| `npm run audit:bundle-secrets` against current app build outputs | PASS | Patient, ops, and control-plane bundles scanned with app-specific secret/fallback rules. |
| Provider-aware provisioning rollback smoke | PASS | Live control-plane transaction created active Supabase/Vercel provider connection metadata, created an assisted tenant draft, verified 10 provisioning steps, then rolled back. |
| Local control-plane browser smoke | PASS | Unauthenticated console shell loaded on local Vite with no console/page errors. Authenticated provisioning UI click-flow still needs local credentials. |
| GitHub Actions run `25579047821` | PASS | Verify, deploy three Vercel projects, alias smoke, browser smoke, auth smoke all succeeded on `main`. |
| Live resolver HTTP checks | PASS | Patient host 200, unknown host 404, wrong surface 403, pending real domains 423. |
| Live Supabase control-plane tables | PASS with advisories | 10 expected SaaS/control-plane tables, all RLS-enabled. Security advisors still have documented warnings. |
| Live tenant tables | PASS with advisories | Public tenant tables are RLS-enabled. Performance/security advisors still need allowlist/follow-up. |

Important caveat: local `test:backend-db-contract` still skips live pgTAP/anon-RPC checks without DB env vars, but GitHub Actions now sets `BACKEND_DB_CONTRACT_REQUIRED=true`, so CI will fail instead of accepting skipped live DB checks until the safe test secrets are configured.

## Finding Fixed During This Review

| Finding | Evidence | Fix | Verification | Deploy status |
| --- | --- | --- | --- | --- |
| Ops login "Patient Portal" link navigated to `/r/login` and showed patient 404 because `VITE_PATIENT_WEB_URL` contained an escaped `\r`. | Playwright click from `https://doctoleb-clinic-ops.vercel.app/login` landed at `https://doctoleb-patient-web.vercel.app/r/login`. | Normalized literal and escaped CR/LF in `packages/core/lib/appBoundaries.js`, cleaned clinic-ops Vercel env, redeployed clinic-ops, and added deployed browser-smoke link assertions. | `npm run verify`, `npm run build:patient`, `npm run build:ops`, and `npm run smoke:browser:deployed` passed after the fix. | Fixed and deployed. |
| Staff roster was metadata-only and browser-mutated lifecycle fields directly. | Source scan found browser staff insert/update paths and no Auth-backed invite lifecycle. | Added `staff-invite` and `staff-member-disable` Edge Functions, service-role RPCs, role-aware Auth trigger handling, browser mutation guards, and audit/idempotency fields. | `npm run verify`; rollback Supabase probes for invite -> disable, accepted disable, direct insert denial, direct lifecycle update denial; Edge functions active with `verify_jwt=true`. | Fixed for create and disable/cancel; resend/reactivation still open. |
| Control-plane admin APIs had wildcard CORS fallback. | `_shared/admin.ts` defaulted `CONTROL_PLANE_ALLOWED_ORIGINS` to `*`. | Replaced the fallback with explicit console/local origins, added unknown-origin rejection before RBAC, set the live allowlist secret, and redeployed all admin Edge Functions. | Contract test plus `npm run smoke:control-plane-admin-cors`. | Fixed and deployed to Supabase Edge Functions. |
| Control-plane zero-PHI boundary relied mostly on documentation. | Review requested an automated PHI-column linter for control-plane migrations/events. | Added backend-contract audit to block clinical table names, PHI-owned columns, and control-plane function access to tenant clinical tables. | `npm run audit:backend-contract`; `npm run verify`. | Fixed as a repo guard. |
| CSP had not started beyond baseline headers. | `vercel.json` had baseline headers but no CSP. | Added `Content-Security-Policy-Report-Only` with app-shell/Supabase/font allowances. | Contract test plus patient, ops, and control-plane builds. | Partially fixed; enforcement waits for report-only review after deploy. |
| Resolver post-deploy behavior was not a CI contract. | Live resolver behavior was checked, but not captured in a reusable required post-deploy smoke. | Added `scripts/tenant-resolver-smoke.mjs`, package script, GitHub Actions job, and contract tests. | `npm run smoke:tenant-resolver`; `node --test tests/unit/saasFoundationContracts.test.mjs`. | Fixed as a deploy gate. |
| Bundle secret scanning excluded the control-plane app. | CI grep only ran when `matrix.app != 'control-plane'`. | Added an all-app bundle audit script with control-plane-safe rules and patient/ops tenant-fallback checks. | Local scans passed for patient, ops, and control-plane build outputs; contract test guards CI wiring. | Fixed as a deploy gate. |
| Tenant draft creation did not select provider accounts or expose the step ledger in the console. | Existing draft flow created a tenant/checklist but did not connect Supabase/Vercel provider metadata or show step-level undo/readiness. | Added provider-aware draft fields, provider connection UI, `tenant_provisioning_steps` seeding, tenant detail step read, and provisioning step rendering. | `npm run verify`; live rollback smoke; `npm run build:control-plane`; local browser smoke. | Fixed for planning/readiness; external provider execution runner remains open. |

## Full-Flow Confidence Matrix

Scores are conservative. When a row has strong code tests but no live mutation/browser proof, the final-user score stays lower.

| Flow / Action | Current evidence | UI | API | DB | SYS | BA | USER | OVERALL | Next proof needed |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Patient app boots through tenant resolver | Unit resolver tests, `TenantBootstrap`, deployed smoke, live resolver HTTP. | 92 | 96 | 92 | 92 | 95 | 90 | 93 | Add synthetic outage browser test for resolver down state. |
| Ops app boots through tenant resolver | Unit resolver tests, deployed smoke, auth smoke. | 90 | 96 | 92 | 92 | 94 | 90 | 92 | Re-run deployed click test after URL fix deploy. |
| Control-plane app boots with control-plane Supabase env | Deployed smoke, auth smoke, source scan. | 88 | 90 | 90 | 90 | 88 | 84 | 88 | Add browser test for missing-env screen and bad-session recovery. |
| Resolver success for Vercel patient host | Live HTTP 200 returns `dev` tenant config with no service-role leak; CI resolver smoke is wired. | 90 | 96 | 95 | 94 | 95 | 92 | 95 | Keep resolver smoke mandatory and add outage simulation later. |
| Resolver success for Vercel ops host | Live SQL/HTTP evidence, deployed ops boot, and CI resolver smoke are wired. | 90 | 96 | 95 | 94 | 95 | 92 | 95 | Keep resolver smoke mandatory and add visual wrong-surface assertion. |
| Resolver wrong surface | Live HTTP 403, unit tests. | 88 | 96 | 95 | 92 | 94 | 90 | 93 | Add visual browser assertion for wrong portal page. |
| Resolver unknown host | Live HTTP 404, unit tests. | 88 | 96 | 95 | 92 | 94 | 90 | 93 | Add visual browser assertion for unknown host copy. |
| Pending real domains before domain purchase | Live `dev.doctoleb.com` and `dev.ops.doctoleb.com` return 423; DB rows pending. | 88 | 96 | 96 | 92 | 98 | 90 | 94 | Keep domain activation runbook tied to DNS/SSL verification. |
| Future purchased domain switch | Hostname classification tests and pending-domain model. | 78 | 88 | 90 | 70 | 92 | 65 | 78 | Real DNS/SSL/Vercel domain verification after domain purchase. |
| Patient landing page content | Deployed desktop/mobile smoke: clinic-branded page, no SaaS doctor-buying copy. | 92 | 82 | 80 | 88 | 90 | 90 | 89 | Add visual review checklist and accessibility audit. |
| Patient login to dashboard | Deployed auth smoke passed. | 90 | 92 | 88 | 90 | 92 | 90 | 90 | Add post-login page action checks, not just redirect. |
| Patient signup | Source validation and Supabase auth path exist. | 75 | 78 | 75 | 72 | 80 | 60 | 68 | E2E signup with disposable test user and cleanup. |
| Patient password reset | Source validation exists; no deployed email-loop E2E. | 72 | 80 | 70 | 65 | 78 | 58 | 66 | Use test inbox/email capture and assert reset completion. |
| Patient consent gate | Unit contract proves fail-closed retry and `revoked_at` clear. | 80 | 92 | 88 | 80 | 90 | 76 | 84 | Browser E2E for loading error, accept, revoke/accept again. |
| Patient dashboard after login | Auth smoke reaches dashboard. | 86 | 82 | 78 | 86 | 84 | 84 | 83 | Assert dashboard data cards and empty/error states. |
| Patient profile update | Routes/build/services exist; no recent mutation E2E. | 74 | 78 | 78 | 72 | 82 | 65 | 72 | Browser form-save test with rollback/restore. |
| Patient appointments | Routes/build/services exist; appointment service has contracts. | 76 | 80 | 82 | 72 | 86 | 66 | 74 | E2E appointment request/book/cancel with DB cleanup. |
| Patient medical history/documents | Routes/build/services exist; print safety tested. | 76 | 78 | 80 | 72 | 84 | 64 | 73 | Browser verify documents load, empty state, permissions. |
| Patient messaging | Route exists; idempotent message retry contract tested. | 76 | 88 | 84 | 72 | 86 | 66 | 78 | E2E send/retry/read receipt between patient and staff. |
| Ops doctor login | Previous deployed auth smoke exists, but current shell could not refresh it because secrets are absent. | 84 | 90 | 86 | 82 | 90 | 82 | 84 | Load `AUTH_SMOKE_*` or confirm required GitHub Actions auth smoke after this change. |
| Ops secretary login | Previous deployed auth smoke exists, but current shell could not refresh it because secrets are absent. | 84 | 90 | 86 | 82 | 90 | 82 | 84 | Load `AUTH_SMOKE_*` or confirm required GitHub Actions auth smoke after this change. |
| Ops predoctor login | Previous deployed auth smoke exists, but current shell could not refresh it because secrets are absent. | 84 | 90 | 86 | 82 | 90 | 82 | 84 | Load `AUTH_SMOKE_*` or confirm required GitHub Actions auth smoke after this change. |
| Protected route role boundaries | Unit tests, auth smoke, `ProtectedRoute` source. | 82 | 90 | 86 | 84 | 88 | 78 | 84 | Browser test wrong-role direct URLs. |
| Cross-surface links patient/ops | Deployed browser smoke now asserts clean Patient Portal hrefs and expected patient `/login` route. | 88 | 92 | 86 | 88 | 90 | 88 | 89 | Keep href control-character assertions in CI browser smoke. |
| Secretary patient list/work queue | Routes/build/services exist; no browser mutation proof. | 76 | 78 | 78 | 72 | 86 | 64 | 73 | Browser route smoke and patient create/edit/archive flow. |
| Secretary appointment booking | Routes/build/services/RPC hardening exist. | 76 | 84 | 84 | 72 | 88 | 65 | 76 | E2E booking with available slot and rollback. |
| Secretary billing/create bill | Routes/build; payment service entitlement patterns. | 74 | 78 | 76 | 72 | 82 | 62 | 72 | E2E create bill/payment with test patient and cleanup. |
| Secretary slots | Routes/build/services exist. | 74 | 78 | 76 | 72 | 82 | 62 | 72 | E2E slot create/update/archive with rollback. |
| Insurance provider/contracts/claims | DB/services/routes exist; entitlement gate for insurance billing tested. | 72 | 82 | 78 | 70 | 82 | 60 | 72 | E2E claim workflow plus disabled-plan rejection. |
| Doctor dashboard | Auth smoke reaches page. | 86 | 82 | 78 | 86 | 84 | 84 | 83 | Assert dashboard cards/actions and empty states. |
| Doctor appointments | Routes/build/services exist. | 76 | 80 | 82 | 72 | 86 | 66 | 74 | Browser appointment status transition tests. |
| Doctor patient chart/profile | Routes/build/services exist. | 76 | 80 | 82 | 72 | 88 | 65 | 75 | E2E read/write scoped patient chart with RLS assertions. |
| Doctor encounter lifecycle | RPC-backed lifecycle contracts and backend audit pass. | 72 | 88 | 88 | 74 | 90 | 62 | 78 | Browser start/complete/cancel encounter with DB assertions. |
| Doctor reports/certificates/referrals | Routes/build/services exist; print safety tested. | 76 | 80 | 78 | 72 | 84 | 64 | 74 | Browser create/finalize/print checks with cleanup. |
| Predoctor precheck flow | Routes/build/precheck service exists. | 76 | 78 | 78 | 72 | 86 | 64 | 73 | E2E submit precheck and doctor review visibility. |
| Staff messaging | Route exists; idempotency contract tested. | 76 | 88 | 84 | 72 | 86 | 66 | 78 | E2E staff-to-patient conversation and read state. |
| Entitlement resolution core | Unit tests for plan defaults, add-ons, overrides, missing features. | 82 | 94 | 90 | 84 | 94 | 78 | 88 | Add live plan change projection browser test. |
| Backend feature enforcement | `insurance_billing` backend gate tested. | 78 | 90 | 84 | 80 | 90 | 72 | 83 | Add backend gates for AI, BI, advanced reports when implemented. |
| Control-plane owner login/RBAC | Deployed auth smoke, Edge Function `requireSuperAdmin`, and strict admin CORS preflight smoke. | 86 | 94 | 90 | 90 | 92 | 84 | 90 | Add non-admin and inactive-admin browser/API rejection tests. |
| Control-plane tenant list/detail | Console UI exists; owner login screenshot; API explicit selects. | 82 | 88 | 88 | 82 | 88 | 78 | 84 | Browser assert list rows/detail panels after login. |
| Control-plane tenant draft creation | Unit contracts, Edge Function, service-role RPC, idempotency, provider selections, and live rollback smoke. | 82 | 92 | 94 | 86 | 94 | 76 | 86 | Authenticated browser create draft in a test namespace and rollback/archive. |
| Control-plane domain readiness | Unit tests and Edge Function domain activation guard. | 80 | 90 | 92 | 82 | 94 | 72 | 84 | Browser save domain readiness, verify pending/active behavior in DB. |
| Control-plane runtime config save | UI, validation helpers, service-role RPC, tests. | 78 | 90 | 90 | 82 | 90 | 70 | 82 | Browser save against test tenant and verify resolver metadata. |
| Control-plane branding sync | Edge Function stores previous snapshot and syncs tenant DB. | 76 | 86 | 84 | 78 | 90 | 68 | 80 | Browser change brand, verify tenant app config and patient render. |
| Control-plane entitlements sync | Edge Function resolves plan+overrides and writes tenant `feature_flags`. | 76 | 88 | 86 | 78 | 92 | 68 | 81 | Browser toggle feature and verify UI/backend allowed/denied. |
| Provider connection metadata APIs | Schema/API/tests reject raw secrets, support archive, and now have console metadata UI. | 78 | 88 | 88 | 78 | 90 | 68 | 81 | Browser UI flow with authenticated owner plus real provider verification action. |
| Automatic Supabase/Vercel tenant provisioning | Provider backbone, provider-aware draft creation, and undoable step ledger exist. Automation runner not implemented. | 58 | 66 | 78 | 56 | 82 | 48 | 63 | Build `admin-run-provisioning-step`, provider secret verification, project creation, migration runner, Vercel config automation, and compensating actions. |
| Staff invite and disable/cancel lifecycle | Auth-backed invite and disable/cancel run through JWT Edge Functions and service-role RPCs; direct browser insert/lifecycle update is blocked; rollback DB probes passed. | 82 | 90 | 92 | 84 | 88 | 78 | 85 | Add resend invite, accepted invite email-link browser login proof, and reactivation/undo. |
| Reversibility/undo design | Tenant states, soft archive, provisioning steps, undo payloads, idempotency, and staff disable previous-state preservation. | 72 | 87 | 91 | 78 | 92 | 72 | 82 | Add remaining cancel/compensate functions and rollback tests. |
| Control-plane zero-PHI boundary | Docs, table comments, backend-contract zero-PHI audit, schema scan, and service-role-only admin functions. | 84 | 92 | 96 | 90 | 96 | 82 | 90 | Add live tenant event metadata linter and periodic Supabase advisor review. |
| Tenant DB RLS posture | Live table list shows RLS enabled, total public DELETE policy count is 0, and CI now fails required DB-contract skips. Local pgTAP still skips without env vars. | 78 | 86 | 94 | 82 | 92 | 76 | 86 | Configure GitHub live DB test secrets and confirm a green required pgTAP/anon-RPC run. |
| Service-role secret boundary | Backend audit passes, no frontend service-role refs, and all three Vercel bundles are now scanned for secret markers during deploy. | 86 | 92 | 90 | 92 | 94 | 84 | 91 | Add deployed artifact scan evidence from the next green CI run. |
| Logging safety | Unit test redacts PHI/secrets and safe tags only. | 80 | 88 | 82 | 80 | 90 | 76 | 83 | Wire Sentry/Vercel logging and verify no PHI in real events. |
| Print safety | Unit tests escape HTML, remove active content, isolate `document.write`. | 84 | 90 | 80 | 78 | 88 | 80 | 84 | Browser print-preview smoke for reports/certificates. |
| CI/CD quality gate | GitHub Actions runs verify, builds, deploys, bundle secret audit, smoke/browser/auth checks, control-plane admin CORS smoke, tenant resolver smoke, and now fails if required live DB contracts are skipped. | 88 | 93 | 90 | 96 | 92 | 88 | 93 | Configure DB contract secrets and confirm the next green CI run. |
| Vercel no-domain operation | Vercel aliases active, resolver maps free domains, custom domains pending. | 88 | 92 | 90 | 92 | 96 | 88 | 91 | Keep Vercel aliases as first-class until domain purchase. |
| Custom-domain activation | Pending rows and DNS/SSL guard exist. Domain not purchased. | 70 | 84 | 90 | 60 | 90 | 55 | 72 | Buy/verify domain, add Vercel domains, activate rows, smoke. |
| Supabase Auth password policy | Supabase Auth in use; leaked password protection still disabled by advisor. | 78 | 82 | 78 | 65 | 88 | 70 | 76 | Enable leaked password protection in both Supabase projects. |
| Security definer RPC exposure | New staff trigger helpers are no longer externally executable; remaining advisor warnings are documented in `docs/security/SECURITY_DEFINER_ALLOWLIST_20260509.md` but still need per-function tests/revokes. | 74 | 86 | 84 | 76 | 88 | 70 | 80 | Convert helper-function review into revoke migration where app code does not call the RPCs. |
| Security headers and CSP rollout | Baseline headers plus report-only CSP are configured in `vercel.json`; enforcement not enabled yet. | 82 | 86 | 78 | 84 | 86 | 78 | 82 | Review report-only behavior after deploy, test auth/print flows, then enforce. |
| Performance/load | Builds pass; resolver has cache; DB advisors show unused/unindexed index info. | 70 | 78 | 72 | 60 | 78 | 62 | 69 | Add Lighthouse, resolver load test, query plan/index review after real data. |
| Observability/monitoring | Safe logger exists; CI smoke exists. Sentry/Vercel observability not fully wired. | 60 | 70 | 65 | 55 | 78 | 55 | 64 | Add Sentry/Vercel telemetry, alerts, dashboards, PHI-safe event tests. |
| Backup/restore/incident ops | Not proven in repo tests. | 40 | 50 | 60 | 35 | 80 | 45 | 50 | Define Supabase backup/PITR plan, restore drill, incident runbook. |

## Priority Test Backlog

### P0 - Before Any Real Clinic Production Use

1. Keep deployed browser smoke enforcing ops login `Patient Portal -> patient /login` so the fixed cross-surface URL cannot regress.
2. Add CI envs for live DB contract tests: `BACKEND_TEST_DATABASE_URL`, `BACKEND_TEST_SUPABASE_URL`, `BACKEND_TEST_SUPABASE_ANON_KEY`.
3. Enable Supabase leaked password protection on both `xouqxgwccewvbtkqming` and `gezmfmskhmjgnquoyosq`.
4. Add post-login route smoke for all core pages per role, not only dashboard redirect.
5. Add control-plane browser mutation test with a safe draft tenant: create draft, edit domains, set runtime config, sync branding, sync entitlements, archive/cancel cleanup.
6. Keep resolver post-deploy HTTP smoke mandatory in GitHub Actions and review it after domain activation changes.
7. Continue SECURITY DEFINER allowlist review and convert safe helper revokes into migrations.

### P1 - Before Beta Clinic Pilot

1. Patient signup with disposable test user and cleanup.
2. Patient password reset with a test inbox or email capture tool.
3. Patient profile update with DB restore assertion.
4. Patient appointment request, secretary booking, doctor appointment view, and cancel/reschedule path.
5. Doctor encounter start, clinical note, diagnosis, report/certificate, complete/cancel path.
6. Predoctor precheck submit and doctor/secretary visibility.
7. Messaging E2E across patient and staff, including retry with same `client_request_id`.
8. Branding sync E2E: control-plane update -> tenant DB config -> patient/ops UI render.
9. Entitlement E2E: disabled insurance/AI/BI/reporting hidden in UI and rejected server-side; enabled path works.
10. Provider connection UI: create/update/archive metadata, reject raw token input, show `has_secret_ref` only.

### P2 - Before Scaling Multiple Clinics

1. Assisted/automatic tenant provisioning worker: Supabase project creation, migration runner, seed first doctor/admin, Vercel alias/domain config.
2. Cancel/compensate functions that consume `tenant_provisioning_steps.undo_strategy` and `undo_payload`.
3. Resolver and DB load tests with realistic tenant/domain counts.
4. Lighthouse/Core Web Vitals budgets for patient landing, login, dashboards, and control-plane console.
5. Accessibility audit with keyboard-only and screen-reader checks for all primary flows.
6. Sentry/Vercel observability wiring with PHI-safe tags and alert thresholds.
7. Backup/restore/PITR runbook and a tested restore drill.
8. Stripe billing/entitlement webhook integration when live billing is introduced.

## Current High-Confidence Areas

- Three app separation is structurally real: patient, ops, and control-plane have standalone Vite apps and build independently.
- Production can work without buying `doctoleb.com`: Vercel aliases resolve today, and real DoctoLeb domain rows stay pending.
- Control-plane stores SaaS metadata only; clinical/PHI tables remain in the tenant project.
- Control-plane zero-PHI drift is now guarded by the backend-contract audit.
- Service-role keys are not referenced in browser app/package code.
- Resolver behavior is fail-closed in production, with local development fallback only outside production.
- Admin writes are routed through authenticated Edge Functions, not raw service-role calls from React.
- Feature entitlements have a shared core resolver and at least one backend enforcement example (`insurance_billing`).
- CI/CD is meaningful: verify, builds, deploy, browser smoke, and auth smoke all exist.

## Current Areas Not Yet 100 Percent Proven

- Full clinical workflows are not browser-tested end-to-end with DB assertions and cleanup.
- Control-plane mutation flows are not yet covered by live browser E2E tests.
- Staff roster v1 roles are constrained, and invite creation plus disable/cancel are server-owned and live-proven. Resend invite, accepted invite email-link browser login proof, and reactivation/undo are still open.
- Supabase leaked password protection is still disabled according to live advisors.
- Local live pgTAP/anon-RPC checks are skipped until DB test env vars are configured; CI now fails required skips until GitHub secrets are set.
- SECURITY DEFINER advisor warnings now have a written allowlist; remaining work is per-function revoke/testing and recurring review.
- CSP is report-only, not enforced, until deployed reports/auth/print flows are reviewed.
- Provider-flexible automatic tenant provisioning is designed and partially scaffolded, but not implemented as a working automation runner.
- Observability, performance budgets, backup/restore, and incident drills are not production-proven yet.

## Final Readiness Summary

| Dimension | Confidence |
| --- | ---: |
| Current deployed app availability on Vercel aliases | 91 |
| Resolver/control-plane routing model | 93 |
| Auth login smoke for existing users | 90 |
| SaaS control-plane foundation and DB separation | 90 |
| Patient public landing and base login UX | 89 |
| Full patient self-service workflow | 72 |
| Full clinic staff workflow | 76 |
| Entitlement/subscription backbone | 84 |
| New tenant creation as assisted manual workflow | 82 |
| New tenant creation as fully automatic provider-flexible workflow | 53 |
| Production security posture | 80 |
| Production operations/observability | 64 |

Overall current confidence for the documented SaaS foundation: 84/100.

This is strong for foundation/activation, but not yet enough for real production clinic onboarding without the P0 and P1 test backlog.
