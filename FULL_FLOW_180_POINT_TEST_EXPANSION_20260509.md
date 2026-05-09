# DoctoLeb 180-Point Granular Test Expansion

Date: 2026-05-09
Scope: patient web, clinic ops, SaaS control plane, tenant resolver, Supabase tenant DB, Supabase control-plane DB, Vercel deployment, CI/CD, browser QA, and operational readiness.
Purpose: expand the earlier broad confidence matrix into a granular checklist that can become Playwright, API, DB, unit, and manual ops tests without rethinking the scope.

This document is not a claim that all 180 points are already proven. It is the next test inventory. Each point is intentionally small enough to be executed, automated, assigned, and reviewed independently.

## Execution Rules

| Rule | Requirement |
| --- | --- |
| Evidence first | A point is complete only when a screenshot, Playwright trace, API response, DB assertion, unit test, CI log, or documented manual proof exists. |
| Fail closed | Auth, consent, PHI access, tenant routing, payments, entitlements, and admin actions must deny access on uncertainty. |
| No UI-only security | UI hiding can improve UX, but backend, Edge Functions, RLS, or DB constraints must enforce protected behavior. |
| Reversible design | Create/provision/mutate flows must preserve audit state and support cancel, deactivate, archive, retry, rollback, or compensation. |
| Zero-PHI control plane | Control-plane tests must verify SaaS metadata only. No patient charts, clinical notes, messages, documents, diagnoses, or PHI logs. |
| Domain optional now | Vercel preview/production domains and localhost must work before `doctoleb.com` is purchased. Real domain rows stay pending until DNS/SSL ownership is verified. |

## Evidence Types

| Type | Meaning |
| --- | --- |
| playwright | Real browser check with DOM assertions, console capture, trace, and screenshot when useful. |
| api | HTTP or Edge Function contract check using stable `{ data, error }` envelopes. |
| db | SQL, RLS, constraint, policy, trigger, RPC, index, migration, or Supabase MCP assertion. |
| unit | Fast unit or contract test in repo. |
| ci | GitHub Actions or deployment workflow evidence. |
| manual | Human-reviewed security, UX, copy, dashboard, DNS, or recovery operation. |
| ops | Vercel, Supabase dashboard, backups, logs, alerts, domains, secrets, or incident drill evidence. |

## A. Patient Public And Auth, T-001 To T-018

| ID | Perspective | Target | Test point | Evidence | Priority |
| --- | --- | --- | --- | --- | --- |
| T-001 | UI/UX, Business | Patient landing root | Page copy presents the clinic or doctor brand, not DoctoLeb SaaS sales copy. | playwright, manual | P0 |
| T-002 | UI/UX | Patient landing hero | Hero title, subtitle, primary CTA, and secondary CTA remain visible on desktop. | playwright | P1 |
| T-003 | UI/UX | Patient landing mobile | Landing page stacks cleanly on mobile with no clipped CTA or horizontal scroll. | playwright | P1 |
| T-004 | Business, UX | Patient registration CTA | Registration CTA routes to the patient registration surface, not staff or SaaS admin. | playwright | P0 |
| T-005 | Business, UX | Patient login CTA | Login CTA routes to the patient login surface and preserves tenant context. | playwright | P0 |
| T-006 | UX, Security | Staff portal link | Staff portal link leaves patient app only through the configured ops URL helper. | playwright, unit | P0 |
| T-007 | Security | Patient host guard | Visiting patient host never shows an ops dashboard, staff login, or control-plane login. | playwright | P0 |
| T-008 | UI/UX | Wrong portal page | Wrong-portal message is clear, non-technical, and names the host and stable error code. | playwright, manual | P1 |
| T-009 | API, UX | Register validation | Empty registration form reports required fields without creating auth or profile rows. | playwright, db | P0 |
| T-010 | API, Security | Register email validation | Invalid email is rejected before mutation and does not leak whether an account exists. | playwright, api | P0 |
| T-011 | API, UX | Register password validation | Weak or mismatched password blocks submit and keeps entered non-secret fields stable. | playwright | P1 |
| T-012 | API, DB | Register success | Successful patient registration creates only the expected auth/profile records for that tenant. | playwright, db | P0 |
| T-013 | Security, UX | Login invalid credentials | Invalid login returns a generic safe error and does not reveal account existence. | playwright, api | P0 |
| T-014 | Functional | Login success | Valid patient login lands on the patient dashboard for the resolved tenant. | playwright | P0 |
| T-015 | Security | Logged-in redirect | Logged-in patient visiting login is redirected to patient home without flashing auth form. | playwright | P1 |
| T-016 | Security | Forgot password | Forgot-password flow validates email and does not disclose whether the account exists. | playwright, api | P1 |
| T-017 | Security | Reset password | Reset-password flow rejects weak and mismatched passwords and clears token state after success. | playwright, api | P1 |
| T-018 | Security | Logout | Patient logout clears auth state, cached tenant user data, and protected-route access. | playwright | P0 |

