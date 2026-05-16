# DoctoLeb Core Context

Last updated: 2026-05-14

## Product Shape
DoctoLeb is a multi-tenant clinic SaaS. It has one SaaS admin/control-plane app, one shared patient web app, one shared clinic-ops app, and a future Flutter mobile app. Each clinic/doctor becomes a tenant; tenants share the web deployments but keep clinical data inside their own Supabase project.

## Current Surfaces
| Surface | Path | Purpose |
|---|---|---|
| SaaS control plane | `apps/control-plane` | Tenant registry, provisioning, routing, branding, entitlements, audit. |
| Patient web | `apps/patient-web` | Patient landing, login, profile, booking, consent, messaging. |
| Clinic ops | `apps/clinic-ops` | Doctor, secretary, and predoctor operations. |
| Marketing | `apps/marketing` | SaaS landing and future subscription/onboarding entry. |
| Shared core | `packages/core` | Services, schemas, auth helpers, tenant resolver logic. |
| Shared UI | `packages/ui` | Tenant bootstrap, reusable components, runtime branding wrappers. |

## Tenancy Model
The default production model is one Vercel deployment per app surface, not one Vercel project per doctor. Routing chooses the tenant at runtime.

| Mode | Patient URL | Ops URL |
|---|---|---|
| No-domain path | `https://doctoleb-patient-web.vercel.app/t/<slug>` | `https://doctoleb-clinic-ops.vercel.app/t/<slug>` |
| Custom domain later | `https://<slug>.doctoleb.com` | `https://<slug>.ops.doctoleb.com` |

The public resolver supports host routing and `/t/:tenantSlug` routing. Only active tenants should resolve. Draft, provisioning, inactive, suspended, or unknown tenants fail closed.

## Data Boundary
| Area | Location | PHI? | Rule |
|---|---|---:|---|
| Tenant registry, domains, plan, entitlement state | Control-plane Supabase | No | Zero-PHI metadata only. |
| Provisioning jobs, steps, secret references, audit | Control-plane Supabase | No | Store references and safe status, not raw secrets. |
| Patients, doctors, appointments, encounters, messages, documents | Tenant Supabase | Yes | Clinical data stays in the tenant project. |
| Runtime branding and feature flags | Tenant Supabase plus safe control-plane projection | Low/no | Apps read at runtime; no redeploy needed. |

Provider connections, tenant database URLs, service-role keys, and management tokens are server-only. Admin APIs can store, verify, rotate, revoke, and archive secret references, but browser responses must never include raw provider tokens or tenant credentials.

## Tenant Setup Flow
The current flow is SaaS-admin-assisted. The desired next product phase is doctor self-serve onboarding after subscription.

1. SaaS admin creates a tenant draft from `+ New tenant`.
2. Admin links or creates a tenant Supabase project.
3. Admin stores server-only tenant DB connection and service key in control-plane Vault.
4. Control-plane runner applies tenant migrations and records the migration ledger.
5. Runner seeds clinic profile, branding, first doctor/admin, runtime config, and no-domain routing.
6. Tenant activates at `/t/<slug>` for patient and ops.

Cancelled provisioning jobs stay terminal for audit. Recovery creates a new resume ledger, carries forward safe checkpoints, and keeps completed steps auditable and compensatable.

## Doctor Self-Serve Target
This is not fully implemented yet. The target flow is: doctor lands on the SaaS marketing site, selects a plan, pays through Stripe, creates an owner account, fills clinic/doctor/branding/domain information, and gets a tenant draft automatically. The SaaS admin should supervise and troubleshoot, not manually type every doctor’s business profile.

## Auth Reality
Tenant Auth is Supabase Auth inside each tenant project. First doctor/admin setup uses server-side tenant credentials. Email delivery can be password, OTP code, or magic link depending on tenant Auth configuration and templates. Production needs real SMTP/provider configuration; default Supabase email can rate-limit and may redirect to localhost if URL configuration is wrong.

Staff lifecycle is server-owned and undoable through Edge Functions/RPCs, not browser table writes. Current function contracts include `staff-invite`, `staff-invite-resend`, `staff-invite-reissue`, `staff-member-disable`, and `staff-member-reactivate`.

## Current ERD Set
Keep the curated feature/process ERDs only. These are the figures meant for documentation and PDF export:

| Figure | File |
|---|---|
| Doctor/provider detail | `docs/erd/views/10-doctor-provider-detail.dbml` |
| Patient record detail | `docs/erd/views/11-patient-record-detail.dbml` |
| Appointment booking detail | `docs/erd/views/12-appointment-booking-detail.dbml` |
| Clinical actions detail | `docs/erd/views/13-clinical-actions-detail.dbml` |
| Predoctor precheck process | `docs/erd/views/14-predoctor-precheck-process.dbml` |
| Messaging and notification process | `docs/erd/views/15-messaging-notification-process.dbml` |
| Billing and insurance process | `docs/erd/views/16-billing-insurance-process.dbml` |
| Staff lifecycle process | `docs/erd/views/17-staff-lifecycle-process.dbml` |
| Runtime branding, consent, feature process | `docs/erd/views/18-runtime-branding-consent-feature-process.dbml` |
| SaaS tenant provisioning process | `docs/erd/views/19-saas-tenant-provisioning-process.dbml` |

Render them with:

```bash
npm run render:erd-views
```

## Graduation Documentation
Use `docs/graduation/README.md` as the clean guide and `docs/graduation/06-erd-and-data-model.md` for the ERD chapter. Avoid resurrecting old tier plans, old audit dumps, or full-schema diagrams unless a reviewer explicitly asks for historical evidence.

## Current Risk Areas
| Area | Status |
|---|---|
| Tenant provisioning UX | Works better than before, still needs installer-quality simplification. |
| Tenant DB setup automation | Implemented direction exists; needs deep review for idempotency, Vault, retry, and unknown-schema refusal. |
| First doctor login | Needs final decision and proof for OTP vs magic link, redirect URL, SMTP, and code-entry UX. |
| Feature gating | UI hiding exists in places; every premium feature still needs backend/RLS/RPC enforcement proof. |
| CI/CD tiering | Implemented direction exists; needs deep review to avoid under-testing frontend/backend contract changes. |
| Manual provider blockers | Real Supabase/Vercel provider automation still needs credentials, region/org/cost choices, rollback, and audit design. |
| Future platform | Stripe, Firebase FCM, Flutter, LiveKit, and AI agents are planned, not launch-complete. |

## Commands
| Command | Purpose |
|---|---|
| `npm run dev` | Unified local app. |
| `npm run build:patient` | Patient app build. |
| `npm run build:ops` | Clinic ops build. |
| `npm run build:control-plane` | SaaS admin build. |
| `npm run test:unit` | Unit tests. |
| `npm run audit:backend-contract` | Backend/API safety contract audit. |
| `npm run audit:bundle-secrets` | Frontend bundle secret audit. |
| `npm run render:erd-views` | Render curated ERD SVGs. |

## What Not To Recreate
Do not recreate old tier plans, giant full-schema DBML, broad generated schema slices, or text-heavy diagram reports as primary docs. If a doc does not help a new engineer understand the current system or help the graduation report, it belongs in Git history, not the working documentation set.
