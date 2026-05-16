# DoctoLeb ERD Export

This folder keeps only the curated ERDs that are useful for the graduation
report and handoff. The old full-schema DBML and broad generated slices were
removed because they were cluttered and hard to document.

- `views/*.dbml`: source diagrams for ChartDB/manual editing.
- `rendered/*.svg`: generated SVGs for the report and appendix.
- `views/10` to `13`: detailed ERDs with full columns for key records.
- `views/14` to `19`: process ERDs showing the tables each feature reads or mutates.

## Current ERDs
| File | Use |
|---|---|
| `views/10-doctor-provider-detail.dbml` | Doctor/provider, staff, schedule, clinic, contracts. |
| `views/11-patient-record-detail.dbml` | Patient identity, intake, history, consent, devices, insurance. |
| `views/12-appointment-booking-detail.dbml` | Availability, slots, booking, encounter, payment, notifications. |
| `views/13-clinical-actions-detail.dbml` | Encounter notes, drafts, diagnoses, orders, files, tasks, billing. |
| `views/14-predoctor-precheck-process.dbml` | Predoctor vitals/precheck process. |
| `views/15-messaging-notification-process.dbml` | Messaging, receipts, attachments, notification delivery. |
| `views/16-billing-insurance-process.dbml` | Payments, insurance claims, provider contracts, policies. |
| `views/17-staff-lifecycle-process.dbml` | Invite, resend, reissue, disable, reactivate. |
| `views/18-runtime-branding-consent-feature-process.dbml` | Branding, feature gates, content, consent. |
| `views/19-saas-tenant-provisioning-process.dbml` | Tenant setup, provider connections, secrets, migrations, audit. |

## Render
Render the table-style diagrams to SVG:

```bash
npm run render:erd-views
```

Use one ERD per report page. If migrations change a workflow, update the
matching curated DBML directly and rerender the SVG.
