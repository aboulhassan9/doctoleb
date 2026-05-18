# Patient Web Stitch Gap Report

Date: 2026-05-18
Scope: `apps/patient-web`
Reference direction: DoctoLeb tactile patient sanctuary from Stitch project `9966518933119406027`

## Screenshot Baseline

Current patient-web screenshots were captured from `http://127.0.0.1:3003` with a safe local dev tenant config at `390`, `768`, and `1440` widths.

Current screenshots live in:

- `docs/stitch-analysis/9966518933119406027/current-patient-web/`

Post-implementation screenshots for this slice live in:

- `docs/stitch-analysis/9966518933119406027/current-patient-web-after/`

Primary Stitch references:

- Signup and clinical identity: `09-desktop-clinical-identity-registration-0c9c64272779405ca7ccf59ea7e5e919.png`
- Dashboard: `02-desktop-ambient-narrative-dashboard-b5b1839e06444578b19c95bfb697055c.png`
- Timeline and messaging: `03-mobile-care-timeline-contextual-messaging-6ebca8f84ada40e6895253370d73baa8.png`, `04-desktop-clinical-synthesis-timeline-8db5d4059a6843948c6d449047876cf4.png`
- Booking: `05-desktop-detailed-hybrid-care-navigation-1205003ba95249dc96d436e6be4fa5c0.png`, `07-mobile-hybrid-care-navigation-bec40baba495461d85571897cc794637.png`, `08-desktop-seek-care-c90d76d46db9466f92fe8f5aa1102df2.png`
- Billing: `06-desktop-financial-sanctuary-sovereign-payment-bbe80d18caa142aeabbc5b104b470b2c.png`

## Executive Gap

The patient app is roughly halfway to the requested target. The completed signup/onboarding/dashboard/booking foundation has the right product direction, but the system still lacks a unified patient shell, authenticated page visual parity, billing, configurable booking/profile fields, and service-owned page orchestration.

The next implementation must treat Stitch as a system benchmark, not a per-page decoration pass.

## Current Findings

| Surface | Current Evidence | Stitch Gap | Required Acceptance |
|---|---|---|---|
| Signup | `current-patient-web/signup-desktop.png` | Best current match, but still heavy, card-centric, and split-panel dominant. | Refine proportions, keep account-only signup, hand off clearly to guided intake. |
| Login | `current-patient-web/login-desktop.png` | Still legacy teal/white, not part of the warm patient sanctuary system. | Redesign login/forgot/reset as one calm auth family using patient tokens. |
| Protected routes | `current-patient-web/*-route-*.png` | Local screenshot shows auth gate because no live patient tenant runtime is configured for the capture. | Re-run authenticated screenshots after implementation with a real tenant/test patient. |
| Dashboard | Code inspection plus Stitch `02` | Page has improved cards, but not a true ambient narrative or shell-driven care overview. | One care overview with next action, readiness, messages, documents, billing state. |
| Booking | Code inspection plus Stitch `05`, `07`, `08` | Flow is too page-local and still too close to form/calendar mechanics. | Guided care request, visit type, configurable fields, curated slots, friction confirmation. |
| Timeline/history | Code inspection plus Stitch `03`, `04` | Current history remains document-centric and uses older list/card patterns. | Care timeline built from patient-safe finalized documents and approved clinical entities. |
| Messages | Code inspection plus Stitch `03` | Shared messaging works, but patient page has no contextual wrapper or process receipts. | Patient-context message shell with SLA, route context, and calm status language. |
| Billing | Stitch `06`; no current patient route | Missing entirely. Existing payment service is staff-oriented. | Patient-safe billing overview plus hosted checkout/session flow through Edge contracts. |

## Architecture Gaps Blocking Visual Parity

- No unified patient portal shell yet; each page owns its own header/rhythm.
- Long page files still mix data loading, UI state, rendering, and service orchestration.
- Configurable intake exists, but profile and booking are not yet driven by the same registry/resolver model.
- Patient billing has selectable RLS rows but no patient action contract, no checkout session boundary, and no patient route.
- Protected-route visual QA needs authenticated browser coverage after the service layer is available.

## Implementation Gate

Do not accept the next patient-web slice until:

- Current screenshots are refreshed after implementation at `390`, `768`, and `1440`.
- Signup/login/onboarding/dashboard/booking/timeline/messages/billing all use the patient shell.
- Payment actions go through server/Edge contracts only.
- Page JSX no longer owns business rules or raw data orchestration.
- Reduced motion, keyboard navigation, focus visibility, and async receipts are verified.

## 2026-05-18 Implementation Delta

Completed in the remaining-50% slice:

