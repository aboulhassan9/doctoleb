# ADR-005: SaaS Admin, Entitlements, and Manual Provisioning Foundation

## Status
Accepted

## Date
2026-05-08

## Context
DoctoLeb is moving from a single clinical tenant into a SaaS model. The control-plane Supabase project `xouqxgwccewvbtkqming` already resolves tenant hostnames to tenant Supabase projects, while clinical tenant data remains in tenant projects such as `gezmfmskhmjgnquoyosq`.

The next phase needs a super-admin console, doctor-facing marketing page, subscription-ready feature control, and a safe path to creating new doctor tenants. The domain `doctoleb.com` is not purchased or verified yet, so production domain activation must remain pending.

## Decision
Create a zero-PHI SaaS control plane with:

- `apps/control-plane` as the future `console.doctoleb.com` super-admin app.
- Control-plane tables for `plans`, `plan_entitlements`, `tenant_entitlements`, and `tenant_provisioning_jobs`.
- Role-aware `super_admins` using `owner`, `operator`, `support`, and `billing_admin`.
- Admin Edge Functions for tenant list/detail/update, branding sync, entitlement sync, and provisioning jobs.
- A shared entitlement module that can be used by UI and server code to enforce feature access.
- A doctor-facing landing page on the marketing surface, separate from tenant patient portal boot.

The control plane stores SaaS metadata only. Branding and feature state are projected into each tenant database because tenant apps already read `tenant_profile`, `tenant_app_config`, and `feature_flags`. This avoids duplicating runtime app config as a second truth source.

## Consequences
- Super-admins can manage tenants without seeing PHI.
- Real `doctoleb.com` and tenant domains stay `pending` until DNS and SSL are verified.
- Billing can map to Stripe later through feature codes and plan entitlements without changing tenant app feature checks.
- Tenant config sync requires server-side tenant credentials in Edge Function secrets named `TENANT_SERVICE_ROLE_KEY_<TENANT_PROJECT_REF>`.
- V1 provisioning is manual-assisted through checklists; Supabase Management API automation is deferred until the checklist flow is stable.

## Alternatives Considered
### Store all branding and feature config only in the control plane
Rejected. Tenant apps would need to call both the control plane and tenant database at runtime, increasing failure modes and creating duplicate runtime truth.

### Build Stripe checkout before admin foundations
Rejected. Entitlement modeling is the dependency. Charging cards before plan/feature enforcement exists would create billing promises the app cannot reliably enforce.

### Activate placeholder domains now
Rejected. The domain is not owned or verified. Placeholder rows remain pending; only localhost smoke-test rows are active.
