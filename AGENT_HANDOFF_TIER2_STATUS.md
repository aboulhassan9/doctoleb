# DoctoLeb — Tier 2.5 Hardening: Agent Handoff

> **Date:** 2026-05-07
> **Status:** Tier 2.5 In-Progress — Foundation Solid, UI/Branding Incomplete
> **Architecture:** Database-per-Tenant, Monorepo, Mobile-Ready
> **Live DB:** `gezmfmskhmjgnquoyosq.supabase.co`

---

## 0. Project History (Phase 0 → Current)

| Phase | Name | Status | Summary |
|-------|------|--------|---------|
| **Tier 0** | Original Clinic App | ✅ Done | Single-clinic management system (pre-pivot) |
| **Tier 1** | Doctor Pivot (SaaS) | ✅ DB Done / ⚠️ UI Partial | Multi-tenant SaaS pivot. Schema migrated, `doctor_brand` → `tenant_profile`/`tenant_app_config`. 24 new tables added. |
| **Tier 2** | Security Review | ✅ Done | Full P1/P2/P3 audit. All P1+P2 closed. Lifecycle RPCs, storage RLS, idempotency, audit triggers deployed. |
| **Tier 2.5** | Hardening + UI | 🟡 In-Progress | Mobile RPCs, service layer, UI pages for new tables, BrandContext wiring, build system fixes. |
| **Block A-F** | Implementation Slices | ✅ Backend / ⚠️ Frontend partial | Encounter MVP, pgTAP scaffold, storage RLS, legacy burndown all done. Frontend runtime verification pending. |

---

## 1. System Architecture

### 1.1 Tenancy Model: Database-per-Tenant
```
┌─────────────────────────┐            ┌──────────────────────────────┐
│ Super-admin (you)       │            │ Each Doctor (own brand)      │
│ → Vercel project A      │            │ → Vercel project per tenant  │
│ → Control plane Supabase│            │ → Tenant Supabase project    │
└─────────────────────────┘            └──────────────────────────────┘
            │                                       │
            ├────── Supabase Mgmt API ──────────────┤
            │                                       │
            ▼                                       ▼
┌───────────────────────┐            ┌────────────────────────────────┐
│ Control-plane DB      │            │ Tenant DB (full DoctoLeb schema)│
│ - tenants table       │            │ - All clinical tables          │
│ - subscriptions       │            │ - tenant_profile               │
│ - billing             │            │ - tenant_app_config            │
│ - deployment status   │            │ - Users scoped to this tenant  │
└───────────────────────┘            └────────────────────────────────┘
```

**Key decision:** NO `tenant_id` columns anywhere. Each doctor gets their own isolated Supabase project.

### 1.2 Monorepo Structure
```
doctoleb/
├── apps/
│   ├── clinic-ops/        ← Doctor + Secretary + PreDoctor dashboards (port 3002)
│   │   ├── postcss.config.js  ← NEW: explicit Tailwind config resolution for Vite 8
│   │   └── src/pages/     ← 30+ pages
│   └── patient-web/       ← Patient-facing booking & profile app (port 3001)
│       └── postcss.config.js  ← NEW: same fix
├── packages/
│   ├── core/              ← Business logic, services, schemas, selects
│   │   ├── services/      ← 15+ service modules
│   │   ├── schemas/       ← Zod validation schemas
│   │   ├── lib/           ← Supabase client, selects, authIdentity, routes, stateMachines
│   │   └── hooks/         ← useDocumentTitle, useEncounterDraft, etc.
│   └── ui/                ← Shared React components, contexts, layouts
│       ├── components/    ← AppSidebar, DashboardLayout, Modal, ErrorBoundary
│       └── contexts/      ← AuthContext, ToastContext, ThemeContext, SidebarContext, BrandContext
├── supabase/
│   └── migrations/        ← All SQL migrations (baseline + incremental)
├── docs/erd/              ← ERD documentation (scaffolded, not complete)
├── tailwind.config.js     ← Root Tailwind config (both apps reference this)
├── postcss.config.js      ← Root PostCSS config
└── .env                   ← VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
```

### 1.3 Build System — CRITICAL FIX APPLIED THIS SESSION
- **Vite 8.0.10** + **Tailwind 3.4.19** — Rolldown bundler changes CWD resolution
- **Fix:** Added per-app `postcss.config.js` files that explicitly point to root `tailwind.config.js`
- **Both apps now build cleanly:** `clinic-ops ✓ built in 2.10s`, `patient-web ✓ built in 1.37s`

---

## 2. Database Schema (57 Tables, All RLS-Enabled)