- Added a patient Billing route and UI around `patientBillingService`, using hosted checkout only.
- Added payment Edge Function contracts for checkout creation and webhook confirmation, with idempotent gateway-event storage.
- Added a mobile bottom nav and Billing navigation to the shared patient header.
- Refactored dashboard data orchestration through `patientPortalService` / `usePatientPortal`.
- Refactored booking to use `patientBookingService` and the configurable `appointment_booking` field definition.
- Extended booking answer persistence so allowlisted patient answers such as priority, modality, contact method, and configured `custom.*` fields go through `submit_patient_appointment_answers`.
- Rebuilt Medical History as a finalized-care timeline through `patientTimelineService`.
- Rebuilt Profile as a definition-driven patient profile form using the `profile` context.
- Rebuilt Login, Forgot Password, and Reset Password into the same patient visual family.
- Reframed Messages in the patient shell without modifying the shared messaging engine.

Verification:

- `node --test tests/unit/schemas/patientForms.test.mjs tests/unit/services/patientForms.test.mjs tests/unit/services/patientBooking.test.mjs tests/unit/services/patientBilling.test.mjs tests/unit/services/patientTimeline.test.mjs tests/unit/contracts/patientBillingMigration.test.mjs`
- `npm run audit:rpc-signatures`
- `npm run audit:selects-drift`
- `npm run build:patient`
- `npm run lint`
- `npm run test:unit`
- Playwright screenshots captured at `390`, `768`, and `1440` widths into `current-patient-web-after/`.

Residual QA note:

- Protected patient routes still require an authenticated tenant/test patient to capture true dashboard, booking, timeline, messages, billing, and profile runtime states. The unauthenticated visual pass confirms the route guard and public patient-auth pages, but not patient-owned data states.
- Screenshot pass captured `ERR_NAME_NOT_RESOLVED` console noise from external resources in the local environment; app build/lint and local rendering still completed.

## 2026-05-18 Second Senior Pass — Generic-Pattern And Defect Sweep

A second senior review scanned the patient service layer, hooks, shared UI
primitives, and every patient route. Architecture is sound: no raw Supabase /
`fetch` / `console` calls in patient pages, no `console` / `select('*')` in
patient services, `{ data, error }` envelopes are consistent, and the timeline
service correctly restricts to `status: 'final'` non-archived documents. The
following concrete defects were found and fixed.

### Findings fixed

| # | Severity | Surface | Finding | Owner layer | Fix |
|---|---|---|---|---|---|
| 1 | Medium | `index.html`, `PatientAppointmentsPage`, `NotFoundPage` | Patient-web loaded the full Material Symbols web font for exactly two icons (booking spinner, 404 glyph) while every other icon is `lucide-react`. Inconsistent icon system and an unnecessary font download. | `apps/patient-web` | Replaced the two glyphs with `lucide-react` (`Loader2`, `Compass`); removed the Material Symbols `<link>` from `index.html`. |
| 2 | High | `LoginPage`, `SignUpPage`, `ForgotPasswordPage`, `ResetPasswordPage` | Auth pages shipped the exact poetic Stitch vocabulary `DESIGN.md`/`ANALYSIS.md` forbid: "The Data Vault", "Enter quietly", "weave records", "Clinical Identity", "Restore access calmly", "Return to entrance", "Choose a new key", "Identity (email)". A decorative non-functional slide-to-confirm element (`patient-friction`, `role="img"`) sat on the login page. | `apps/patient-web` | Rewrote copy into plain DoctoLeb healthcare language (Email, Sign in, Create account, Reset your password, Set a new password, Back to sign in). Removed the decorative friction slider and its now-dead CSS. |
| 3 | Medium | `usePatientPortal`, `useDoctorProfile` | Effects/`useCallback`s depended on the whole `user` object, which `AuthProvider` replaces on every `SIGNED_IN` / token-refresh event — re-running the 4-call dashboard fetch (and the doctor-profile fetch) needlessly. | `packages/core` | Keyed on the stable `user?.id` primitive, matching the rest of the codebase. |
| 4 | Medium (a11y/UX) | `PatientIntakeField` | The shared configurable-form `<select>` used `appearance-none` with no replacement chevron, so every select across onboarding, profile, check-in, and booking custom fields looked like a plain text input with no dropdown affordance. | `packages/ui` | Added an `aria-hidden` `ChevronDown` indicator in the reserved `pr-10` space. |
| 5 | Low | `src/index.css` | Six unused Stitch-leftover rules (`patient-narrative-line`, `patient-narrative-field*`, `patient-art-line`, `patient-rule-grid` — one even references the unloaded `Newsreader` font). Confirmed zero usage across `apps/` and `packages/`. | `src` | Removed. |

### Verification

- `npm run lint`, `npm run build:patient`, `npm run build:ops`, `npm run test:unit`
  (936 pass / 0 fail), `npm run audit:rpc-signatures`, `npm run audit:selects-drift`
  — all green.
