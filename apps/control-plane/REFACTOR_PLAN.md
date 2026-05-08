# Control-Plane App Refactor Plan

> **Status:** complete for Slices 1-7
> **Authored:** 2026-05-08
> **Authority:** `SAAS_FOUNDATION_PHASE_HANDOFF.md` §7 Phase 1 + §8 Tasks 2–3
> **Scope:** `apps/control-plane/` only. No tenant-app changes.
> **Goal:** decompose `apps/control-plane/src/App.jsx` (610 lines, 16 components) into a small-file structure where pages render and hooks/services own state.

---

## 1. Why this refactor

Reading `App.jsx` requires holding ~16 components and 4 distinct state machines in your head. The handoff explicitly calls this out: *"`apps/control-plane/src/App.jsx` is currently too large and mixes concerns."*

**`AGENTS.md` rules invoked:**
- §Layering Rules: "UI components and pages render state and call hooks/services only. They must not contain business rules, direct database queries, entitlement enforcement, authorization decisions, or complex calculations."
- §Change Discipline: "Work file-by-file and concern-by-concern. Avoid large files that mix routing, UI, data access, validation, and business rules."
- §Duplication And Maintainability: "Code must be readable by the next engineer without guessing."

**Acceptance criterion (handoff §7 Phase 1):** "No large catch-all control-plane component remains. Pages/components render and delegate; hooks/services own state and side effects. Existing builds and tests pass."

---

## 2. Current state — line map

```
App.jsx (610 lines)
│
├── 12-77    UI primitives (66 lines, 6 components)
│   ├── StatusPill
│   ├── Field
│   ├── TextInput
│   ├── SelectInput
│   ├── PrimaryButton
│   └── SecondaryButton
│
├── 79-169   Standalone screens (91 lines, 2 components, no shared state)
│   ├── MissingEnvScreen          — env-status check failure
│   └── LoginScreen               — email/password form, calls signIn
│
├── 171-201  Pure read-only displays (31 lines, 1 component)
│   └── TenantList                — left rail, displays tenants
│
├── 203-493  Stateful side panels (291 lines, 5 components)
│   ├── TenantControls            — local form state, calls updateTenant
│   ├── DomainsPanel              — pure display (already stateless)
│   ├── BrandingPanel             — local form state, calls syncTenantConfig
│   ├── EntitlementsPanel         — local form state, calls syncEntitlements
│   ├── ProvisioningPanel         — local form state, calls createProvisioningJob
│   └── AuditPanel                — pure display (already stateless)
│
├── 495-571  ConsoleScreen (77 lines)
│   ├── State: tenants, selectedTenant, tenantDetail, loading, error
│   ├── Effects: loadTenants on mount, loadTenantDetail when selectedTenant changes
│   └── Layout: TenantList + Provisioning + Tenant detail panels
│
└── 573-608  App (36 lines)
    ├── State: session, booting
    ├── Env-status gate via getControlPlaneEnvStatus()
    ├── Session restore via controlPlaneApi.getSession()
    ├── Auth subscription via controlPlaneApi.onAuthStateChange()
    └── Routes: MissingEnvScreen | booting splash | LoginScreen | ConsoleScreen
```

**4 distinct concerns mixed:**
1. UI primitives (presentational only — could be in `packages/ui/components/ui/` if reused, but for now app-local is fine)
2. Auth/session state (App.jsx)
3. Tenant list + detail data state (ConsoleScreen)
4. Per-panel local form state (each panel)

---

## 3. Target state

```
apps/control-plane/src/
├── App.jsx                                  (~30 lines, routing-only)
├── main.jsx                                 (unchanged)
├── styles.css                               (unchanged)
├── data/saasCatalog.js                      (unchanged)
├── lib/
│   ├── controlPlaneApi.js                   (unchanged)
│   └── controlPlaneClient.js                (unchanged)
├── hooks/
│   ├── useControlPlaneSession.js            ← envStatus + session + booting + signOut
│   ├── useTenantList.js                     ← tenants + loading + error + reload
│   └── useTenantDetail.js                   ← tenantDetail + reload(tenantId)
├── components/
│   ├── ui/
│   │   ├── StatusPill.jsx
│   │   ├── Field.jsx
│   │   ├── TextInput.jsx
│   │   ├── SelectInput.jsx
│   │   ├── PrimaryButton.jsx
│   │   ├── SecondaryButton.jsx
│   │   └── index.js                         ← barrel
│   ├── MissingEnvScreen.jsx
│   ├── LoginScreen.jsx
│   ├── ConsoleScreen.jsx                    ← layout, composes hooks + panels
│   ├── TenantList.jsx
│   ├── TenantControls.jsx
│   ├── DomainsPanel.jsx
│   ├── BrandingPanel.jsx
│   ├── EntitlementsPanel.jsx
│   ├── ProvisioningPanel.jsx
│   └── AuditPanel.jsx
└── (tests live in repo-level tests/unit/control-plane/*.test.mjs)
```

