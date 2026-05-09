# DoctoLeb Patient And Staff Action Contracts

Date: 2026-05-09
Scope: top patient and clinic-staff actions that must be production-ready across patient web now and Flutter patient app later.
Status: contract and implementation roadmap. This document does not claim every action is fully proven today; it defines what "ready" means and where each action belongs.

## Purpose

This is the behavioral contract for the most important day-to-day actions in DoctoLeb. It exists so React web, future Flutter, Supabase RLS/RPCs, Edge Functions, QA, and product decisions all point to the same source of truth.

The rules are strict:

- Patient web and future Flutter must use the same backend contracts and return envelopes.
- Clinic staff pages must call shared services/hooks, not raw Supabase from UI.
- Business rules live in schemas, services, RPCs, Edge Functions, RLS, constraints, and state machines.
- UI owns rendering, local form state, affordances, and accessibility only.
- Every create or mutation action must support cancel, archive, disable, rollback, retry, or compensation.
- Errors must fail closed for auth, tenant resolution, consent, PHI, entitlement, and role-boundary cases.
- Tests must prove the action at the smallest layer possible, then browser or device flows prove the real user path.

## Evidence Scanned

- Product and architecture: `PRODUCT.md`, `SYSTEM_DESIGN_DEEP_DIVE.md`, `SAAS_FOUNDATION_PHASE_HANDOFF.md`.
- QA and risk docs: `FULL_FLOW_QA_CONFIDENCE_MATRIX_20260509.md`, `FULL_FLOW_180_POINT_EXAMINATION_20260509.md`, `DESIGN_CODE_SECURITY_GAP_REVIEW_20260509.md`.
- App routes: `apps/patient-web/src/App.jsx`, `apps/clinic-ops/src/App.jsx`.
- Core service contracts: `packages/core/services/*`, `packages/core/schemas/index.js`, `packages/core/lib/stateMachines.js`, `packages/core/lib/selects.js`, `packages/core/lib/roles.js`.
- Tenant DB tests and policies: `supabase/tests/pgtap_rls.sql`, `supabase/sql/backend_contract_audit.sql`, `supabase/migrations/*`.

## Shared Readiness Standard

Each action reaches production-ready only when all applicable checks pass:

| Layer | Required proof |
| --- | --- |
| Product | The action maps to a real clinic/patient job and has a clear owner role. |
| UX | User can find the action, understand the state, recover from errors, and complete it with keyboard/mobile-friendly controls. |
| Boundary validation | Inputs are validated by shared schemas or API boundaries before mutation. |
| Authorization | Role and ownership are enforced server-side by RLS, RPCs, Edge Functions, or Supabase Auth. |
| Data integrity | DB constraints, indexes, idempotency keys, and state machines protect invariants. |
| Reversibility | Mutation has a cancel/archive/disable/void/retry/compensate path and enough audit data for undo. |
| Error handling | Validation, auth, not found, conflict, inactive tenant, network, and retry cases return stable user-safe errors. |
| Tests | Unit/service tests, DB/RLS tests, browser E2E, and later Flutter contract tests cover the successful and failed paths. |

## Cross-Platform Patient Contract

The future Flutter patient app must not invent new clinical business logic. It should consume the same tenant resolution model, auth model, patient profile contract, booking contract, messaging contract, consent contract, and document access rules as patient web.

Implementation boundary:

| Concern | Owner |
| --- | --- |
| Tenant routing | `tenant-resolve` control-plane Edge Function plus `tenantResolverService`. |
| Patient auth/session | Supabase Auth plus shared auth/profile helpers. |
| Patient action contracts | `packages/core/services/*` and tenant DB RPCs. |
| Patient UI state | Patient web pages now; Flutter view models later. |
| PHI authorization | Tenant DB RLS/RPCs, never client-side hiding only. |
| Mobile-specific device behavior | Device registration and push preferences through shared patient-device APIs. |

## Top 30 Patient Actions

