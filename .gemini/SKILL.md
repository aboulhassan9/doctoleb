# DoctoLeb — SKILL.md
# Technical Patterns, Conventions & Implementation Guide

> **Read this BEFORE writing any code.** This file defines how every line of code in DoctoLeb should be structured.

---

## 1. Technology Stack

| Layer | Current | Target (Production) |
|---|---|---|
| Frontend Web | React 19 + Vite 8 + JSX | React 19 + Vite 8 + **TypeScript (TSX)** |
| Styling | Tailwind CSS 3.4 | Tailwind CSS 3.4 + **proper dark: variants** |
| State | React Context (4 providers) | React Context + **TanStack Query v5** for server state |
| Animations | Framer Motion 12 | Framer Motion 12 (keep — remove GSAP/Three.js deps) |
| Icons | Material Symbols + Lucide React | Lucide React (consolidate) |
| Backend | Supabase (Auth, Postgres, Edge Functions, Realtime) | Same + **Storage** + **Edge Functions expansion** |
| Validation | None | **Zod** schemas (shared web + mobile) |
| Mobile (Future) | N/A | **React Native / Expo** (patient-facing app) |
| API Layer (Future) | Direct Supabase from client | **Supabase Edge Functions as API gateway** for mobile |

---

## 2. Project Architecture

### 2.0 Product Model

DoctoLeb is the management system for **one specific clinic with multiple doctors**.

It is not a SaaS marketplace:
- no public doctor self-registration
- no tenant onboarding or tenant switching
- no subscription/customer account layer for clinics
- no cross-clinic discovery or booking marketplace

Patients may self-register from the public web flow. Staff accounts (`doctor`, `predoctor`, `secretary`, future `admin`) are created through a trusted internal clinic workflow.

### 2.1 Monorepo Structure (Target)

```
doctoleb/
├── apps/
│   ├── web/                    # Vite + React dashboard (clinic admin, doctor, secretary, predoctor)
│   │   ├── src/
│   │   │   ├── components/     # UI components (split into proper files)
│   │   │   ├── contexts/       # React Context providers
│   │   │   ├── hooks/          # Custom hooks (useDebounce, usePagination, etc.)
│   │   │   ├── layouts/        # Shell layouts per role
│   │   │   ├── pages/          # Route-level page components
│   │   │   └── lib/            # Supabase client, utils
│   │   └── index.html
│   └── mobile/                 # React Native / Expo (patient-facing)
│       ├── src/
│       │   ├── screens/        # Screen components
│       │   ├── navigation/     # Stack/Tab navigators
│       │   ├── components/     # Mobile-specific components
│       │   └── lib/            # Supabase client for mobile
│       └── app.json
├── packages/
│   ├── shared/                 # Shared code between web & mobile
│   │   ├── schemas/            # Zod validation schemas
│   │   ├── types/              # TypeScript interfaces/types
│   │   ├── constants/          # Roles, statuses, config
│   │   └── services/           # Supabase service layer (shared)
│   └── ui/                     # Shared design tokens (colors, spacing)
├── supabase/
│   ├── migrations/             # Versioned SQL migrations
│   ├── functions/              # Edge Functions (API endpoints)
│   ├── seed.sql                # Dev seed data
│   └── config.toml             # Supabase project config
└── docs/                       # Architecture docs, API specs
```

### 2.2 Current Structure (Until Migration)

Keep the existing `src/` flat structure but enforce the patterns below. Migration to monorepo happens in Phase 5.

---

## 3. Role System

### 3.1 Roles & Permissions Matrix

| Permission | `admin` | `doctor` | `predoctor` | `secretary` | `patient` |
|---|:---:|:---:|:---:|:---:|:---:|
| **User Management** | ✅ CRUD all | ❌ | ❌ | ✅ Create walk-in | ❌ |
| **Clinic Settings** | ✅ Full | ❌ | ❌ | ✅ View/Edit | ❌ |
| **Patient Records** | ✅ All | ✅ Own patients | ✅ Assigned patients | ✅ All (no medical) | ✅ Own only |
| **Appointments** | ✅ All | ✅ Own schedule | ✅ View assigned | ✅ CRUD all | ✅ Own (book/cancel) |
| **Consultations** | ✅ View all | ✅ CRUD own | ✅ Pre-check only | ❌ | ✅ View own |
| **Prescriptions** | ❌ | ✅ Create/Sign | ❌ | ❌ | ✅ View own |
| **Billing/Payments** | ✅ All | ✅ View own | ❌ | ✅ CRUD all | ✅ View own |
| **Reports/Certs** | ✅ All | ✅ CRUD own | ❌ | ❌ | ✅ View own |
| **Referrals** | ✅ All | ✅ Send/receive | ❌ | ❌ | ✅ View own |
| **Notifications** | ✅ Manage all | ✅ Own | ✅ Own | ✅ Own | ✅ Own |
| **Analytics** | ✅ Full | ✅ Own stats | ❌ | ✅ Clinic stats | ❌ |
| **Slot Management** | ✅ All | ❌ | ❌ | ✅ CRUD | ❌ |
| **File Uploads** | ✅ All | ✅ Medical files | ✅ Pre-check files | ✅ Administrative | ✅ Own documents |