**File-size guardrails:**
- App.jsx: ≤ 50 lines (routing only)
- ConsoleScreen.jsx: ≤ 80 lines (layout only)
- Each component: ≤ 150 lines (form panels can hit this)
- Each hook: ≤ 80 lines

---

## 4. Slice order — each one separately reversible

> Per `SAAS_FOUNDATION_PHASE_HANDOFF.md` §7 Phase 1 acceptance: *"Refactor commits must be behavior-preserving. If a split fails, revert only the refactor slice, not unrelated user work."*

The handoff §8 Task 3 says: *"Recommended first extraction: Move control-plane session/auth state out of `App.jsx` into a hook."* That's Slice 1 below. Slices 2–7 follow in low-to-high risk order.

### Slice 1 — `useControlPlaneSession` hook ← THIS HANDOFF'S TASK 3

**What:** extract App.jsx's env-check + session-restore + auth-subscription into a single hook.

**Files touched:**
- NEW `apps/control-plane/src/hooks/useControlPlaneSession.js`
- MODIFIED `apps/control-plane/src/App.jsx` (replaces inline state with hook call)

**Hook signature:**
```js
function useControlPlaneSession() {
  return {
    envStatus,    // { hasUrl, hasAnonKey }
    session,      // current auth session, null if signed out
    booting,      // true during initial restore
    setSession,   // exposed so LoginScreen's onSignedIn callback works unchanged
    signOut,      // calls controlPlaneApi.signOut() then clears session
  };
}
```

**Behavior preservation rules:**
- `envStatus` resolved synchronously on first render (same as current `getControlPlaneEnvStatus()` call). No re-resolution.
- `booting` defaults to `envStatus.hasUrl && envStatus.hasAnonKey` — same initial value as current.
- Session restore + `onAuthStateChange` subscription fire only when env is configured — same guard.
- Cleanup unsubscribes on unmount — same as current.
- `setSession` exposed because `LoginScreen` currently receives `onSignedIn={setSession}`. Keeping the prop preserves the synchronous redirect after sign-in.

**Tests:** none in this slice. The hook has Supabase auth side effects; mocking is heavier than the value at this stage. A future slice can add tests once `controlPlaneApi` is wrapped in a thin testable interface.

**Verification:**
```bash
npm run lint
npm run build:control-plane
npm run verify
```
Plus manual: load the control-plane dev server, confirm sign-in/sign-out works as before.

**Reversibility:** delete the hook file, revert App.jsx — single commit, atomic.

---

### Slice 2 — UI primitives → `components/ui/`

**What:** move the 6 presentational components (StatusPill, Field, TextInput, SelectInput, PrimaryButton, SecondaryButton) to `apps/control-plane/src/components/ui/` with a barrel export.

**Files touched:**
- NEW `apps/control-plane/src/components/ui/StatusPill.jsx`
- NEW `apps/control-plane/src/components/ui/Field.jsx`
- NEW `apps/control-plane/src/components/ui/TextInput.jsx`
- NEW `apps/control-plane/src/components/ui/SelectInput.jsx`
- NEW `apps/control-plane/src/components/ui/PrimaryButton.jsx`
- NEW `apps/control-plane/src/components/ui/SecondaryButton.jsx`
- NEW `apps/control-plane/src/components/ui/index.js`
- MODIFIED `apps/control-plane/src/App.jsx` (remove inline definitions, import from barrel)

**Why local (`apps/control-plane/components/ui/`) and not shared (`packages/ui/components/ui/`):** the existing `packages/ui/components/ui/` already has `Modal`, `StatusBadge`, etc. with different visual specs (rounded-2xl vs rounded-full, slate vs cyan emphasis). Promoting these to shared would either churn the existing primitives or fork them. Keep app-local for now; promote later if a second app needs them.

**Behavior:** zero changes. Pure file moves.

**Verification:** `npm run build:control-plane` + visual inspection.

**Reversibility:** revert via single commit.

---

### Slice 3 — Static screens → `components/`

**What:** move `MissingEnvScreen` and `LoginScreen` to their own files.

**Files touched:**
- NEW `apps/control-plane/src/components/MissingEnvScreen.jsx`
- NEW `apps/control-plane/src/components/LoginScreen.jsx`
- MODIFIED `apps/control-plane/src/App.jsx` (imports)

