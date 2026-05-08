# ADR-006: Provider-Connected Tenant Provisioning

## Status
Accepted

## Date
2026-05-08

## Context
DoctoLeb tenant creation must become fast enough for a super-admin to create a new doctor tenant without copying apps, hand-editing repeated config, or forcing every tenant into DoctoLeb-owned infrastructure.

The product requirement is provider-flexible:

- A tenant can be hosted in DoctoLeb-owned Supabase/Vercel accounts.
- A tenant can be hosted in a customer-owned or partner-owned Supabase/Vercel account after that account is authorized.
- The SaaS console should make tenant creation feel like a guided workflow, but not leak management credentials, service-role keys, or provider tokens to the browser.

The current v1 console already creates a zero-PHI tenant draft and provisioning checklist. This ADR defines the backbone for the next step: provider-connected automation.

## Decision
Add a provider-agnostic provisioning layer to the control plane:

- Store provider account handles in `provisioning_provider_connections`.
- Store only account metadata, capabilities, status, and a server-side `secret_ref`; never raw tokens.
- Link `tenant_provisioning_jobs` to the selected Supabase and Vercel provider connections.
- Track each automation step in `tenant_provisioning_steps` with idempotency keys, preconditions, postconditions, external resource ids, and undo metadata.
- Keep all writes behind authenticated admin Edge Functions and service-role-only RPCs.
- Keep v1 manual-assisted provisioning working while allowing later `assisted` and `automatic` modes.

This supports both near-term and future flows:

- Near term: super-admin creates a tenant draft, selects a connected provider account, and records assisted/manual steps.
- Next phase: Edge Functions call provider APIs to create or configure resources from the stored server-side secret references.
- Later: OAuth/install flows can let a customer connect their own Supabase/Vercel accounts without giving DoctoLeb a raw token in chat or frontend code.

## Security Rules
- Browser code never receives provider tokens, Supabase service-role keys, Vercel bearer tokens, management tokens, or customer credentials.
- Control-plane tables store secret references only.
- Raw provider errors must be sanitized before saving as `last_error_summary`.
- Provisioning step payloads must contain only safe metadata required for rollback or audit.
- Tenant clinical data remains only in tenant Supabase projects.
- A failed or cancelled provisioning job must leave enough metadata to retry, compensate, disable, or archive the tenant safely.

## Provider Integration Notes
- Supabase project automation must use the Supabase Management API with an authorized access token, and those credentials stay server-side.
- Supabase Vault is an acceptable secret store for encrypted database-side secret references.
- Vercel project/domain/env automation must use Vercel API access with the correct account/team scope.
- Vercel environment variable updates must be followed by a deployment before the new values affect production bundles.

Reference docs:

- Supabase Management API: https://supabase.com/docs/reference/api/create-a-project
- Supabase Vault: https://supabase.com/docs/guides/database/vault
- Vercel REST API integrations: https://vercel.com/docs/integrations/create-integration/vercel-api-integrations
- Vercel project environment variables API: https://vercel.com/docs/rest-api/reference/endpoints/projects/create-one-or-more-environment-variables

## Reversibility
Every provisioning step needs an explicit undo model before automation is enabled:

- Supabase project created: record project ref and expected rollback strategy, usually disable/archive or manual review before destructive deletion.
- Tenant migrations applied: record schema version and migration batch.
- Tenant runtime config written: record previous value and `restore_previous_value`.
- Vercel env updated: record previous value and `restore_previous_value`, then mark a redeploy requirement.
- Domain attached: record domain/project ids and `disable_external_resource` or manual DNS review.
- Tenant activated: record previous status and allow rollback to `inactive`, `suspended`, or `archived`.

## Consequences
- Tenant onboarding can become fast without tying all tenants to one infrastructure account.
- Provider account authorization becomes a first-class SaaS operation.
- The control plane remains zero-PHI.
- Automation can be introduced step-by-step without replacing the existing manual checklist.
- We must build connection/auth Edge Functions before enabling `automation_mode='automatic'` in the UI.

## Alternatives Considered
### Store provider tokens directly in control-plane tables
Rejected. Even encrypted columns would make accidental selection, logging, or frontend exposure more likely. The database stores references; secret values stay in server-controlled secret stores.

### Use only DoctoLeb-owned Supabase and Vercel accounts
Rejected. This is simpler today but violates the requirement that customers or partners can host in their own accounts.

### Create one Vercel project per tenant by default
Rejected for v1. Current runtime resolver allows shared patient/ops deployments. Per-tenant Vercel projects may be supported later for enterprise/customer-owned hosting, but should not be required for normal SaaS onboarding.