## B. Patient App Flows, T-019 To T-048

| ID | Perspective | Target | Test point | Evidence | Priority |
| --- | --- | --- | --- | --- | --- |
| T-019 | Security, UX | Consent gate load | Consent gate shows a blocking loading state while consent status is unknown. | playwright | P0 |
| T-020 | Security, API | Consent gate error | Consent status load error fails closed and blocks PHI routes until retry succeeds. | playwright, unit | P0 |
| T-021 | UX | Consent retry | Retry button re-requests consent status without requiring a full page refresh. | playwright | P1 |
| T-022 | DB, API | Consent accept | Accepting consent writes the active consent row and clears `revoked_at` on reacceptance. | db, api | P0 |
| T-023 | Security, DB | Consent revoke | Revoked consent blocks protected patient functions until accepted again. | playwright, db | P0 |
| T-024 | UI/UX | Patient dashboard cards | Dashboard cards render appointments, profile status, and clinic actions without layout shift. | playwright | P1 |
| T-025 | Functional | Empty appointments | Dashboard empty state is helpful when no upcoming appointments exist. | playwright | P1 |
| T-026 | API, UX | Profile load | Profile page loads current patient details through the service layer only. | playwright, unit | P0 |
| T-027 | API, UX | Profile validation | Phone, date, required fields, and invalid text are rejected before save. | playwright, unit | P1 |
| T-028 | DB, API | Profile save | Profile save updates the tenant DB once and returns canonical updated state. | playwright, db | P0 |
| T-029 | UX, API | Profile save failure | Save failure shows a recoverable error and does not clear user-entered fields. | playwright | P1 |
| T-030 | UI/UX | Appointment tabs | Upcoming, past, canceled, and empty appointment states are visually distinct. | playwright | P1 |
| T-031 | API | Slot load | Appointment booking loads available slots through the canonical slot service. | api, unit | P0 |
| T-032 | API, UX | Booking reason | Booking requires a safe reason or visit type according to tenant rules. | playwright, unit | P1 |
| T-033 | DB, API | Booking success | Booking succeeds through the slot RPC and creates exactly one appointment. | playwright, db | P0 |
| T-034 | DB, API | Booking race | Two users selecting the same final slot cannot double book. | db, api | P0 |
| T-035 | UX | Booking confirmation | Success confirmation shows date, time, clinic, and next action without PHI overexposure. | playwright | P1 |
| T-036 | API, UX | Cancel appointment confirm | Cancel requires explicit confirmation before mutation. | playwright | P1 |
| T-037 | DB, API | Cancel appointment result | Cancel changes state instead of hard deleting and updates availability correctly. | db, api | P0 |
| T-038 | Security | Medical history access | Medical history page is denied when patient identity does not match tenant patient row. | db, api | P0 |
| T-039 | UX | Medical history empty | Empty medical history copy is reassuring and does not look like an error. | playwright | P2 |
| T-040 | Security | Documents list | Shared documents show only authorized patient documents and never expose storage paths directly. | playwright, db | P0 |
| T-041 | Security | Signed document open | Signed document URL is short-lived, scoped, and fails closed after expiration. | api, manual | P0 |
| T-042 | UX, API | Document open error | Missing or expired document link shows a safe retry/contact message. | playwright | P1 |
| T-043 | API, UX | Message thread list | Message list loads only the patient's threads and handles empty state. | playwright, db | P0 |
| T-044 | API, UX | New message validation | Empty or oversized message is rejected with clear validation. | playwright, unit | P1 |
| T-045 | DB, API | Message send success | Sending a message writes one tenant message row with correct sender ownership. | playwright, db | P0 |
| T-046 | DB, API | Message retry idempotency | Retrying the same `client_request_id` returns existing message instead of duplicate failure. | api, db | P0 |
| T-047 | Security | Message PHI logging | Message body never appears in console logs, Edge Function logs, or safe logger metadata. | manual, unit | P0 |
| T-048 | Accessibility | Patient app keyboard | Auth, consent, profile, booking, documents, and messages are reachable by keyboard. | playwright, manual | P1 |