### 2.1 Domain Tables
| Domain | Tables |
|--------|--------|
| **Auth & Users** | `users`, `patients`, `doctors`, `doctor_staff`, `patient_devices` |
| **Scheduling** | `clinics`, `secretary_slots`, `schedule_templates`, `appointments` |
| **Clinical** | `encounters`, `prescriptions`, `prescription_items`, `lab_orders`, `lab_order_tests`, `clinical_documents`, `doctor_referrals` |
| **Intake** | `medical_intake`, `patient_vaccinations`, `patient_surgeries`, `patient_diseases`, `patient_family_history` |
| **Insurance** | `insurance_providers`, `doctor_insurance_contracts`, `patient_insurance_policies`, `claim_form_templates`, `insurance_claims` |
| **Billing** | `bills`, `bill_items`, `payment_transactions` |
| **Messaging** | `conversations`, `conversation_participants`, `messages`, `message_reads` |
| **Notifications** | `notification_events`, `notification_deliveries` |
| **Consent & Content** | `consent_documents`, `patient_consents`, `content_pages` |
| **Catalogs** | `specialties`, `vaccines`, `diseases`, `surgery_types`, `visit_types`, `cities`, `occupations`, `blood_groups`, `family_relations` |
| **Tenant Config** | `tenant_profile`, `tenant_app_config`, `feature_flags` |

### 2.2 RPCs (Server-Side Functions)
| RPC | Purpose | Auth |
|-----|---------|------|
| `book_slot` | Atomic slot booking with visit_type + intake gate | `authenticated` |
| `get_available_slots` | Available slots for doctor/date | `authenticated` |
| `start_encounter` | Begin clinical encounter | `authenticated` |
| `complete_encounter` | Finalize encounter | `authenticated` |
| `cancel_encounter` | Abort encounter | `authenticated` |
| `finalize_clinical_document` | Lock document | `authenticated` |
| `void_clinical_document` | Void with reason | `authenticated` |
| `cancel_appointment` | Cancel with reason | `authenticated` |
| `get_public_tenant_app_config` | Public branding data | `anon` + `authenticated` |
| `update_patient_profile` | Patient self-update | `authenticated` |
| **Mobile RPCs:** | | |
| `get_my_appointments` | Patient's own appointments | `authenticated` |
| `get_my_medical_summary` | Patient dashboard summary | `authenticated` |
| `get_my_notifications` | In-app notifications | `authenticated` |
| `mark_notification_read` | Mark notification read | `authenticated` |
| `register_patient_device` | FCM/APNS token register | `authenticated` |
| **Utility:** | | |
| `current_doctor_id()` | Resolve auth → doctor | `authenticated` |
| `current_patient_id()` | Resolve auth → patient | `authenticated` |
| `current_user_role()` | Get user role | `authenticated` |
| `has_role(text[])` | Role check | `authenticated` |
| `is_staff()` | Staff check | `authenticated` |

---

## 3. Service Layer (packages/core/services/)

| Service | File | Key Methods |
|---------|------|-------------|
| `patientService` | `patients.js` | `getAll`, `getById`, `create`, `update`, `search`, `createWalkIn`, `archive` |
| `appointmentService` | `appointments.js` | `getAll`, `getById`, `bookFromSlot`, `cancel`, `markCompleted`, `markPreChecked` |
| `encounterService` | `encounters.js` | `getAll`, `start`, `complete`, `cancel`, `getByAppointment` |
| `insuranceService` | `insurance.js` | `getProviders`, `getDoctorContracts`, `getPatientPolicies`, `getClaimTemplates`, `createClaim`, `saveClaimTemplate`, `updateClaimTemplate` |
| `intakeService` | `intakes.js` | `getByPatientId`, `saveDraft`, `markCompleted`, `reopen`, `getHistory`, `addHistory` |
| `catalogService` | `catalogs.js` | `getSupportedCatalogs`, `getAll`, `getByCode`, `create`, `update` |
| `scheduleService` | `schedules.js` | Template CRUD + slot materialization |
| `staffService` | `staff.js` | Staff roster CRUD + activation |
| `tenantConfigService` | `tenantConfig.js` | `getTenantProfile`, `updateTenantProfile`, `getAppConfig`, `updateAppConfig`, `getFeatureFlags` |
| `billingService` | `billing.js` | Bill CRUD + payment transactions |
| `messagingService` | `messaging.js` | Conversations + messages |
| `clinicalDocService` | `clinicalDocuments.js` | Documents + referrals + certificates |
| `notificationService` | `notifications.js` | Event dispatch + delivery tracking |
| `slotService` | `slots.js` | `getAvailableSlots`, `bookSlot` (wraps the RPC) |

