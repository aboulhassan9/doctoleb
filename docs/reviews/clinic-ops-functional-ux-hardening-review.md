# Clinic Ops Functional UX Hardening Review

## Status
In progress

## Date
2026-05-18

## Why This Exists
The first clinic-ops repair plan correctly identified several fake or under-wired controls, but it was too small for the real product risk. Clinic ops is not one page. It is a live operational surface for doctors, secretaries, predoctors, and eventually nurses or billing staff. A visually nice screen that does not mutate data, enforce state, or explain why an action is unavailable is dangerous because it teaches the clinic that the system cannot be trusted.

This review records the second hardening pass and expands the remaining problem map so future work does not shrink back into button-by-button patching.

## Second-Pass Fixes Completed
These changes remove concrete fake behavior from production clinic-ops paths.

- Billing no longer displays fake invoice IDs such as `INV-8842X` or `INV-88241`. Posted bills now display a reference derived from the persisted payment row.
- Billing notification dropdown now reads the real notification inbox, shows unread counts, can mark all read, routes notification clicks, and signs out through the auth context.
- Billing archive now calls the payment service archive path instead of only removing the row locally.
- Billing and patient deletion no longer use native browser `confirm()`. Both now use an app-owned confirmation dialog that explains archival/retention behavior.
- Appointment confirmation no longer simulates a PDF download with a timer. The action now opens the real print dialog and the second action modifies the booking.
- Settings/security modal no longer claims password reset, 2FA, or active sessions opened when no backend action exists. Those controls are disabled with explicit reasons until real services exist.
- Lab request creation now has selectable canonical lab tests, category filtering, query-based lab test resolution, real draft persistence, real finalization on submit, date input validation, and an app-owned discard confirmation.
- Doctor patient profile tab/search controls now route or explain their disabled state instead of rendering visual-only buttons.
- Doctor referral header/search/attachment controls now either route, save, print, or expose a disabled reason. The referral reference is stable for the form session instead of changing on every render.
- Source canaries now fail if clinic-ops reintroduces `alert()`, browser `confirm()`, stale demo calendar tokens, hardcoded invoice references, fake download copy, or known "coming soon" workflow copy.

Verification run:

- `node --test tests/unit/clinicOpsInteractionContracts.test.mjs tests/unit/precheckPayload.test.mjs`
- `npx eslint` on the changed source files
- `npm run build:ops`

## Third-Pass Fixes Completed
This pass implements the shared interaction contract requested in the hardening plan and removes another layer of visual-only behavior.

- Added `packages/core/lib/clinicOpsRoutes.js` as the canonical route manifest for clinic-ops role home routes, patient routes, appointment routes, report routes, message routes, and notification target routes.
- Appointment view query values are now normalized to `day`, `week`, and `month`; legacy `daily`, `weekly`, and `monthly` values are accepted and converted silently.
- Added `packages/core/lib/clinicOpsAppointments.js` so appointment cards, drawers, and calendar views consume one normalized appointment view model instead of scattered legacy fields.
- Doctor appointment cards now open a real appointment detail drawer first. Status-aware actions determine whether the user can cancel, view the patient, open/continue an encounter, or see a disabled reason.
- Doctor appointment UI no longer depends on hardcoded room labels, stale 2023 calendar facts, or fixed productivity targets.
- Secretary appointment state uses the canonical view values and removes the hardcoded daily target.
- Predoctor controls that had no backend action are now either real navigation/actions or disabled with a visible reason.
- Certificates no longer claim QR or scan verification unless a persisted verification endpoint exists. The table `View` action opens a real saved certificate detail modal.
- Referral and report pages no longer generate business references from `Date.now()`. References are derived from persisted document ids or clearly shown as pending until saved.
- Report export no longer creates a local-only HTML download that can drift from the stored clinical document. It is disabled until the canonical renderer/export path is connected.
- Medical history search, time filters, record pagination, report routing, and prescription/encounter routing now operate on loaded service data. The local-only "Download All Records" action was removed.
- ESLint now ignores generated deployment artifacts (`.vercel`, `.cache`, `.deploy-temp`, `output`) so lint evaluates source code instead of minified bundles.
- Static canaries were expanded to block client-generated clinical/business references, stale demo calendar data, fake QR/security claims, native `alert()`, and native `confirm()` in clinic-ops source.

