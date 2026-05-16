# DoctoLeb Graduation Guide

This folder is the clean report guide. Use it with [Core Context](../CORE_CONTEXT.md) and the curated ERDs in [ERD And Data Model](./06-erd-and-data-model.md).

## Report Structure
| Chapter | What to show | Source |
|---|---|---|
| System overview | SaaS control plane, shared patient/ops apps, tenant Supabase projects. | `docs/CORE_CONTEXT.md` |
| Tenancy and routing | Host routing plus `/t/:slug` no-domain routing. | `docs/CORE_CONTEXT.md` |
| Data model | Focused feature ERDs, one per page. | `docs/erd/rendered/*.svg` |
| Core workflows | Booking, clinical record, predoctor, messaging, billing, staff lifecycle. | `docs/erd/views/12-17*.dbml` |
| Security | PHI boundary, RLS, server-only secrets, zero-PHI control plane. | `docs/CORE_CONTEXT.md`, `docs/decisions/` |
| Future work | Flutter, Firebase FCM, Stripe, LiveKit, AI agents, custom domains. | `docs/CORE_CONTEXT.md` |

## ERD Path
Use the ERD chapter as a story, not an inventory:

1. SaaS tenant creation and routing.
2. Runtime branding, consent, and features.
3. Doctor/provider data.
4. Patient record data.
5. Appointment booking data.
6. Clinical record/action data.
7. Appendix-only support flows: predoctor, messaging, staff lifecycle, billing.

## Figures To Use
Use only the current curated ERDs. Put the first six in the main report and the last four in the appendix.

| Topic | SVG |
|---|---|
| SaaS provisioning | `docs/erd/rendered/19-saas-tenant-provisioning-process.svg` |
| Runtime branding and consent | `docs/erd/rendered/18-runtime-branding-consent-feature-process.svg` |
| Doctor/provider | `docs/erd/rendered/10-doctor-provider-detail.svg` |
| Patient record | `docs/erd/rendered/11-patient-record-detail.svg` |
| Appointment booking | `docs/erd/rendered/12-appointment-booking-detail.svg` |
| Clinical actions | `docs/erd/rendered/13-clinical-actions-detail.svg` |
| Predoctor precheck | `docs/erd/rendered/14-predoctor-precheck-process.svg` |
| Messaging | `docs/erd/rendered/15-messaging-notification-process.svg` |
| Staff lifecycle | `docs/erd/rendered/17-staff-lifecycle-process.svg` |
| Billing and insurance | `docs/erd/rendered/16-billing-insurance-process.svg` |

## Writing Rule
Keep the graduation report visual and selective. Do not include old tier plans, stale audit dumps, full-schema DBML, or giant all-table ERDs unless an examiner asks for an appendix.