## C. Clinic Ops Auth And Navigation, T-049 To T-062

| ID | Perspective | Target | Test point | Evidence | Priority |
| --- | --- | --- | --- | --- | --- |
| T-049 | UI/UX | Ops login page | Ops login copy clearly targets staff and never invites patient registration. | playwright, manual | P0 |
| T-050 | UX | Patient portal link | Ops login patient link routes to patient login through normalized URL helper. | playwright, unit | P0 |
| T-051 | Security | Invalid staff login | Invalid staff credentials return a generic safe error and no role hints. | playwright | P0 |
| T-052 | Auth, UX | Doctor login | Doctor login lands on doctor home route with doctor-only navigation. | playwright | P0 |
| T-053 | Auth, UX | Secretary login | Secretary login lands on secretary home route with secretary-only navigation. | playwright | P0 |
| T-054 | Auth, UX | Predoctor login | Predoctor login lands on predoctor home route with predoctor-only navigation. | playwright | P0 |
| T-055 | Security | Patient on ops host | Patient account cannot enter staff dashboards on the ops host. | playwright, db | P0 |
| T-056 | Security | Wrong role direct URL | Direct URL to another role dashboard is blocked server-side or by protected route plus RLS. | playwright, db | P0 |
| T-057 | Security | Staff logout | Staff logout clears auth state and prevents back-button access to protected data. | playwright | P0 |
| T-058 | Security | Session restore | Expired or revoked staff session returns to login without rendering PHI. | playwright, api | P0 |
| T-059 | UI/UX | Sidebar active route | Active nav state matches current page after direct URL load and role redirect. | playwright | P2 |
| T-060 | UI/UX | Mobile ops nav | Mobile staff navigation is usable without covering clinical forms. | playwright | P1 |
| T-061 | Quality | Browser console | Login, navigation, and first dashboard load have no uncaught console errors. | playwright | P0 |
| T-062 | Auth, Business | Supported role map | Every role offered by UI or DB has an explicit home route, permission model, and test. | unit, manual | P0 |

## D. Secretary Flows, T-063 To T-086

| ID | Perspective | Target | Test point | Evidence | Priority |
| --- | --- | --- | --- | --- | --- |
| T-063 | UI/UX | Secretary dashboard | Dashboard loads today's appointments, quick actions, and pending work without PHI overexposure. | playwright | P1 |
| T-064 | API, UX | Patient list pagination | Patient list paginates or limits results without loading the whole tenant table. | api, playwright | P0 |
| T-065 | Security, API | Patient search | Search sanitizes input and never builds unsafe dynamic SQL. | unit, db | P0 |
| T-066 | API, UX | Create patient validation | Required patient fields block submit before mutation. | playwright, unit | P0 |
| T-067 | DB, API | Create patient success | New patient creation writes canonical patient row and returns created state. | playwright, db | P0 |
| T-068 | DB, API | Walk-in patient | Walk-in patient flow creates a safe placeholder identity without duplicate collision. | playwright, db | P1 |
| T-069 | DB, API | Patient create rollback | Partial patient creation failure does not leave orphan profile or appointment rows. | db, api | P0 |
| T-070 | API, UX | Edit patient profile | Secretary edit saves allowed fields only and rejects protected fields. | playwright, db | P0 |
| T-071 | Reversibility | Archive patient | Archive is soft and reversible by authorized flow, never a hard delete. | db, api | P0 |
| T-072 | UI/UX | Appointment calendar | Calendar loads day, week, and empty states with timezone-correct display. | playwright | P1 |
| T-073 | API | Register appointment patient | Appointment flow can select existing patient or create new patient without duplicate logic. | playwright, unit | P0 |
| T-074 | API, UX | Choose appointment slot | Slot chooser disables unavailable slots and communicates why. | playwright | P1 |
| T-075 | DB, API | Secretary booking success | Secretary booking uses canonical RPC and creates one appointment. | db, api | P0 |
| T-076 | DB, API | Secretary double booking | Race condition on secretary booking is rejected by DB or RPC invariant. | db, api | P0 |
| T-077 | Reversibility | Secretary cancel appointment | Appointment cancellation records status/history and does not hard delete. | db, api | P0 |
| T-078 | API, UX | Billing list | Billing list loads with pagination, status filters, and no cross-patient leakage. | playwright, db | P0 |
| T-079 | API, UX | Create bill validation | Create bill rejects missing patient, negative amount, invalid status, and invalid due date. | playwright, unit | P0 |
| T-080 | Entitlement | Insurance billing gate | Insurance billing is rejected server-side when tenant lacks entitlement. | unit, api | P0 |
| T-081 | DB, API | Payment status update | Payment status transition writes audit-safe state and rejects invalid transitions. | db, api | P0 |
| T-082 | UI/UX | Clinics list | Clinics list handles empty, active, inactive, and archived clinic locations. | playwright | P1 |
| T-083 | DB, API | Create clinic | Clinic creation validates unique name or code and can be archived later. | db, api | P1 |
| T-084 | DB, API | Manual slot create | Manual slot creation validates provider, clinic, duration, overlap, and timezone. | db, api | P0 |
| T-085 | DB, API | Recurring slot create | Recurring slot group creates expected slots idempotently and supports deactivation. | db, api | P0 |
| T-086 | Reversibility | Slot deactivate | Slot, group, and template removal mark inactive or unavailable instead of hard deleting. | db, unit | P0 |