**Behavior:** zero changes. `LoginScreen` continues to receive `onSignedIn` as a prop (kept for now; tightening to use the hook's `setSession` directly is a future slice).

**Verification:** sign-in flow manually verified.

**Reversibility:** trivial revert.

---

### Slice 4 — Read-only display panels → `components/`

**What:** move `TenantList`, `DomainsPanel`, `AuditPanel` (all stateless) to their own files.

**Files touched:**
- NEW `apps/control-plane/src/components/TenantList.jsx`
- NEW `apps/control-plane/src/components/DomainsPanel.jsx`
- NEW `apps/control-plane/src/components/AuditPanel.jsx`
- MODIFIED `apps/control-plane/src/App.jsx` (imports)

**Behavior:** zero changes.

**Verification:** dashboard renders identically.

**Reversibility:** trivial revert.

---

### Slice 5 — Form panels → `components/`

**What:** move the 4 stateful side panels:
- `TenantControls`
- `BrandingPanel`
- `EntitlementsPanel`
- `ProvisioningPanel`

Each owns local form state + an action via `controlPlaneApi`. Move each to its own file. **No state hoisting** in this slice — they each keep their `useState`/`useEffect` calls.

**Files touched:**
- NEW `apps/control-plane/src/components/TenantControls.jsx`
- NEW `apps/control-plane/src/components/BrandingPanel.jsx`
- NEW `apps/control-plane/src/components/EntitlementsPanel.jsx`
- NEW `apps/control-plane/src/components/ProvisioningPanel.jsx`
- MODIFIED `apps/control-plane/src/App.jsx` (imports)

**Behavior:** zero changes.

**Verification:** save tenant metadata → confirm round-trip; sync branding → confirm round-trip; toggle an entitlement → confirm round-trip; create a provisioning checklist → confirm row appears.

**Reversibility:** revert per-panel if any extraction misbehaves.

---

### Slice 6 — Tenant data hooks

**What:** extract `useTenantList()` and `useTenantDetail(tenantId)` from `ConsoleScreen`'s inline state.

**Files touched:**
- NEW `apps/control-plane/src/hooks/useTenantList.js`
- NEW `apps/control-plane/src/hooks/useTenantDetail.js`
- MODIFIED `apps/control-plane/src/App.jsx` (ConsoleScreen now consumes the hooks)

**Hook signatures:**
```js
function useTenantList() {
  return {
    tenants,         // array, never null
    loading,         // initial fetch
    error,           // error message string or ''
    reload,          // () => Promise<void>
  };
}

function useTenantDetail(tenantId) {
  return {
    tenantDetail,    // { tenant, plans, planEntitlements, events } or null
    error,
    reload,          // () => Promise<void>
  };
}
```

**Behavior preservation:**
- `useTenantList` defaults `tenants = []`, `loading = true`, `error = ''` — same as current.
- `useTenantDetail` runs whenever `tenantId` changes (same as current `useEffect([selectedTenant?.id])`).
- Selection state (`selectedTenant`) stays in `ConsoleScreen` — it's UI state, not data state.

**Tests:** add `tests/unit/control-plane/useTenantList.test.mjs` once the hook exists. Mock `controlPlaneApi.listTenants` and verify state transitions on mount, reload, error.

**Verification:**
```bash
npm run test:unit
npm run build:control-plane
```

**Reversibility:** revert via single commit.

---

### Slice 7 — `ConsoleScreen` to its own file + slim App.jsx

**What:** move `ConsoleScreen` to `components/ConsoleScreen.jsx`. After this, `App.jsx` becomes ~30 lines of routing only.

**Files touched:**
- NEW `apps/control-plane/src/components/ConsoleScreen.jsx`
- MODIFIED `apps/control-plane/src/App.jsx` (final routing-only form)

**Final App.jsx shape:**
```jsx
import MissingEnvScreen from './components/MissingEnvScreen';
import LoginScreen from './components/LoginScreen';
import ConsoleScreen from './components/ConsoleScreen';
import { useControlPlaneSession } from './hooks/useControlPlaneSession';

export default function App() {
  const { envStatus, session, booting, setSession, signOut } = useControlPlaneSession();
  if (!envStatus.hasUrl || !envStatus.hasAnonKey) return <MissingEnvScreen />;
  if (booting) return <main className="grid min-h-screen place-items-center bg-slate-950 text-white">Opening console…</main>;
  if (!session) return <LoginScreen onSignedIn={setSession} />;
  return <ConsoleScreen session={session} onSignOut={signOut} />;
}
```

**Behavior:** zero changes.

**Verification:** end-to-end sign-in → console flow manually.

**Reversibility:** revert via single commit.

---

## 5. Order rationale

The handoff prescribes **Slice 1 first** ("Move control-plane session/auth state out of `App.jsx` into a hook"). I'm following that even though Slice 2 (UI primitives, pure file moves) would be lower-risk. Reason: the handoff's senior author already weighed this and chose 1 first; deviating without cause violates §13 ("Move in small slices… do not add anything you cannot explain, undo, test, and maintain").

Slices 2–7 are ordered low-to-high risk:
- Slice 2 (UI primitives) — pure file moves, zero state
- Slice 3 (static screens) — small components, no shared state
- Slice 4 (display panels) — no state at all
- Slice 5 (form panels) — local state only, each panel independent
- Slice 6 (tenant data hooks) — touches data fetching state, slightly more complex
- Slice 7 (ConsoleScreen extraction) — final assembly

Each slice should land as a separate commit on its own branch or via a sequence of commits on a single branch. Each must keep `npm run build:control-plane` green.

---

## 6. Anti-goals for this refactor

1. **No behavior changes**, except documented bugs found during extraction (file them as separate commits/issues).
2. **No new dependencies.**
3. **No styling changes** — copy the className strings exactly.
4. **No promotion to `packages/ui/components/ui/`** in this refactor. The control-plane primitives have different visual specs from the existing shared ones; promotion is a separate decision.
5. **No state hoisting beyond what's specified.** Per-panel local state stays per-panel.
6. **No new business logic.** All `controlPlaneApi.*` calls remain unchanged.
7. **No introduction of TypeScript** for the JSX files in this refactor (they're `.jsx`; the existing Edge Functions in `supabase-control-plane/functions/` are `.ts` — that's a separate consideration).

---

## 7. Success criteria

After Slice 7 lands, the directory matches §3. Specifically:

- [ ] `App.jsx` is ≤ 50 lines.
- [ ] `ConsoleScreen.jsx` is ≤ 80 lines.
- [ ] No file in `apps/control-plane/src/` exceeds 150 lines except imports of saasCatalog data.
- [ ] `npm run lint` clean.
- [ ] `npm run build:control-plane` clean.
- [ ] `npm run verify` chain green.
- [ ] Manual: sign-in → tenant list → select tenant → save metadata → sync branding → toggle entitlement → create provisioning job. All round-trips succeed and audit events appear.
- [ ] Visual inspection: console looks identical to pre-refactor.

---

## 8. Out of scope (future slices, not this refactor)

These are real next steps but each is its own work-window:

- **FINDING-1 (Phase 0 baseline §14.5):** replace `.select('*')` in `supabase-control-plane/functions/admin-get-tenant/index.ts` with explicit field lists. Bundle into Phase 1 follow-up.
- **Promotion of UI primitives** to `packages/ui/components/ui/` if a second app surface needs them.
- **Add `tests/unit/control-plane/*` coverage** for hooks once the hooks exist.
- **Remove `LoginScreen.onSignedIn` prop** in favor of the hook's auth subscription firing automatically. Behavior change → separate slice.
- **Add ESLint rule** to keep `apps/control-plane/src/App.jsx` from regressing past the line limit.
- **Phase 2 work** (state machine + mutation contracts) per `SAAS_FOUNDATION_PHASE_HANDOFF.md` §7 — comes after this refactor.

---

Slices 1-7 should be executed in order and verified at each step.

---

## 9. Execution status — completed 2026-05-08

Slices completed in order:

- [x] Slice 1 — `useControlPlaneSession` hook.
- [x] Slice 2 — app-local UI primitives under `components/ui/`.
- [x] Slice 3 — `MissingEnvScreen` and `LoginScreen` extraction.
- [x] Slice 4 — read-only panels extraction.
- [x] Slice 5 — form panels extraction.
- [x] Slice 6 — `useTenantList` and `useTenantDetail` hooks.
- [x] Slice 7 — `ConsoleScreen` extraction; `App.jsx` is now routing-only.

Final source-file size check:

```txt
apps/control-plane/src/App.jsx                         15 lines
apps/control-plane/src/components/ConsoleScreen.jsx    70 lines
apps/control-plane/src/hooks/useControlPlaneSession.js 69 lines
apps/control-plane/src/hooks/useTenantList.js          31 lines
apps/control-plane/src/hooks/useTenantDetail.js        31 lines
Largest source file in apps/control-plane/src:         79 lines
```

Verification run:

```txt
npm run lint                 PASS
npm run build:control-plane  PASS
npm run verify               PASS
npm run build:patient        PASS
npm run build:ops            PASS
```

Notes:

- This pass intentionally remained behavior-preserving. No DB, API, auth, RBAC, entitlement, or provisioning behavior was changed.
- Hook unit tests were not added because the repo does not currently include a React hook test renderer. The extraction was verified through lint, builds, and the full unit/contract suite.
- `test:backend-db-contract` still skips branch/local SQL and pgTAP execution when `BACKEND_TEST_DATABASE_URL` is not set; anon RPC matrix checks did run and pass.

**End of REFACTOR_PLAN.md.**
