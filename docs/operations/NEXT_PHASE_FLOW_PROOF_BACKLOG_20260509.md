# Next Phase Flow Proof Backlog - 2026-05-09

## Purpose

This backlog converts the SaaS handoff, full-flow QA matrix, patient/staff action contracts, top-fix passes, and the current implementation state into the next executable engineering queue. The goal is not to add broad new product features. The goal is to prove, harden, and clean the flows already built so the no-domain SaaS foundation can safely run on Vercel aliases now and switch to purchased domains later.

## Current Truth

The following foundations exist and should be protected, not rewritten:

| Area | Current state | Remaining proof |
| --- | --- | --- |
| Control plane | `xouqxgwccewvbtkqming` stores zero-PHI SaaS metadata, plans, entitlements, provider connections, provisioning jobs, and rate-limit buckets. | Prove authenticated console flows in deployed browser smoke with real credentials. |
| Tenant project | `gezmfmskhmjgnquoyosq` remains the first clinical tenant. | Keep all PHI and clinical workflow tests scoped to this tenant DB. |
| No-domain routing | Vercel aliases and localhost mappings are the active path. `doctoleb.com` rows stay `pending`. | Prove resolver, wrong-surface, and placeholder-domain behavior after each deploy. |
| CI/CD | GitHub Actions builds, deploys, smokes Vercel aliases, runs auth smoke, flow smoke, CORS smoke, resolver smoke, CSP smoke, and backend DB contracts against a disposable local Supabase stack. | Prove the local Supabase contract job on the next push and keep live tenant URLs out of SQL/pgTAP checks. |
| Browser flow smoke | `scripts/deployed-flow-smoke.mjs` exists and now checks logout/cache cleanup and browser storage draft leakage. | Run in required mode once smoke credentials are configured. |
| Rate limiting | Control-plane `edge_rate_limit_buckets` and `check_edge_rate_limit` are live; resolver/admin functions use safe errors. | Add broader coverage to tenant Edge Functions after admin/resolver behavior is stable. |
| Bundle secret audit | Local auto-discovery works; explicit `BUNDLE_DIR` remains strict for CI. | Keep the audit in every production deploy job. |
| Staff lifecycle | Invite, resend, cancel/disable, reissue, and reactivate server paths exist. | Browser-proof accepted invite login and reactivation with a dedicated QA staff account or inbox. |
| Clinical drafts | Tenant DB-backed drafts and TTL path exist; browser storage use is contract-tested and smoke-checked. | Prove save/discard through an authenticated browser encounter flow with disposable QA encounter data. |
| Provisioning | Provider-aware draft, step ledger, run/cancel/compensate functions, and UI surfaces exist. | Run full QA tenant draft and compensate/cancel path from deployed control-plane browser. |

## Non-Negotiable Boundaries

- No PHI in the control plane, logs, browser reports, GitHub artifacts, or provisioning metadata.
- No service-role, provider token, tenant DB password, or management credential in browser bundles or Playwright reports.
- No real `doctoleb.com` activation until purchase, DNS verification, and SSL issuance are complete.
- No Supabase Management API project creation until provider token storage, org/region choice, cost controls, retry rules, and compensation are separately designed.
- No junior doctor role enablement until role semantics, RLS, route access, sign-off workflow, and tests are designed.
- No hard delete for clinical, account, billing, staff, provisioning, or tenant records.

## Execution Band 1 - Prove CI And Deployed Flow Gates

Owner: engineering.

1. Keep `.github/workflows/ci.yml` starting a disposable local Supabase stack for SQL audit, pgTAP RLS, and anon RPC exposure checks.
2. Push only after local gates pass; CI must fail if required DB contract checks skip.
3. Run required deployed gates: browser smoke, auth smoke, first-band flow smoke, resolver smoke, control-plane admin CORS smoke, CSP smoke.
4. Treat deployed CSP smoke failures as stale-deployment evidence until the latest `vercel.json` reaches the aliases.

Done means:

| Proof | Required result |
| --- | --- |
| `npm run verify` | Passes locally. |
| `npm run audit:bundle-secrets` | Passes locally without manual `BUNDLE_DIR`. |
| CI backend DB contract | Runs against local disposable Supabase DB/API, not skipped and not live. |
| Deployed flow smoke | Runs with `FLOW_SMOKE_REQUIRED=true`. |
| Deployed CSP smoke | Passes after new Vercel alias deployment. |

## Execution Band 2 - Turn Read-Only Smoke Into Reversible Mutation Proof

Owner: engineering after QA accounts and disposable tenant records exist.

Run mutation modes one at a time. Do not enable all mutation flags together until each individual path has passed and cleanup is proven.

