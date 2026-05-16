# DoctoLeb Documentation ERD Views

Use these curated DBML files for ChartDB, PDFs, and graduation figures. The set
is intentionally small: each file documents one feature or process instead of
trying to show the whole database at once.

## Import Order

1. `10-doctor-provider-detail.dbml` — doctor/provider profile, staff, schedule, clinic, branding, contracts.
2. `11-patient-record-detail.dbml` — patient identity, intake, consent, devices, history, vaccines, surgeries, insurance.
3. `12-appointment-booking-detail.dbml` — availability, slot, booking, encounter, payment, notification participants.
4. `13-clinical-actions-detail.dbml` — encounter notes, drafts, diagnoses, prescriptions, orders, documents, tasks, messaging, billing.
5. `14-predoctor-precheck-process.dbml` — predoctor vitals flow, appointment context, care task, notification participants.
6. `15-messaging-notification-process.dbml` — conversation, message, attachment, receipt, device, event, delivery participants.
7. `16-billing-insurance-process.dbml` — payment and claim flow across visit, policy, contract, provider, template, claim tables.
8. `17-staff-lifecycle-process.dbml` — invite, resend, reissue, disable, reactivate, access-impact tables.
9. `18-runtime-branding-consent-feature-process.dbml` — SaaS entitlements plus tenant branding, content, feature flags, consent gate.
10. `19-saas-tenant-provisioning-process.dbml` — tenant creation, provider connection, secrets, migrations, domains, entitlements, audit.

## ChartDB Import

The `.dbml` files are the source diagrams. They keep table notes, colored
`TableGroup` areas, and colored `Ref` lines for tools that understand DBML.

ChartDB currently imports DBML tables and refs, but it does not convert DBML
`TableGroup` blocks into visible ChartDB Areas or top-level `Note` blocks into
sticky notes. For the readable ChartDB canvas, import the matching generated
file from `docs/erd/chartdb/*.chartdb.json` through **Backup -> Import Diagram**.

This is a ChartDB importer limitation, not a DBML typo. In the local ChartDB
source, `src/lib/dbml/dbml-import/dbml-import.ts` removes `TableGroup` and
top-level `Note` blocks before parsing DBML, and its tests assert that behavior.
If the ChartDB sidebar says **No areas**, the diagram was imported from DBML.
Import the `.chartdb.json` file instead.

In the ChartDB JSON files:

- Tables are placed inside real ChartDB Areas.
- The Areas use the same schema colors as the DBML.
- Sticky notes show the reading rule and process meaning.
- Layout is left-to-right so relationship lines cross less.

## Relationship Rule

`Ref: left_table.foreign_key > right_table.owner_key`

The left side is the table that stores the foreign key. The right side is the
owner table being referenced.

## Rule

Print one ERD per page. If a diagram becomes unreadable, split the feature into
a narrower process ERD instead of reintroducing a full all-table diagram.