| ID | Action | Use case and UX steps | Preconditions | Postconditions and undo | Error handling | Contract and test requirements |
| --- | --- | --- | --- | --- | --- | --- |
| P-001 | Resolve tenant and load clinic-branded app | Patient opens tenant URL; app resolves host, loads branding, shows clinic front door or portal. | Host is known, tenant active, surface is patient. | Runtime config and safe public branding are available to the app. No PHI returned by resolver. | Unknown host -> `TENANT_NOT_FOUND`; wrong surface -> `SURFACE_MISMATCH`; inactive/pending -> blocked state; resolver down -> retry state. | Unit resolver tests, resolver HTTP smoke, browser boot smoke, no service-role marker scan. |
| P-002 | View public clinic landing page | Patient understands the clinic, doctor identity, location/contact, and patient CTAs. | Tenant public config active. | No account is created; user chooses signup/login/contact. | Missing branding falls back to safe configured defaults, not DoctoLeb SaaS buyer copy. | Browser desktop/mobile smoke, copy audit, accessibility pass. |
| P-003 | Register patient account | Patient enters email, password, name, phone, and required minimal profile fields. | Tenant active, signup enabled, no active authenticated patient session. | Supabase Auth user and patient/user profile are provisioned or the flow fails without partial orphan state. | Invalid email/password, duplicate account, weak password, profile provisioning timeout, tenant inactive. | Schema unit tests, auth signup E2E with disposable user, cleanup/disable path, no account enumeration. |
| P-004 | Confirm session/profile provisioning | After signup/login, patient lands on the right dashboard only after profile exists. | Supabase session exists. | `users` and `patients` relation exists and role is `patient`. | Provisioning delay shows retry/loading; wrong role fails closed; inactive user signs out. | Auth identity unit tests and browser redirect tests. |
| P-005 | Log in | Patient enters credentials and reaches patient dashboard. | Tenant active, patient account active. | Session active; app user built with patient profile. | Invalid credentials use generic message; wrong staff role blocked from patient surface. | Deployed auth smoke and negative login smoke. |
| P-006 | Request password reset | Patient requests reset email without exposing whether an account exists. | Tenant active and Supabase Auth email configured. | Reset email flow starts if account exists; response is generic. | Invalid email, rate limit, email service failure. | Browser validation and email-loop test with test inbox. |
| P-007 | Complete password reset | Patient follows reset link and sets a valid new password. | Valid reset token/session. | Password changed; old password no longer works. | Expired token, weak password, mismatch, replayed token. | Auth integration test with disposable user. |
| P-008 | Accept required consent | Patient sees required legal/clinic consent and accepts before PHI portal actions. | Active required consent document exists. | `patient_consents` records acceptance; reaccept clears `revoked_at`. | Load error fails closed with retry; missing required consent blocks portal; revoke/reaccept handled. | Consent unit tests plus browser gate test for error, retry, accept, reaccept. |
| P-009 | View dashboard | Patient sees upcoming appointment, action reminders, messages, and safe empty states. | Authenticated patient with accepted required consent. | Dashboard reads scoped data only. | Empty state, expired session, RLS denial, network failure. | Browser authenticated smoke with data and empty fixtures. |
| P-010 | Update own profile | Patient edits name, phone, DOB, sex, blood type, allergies, emergency contact. | Authenticated owner; required consent accepted. | `users` and `patients` update atomically through RPC where available; updated profile returned. | Validation errors, not owner, conflict, RPC unavailable, partial update failure. | Service tests, RLS owner tests, browser save-and-rollback test. |
| P-011 | Manage emergency and insurance summary | Patient adds emergency contact and high-level policy information allowed for self-service. | Authenticated owner; feature enabled if advanced insurance is gated. | Patient-facing fields updated; sensitive claim/admin fields untouched. | Invalid phone/policy, unsupported provider, entitlement disabled. | Schema tests and RLS field restriction tests. |
| P-012 | View available slots | Patient picks doctor/date and sees available slots only. | Tenant active; doctor has active slots; patient can book. | Read-only availability returned; no slot consumed. | No slots, stale availability, timezone mismatch, inactive doctor. | Slot service tests, timezone tests, browser availability state. |
| P-013 | Book appointment | Patient selects slot, reason, visit type if required, then confirms. | Authenticated patient, consent accepted, intake gate satisfied, slot active/unbooked. | Atomic `book_slot` consumes slot and creates appointment. Notifications are non-blocking. | Slot taken conflict, intake required, invalid reason, network failure after successful booking returns partial success with appointment ID. | RPC/DB concurrency tests, browser booking E2E, rollback cleanup. |
| P-014 | View booking confirmation | Patient sees date/time/doctor/status and next steps after booking. | Booking succeeded or partial success has appointment ID. | Confirmation is displayed and appointment appears in upcoming list. | Fetch-after-booking failure shows safe partial success and refresh option. | Browser DOM assertion after booking. |
| P-015 | Cancel appointment | Patient cancels eligible appointment with reason. | Appointment belongs to patient and status allows cancellation. | Status becomes `cancelled`; reason appended to notes/audit-safe metadata. | Not found, already started/completed, too late to cancel if policy added, network failure. | State-machine tests, RLS owner tests, browser cancel E2E. |
| P-016 | Request reschedule | Patient changes appointment by selecting a new slot; current production-safe model is cancel plus new booking unless atomic reschedule RPC is added. | Existing appointment cancellable; new slot available. | Either both old cancellation and new booking succeed through future atomic RPC, or UI clearly performs two separate confirmed steps. | New slot conflict, old appointment not cancellable, partial failure. | Must add atomic RPC or explicit two-step browser tests before production reschedule. |
| P-017 | Complete intake questionnaire | Patient enters lifestyle, allergy, disease, surgery, vaccination, and family history data when self-service is enabled. | Authenticated owner; consent accepted; catalogs available. | Intake saved as draft or completed; booking gate can pass after completion. | Missing required values, unsupported catalog item, save conflict, network retry. | Intake schema tests, RLS tests, browser draft/complete tests. |
| P-018 | Edit medical history entries | Patient updates allowed self-reported history entries. | Authenticated owner; entry belongs to patient; status permits patient edits. | Entry updated or archived softly; audit fields preserve actor and time. | Not owner, invalid catalog, archived entry, concurrent edit. | Service tests for add/update/archive and RLS owner matrix. |
| P-019 | View upcoming and past appointments | Patient reviews appointment history and statuses. | Authenticated owner. | Only own appointments are visible, paginated and sorted. | Empty history, RLS denial, pagination boundary. | RLS matrix, pagination tests, browser list states. |
| P-020 | View medical history summary | Patient sees clinical summaries allowed for patient access. | Authenticated owner; documents/records are patient-visible. | Read-only PHI rendered safely. | No records, restricted record type, expired session. | RLS visibility tests, browser empty/data states. |
| P-021 | View clinical documents | Patient sees reports/certificates/documents shared by clinic. | Authenticated owner; document finalized or patient-visible. | Document metadata shown; attachment access remains signed/private. | Missing attachment, archived/voided document, unauthorized document. | Storage RLS tests and signed URL tests. |
| P-022 | Download or print allowed document | Patient opens short-lived signed URL or safe print view. | Document access authorized. | Short-lived URL generated; no public bucket leakage. | Expired URL, forbidden file, storage failure. | Signed URL expiry test, browser print/download smoke, no active content in print. |
| P-023 | Start message conversation | Patient creates patient-staff conversation with optional first message. | Authenticated owner; messaging feature enabled; consent accepted. | Conversation row, participant row, optional message created; returns recoverable partial result if follow-up fails. | Missing patient/user ID, validation error, participant failure, message failure. | Service unit tests and browser conversation creation E2E. |
| P-024 | Send message idempotently | Patient sends message with `client_request_id`. | Conversation belongs to patient; participant exists. | Message inserted once; retry with same client request ID returns existing message. | Empty body, duplicate client ID, RLS denial, network retry. | Unit duplicate retry test, DB unique index test, browser retry test. |
| P-025 | Attach file to message | Patient uploads allowed file type/size and attaches it to message if enabled. | Message/conversation authorized; storage feature enabled. | Private storage object and attachment row created; signed URL used for read. | File too large/type denied, upload failure, orphan cleanup needed. | Upload validation, storage policy tests, cleanup/compensation test. |
| P-026 | Mark messages/read notifications | Patient opens messages/notifications and read state updates. | Authenticated owner. | Read receipt upserted idempotently. | Missing message, not participant, network failure. | Upsert idempotency tests and browser unread count test. |
| P-027 | Register web/mobile device | Patient grants notifications; app stores web or future mobile push token. | Authenticated owner; platform token present. | `patient_devices` row upserted against own patient/user only. | Spoofed patient ID, invalid token, duplicate device, push permission denied. | RLS spoofing test already covered in pgTAP; add browser/mobile permission tests. |
| P-028 | Manage notification preferences | Patient changes communication preferences where supported. | Authenticated owner; preference table/fields exist. | Preferences saved and future notifications respect them. | Invalid channel, unsupported region, opt-out conflict. | Requires explicit preference schema before production. |
| P-029 | View billing/payment status | Patient sees invoices/payments allowed for patient access. | Authenticated owner; billing feature enabled. | Payment list/status visible; no staff-only billing controls exposed. | Entitlement disabled, no invoices, payment provider failure. | RLS tests and browser billing read-only smoke. |
| P-030 | Log out and clear session state | Patient signs out and local sensitive state is cleared. | Active session. | Supabase session cleared; protected pages redirect; PHI drafts/cache cleared or inaccessible. | Network sign-out failure, stale back-button cache, multi-tab state. | Browser logout/back-button test and storage cleanup assertion. |