## E. Doctor Flows, T-087 To T-112

| ID | Perspective | Target | Test point | Evidence | Priority |
| --- | --- | --- | --- | --- | --- |
| T-087 | UI/UX | Doctor dashboard | Doctor dashboard loads assigned schedule and clinical work without secretary-only actions. | playwright | P1 |
| T-088 | API, UX | Doctor appointment list | Appointment list is scoped to the doctor and supports today/upcoming filters. | playwright, db | P0 |
| T-089 | Security | Appointment detail access | Doctor cannot open another provider's appointment unless authorized by tenant policy. | db, api | P0 |
| T-090 | API, UX | Start encounter | Starting encounter requires valid appointment and patient relationship. | playwright, db | P0 |
| T-091 | UX, API | Chief complaint validation | Required clinical fields validate clearly without losing entered data. | playwright, unit | P1 |
| T-092 | UI/UX | Encounter tabs | Notes, diagnosis, orders, prescriptions, history, reports, and documents tabs render independently. | playwright | P1 |
| T-093 | Security | Encounter tab access | Each encounter tab queries through services and respects RLS for patient scope. | unit, db | P0 |
| T-094 | Security | Clinical draft storage | Encounter drafts do not persist PHI in localStorage. | unit, manual | P0 |
| T-095 | Security | Draft session cleanup | Draft storage clears on tab session end, logout, or explicit discard. | playwright, manual | P0 |
| T-096 | DB, API | Save encounter note | Saving a note creates versioned clinical record and returns canonical state. | db, api | P0 |
| T-097 | Reversibility | Cancel encounter | Cancel encounter requires confirmation and leaves appointment state recoverable. | playwright, db | P0 |
| T-098 | DB, API | Complete encounter | Complete encounter writes expected status and blocks further unsafe edits. | db, api | P0 |
| T-099 | API, UX | Diagnosis selection | Diagnosis catalog and free-text behavior match clinical rules and audit needs. | playwright, db | P1 |
| T-100 | API, DB | Prescription create | Prescription validates medication, dose, frequency, duration, and patient scope. | db, api | P0 |
| T-101 | API, DB | Lab order create | Lab order validates test, priority, reason, and encounter relationship. | db, api | P0 |
| T-102 | API, DB | Imaging order create | Imaging order validates modality, body site, reason, and encounter relationship. | db, api | P0 |
| T-103 | API, UX | Care task update | Care tasks support create, assign, complete, and cancel with allowed transitions only. | playwright, db | P1 |
| T-104 | API, DB | Medical report finalize | Report draft, finalization, and post-finalization edit restrictions work as designed. | db, api | P0 |
| T-105 | Security, UX | Certificate print | Medical certificate print view avoids app navigation leakage and uses safe print CSS. | playwright, manual | P1 |
| T-106 | API, DB | Referral create | Referral validates destination, reason, and patient scope. | db, api | P1 |
| T-107 | Security | Patient chart scope | Doctor chart view never leaks another tenant's patient data. | db, api | P0 |
| T-108 | UI/UX | Patient chart context | Chart header shows enough patient context to avoid wrong-patient errors. | playwright, manual | P0 |
| T-109 | DB, API | Schedule template create | Doctor schedule template validates overlap, timezone, provider, clinic, and recurrence. | db, api | P0 |
| T-110 | DB, API | Materialize slots | Materializing schedule slots is idempotent and does not duplicate time windows. | db, api | P0 |
| T-111 | Auth, Business | Staff roster create | Doctor can create only supported staff roles with an explicit invite lifecycle. | playwright, db | P0 |
| T-112 | API, UX | Tenant settings branding | Doctor-visible branding changes use tenant service layer and preserve safe defaults. | playwright, api | P1 |

