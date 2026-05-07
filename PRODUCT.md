---
product: "DoctoLeb"
mode: "PRODUCT"
scope: "single-clinic multi-doctor"
roles:
  - patient
  - doctor
  - predoctor
  - secretary
  - admin
brand_personality:
  - calm
  - trustworthy
  - efficient
---

# Product Summary

DoctoLeb V1 is the operating system for one specific clinic with multiple doctors. It is not a marketplace, not a multi-tenant SaaS, and not a doctor-discovery product. Patients can self-register from the public website, while staff accounts are created through trusted internal clinic workflows.

The product should be split into separate deployable user surfaces:

- **Patient Web**: the public clinic website plus patient portal.
- **Clinic Operations**: the internal doctor, secretary, predoctor, assistant/nurse, and clinic-admin app.
- **Flutter Patient App**: later mobile client using the same patient-facing backend contracts.
- **SaaS Control Plane**: later DoctoLeb-owner/super-admin app with no PHI.

The clinic-admin role is internal to the clinic tenant. It is not the SaaS super-admin.

The product exists to reduce friction across the full visit lifecycle: patient signup, scheduling, pre-check, consultation, documentation, billing, and follow-up. The interface has to support both patient confidence and staff speed, with most day-to-day complexity living in doctor, predoctor, and secretary workflows.

## Primary Audiences

### Patients

- Book appointments
- Review upcoming visits
- Access personal profile and medical history
- Trust that the clinic feels legitimate, secure, and easy to use

### Doctors

- Review schedules quickly
- Open patient context without hunting
- Document encounters, orders, referrals, reports, and certificates
- Move through clinical work without visual clutter

### Pre-Doctor Staff

- Prepare patients before the doctor visit
- Record triage and intake information
- Track appointments and notifications
- Keep flows predictable and low-error

### Secretaries

- Search or create patient records
- Book and manage appointments
- Manage slots, billing, and front-desk throughput
- Resolve operational tasks with minimal clicks

### Clinic Admin / Owner

- Maintain doctor-branded presentation
- Keep tenant profile, app config, and public trust surfaces coherent
- Ensure the product feels professional enough to represent the clinic directly
- Manage staff, mobile-facing configuration, consent/content surfaces, and operational settings from the clinic operations app

## Core Product Jobs

1. Help a patient request or confirm care without confusion.
2. Help front-desk staff schedule accurately and fast.
3. Help clinicians move from appointment to encounter to document with minimal friction.
4. Help the clinic present a trustworthy digital front door.
5. Preserve privacy, reliability, and operational clarity across every role.

## Brand Personality

The product should feel:

- Calm: never frantic, noisy, or gimmicky
- Trustworthy: clinical, secure, and professionally restrained
- Efficient: clear hierarchy, obvious actions, low cognitive drag

## UX Constraints

- This is a clinic product, so errors carry real operational cost.
- Role-based flows matter more than visual novelty.
- Marketing surfaces must match the actual product model and avoid inflated claims.
- The system should feel doctor-owned, not generic template SaaS.
- Dense workflows are acceptable on staff pages when they improve speed and comprehension.

## Non-Goals

- No public doctor onboarding marketplace
- No multi-clinic switching UX
- No exaggerated AI-first positioning unless the feature is truly implemented
- No consumer-social tone or decorative novelty that weakens trust
- No staff/admin login flow as part of the patient landing-page journey
- No SaaS super-admin PHI access inside the clinic operations app

## Design Implications

- Product pages should prioritize hierarchy, scanning, and state clarity.
- Public pages should create confidence without overselling scale or features.
- Visual polish matters, but it must always reinforce accuracy, calm, and speed.