## Top 30 Staff Actions

Current v1 staff roles are `doctor`, `secretary`, and `predoctor`. The requested "junior doctor" role must not be enabled as a string until it has its own route model, RLS policies, allowed actions, sign-off rules, and tests. Until then, junior-doctor-like workflow is treated as a future clinical role, not the existing `predoctor` role.

| ID | Action | Primary actor | Use case and UX steps | Preconditions | Postconditions and undo | Error handling | Contract and test requirements |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S-001 | Resolve ops tenant and load staff app | All staff | Staff opens ops host and app resolves tenant/surface before login. | Host known, tenant active, surface is ops. | Ops app receives safe tenant config; no PHI before auth. | Wrong surface, inactive tenant, resolver down, missing env. | Resolver smoke, browser ops boot smoke, wrong-surface visual test. |
| S-002 | Staff login and role routing | Doctor, secretary, predoctor | Staff signs in and lands on role home. | Active Supabase Auth user with active profile/staff assignment. | Doctor -> doctor dashboard; secretary -> secretary dashboard; predoctor -> predoctor dashboard. | Invalid credentials, inactive staff, missing assignment, patient on ops surface. | Auth smoke per role, wrong-role route matrix. |
| S-003 | View role dashboard | All staff | User sees queue, schedule, alerts, and next actions for role. | Authenticated and authorized. | Scoped summary data loaded. | Empty state, RLS denial, expired session. | Browser post-login dashboard assertions. |
| S-004 | Search patient records | Secretary, doctor, predoctor limited | Staff searches by name, phone, email, or identifier. | Authorized role; query length and sanitization pass. | Paginated patient results returned according to role scope. | Empty query, no results, injection-like input, RLS denial. | Search sanitization tests, pagination tests, browser search test. |
| S-005 | Create walk-in patient | Secretary | Front desk creates patient without portal account for walk-in booking. | Secretary active; required fields valid. | User row and patient row created or transaction/compensation removes orphan. | Duplicate identity, invalid phone/name, partial insert failure. | Move to RPC or prove compensation; browser create-and-archive E2E. |
| S-006 | Update patient demographics | Secretary, doctor if allowed | Staff corrects demographics/contact fields. | Patient exists; actor role permits fields. | Allowed fields updated; clinical fields untouched unless role permits. | Invalid values, field not allowed, concurrent edit. | Field-level schema/RLS tests and browser save test. |
| S-007 | Archive patient record | Doctor or authorized clinic admin, secretary if policy allows | Staff removes patient from active operational lists without hard deleting PHI. | Patient exists; actor has archive permission; reason captured. | `is_archived=true`, audit fields set; restore-ready state preserved. | Patient has active visit/financial blocker, unauthorized, already archived. | No public DELETE policy invariant, archive/restore-ready tests. |
| S-008 | Manage appointment slots | Secretary, doctor | Create or deactivate doctor availability. | Doctor exists; slot time valid; no overlap unless policy allows. | Slot active or deactivated; no hard delete. | Overlap, invalid time, booked slot deactivation conflict. | Slot service tests, DB indexes, browser create/deactivate test. |
| S-009 | Materialize recurring schedule | Doctor, secretary | Generate slots from schedule templates. | Template active; date range valid. | Slots created idempotently; duplicate materialization avoided. | Invalid range, duplicate conflict, timezone issue. | Idempotency tests, timezone tests, browser template flow. |
| S-010 | Book appointment for patient | Secretary | Search/select or create patient, choose slot, confirm booking. | Patient exists, slot available, intake gate passes or exception policy exists. | Appointment created atomically from slot. | Slot taken, intake required, validation failure, partial fetch failure. | RPC concurrency tests and browser secretary booking E2E. |
| S-011 | Cancel or reschedule appointment | Secretary, doctor | Staff cancels with reason or reschedules through approved flow. | Appointment status permits transition. | Status changed; reason retained; new booking created only if reschedule is explicit/atomic. | Invalid transition, already in consultation/completed, conflict. | State-machine tests and browser cancel/reschedule tests. |
| S-012 | Manage billing item or invoice | Secretary | Create bill/payment for services rendered. | Patient/appointment exists; billing entitlement enabled. | Payment row created/updated with valid state. | Missing amount, invalid status transition, entitlement disabled. | Payment schema tests, entitlement backend gate, browser billing E2E. |
| S-013 | Manage insurance providers/contracts | Secretary | Maintain accepted providers and doctor contract codes. | Insurance feature enabled; doctor/clinic context active. | Provider contract created/updated/archived. | Duplicate contract, invalid provider code, inactive provider. | Service tests and browser provider flow. |
| S-014 | Manage patient insurance policy | Secretary | Add/update patient policy for claims. | Patient exists; provider exists; policy fields valid. | Policy saved; primary policy uniqueness preserved. | Duplicate primary policy, invalid dates, unauthorized patient. | DB uniqueness/RLS tests and browser policy flow. |
| S-015 | Manage claim templates and claims | Secretary, doctor review | Generate claim documents from safe placeholders. | Insurance billing enabled; template active; claim data complete. | Claim draft/submitted state updated; template HTML sanitized. | Missing placeholders, unsafe HTML, invalid transition. | Template validation, XSS/print safety tests, browser claim flow. |
| S-016 | Manage medical intake draft | Secretary | Front desk records lifestyle and patient-history data before visit. | Patient exists; actor role permits intake. | Intake saved as draft with `patient_id` unique upsert. | Validation errors, catalog missing, save conflict. | Intake service tests and browser draft save. |
| S-017 | Complete or reopen intake | Secretary, doctor | Mark intake complete or reopen with reason. | Draft exists for patient; required fields satisfied; actor authorized. | Status completed or reopened with actor/time/reason. | Missing draft, invalid transition, unauthorized. | State/validation tests and DB integration test. |
| S-018 | View predoctor queue/schedule | Predoctor | See today's appointments needing precheck. | Predoctor active; schedule data scoped. | Read-only queue loads with patient minimum necessary data. | Empty queue, unauthorized fields, date/timezone issue. | Field-minimization/RLS tests and browser queue test. |
| S-019 | Open patient precheck context | Predoctor | Select appointment/patient and view safe context for triage. | Appointment assigned or visible to predoctor role. | Patient context displayed with only allowed details. | Missing patient, wrong appointment, unauthorized PHI. | Predoctor RLS field tests and browser context test. |
| S-020 | Capture vitals and precheck draft | Predoctor | Enter vitals, symptoms, notes, and urgency markers. | Appointment/patient exists; fields valid ranges. | Precheck draft saved; abnormal flags calculated by service/RPC rules, not UI-only. | Out-of-range values, missing required fields, save failure. | Validation/range tests and browser draft test. |
| S-021 | Submit precheck to doctor | Predoctor | Finalize precheck and move appointment to doctor-ready queue. | Draft valid; appointment status allows precheck. | Precheck submitted, appointment status `pre_check`, doctor notification queued. | Invalid transition, notification failure non-blocking, duplicate submit idempotent. | Appointment state tests, notification non-blocking test, browser submit E2E. |
| S-022 | View doctor schedule and appointments | Doctor, future junior doctor with limited scope | Doctor sees today's queue and appointment states. | Doctor active; schedule exists. | Scoped appointments displayed; no cross-doctor leak. | Empty state, RLS denial, stale status. | Doctor RLS tests and authenticated browser schedule test. |
| S-023 | Open patient chart | Doctor, future junior doctor limited | Doctor opens chart from appointment/patient list. | Doctor has relationship through appointment or policy. | Chart context loads patient, history, documents, tasks, messages according to role. | Wrong patient, cross-doctor access denied, archived patient. | RLS matrix and browser chart context test. |
| S-024 | Start encounter | Doctor | Begin clinical encounter for appointment. | Appointment eligible; no active conflicting encounter; doctor authorized. | Encounter created or existing active encounter returned idempotently; appointment moves in consultation. | Invalid appointment status, duplicate active encounter, unauthorized. | RPC tests and browser start encounter E2E. |
| S-025 | Add clinical note | Doctor, future junior doctor draft-only | Record clinical note during encounter. | Active encounter; actor can author note; note content valid. | Note saved with author identity; drafts must not persist in long-lived browser storage. | Empty note, wrong author spoof, encounter closed, save failure. | Clinical note schema/RLS tests, no localStorage test, browser save/discard test. |
| S-026 | Add diagnosis | Doctor, future junior doctor requires sign-off if enabled | Add diagnosis tied to encounter/patient. | Active encounter; disease catalog available; doctor authorized. | Diagnosis row created/updated with actor and status. | Invalid catalog, duplicate primary rules if added, closed encounter. | Service tests, RLS author tests, browser diagnosis flow. |
| S-027 | Prescribe medication | Doctor only until junior sign-off model exists | Add medication order after diagnosis rule passes. | Encounter active; diagnosis exists if required; doctor authorized. | Prescription created in draft/active state. | Missing diagnosis, invalid dose/frequency, closed encounter. | Schema tests, completion rule tests, browser prescription flow. |
| S-028 | Order lab or imaging | Doctor, future junior draft-only if enabled | Create lab/imaging order from encounter. | Encounter active; required title/type valid. | Order row created with status and actor. | Invalid order kind, missing required field, closed encounter. | Order service tests and browser order flow. |
| S-029 | Create, finalize, print, or void documents | Doctor | Create report/certificate/referral/claim-related document and finalize/void through lifecycle. | Draft document exists; required content complete; actor authorized. | Finalized document becomes patient-visible if policy allows; void preserves reason. | Unsafe HTML, finalizing incomplete document, invalid transition. | Document lifecycle RPC tests, print safety tests, browser print smoke. |
| S-030 | Manage staff access | Doctor/main doctor | Invite secretary/predoctor, update metadata, disable/cancel access; future junior doctor requires new role design first. | Doctor authorized; role is supported; email valid. | Staff invite created through Edge Function; disable/cancel is reversible/audited. | Unsupported role, duplicate invite, inactive doctor, Auth failure, direct browser mutation blocked. | Edge Function tests, DB rollback probes, browser invite/disable E2E, accepted invite login proof. |

