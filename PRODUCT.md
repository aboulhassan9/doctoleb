# DoctoLeb Product Context

DoctoLeb is a production-bound clinic management system for one clinic with multiple doctors. It is not a marketplace and not a public SaaS onboarding product in V1. Patients can self-register through the patient-facing web app, while staff accounts are internal clinic accounts created through trusted clinic workflows.

## Product Model

- One clinic, multiple doctors.
- Patient self-registration is allowed.
- Staff roles include doctor, predoctor, secretary, and future clinic admin.
- Future SaaS/control-plane work must remain separate from clinical tenant data and must stay zero-PHI.
- DoctoLeb does not support public doctor self-registration, clinic marketplace discovery, tenant switching, or clinic subscription checkout in the V1 patient/staff apps.

## Primary Audiences

- Patients who need a calm way to register, book appointments, review messages, access records, and understand billing.
- Doctors who need fast clinical context, encounter workflows, patient history, documents, reports, prescriptions, referrals, and daily/weekly/monthly appointment views.
- Predoctors or assistants who need safe intake, precheck, queue, triage, and handoff workflows.
- Secretaries who need reliable scheduling, patient registration, billing, certificates, operational follow-up, and front-desk clarity.
- Clinic admins who may later manage clinic settings, staff, schedules, branding, and operational configuration.

## Core Experience Goals

- Reduce anxiety for patients with plain language, visible state, and calmer flows.
- Increase speed and accuracy for staff with dense, scannable, operational UI.
- Keep clinical, financial, and identity workflows safe by default.
- Make every important action reversible, auditable, or recoverable where the domain allows.
- Preserve one canonical backend/API/service contract instead of duplicating logic per app.

## Architecture Reality

- `apps/patient-web/` owns public routes, patient authentication, registration, patient booking, and patient portal surfaces.
- `apps/clinic-ops/` owns internal doctor, predoctor, secretary, and clinic operations surfaces.
- `packages/core/` owns shared business logic, services, schemas, hooks, selectors, state machines, and Supabase client boundaries.
- `packages/ui/` owns shared primitives and layout components that are genuinely reusable across apps.
- Pages and components must not contain raw Supabase calls, authorization decisions, or business rules.

## Current Design Posture

DoctoLeb should feel calm, clinical, trustworthy, and operationally serious. Patient-facing surfaces can be warmer and more editorial, especially onboarding, booking, timeline, and billing. Staff-facing surfaces should prioritize clarity, density, keyboard flow, and fast scanning over decorative atmosphere.

The Stitch project `9966518933119406027` is useful as patient-experience inspiration, not as a source of production code or a reason to change the backend/API plan.
