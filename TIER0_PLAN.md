# TIER 0 - Legacy Schema Expansion Plan (Superseded)

> **Status**: Superseded by `TIER0_V2_PLAN.md`.
> **Decision**: Do not continue this plan.
> **Reason**: It solved UI breakage by expanding the database to match stale frontend assumptions. After deeper review, that was the wrong direction for Secure Web V1.

---

## Why This Plan Was Rejected

The first Tier 0 plan proposed adding columns such as `consultations.symptoms`, `medical_reports.findings`, `certificates.patient_id`, referral priority fields, and external doctor-name fields. That would have made broken pages start working, but it also would have hidden the real problem: the frontend and services were querying columns that were not part of the live production schema.

The final Tier 0 decision is the opposite:

- Live Supabase schema is the source of truth.
- Code must stop querying ghost columns.
- New columns require a product/schema decision, not a quick patch to satisfy stale UI labels.
- Doctor credential certificates and patient medical certificates are different product concepts and should not be merged accidentally.
- Referrals to external doctors need an explicit design before making `to_doctor_id` nullable.

---

## What Happened In The Repo

The historical migration exists:

- `supabase/migrations/20260505_tier0_schema_alignment.sql`

It is intentionally superseded/reverted by:

- `supabase/migrations/20260505_tier0_v2_revert_schema_expansion.sql`

The authoritative Tier 0 record is now:

- `TIER0_V2_PLAN.md`

Do not reapply the legacy expansion migration as the intended product direction. It remains in history only so future agents understand why the approach changed.

---

## Current Tier 0 Rule

When code and DB disagree, do not guess.

1. Verify the live schema first.
2. If the code is using a stale/ghost field, fix the code.
3. If the product truly needs a new concept, write a new schema/product plan before adding columns.
4. Keep selectors explicit and safe; never use `select('*')` for sensitive joined data.

---

## Handoff

Tier 0 v2 completed the foundation alignment. Tier 1 then hardened service behavior and database operators on top of that clean schema contract. Tier 2 starts from the Tier 0 v2 + Tier 1 baseline.
