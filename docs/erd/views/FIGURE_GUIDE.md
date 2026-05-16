# DoctoLeb ERD Figure Guide

Use one feature/process SVG per page when exporting to PDF. These are the only
ERDs kept for the clean graduation documentation set.

## Detail ERD Figures
| Figure | DBML source | SVG artifact | Caption |
|---|---|---|---|
| 6.1 | `10-doctor-provider-detail.dbml` | `../rendered/10-doctor-provider-detail.svg` | Doctor/provider data includes login user, doctor profile, staff, specialties, clinics, availability, branding, and insurance contracts. |
| 6.2 | `11-patient-record-detail.dbml` | `../rendered/11-patient-record-detail.svg` | Patient data includes identity, intake, consent, devices, history, surgeries, vaccinations, and insurance policies. |
| 6.3 | `12-appointment-booking-detail.dbml` | `../rendered/12-appointment-booking-detail.svg` | Booking uses availability, clinic, visit type, slot, patient, appointment, encounter, payment, task, and notification tables. |
| 6.4 | `13-clinical-actions-detail.dbml` | `../rendered/13-clinical-actions-detail.svg` | Clinical actions connect encounters to notes, drafts, diagnoses, prescriptions, orders, documents, pre-checks, tasks, messaging, and billing. |

## Process ERD Figures
| Figure | DBML source | SVG artifact | Caption |
|---|---|---|---|
| 6.5 | `14-predoctor-precheck-process.dbml` | `../rendered/14-predoctor-precheck-process.svg` | Predoctor precheck reads appointment context, then writes vitals, care tasks, and notification events. |
| 6.6 | `15-messaging-notification-process.dbml` | `../rendered/15-messaging-notification-process.svg` | Messaging writes conversations, participants, messages, attachments, receipts, notification events, devices, and deliveries. |
| 6.7 | `16-billing-insurance-process.dbml` | `../rendered/16-billing-insurance-process.svg` | Billing writes payments and claims using appointment, encounter, provider, contract, policy, and template data. |
| 6.8 | `17-staff-lifecycle-process.dbml` | `../rendered/17-staff-lifecycle-process.svg` | Staff lifecycle writes staff state, resend/reissue ledgers, and audit records. |
| 6.9 | `18-runtime-branding-consent-feature-process.dbml` | `../rendered/18-runtime-branding-consent-feature-process.svg` | Runtime configuration reads entitlements and tenant branding/flags/content; consent writes patient consent records. |
| 6.10 | `19-saas-tenant-provisioning-process.dbml` | `../rendered/19-saas-tenant-provisioning-process.svg` | Tenant provisioning writes registry, domains, job/step ledgers, secret references, migration runs/items, entitlements, and audit events. |

## ChartDB Layout Rule
Keep the main flow left-to-right:

```text
Identity / Registry -> Operational Object -> Outcome / Audit
```

Avoid dragging every table into the center. Leave anchor tables small and near the edge.

Print one figure per page. The detail ERDs intentionally show many columns and
should not be squeezed into a multi-figure layout.

## Export Settings
Use SVG for the final document when possible. Use PNG only when the editor does
not accept SVG. Export each file separately so the PDF remains readable.

Regenerate the SVG set with:

```bash
npm run render:erd-views
```