## Required Junior Doctor Design Before Enabling

Do not re-add `junior_doctor` to `SUPPORTED_STAFF_MEMBER_ROLES` until this design is finished:

| Requirement | Required decision |
| --- | --- |
| Role name | Decide whether it is `junior_doctor`, `assistant_doctor`, or a doctor permission level. |
| Clinical authority | Decide if the role can sign notes, diagnoses, prescriptions, orders, and documents, or only draft them. |
| Main-doctor supervision | Define sign-off fields such as `supervising_doctor_id`, `signed_off_by`, `signed_off_at`, and rejection reason where needed. |
| RLS | Add policies that allow limited draft access without granting full doctor authority. |
| UI | Add dedicated dashboard/routes or explicit doctor-page limited mode. |
| Audit | Every sign-off and rejection must be auditable. |
| Tests | Wrong-role route tests, RLS tests, lifecycle tests, and browser flows must pass before the role is visible. |

## Implementation Order

The action list is intentionally larger than one sprint. Build it in vertical slices so each band ends in a working, tested system.

| Band | Goal | Actions to make production-ready first |
| --- | --- | --- |
| First 20 percent | Safe access and visit creation | P-001 to P-015, S-001 to S-011, S-030. |
| Next 20 percent | Intake, precheck, and core chart | P-016 to P-020, S-016 to S-026. |
| Next 20 percent | Messaging, documents, billing | P-021 to P-029, S-012 to S-015, S-027 to S-029. |
| Next 20 percent | Mobile/device readiness and resilience | P-027, P-028, P-030, cross-platform contract tests, logout/cache, push/device handling. |
| Final 20 percent | Advanced roles and scale hardening | Junior doctor design, accessibility, performance, observability, backup/restore drills, load tests. |

