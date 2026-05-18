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