## F. Predoctor Flows, T-113 To T-124

| ID | Perspective | Target | Test point | Evidence | Priority |
| --- | --- | --- | --- | --- | --- |
| T-113 | UI/UX | Predoctor dashboard | Dashboard shows precheck workload without doctor-only controls. | playwright | P1 |
| T-114 | API, UX | Predoctor appointments | Appointment list is scoped to predoctor permissions and assigned workflow. | playwright, db | P0 |
| T-115 | Security | Predoctor patient access | Predoctor can read only fields required for precheck and intake. | db, api | P0 |
| T-116 | API, UX | Precheck patient search | Search is scoped, paged, and handles no-results state. | playwright, api | P1 |
| T-117 | API, UX | Vitals required validation | Required vitals fields block submission with field-level messages. | playwright, unit | P0 |
| T-118 | API, UX | Vitals range validation | Out-of-range vitals require confirmation or are rejected by clinical rules. | playwright, unit | P0 |
| T-119 | DB, API | Save precheck draft | Draft save writes recoverable state and does not complete the precheck. | db, api | P0 |
| T-120 | DB, API | Submit precheck | Submit locks or versions precheck state according to workflow. | db, api | P0 |
| T-121 | API, UX | Urgent flag | Urgent or abnormal vitals flag is visible to doctor without exposing extra roles. | playwright, db | P1 |
| T-122 | UI/UX | Predoctor schedule | Schedule view uses same timezone and status language as doctor/secretary views. | playwright | P1 |
| T-123 | Security | Predoctor route guard | Predoctor cannot access billing, staff admin, or doctor-only clinical finalization routes. | playwright, db | P0 |
| T-124 | Quality | Predoctor console | Predoctor login and main flow run without browser console errors. | playwright | P1 |

## G. SaaS Control-Plane Console, T-125 To T-148