## Test Matrix To Build

| Test suite | Must cover |
| --- | --- |
| Unit | Schemas, state transitions, entitlement decisions, error normalization, display helpers, URL normalization. |
| Service | `{ data, error }` envelopes, validation failures, idempotent retries, partial-success behavior, no raw service-role leakage. |
| DB/RLS | Patient owner access, staff role scope, cross-patient denial, cross-doctor denial, no public hard DELETE, allowed RPC grants. |
| Browser E2E | Patient signup/login/consent/profile/booking/messages/logout; secretary patient/slot/booking/billing; predoctor precheck; doctor encounter/document/staff invite. |
| Deployed smoke | Vercel patient/ops/control-plane boot, tenant resolver HTTP, auth smoke, bundle secret audit, control-plane CORS. |
| Flutter contract later | Same request/response contracts as patient web for auth profile, consent, appointments, messages, documents, devices. |

## Open Engineering Gaps From This Contract

| Gap | Why it matters | Next action |
| --- | --- | --- |
| Live DB contract secrets missing in GitHub | CI intentionally fails until pgTAP/anon-RPC checks can run against safe DB envs. | Add `BACKEND_TEST_DATABASE_URL`, `BACKEND_TEST_SUPABASE_URL`, `BACKEND_TEST_SUPABASE_ANON_KEY`. |
| Patient signup/reset not fully live-proven | Account lifecycle is a production gate. | Add disposable-user browser E2E and cleanup. |
| Walk-in patient creation still needs stronger atomicity proof | Current compensation deletes a user row on failure; production should prefer RPC transaction or explicit archive compensation. | Add transactional RPC or integration test proving no orphan state. |
| Reschedule needs atomic design | Cancel plus rebook can partially fail. | Add `reschedule_appointment` RPC or keep explicit two-step UX with no false atomic claim. |
| Clinical drafts still need long-term server-side design | Browser session storage is mitigation, not final PHI-safe draft architecture. | Add tenant DB draft table/RPC with TTL and discard semantics. |
| Junior doctor role is not ready | Role string without routes/RLS is unsafe. | Complete junior doctor design before enabling. |
| Mobile push/preferences not fully modeled | Flutter needs device and notification contracts. | Finalize `patient_devices` and preference schema/API. |
| Full browser E2E coverage is incomplete | Many actions have source/contracts but not user-flow proof. | Build the suites in the band order above. |

## Definition Of Done For Any New Action

Before adding any action to production navigation:

1. The action has an ID in this document or a successor spec.
2. Preconditions, postconditions, failure states, and undo/compensation are documented.
3. UI calls a hook/service; no raw Supabase or business-rule mutation lives in the page.
4. Shared schema validates boundary input.
5. Server-side authorization is proven by RLS/RPC/Edge Function tests.
6. Unit/service tests pass.
7. Browser E2E covers success and at least one blocked/error path.
8. The action appears in the QA confidence matrix with current evidence.
