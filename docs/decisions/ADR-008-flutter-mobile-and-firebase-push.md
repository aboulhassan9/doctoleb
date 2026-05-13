# ADR-008: Flutter Mobile Apps and Firebase Push Notifications

## Status
Accepted (architecture only — implementation deferred until web platform is stable)

## Date
2026-05-13

## Context

The DoctoLeb web stack (patient-web + clinic-ops) covers the primary
workflows but a real clinic experience needs native mobile clients:

- Patients want push notifications for appointment reminders, lab results,
  and clinic messages without keeping a browser tab open.
- Doctors want a thumb-friendly daily-schedule view and a fast way to take
  clinical notes between rooms.
- Pre-doctors and secretaries are mostly desk-bound — they stay on web.

A separate native codebase per platform (iOS Swift + Android Kotlin) more
than doubles maintenance cost for a small team. We need a single codebase
that ships to both stores.

Constraints inherited from earlier ADRs:

- Per-tenant database isolation (ADR-006).
- Zero PHI in the control plane (ADR-005).
- Tenant resolver is the single source of truth for which Supabase project
  a tenant connects to (ADR-004).
- Push payloads must never contain PHI.

Constraints from the mobile platforms:

- Apple App Store and Google Play require some level of clinical use-case
  documentation for medical apps. We must NOT claim diagnostic capability.
- Both stores require a working web demo before review.
- Apple's review can reject apps that show a "sign up" path inside the app
  without offering Sign in with Apple. We need to plan for that.

## Decision

Use **Flutter** for the mobile clients, **Firebase Cloud Messaging (FCM)**
for push, and the **same Supabase tenant resolver + tenant DB** the web
stack already uses. No new auth system, no new tenancy model.

### Architecture

```
┌──────────────────────┐
│  Flutter app         │
│   (patient + doctor) │
└──────────┬───────────┘
           │ 1. Resolve tenant via control-plane HTTP
           │    GET tenant-resolve?host=<tenant>.doctoleb.com&surface=patient
           ▼
┌──────────────────────┐
│  Control plane       │
│  (zero PHI)          │
└──────────┬───────────┘
           │ returns { supabaseUrl, supabaseAnonKey, slug, surface }
           ▼
┌──────────────────────┐
│  Tenant Supabase     │
│  (PHI, RLS-protected)│
└──────────┬───────────┘
           │ all clinical reads/writes go here
           │
           │ tenant DB also stores FCM registration tokens
           │ (table: patient_devices.push_token already exists)
           ▼
┌──────────────────────┐
│  FCM (Firebase)      │
│  push only, no PHI   │
└──────────────────────┘
```

### Single Flutter app or two?

**One app, role-aware.** Same logic web uses: after sign-in we read the
user's role from `users.role` and route into the patient or doctor flow.
Reasons:

- Halves App Store / Play review work.
- Halves crash analytics noise.
- The two surfaces share auth, tenant resolution, push setup, and brand
  loading — splitting them duplicates plumbing.

Pre-doctors and secretaries are explicitly out-of-scope for mobile v1.
They get a "use the web ops portal" landing screen if they sign in on
mobile.

### Auth flow

Same `signInWithOtp` / `signInWithPassword` Supabase Auth that web uses.
Flutter's `supabase_flutter` package supports both. Native Sign in with
Apple is required for App Store approval and slots in cleanly alongside
the OTP path.

### Push notification flow

1. App requests notification permission on first launch after sign-in.
2. App fetches the FCM token via `firebase_messaging`.
3. App POSTs the token to the **tenant DB** via the existing
   `patient_devices` table (or `doctor_devices` for doctor role — to be
   added if needed).
4. **Server-side** logic (DB trigger or Edge Function) calls FCM with a
   PHI-free payload: never include patient names, diagnoses, lab results,
   or message bodies. Only generic strings like "New message" with a
   deep-link URL.
5. Tapping the notification opens the app to the deep link, which loads
   the real (PHI-containing) data over the authenticated Supabase session.

### Tenant routing on mobile

Custom-domain detection on web works because the browser already knows
the host. Mobile has no host — it's just `com.doctoleb.app` opening.
Two options:

- **Tenant slug as a login screen field.** Doctor types "assad" before
  email. Simple, works for any tenant.
- **Magic link / deep link with slug embedded.** From the post-payment
  onboarding email, link includes `?tenant=assad`. App pre-fills the slug.

Use both — typing is the fallback, deep links are the happy path.

## Security Rules

- **Push payloads never contain PHI.** Subject lines, bodies, message
  previews, patient names — none of them. The app re-fetches over the
  authenticated channel.
- **FCM tokens are tenant-scoped.** Stored in `patient_devices` (per
  tenant). When a doctor switches clinics (rare but possible), the old
  tenant's token registration is invalidated.
- **Firebase service-account credentials live in the tenant Supabase
  project's secrets** — they never ship with the mobile app. The Edge
  Function (or DB trigger) running on behalf of the tenant calls FCM.
- **No backdoor sign-in via Firebase Auth.** Authentication is Supabase
  Auth only. Firebase is for push delivery, nothing else.
- **App Store / Play submission must not include real PHI in screenshots
  or video.** Use the test clinic with synthetic data.

## Reversibility

- Killing the mobile track at any point leaves the web stack fully
  functional.
- Switching push providers (FCM → APNs direct, or to OneSignal) requires
  changing the server-side push helper only — `patient_devices.push_token`
  is provider-agnostic.
- Logging out a device deletes its FCM registration row.

## Open questions

- **Build framework:** Flutter is the call here. Open: do we use FlutterFlow
  or hand-code? Hand-coding gives full control but is slower; FlutterFlow
  is faster but locks us into their tooling.
- **Offline support:** how much clinical data should the doctor app cache
  locally? Cached PHI on a lost phone is a real risk. For v1, no offline
  caching beyond what `supabase_flutter` does in-memory.
- **Background sync:** doctor schedule changes between visits. Polling
  every N minutes is simplest; subscribing via Supabase Realtime in the
  background is more elegant but battery-heavy.

## Consequences

- One mobile codebase, two surfaces, single review pipeline per store.
- Push works without inventing a new messaging system.
- We need a Firebase project (one, not per-tenant) and a server-side push
  helper. The helper takes a notification spec and a list of device
  tokens, calls FCM, records delivery status.
- We need to add `doctor_devices` (or merge into a single `user_devices`)
  table to the tenant schema before the doctor flow can push.
- We need a runbook for store submission (Apple developer account,
  privacy nutrition labels, medical use disclaimer text).

## Alternatives Considered

### React Native

Rejected. Our team has more Flutter familiarity. React Native would let us
share more code with the web stack, but neither stack actually shares much
beyond service contracts (which are already typed via Zod and accessible
from any language via the resolver).

### Two separate native codebases (Swift + Kotlin)

Rejected. Doubles maintenance for a small team. Reconsider if usage grows
to the point where native-only features become a real product lever.

### Web only, no mobile

Rejected. Push notifications are the main reason patients churn from
clinics that "feel disconnected." Mobile is table stakes within ~12 months
of launch.

### Different push provider per tenant (e.g., bring-your-own FCM)

Rejected. Operational complexity for negligible benefit. One DoctoLeb-owned
Firebase project serves all tenants; topics and token-based addressing
keep tenant isolation.
