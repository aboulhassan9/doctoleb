# ADR-003: Tenant Branding Comes From Configuration

## Status
Accepted

## Date
2026-05-07

## Context
DoctoLeb is moving toward a tenant-branded model: each clinic/doctor tenant gets its own patient web, clinic operations app, and later Flutter patient app. The tenant-facing products must not hardcode the doctor name, clinic name, logo, favicon, color palette, app copy, or mobile configuration inside React pages.

Hardcoding tenant identity creates four problems:

- New tenant launch requires code changes instead of configuration.
- Patient web, clinic operations, and Flutter can drift visually.
- Future SaaS/control-plane provisioning becomes fragile.
- Agents may accidentally ship fake doctor names, fake logos, or prototype colors.

## Decision
Tenant branding and app configuration are canonical data, not UI constants.

Inside each tenant Supabase project, the canonical tables are:

- `tenant_profile`: tenant identity, slug, status, locale, schema/version metadata.
- `tenant_app_config`: app name, tagline, logo URLs, icon URL, colors, support contact, enabled locales, mobile version gates, maintenance message.
- `feature_flags`: feature visibility/configuration by audience.
- `content_pages`: tenant-controlled public/patient copy.
- `consent_documents`: tenant-controlled legal/consent content.

The public-safe read path is `get_public_tenant_app_config()`. It is intentionally callable by `anon` because the patient landing page, signup page, and mobile splash screen need safe branding before login.

The future SaaS super-admin/control-plane app is responsible for tenant provisioning:

1. Create or select the tenant Supabase project.
2. Apply the tenant schema migrations.
3. Seed `tenant_profile` and `tenant_app_config`.
4. Seed public content, consent documents, feature flags, and default catalogs.
5. Deploy or configure the patient web domain, clinic-ops domain, and mobile app runtime config.

The SaaS control plane must store no PHI. It may store tenant routing/provisioning metadata such as project ref, domain, plan, status, and schema version.

## Runtime Contract
All tenant-facing clients must consume configuration through shared contracts:

```txt
tenant_profile + tenant_app_config
    -> get_public_tenant_app_config()
    -> tenantConfigService.getPublicConfig()
    -> BrandProvider / useBrand()
    -> patient-web, clinic-ops, Flutter bootstrap
```

For web:

- `BrandProvider` applies app name, tagline, favicon, document title, meta description, and theme variables at runtime.
- Tailwind semantic colors use CSS variables so `bg-primary`, `text-primary`, and related utilities follow tenant colors.
- Static HTML may use only neutral fallback titles and descriptions while JavaScript loads.

For mobile:

- Flutter startup must call the same public config endpoint/RPC or an equivalent edge wrapper.
- Mobile theme colors, logo, app name, enabled locales, maintenance mode, and force-update version must come from tenant config.
- Mobile must not duplicate tenant theme constants in the app binary except as neutral boot fallbacks.

## Guardrails
- Do not hardcode a real doctor/clinic name in UI pages.
- Do not hardcode tenant logos, favicons, support phone/email, or color palettes in app code.
- Do not add new branding tables unless `tenant_profile` and `tenant_app_config` are proven insufficient.
- Do not expand legacy `doctor_brand`; it is deprecated by the Tier 2 tenant config model.
- Do not expose PHI through the public config RPC.
- Use neutral development fallbacks only, such as `Clinic Portal`, never fake names like `Dr. Smith`.

## Consequences
- Tenant branding can be changed without rebuilding the frontend.
- Patient web, clinic operations, and Flutter can share one configuration source.
- Future tenant provisioning can become a repeatable super-admin workflow.
- Clinic admin UI may temporarily edit tenant config during development, but the long-term owner of initial tenant provisioning is the SaaS control plane.