- Live dev tenant (`gezmfmskhmjgnquoyosq`) confirmed: all 18 patient RPCs and the
  `patient_form_field_config` / `appointment_patient_answers` /
  `patient_payment_checkout_sessions` / `patient_payment_gateway_events` tables
  exist; `submit_patient_check_in` writes only allowlisted `precheck_forms`
  columns with ownership + status + custom-answer allowlist checks.
- Browser QA against the dev tenant: public pages (login, signup, forgot, reset,
  404) and authenticated pages (billing, onboarding, profile) — zero console
  errors, select chevrons present on every `PatientIntakeField`, zero
  Material Symbols spans remaining.

### Still open (not addressed this pass)

- Authenticated dashboard / booking / timeline / messages runtime QA at the
  `390 / 768 / 1440` matrix is still partial — the dashboard redirects to
  onboarding until first-visit intake is complete for a fresh patient.
- Check-in only ever targets `nextAppointment`; a patient with multiple upcoming
  visits cannot choose which to check in for (RPC already accepts any owned
  appointment id — UI-only gap).
- `patientBillingService.getReceipt` returns the RPC payload without schema
  validation, unlike the other billing reads.

## 2026-05-18 Senior Gap Scan + Auth Polish (Session 2)

A second senior-level scan reviewed every patient-web route, the patient shell, all
nine `packages/core/services/patient*` services, and the live dev tenant
(`gezmfmskhmjgnquoyosq`).

### Schema / contract verification

All 18 patient-facing RPCs and the `patient_form_field_config`,
`appointment_patient_answers`, `patient_payment_checkout_sessions`,
`patient_payment_gateway_events` tables exist in the dev tenant.
`audit:rpc-signatures` and `audit:selects-drift` report no drift.
`submit_patient_check_in` is present and writes only allowlisted `precheck_forms`
columns with ownership, appointment-status, and `custom.*` allowlist guards.

### Findings

| Severity | Surface | Finding | Status |
|---|---|---|---|
| High | `PatientAppointmentsPage`, `NotFoundPage` | Material Symbols icon font used for 2 icons while the whole app is `lucide-react`; the font `<link>` shipped in `apps/patient-web/index.html`. Generic-AI / Stitch leftover and an unnecessary web-font download. | Fixed |
| High | `LoginPage` | Shipped forbidden Stitch vocabulary: heading "The Data Vault", "Enter quietly", "weave records", label "Identity (email)". `DESIGN.md` §8 and `ANALYSIS.md` explicitly forbid this. | Fixed |
| Medium | `LoginPage` | Decorative non-functional `patient-friction` slide element (`role="img"`) — a Stitch slide-to-confirm artifact with no behavior. | Removed (+ dead CSS) |
| Medium | `SignUpPage`, `ForgotPasswordPage`, `ResetPasswordPage` | Poetic copy: "Clinical Identity", "Return to entrance", "Restore access calmly", "Choose a new key", "Send entrance link", "Identity email", "Creating identity...". | Fixed |
| Low | `src/index.css` | Pre-existing unused patient CSS classes: `patient-narrative-line`, `patient-narrative-field`, `patient-art-line`, `patient-rule-grid` (zero usages in `apps/`). | Fixed in the second senior pass |
| Info | Patient portal pages | Dashboard, Appointments, Check-In, Billing, Timeline, Profile, Messages, Onboarding are service-driven, tokenized, accessible, with loading/empty/error states. No generic bordered-card stacks, no `transition-all`, no hardcoded patient hexes. Architecturally sound. | No action |

### Fixed this session

- Removed the Material Symbols font dependency from patient-web: replaced the booking
  spinner with `lucide-react` `Loader2`, the 404 icon with `Compass`, and deleted the
  font `<link>` from `apps/patient-web/index.html`.
- De-poeticized Login, Signup, Forgot Password, and Reset Password copy into clear
  DoctoLeb healthcare language per the `ANALYSIS.md` translation table.
- Removed the decorative `patient-friction` slider from `LoginPage` and its now-dead
  `.patient-friction*` CSS rules.

### Verified

- `npm run lint`, `npm run build:patient`, `npm run test:unit` (935 pass / 0 fail),
  `npm run audit:rpc-signatures`, `npm run audit:selects-drift` — all pass.
- Browser QA at 390 px and ~560 px on the dev tenant: `/login`, `/signup`,
  `/forgot-password`, `/reset-password`, and the 404 route render the new copy,
  the `Compass` SVG icon, zero `.material-symbols-outlined` nodes, and zero console
  errors.

### Still open for the next session

- Authenticated portal pages (dashboard, appointments, check-in, billing, timeline,
  profile, messages) still need true runtime visual QA with a real test patient
  session — only public/auth routes were browser-verified.
- The booking-page `Loader2` spinner change is behind auth; verified by build and deployed auth smoke.