Verification run:

- `node --test tests/unit/clinicOpsInteractionContracts.test.mjs tests/unit/precheckPayload.test.mjs`
- `npm run lint`
- `npm run build:ops`

## Current Interaction Contract
Every visible clinic-ops control must prove one of these outcomes in code:

- Real mutation: calls a service/RPC/Edge Function, validates input, handles loading/error/success, and refreshes or patches canonical state.
- Real navigation: builds a route through the clinic-ops route manifest and carries enough query/state context to continue the task.
- Real disclosure: opens a modal, drawer, or form whose nested controls also satisfy this contract.
- Real disabled state: is visibly disabled, has accessible disabled-reason copy, and is covered by a static or unit test if it is a known missing service.

Do not ship controls that only log, toast "opening", call `alert()`, call `confirm()`, generate fake references, show sample clinical data, or claim security/verification behavior that is not persisted and service-backed.

## Hard Rule Going Forward
Every visible interactive control in clinic ops must satisfy exactly one of these contracts:

- It performs a real service/RPC action and handles success, validation, failure, loading, and refresh.
- It navigates to a real route with enough URL/state context to continue the task.
- It opens a real modal/drawer/form whose controls are also wired.
- It is disabled with a visible reason and no misleading hover/click affordance.

Anything else is fake UI and must not ship.

## Expanded Problem Map

### 1. Shell And Navigation
Risk: pages own their own headers, notifications, account menus, and search behavior. This creates inconsistent role behavior and repeated places for fake controls to reappear.

Required fix:
- Move all clinic-ops role headers to one shared shell contract.
- Use one notification dropdown implementation for doctor, secretary, and predoctor.
- Use one account/security menu that only exposes services that exist.
- Add a route manifest that defines which role can open each page and what query params are supported.

Acceptance criteria:
- No page-local notification bell unless it wraps the shared notification component.
- No page-local account dropdown unless it wraps the shared account component.
- Header search always routes or filters real data.

### 2. Appointment And Schedule Workflow
Risk: appointments are the center of the clinic day, but the UI still mixes doctor, secretary, and predoctor state. Calendar actions need a unified domain contract, not separate page logic.

Required fix:
- Create a shared appointment action map by role and status.
- Every appointment card must expose only valid actions: view, check in, no-show, cancel, reschedule, precheck, start encounter, continue encounter, complete encounter.
- Calendar day/week/month must share one URL-backed state model for `view`, `date`, `doctor_id`, `clinic_id`, `status`, `search`, and `appointmentId`.
- Empty slot clicks must open booking only when a real slot exists or when the user is allowed to create a manual slot.
- Reschedule must be its own safe flow using available slots and preserving audit context.

Acceptance criteria:
- Seeded appointments appear consistently in dashboard, list, day, week, and month views.
- Clicking any appointment opens a detail drawer or route with status-aware actions.
- Invalid state transitions are hidden or disabled with the DB/RPC reason mirrored in UX copy.

### 3. Doctor Dashboard And Encounter Handoff
Risk: the doctor dashboard must support the doctor’s actual morning flow: see today, triage, open patient, start encounter, review precheck, write clinical data, finalize.

Required fix:
- Replace remaining local derived cards with one doctor-day view model.
- Show appointment counts by status: scheduled, arrived, prechecked, in consultation, completed, cancelled, no-show.
- Show precheck handoff quality: missing vitals, missing complaint, urgent flags, allergy/medication warnings.
- `Start Encounter` must create or continue the correct encounter, not only route by appointment ID.
- Alerts must route to real patient, appointment, precheck, message, report, or billing records.

