# ADR-007: Stripe Billing and Tenant Lifecycle

## Status
Accepted (architecture only — implementation deferred pending merchant account setup)

## Date
2026-05-13

## Context

DoctoLeb has reached the point where the provisioning machine can stand up a
new tenant end-to-end (project creation, migrations, Auth normalization,
first-doctor invite). The remaining gap before public self-serve onboarding
is the **commercial layer**: how a doctor signs up, pays, and gets routed
into the provisioning pipeline without a SaaS admin touching the control
plane.

Constraints inherited from earlier ADRs:

- Zero PHI in the control plane (ADR-005).
- Per-tenant database isolation (ADR-006).
- Reversibility on every state transition.
- Browser code never receives provider tokens (ADR-006).

Constraints inherited from product:

- Subscription billing, not per-action billing.
- Free trial period may exist but is not required for launch.
- Cancellations must preserve patient data export rights.
- Failed payments suspend tenant access but do not delete data.

## Decision

Use **Stripe Checkout + Stripe Billing** with a **webhook-driven** integration
into the existing provisioning machine. No raw Stripe credentials in browser
code. No card data touches DoctoLeb servers — Stripe Checkout handles PCI
scope.

### Architecture

```
[Marketing CTA] → [public Edge Function: create-checkout-session]
                   → Stripe Checkout session URL → redirect

[Stripe payment success]
  → Stripe webhook `checkout.session.completed`
  → [public Edge Function: stripe-webhook] (signature-verified)
    → calls admin_create_tenant_draft RPC (service-role)
    → seeds provisioning_provider_connections selection
    → marks tenant_provisioning_jobs.automation_mode = 'automatic'
    → kicks off the existing 11-step provisioning machine

[Recurring billing events]
  → customer.subscription.updated   → update tenant_subscriptions row, sync entitlements
  → customer.subscription.deleted   → tenant status → 'cancelled' (data retained)
  → invoice.payment_failed          → tenant status → 'suspended' with grace period
  → invoice.payment_succeeded       → re-activate suspended tenants automatically
```

### Schema additions (deferred until first Stripe integration commit)

- `tenant_subscriptions` (control plane) — `tenant_id`, `stripe_customer_id`,
  `stripe_subscription_id`, `stripe_price_id`, `status`, `current_period_end`,
  `cancel_at_period_end`, lifecycle timestamps.
- `tenants.stripe_customer_id` for fast lookup.
- `plans.stripe_price_id_monthly`, `plans.stripe_price_id_yearly` for
  plan↔price mapping (server-side; the browser never sees the price ID).

### Plan-to-entitlement mapping

The `plan_entitlements` table already exists from ADR-005. Stripe price IDs
map to `plans.code`, and `plan_entitlements` then drives feature visibility.
No new tables needed on the entitlement side.

### Free trial handling

When (if) we offer a trial: Stripe `trial_period_days` is the source of truth.
`tenant_subscriptions.status` reflects Stripe's `trialing`. Tenant is
provisioned and fully active during trial. On `trial_will_end` (3-day warning
webhook) we email the doctor. On trial conversion failure
(`invoice.payment_failed` after trial), we follow the normal suspended-tenant
path.

## Security Rules

- **Stripe webhook signature verification is non-negotiable.** Every request
  to `stripe-webhook` MUST be verified against `STRIPE_WEBHOOK_SECRET` before
  any DB mutation. Unsigned or wrong-signature requests return 401 and are
  never persisted.
- **`STRIPE_SECRET_KEY` lives in Edge Function env, never in browser bundles
  or repo.** `create-checkout-session` uses it server-side to create sessions.
- **The browser only ever receives the Checkout session URL** (and later the
  `publishable_key` if we ever embed Stripe Elements — not planned).
- **No Stripe customer email is ever cross-referenced with patient records
  in the control plane.** The Stripe customer is the *clinic owner*, not a
  patient. PHI isolation is preserved.
- **The `stripe-webhook` Edge Function runs with `verify_jwt=false`** because
  Stripe does not send a Supabase JWT. Authentication is Stripe-signature only.

## Provisioning trigger contract

`stripe-webhook` does NOT inline the provisioning steps. It only:

1. Verifies the signature.
2. Looks up or creates a `super_admins` synthetic actor ("stripe-webhook-bot")
   for audit attribution.
3. Calls `admin_create_tenant_draft_atomic` with the supplied slug + display
   name + contact email + `automation_mode='automatic'` + pre-selected
   provider connection ids (from env).
4. Returns 200 to Stripe to acknowledge.

The provisioning machine then runs asynchronously, with status visible in the
super-admin console. Doctor gets a "your clinic is being prepared" email
immediately and a "your clinic is ready, click here to log in" email when
`activate_tenant` completes.

## Reversibility

- **Refund / partial refund** — managed entirely in Stripe; our side does
  not change tenant state until the subscription itself is cancelled.
- **Subscription cancellation (immediate)** — `customer.subscription.deleted`
  fires; we set tenant status to `cancelled`. The tenant DB is **archived,
  not deleted**, for at least 30 days. After 30 days the SaaS admin can
  trigger the deletion runbook (out of scope for v1).
- **Cancellation at period end** — `cancel_at_period_end=true` does not change
  tenant state until the period actually ends and the cancellation webhook
  fires.
- **Failed payment recovery** — once `invoice.payment_succeeded` fires after
  a suspension, tenant flips back to active automatically. No human required.

## Open questions

- **Trial vs. paid-only at launch?** Product owner to decide. The architecture
  supports both.
- **Self-serve plan upgrades / downgrades?** Stripe Customer Portal handles
  this on the doctor's side. Our side just listens for
  `customer.subscription.updated`.
- **Multiple Stripe products vs. one product with multiple prices?** One
  product (DoctoLeb) with multiple prices (Solo monthly, Solo yearly,
  Practice monthly, etc.) — cleaner for tax reporting and analytics.

## Consequences

- We now have a clear path to public self-serve onboarding without exposing
  any DoctoLeb-side secrets.
- The provisioning machine remains the single source of truth for tenant
  lifecycle — Stripe only triggers and updates state.
- We need to add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` env vars to
  the control-plane Supabase project before the first Stripe-integrated
  release.
- We need a Stripe merchant account in good standing (Lebanon entity or
  whichever jurisdiction we settle on) before this can go live.

## Alternatives Considered

### Lemon Squeezy (merchant-of-record)

Rejected for launch. Lemon Squeezy would simplify Lebanon tax compliance
(they handle VAT) but adds a layer between us and our customers. We may
revisit if Stripe coverage in target markets is poor.

### Self-hosted billing (e.g., Killbill, Stripe Atlas without Checkout)

Rejected. PCI scope and operational burden are not worth it for our scale.
Stripe Checkout keeps card data entirely off our servers.

### Per-feature pay-as-you-go billing

Rejected. Clinics need predictable monthly costs; metered billing creates
friction.