### 3.2 Admin Role (NEW — Currently Missing)

The `admin` role is the **clinic owner/manager**. It has:
- Full CRUD on all users (create doctors, secretaries, predoctors)
- Clinic settings management
- Analytics dashboard with revenue, patient volume, doctor performance
- Audit log viewer
- System configuration (working hours, holidays, notification templates)

### 3.3 Role Resolution

```javascript
// User object shape (from AuthContext)
{
  id: 'uuid',
  email: 'string',
  role: 'admin' | 'doctor' | 'predoctor' | 'secretary' | 'patient',
  first_name: 'string',
  last_name: 'string',
  initials: 'string',
  is_active: boolean,
  patient_id: 'uuid | null',    // Only for patient role
  doctor_id: 'uuid | null',     // Only for doctor/predoctor role
  clinic_id: 'uuid | null',     // Staff roles
}
```

---

## 4. Service Layer Pattern

### 4.1 Standard Service Template

Every service file MUST follow this pattern:

```typescript
// services/example.ts
import { supabase } from '@/lib/supabase';
import { ExampleSchema, ExampleCreateSchema } from '@/schemas/example';
import type { Example, ExampleCreate } from '@/types/example';

export const exampleService = {
  /**
   * Get all with pagination + role-based filtering
   */
  async getAll(options: {
    page?: number;
    pageSize?: number;
    userId?: string;
    role?: string;
    filters?: Record<string, unknown>;
  }): Promise<{ data: Example[] | null; count: number; error: string | null }> {
    const { page = 1, pageSize = 20, userId, role, filters } = options;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('examples')
      .select('*', { count: 'exact' })
      .range(from, to)
      .order('created_at', { ascending: false });

    // Role-based filtering
    if (role === 'patient') {
      query = query.eq('patient_id', userId);
    } else if (role === 'doctor') {
      query = query.eq('doctor_id', userId);
    }

    // Dynamic filters
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
    }

    const { data, error, count } = await query;
    if (error) return { data: null, count: 0, error: error.message };
    return { data, count: count ?? 0, error: null };
  },

  /**
   * Create with validation
   */
  async create(input: ExampleCreate): Promise<{ data: Example | null; error: string | null }> {
    // Validate input
    const parsed = ExampleCreateSchema.safeParse(input);
    if (!parsed.success) {
      return { data: null, error: parsed.error.errors[0].message };
    }

    const { data, error } = await supabase
      .from('examples')
      .insert(parsed.data)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  },

  // ... update, delete, getById follow same pattern
};
```

### 4.2 Rules

1. **NEVER import `supabase` in page components.** Always go through `services/`.
2. **Every method returns `{ data, error }` shape** (or `{ data, count, error }` for lists).
3. **Every write method validates input with Zod** before hitting Supabase.
4. **Every list method supports pagination** via `.range(from, to)`.
5. **Every method includes role-based filtering** — patients see only their own data.
6. **No hard deletes on medical data.** Use `is_archived: true` + `archived_at: timestamp`.
7. **All `created_at` / `updated_at` use DB defaults** — never set client-side.

### 4.3 State Machine Pattern (for stateful entities)

```typescript
// Appointment status transitions
const APPOINTMENT_TRANSITIONS: Record<string, string[]> = {
  scheduled:  ['confirmed', 'cancelled'],
  confirmed:  ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['completed'],
  completed:  [],  // terminal
  cancelled:  [],  // terminal
  no_show:    ['scheduled'],  // allow rebooking
};

function canTransition(current: string, target: string): boolean {
  return APPOINTMENT_TRANSITIONS[current]?.includes(target) ?? false;
}
```

Apply to: `appointments`, `consultations`, `referrals`, `payments`.

---

## 5. Database Conventions

### 5.1 Table Design Rules

