# Tier 3 — Frontend Production Hardening Plan

> **Goal**: Zero repeated code. Zero mock data. Every page uses shared components and hooks.
> **Principle**: Not over-designed — every abstraction must eliminate real duplication.

---

## Current State (Audit Results)

| Problem | Count | Impact |
|---|---|---|
| Layout shell duplicated (`flex h-screen + Sidebar + header`) | **20+ pages** | 🔴 Critical |
| Sticky header bar copy-pasted | **10 pages** | 🔴 Critical |
| Relative imports (`../components/`, `../services/`) | **35+ files** | 🟡 Medium |
| `useState(loading) + setLoading(true/false)` inline lifecycle | **20+ pages** | 🟡 Medium |
| Inline loading/error guards (hand-rolled spinners) | **15+ pages** | 🟡 Medium |
| Input CSS class string duplicated in page files | **3 pages** | 🟢 Low |
| 3 separate Sidebar components with 70%+ shared code | **3 files** | 🟡 Medium |
| Single 1.26MB JS chunk (no code splitting) | **1 bundle** | 🟡 Medium |

### Page Size Inventory (lines of code)

| > 500 lines (must refactor) | 300-500 lines (should refactor) | < 300 lines (fine) |
|---|---|---|
| AppointmentsPage (1436) | DoctorLabRequestPage (476) | ResetPasswordPage (135) |
| PatientsPage (942) | PreDoctorDashboardPage (476) | PreDoctorPatientsPage (127) |
| CreateBillPage (817) | DoctorMedicalHistoryPage (478) | DoctorPatientsPage (138) |
| BillingPage (768) | DoctorConsultationPage (488) | PreDoctorSuccessPage (120) |
| DashboardPage (618) | DoctorCertificatesPage (510) | NotFoundPage (51) |
| DoctorAppointmentsPage (568) | PatientProfilePage (452) | MarketingPage (40) |
| DoctorDashboardPage (539) | PatientOwnProfilePage (402) | |
| SecretarySlotsPage (531) | DoctorReportsPage (393) | |
| | DoctorReferralsPage (351) | |
| | PatientAppointmentsPage (413) | |

---

## Phase 1 — Layout Consolidation (20+ pages)

**What**: Every dashboard page currently copy-pastes 3 identical blocks:
1. `<div className="flex h-screen w-full bg-[var(--bg-base)] ...">` (layout shell)
2. `<DoctorSidebar />` / `<PreDoctorSidebar />` / `<Sidebar />` (sidebar)
3. `<header className="sticky top-0 z-20 h-20 bg-white/80 ...">` (top bar)

**Fix**: Upgrade existing `DashboardLayout` to accept a `sidebar` prop, then wrap every page.

### Before (every page):
```jsx
import DoctorSidebar from '../components/DoctorSidebar';
export default function DoctorAppointmentsPage() {
  return (
    <div className="flex h-screen w-full bg-[var(--bg-base)] text-[var(--text-base)] overflow-hidden">
      <DoctorSidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="sticky top-0 z-20 h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          {/* search + buttons copy-pasted */}
        </header>
        <div className="flex-1 overflow-y-auto p-8 pb-12">
          {/* actual page content */}
        </div>
      </main>
    </div>
  );
}
```

### After:
```jsx
import { DashboardLayout } from '@/components/layouts';
export default function DoctorAppointmentsPage() {
  return (
    <DashboardLayout role="doctor" title="Appointments">
      {/* actual page content only */}
    </DashboardLayout>
  );
}
```

### Task List:
- [ ] Upgrade `DashboardLayout` to accept `role` prop → auto-selects sidebar (`doctor` | `predoctor` | `secretary`)
- [ ] Build `TopBar` component extracting the sticky header pattern
- [ ] Wrap all 10 doctor pages
- [ ] Wrap all 6 predoctor pages
- [ ] Wrap all 5 secretary pages
- [ ] Build + verify zero errors

**Expected result**: ~15 lines removed per page × 21 pages = **~315 lines eliminated**

---

## Phase 2 — Import Standardization

**What**: 35+ pages still use relative imports like `'../components/DoctorSidebar'`, `'../services/patients'`, `'../contexts/AuthContext'`.

**Fix**: Batch-replace all relative imports to use the `@/` alias.

### Task List:
- [x] `../components/` → `@/components/`
- [x] `../services/` → `@/services/`
- [x] `../contexts/` → `@/contexts/`
- [x] `../lib/` → `@/lib/`
- [x] `../hooks/` → `@/hooks/`
- [x] Build + verify

**Expected result**: Consistent import paths across entire codebase. Zero `../` imports in pages.

---

## Phase 3 — Hook Adoption (Data-Heavy Pages)

