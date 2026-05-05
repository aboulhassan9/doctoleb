# ADR-001: Single-Clinic, Multi-Doctor Product Model

## Status
Accepted

## Date
2026-05-04

## Context
Earlier planning language mixed three different product models:
- a one-clinic, one-doctor prototype
- a single clinic with staff and multiple doctors
- a SaaS or marketplace where clinics/doctors could self-onboard

Those models lead to different routing, permissions, signup, RLS policies, and onboarding flows. The codebase needs one product boundary so future work does not add the wrong abstractions.

## Decision
DoctoLeb V1 is the management system for one specific clinic with multiple doctors.

Patients may self-register from the public website. Staff accounts (`doctor`, `predoctor`, `secretary`, and future `admin`/clinic manager) are internal accounts created by a trusted clinic workflow.

DoctoLeb V1 is not SaaS:
- no tenant onboarding
- no public doctor self-registration
- no clinic subscription/customer billing layer
- no cross-clinic marketplace or doctor discovery
- no multi-clinic switching in the UI

## Consequences
- RLS should scope users by role and clinic data boundaries, but V1 does not need tenant isolation tables beyond the existing clinic model.
- Any code assuming exactly one doctor is a temporary fallback and should be replaced with doctor selection or assigned-doctor logic.
- Public signup must create only patient accounts.
- Staff management remains a post-stabilization feature unless needed for testing; until then, staff can be created through trusted admin scripts or Supabase-managed flows.
- A future `admin` role means clinic manager, not SaaS/platform administrator.