**Envelope:** `apiCall → { data, error }` / `apiPaged → { data, meta: { pagination }, error }`

---

## 4. Frontend Pages — WHAT EXISTS

### 4.1 Clinic-Ops Routes (All Registered in App.jsx + AppSidebar)
| Route | Page | Role | Status |
|-------|------|------|--------|
| `/login` | OpsLoginPage | all | ✅ BrandContext wired |
| `/doctor-dashboard` | DoctorDashboardPage | doctor | ✅ |
| `/doctor-patients` | DoctorPatientsPage | doctor | ✅ |
| `/doctor-appointments` | DoctorAppointmentsPage | doctor | ✅ |
| `/doctor-patient/:id` | DoctorPatientProfilePage | doctor | ✅ |
| `/doctor-patient-history/:id` | DoctorMedicalHistoryPage | doctor | ✅ |
| `/doctor-encounter/:appointmentId` | DoctorEncounterPage | doctor | ✅ |
| `/doctor-encounter-id/:encounterId` | DoctorEncounterPage | doctor | ✅ |
| `/doctor-reports` | DoctorReportsPage | doctor | ✅ |
| `/doctor-referrals` | DoctorReferralsPage | doctor | ✅ |
| `/doctor-certificates` | DoctorCertificatesPage | doctor | ✅ |
| `/doctor-lab-request` | DoctorLabRequestPage | doctor | ✅ |
| `/doctor-schedule` | DoctorScheduleTemplatesPage | doctor | ✅ New |
| `/doctor-staff` | DoctorStaffPage | doctor | ✅ New |
| `/doctor-tenant-settings` | DoctorTenantSettingsPage | doctor | ✅ New |
| `/doctor-clinical-catalogs` | DoctorClinicalCatalogsPage | doctor | ✅ New |
| `/doctor-claims` | DoctorClaimPage | doctor | ✅ New |
| `/dashboard` | DashboardPage | secretary | ✅ |
| `/patients` | PatientsPage | secretary | ✅ |
| `/appointments` | AppointmentsPage | secretary | ✅ |
| `/billing` | BillingPage | secretary | ✅ |
| `/billing/new` | CreateBillPage | secretary | ✅ |
| `/secretary-slots` | SecretarySlotsPage | secretary | ✅ |
| `/secretary-booking` | SecretaryBookingPage | secretary | ✅ Visit type selector added |
| `/secretary-intake/:patientId` | SecretaryIntakePage | secretary | ✅ New |
| `/secretary-ops-catalogs` | SecretaryOpsCatalogsPage | secretary | ✅ New |
| `/secretary-insurance-providers` | SecretaryInsuranceProvidersPage | secretary | ✅ New |
| `/secretary-patient-insurance/:patientId` | SecretaryPatientInsurancePage | secretary | ✅ New |
| `/secretary-claim-templates` | SecretaryClaimTemplatesPage | secretary | ✅ New |

### 4.2 AppSidebar (ROLE_CONFIG)
- **Doctor:** Dashboard, Patients, Appointments, Schedule, Staff, Reports, Referrals, Certificates, Catalogs, Claims, Settings (11 items)
- **Secretary:** Dashboard, Patients, Slot Mgmt, Book Appt, Appointments, Billing, Insurance, Claim Forms, Catalogs (9 items)
- **PreDoctor:** Dashboard, Patients, Pre-Check, Appointments, Schedule, Notifications (6 items)
- **BrandContext:** `useBrand()` imported and `brandLabel` set to resolve dynamically from BrandContext

---

## 5. What's DONE (Verified) ✅

### 5.1 Database Layer
- [x] 57 tables, all RLS-enabled
- [x] Lifecycle RPCs (start/complete/cancel encounter, finalize/void documents)
- [x] 5 mobile RPCs (get_my_appointments, get_my_medical_summary, etc.)
- [x] Audit triggers on 31 tables
- [x] Idempotency support via `client_request_id`
- [x] Storage RLS (private buckets for clinical docs)
- [x] `tenant_profile` + `tenant_app_config` replacing legacy `doctor_brand`
- [x] Legacy table burndown (consultations, certificates_old, etc.)
- [x] Migration baseline (`baseline_core_tables.sql`) for fresh tenant provisioning
- [x] Feature flags table

### 5.2 Service Layer
- [x] 15+ canonical services following `{ data, error }` envelope
- [x] Zod validation on all write paths
- [x] `apiCall` / `apiPaged` wrappers with error normalization
- [x] Insurance service now includes `saveClaimTemplate` / `updateClaimTemplate`
- [x] State machine enforcement for appointment + encounter transitions