| ID | Perspective | Target | Test point | Evidence | Priority |
| --- | --- | --- | --- | --- | --- |
| T-125 | UX, SysAdmin | Missing env screen | Missing control-plane URL or anon key shows fail-closed setup guidance. | playwright | P0 |
| T-126 | Auth | Owner login | Active owner super-admin can log in and reach tenant list. | playwright, db | P0 |
| T-127 | Security | Non-admin login | Authenticated user without `super_admins` row cannot access console data. | playwright, db | P0 |
| T-128 | Security | Inactive admin login | Inactive super-admin is rejected even with valid Supabase Auth session. | playwright, db | P0 |
| T-129 | API, UX | Tenant list | Tenant list loads from admin API with loading, empty, error, and success states. | playwright, api | P0 |
| T-130 | API, UX | Tenant detail | Tenant detail fetches domains, entitlements, config, provisioning, and audit events. | playwright, api | P0 |
| T-131 | UI/UX | Status pill | Tenant status pill maps draft, pending, active, maintenance, suspended, inactive, archived. | playwright, unit | P1 |
| T-132 | API, DB | Valid status transition | Valid tenant status update writes audit event and returns canonical tenant state. | api, db | P0 |
| T-133 | API, DB | Invalid status transition | Invalid or unsafe tenant status transition is rejected server-side. | api, db | P0 |
| T-134 | Domain, UX | Pending domain edit | Pending real domains can be recorded before purchase without making them active. | playwright, db | P0 |
| T-135 | Domain, DB | Pending domain resolution | Pending real domains resolve as inactive or unavailable until verified. | api, db | P0 |
| T-136 | Domain, DB | Localhost domains | Localhost smoke domains resolve for development without requiring purchased domain. | api, db | P0 |
| T-137 | Domain, DB | Domain uniqueness | Domain uniqueness is case-insensitive and blocks duplicates across tenants. | db, api | P0 |
| T-138 | API, UX | Runtime config validation | Runtime config save rejects missing URL, malformed URL, missing anon key, and secrets. | playwright, api | P0 |
| T-139 | Security | Runtime config exposure | Browser bundle never includes service-role, management, Vercel, or tenant admin credentials. | unit, manual | P0 |
| T-140 | API, UX | Branding blocked precondition | Branding sync is blocked when tenant runtime config is missing or inactive. | api, playwright | P0 |
| T-141 | Integration | Branding sync success | Branding update writes tenant DB `tenant_profile` or `tenant_app_config` through server function. | api, db | P0 |
| T-142 | Entitlement | Entitlement toggle UI | Entitlement toggle changes local pending state before sync and can be canceled by reload. | playwright | P1 |
| T-143 | Entitlement | Entitlement sync | Entitlement sync writes control-plane grants and tenant feature flags consistently. | api, db | P0 |
| T-144 | Reversibility | Provisioning draft create | Draft provisioning job uses idempotency key and can be canceled or retried. | api, db | P0 |
| T-145 | UX, SysAdmin | Provisioning checklist | Checklist shows provider access, tenant DB, migrations, auth seed, resolver, domain, smoke tests. | playwright, manual | P1 |
| T-146 | Security | Provider connection secret | Provider connection setup never stores raw tokens in regular tables or browser storage. | manual, db | P0 |
| T-147 | Reversibility | Provider connection archive | Provider connection can be disabled or archived without deleting audit history. | db, api | P1 |
| T-148 | Security, Audit | Audit events | Audit event list contains actor, action, tenant, status, and safe metadata only. | db, manual | P0 |

## H. Resolver, Domains, And Environment Routing, T-149 To T-158

| ID | Perspective | Target | Test point | Evidence | Priority |
| --- | --- | --- | --- | --- | --- |
| T-149 | Routing | Vercel patient host | `doctoleb-patient-web.vercel.app` resolves to `dev` patient surface. | api, playwright | P0 |
| T-150 | Routing | Vercel ops host | `doctoleb-clinic-ops.vercel.app` resolves to `dev` ops surface. | api, playwright | P0 |
| T-151 | Routing, DB | Uppercase host | Uppercase host resolves using case-insensitive domain lookup. | api, db | P0 |
| T-152 | Routing | Unknown host | Unknown host returns 404 with `TENANT_NOT_FOUND` envelope. | api | P0 |
| T-153 | Routing | Wrong surface | Valid host with wrong surface returns 403 `SURFACE_MISMATCH`. | api, playwright | P0 |
| T-154 | Domain | Pending doctoleb domain | `dev.doctoleb.com` and `dev.ops.doctoleb.com` remain pending until purchased and verified. | api, db | P0 |
| T-155 | Tenant status | Maintenance tenant | `maintenance`, `inactive`, `suspended`, and `provisioning` return `TENANT_INACTIVE`. | api, db | P0 |
| T-156 | Security | Production fallback | Production does not silently use local fallback Supabase env when resolver fails. | unit, playwright | P0 |
| T-157 | Developer UX | Local fallback | Local development can use explicit fallback env for localhost without changing prod behavior. | unit, manual | P1 |
| T-158 | Reliability | Resolver timeout | Resolver timeout maps to `TENANT_RESOLVER_DOWN` and shows retry-safe UI. | unit, playwright | P0 |

## I. DB, API, Security, Deployment, And Operations, T-159 To T-180