Acceptance criteria:
- Dashboard values can be traced to specific service queries.
- Every alert has a related record or is not shown.
- Doctor can start from the dashboard and reach the encounter screen without reselecting context.

### 4. Predoctor Workflow
Risk: predoctor workflow needs to be a structured clinical intake handoff, not just a form. The doctor should know what was captured and whether it is safe to proceed.

Required fix:
- Queue should separate waiting, in precheck, submitted, reviewed, returned, and blocked items.
- Precheck form must validate vitals, complaint, allergies, medication list, red flags, and missing consent before handoff.
- Add draft/resume behavior for interrupted prechecks.
- Add explicit "return to predoctor" or "needs correction" status after doctor review.
- File attachments need a real storage/upload path or must be disabled.

Acceptance criteria:
- Patient cannot be marked ready unless a submitted precheck exists.
- Numeric vitals are coerced and validated before service calls.
- Doctor handoff displays predoctor author, timestamp, and completeness summary.

### 5. Patient Record
Risk: patient profile tabs still contain visual-only or partially wired controls. This is high-risk because clinicians expect records to be canonical.

Required fix:
- Profile, records, analytics, history, documents, medications, allergies, diagnoses, appointments, messages, and billing must each be backed by a real service query.
- Empty states must distinguish "no data" from "feature not enabled" from "could not load."
- Edit actions must mutate through service contracts and refresh dependent screens.
- Cross-links from appointment, encounter, precheck, report, and message must land on the correct patient context.

Acceptance criteria:
- No tab button without route/state change.
- No patient panel uses local-only mock state for persisted medical facts.
- Patient edit/save is auditable and reversible.

### 6. Lab Requests, Reports, Certificates, Referrals
Risk: clinical documents are currently spread across specialized pages and the emerging report-definition system. The product needs one document architecture, not one-off forms.

Required fix:
- Each document type should use a shared `ClinicalDocumentBuilder` contract.
- Draft, finalize, print, void, clone, and send must be consistent across reports, certificates, referrals, lab requests, and future forms.
- Print/export must use the same persisted clinical document content that the database stores.
- Nonexistent PDF download actions must be removed until a real render endpoint exists.
- Document templates and report definitions need a single versioned architecture with immutable published versions.

Acceptance criteria:
- Every document save writes to `clinical_documents` or the planned versioned document table.
- Print preview renders from saved state or an explicit unsaved preview.
- Finalized documents cannot be silently edited.

### 7. Messaging And Notifications
Risk: notifications and messages are not just UX sugar. They drive clinical tasks. Inconsistent unread counts or unroutable notifications create operational misses.

Required fix:
- Normalize notification inbox data once in core and reuse everywhere.
- All `related_type` values must have a route mapping or be classified as non-routable.
- Mark-read must operate on deliveries, not just local state.
- Add role-specific inbox pages for doctor and secretary, or route all bells to a shared inbox.
- Add alert-fatigue rules: severity, dedupe, snooze, and "requires action" versus "FYI."

Acceptance criteria:
- Unread badges match the delivery table.
- Clicking a notification marks it read and lands on the related record.
- Non-routable notifications are tested and displayed with a clear fallback.

### 8. Billing, Claims, And Insurance
Risk: billing pages are partly real but still rely on local UI models in places. Financial records must never look like invoices if they are payment rows or draft local objects.

Required fix:
- Rename UI language where needed: payment, bill, claim, invoice, receipt must map to distinct data objects.
- Claims must use insurance service functions and clearly separate payer responsibility from patient balance.
- Editing a posted financial record must be state-machine controlled, not arbitrary local form mutation.
- Receipt print must include persisted payment reference, patient, doctor, method, amount, date, and status.

Acceptance criteria:
- No generated invoice label unless it comes from a persisted object.
- Posted payments cannot be hard-deleted.
- Print output can be reproduced from database state.

### 9. Catalogs And Configuration
Risk: catalog screens affect what doctors can select. They must distinguish tenant-custom values from protected system values.