### 5.3 Frontend Foundation
- [x] Monorepo app split (clinic-ops + patient-web)
- [x] Both apps build successfully with Vite 8
- [x] PostCSS config fix for Tailwind resolution in Vite 8
- [x] BrandContext + BrandProvider + useBrand() hook
- [x] AuthContext with role-based routing
- [x] AppSidebar with ROLE_CONFIG + BrandContext wiring started
- [x] DashboardLayout shared across all roles
- [x] ErrorBoundary wrapping entire app
- [x] Visit type selector added to SecretaryBookingPage

### 5.4 Security
- [x] All P1 and P2 findings from Tier 2 Review CLOSED
- [x] `anon` role revoked from all sensitive RPCs
- [x] `SECURITY DEFINER` on all lifecycle RPCs
- [x] PHI foreign keys: `ON DELETE RESTRICT`
- [x] Soft-delete everywhere
- [x] Message redaction is scrub-mode (unrecoverable)

---

## 6. What's LEFT (Honest Gap Analysis) ❌

### 6.1 HIGH PRIORITY — Must Do Before Production

| # | Task | Category | Est. Effort |
|---|------|----------|-------------|
| 1 | **Replace ~19 hardcoded "DoctoLeb" in clinic-ops** with `useBrand().displayName` | Branding | 1-2 hours |
| 2 | **AppSidebar brandLabel rendering** — need to verify where `config.brandLabel` is rendered and wire `brandName` fallback | Branding | 30 min |
| 3 | **Runtime browser test** — Login as doctor, navigate encounter flow, verify booking with visit_type | Verification | 1 hour |
| 4 | **Full migration replay proof** — Push baseline to a disposable local Supabase, verify 0 errors | DB | 1 hour |
| 5 | **ERD export** — `schema_dump.sql` + visual ERD diagram in `docs/erd/` | Docs | 1 hour |
| 6 | **pgTAP RLS test suite** — Scaffold exists, needs actual test cases and CI wiring | Testing | 2-3 hours |
| 7 | **`purge-patient` Edge Function** — GDPR right-to-erasure (scheduled in NEXT_STEPS_PLAN §I.H8) | Compliance | 2-3 hours |

### 6.2 MEDIUM PRIORITY — Tier 3 Feature Slices

| # | Task | Category | Notes |
|---|------|----------|-------|
| 8 | **Slice 2: Patient documents + lab/imaging viewer** | Feature | Tables exist, no UI |
| 9 | **Slice 3: Patient ↔ staff messaging MVP** | Feature | Tables + service exist, no UI |
| 10 | **Slice 4: Consent onboarding flow** | Feature | Tables exist, no UI |
| 11 | **Slice 5: Notification send worker (Edge Function)** | Feature | Events stored, no push delivery |
| 12 | **Slice 7: Audit viewer UI** | Feature | Audit triggers active, no admin viewer |
| 13 | **"Patients awaiting intake" widget** on dashboards | UI | book_slot already enforces intake gate |

### 6.3 LOW PRIORITY — SaaS Platform

| # | Task | Notes |
|---|------|-------|
| 14 | **Control-plane Supabase project** | tenants, subscriptions, deployments tables |
| 15 | **Provisioning API** (Supabase Management API) | Auto-create tenant DB on signup |
| 16 | **Super-admin dashboard** | Manage all tenants, billing, usage |
| 17 | **White-label deploy pipeline** | Per-tenant Vercel project or subdomain |
| 18 | **Flutter app scaffold** | Patient mobile app consuming the 5 mobile RPCs |

### 6.4 Specific Hardcoded "DoctoLeb" Locations Still Remaining

