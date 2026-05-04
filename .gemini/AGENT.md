# DoctoLeb — Agent Codebase Map

> **Purpose**: Comprehensive context for any AI agent to locate and modify any section of the DoctoLeb platform.
> **Last Updated**: 2026-05-03

---

## Architecture Overview

DoctoLeb is a **React + Vite** clinic management SPA backed by **Supabase** (Postgres + Auth + Edge Functions + Realtime).

```
src/
├── App.jsx              # Router — all routes + context providers
├── lib/                 # Shared utilities (supabase client, animations, time helpers)
├── services/            # Data access layer — ALL database ops go through here
├── contexts/            # React context providers (Auth, Toast, Sidebar, Theme)
├── components/          # Shared UI components
└── pages/               # Route-level page components
```

---

## Routing Map (App.jsx)

### Public Routes
| Route | Page | Notes |
|-------|------|-------|
| `/` | `LandingPage` | Marketing landing |
| `/login` | `LoginPage` | Auth entry |
| `/signup` | `SignUpPage` | Registration |
| `/marketing` | `MarketingPage` | Feature showcase |
| `/demo` | `DemoPage` | ⚠️ **SHOULD BE REMOVED OR GATED FOR PRODUCTION** |
| `/forgot-password` | `ForgotPasswordPage` | |
| `/reset-password` | `ResetPasswordPage` | |

### Secretary Routes (`requiredRole: secretary`)
| Route | Page | Sidebar |
|-------|------|---------|
| `/dashboard` | `DashboardPage` | `<Sidebar />` |
| `/patients` | `PatientsPage` | `<Sidebar />` |
| `/appointments` | `AppointmentsPage` | `<Sidebar />` |
| `/billing` | `BillingPage` | `<Sidebar />` |
| `/billing/new` | `CreateBillPage` | `<Sidebar />` |
| `/secretary-slots` | `SecretarySlotsPage` | `<Sidebar />` |
| `/secretary-booking` | `SecretaryBookingPage` | `<Sidebar />` |

### Pre-Doctor Routes (`requiredRole: predoctor`)
| Route | Page | Sidebar |
|-------|------|---------|
| `/predoctor-dashboard` | `PreDoctorDashboardPage` | `<PreDoctorSidebar />` |
| `/predoctor-patients` | `PreDoctorPatientsPage` | `<PreDoctorSidebar />` ✅ |
| `/predoctor-new-check` | `PreDoctorCheckPage` | `<PreDoctorSidebar />` ✅ |
| `/predoctor-appointments` | `PreDoctorAppointmentsPage` | `<PreDoctorSidebar />` |
| `/predoctor-notifications` | `PreDoctorNotificationsPage` | `<PreDoctorSidebar />` |
| `/predoctor-success` | `PreDoctorSuccessPage` | `<PreDoctorSidebar />` ✅ |
| `/predoctor-schedule` | `PreDoctorSchedulePage` | `<PreDoctorSidebar />` |

### Doctor Routes (`requiredRole: doctor`)
| Route | Page | Sidebar |
|-------|------|---------|
| `/doctor-dashboard` | `DoctorDashboardPage` | `<DoctorSidebar />` |
| `/doctor-patients` | `DoctorPatientsPage` | `<DoctorSidebar />` |
| `/doctor-appointments` | `DoctorAppointmentsPage` | `<DoctorSidebar />` |
| `/doctor-consultation` | `DoctorConsultationPage` | `<DoctorSidebar />` (inline header) |
| `/doctor-consultation/:id` | `DoctorConsultationPage` | Same as above |
| `/doctor-lab-request` | `DoctorLabRequestPage` | `<DoctorSidebar />` (inline header) |
| `/doctor-patient/:id` | `DoctorPatientProfilePage` | `<DoctorSidebar />` |
| `/doctor-patient-history/:id` | `DoctorMedicalHistoryPage` | `<DoctorSidebar />` (inline header) |
| `/doctor-reports` | `DoctorReportsPage` | `<DoctorSidebar />` (inline header) |
| `/doctor-referrals` | `DoctorReferralsPage` | `<DoctorSidebar />` |
| `/doctor-certificates` | `DoctorCertificatesPage` | `<DoctorSidebar />` |

### Patient Routes (`requiredRole: patient`)
| Route | Page |
|-------|------|
| `/patient-dashboard` | `PatientDashboardPage` |
| `/patient-profile` | `PatientOwnProfilePage` |
| `/patient-appointments` | `PatientAppointmentsPage` |
| `/patient-history` | `PatientMedicalHistoryPage` |
| `/patient-profile/:id` | `PatientProfilePage` (shared — secretary/doctor can view) |

---

## Service Layer (src/services/)

**Rule**: Pages NEVER import `supabase` directly. All database operations go through a service.

| Service | File | Domain |
|---------|------|--------|
| `api` | `api.js` | Supabase Edge Function calls |
| `appointmentService` | `appointments.js` | CRUD for appointments |
| `authService` | `auth.js` | Login, signup, session management |
| `certificateService` | `certificates.js` | Medical certificates |
| `clinicService` | `clinics.js` | Clinic profiles |
| `consultationService` | `consultations.js` | Doctor consultation sessions |
| `doctorService` | `doctors.js` | Doctor profiles / availability |
| `notificationService` | `notifications.js` | Push notifications + role-based alerts |
| `patientService` | `patients.js` | Patient CRUD + search |
| `paymentService` | `payments.js` | Billing / invoices |
| `precheckService` | `prechecks.js` | Pre-doctor triage forms |
| `referralService` | `referrals.js` | Doctor referral letters |
| `reportService` | `reports.js` | Medical reports |
| `slotService` | `slots.js` | Appointment slot management |