1. Every table has: `id UUID DEFAULT gen_random_uuid() PRIMARY KEY`
2. Every table has: `created_at TIMESTAMPTZ DEFAULT now()`, `updated_at TIMESTAMPTZ DEFAULT now()`
3. Medical tables add: `is_archived BOOLEAN DEFAULT false`, `archived_at TIMESTAMPTZ`, `archived_by UUID`
4. All foreign keys use `ON DELETE RESTRICT` (never CASCADE on medical data)
5. Use `CHECK` constraints for status enums
6. Use `UNIQUE` constraints where business logic demands it
7. Every table has RLS enabled with policies for ALL operations (SELECT, INSERT, UPDATE, DELETE)

### 5.2 RLS Policy Template

```sql
-- Enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "admin_full_access" ON table_name
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

-- Doctor: own records
CREATE POLICY "doctor_own_records" ON table_name
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'doctor')
    AND doctor_id = (SELECT id FROM doctors WHERE user_id = auth.uid())
  );

-- Patient: own records only
CREATE POLICY "patient_own_records" ON table_name
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'patient')
    AND patient_id = (SELECT id FROM patients WHERE user_id = auth.uid())
  );

-- Secretary: clinic-scoped access
CREATE POLICY "secretary_clinic_access" ON table_name
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'secretary')
  );
```

### 5.3 Migration Naming

```
YYYYMMDD_NN_description.sql
Example: 20260503_01_add_admin_role_and_audit_log.sql
```

---

## 6. Authentication Pattern

### 6.1 Auth Flow (Production)

```
1. Sign Up → supabase.auth.signUp() → DB trigger creates users + patients rows
2. Sign In → supabase.auth.signInWithPassword() → fetch profile → role-based redirect
3. Session  → getSession() on mount → onAuthStateChange listener
4. Logout   → supabase.auth.signOut() → clear all client state → redirect /login
5. Reset    → supabase.auth.resetPasswordForEmail() → email link → update password
```

### 6.2 Rules

1. **ONE auth system only** — Supabase Auth. Delete `auth-signin` edge function.
2. **Never store passwords in `users` table.** Remove `password_hash` column.
3. **Use DB trigger for user profile creation** — atomic, no orphans.
4. **Session timeout: 30 minutes idle** — configurable per clinic.
5. **Error handling on EVERY auth operation** — try/catch, user-facing error toasts.
6. **Concurrent request guard** — `isSubmitting` ref to prevent double-clicks.

---

## 7. Frontend Patterns

### 7.1 Page Component Structure

```tsx
// pages/ExamplePage.tsx
export default function ExamplePage() {
  // 1. Hooks (context, params, state)
  const { user } = useAuth();
  const [page, setPage] = useState(1);

  // 2. Data fetching (TanStack Query)
  const { data, isLoading, error } = useQuery({
    queryKey: ['examples', page, user.id],
    queryFn: () => exampleService.getAll({ page, userId: user.id, role: user.role }),
  });

  // 3. Mutations
  const createMutation = useMutation({
    mutationFn: exampleService.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['examples'] }),
  });

  // 4. Handlers
  const handleCreate = async (formData) => { ... };

  // 5. Early returns (loading, error, empty)
  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState message={error.message} />;
  if (!data?.length) return <EmptyState entity="examples" />;

  // 6. Render
  return ( ... );
}
```

### 7.2 Component Rules

1. **One component per file.** No concatenated notes files.
2. **Loading skeletons** on every data-fetching page.
3. **Error states** with retry button on every data-fetching page.
4. **Empty states** with illustration + CTA on every list page.
5. **Confirmation dialog** before any destructive action (delete, archive, cancel).
6. **Form validation** with inline error messages (Zod + react-hook-form).
7. **Lazy loading** — all route-level pages via `React.lazy()` + `Suspense`.
8. **Responsive** — mobile-first, test at 375px, 768px, 1024px, 1440px.

### 7.3 Route Protection

```tsx
<Route
  path="/admin/*"
  element={
    <ProtectedRoute requiredRole={['admin']}>
      <AdminLayout />
    </ProtectedRoute>
  }
/>
```

The `requiredRole` prop accepts an array of roles now (for shared pages).

---

## 8. API Design for Mobile

### 8.1 Edge Function API Gateway

All mobile API calls go through Supabase Edge Functions:

```
POST /functions/v1/api/auth/login
POST /functions/v1/api/auth/register
GET  /functions/v1/api/appointments?page=1&pageSize=20
POST /functions/v1/api/appointments/book
PUT  /functions/v1/api/appointments/:id/cancel
GET  /functions/v1/api/profile
PUT  /functions/v1/api/profile
GET  /functions/v1/api/medical-history
GET  /functions/v1/api/notifications
PUT  /functions/v1/api/notifications/:id/read
```