Files needing `useBrand()` integration:
- `PreDoctorSuccessPage.jsx` — line 16
- `DoctorPatientProfilePage.jsx` — lines 119, 331
- `DoctorMedicalHistoryPage.jsx` — lines 220, 258, 315, 353
- `DoctorReportsPage.jsx` — line 354
- `DoctorEncounterPage.jsx` — line 49 (useDocumentTitle)
- `DoctorCertificatesPage.jsx` — lines 124, 491 (watermark)
- `CreateBillPage.jsx` — line 182
- `BillingPage.jsx` — lines 260, 318
- `DoctorTenantSettingsPage.jsx` — lines 160, 257 (acceptable — it's the settings preview)

---

## 7. Flutter / Mobile API Contract

### 7.1 All 5 Mobile RPCs Are Live
```dart
// Patient appointments
final appointments = await supabase.rpc('get_my_appointments', params: {
  'p_status': 'confirmed', 'p_limit': 20
});

// Medical summary dashboard
final summary = await supabase.rpc('get_my_medical_summary');

// Notifications
final notifications = await supabase.rpc('get_my_notifications', params: {
  'p_limit': 30, 'p_unread_only': true
});

// Mark read
await supabase.rpc('mark_notification_read', params: {
  'p_delivery_id': deliveryId
});

// Register device for push
final deviceId = await supabase.rpc('register_patient_device', params: {
  'p_platform': 'android', 'p_push_token': fcmToken
});
```

### 7.2 Auth Flow for Flutter
1. `supabase.auth.signInWithOtp({ phone })` or email/password
2. After auth, call `current_user_role()` to determine app flow
3. Patient app: use mobile RPCs exclusively (never direct table access)
4. `tenant_app_config` has fields: `min_supported_version`, `force_update_version`, `maintenance_message`

---

## 8. Environment Setup

```bash
# Root .env (required)
VITE_SUPABASE_URL=https://gezmfmskhmjgnquoyosq.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>

# Start clinic-ops (staff portal)
cd apps/clinic-ops && npm run dev    # → localhost:3002

# Start patient-web (patient portal)
cd apps/patient-web && npm run dev   # → localhost:3001

# Build both apps
cd apps/clinic-ops && npx vite build   # ✓ built in 2.10s
cd apps/patient-web && npx vite build  # ✓ built in 1.37s
```

---

## 9. Critical Rules for Any Future Agent

1. **Never add `tenant_id` columns** — We use database-per-tenant
2. **Never use `ON DELETE CASCADE` on PHI tables** — Always `RESTRICT`
3. **Never skip Zod validation** — All mutations go through `parseWithSchema`
4. **Never bypass the service layer** — Page → Service → Supabase, always (enforced in `CLAUDE.md`)
5. **Always soft-delete** — `is_archived` pattern, never hard-delete clinical data
6. **New pages must:** (a) use `DashboardLayout`, (b) register in `App.jsx` router, (c) add to `AppSidebar.jsx` ROLE_CONFIG
7. **Source of truth** is the live DB schema + `packages/core/lib/selects.js`
8. **All new RPCs must:** (a) use `SECURITY DEFINER`, (b) resolve caller via `auth.uid()`, (c) revoke from `public` and `anon`
9. **BrandContext** — Always use `useBrand().displayName` instead of hardcoding "DoctoLeb"
10. **Build check** — Run `npx vite build` in both apps before declaring any slice complete

---

## 10. Key Documentation Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Mandatory coding conventions and rules |
| `TIER1_DOCTOR_PIVOT_PLAN.md` | Original SaaS pivot architecture plan |
| `TIER2_REVIEW.md` | Security review findings (all P1/P2 closed) |
| `TIER2_REVIEW_ADDENDUM.md` | Post-review reconciliation |
| `NEXT_STEPS_PLAN.md` | Current execution roadmap (slices 1-7) |
| `BLOCK_C_PLAN.md` / `BLOCK_D_PLAN.md` | Encounter MVP and runtime verification plans |
| `BLOCK_F_AGENT_HANDOFF_PROMPT.md` | Previous agent handoff (Block F) |
| `APP_SPLIT_AGENT_HANDOFF_PROMPT.md` | Monorepo split documentation |
| This file | Current state of everything |

---

## 11. Session Changes Summary (This Session)

### Files Created:
- `apps/clinic-ops/src/pages/SecretaryClaimTemplatesPage.jsx` — Claim template CRUD
- `apps/clinic-ops/src/pages/DoctorClaimPage.jsx` — Claim generator/printer (3-step wizard)
- `apps/clinic-ops/postcss.config.js` — Vite 8 PostCSS fix
- `apps/patient-web/postcss.config.js` — Same fix for patient-web

### Files Modified:
- `apps/clinic-ops/src/App.jsx` — Added routes for claim pages
- `apps/clinic-ops/src/pages/SecretaryBookingPage.jsx` — Added visit_type selector + useEffect
- `apps/clinic-ops/src/pages/OpsLoginPage.jsx` — Wired `useBrand()` for dynamic brand name
- `packages/ui/components/AppSidebar.jsx` — Added Claims + Claim Forms nav items, wired BrandContext
- `packages/core/services/insurance.js` — Added `saveClaimTemplate` + `updateClaimTemplate` methods

### NOT Completed (ran out of time):
- Remaining ~15 hardcoded "DoctoLeb" strings in other pages
- AppSidebar brandLabel rendering verification
- Runtime browser verification
- Migration replay proof
- ERD export
