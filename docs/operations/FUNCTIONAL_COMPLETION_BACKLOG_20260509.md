# Functional Completion Backlog - Before UI/UX Redesign

Date: 2026-05-09

## Purpose

This document parks the disposable test-environment work for now and lists what is still unfinished as product functionality. It is intentionally not a Stitch, Claude Designer, 21st MCP, shadcn, or visual redesign plan.

The goal is to freeze the functional truth before changing the interface layer. UI redesign should improve the experience around stable flows; it should not hide missing business logic, missing server enforcement, or incomplete state transitions.

## Current Baseline

The foundation is real and should be protected:

| Area | Current state |
| --- | --- |
| App separation | Patient web, clinic ops, and control-plane apps build separately. |
| No-domain operation | Vercel aliases and localhost mappings work without buying `doctoleb.com`. Real domain rows stay `pending`. |
| Tenant resolver | Public resolver shape is stable and returns safe routing metadata only. |
| Control plane | Stores zero-PHI SaaS metadata, provider connections, plans, entitlements, provisioning jobs, and rate-limit buckets. |
| Tenant DB | Clinical and PHI data stay in the tenant project. Browser hard DELETE policies were removed. |
| Staff lifecycle base | Invite, resend, cancel/disable, reissue, and reactivate server paths exist. |
| Clinical note drafts | Drafts are tenant-DB backed through RLS/RPC with TTL cleanup, not browser storage. |
| Provisioning base | Assisted no-domain provisioning has draft creation, provider metadata, step ledger, run/cancel/compensate APIs, and guarded activation checks. |
| CI/deploy | Verify, builds, Vercel deploy, bundle secret audit, resolver smoke, browser smoke, auth smoke, flow smoke, CSP smoke, and local Supabase DB contract path are wired. |

## Do Not Start Yet

Do not start broad UI/UX redesign until the functional contracts below are either fixed, explicitly deferred, or marked as design-safe.

| Design area | Why it should wait |
| --- | --- |
| Full patient portal redesign | Booking, signup/reset, consent, documents, messaging, and logout flows still need deeper functional proof. |
| Full clinic-ops redesign | Secretary, predoctor, encounter, billing, staff, and schedule flows still need E2E proof and some backend tightening. |
| Control-plane redesign | Tenant creation automation is not fully finished; redesign should follow the final provisioning step model. |
| shadcn/component-system migration | Large UI migration before flow proof risks moving hidden business logic around. |
| New visual design language | We need stable states first: loading, empty, blocked, inactive tenant, wrong role, rate limited, partial success, compensation needed. |

## Functional Backlog Summary

Status meanings:

| Status | Meaning |
| --- | --- |
| Built - needs proof | Code path exists but needs browser/API/DB proof. |
| Partial | Some pieces exist, but a key backend, API, or workflow part is missing. |
| Not built | Planned but not implemented. |
| Manual/provider-blocked | Requires dashboard, provider account, inbox, domain, or credentials. |
| Deferred | Intentionally later than this phase. |

## P0 - Finish Before Serious UI Redesign

These are the top functional gaps that affect whether UI work would be honest and durable.