| ID | Perspective | Target | Test point | Evidence | Priority |
| --- | --- | --- | --- | --- | --- |
| T-159 | DB, Security | Control-plane RLS | Every exposed control-plane table has RLS enabled and explicit policies. | db | P0 |
| T-160 | DB, Security | Tenant DB RLS | Every exposed tenant table has RLS enabled and scoped policies. | db | P0 |
| T-161 | Security, Data | Zero-PHI control plane | Control-plane tables contain no patient chart, clinical note, diagnosis, message, document, or PHI columns. | db, manual | P0 |
| T-162 | Security | Frontend secret scan | Frontend bundles and env files do not expose service-role, management, provider, or payment secrets. | unit, manual | P0 |
| T-163 | Security | Admin Edge auth | Privileged admin Edge Functions require JWT and super-admin RBAC. | api, db | P0 |
| T-164 | Security | Public resolver safety | Public `tenant-resolve` with `verify_jwt=false` returns only safe routing metadata. | api, manual | P0 |
| T-165 | API Quality | Explicit selects | Services use explicit select constants or bounded query shapes, not broad `select('*')` in production paths. | unit, manual | P1 |
| T-166 | Performance | Pagination contracts | List APIs use limits, pagination, and indexes for patient, appointments, billing, tenants, and audit events. | unit, db | P0 |
| T-167 | Maintainability | Duplicate services | No duplicate service methods, feature-state tables, branding tables, or hardcoded route helpers exist. | manual, unit | P1 |
| T-168 | DB, Security | Public RPC grants | Public or anon RPC grants are intentional, documented, and safe. | db, manual | P0 |
| T-169 | Reversibility | Hard delete policies | Clinical and financial tables do not expose browser hard-delete policies. | db | P0 |
| T-170 | Security | Storage buckets | Clinical document buckets are private and protected by signed URL or RLS policy. | db, ops | P0 |
| T-171 | Security | Supabase auth hardening | Leaked password protection and MFA or equivalent admin protections are enabled where available. | ops, manual | P0 |
| T-172 | CI/CD | GitHub verify workflow | CI runs install, lint, tests, build, backend contract, and security checks before deploy. | ci | P0 |
| T-173 | Deployment | Three Vercel projects | Patient, ops, and control-plane projects are connected to GitHub and deploy from the intended branch. | ci, ops | P0 |
| T-174 | Security headers | Browser headers | App shell responses include nosniff, frame protection, referrer policy, permissions policy, and tested CSP plan. | api, manual | P0 |
| T-175 | Observability | Safe logger | Logs use tenant-safe tags only and never include PHI, secrets, messages, documents, or tokens. | unit, manual | P0 |
| T-176 | Reliability | Rate limiting | Public resolver and admin APIs have documented throttling or firewall protection. | ops, api | P1 |
| T-177 | Operations | Backup restore drill | Tenant DB backup and restore drill is documented and tested before real clinic production. | ops, manual | P0 |
| T-178 | Performance | Resolver load | Resolver supports expected traffic with low latency and safe cache behavior. | api, ops | P1 |
| T-179 | Accessibility | Full keyboard pass | Patient, ops, and control-plane critical paths pass keyboard and visible focus checks. | playwright, manual | P1 |
| T-180 | Launch smoke | End-to-end deploy smoke | Fresh deploy proves aliases, resolver, auth logins, protected routes, no console errors, and no secret leaks. | ci, playwright, manual | P0 |

## Next Conversion Plan

| Batch | Scope | First automation target |
| --- | --- | --- |
| Batch 1 | T-001 to T-018 patient public and auth | Playwright deployed and local browser tests. |
| Batch 2 | T-019 to T-048 patient protected workflows | Playwright plus API stubs for consent, bookings, documents, messages. |
| Batch 3 | T-049 to T-124 clinic ops role workflows | Playwright role suites plus service and DB contract tests. |
| Batch 4 | T-125 to T-148 SaaS console | Playwright console suites and admin Edge Function API tests. |
| Batch 5 | T-149 to T-158 resolver and domains | HTTP contract tests against local and deployed resolver URLs. |
| Batch 6 | T-159 to T-180 DB, security, deployment, ops | Supabase MCP or SQL assertions, CI checks, dashboard runbooks, and manual launch evidence. |

## Current Priority Cut

The first 30 automation targets should be P0 items that can break safety, auth, PHI boundaries, tenant routing, or production deployment:

T-001, T-004, T-005, T-006, T-007, T-009, T-010, T-012, T-013, T-014, T-018, T-019, T-020, T-022, T-023, T-031, T-033, T-034, T-037, T-038, T-040, T-041, T-043, T-045, T-046, T-047, T-049, T-050, T-051, T-052.