**What**: The 8 largest pages (500+ lines each) contain inline fetch logic: `useState(loading) → useEffect → service.getAll() → setData → setLoading(false) → catch → setError`. This exact pattern is repeated 20+ times across the app.

**Fix**: Replace with existing hooks where available. Create new hooks where needed.

### Existing hooks ready to use:
| Hook | Target Page | Lines Saved |
|---|---|---|
| `usePatients` | PatientsPage, PreDoctorPatientsPage | ~30 each |
| `useAppointments` | AppointmentsPage, DoctorAppointmentsPage, PreDoctorAppointmentsPage | ~40 each |
| `useBilling` | BillingPage | ~50 |
| `useCertificates` | DoctorCertificatesPage | ~25 |
| `useNotifications` | PreDoctorNotificationsPage, PreDoctorDashboardPage | ~30 each |
| `useReferrals` | DoctorReferralsPage | ~20 |

### New hooks to create:
| Hook | Purpose | Target Pages |
|---|---|---|
| `useSlots` | Slot CRUD + availability logic | SecretarySlotsPage, SecretaryBookingPage, PreDoctorSchedulePage |
| `useConsultation` | Consultation fetch + save | DoctorConsultationPage |
| `useMedicalHistory` | Patient history fetch | DoctorMedicalHistoryPage, PatientMedicalHistoryPage |
| `useLabRequest` | Lab request form + submit | DoctorLabRequestPage |
| `useReports` | Report fetch + generate | DoctorReportsPage |
| `useFormSubmit` | Generic form submit lifecycle (isSaving, error, success) | 8+ form pages |

### Task List:
- [ ] Create `useSlots`, `useConsultation`, `useMedicalHistory`, `useLabRequest`, `useReports`
- [ ] Create `useFormSubmit` generic hook
- [ ] Refactor each 500+ line page to use its feature hook
- [ ] Replace inline `if(loading) return <spinner>` with `LoadingSkeleton` component
- [ ] Replace inline error divs with `ErrorState` component
- [ ] Build + verify after each page

**Expected result**: Average 500-line page drops to ~250 lines. Zero inline `setLoading` in pages.

---

## Phase 4 — Shared CSS Classes

**What**: 3 pages define the same input class string locally:
```js
const INPUT_CLS = 'w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-300';
```

**Fix**: Move to `@/lib/styles.js` (already exists), import everywhere.

### Task List:
- [ ] Add `INPUT_CLS`, `TEXTAREA_CLS`, `SELECT_CLS`, `BUTTON_PRIMARY_CLS`, `BUTTON_SECONDARY_CLS` to `@/lib/styles.js`
- [ ] Replace in SecretarySlotsPage, SecretaryBookingPage, PatientsPage
- [ ] Scan remaining pages for inline class strings that should be shared
- [ ] Build + verify

---

## Phase 5 — Route-Level Code Splitting

**What**: Entire app ships as a single 1.26MB JS chunk. Every page loads even if user only visits login.

**Fix**: Use `React.lazy()` + `Suspense` for route-level splitting in `App.jsx`.

### Before:
```jsx
import AppointmentsPage from './pages/AppointmentsPage';
```

### After:
```jsx
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage'));
```

### Task List:
- [ ] Convert all 36 page imports in `App.jsx` to `React.lazy()`
- [ ] Wrap `<Routes>` in `<Suspense fallback={<LoadingSkeleton />}>`
- [ ] Build + verify chunk splitting works (should produce multiple smaller JS files)
- [ ] Confirm initial load drops below 500KB

---

## Phase 6 — Final Audit & Verification

### Automated checks:
- [ ] `grep -r "console.error" src/pages/` → must return 0
- [ ] `grep -r "bg-\[#" src/pages/` → must return 0 (no hardcoded colors)
- [ ] `grep -r "font-\['Inter'\]" src/` → must return 0
- [ ] `grep -r "from '\.\." src/pages/` → must return 0 (no relative imports)
- [ ] `grep -r "useState(true)" src/pages/` → only for local UI state, never for data loading
- [ ] `grep -r "setLoading" src/pages/` → must return 0 (all in hooks)
- [ ] `vite build` → 0 errors, main chunk < 500KB

### Manual checks:
- [ ] Every dashboard page renders inside DashboardLayout
- [ ] No page imports a Sidebar directly
- [ ] No page defines its own loading spinner HTML
- [ ] All data fetching goes through hooks, never raw in useEffect inside pages
- [ ] Shared UI components have no imports from feature code

---

## Execution Order

```
Phase 1 (Layout) → Phase 2 (Imports) → Phase 3 (Hooks) → Phase 4 (CSS) → Phase 5 (Splitting) → Phase 6 (Audit)
```

Each phase ends with a build verification. No phase starts until the previous passes.

**Total estimated impact**: ~3000 lines eliminated, 0 duplicated patterns remaining.