| ID | Function | Current status | Missing work | Owner layer | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| F-P0-001 | Patient signup lifecycle | Built - needs proof | Disposable signup E2E, duplicate/generic error proof, profile provisioning proof, cleanup/disable path. | Patient app, auth service, tenant DB | Browser test creates QA patient, profile exists, wrong role blocked, cleanup is reversible or disabled. |
| F-P0-002 | Patient password reset | Partial | Test inbox or provider-safe reset proof, expired token and weak-password paths. | Patient app, Supabase Auth | Browser test proves request and reset without account enumeration. |
| F-P0-003 | Patient consent gate | Built - needs proof | Browser proof for load failure, retry, accept, revoke/reaccept. | Patient app, tenant config service, tenant DB | Consent fails closed and reaccept clears `revoked_at` in DB. |
| F-P0-004 | Patient profile save | Built - needs proof | Save/restore E2E and field-level rejection proof. | Patient app, patient service, tenant RPC/RLS | Patient can update allowed fields only; DB state is restored after QA run. |
| F-P0-005 | Patient booking and cancellation | Built - needs proof | Real appointment booking/cancel browser E2E with slot cleanup and conflict path. | Patient app, appointment service, `book_slot`, `cancel_appointment` | QA patient books slot, sees confirmation, cancels with reason, slot/appointment postconditions are correct. |
| F-P0-006 | Appointment reschedule | Partial | Atomic design is missing. Current safe model is cancel plus new booking. | Tenant DB/RPC, services, UI | Either add `reschedule_appointment` RPC or UI explicitly shows two separate operations with no false atomic promise. |
| F-P0-007 | Secretary walk-in patient creation | Partial | Current service creates `users`, then `patients`, and hard-deletes the user on failure. Needs transactional RPC or stronger compensation design. | Tenant DB/RPC, patient service, secretary UI | One RPC creates walk-in atomically or failure leaves no orphan without browser hard delete. |
| F-P0-008 | Secretary booking | Built - needs proof | Full secretary create/select patient, slot select, booking, cancel/cleanup E2E. | Clinic-ops, appointment service, tenant RPC | Secretary books QA appointment and cleanup is reversible. |
| F-P0-009 | Staff accepted invite proof | Partial | Email-link acceptance is not automated; accepted staff login/disable/reactivate browser proof is missing. | Edge Functions, staff service, browser smoke | Accepted QA staff logs in, routes correctly, disable blocks access, reactivate restores access. |
| F-P0-010 | Doctor encounter flow | Built - needs proof | Start encounter, save draft, reload draft, discard, complete/cancel E2E. | Clinic-ops, clinical service, tenant RPC/RLS | Doctor completes a QA encounter flow with no PHI in browser storage. |
| F-P0-011 | Lab request draft action | Partial | `DoctorLabRequestPage` still has "Draft feature coming soon". | Clinic-ops, document/clinical service | Either implement draft save through tenant DB or remove/disable the button with clear copy until implemented. |
| F-P0-012 | Control-plane tenant draft browser flow | Built - needs proof | Authenticated browser test for create draft, provider selection, pending domains, runtime config, cancel/compensate. | Control-plane UI/API/DB | QA tenant draft can be created and cancelled/compensated without leaking secrets or PHI. |
| F-P0-013 | No-domain activation path | Partial | Needs full UI proof for Vercel/free-alias active domains, resolver smoke, activation, and rollback. | Control-plane runner, resolver, Vercel aliases | Tenant can work on Vercel/free domains now; `doctoleb.com` rows remain pending. |
| F-P0-014 | Branding sync proof | Built - needs proof | Console update -> tenant DB config -> patient/ops render proof missing. | Control-plane API, tenant DB, app boot | Browser proves theme/logo/brand update renders in tenant app after sync. |
| F-P0-015 | Entitlement enforcement proof | Partial | Core logic exists; insurance gate exists; future AI/BI/reporting/custom-brand/custom-domain gates need server enforcement before features ship. | Core entitlements, tenant DB/API | Disabled feature is hidden in UI and rejected server-side; enabled feature works. |
| F-P0-016 | Role-boundary browser matrix | Built - needs proof | Wrong-role direct route checks for patient, doctor, secretary, predoctor, and control-plane non-admin. | ProtectedRoute, auth service, RLS | Browser proves wrong role fails closed and does not render protected data. |
| F-P0-017 | Logout/cache cleanup | Built - needs proof | Expand current flow smoke into direct logout/back-button/storage assertions for each role. | Apps, auth service, browser smoke | Protected pages redirect after logout and auth/PHI storage keys are gone. |
| F-P0-018 | Public resolver abuse/rate limit coverage | Partial | Control-plane limiter exists; tenant Edge Function coverage and live rate-limit proof are incomplete. | Edge Functions, DB buckets, smoke tests | Resolver/admin functions return safe throttled errors with no PHI/secrets in logs. |
| F-P0-019 | CSP enforcement path | Partial | Report-only exists; strict enforcement is not ready. | Vercel config, browser smoke | Auth, Supabase calls, fonts, print/export, and navigation pass under report-only before enforcement. |
| F-P0-020 | Browser E2E coverage in required mode | Partial | Existing deployed flow smoke is safe/read-only by default. Mutation modes are not required/proven for all flows. | Scripts, GitHub Actions | P0 user flows run with QA records and reversible cleanup in CI or a controlled release workflow. |