---

## Context Providers (src/contexts/)

| Context | Hook | Provides |
|---------|------|----------|
| `AuthContext` | `useAuth()` | `user`, `login()`, `logout()`, `signup()`, `loading` |
| `ToastContext` | `useToast()` | `showToast(message, type)` |
| `SidebarContext` | `useSidebar()` | `isCollapsed`, `toggleSidebar()`, `mobileOpen`, `closeMobile()` |
| `ThemeContext` | `useTheme()` | `isDarkMode`, `setIsDarkMode()`, `customBg`, `setCustomBg()` |

### `user` Object Shape (from `useAuth()`)
```js
{
  id: "uuid",
  email: "...",
  first_name: "...",
  last_name: "...",
  role: "doctor" | "predoctor" | "secretary" | "patient",
  phone: "...",
  // NO .name, NO .initials — always compute these dynamically
}
```

---

## Shared Components (src/components/)

| Component | Purpose |
|-----------|---------|
| `Sidebar.jsx` | Secretary sidebar with collapse + mobile drawer |
| `DoctorSidebar.jsx` | Doctor sidebar with collapse + mobile drawer |
| `PreDoctorSidebar.jsx` | Pre-Doctor sidebar with collapse + mobile drawer |
| `MobileTopBar.jsx` | Mobile header bar (dashboard pages only) |
| `BorderGlow.jsx` | Animated glow border effect (dashboard cards) |
| `CountUp.jsx` | Animated number counter (stat cards) |
| `TrueFocus.jsx` | Focus animation effect (landing page) |
| `ErrorBoundary.jsx` | React error boundary wrapper |
| `ProtectedRoute.jsx` | Route guard — checks auth + role |

---

## Shared Utilities (src/lib/)

| File | Exports | Notes |
|------|---------|-------|
| `supabase.js` | `supabase` client instance | Single Supabase client |
| `animations.js` | `stagger`, `fadeUp`, `formFade` | Framer Motion variants — import instead of re-declaring |
| `userDisplay.js` | `getUserDisplayName()`, `getUserInitials()`, `getDoctorLabel()` | User identity display helpers — use instead of inline template literals |
| `dateUtils.js` | `timeAgo()` | Relative time display — use instead of local `timeAgo` functions |
| `authIdentity.js` | Identity helpers | Auth-related utility functions |
| `routes.js` | Route constants | Route path definitions |
| `selects.js` | Select option configs | Dropdown option arrays |
| `time.js` | Time formatting utilities | Date/time display helpers |
| `appointments.js` | Appointment helpers | Shared appointment logic |

---

## Shared Hooks (src/hooks/)

| Hook | File | Purpose |
|------|------|---------|
| `useSignaturePad` | `useSignaturePad.js` | Canvas-based signature drawing — used by Certificates & Referrals pages |

---

## Per-Page Patterns

### Header Identity Pattern
Pages that show user identity in the header should:
```jsx
import { useAuth } from '../contexts/AuthContext';
// Inside component:
const { user } = useAuth();
// In JSX:
<p>{user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Doctor'}</p>
<div>{user?.first_name ? `${user.first_name[0]}${(user.last_name||'')[0]||''}`.toUpperCase() : '?'}</div>
```

### Sidebar Pattern
- Secretary pages → `<Sidebar />`
- Doctor pages → `<DoctorSidebar />`
- Pre-Doctor pages → `<PreDoctorSidebar />`
- **NEVER** inline sidebar navigation. Always use the shared component.

### Animation Pattern
```jsx
import { stagger, fadeUp } from '../lib/animations';
// Use as Framer Motion variants
```

---

## Known Remaining Issues

| Issue | File | Priority |
|-------|------|----------|
| Mock `NOTIFICATIONS` constant (names sanitized, still static) | `PreDoctorNotificationsPage.jsx` L6-18 | Medium — needs `notificationService` |
| Hardcoded `AVAILABLE_SERVICES` array | `CreateBillPage.jsx` L13 | Low — could be a DB table |
| `/demo` route exposed in production | `App.jsx` L59 | Medium — gate or remove |
| `console.error` in catch blocks (~24 instances) | Various pages | Low — acceptable for error logging |
| Bundle > 500KB (1.2MB) | Build output | Low — needs code-splitting with dynamic `import()` |

## Resolved Issues (this sprint)

- ✅ All `user?.initials` references (15+ locations) — replaced with computed initials
- ✅ All `user?.name` references — replaced with `getUserDisplayName()`
- ✅ "PRECISION" watermark in CertificatesPage — changed to "DOCTOLEB"
- ✅ "Dr. Sarah Jenkins" testimonial — changed to generic
- ✅ "Draft v1.2" label in ReferralsPage — changed to "Draft"
- ✅ Signature pad duplication in Certs + Referrals — extracted to `useSignaturePad` hook
- ✅ Animation constants duplicated in 10+ pages — centralized to `lib/animations.js`
- ✅ `timeAgo()` duplicated in 2 pages — centralized to `lib/dateUtils.js`
- ✅ Mock patient names in notification data — sanitized