| Order | Flag | Flow | Cleanup/undo requirement |
| --- | --- | --- | --- |
| 1 | `FLOW_SMOKE_MUTATE_STAFF=true` | Create QA pending invite, resend, cancel, show inactive, reissue. | Ends in auditable invited/disabled state with QA-prefixed email. |
| 2 | `FLOW_SMOKE_MUTATE_CONTROL_PLANE=true` | Create QA tenant draft from console, seed pending domains, run/cancel/compensate available steps. | Job can be cancelled; completed steps expose compensation. |
| 3 | `FLOW_SMOKE_MUTATE_APPOINTMENTS=true` | Patient selects doctor/date/slot, books QA appointment, then cancels. | Appointment becomes `cancelled`; slot is released through RPC. |
| 4 | Encounter draft flow | Doctor opens disposable QA encounter, saves draft, reloads, discards. | Draft exists only in tenant DB, then is discarded/expired. |
| 5 | Messaging idempotency | Send/retry same `client_request_id` where test conversation data allows. | Existing message is returned; no duplicate-key failure. |

Done means every mutation uses `qa-e2e-*` identifiers, an idempotency key, audit/status history, and a reversible final state.

## Execution Band 3 - Accepted Staff Invite Proof

Owner: engineering plus either a test inbox or dedicated mutable QA accepted staff account.

1. If a test inbox is available, automate the full invite link acceptance path.
2. If no inbox exists, keep email-link acceptance marked provider-blocked and use a dedicated accepted QA staff credential for login proof.
3. Prove accepted staff lands on the correct role dashboard.
4. Disable that accepted staff account, prove login fails closed or routes out safely.
5. Reactivate the same staff account, prove login works again.
6. Confirm no shared smoke account is left disabled in `finally` cleanup.

Done means accepted staff lifecycle is proven from browser to API to DB and back without hard delete.

## Execution Band 4 - Operations And Observability Closure

Owner: engineering.

1. Extend safe logger events to Edge Function success/failure paths using only tenant-safe tags: `tenantId`, `tenantSlug`, `surface`, `route`, `featureCode`, `appVersion`, status, correlation ID, and idempotency ID.
2. Add no-op telemetry adapters for future Sentry/Vercel configuration; absent DSN/provider config must not throw.
3. Add a log-safety audit that rejects PHI terms, medical text markers, messages, documents, access tokens, service-role keys, and provider secrets in logger calls.
4. Add runbooks for deploy, rollback, incident triage, tenant activation, tenant suspension, provider credential rotation, and domain activation later.
5. Produce schema/ERD artifacts that label control-plane metadata tables separately from tenant clinical tables.

Done means operations proof can run without paid Supabase features, while Pro-only items remain documented launch-readiness blockers.

## Execution Band 5 - Large-File Cleanup After Browser Baselines

Owner: engineering, behavior-preserving only.

Do not start broad refactors before deployed browser baselines are stable. Slice one page at a time.

| Priority | File | Current size | First extraction |
| --- | --- | ---: | --- |
| 1 | `apps/clinic-ops/src/pages/AppointmentsPage.jsx` | 1308 lines | Move filters/table/actions into components and data state into a hook. |
| 2 | `apps/clinic-ops/src/pages/PatientsPage.jsx` | 873 lines | Move search/list/archive modal into components; keep archive in service/RPC. |
| 3 | `apps/clinic-ops/src/pages/CreateBillPage.jsx` | 759 lines | Move billing form sections out; keep entitlement/business rules in core services. |
| 4 | `apps/clinic-ops/src/pages/BillingPage.jsx` | 655 lines | Split list, filters, and export/print actions. |
| 5 | `apps/clinic-ops/src/pages/DoctorScheduleTemplatesPage.jsx` | 593 lines | Extract template editor and reversible deactivate UI. |
| 6 | `apps/clinic-ops/src/pages/DoctorStaffPage.jsx` | 577 lines | Extract lifecycle action panel and invite form after E2E staff proof. |
| 7 | `apps/clinic-ops/src/pages/DoctorAppointmentsPage.jsx` | 575 lines | Reuse appointment cancel component and extract doctor-specific filters. |
| 8 | `packages/ui/components/messaging/MessagingPage.jsx` | 479 lines | Split conversation list, composer, retry/idempotency state. |
| 9 | `apps/patient-web/src/pages/PatientAppointmentsPage.jsx` | 470 lines | Keep booking state in hook; page composes UI only. |

Done means each slice reduces one file, adds or preserves tests, changes no behavior, and passes targeted build plus `npm run test:unit`.

## Manual Blockers

| Blocker | Why manual | Engineering action |
| --- | --- | --- |
| Local Supabase CI availability | GitHub Actions must be able to run Docker containers for the disposable local DB/API stack. | Keep backend DB contracts required in CI; do not replace this with a live tenant DB URL. |
| Supabase leaked-password protection | Current Supabase plan does not support it. | Keep as launch-readiness item, not sprint blocker. |
| Real domain purchase/DNS/SSL | Requires account/payment/DNS ownership. | Keep real domains `pending`; use Vercel aliases now. |
| Email invite acceptance | Needs inbox access or safe email provider hook. | Use dedicated accepted QA staff credentials if inbox is unavailable. |
| Full Supabase project creation automation | Requires cost/org/region/token/rollback design. | Continue operator-linked project provisioning only. |

## Next Immediate Slice

The next code-owned slice should be authenticated deployed flow execution once secrets exist. If secrets are still unavailable, continue with operations docs and one behavior-preserving large-file extraction protected by current unit/build gates. Do not add new product surface area until the first-band browser flows pass in required mode.