## P1 - Finish Before Beta Clinic Pilot

| ID | Function | Current status | Missing work | Owner layer | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| F-P1-001 | Patient medical intake self-service | Partial | Draft/complete/reopen browser proof and catalog validation. | Patient app, intake service, tenant DB | Patient can complete intake; booking gate recognizes completion. |
| F-P1-002 | Patient medical history editing | Partial | Add/update/archive self-reported history entries with RLS proof. | Patient app, intake/history services | Patient can mutate only own allowed history records. |
| F-P1-003 | Patient documents and signed URLs | Partial | Private storage bucket policy proof, signed URL expiry, print/download smoke. | Storage, clinical/document services, patient app | Patient sees only shared documents; URLs expire and do not expose public buckets. |
| F-P1-004 | Patient messaging E2E | Built - needs proof | Create conversation, send/retry message, read receipts, no duplicate by `client_request_id`. | Messaging service, tenant DB, patient/staff UI | Retry returns existing message and no duplicate rows. |
| F-P1-005 | Message attachments | Partial | Upload validation, private storage, orphan cleanup/compensation. | Storage, messaging service, DB policies | Invalid file rejected; valid file private and scoped. |
| F-P1-006 | Secretary patient archive/restore readiness | Partial | Archive browser proof and restore strategy decision. | Patient service, tenant DB, secretary UI | Archive removes from active list; recovery path is defined. |
| F-P1-007 | Slot/template lifecycle | Built - needs proof | Create/edit/deactivate/materialize recurring templates E2E. | Slots/schedules services, tenant DB | No hard delete; booked slot deactivation is blocked safely. |
| F-P1-008 | Billing and payments | Partial | Create bill/payment status transitions, entitlement disabled path, print/export proof. | Payment service, billing UI, tenant DB | Billing works only with allowed plan/feature state and valid state transitions. |
| F-P1-009 | Insurance providers/policies/claims | Partial | Provider/contract/policy/claim lifecycle E2E and claim template safety. | Insurance service, claim UI, tenant DB | Claims and templates validate data and sanitize printable output. |
| F-P1-010 | Predoctor precheck | Partial | Queue, patient context minimization, vitals validation, submit transition proof. | Predoctor UI, precheck service, tenant DB/RLS | Predoctor can submit precheck; doctor can see it; unauthorized fields stay hidden. |
| F-P1-011 | Diagnosis lifecycle | Built - needs proof | Create/edit/archive diagnosis with catalog validation and author rules. | Clinical service, encounter tabs, tenant DB | Doctor can create valid diagnosis; invalid/cross-patient writes fail. |
| F-P1-012 | Prescription lifecycle | Built - needs proof | Enforce prescription preconditions, dose/frequency validation, closed-encounter denial. | Clinical service, encounter tabs, tenant DB | Prescription cannot be created without required clinical preconditions. |
| F-P1-013 | Lab and imaging orders | Built - needs proof | Order create/update status tests and browser flow. | Clinical service, encounter tabs, DB | Orders are scoped to encounter/patient and validate required fields. |
| F-P1-014 | Clinical documents lifecycle | Built - needs proof | Draft/finalize/void/browser print proof. | Clinical service, documents UI, DB/RPC | Finalized docs become patient-visible only when policy allows; void keeps reason. |
| F-P1-015 | Care tasks | Built - needs proof | Create/transition/reassign with state machine tests. | Clinical service, care task UI, DB | Invalid transitions fail; allowed transitions audit actor/time. |
| F-P1-016 | Tenant settings from clinic ops | Partial | Doctor-facing tenant settings must not conflict with SaaS control-plane authority. | Clinic-ops, control-plane, tenant config | Decide which fields clinic doctor can edit versus SaaS-only fields. |
| F-P1-017 | Safe error normalization everywhere | Partial | Some pages/hooks may still use direct `error.message`. | Core error helper, UI pages/hooks | Visible flows use consistent string/object error handling. |
| F-P1-018 | Large page cleanup after proof | Partial | Multiple pages exceed healthy review size. | React pages/hooks/components | Pages compose; hooks own state; services own business rules; tests stay green per slice. |

