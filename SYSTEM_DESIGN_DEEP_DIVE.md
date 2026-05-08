# DoctoLeb · System Design Deep Dive

> **Scope:** technical companion to `HANDOFF_REVIEW_AND_STATUS.md`. Where the handoff is checklist-style, this document is reference-grade — meant to be the canonical source when an engineer asks "why is it built this way" or "how does X actually work end-to-end."
> **Audience:** any engineer or review agent who needs depth.
> **Read after:** `CLAUDE.md`, the four ADRs, `HANDOFF_REVIEW_AND_STATUS.md`.

---

## Table of contents

1. [System architecture — layered view](#1-system-architecture--layered-view)
2. [Tenancy model — why database-per-tenant](#2-tenancy-model--why-database-per-tenant)
3. [Authentication & authorization boundary](#3-authentication--authorization-boundary)
4. [The runtime layer (ADR-004) end-to-end](#4-the-runtime-layer-adr-004-end-to-end)
5. [Every new code file in this session — design rationale](#5-every-new-code-file-in-this-session--design-rationale)
6. [Supabase deep dive — both planes](#6-supabase-deep-dive--both-planes)
7. [API layer contracts](#7-api-layer-contracts)
8. [Future Flutter mobile app — design and contracts](#8-future-flutter-mobile-app--design-and-contracts)
9. [SaaS infrastructure operations](#9-saas-infrastructure-operations)
10. [Tradeoffs and rationale](#10-tradeoffs-and-rationale)
11. [Failure modes and recovery](#11-failure-modes-and-recovery)
12. [Glossary of patterns invoked](#12-glossary-of-patterns-invoked)

---

## 1. System architecture — layered view

```
                        ┌──────────────────────────────────────────────┐
                        │  Layer 0: Hostname & DNS                     │
                        │  Vercel / Cloudflare → SaaS-owned subdomains │
                        │  + per-tenant custom domains                 │
                        └──────────────────────────────────────────────┘
                                          │
                        ┌──────────────────────────────────────────────┐
                        │  Layer 1: Browser bootstrap (this session)   │
                        │  - classifyHostname() → surface + slug       │
                        │  - tenantResolverService.resolve()           │
                        │  - configureSupabaseClient(url, anonKey)     │
                        │  - <TenantBootstrap> renders splash/error/app│
                        └──────────────────────────────────────────────┘
                                          │
                        ┌──────────────────────────────────────────────┐
                        │  Layer 2: React provider stack               │
                        │  Theme → Sidebar → Toast →                   │
                        │  TenantBootstrap → Auth → Brand →            │
                        │  [PatientConsentGate] → ErrorBoundary →      │
                        │  Router → Routes → Pages                     │
                        └──────────────────────────────────────────────┘
                                          │
                        ┌──────────────────────────────────────────────┐
                        │  Layer 3: Service layer (canonical)          │
                        │  19 services in packages/core/services/      │
                        │  Envelope: { data, meta?, error }            │
                        │  Wrapper: apiCall / apiPaged                 │
                        │  Validation: parseWithSchema (Zod)           │
                        └──────────────────────────────────────────────┘
                                          │
                        ┌──────────────────────────────────────────────┐
                        │  Layer 4: Supabase JS client                 │
                        │  Routed through Proxy shim → runtime client  │
                        │  .from / .rpc / .auth / .storage / .channel  │
                        └──────────────────────────────────────────────┘
                                          │
                        ┌──────────────────────────────────────────────┐
                        │  Layer 5: PostgREST + Auth + Realtime        │
                        │  Anon JWT vs Authenticated JWT               │
                        │  RLS policies enforced at row level          │
                        │  RPCs (SECURITY DEFINER) for transactions    │
                        └──────────────────────────────────────────────┘
                                          │
                        ┌──────────────────────────────────────────────┐
                        │  Layer 6: Postgres                           │
                        │  - Triggers (status enforcement, redaction)  │
                        │  - Helper functions (is_staff, has_role,…)   │
                        │  - Indexes, partial indexes                  │
                        │  - Storage objects (RLS-scoped)              │
                        └──────────────────────────────────────────────┘
```

**Two parallel Supabase projects, not co-tenant:**

```
┌─────────────────────────────────┐    ┌─────────────────────────────────┐
│  Tenant DB (per doctor)         │    │  Control plane DB               │
│  gezmfmskhmjgnquoyosq            │    │  xouqxgwccewvbtkqming            │
│                                 │    │                                 │
│  57 tables (PHI)                │    │  4 tables (no PHI)              │
│  75 triggers                    │    │  - tenants                      │
│  216 RLS policies               │    │  - tenant_domains               │
│  34 RPCs                        │    │  - super_admins                 │
│  - 5 mobile-only RPCs           │    │  - tenant_events                │
│  - lifecycle RPCs               │    │  + resolve_tenant() RPC         │
│  - helper functions             │    │  + is_super_admin() helper      │
│                                 │    │  + tenant-resolve Edge Function │
│                                 │    │    (version 2, public resolver) │
│  Bucket: clinical-documents     │    │                                 │
│  Bucket: message-attachments    │    │  Auth: super-admins only        │
│                                 │    │                                 │
│  Auth: tenant patients + staff  │    │  Authenticated callers can read │
│                                 │    │  the registry (super-admin)     │
│                                 │    │                                 │
│                                 │    │  Anon callers can ONLY call     │
│                                 │    │  resolve_tenant() RPC           │
└─────────────────────────────────┘    └─────────────────────────────────┘
```

The **only** edge between them: the control-plane resolver returns the tenant DB's URL + anon key. The browser then talks directly to the tenant DB, never via the control plane.

Activation status as of 2026-05-08: `xouqxgwccewvbtkqming` is the live zero-PHI SaaS/control-plane project. `gezmfmskhmjgnquoyosq` remains the first clinical tenant DB under slug `dev`. Local resolver smoke hosts (`localhost:3001`, `localhost:3002`) are active. Future public hostnames (`dev.doctoleb.com`, `dev.ops.doctoleb.com`) are placeholder rows only and intentionally remain `pending` until the domain is purchased and DNS/SSL are verified.

---

## 2. Tenancy model — why database-per-tenant

### 2.1 The decision

DoctoLeb adopted **database-per-tenant** (one Supabase project per doctor) instead of multi-tenant-shared-DB. ADRs 001/002/003/004 explicitly reject `tenant_id` columns inside any tenant DB table.

### 2.2 Why

| Concern | Shared DB w/ `tenant_id` | Database-per-tenant |
|---|---|---|
| **PHI isolation** | One bad RLS policy leaks every tenant. Audit cost: high. | One bad policy leaks one tenant only. Each project has its own auth + role hierarchy. |
| **Backups & PITR** | Shared. Restoring one tenant requires app-level filtering. Risky and slow. | Per-tenant. PITR rewinds one tenant cleanly. |
| **Per-tenant deletion** | `DELETE WHERE tenant_id = '...'` across 57 tables. Ordering matters; FK pain. | Delete the entire Supabase project. Atomic. |
| **Schema drift** | All tenants must run identical schema, all the time. Migrations must hold for everyone. | Each tenant can be on a known migration version. Roll out gradually with `tenants.schema_version`. |
| **Performance** | One hot tenant slows everyone. Query plans become dominated by the largest tenant. | Independent. Hot tenant gets its own scaling. |
| **Cost (small N)** | Lower (one project). | Higher (~$25/mo per project on Pro). |
| **Cost (large N)** | Compute scales. Storage shared. | Linear in N. Predictable. |
| **Compliance audit** | Hard — must prove cross-tenant isolation through RLS proofs. | Easy — physical isolation is the proof. |
| **Provisioning automation** | Just an INSERT. Trivial. | Calls Supabase Management API to create projects + run migrations. ~1-3 minutes per tenant. |

For healthcare data, the right tradeoff is paying the per-project cost and provisioning automation cost in exchange for hard PHI isolation and clean operational semantics.

### 2.3 What `tenant_id` columns would have given us, and how we cover it without

| Use case shared DB needs `tenant_id` for | How we cover it without |
|---|---|
| Knowing "which tenant am I in" | The hostname tells us. The Supabase client URL embeds the project ref. |
| Cross-tenant lookups (e.g. "is this patient already at another clinic?") | Out of scope. Privacy by default. If ever needed, a control-plane aggregator Edge Function fans out using stored service-role keys. |
| Per-tenant configuration | `tenant_profile` + `tenant_app_config` (singleton tables in each tenant DB). |
| Per-tenant feature flags | `feature_flags` table per tenant DB. Audience-gated by RLS. |
| Super-admin dashboard | Future read-only RPC in each tenant DB called from the control plane via service-role. Returns counts only, not PHI. |

---

## 3. Authentication & authorization boundary

### 3.1 Three roles seen at the database level

| DB role | Who | What they can do | JWT origin |
|---|---|---|---|
| `anon` | Unauthenticated browser visitor | Call exactly the public RPCs (`get_public_tenant_app_config`, `resolve_tenant`). Read no rows directly. | Tenant or control plane anon key |
| `authenticated` | Any logged-in user (patient or staff or super-admin) | Read/write rows that pass RLS. Call most RPCs. | Per-user JWT from Supabase Auth |
| `service_role` | Server-side only (Edge Functions, control-plane backend) | Bypass RLS. Provision tenants. Run admin queries. | Per-project service-role key, **never in browser** |

### 3.2 How `users.role` ≠ `staff_members.role`

**`users.role`** (the LOGIN role, governs auth flow): `'doctor' | 'secretary' | 'patient' | 'predoctor' | 'admin'` — exactly 5 values, verified via Supabase MCP `pg_get_constraintdef`.

**`staff_members.role`** (the EMPLOYMENT role, governs hierarchy): includes the above plus `'nurse' | 'assistant' | 'junior_doctor'` for finer-grained team modeling.

**`conversation_participants.role`** (per-conversation): the union of the two.

**`super_admins.auth_user_id`** (control plane only): linked to control-plane `auth.users(id)` — totally separate from any tenant's auth.

The session's simplify pass corrected a route guard that confused these enums: `/staff-messages` originally allowed `['doctor','secretary','predoctor','nurse','assistant','junior_doctor']`. The last three are not valid `users.role` values, so they were dead. The fix: use `CLINIC_OPS_ROLES` from `appBoundaries.js` (= `['doctor','secretary','predoctor','admin']`).

### 3.3 RLS helper functions in the tenant DB

```sql
public.is_staff()                    -- true for doctor/secretary/predoctor/admin/(nurse/assistant/junior_doctor via staff_members)
public.has_role(text[])              -- check current user's role against an array
public.current_domain_user_id()      -- maps auth.uid() → public.users.id
public.current_user_role()           -- returns the user's role from public.users
public.current_patient_id()          -- if role='patient', returns the patient row id
public.current_doctor_id()           -- if role='doctor', returns the doctor row id
public.can_access_conversation(uuid) -- conversation-scoped check
```

These are SQL `STABLE` `SECURITY DEFINER` functions. RLS policies typically wrap them as `(SELECT public.helper())` so the planner caches the call per query (per Supabase's recommended practice).

### 3.4 RLS pattern examples (what good policies look like)

```sql
-- Patient SELECT own messages
create policy patient_messages_select on public.messages
  for select to authenticated
  using (
    exists (
      select 1
      from public.conversation_participants p
      where p.conversation_id = messages.conversation_id
        and (p.user_id = (SELECT public.current_domain_user_id())
             or p.patient_id = (SELECT public.current_patient_id()))
        and p.is_active
    )
  );

-- Staff INSERT clinical document (with author check)
create policy clinical_documents_staff_insert on public.clinical_documents
  for insert to authenticated
  with check (
    (SELECT public.is_staff())
    and created_by = (SELECT public.current_domain_user_id())
  );
```

Anti-patterns the codebase already enforces against:
- ❌ `using (true)` — anyone authenticated reads anything
- ❌ Role check via plaintext SQL — should go through `has_role(['doctor'])`
- ❌ Subquery without `(SELECT ...)` wrapper — kills query plan caching

---

## 4. The runtime layer (ADR-004) end-to-end

### 4.1 The call sequence on first browser load

```
T0  browser opens https://dr-hassan.doctoleb.com/patient-dashboard
T1  React mounts ThemeProvider → SidebarProvider → ToastProvider → TenantBootstrap
T2  TenantBootstrap.useEffect fires:
T3    classifyCurrentLocation() reads window.location.host
T4    classifyHostname returns
        { surface: 'patient-tenant', tenantSlug: 'dr-hassan', isLocal: false, ... }
T5    resolverSurfaceFor(surface) → 'patient'
T6    tenantResolverService.resolve({ host: 'dr-hassan.doctoleb.com', surface: 'patient' })
T7      cache miss → buildResolverUrl(VITE_TENANT_RESOLVER_URL) → 'https://<cp>.supabase.co/functions/v1/tenant-resolve?host=...&surface=patient'
T8      fetch GET (success cache-control: public, max-age=60, s-maxage=300, stale-while-revalidate=60)
T9      Edge Function (Deno) → SUPABASE service-role client → rpc('resolve_tenant', { p_host, p_surface })
T10     resolve_tenant SQL → tenant_domains JOIN tenants → returns jsonb { data, error }
T11     Edge Function returns { data: { tenantId, slug, supabaseUrl, supabaseAnonKey, ... }, error: null } with status 200
T12   resolver caches the success for 5 min
T13   TenantBootstrap calls configureSupabaseClient({ url, anonKey })
T14   Proxy shim's _client is now installed
T15 TenantBootstrap setState({ status: 'ready', tenant, classification })
T16 React re-renders: <AuthProvider> mounts
T17   AuthContext.useEffect → supabase.auth.getSession() → Proxy intercepts → real client → getSession() against tenant DB
T18   if session: authService.getCurrentUser() → fills user state
T19 BrandProvider mounts → tenantConfigService.getPublicConfig() → rpc('get_public_tenant_app_config') against tenant DB
T20 BrandProvider applies CSS variables, sets document.title, applies favicon
T21 PatientConsentGate (patient-web only) checks active required consents
T22 Router renders the matched route → page mounts → page-level service calls run
```

Every call after T13 hits the tenant DB. The control plane is touched **once per (host, surface, 5-min window)** in the browser resolver cache. The resolver client also has a bounded network timeout (`VITE_TENANT_RESOLVER_TIMEOUT_MS`, default 6000ms), so app boot fails closed instead of hanging indefinitely.

### 4.2 What happens on an HTTP failure

- Network error (no response) → `fetch` rejects → `TENANT_RESOLVER_DOWN` → 30-second error cache
- HTTP 404 → `TENANT_NOT_FOUND` → 30-second error cache. In DEV, fall through to env fallback.
- HTTP 403 → `SURFACE_MISMATCH` → cached
- HTTP 423 → `TENANT_INACTIVE` → cached
- HTTP 503 → `TENANT_RESOLVER_DOWN` → cached
- Successful 200 with malformed JSON → `TENANT_RESOLVER_DOWN`

In all error cases TenantBootstrap renders `<TenantUnavailable errorCode={code} classification={...} />`. The error code is shown so the user can read it back to support.

### 4.3 DEV fallback semantics

```js
// tenantResolver.js (simplified)
async resolve({ host, surface }) {
  // 1. cache hit?
  if (cached) return cached;

  // 2. real endpoint?
  const httpResult = await fetchResolver({ host, surface });
  if (httpResult?.data && validateResponseShape(httpResult.data)) return success;
  if (httpResult?.error && !isDev()) return error;  // PROD: bail out

  // 3. DEV fallback (only if not PROD)
  if (!isProd()) {
    const fallback = devFallback({ host, surface });
    if (fallback) return success;
  }

  // 4. fail closed
  return { data: null, error: RESOLVER_NOT_CONFIGURED };
}
```

The DEV fallback synthesizes:
```js
{
  tenantId: `dev-${slug}`,                                  // VITE_DEV_TENANT_SLUG or 'dev'
  slug,
  supabaseUrl: VITE_SUPABASE_URL,                           // from .env
  supabaseAnonKey: VITE_SUPABASE_ANON_KEY,                  // from .env
  schemaVersion: VITE_DEV_SCHEMA_VERSION || 'dev',
  canonicalHost: host || `${slug}.localhost`,
  status: 'active',
}
```

PROD never uses this fallback. `import.meta.env.PROD === true` short-circuits step 3.

### 4.4 Why a Proxy compat shim instead of dependency injection

Pre-ADR-004, every service file did:
```js
import { supabase } from '@/lib/supabase';

export const patientService = {
  async getById(id) {
    return apiCall(supabase.from('patients').select(PATIENT_SELECT_FIELDS).eq('id', id).single());
  },
};
```

Two ways to refactor for runtime configuration:

| Approach | Pros | Cons |
|---|---|---|
| **DI rewrite** — pass `supabase` to each service constructor | Explicit. Easier to mock. Pure functions. | Touches all 19 services + every callsite. High risk of regression. Forces page-level changes too. |
| **Proxy shim** — keep `import { supabase }` working; route property access through `getSupabaseClient()` | Zero churn in 19 services. Tests still mock the same module. The Proxy intercepts only the FIRST property access — chained `.from('x').select(...)` is normal afterward. | Introspection (Object.keys etc.) returns runtime client's keys. Slight indirection on every call. Misconfigured boot throws at first DB call instead of module load. |

We chose the Proxy. The "throws at first DB call" behavior is actually a feature — it surfaces ordering bugs immediately. The cost is one extra function call per `supabase.X` access; query builders are JS objects, not Proxies, so chaining is normal.

```js
// supabase.js (simplified)
const supabaseShim = new Proxy({}, {
  get(_target, prop) {
    if (prop === 'toString') return () => '[SupabaseClientProxy]';
    if (prop === Symbol.toStringTag) return 'SupabaseClientProxy';
    const client = getSupabaseClient();      // throws if not configured
    const value = client[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
  has(_, prop) { return prop in getSupabaseClient(); },
  ownKeys() { return Object.keys(getSupabaseClient()); },
  getOwnPropertyDescriptor(_, prop) { return Object.getOwnPropertyDescriptor(getSupabaseClient(), prop); },
});
export { supabaseShim as supabase };
```

`configureSupabaseClient` is **idempotent**: passing the same `(url, anonKey)` returns the existing client without recreating it. This is critical because Realtime channels and auth subscriptions are tied to a client instance — recreating mid-session would tear them all down.

---

## 5. Every new code file in this session — design rationale

### 5.1 `packages/core/lib/hostnameSurface.js`

**Purpose:** map `window.location.host` → `{ surface, tenantSlug, isLocal, isCustomDomain, hostname, port, primaryDomain }`.

**Design choices:**

- **Pure function, no I/O.** Easy to test (14 assertions in `tests/unit/hostnameSurface.test.mjs`), no env deps, no race conditions.
- **Explicit `SURFACES` enum** (frozen object): `marketing`, `controlPlane`, `patientTenant`, `opsTenant`, `customDomain`, `customDomainOps`, `localPatient`, `localOps`, `localUnknown`, `unknown`. Stringly-typed surface checks elsewhere break.
- **Reserved-slug list:** `www`, `console`, `admin`, `api`, `app`, `ops`, `mail`, `docs`, `status`. A subdomain that matches a reserved name is NOT a tenant slug; it routes to the marketing/console/unknown bucket.
- **Slug regex:** `/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/` — RFC 1123 label rules. 1-63 chars, can't start/end with `-`.
- **Configurable `primaryDomain`:** defaults to `'doctoleb.com'`. Tests can pass a fixture domain (`example.test`). Production reads from default.
- **IPv6 + protocol stripping** in `splitHostnameAndPort` — accepts `https://[::1]:3001`, `localhost:3001`, `dr-x.doctoleb.com`, etc.
- **`resolverSurfaceFor()`:** maps the 10 surfaces down to `'patient' | 'ops' | null`. The resolver endpoint only knows two surfaces; marketing/control-plane/unknown return null and skip the resolver entirely.

**Edge cases handled:**

- `doctoleb.com` and `www.doctoleb.com` → both marketing
- `console.doctoleb.com` → control-plane (super-admin app domain)
- `{slug}.ops.doctoleb.com` → ops-tenant (the `.ops` is detected, slug stripped)
- A subdomain with a `.` in it (e.g. `foo.bar.doctoleb.com`) that isn't `.ops`-suffixed → `unknown` (not a valid tenant)
- `localhost:3001` → `localPatient`; `localhost:3002` → `localOps`; other localhost ports → `localUnknown`
- Custom domains starting with `ops.` → `customDomainOps`; otherwise → `customDomain`. tenantSlug is `null` (resolver lookup required to learn it).

### 5.2 `packages/core/services/tenantResolver.js`

**Purpose:** browser client for the resolver endpoint. Returns `{ data, error }` envelope.

**Design choices:**

- **Stable error codes** as a frozen const: `TENANT_NOT_FOUND`, `SURFACE_MISMATCH`, `TENANT_INACTIVE`, `TENANT_RESOLVER_DOWN`, `RESOLVER_NOT_CONFIGURED`, `INVALID_REQUEST`. UI maps these to copy via `RESOLVER_ERRORS` import. Avoids stringly-typed UI.
- **In-memory LRU cache, bounded to 64 entries.** TTLs: 5 min on success, 30 sec on error. The cap prevents adversarial host headers from growing the Map without limit. Read on hit refreshes recency (`Map.delete + Map.set`).
- **Three-phase fallback:** real endpoint → DEV env synthesis → fail-closed. PROD short-circuits the env synthesis.
- **`AbortController` support:** the resolver accepts a `signal` so TenantBootstrap can cancel the in-flight fetch on unmount. Preserved end-to-end.
- **Validates response shape:** the endpoint must return `{ tenantId, supabaseUrl, supabaseAnonKey }` at minimum. Anything else is treated as 503-equivalent.
- **Tolerates two response shapes:** `{ data, error }` envelope (preferred) OR a flat `{ tenantId, ... }` (backward compat with simpler endpoints).
- **Env access via `globalThis.process`:** ESLint browser globals don't include `process`, but tests run under Node where it exists. Routing via `globalThis` lets the same code work in both contexts.

**Why no React Query / SWR:**

The resolver runs once per (host, surface, 5-min window). Bringing in 30+ kB of caching infrastructure for one call is overkill. The hand-rolled cache is ~30 lines and bounded.

### 5.3 `packages/core/lib/supabase.js`

Already covered in §4.4. Three exports:
- `configureSupabaseClient({ url, anonKey, options })` — idempotent factory
- `getSupabaseClient()` — accessor that throws if not configured
- `supabase` — Proxy compat shim

The previous diagnostic exports (`isSupabaseClientConfigured`, `resetSupabaseClient`) were removed during the dedup pass — zero callers, future-restorable in 5 lines.

### 5.4 `packages/ui/contexts/TenantBootstrap.jsx`

**Purpose:** App wrapper that resolves the tenant before mounting Auth/Brand providers.

**Design choices:**

- **Three render states, modeled as a finite state machine** in `useState`:
  - `{ status: 'resolving' }` → splash
  - `{ status: 'error', errorCode, classification }` → unavailable card
  - `{ status: 'ready', tenant, classification }` → renders children
- **No `useTenant()` hook** (removed during dedup pass — zero callers). Adding it back is a 5-line change when a page actually needs the tenant data.
- **Inline styles for splash + error UI.** This UI must render before Tailwind / BrandContext / any tenant CSS is loaded. Tailwind classes wouldn't paint correctly. Inline styles are intentional, not lazy.
- **`AbortController`** for the in-flight fetch — cancels on unmount or `appSurface` change.
- **`appSurface` prop**, not auto-detection from hostname. Each app's `App.jsx` declares `<TenantBootstrap appSurface={APP_SURFACES.patientWeb}>`. The classification still happens, but the prop tells the resolver which surface to ask about. This is correct because in production each app is one surface (patient-web OR clinic-ops); auto-detection only matters for the unified dev shell, where the user-facing role determines surface anyway.

**Children render synchronously after readiness.** So `AuthProvider`'s `useEffect` running `supabase.auth.getSession()` happens AFTER `configureSupabaseClient` has installed the client. If we got the order wrong, `getSupabaseClient()` would throw synchronously inside the auth effect and the error boundary would catch it — which is debuggable, not silent.

### 5.5 `packages/ui/components/messaging/MessagingPage.jsx`

**Purpose:** shared inbox + thread for both patient and staff sides. ~430 lines.

**Three concurrent invariants the design satisfies:**

1. **Optimistic UI** — sending a message must feel instant. We append a local row with `_optimistic: true` immediately, decoupled from the network round-trip.
2. **Idempotent send** — retries must not duplicate. We attach `client_request_id = crypto.randomUUID()` to the optimistic row; the server enforces a unique constraint on `(conversation_id, client_request_id)`; the realtime echo de-duplicates against this id.
3. **Realtime convergence** — when the other side sends, we must reconcile.

The reconciliation rules in the realtime callback handle three cases:

```js
INSERT (server's confirmed row arrives):
  - if id already exists locally → skip (we already have it)
  - else if client_request_id matches a local optimistic row → replace in place
  - else → append (it's a message from the other side)

UPDATE (e.g. redaction trigger fires):
  - find by id, merge new fields

DELETE (admin-only path):
  - filter out by id
```

**Why `MESSAGING_MODES` const:**

Originally `mode === 'patient'` was sprinkled across the file. The simplify pass extracted `MESSAGING_MODES = { patient: 'patient', staff: 'staff' }` so callsites use the constant; misspellings break at import time, not at "I clicked send and nothing happened" time.

**Why two helpers `getPatientName` and `getConversationTitle`:**

`getPatientName(p) = getUserDisplayName(p, 'Patient')` — single responsibility.
`getConversationTitle(conv, isPatient) = subject?.trim() ?? (isPatient ? 'Conversation with the clinic' : getPatientName(conv.patients))`.

Before the simplify pass these were inlined in three places (the conversation row, the thread header, the new-conversation modal). Extracting them eliminated a 4-level nested ternary in the JSX.

**The `startPatientConversation` extraction:**

Originally MessagingPage's `handleCreateConversation` did:
```js
await createConversation(...)
await addParticipant(...)
await sendMessage(...)
```

This is a multi-step service flow inside a page — exactly what CLAUDE.md says belongs in services. Extracted to:

```js
// messagingService.js
async startPatientConversation({ patientId, userId, subject, body, clientRequestId }) {
  const conversation = await createConversation(...)
  if (error) return error
  // Participant + first message run in parallel — both depend only on conversation.id
  await Promise.all([
    addParticipant(...),
    body && sendMessage(...)
  ])
  return { data: conversation, error: anyFailureFromFollowUps }
}
```

The page's responsibility shrank to: "call startPatientConversation, then setActiveConversationId." The 3-step orchestration is testable in isolation, and other entry points (e.g. a deep-link "start a conversation about appointment X" in a future notification) get the same behavior for free.

### 5.6 `packages/ui/components/consent/PatientConsentGate.jsx`

**Purpose:** block the patient app until all required active consents are accepted.

**Design choices:**

- **Three early-return gates** in render order:
  1. `!shouldGate` → renders children (logged out, staff, or patient with null patient_id)
  2. `loading && requiredDocuments.length === 0` → renders children + small loading overlay (don't gate the app while we're still figuring out if there's anything to gate on)
  3. `pendingDocuments.length === 0` → renders children (everything accepted)
  4. Otherwise → renders children + non-dismissible modal
- **Always renders children behind the modal.** The original implementation rendered ONLY the modal during gating. That meant the patient app skeleton was unmounted while the consent was up, then re-mounted afterward — losing local state. The current design keeps the app alive, with the modal layered above. Visually identical, behaviorally cleaner.
- **`pendingDocuments[0]` is the active doc, computed each render.** The original had `[activeIndex, setActiveIndex]` state plus a clamp `useEffect`. Both removed during simplify pass — the Set-based dedup of accepted IDs makes `pendingDocuments` shrink monotonically, so always picking index 0 is correct.
- **Parallel fetch:** `Promise.all([getConsentDocuments({ activeOnly, audience: 'patient' }), getPatientConsents(patientId)])` — round-trips matter when the app is gated.
- **Pre-formatted text rendering for `body_md`.** No markdown parser dependency. This is intentional MVP; a follow-up slice can swap in `react-markdown` (~50 KB) when content authoring needs bold/italic/links/etc. The `<pre className="whitespace-pre-wrap font-sans">` preserves paragraphs and line breaks without parsing.
- **`Modal` `onClose={() => {}}` no-op** — required consents must not be dismissable via Escape or backdrop click. The shared Modal honors Escape; we suppress it for this critical path.

### 5.7 `packages/ui/components/patient/PatientPageHeader.jsx`

**Purpose:** shared sticky header for patient-web pages.

**Why extracted:** before this session, `PatientMessagesPage`, `PatientMedicalHistoryPage`, and (going forward) any new patient page would all reproduce the same avatar + title + back-to-dashboard + logout block. Three copies in the diff was the trigger.

**Why not generalized further:** the header is patient-web-specific. It uses `getHomeRouteForRole(user?.role)` for "Back to Dashboard" — a clinic-ops sidebar would have its own pattern (already in `AppSidebar`). Making one mega-header that covers both surfaces would couple them. ADR-002's whole point is that the two surfaces are independent.

**Props:** `title`, `subtitle?`, `showBackToDashboard?`, `showLogout?`. Header itself reads `useAuth()` for the avatar initials. Single responsibility: render the chrome.

### 5.8 `apps/patient-web/src/pages/PatientMedicalHistoryPage.jsx` (rewrite)

The session deleted the old version. Key design points in the replacement:

- **Patient-visible status set is `Set(['final', 'void', 'superseded'])`.** Drafts are NEVER patient-visible. Dropping the dead `'voided'` value — verified via Supabase MCP that `clinical_documents.status` enum is `('draft', 'final', 'superseded', 'void')` exactly — was a simplify-pass cleanup.
- **`includeArchived` toggle.** When off (default), `status='void'` records are hidden. When on, they appear with red borders, the void reason, and no download button. This is per HIPAA-equivalent best practice: the patient deserves to know a record was retracted, but it's not part of their active medical record.
- **Single-pass tab counts.** Originally each tab counted via a separate `.filter().length` call (7 filters per render). Replaced with a single reduce that increments all 7 counters in one pass over `visibleDocuments`. NIT-level perf, but cleaner.
- **Fresh signed URL per download click.** `documentService.getDownloadUrl(id)` calls `clinicalService.getDocumentSignedUrl` → `storageService.createSignedUrl(bucket, path, { expiresIn: 300 })`. 5-minute URLs. Each click generates a new one — no URL caching client-side, no expired-link complaints.
- **Content modal uses shared `Modal`.** Pre-formatted text rendering (same MVP rationale as consent body_md).

### 5.9 Tests — `tests/unit/{hostnameSurface,tenantResolver}.test.mjs`

**Why `node:test`:** zero new dependencies. Already in Node 18+. The repo had no test framework prior; pulling vitest in would be a 50+ MB install for two test files.

**hostnameSurface tests:** 14 assertions across 6 describe blocks covering every row of the classification table (marketing/console/patient-tenant/ops-tenant/custom/local) plus reserved-slug rules and slug-validation edges (length, leading hyphen, etc.).

**tenantResolver tests:** 7 describe blocks covering `validation` (bad host/surface), `DEV fallback` (no endpoint set, env vars present), `PROD fail-closed` (endpoint missing, fallback disabled), `HTTP success` (mocked `fetch` returning `{ data, error: null }`), `HTTP error mapping` (404→TENANT_NOT_FOUND, 403→SURFACE_MISMATCH, 423→TENANT_INACTIVE, 503→TENANT_RESOLVER_DOWN), `cache` (success cached for 5 min, errors for 30 sec, LRU eviction at 64 entries), and `response shape validation` (malformed payload → 503-equivalent).

Mocking strategy: `globalThis.fetch` is replaced per-test with a `mock.fn()` that returns canned `Response` objects. `import.meta.env` is shimmed via the `globalThis.process.env` path that the resolver reads through. No global state leaks because the cache is reset between cases via `clearResolverCache()`.

---

## 6. Supabase deep dive — both planes

### 6.1 Tenant DB (`gezmfmskhmjgnquoyosq`)

**57 tables, organized by domain:**

| Domain | Tables |
|---|---|
| Auth & users | `users`, `patients`, `doctors`, `predoctors`, `staff_members` |
| Scheduling | `clinics`, `doctor_schedule_templates`, `secretary_slots`, `appointments`, `visit_types` |
| Intake & history | `medical_intake`, `precheck_forms`, `patient_vaccinations`, `patient_surgeries`, `patient_diseases`, `patient_family_history` |
| Clinical care | `encounters`, `clinical_notes`, `diagnoses`, `prescriptions`, `prescription_items`, `lab_orders`, `lab_order_tests`, `imaging_orders`, `clinical_documents`, `document_attachments`, `care_tasks` |
| Messaging | `conversations`, `conversation_participants`, `messages`, `message_attachments`, `message_read_receipts` |
| Notifications & mobile | `patient_devices`, `notification_events`, `notification_deliveries`, `reminder_rules` |
| Insurance & billing | `insurance_providers`, `doctor_insurance_contracts`, `patient_insurance_policies`, `claim_form_templates`, `insurance_claims`, `payments`, `bills`, `bill_items`, `payment_transactions`, `billable_services`, `doctor_referrals` |
| Tenant config | `tenant_profile`, `tenant_app_config`, `feature_flags`, `content_pages`, `consent_documents`, `patient_consents` |
| Catalogs | `specialties`, `vaccines`, `diseases`, `surgery_types`, `cities`, `occupations`, `blood_groups`, `family_relations` |

**Lifecycle RPCs** (`SECURITY DEFINER`, audit'd, transactional):

```sql
-- Booking
book_slot(p_slot_id, p_patient_id, p_visit_type_id, p_reason)
get_available_slots(p_doctor_id, p_date_from, p_date_to)
cancel_appointment(p_appointment_id, p_reason)

-- Encounter
start_encounter(p_appointment_id)
complete_encounter(p_encounter_id, p_payload)
cancel_encounter(p_encounter_id, p_reason)

-- Clinical document
finalize_clinical_document(p_document_id)
void_clinical_document(p_document_id, p_reason)

-- Patient self-service
update_patient_profile(p_patient_id, p_payload)
get_public_tenant_app_config()        -- anon callable

-- Mobile
get_my_appointments(p_status, p_limit)
get_my_medical_summary()
get_my_notifications(p_limit, p_unread_only)
mark_notification_read(p_delivery_id)
register_patient_device(p_platform, p_push_token)
```

**Status-transition trigger** (`enforce_tier2_status_transition`) gates UPDATE on appointments/encounters/clinical_documents/orders/etc. Direct SQL `UPDATE x SET status = 'completed'` from a service is rejected — only the lifecycle RPCs can transition status.

**Message-redaction trigger** (`enforce_message_redaction`): when `redacted_at` is set on a row, the trigger overwrites `body` to `[redacted]` in place. Original is unrecoverable, even by admins. This is the HIPAA-style "scrub" model — preferred over soft-delete because the legal/clinical record stays intact (the metadata, sender, timestamp survive; only the content is gone).

**Idempotency:** `client_request_id uuid` columns on 5 tables. PostgREST INSERT with a duplicate `client_request_id` returns the existing row (achieved via `INSERT ... ON CONFLICT DO NOTHING RETURNING *` patterns or explicit unique indexes).

**Storage buckets:**
- `clinical-documents` (private) — PDFs/images attached to `clinical_documents`. Browser access via `storageService.createSignedUrl`. RLS on `storage.objects` matches the `clinical_documents` row owner.
- `message-attachments` (private) — file uploads on `messages`. Same pattern.

**Realtime channels:**
- `messages` table has Realtime enabled. `subscribeToConversation(id, callback)` opens `postgres_changes` filtered by `conversation_id=eq.<id>`.
- No other tables currently have Realtime publication. Notifications use a polling pattern via `notification_deliveries` instead.

### 6.2 Control plane (Block H — activated)

Live project: `xouqxgwccewvbtkqming`. It is zero-PHI and currently contains only `tenants`, `tenant_domains`, `super_admins`, and `tenant_events`, all with RLS enabled.

**4 tables** in `supabase-control-plane/migrations/00010000000000_control_plane_baseline.sql`:

```
tenants            (id, slug, display_name, status, plan, release_channel,
                   supabase_project_ref, supabase_url, supabase_anon_key,
                   schema_version, notes, timestamps)
tenant_domains     (id, tenant_id FK, hostname, surface, status,
                   dns_status, ssl_status, verification_token, verified_at)
super_admins       (id, auth_user_id UNIQUE, display_name, is_active, last_login_at)
tenant_events      (id, tenant_id FK, event_type, actor_id, metadata jsonb)
```

**`is_super_admin()`** helper — `SECURITY DEFINER`, returns true if the authenticated user has an active row in `super_admins`. Used in RLS for the registry tables.

**RLS pattern:** all writes restricted to `is_super_admin()`. Reads on `tenants`/`tenant_domains` also restricted. `super_admins.self_select` lets a user see their own row to bootstrap the check.

**`resolve_tenant(p_host text, p_surface text) → jsonb`** is the public RPC. Granted to `anon` + `authenticated`. Returns `{ data: { tenantId, slug, supabaseUrl, supabaseAnonKey, ... }, error: null }` on success or `{ data: null, error: 'CODE' }` on failure. Case-insensitive hostname match.

**Why `tenants.supabase_anon_key` stored as plain text:** anon keys are public. The browser receives them. Encrypting them at rest in the registry adds friction without security benefit. Service-role keys are NOT stored in any row — they live as Edge Function secrets via `supabase secrets set`.

**Edge Function** (`supabase-control-plane/functions/tenant-resolve/index.ts`):
- Reads `?host=` and `?surface=` from query string
- Normalizes and bounds host input before calling the RPC
- Validates surface ∈ {patient, ops}
- Calls `supabase.rpc('resolve_tenant', ...)` with the **service-role client** (function-internal; never returned)
- Validates the RPC envelope before returning it over the public API
- Maps the RPC's `error` value to HTTP status (404/403/423/503/400)
- Sets `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=60` on success, `no-store` on error
- Sends `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and `X-Robots-Tag: noindex`
- CORS allowlist via `TENANT_RESOLVE_ALLOWED_ORIGINS` env var
- Deployed as version 2 with `--no-verify-jwt` (the resolver is intentionally public; security comes from RLS on tenant DBs the response refers to)

### 6.3 Migration discipline

The repo at `supabase/migrations/` has **24+ migration files** spanning Tier 0 → Tier 2.5. Some early migrations reference legacy tables (`consultations`, `notifications`, etc.) that were later dropped by `20260506190000_legacy_compatibility_burndown.sql`. The migration history is a journal, not the active schema. **Source of truth is the live schema + `selects.js`**.

A schema-drift baseline (`20240625000000_baseline_core_tables.sql`) was added to capture 5 core tables (`users`, `doctors`, `predoctors`, `payments`, `precheck_forms`) that were originally created via Supabase Studio rather than migration. Without that baseline, fresh tenant replay (Block H step 7 onboarding) would fail.

**Rule:** when adding a tenant DB migration, the file timestamp must be after the latest existing migration. The baseline is timestamped `20240625` deliberately — it must run before the `20240626_create_scheduling_tables.sql` that already references the core tables.

---

## 7. API layer contracts

### 7.1 The two envelopes

```js
// Single read or write
{ data: T | null, error: string | null }

// List read with pagination
{
  data: T[],
  meta: {
    pagination: { page, pageSize, totalCount, hasMore }
  },
  error: string | null,
}
```

**Wrappers** (`packages/core/services/api.js`):

```js
export const apiCall = async (queryBuilder) => {
  try {
    const { data, error } = await queryBuilder;
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error?.message || 'An unexpected error occurred' };
  }
};

export const apiPaged = async (queryBuilder, { page = 1, pageSize = 25 } = {}) => {
  const offset = (page - 1) * pageSize;
  try {
    const { data, error, count } = await queryBuilder.range(offset, offset + pageSize - 1);
    if (error) throw error;
    return {
      data: data || [],
      meta: {
        pagination: {
          page,
          pageSize,
          totalCount: count ?? data?.length ?? 0,
          hasMore: count != null ? offset + (data?.length ?? 0) < count : false,
        },
      },
      error: null,
    };
  } catch (error) {
    return { data: [], meta: null, error: error?.message || 'An unexpected error occurred' };
  }
};
```

**Why this contract is strict:**

- Pages can write `if (error) showToast(error)` without unwrapping promise rejections
- Optimistic UI rollback is straightforward
- The same shape works for service-side workers and tests
- Errors as strings (not Error objects) survive serialization (e.g. transmitting via postMessage to a worker)
- Services NEVER throw — pages NEVER need a try/catch around a service call

### 7.2 SELECT constants discipline

Every query reads from `packages/core/lib/selects.js`. Example:

```js
// services/messaging.js
import { MESSAGE_SELECT_FIELDS } from '@/lib/selects';

async getMessages(conversationId, { page = 1, pageSize = 50 } = {}) {
  return apiPaged(
    supabase.from('messages')
      .select(MESSAGE_SELECT_FIELDS, { count: 'exact' })
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false }),
    { page, pageSize }
  );
}
```

**Rule (per CLAUDE.md):** never `.select('*')` in services. Constants are joined column lists with explicit FK names where multiple paths exist:

```js
export const MESSAGE_SELECT_FIELDS = [
  'id', 'conversation_id', 'sender_user_id', 'sender_patient_id', 'body',
  'message_type', 'is_internal', 'edited_at', 'deleted_at', 'redacted_at',
  'redacted_by', 'client_request_id', 'created_at', 'updated_at',
  `users!messages_sender_user_id_fkey(${USER_CONTACT_FIELDS})`,
].join(', ');
```

The FK alias `messages_sender_user_id_fkey` disambiguates from `redacted_by` (also `users` FK). Without it, PostgREST can't resolve the join.

### 7.3 Zod validation pattern

```js
import { messageCreateSchema, parseWithSchema } from '@/schemas';

async sendMessage(payload) {
  const parsed = parseWithSchema(messageCreateSchema, payload);
  if (parsed.error) return { data: null, error: parsed.error };

  return apiCall(
    supabase.from('messages').insert([parsed.data]).select(MESSAGE_SELECT_FIELDS).single()
  );
}
```

`parseWithSchema` is itself wrapped in the same `{ data, error }` envelope, so service methods can short-circuit on validation failure with one line. All write paths (insert/update/upsert) validate before touching the DB.

### 7.4 Idempotency via `client_request_id`

```js
async sendMessage({ ..., client_request_id }) {
  // schema requires client_request_id as a uuid
  // DB has a unique partial index on (conversation_id, client_request_id) where client_request_id is not null
  // INSERT with a duplicate id returns the existing row via ON CONFLICT DO NOTHING + RETURNING
}
```

The frontend generates `crypto.randomUUID()` per send. Network retries with the same id are no-ops. Realtime echoes also dedup against this id. The scope: **5 tables** carry this column.

### 7.5 Lifecycle vs raw status update contract

```js
// ✅ Allowed
await encounterService.complete(encounterId, payload)        // calls complete_encounter RPC

// ❌ Forbidden (the trigger rejects it)
await supabase.from('encounters').update({ status: 'completed' }).eq('id', encounterId)
```

The `enforce_tier2_status_transition` trigger raises an exception on direct status updates. State machines mirrored in `packages/core/lib/stateMachines.js` for client-side validation.

### 7.6 Realtime subscription contract

```js
const subscription = messagingService.subscribeToConversation(conversationId, (payload) => {
  // payload.eventType: INSERT | UPDATE | DELETE
  // payload.new: row after the event (null on DELETE)
  // payload.old: row before the event (null on INSERT)
});
// later
subscription.unsubscribe();
```

**Channel naming convention:** `<table-or-feature>:<id>` — e.g. `conversation:abc123`. Avoids cross-feature channel collisions. The supabase-js client de-dupes by channel name, so multiple subscribers to the same channel share one socket.

### 7.7 Storage signed URL contract

```js
const { data, error } = await documentService.getDownloadUrl(documentId);
// data = { signedUrl: 'https://<project>.supabase.co/storage/v1/object/sign/clinical-documents/...?token=eyJ...', path: '...' }
```

**TTL:** default 5 min, max 15 min (enforced in `storageService`). Each call generates a fresh URL — never cache the signed URL in component state past the immediate use.

**Bucket access:** `clinical-documents` and `message-attachments` are both private. RLS on `storage.objects` enforces that the caller can read the object only if they can read the corresponding row in the parent table.

---

## 8. Future Flutter mobile app — design and contracts

The mobile app does not exist yet. The backend contracts that make it possible **already do**, and the SaaS architecture deliberately gates them so a Flutter dev can hit the ground running. This section is the design brief for that work.

### 8.1 Tenant resolution on mobile (the same flow, different transport)

```
App start
  ↓
Read stored config? (last-known tenant from secure local storage)
  ↓
If user has a "scan QR / paste link" affordance for first launch:
  parse URL → extract host
  ↓
HTTP GET https://<control-plane>.supabase.co/functions/v1/tenant-resolve?host=X&surface=patient
  ↓
{ supabaseUrl, supabaseAnonKey, tenantId, ... }
  ↓
Initialize Supabase client (supabase_flutter package) with those values
  ↓
Persist in secure storage for next launch
```

The same `tenantResolverService` API. The Flutter implementation is a Dart class that hits the same endpoint and returns the same shape.

**Two onboarding modes for mobile:**

1. **Per-tenant App Store listings** — each doctor's clinic gets a branded build of the app. The `host` is baked in. Easy onboarding (download "Dr. Hassan Clinic" from the App Store), high ops cost (rebuild + resubmit per tenant per release).
2. **One app + tenant picker** — single App Store listing. First launch asks the user to enter a clinic code or scan a QR. The host is resolved at runtime. Lower ops cost, slightly worse UX.

Which to pick depends on tenant count + branding requirements. For < 10 tenants, per-tenant builds are fine. For 100+, the picker is mandatory. ADR-004 supports both paths without code changes — only the build pipeline differs.

### 8.2 Auth flow on mobile

```dart
// 1. Phone OTP (preferred for patients)
await supabase.auth.signInWithOtp(phone: '+961...')
// User enters 6-digit code
await supabase.auth.verifyOTP(phone: '+961...', token: '123456', type: OtpType.sms)

// OR

// 2. Email + password
await supabase.auth.signInWithPassword(email: ..., password: ...)
```

After auth, call `current_user_role()` to verify the user is a `patient`. Staff logins on the patient mobile app should be rejected with "use the staff portal."

### 8.3 The 5 mobile RPCs — the entire mobile API surface

The tenant DB exposes exactly 5 RPCs that the mobile app should use:

```dart
// Patient appointments
final appointments = await supabase.rpc('get_my_appointments', params: {
  'p_status': 'confirmed',  // or 'completed' / null for all
  'p_limit': 20,
});

// Dashboard summary (counts + upcoming + recent activity)
final summary = await supabase.rpc('get_my_medical_summary');

// Notifications inbox
final notifications = await supabase.rpc('get_my_notifications', params: {
  'p_limit': 30,
  'p_unread_only': true,
});

// Mark notification read
await supabase.rpc('mark_notification_read', params: { 'p_delivery_id': deliveryId });

// Register device for push notifications
final deviceId = await supabase.rpc('register_patient_device', params: {
  'p_platform': 'android',  // or 'ios'
  'p_push_token': fcmToken,
});
```

**Rule:** the mobile app should NOT directly query `appointments`, `clinical_documents`, etc. Those tables have RLS; bypassing them bypasses validation logic in the RPCs. If a feature is missing from the 5 RPCs, the right action is to add a 6th RPC, not to query tables directly.

### 8.4 Push notifications

```
Doctor finalizes a clinical document
  ↓
notification_events row inserted
  ↓
Notification worker (Edge Function — Slice 5, future)
  ↓
SELECT patient_devices WHERE patient_id = X AND is_active
  ↓
For each device:
  - if platform = 'android': FCM message
  - if platform = 'ios': APNs message
  - on success: notification_deliveries row with status='sent'
  - on failure: status='failed', retry up to N times
  ↓
notification_deliveries.status updated as device acks (read receipts via mark_notification_read)
```

The mobile app:
1. On first launch: `register_patient_device` with FCM/APNs token
2. On token rotation: re-register with new token
3. On notification tap: deep-link to the relevant page (appointment detail, message thread, document view) — encoded in `notification_events.payload jsonb`

### 8.5 Tenant config consumption on mobile

The same `get_public_tenant_app_config` RPC the web BrandProvider uses also feeds mobile:

```dart
final config = await supabase.rpc('get_public_tenant_app_config');
// config: { app_name, app_tagline, primary_color, secondary_color,
//           splash_logo_url, icon_url, support_phone, support_email,
//           enabled_locales, min_supported_version, force_update_version,
//           maintenance_message }
```

**Force-update logic:**

```dart
if (config.force_update_version > app.version) {
  showBlockingUpgradeDialog(); // app stops working until user updates
} else if (config.min_supported_version > app.version) {
  showSoftWarning();           // app keeps working, warning dismissable
}

if (config.maintenance_message != null) {
  showMaintenanceBanner(config.maintenance_message);
}
```

These three fields (`min_supported_version`, `force_update_version`, `maintenance_message`) are deliberately on every tenant's `tenant_app_config` so each clinic can independently push update prompts.

### 8.6 Code-sharing strategy: Dart vs JS

The web app's services (`packages/core/services/*.js`) and the Flutter app's services (in Dart) cannot share source. Two strategies:

| Strategy | Pros | Cons |
|---|---|---|
| **Pure duplication** — write Dart services that mirror the JS contracts | Each platform optimized natively | Risk of drift; bug fixes must land twice |
| **OpenAPI/protobuf schema** — generate both JS and Dart clients from a single contract | Drift impossible by construction | High setup cost; doesn't fit the "thin wrapper around supabase-js" pattern |

For DoctoLeb's scale, **strategy 1 with strict contract testing** is the right choice. The mobile-only RPC subset (5 functions) is small enough that a Dart developer can mirror the web behavior in a day. The contract tests in `scripts/backend-db-contract-tests.mjs` are language-agnostic — they call the RPCs over HTTP and verify shapes — so the same tests can validate both clients.

### 8.7 Offline strategy (open question)

Current web app is online-first. A Flutter patient app with poor connectivity (Lebanon's reality) will need offline reads at minimum:

- Cache `get_my_medical_summary` result in SQLite (Drift / sqflite). Show cached on app launch, refresh in background.
- Cache `get_my_appointments` for next 30 days. Show cached on launch.
- Notifications: keep last 30 days locally; sync via `mark_notification_read` when online.

Offline writes (booking, sending messages) are NOT supported in v1 — they require conflict resolution that the backend isn't designed for yet.

This is a deliberate v1 scope reduction. v2 can introduce a `pending_outbox` table on the device + a sync RPC.

---

## 9. SaaS infrastructure operations

### 9.1 Cost model

Per-month, per-environment:

```
Vercel Pro                  ~$20/month/team       (frontend hosting)
Supabase Pro (control plane) $25/month             (PITR + daily backups + no auto-pause)
Supabase Pro (per tenant)   $25/month/tenant      (PITR + daily backups)

Steady state at N tenants:
  Frontend:      $20
  Control plane: $25
  Tenants:       $25 × N
  Total:         $45 + $25N

Examples:
  N=1   →  $70/month
  N=10  →  $295/month
  N=50  →  $1295/month
  N=100 →  $2545/month
```

Tenant pricing should include this overhead plus margin. At a typical $75-150/month per doctor SaaS pricing, the platform is profitable from N=1 if the support cost is low.

### 9.2 Provisioning a new tenant — the playbook

Today this is **manual** (~1 hour per tenant); future automation reduces it to a button click (~3 minutes per tenant).

**Manual steps (per `CONTROL_PLANE_SETUP.md` §7):**

1. Supabase dashboard → New project: `doctoleb-tenant-<slug>`
2. `supabase link --project-ref <new-ref>` then `supabase db push` (applies all 24+ tenant migrations)
3. Studio SQL editor:
   - Insert `tenant_profile` (display_name, status='active')
   - Insert `tenant_app_config` (brand colors, locales, etc.)
   - Create the doctor's auth user via Auth → Users
   - Insert `users` + `doctors` rows linked to the auth user
4. In control plane:
   - Insert `tenants` row (slug, project_ref, url, anon_key, schema_version)
   - Insert `tenant_domains` rows for both surface hostnames
5. DNS: configure subdomain CNAME (or custom domain alias)
6. Smoke test: `select public.resolve_tenant('<host>', 'patient')` returns a valid blob
7. Insert `tenant_events` row with `event_type='tenant.provisioned'`

**Future automation (Edge Function in control plane — out of scope this session):**

```
POST /api/tenants/provision
{ slug, doctor_email, doctor_name, plan }
  ↓
1. Supabase Management API: POST /v1/projects → new project
2. Wait for project READY (poll)
3. Apply migrations via `supabase db push --project-ref <new>`
4. Seed tenant_profile + tenant_app_config (template)
5. Create auth user via Management API (auto-generates magic link)
6. Insert users + doctors rows
7. Insert control-plane tenants + tenant_domains rows
8. Send invite email to doctor with magic link
9. Insert tenant_events 'tenant.provisioned'
  ↓
Returns { tenantId, slug, dashboardUrl }
```

This requires the Supabase Management API token stored as a control-plane Edge Function secret. **Never** in any tenant DB.

### 9.3 Custom domains

Two paths:

| Path | UX | Operations cost |
|---|---|---|
| **Subdomain on `doctoleb.com`** | `dr-hassan.doctoleb.com` — automatic via wildcard | None per tenant — DNS + SSL handled centrally |
| **Custom domain** (paid tier) | `customclinic.com` — branded as the clinic, not as DoctoLeb | DNS verification (TXT record), SSL provisioning (Let's Encrypt via Vercel/Cloudflare), entry in tenant_domains. ~10 min per domain |

The control-plane `tenant_domains` table tracks both kinds with `dns_status` and `ssl_status` columns. Multiple hostnames per tenant supported (subdomain + custom + ops surface = 4 rows for one tenant).

### 9.4 Migration replay across tenants

The repo's `supabase/migrations/` is the source of truth for tenant DB schema. When migrations are added, **every existing tenant must be replayed**.

**Current strategy (manual):**
1. Engineer reviews migration in PR
2. After merge, runs `supabase db push --project-ref <each-tenant-ref>` for each tenant
3. Updates `tenants.schema_version` for each

**Future (automated — Slice TBD):**
1. CI runs `supabase db push` against all tenants in `tenants` table whose `schema_version < latest`
2. On success, updates `schema_version`
3. On failure, writes `tenant_migration_runs` row with `status='failed'` and pages on-call

For now: roll out gradually. New migrations should be backwards-compatible (no destructive changes without a feature flag).

### 9.5 Backups + PITR per tenant

Supabase Pro automatically does:
- Daily backups (7-day retention)
- Point-in-time recovery (PITR, 7-day window)

Per project means per tenant. Restoring tenant A doesn't touch tenant B. Restoration target time can be any second within the PITR window.

**Recovery procedure (when needed):**
1. Identify the bad event (audit trigger logs help — every clinical write hits an audit table)
2. In Supabase dashboard: Project → Database → Backups → Restore from point in time
3. Choose a target second just before the bad event
4. Supabase clones the project (does NOT overwrite the live one)
5. Verify the clone, then either swap (DNS swing) or cherry-pick rows back

### 9.6 Disaster recovery scenarios

| Scenario | Impact | Recovery |
|---|---|---|
| Control plane DB down | All apps fail to bootstrap | Resolver client's 30-sec error cache buys time. Manual DNS fallback to a static fallback page if outage > 5 min. Restore control plane via PITR. |
| One tenant DB down | That tenant offline; others fine | TenantBootstrap shows `TENANT_RESOLVER_DOWN`-style screen for that tenant only (the resolver returns 200 but Auth fails). Restore tenant DB via PITR. |
| Service-role key leaked | Severe — attacker can bypass RLS on whichever project the key is from | 1) Rotate the key in Supabase dashboard 2) Update Edge Function secrets 3) Audit logs for unauthorized access 4) Notify affected tenant doctor |
| Hostname collision (two tenants want `dr-hassan.doctoleb.com`) | First-claim wins | `tenant_domains.hostname UNIQUE` constraint prevents the second insert. Manual resolution. |
| Migration drift between tenants | Some have v3, some have v4 | `tenants.schema_version` shows the diff. CI replay job catches it on next run. |
| Vercel deploy failure | Frontend down, backend fine | Vercel auto-rollback to previous deploy. Restore via Vercel CLI: `vercel rollback`. |
| Patient acceptance not recording | Consent not enforced | `patient_consents` table audit log. Manual SQL re-insert with original timestamp from logs. |
| FCM/APNs key leaked | Push notifications can be spoofed for that tenant | Rotate keys in Firebase/Apple console. Re-deploy notification worker with new secret. |

### 9.7 Observability

What's instrumented:

- **Supabase advisors** — automatic security + performance audits per project. Run via `mcp__supabase__get_advisors`. Should be reviewed weekly.
- **Audit triggers** — 31 tenant tables have audit triggers writing to `audit_log` table. Includes table name, op, row id, actor, timestamp. NOT showing PII.
- **Logs** — `mcp__supabase__get_logs(project_id, service)`. Services: `api` (PostgREST), `auth`, `realtime`, `storage`, `pooler`, `function`. Useful for debugging RLS rejections.
- **Frontend `logger.js`** — wraps console.error in dev only. In prod, hooks into Sentry or equivalent (when wired up — currently a no-op stub).

What's NOT instrumented (open gaps):

- Cross-tenant aggregate metrics (MRR, active patients, encounters/day) — needs a control-plane aggregator Edge Function
- Frontend perf monitoring (Web Vitals) — easy to add via `web-vitals` package + Plausible/Vercel Analytics
- Synthetic uptime checks — would need Pingdom / UptimeRobot

### 9.8 Compliance posture (HIPAA-style, not certified)

DoctoLeb is structured around HIPAA-equivalent best practices but is NOT certified. For Lebanon market, this is sufficient; for US, certification is a separate work track.

What's already in place:

- Soft-delete on clinical/financial tables (no hard DELETE except admin-driven purge RPCs)
- Audit triggers on 31 tables
- Storage in private buckets with signed URLs (no public access)
- RLS on every table (zero `using (true)` policies after the audit guards)
- Message redaction is the scrub model (unrecoverable, even by admins)
- Patient consent gating before app access
- Per-tenant DB isolation (one breach = one tenant)
- 30-min idle timeout in AuthProvider
- Password rules enforced by Supabase Auth
- `users.password_hash` column NEVER read by frontend (audit guard)

What's missing (for actual certification):

- BAA with Supabase (Enterprise tier)
- Penetration testing
- Documented incident response plan
- Data Processing Agreement with each tenant
- Encryption at rest (Supabase has it; document it)
- Encryption in transit (HTTPS everywhere; document it)
- Access logging dashboard (the data exists; the UI doesn't)
- Annual security audit

### 9.9 Stripe billing integration shape (future)

```
Doctor signs up via marketing site
  ↓
Stripe Checkout creates subscription
  ↓
Stripe webhook → control-plane Edge Function /api/billing/webhook
  ↓
On subscription_created:
  - Insert tenants row with status='provisioning'
  - Trigger provisioning workflow (§9.2 future)
On subscription_updated (status='past_due', 'unpaid'):
  - Update tenants.status='suspended'
  - Tenant's apps render TenantUnavailable with code TENANT_INACTIVE
On subscription_deleted:
  - Update tenants.status='inactive'
  - Schedule data retention deletion (90 days grace)
```

Out of scope this session.

### 9.10 Super-admin UI shape (future)

```
console.doctoleb.com
  /                       Dashboard: tenant count, MRR, active patients (count only)
  /tenants                List all tenants with status, plan, schema_version
  /tenants/:id            Detail: stats, billing history, audit events, dns status
  /tenants/new            Provisioning workflow (calls /api/tenants/provision)
  /tenants/:id/suspend    Soft-suspend (sets status='suspended')
  /tenants/:id/migrate    Trigger migration replay against this tenant
  /domains                List all tenant_domains with dns/ssl health
  /releases               List schema_versions across tenants; flag drift
  /audit                  Cross-tenant tenant_events log
```

Built as a third app `apps/control-plane/` with its own Vite config, hosted at `console.doctoleb.com`. Auth uses control-plane Supabase Auth, not any tenant. RLS enforces super-admin access.

Out of scope this session (the runbook covers the manual workflow; UI follows when there are 3+ tenants and manual ops becomes painful).

---

## 10. Tradeoffs and rationale

### 10.1 Why a public resolver endpoint

**Concern:** the resolver returns the tenant's anon key. Anyone can hit the endpoint and learn it.

**Why it's safe:**

- Anon keys are inherently public. They are baked into the SPA bundle and visible in DevTools.
- The actual security boundary is RLS on the tenant DB. Anon keys without authentication can read only what RLS allows (e.g. `get_public_tenant_app_config` and that's it).
- A determined attacker doesn't even need the resolver — they can just read the network tab on any patient's session.

**What would be unsafe:** the resolver returning a service-role key. The audit guard `assertNoServiceRoleKeyReferencesInFrontend` enforces this.

### 10.2 Why pre-formatted text for `consent_documents.body_md`

**Concern:** body_md is markdown; we should render it as markdown.

**Why we don't (yet):**

- A markdown parser like `react-markdown` is ~50 KB after tree-shaking
- For MVP, paragraph + line break preservation via `<pre className="whitespace-pre-wrap font-sans">` is sufficient
- Once content authoring needs bold/italic/links/etc, swapping to `react-markdown` is a 3-line change in `PatientConsentGate.jsx`

The tradeoff is correct for v1. For v2 it changes.

### 10.3 Why optimistic UI in messaging

**Concern:** optimistic UI is complex (rollback, dedup, dual-source-of-truth).

**Why it's the right call:**

- Patient messaging UX falls apart without it. A 200ms round-trip means every keystroke + send feels delayed.
- The dedup mechanism (via `client_request_id`) is needed for retry safety anyway.
- Realtime echoes use the same id, so reconciliation is one branch in the existing handler.

The complexity is contained in MessagingPage.jsx. Other realtime features (e.g. live-updated booking slots) can use a simpler "just refetch" model.

### 10.4 Why DEV fallback in the resolver

**Concern:** DEV fallback means localhost works without the control plane. But isn't that the PROD codepath we should be testing?

**Why both:**

- New contributors land in the repo, run `npm install`, run `npm run dev`. If the resolver requires the control plane to be deployed, onboarding takes hours.
- The DEV fallback is explicitly disabled in PROD (`isProd()` short-circuits step 3 of the resolver). PROD ALWAYS hits the real endpoint.
- The HTTP path is exercised by unit tests (mocked fetch). The DEV fallback is exercised by everyday development.

So the PROD codepath gets unit-test coverage; the DEV codepath gets manual-test coverage. Both are exercised.

### 10.5 Why no `useTenant()` hook (yet)

**Concern:** The TenantBootstrap could expose `useTenant()` for pages to read tenant info.

**Why we don't:**

- Zero current callers. A page that needs tenant id could read it from the URL, the brand context, or auth context.
- Adding the hook means adding a `TenantContext.Provider` wrap in the render tree. More code, more re-render risk.
- The simplify pass removed the hook to follow the "no dead code" rule. Restoration is 5 lines when needed.

If a future page (e.g. a tenant-aware deep link handler) needs it, it goes in. Until then, it doesn't.

### 10.6 Why one resolver call per (host, surface, 5-min window) instead of per session

**Concern:** Why bother caching for 5 min? Just cache for the whole session.

**Why 5 min:**

- A doctor flipping their tenant from "active" to "suspended" via the super-admin UI should take effect within 5 minutes for everyone, without a deploy.
- Tenant DB rotation (rare, but possible — e.g. moving from one Supabase region to another) should propagate within 5 min.
- 5 min × N visitors per minute = manageable load on the resolver Edge Function. With N=100/min, that's 100 cold calls + 4900 cached responses per 5 min window.

If we cached for the full session, control-plane changes wouldn't propagate without a hard reload. 5 min is the default; tunable per environment if needed.

### 10.7 Why `client_request_id` instead of database-generated dedup tokens

**Concern:** Why does the client generate the id?

**Why client-side:**

- The retry semantics matter ON THE CLIENT — if the network drops mid-send, the client retries with the SAME id. A server-generated id wouldn't survive across retries.
- `crypto.randomUUID()` is collision-free for practical purposes (2^122 entropy).
- Server-side `INSERT ... ON CONFLICT (client_request_id) DO NOTHING RETURNING *` makes the server idempotent.

This is the standard pattern across Stripe, Plaid, etc. It's not novel; it's correct.

---

## 11. Failure modes and recovery

### 11.1 What if the control plane goes down

**Symptom:** every tenant's app fails to boot. `TenantBootstrap` shows `TENANT_RESOLVER_DOWN`.

**Recovery:**

- 30-sec error cache means each user keeps getting the error for 30 sec, then retries.
- If outage > 5 min: page on-call. Most likely cause: Supabase region outage. Check status.supabase.com.
- If outage > 1 hour: consider a DNS-level fallback to a static "we're down" page on the marketing domain.

**Mitigation in design:** the resolver is read-only; it doesn't depend on writes succeeding. Supabase outages affecting reads are rare.

### 11.2 What if a tenant DB goes down

**Symptom:** that tenant's users see `TENANT_RESOLVER_DOWN` (the resolver succeeded, but `Auth.getSession` against the tenant DB fails). Other tenants are unaffected.

**Recovery:**

- Supabase auto-fails-over within a region; full project failure is rare.
- If the project is in `paused` state (free tier auto-pause): wake it up via dashboard. Upgrade to Pro to prevent.
- If the project is genuinely lost: restore from PITR (~10 min restore window).

**Mitigation:** Pro tier on every tenant before real PHI lands.

### 11.3 What if a service-role key leaks

**Symptom:** unauthorized writes appear in audit logs. RLS bypasses.

**Recovery:**

1. **Rotate immediately** in Supabase dashboard → Project → Settings → API → "Generate new service role key"
2. Update Edge Function secrets: `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<new>` — both control plane and any tenant projects using it
3. Re-deploy any Edge Function that uses the key
4. Audit `audit_log` and `tenant_events` for the leak window (between the leak and the rotation)
5. Notify affected tenant doctor(s); restore data from PITR if writes were destructive
6. Internal post-mortem: how did the key escape the secret manager / env var?

**Mitigation:** the audit guard in `scripts/backend-contract-audit.mjs` prevents service-role keys from being committed to the repo. CI catches it on every PR.

### 11.4 What if a tenant's data was accidentally exposed across tenants

**Symptom:** a patient sees another patient's data.

**Recovery (this should be impossible by construction, but):**

1. Confirm whether it's an RLS bug (DB-level) or a client-side bug (UI-level)
2. If RLS: write a migration that tightens the policy; deploy ASAP to all tenants
3. If client-side: ship a hotfix to the affected app
4. Notify both patients
5. Document in `tenant_events`

**Mitigation in design:** RLS-driven tests in `pgTAP_rls.sql` (currently scaffolded; live execution pending §4.2 of the handoff). Enable + run on every tenant DB on every release.

### 11.5 What if the same hostname is claimed by two tenants

**Symptom:** `tenant_domains.hostname UNIQUE` constraint prevents the second insert. The provisioning script fails.

**Recovery:** the conflict is surfaced before any user impact. Resolution: pick a different slug (talk to the doctor). The constraint is the right tradeoff — first-claim wins, no implicit precedence.

**Mitigation:** a future super-admin UI could surface "available slugs" check before provisioning.

### 11.6 What if migration drift leaves tenants on different schema versions

**Symptom:** a feature that depends on a new column fails for tenants on the old schema.

**Recovery:**

1. Identify drifted tenants: `SELECT id, slug, schema_version FROM tenants WHERE schema_version < '<latest>'`
2. Run migration replay: `supabase db push --project-ref <each>`
3. Update `schema_version`
4. Insert `tenant_events` row per replay

**Mitigation:** new migrations are backwards-compatible by convention. New columns default to NULL or have safe defaults. New tables don't break older code paths. Destructive migrations require explicit feature-flag gating.

### 11.7 What if local development diverges from production behavior

**Symptom:** "works on my machine" — feature passes locally, fails on prod.

**Common causes:**

- DEV fallback masks an issue with the real resolver (set `VITE_TENANT_RESOLVER_URL` locally to test the prod path)
- Service-role key in local `.env` (should never be there; the audit catches if committed)
- `BACKEND_TEST_DATABASE_URL` not set (skips RLS tests)
- npm cache stale → run `rm -rf node_modules && npm ci`

**Mitigation:** Phase 4.2 of the handoff (set BACKEND_TEST_DATABASE_URL) closes the biggest gap.

---

## 12. Glossary of patterns invoked

These patterns appear throughout the codebase and this document. Definitions:

- **API envelope** — `{ data, error }` (or `{ data, meta, error }` for paged). Every service method returns this shape. Pages don't use try/catch around service calls.
- **Audit guards** — Static-analysis checks in `scripts/backend-contract-audit.mjs` that fail CI on regressions (legacy table refs, hardcoded URLs, service-role refs, `tenant_id` columns).
- **Backend contract** — The set of rules in `BACKEND_CONTRACT_LEDGER.md` and `CLAUDE.md`. Every PR must conform.
- **Branch DB** — A short-lived Supabase project clone. Used for testing migrations + RLS without touching the live tenant.
- **Compat shim** — The `supabase` Proxy export in `packages/core/lib/supabase.js` that lets old `import { supabase }` callers keep working with the runtime client factory.
- **Control plane** — Separate Supabase project for SaaS routing/provisioning. No PHI.
- **DEV fallback** — In `tenantResolver.js`: synthesize the resolver response from `.env` when no endpoint is configured. Disabled in PROD.
- **Idempotent send** — Send with `client_request_id`; retries collapse server-side; realtime echo de-duplicates client-side.
- **Lifecycle RPC** — `SECURITY DEFINER` function that gates a status transition. Direct UPDATE forbidden by trigger.
- **Optimistic UI** — Append local row immediately; reconcile with server confirmation; rollback on error.
- **Proxy compat shim** — see "Compat shim".
- **Resolver** — HTTP endpoint that maps `(host, surface) → tenant connection blob`. Lives in the control plane.
- **RLS helper** — `is_staff()`, `has_role()`, `current_*()` SQL functions used inside RLS policy `USING`/`WITH CHECK` clauses.
- **Schema-drift baseline** — Migration that captures tables originally created outside migration history. Runs first on fresh tenant replay.
- **Scrub model (redaction)** — Trigger overwrites `body` to `[redacted]` in place; original unrecoverable.
- **SELECT constants** — Column-list strings in `selects.js`. Single source of truth for what each table exposes to PostgREST.
- **Slice** — A vertical-feature increment. ADR-004 had Slices A–F; product slices 1–7 are in `NEXT_STEPS_PLAN.md`.
- **Soft delete** — `is_archived = true` instead of DELETE. Applies to all clinical/financial tables.
- **State machine** — Allowed status transitions, mirrored in `lib/stateMachines.js` (client) and the `enforce_tier2_status_transition` trigger (server).
- **Surface** — Patient-web vs clinic-ops vs marketing vs control-plane. Each has different code, hostnames, sometimes different auth.
- **Tenant** — One doctor's deployment of DoctoLeb. One Supabase project per tenant.
- **TenantBootstrap** — React wrapper that runs the resolver before mounting Auth/Brand. Renders splash/error/app.
- **Verify chain** — `npm run verify` = lint + build + test:unit + audit:backend-contract + test:backend-db-contract + audit:high. Must stay green on every PR.

---

**End of SYSTEM_DESIGN_DEEP_DIVE.md.** This document is companion to `HANDOFF_REVIEW_AND_STATUS.md`. Where the handoff is action-oriented (do X, check Y), this is rationale-oriented (why we made this choice). Keep both alongside the ADRs as the canonical engineering reference.