### 8.2 Response Shape (Standard)

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 150
  },
  "error": null
}
```

---

## 9. File Upload Pattern

### 9.1 Supabase Storage Buckets

| Bucket | Access | Purpose |
|---|---|---|
| `profile-photos` | Public (read) | User profile avatars |
| `medical-files` | Private (RLS) | X-rays, lab results, scans |
| `documents` | Private (RLS) | Certificates, reports, referral letters |
| `prescriptions` | Private (RLS) | Signed prescription PDFs |

### 9.2 Upload Flow

```typescript
async function uploadMedicalFile(file: File, patientId: string, category: string) {
  const path = `${patientId}/${category}/${Date.now()}_${file.name}`;
  const { data, error } = await supabase.storage
    .from('medical-files')
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) throw error;

  // Store reference in DB
  await supabase.from('file_attachments').insert({
    patient_id: patientId,
    bucket: 'medical-files',
    path: data.path,
    filename: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    category,
  });
}
```

---

## 10. Notification System

### 10.1 Channels

| Channel | Implementation | Use Case |
|---|---|---|
| In-App | Supabase Realtime | All notifications (bell icon + dropdown) |
| Email | Edge Function + Resend | Appointment confirmations, reports ready |
| SMS (future) | Edge Function + Twilio | Appointment reminders (24h before) |
| Push (mobile) | Expo Push / FCM | Real-time alerts for patient app |

### 10.2 Notification Types

```typescript
type NotificationType =
  | 'appointment_booked'
  | 'appointment_confirmed'
  | 'appointment_cancelled'
  | 'appointment_reminder'
  | 'consultation_started'
  | 'consultation_completed'
  | 'report_ready'
  | 'certificate_ready'
  | 'referral_received'
  | 'referral_accepted'
  | 'referral_rejected'
  | 'prescription_ready'
  | 'payment_received'
  | 'payment_due'
  | 'precheck_completed'
  | 'system_alert';
```

---

## 11. Audit Logging

Every state-changing operation MUST be logged:

```sql
CREATE TABLE audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,            -- 'create', 'update', 'delete', 'archive'
  entity_type TEXT NOT NULL,       -- 'appointment', 'patient', 'consultation', etc.
  entity_id UUID NOT NULL,
  changes JSONB,                   -- { field: { old: x, new: y } }
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 12. Error Handling Convention

```typescript
// Standard error types
type AppError = {
  code: string;          // 'VALIDATION_ERROR', 'NOT_FOUND', 'UNAUTHORIZED', etc.
  message: string;       // User-facing message
  details?: unknown;     // Dev-only details
};

// Service returns
type ServiceResult<T> = {
  data: T | null;
  error: string | null;  // Normalized to string for UI
  count?: number;         // For paginated lists
};
```

---

## 13. Testing Strategy

| Type | Tool | Coverage Target |
|---|---|---|
| Unit | Vitest | Services, validators, state machines |
| Component | Vitest + Testing Library | All form components, protected routes |
| Integration | Vitest + MSW | Auth flow, booking flow, payment flow |
| E2E | Playwright | Critical paths: login → book → consult → bill |
| API | Vitest | Edge Functions |

---

## 14. i18n Pattern

```typescript
// Use i18next with namespaced JSON files
// locales/en/common.json, locales/ar/common.json, locales/fr/common.json

// In components:
const { t } = useTranslation('appointments');
<h1>{t('title')}</h1>  // "Appointments" / "المواعيد" / "Rendez-vous"
```

Support: English (default), Arabic (RTL), French.

---

## 15. Mobile App Skill (Patient-Facing)

### 15.1 Features

1. **Auth**: Login, Register, Forgot Password, Biometric login
2. **Home**: Upcoming appointments, quick actions, health summary
3. **Appointments**: Browse doctors, view availability, book, cancel, reschedule
4. **Medical History**: Past consultations, medications, allergies, conditions
5. **Documents**: View/download prescriptions, reports, certificates
6. **Notifications**: Push notifications + in-app notification center
7. **Profile**: Personal info, insurance, emergency contact
8. **Payments**: View bills, payment history (future: online payment)

### 15.2 Offline Strategy

- Cache last-viewed medical history locally (encrypted)
- Queue appointment actions when offline, sync when online
- Show offline indicator banner

---

## 16. Security Checklist (Per Feature)

Before shipping ANY feature, verify:

- [ ] RLS policies cover all CRUD operations
- [ ] Input validated with Zod before DB write
- [ ] Role check in service layer (defense in depth)
- [ ] No `SELECT *` — explicit column selection, exclude `password_hash`
- [ ] Confirmation dialog on destructive actions
- [ ] Audit log entry for state changes
- [ ] Error handling with user-facing message
- [ ] Loading + error + empty states in UI
- [ ] Works on mobile viewport (375px)
- [ ] Tested with at least 2 roles