## P2 - Finish Before Multi-Clinic Scale

| ID | Function | Current status | Missing work | Owner layer | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| F-P2-001 | Fully automatic Supabase project creation | Deferred | Provider token storage, cost controls, org/region selection, rollback, and management API runner. | Control-plane provider executor | Super-admin can create a new project only after cost/scope confirmation and compensation design. |
| F-P2-002 | Vercel project/env/domain automation | Deferred | Real project/env/custom-domain mutation through Vercel API. | Control-plane provider executor, Vercel | Env/domain changes record previous values and redeploy requirements. |
| F-P2-003 | Real `doctoleb.com` activation | Manual/provider-blocked | Buy domain, DNS, Vercel domain attach, SSL verification, row activation. | Vercel/domain/DNS/control-plane | Real domain switch is a config/runbook action, not a rewrite. |
| F-P2-004 | Stripe production billing | Deferred | Checkout, webhooks, subscription states, entitlement mapping, failed payment handling. | Billing provider, control-plane DB, entitlements | Stripe webhooks drive feature grants/revokes safely. |
| F-P2-005 | Junior doctor role | Deferred | Role semantics, RLS, routes, sign-off model, dashboard, tests. | Product, DB/RLS, clinic-ops | Role is not visible until sign-off and permissions are proven. |
| F-P2-006 | Flutter patient app | Deferred | Shared API contract tests and mobile storage/push/session rules. | Flutter app, core contracts, tenant APIs | Flutter uses the same backend contracts as patient web. |
| F-P2-007 | Notification preferences and push worker | Partial | Preference schema, device lifecycle UI, worker/provider integration. | Notification service, DB, patient app/mobile | Preferences control delivery and device tokens are scoped to owner. |
| F-P2-008 | Observability and alerting | Partial | Sentry/Vercel telemetry, dashboards, alerts, no-PHI event audit. | Logger, Vercel/Sentry, Edge Functions | Errors are visible without logging PHI/secrets. |
| F-P2-009 | Backup/restore/incident readiness | Not built | Backup policy, restore drill, incident runbooks, provider credential rotation. | Ops/runbooks/Supabase | Restore drill is executed and documented. |
| F-P2-010 | Performance and accessibility proof | Partial | Lighthouse, Core Web Vitals, resolver load, DB query plan review, keyboard/screen-reader audits. | Frontend, backend, DB | Budgets and accessibility checks are part of release gates. |
| F-P2-011 | Schema dump and ERD artifacts | Partial | Generate current schema dump and ERD from local/branch DB. | Docs/DB | Artifacts label control-plane metadata vs tenant clinical data. |

## Code Smells To Resolve Before UI Migration

These are not all production blockers, but they are risky before a component-system redesign.