Required fix:
- Catalog pages must show system/tenant source, active/archive state, and dependency impact.
- Mutating system catalog rows must fail closed in UI before hitting DB triggers.
- Adding/editing values must validate codes, display names, duplicate rows, and safe archival.

Acceptance criteria:
- System rows cannot show destructive actions.
- Tenant rows can be archived and restored with audit visibility.

### 10. Entitlements And Feature Gates
Risk: pages can appear enabled while the tenant lacks required schema/tables or plan access. That caused reports to show as enabled while DB objects were missing.

Required fix:
- Feature gates need a three-part check: plan entitlement, tenant schema readiness, and service health.
- SaaS admin entitlement sync must surface whether a feature is provisioned, enabled, blocked, or missing migration.
- Clinic-ops should show "feature not provisioned" differently from "not in plan."

Acceptance criteria:
- A feature cannot show as enabled if its required tables/RPCs are absent.
- Admin panel can run or explain the needed migration path.

### 11. Data Loading, Caching, And Refresh
Risk: some pages depend on local state after mutation. This creates stale dashboards and "seed worked but UI says zero" confusion.

Required fix:
- Define cache invalidation per domain: appointments, patients, prechecks, encounters, documents, payments, notifications.
- Mutations must either refetch affected queries or patch cache with canonical returned rows.
- Dashboards must expose load, empty, and error states separately.

Acceptance criteria:
- After booking, cancelling, prechecking, or seeding, the dashboard refresh path is deterministic.
- Empty cards explain whether no data exists or data failed to load.

### 12. Accessibility And Keyboard UX
Risk: healthcare staff will use this under time pressure. Mouse-only interactions and poor focus behavior slow work and create mistakes.

Required fix:
- Calendar day selection must follow WAI-ARIA date grid behavior.
- Drawers/modals must trap focus, return focus, and support Escape.
- Icon-only buttons require labels.
- Disabled actions must expose the reason in text or accessible title.

Acceptance criteria:
- Keyboard-only user can book, open, filter, cancel, and print.
- Screen-reader labels exist for icon-only controls.

### 13. Security And PHI
Risk: clinic-ops is PHI-heavy. UX improvements must never move privileged logic into the browser.

Required fix:
- Every mutation must go through service/RPC/Edge Function paths, never direct privileged browser keys.
- Logs must not contain PHI, message bodies, document text, tokens, or service keys.
- UI hidden state is never an authorization boundary.
- RLS contract tests are needed for doctor, secretary, predoctor, and patient-visible data.

Acceptance criteria:
- Browser code uses anon/RLS-safe access only.
- Failing authorization produces safe, non-PHI error messages.

### 14. Test And QA Matrix
Risk: source canaries catch fake UI tokens, but they are not enough. The system needs end-to-end flow tests using seeded tenant data.

Required fix:
- Add Playwright smoke for doctor dashboard, secretary booking, predoctor precheck, billing receipt, lab request, notification routing, and patient profile tabs.
- Add service unit tests for every role/status action mapper.
- Add contract tests for select constants versus live/local schema.
- Add a seed verification step that asserts row counts and dashboard visibility after seeding.

Acceptance criteria:
- A seeded tenant shows non-zero dashboard counts without manual refresh hacks.
- CI fails if a clickable button has no `onClick`, `type="submit"`, route, or disabled reason in core workflow files.

## Recommended Next Slices
1. Shared clinic-ops shell: header, account menu, notifications, search, route helpers.
2. Appointment action state machine: role/status action map plus drawer actions.
3. Patient record tabs: replace visual tab buttons with real route/state and data loading.
4. Document builder unification: lab request, referral, certificate, report under one persisted draft/finalize/print contract.
5. Seed-to-dashboard verification: after SaaS seed, assert operational rows are visible through clinic-ops services and dashboard cards.

## Reviewer Notes
This pass intentionally disables some controls instead of pretending they work. That is not the final product, but it is the correct production-safe intermediate state. The next engineering work should convert those disabled controls into real service-backed features, not re-enable them with toasts.