| ID | Evidence | Risk | Required action |
| --- | --- | --- | --- |
| Q-001 | `apps/clinic-ops/src/pages/AppointmentsPage.jsx` is over 1300 lines. | UI state, calendar logic, actions, and rendering are hard to review. | Split after E2E baseline into hooks, calendar components, action services. |
| Q-002 | `apps/clinic-ops/src/pages/PatientsPage.jsx` is over 800 lines. | Walk-in creation/archive behavior is mixed with UI composition. | Move create/archive flow into hook/service/RPC slice. |
| Q-003 | `apps/clinic-ops/src/pages/CreateBillPage.jsx` and `BillingPage.jsx` are large. | Billing rules can drift into UI. | Keep entitlement/business logic in services; split form/list/print. |
| Q-004 | `DoctorLabRequestPage` has "Draft feature coming soon". | Production path exposes unfinished action. | Implement or remove/gate the draft button before redesign. |
| Q-005 | Several UI pages still own complex form calculation/state. | Design migration may duplicate logic. | Extract reusable hooks before shadcn/component migration. |
| Q-006 | Browser mutation proof is partial. | New UI may look complete while core flows are unproven. | Make mutation E2E safe and reversible first. |

## Recommended Next Functional Slices

These are ordered so each slice leaves the system more production-ready and gives future UI designers stable states to design.

| Order | Slice | Why first | Verification |
| --- | --- | --- | --- |
| 1 | Remove/implement unfinished lab draft action | It is a visible unfinished function. | Unit/build plus manual route check. |
| 2 | Transactional walk-in patient creation | It fixes a real backend atomicity weakness before secretary UI redesign. | Service test plus DB/RPC contract. |
| 3 | Patient booking/cancel E2E mutation mode | Booking is the core patient value loop. | Playwright QA appointment with cleanup. |
| 4 | Staff accepted invite proof | Staff onboarding must be real before polishing doctor staff UI. | Browser login/disable/reactivate proof. |
| 5 | Doctor encounter draft/start/complete proof | This is the core clinical value loop. | Browser encounter E2E with DB draft assertions. |
| 6 | Control-plane tenant creation proof | Tenant creation must be easy before redesigning the console. | Browser QA tenant draft, step run, cancel/compensate. |
| 7 | Branding and entitlement sync proof | These directly affect future theming/UI design. | Console update -> tenant DB -> patient/ops render. |
| 8 | Large-page cleanup | Once flows are protected, UI refactor is safer. | Targeted tests/build after each file slice. |

## Design-System Readiness Gate

Before starting Stitch/Claude Designer/21st MCP/shadcn implementation work, mark each line:

| Gate | Required state |
| --- | --- |
| Patient app | Booking, consent, profile, logout, and basic messaging are functionally proven or explicitly deferred. |
| Clinic ops | Staff onboarding, secretary booking, walk-in patient, encounter, and schedule flows are functionally proven or explicitly deferred. |
| Control plane | Tenant draft/provisioning/cancel/compensate and branding/entitlement sync are functionally proven or explicitly deferred. |
| Components | Large pages have extraction plans so new UI components do not absorb business rules. |
| Security | No service-role/provider secret in browser, no PHI in control plane/logs/artifacts, no browser hard DELETE. |
| QA | Browser tests capture the old behavior before visual redesign begins. |

## Manual And Deferred Items

These should stay visible, but they should not block functional slices that can be done now.

| Item | Status | Note |
| --- | --- | --- |
| Supabase leaked-password protection | Manual/provider-plan deferred | Current Supabase plan does not support it; keep in launch readiness. |
| Real custom domain | Manual/provider deferred | Vercel aliases are the no-domain production placeholder. |
| Email-link invite acceptance | Provider-blocked unless test inbox exists | Use accepted QA staff account if inbox is unavailable. |
| Full Supabase Management API automation | Deferred | Needs token storage, org/region/cost controls, and rollback design. |
| Stripe production billing | Deferred | Entitlement backbone exists, but live charging is later. |
| Flutter | Deferred | Patient web contracts should stabilize first. |
