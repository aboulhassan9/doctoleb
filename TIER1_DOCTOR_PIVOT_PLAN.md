# Plan: DoctoLeb → Doctor-Branded SaaS Pivot (Tier 1) — v2

> **Companion**: schema is specified in [`TIER1_SCHEMA_DESIGN.md`](./TIER1_SCHEMA_DESIGN.md) (v2, post-review). This plan describes the **implementation work**, sub-phase order, file map, and verification. It does NOT duplicate DDL — that lives in the design doc and the migration files.

---

## Context

The product changed direction. It is no longer a "clinic management system" with multiple clinics and doctors; it is a **personal-practice SaaS for one doctor** who happens to work at multiple locations (hospitals, medical groups, their own clinic). Patients book where the doctor will be on a given day. The owner ("you") will sell this to other doctors as a multi-tenant SaaS where each doctor gets their own brand, mobile app, admin panel, and isolated database — all controlled from a super-admin layer.

Current code is functionally single-tenant. The schedule model (`secretary_slots(doctor_id, clinic_id, date, …)`) is already multi-location capable. The bigger gaps:

1. No **medical-intake** workflow (one-time history collection by secretary after first visit). Existing `precheck_forms` is per-appointment vitals — different concept.
2. No **insurance** subsystem or printable claim form.
3. No **staff hierarchy** beyond flat user roles.
4. **Auth has zero tenant scope** — `useAuth()` returns user info but no `doctor_id`. Pages call `clinicService.getMainDoctor()` (`.limit(1).single()`) to find "the" doctor.
5. **Locations are called "clinics"** but actually include hospitals and medical groups.
6. No **branding** layer (clinic name hardcoded as "DOCTOLEB" across components).
7. **Appointments don't snapshot location or visit type** — they only know about a slot, which can change.
8. **No catalog tables** for medical reference data (specialties, vaccines, diseases, surgery types, family relations, blood groups, occupations, cities, visit types).
9. No **control plane** for the SaaS layer.

This plan addresses (1)–(8) in detail. (9) is sketched in Phases 2–6 at the end.

---

## Decisions confirmed (5 binding choices)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Plan scope | Phase 1 deep, Phases 2–6 sketched | What we'll act on now vs. roadmap |
| 2 | SaaS model | **Hybrid**: 1 control-plane Supabase project + 1 tenant DB per doctor | Best PHI isolation; clean compliance; identical migrations across tenants |
| 3 | Existing project | Treat `gezmfmskhmjgnquoyosq` as Doctor 1's tenant DB | Migrate in place; sparse data, low risk |
| 4 | Intake gate | **Hard block**: 2nd appointment refused at the DB until medical_intake.status = 'completed' | Forces compliance; not just a UI banner |
| 5 | `users.role` widening (R5 from review) | **Defer to T1.6**. Nurse/assistant/junior_doctor live only in `staff_members.role` for now (records without user accounts) | Don't strand new role values without dashboards/RLS/auth coverage |

Schema corrections from architecture review (R1–R14) are tracked in the schema design doc. This plan reflects all of them.

---

# PHASE 1 — Domain Pivot (DETAILED)

## 1.1 Conceptual model

```
DOCTOR (one per tenant DB; the brand)
  ├── HAS A     → DOCTOR_BRAND (logo, colors, display_name, tagline, languages)
  ├── PRACTICES → CLINICS (location_type ∈ hospital | medical_group | private_clinic | other)
  │                 └── located in CITIES
  ├── EMPLOYS   → STAFF_MEMBERS (role ∈ secretary | predoctor | nurse | assistant | junior_doctor)
  │                 └── reports_to → STAFF_MEMBERS  (self-FK hierarchy)
  ├── HAS       → DOCTOR_SPECIALTIES (junction → SPECIALTIES catalog; one is_primary)
  ├── ACCEPTS   → DOCTOR_INSURANCE_CONTRACTS (junction → INSURANCE_PROVIDERS; carries doctor_provider_code)
  ├── SCHEDULES → DOCTOR_SCHEDULE_TEMPLATES (recurring weekly: doctor × clinic × weekday × time)
  │                 └── materializes → SECRETARY_SLOTS (concrete slot rows; tracks schedule_template_id)
  └── SEES      → PATIENTS
                   ├── ONE-TIME → MEDICAL_INTAKE (lifestyle scalars; status: draft|completed|reopened)
                   │   ├── points to → BLOOD_GROUPS (catalog)
                   │   └── points to → OCCUPATIONS (catalog)
                   ├── PER-VISIT → PRECHECK_FORMS (vitals — existing, unchanged)
                   ├── HISTORY  → PATIENT_VACCINATIONS  (junction → VACCINES catalog)
                   ├── HISTORY  → PATIENT_SURGERIES     (junction → SURGERY_TYPES catalog)
                   ├── HISTORY  → PATIENT_DISEASES      (junction → DISEASES catalog)
                   ├── HISTORY  → PATIENT_FAMILY_HISTORY (junction → FAMILY_RELATIONS + DISEASES)
                   ├── INSURED  → PATIENT_INSURANCE_POLICIES (junction → INSURANCE_PROVIDERS)
                   └── BOOKS    → APPOINTMENTS (snapshots clinic_id + visit_type_id at booking)
                                     └── points to → VISIT_TYPES (catalog: first_visit | follow_up | urgent | precheck | procedure)
                                     └── yields    → CONSULTATIONS
                                                       └── billed via → INSURANCE_CLAIMS
                                                                          └── rendered with → CLAIM_FORM_TEMPLATES (per-provider OR generic)
```

### Patient state machine (intake gate)

```
new → register → can book FIRST appointment of any visit_type
                                      ↓
                first appointment marked 'completed'
                                      ↓
                        intake_required (HARD GATE) ★
                                      ↓
                secretary fills medical_intake (multi-tab form)
                                      ↓
                medical_intake.status = 'completed'
                  └→ trigger sets patients.intake_completed_at = NOW()
                  └→ trigger sets patients.established_at = NOW() (if null)
                                      ↓
                        established → can book any visit_type freely

  (admin can later set status='reopened' → intake_completed_at cleared → re-blocks)
```

★ = enforced by `book_slot` RPC: when `visit_types.requires_intake = true` AND patient has any prior `appointments.status = 'completed'` AND `patients.intake_completed_at IS NULL`, RPC raises `INTAKE_REQUIRED`. Frontend translates to friendly message.

---

## 1.2 Schema changes (summary; full DDL in design doc)

Three migration files, all idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`):

| File | Contents |
|---|---|
| `supabase/migrations/20260506_tier1_doctor_pivot.sql` | All catalogs (cities, blood_groups, occupations, specialties, vaccines, diseases, surgery_types, family_relations, **visit_types**) · ALTER existing tables (`clinics`, `patients`, `appointments`, `secretary_slots`) · 5 PHI junctions (`doctor_specialties`, `patient_vaccinations`, `patient_surgeries`, `patient_diseases`, `patient_family_history`) · 4 domain tables (`medical_intake`, `staff_members`, `doctor_schedule_templates`, **`doctor_brand`**) · 5 insurance tables (`insurance_providers`, `claim_form_templates`, `doctor_insurance_contracts`, `patient_insurance_policies`, `insurance_claims`) · RLS enable + policies · indexes · triggers (intake propagation, system-row protection, audit) |
| `supabase/migrations/20260506_tier1_book_slot_intake_gate.sql` | `CREATE OR REPLACE FUNCTION book_slot(...)` — captures `clinic_id` from slot, takes `p_visit_type_id`, applies intake gate, inserts appointment with snapshot |
| `supabase/migrations/20260506_tier1_seed_catalogs.sql` | Conservative seed: blood_groups (9), family_relations (10), cities (~30 LB), visit_types (5), specialties (~10), vaccines (~10), diseases (~30), surgery_types (~15), occupations (~25), one generic claim_form_template (provider_id NULL) |

### Key v2 corrections (from review)

| Correction | What changes |
|---|---|
| **`appointments.clinic_id` + `visit_type_id`** | Snapshot location and visit type at booking; backfill `clinic_id` via `slot_id → secretary_slots.clinic_id`; default visit_type 'follow_up' for old rows |
| **`secretary_slots.schedule_template_id`** | Materialized slots traceable to template; `ON DELETE SET NULL` (orphan, don't destroy) |
| **`ON DELETE RESTRICT`** on every PHI FK to `patients` | Patient row can't be hard-deleted while history exists; archive only |
| **`users.role` NOT widened in T1** | Stays `('doctor','secretary','patient','predoctor','admin')`. Nurse/assistant/junior_doctor live only in `staff_members.role` (records without user accounts) |
| **`is_staff()` helper unchanged in T1** | Will be widened together with `users.role` in T1.6 |
| **`patients.medical_history` kept as deprecated** | Don't drop in T1; drop in T1.5 after backfill |
| **`doctor_brand` separate table** | Not implicit "repurpose `clinic_settings`". `clinic_settings` formally deprecated (still readable; new code reads `doctor_brand` and `clinics.working_hours`) |
| **Catalog hardening** | `code` (stable cross-tenant), `is_system`, `is_active`, `Other/Unknown` row in every catalog |
| **`medical_intake.status` enum + reopen audit** | `draft|completed|reopened` + `completed_by`/`reopened_by`/`reopened_at`/`reopen_reason`. Reopen sets `patients.intake_completed_at = NULL` to re-block bookings |
| **`patient_vaccinations` model fix** | `given_at` nullable (not received yet), `due_at` for scheduled, status-aware CHECK |
| **`patient_family_history.condition_text`** | Free-text fallback when `disease_id` is null |
| **RLS perf: `(select public.<helper>())`** | Helpers wrapped in subquery for plan caching |
| **Catalog permission split** | Clinical (specialties/vaccines/diseases/surgery_types/visit_types) → doctor/admin INSERT/UPDATE; Ops (cities/occupations/insurance_providers/claim_form_templates) → secretary/admin; Static (blood_groups/family_relations) → system-only |
| **`claim_form_templates`** | Separate table; per-provider OR generic fallback (`provider_id IS NULL`) |

See [`TIER1_SCHEMA_DESIGN.md`](./TIER1_SCHEMA_DESIGN.md) §3–§9 for the complete DDL.

---

## 1.3 Auth: `doctor_id` in context

Biggest single code change. Every page that calls `clinicService.getMainDoctor()` (`.limit(1).single()`) needs to disappear.

**Plan:**
1. Update `lib/authIdentity.js → buildSessionUser` to compute `doctor_id`:
   ```js
   let doctor_id = null;
   if (profile.role === 'doctor') {
     const { data } = await supabase.from('doctors').select('id').eq('user_id', profile.id).maybeSingle();
     doctor_id = data?.id ?? null;
   } else if (['secretary','predoctor','admin'].includes(profile.role)) {
     // Staff with login accounts: look up the doctor they work for via staff_members
     const { data } = await supabase.from('staff_members').select('doctor_id').eq('user_id', profile.id).eq('is_active', true).maybeSingle();
     doctor_id = data?.doctor_id ?? null;
     if (!doctor_id) {
       // Fallback: in single-tenant DB there's exactly one doctor, find by created_at
       const { data: only } = await supabase.from('doctors').select('id').order('created_at').limit(1).maybeSingle();
       doctor_id = only?.id ?? null;
     }
   }
   ```
2. `useAuth().user.doctor_id` is now reliably set for every authenticated session.
3. Delete `clinicService.getMainDoctor()`. Replace callers:
   - `PatientAppointmentsPage.jsx:51` → `user.doctor_id`
   - `SecretaryBookingPage.jsx:62` → `user.doctor_id`
   - any new caller (grep before deletion: `getMainDoctor` should return zero hits)

**Why fallback for staff?** A secretary user without a `staff_members` row should still be able to function (legacy data). Fallback finds the only doctor in the single-tenant DB.

**Phase 4 readiness**: when multi-tenant ships, fallback becomes "hostname → tenants table → tenant DB" lookup, same code shape.

---

## 1.4 Schedule + booking changes

`secretary_slots` is the materialized slot. `doctor_schedule_templates` is the recurring weekly pattern.

### New service: `src/services/schedules.js`

| Method | Purpose |
|---|---|
| `getTemplates(doctorId)` | List weekly templates |
| `getTemplate(id)` | One template |
| `createTemplate(data)` | Secretary creates "Tuesday 14:00–18:00 at Hospital X" |
| `updateTemplate(id, data)` | Edit template; future un-booked slots from this template are also updated/regenerated |
| `materializeUpToDate(targetDate)` | Idempotently generates `secretary_slots` rows from active templates up to `targetDate`. Skips dates already materialized. Each new slot's `schedule_template_id` = template's id |
| `deleteTemplate(id)` | Marks template `is_active = false`. Future un-booked slots from this template are deleted; booked slots have their `schedule_template_id` set to NULL (they remain valid) |

### Booking flow changes

- **Patient**: picks a date or date range → sees ALL available slots across all the doctor's locations on that day. Each slot card shows: clinic name + `location_type` badge (hospital / medical group / clinic), time, address, city. Filter "any location" / "specific clinic". Selecting a slot also requires choosing a `visit_type` (default `follow_up`; first appointment defaults to `first_visit`).
- **Secretary** (walk-in booking): same UX, secretary selects on patient's behalf, can override `visit_type`.
- **`book_slot` RPC** writes both `appointments.clinic_id` (from slot) and `appointments.visit_type_id` at insert time. Intake gate fires here (R-based on `visit_types.requires_intake` + patient's prior completed appointments).
- **`appointments` page UI**: reads location from `appointments.clinic_id` (snapshot), never derives from slot. Shows visit-type label.

---

## 1.5 Medical intake (multi-tab form)

The intake form is no longer a single long page — it's a multi-tab page because the data is now normalized across 5 tables.

### Tabs on `/secretary-intake/:patientId`

| Tab | Writes to | Notes |
|---|---|---|
| **Lifestyle** | `medical_intake` (scalars: occupation_id, blood_group_id, marital_status, living_with, smoking/alcohol/exercise, allergies_text, current_medications_text, notes) | First tab; required to mark `status = completed` |
| **Vaccinations** | `patient_vaccinations` rows | Each row: vaccine (catalog), status (received / scheduled / overdue / declined / unknown), given_at OR due_at, dose_number, lot_number |
| **Surgeries** | `patient_surgeries` rows | Each row: surgery_type (catalog), performed_at, hospital_name, surgeon_name, notes |
| **Diseases** | `patient_diseases` rows | Each row: disease (catalog), status (active / resolved / chronic / in_remission / suspected), severity, diagnosed_at |
| **Family history** | `patient_family_history` rows | Each row: relation, disease (catalog) OR condition_text, age_at_onset, is_deceased, death_cause |

Bottom of the page: **"Mark intake complete"** button — only enabled if Lifestyle tab is filled. Sets `medical_intake.status = 'completed'`, `completed_by = current user`, `completed_at = NOW()`. Trigger propagates to `patients.intake_completed_at` and `patients.established_at`.

### Reopen workflow (admin only)

Admin can reopen a completed intake from the patient profile page. Sets `status = 'reopened'`, captures `reopen_reason`. Trigger clears `patients.intake_completed_at`, re-blocking new bookings until re-completed.

### New service: `src/services/intakes.js`

| Method | Purpose |
|---|---|
| `getByPatientId(patientId)` | Returns intake row + all related junction rows |
| `saveDraft(patientId, scalars)` | Upserts `medical_intake` with `status = 'draft'` |
| `complete(patientId, scalars, completedBy)` | Sets status='completed' atomically |
| `reopen(patientId, reopenedBy, reason)` | Admin only |
| `addVaccination/Surgery/Disease/FamilyHistory(patientId, payload)` | Junction inserts |
| `updateVaccination/Surgery/Disease/FamilyHistory(id, payload)` | Junction updates |
| `archiveVaccination/Surgery/Disease(id, archivedBy)` | Soft-delete |

### Schema validation

Extend `src/schemas/index.js` with: `medicalIntakeSchema`, `vaccinationSchema`, `surgerySchema`, `diseaseSchema`, `familyHistorySchema`. Use existing `parseWithSchema()` helper.

---

## 1.6 Staff hierarchy (T1 = roster only)

**Per R5 (review)**: `users.role` is NOT widened in T1. New staff types (nurse, assistant, junior_doctor) live only as `staff_members` records — *without* user login accounts in this phase. The doctor manages a "team roster" where Nurse Sarah is recorded as a person Dr. Khoury employs, but she doesn't log in until T1.6 wires up the dashboards/RLS.

### What works in T1
- Doctor sees their team list on `/doctor-staff`.
- Doctor adds/edits a staff member (role, reports_to, hire_date).
- `staff_members.user_id` is nullable. Existing secretary/predoctor users CAN be linked via `user_id` (they already have accounts).
- New nurse/assistant/junior_doctor records have `user_id = NULL`.

### What waits for T1.6
- Login flow for nurse/assistant/junior_doctor.
- Their dashboards.
- RLS widening.

### New service: `src/services/staff.js`
Standard CRUD: `getAll(doctorId)`, `getById`, `create`, `update`, `deactivate` (sets `is_active = false`; no hard delete).

### New page: `src/pages/DoctorStaffPage.jsx`
List view + add/edit modal. Shows reports_to hierarchy as a tree.

---

## 1.7 Insurance subsystem

5 tables (see design doc §3.9, §5.4): `insurance_providers`, `claim_form_templates`, `doctor_insurance_contracts`, `patient_insurance_policies`, `insurance_claims`.

### New services

| Service | Module |
|---|---|
| `insuranceProviderService` | CRUD on `insurance_providers` (ops catalog; secretary/admin) |
| `claimTemplateService` | CRUD on `claim_form_templates`; one generic fallback seeded; per-provider templates added later |
| `doctorInsuranceService` | Doctor's accepted providers (`doctor_insurance_contracts`) |
| `patientInsuranceService` | Patient's policies (`patient_insurance_policies`) |
| `claimService` | Claim CRUD + status transitions (draft → printed → submitted → paid|rejected) |

Bundle into `src/services/insurance.js` (one file, four named exports).

### New pages

| Route | Page | Role |
|---|---|---|
| `/secretary-insurance-providers` | `SecretaryInsuranceProvidersPage` | secretary/admin |
| `/secretary-claim-templates` | `SecretaryClaimTemplatesPage` (manage `claim_form_templates`) | secretary/admin |
| `/secretary-patient-insurance/:patientId` | `SecretaryPatientInsurancePage` (manage one patient's policies) | secretary/admin |
| `/doctor-claim/:consultationId` | `DoctorClaimPage` (generate/print a claim) | doctor/admin |

### Claim form generator (T1 simplest version)

- HTML template stored in `claim_form_templates.template_body` (Handlebars-style)
- Browser-side render: hydrate template with `{ patient, doctor, clinic, consultation, policy, amount, … }`
- Print via `window.print()` against a styled hidden `<div>` (CSS print stylesheet)
- "Save PDF": uses `@react-pdf/renderer` (defer install until 1.6 sub-phase) OR browser-native print-to-PDF; uploads to Supabase Storage; sets `insurance_claims.claim_form_pdf_url` and `printed_at`

If no per-provider template exists for a claim, frontend falls back to the generic template (`provider_id IS NULL`, `is_system = true`).

---

## 1.8 Doctor branding (`doctor_brand` + `BrandContext`)

Today: clinic name/logo are hardcoded as "DOCTOLEB" in components.

### `doctor_brand` table

One row per (single-tenant) doctor. Holds: `display_name`, `tagline`, `logo_url`, `favicon_url`, `primary_color`, `secondary_color`, `custom_domain`, `contact_phone`, `contact_email`, `website_url`, `about_md`, `languages` (string array). See design doc §5.5.

### `BrandContext` — new React context

`src/contexts/BrandContext.jsx`:
- Loads `doctor_brand` once on app boot (after auth).
- Exposes `useBrand()` → `{ displayName, tagline, logoUrl, primaryColor, secondaryColor, contactPhone, contactEmail, websiteUrl, aboutMd, languages }`.
- Wraps router under `<BrandProvider>` in `App.jsx`.

### Component changes

- Replace `<h1>DOCTOLEB</h1>` and similar with `<h1>{brand.displayName}</h1>` across landing, sidebars, login.
- Watermark "DOCTOLEB" in `DoctorCertificatesPage` → `brand.displayName`.
- Defer dynamic-color theming to T1.5 (CSS custom properties switch). Logo upload UI also T1.5.

### `clinic_settings` is deprecated

Don't read from it in new code. Keep the table; drop in T1.5 cleanup migration after backfill.

### New service: `src/services/brand.js`
- `getBrand()` — single row fetch
- `updateBrand(data)` — doctor/admin only
- `uploadLogo(file)` — Supabase Storage helper (T1.5)

### New page: `/doctor-brand-settings` (`DoctorBrandSettingsPage`)
Doctor edits their brand. Required for white-label.

---

## 1.9 Catalog admin UIs (clinical-vs-ops permission split)

The schema design split catalogs into clinical (doctor/admin manages) vs ops (secretary/admin manages) vs static (system-only). UIs follow:

| Page | Catalog(s) | Role |
|---|---|---|
| `/doctor-clinical-catalogs` | specialties, vaccines, diseases, surgery_types, visit_types | doctor/admin |
| `/secretary-ops-catalogs` | cities, occupations, insurance_providers, claim_form_templates | secretary/admin |
| (no UI) | blood_groups, family_relations | system-seeded only |

Both pages: list view per catalog, search, add (`is_system = false`), edit (only if `is_system = false`), deactivate (`is_active = false`). System rows shown but locked. UI prevents UPDATE/DELETE on system rows; trigger backstops in DB.

### New service: `src/services/catalogs.js`
One module exporting per-catalog services: `cityService`, `occupationService`, `specialtyService`, `vaccineService`, `diseaseService`, `surgeryTypeService`, `visitTypeService`, `bloodGroupService` (read-only), `familyRelationService` (read-only). Each implements `getAll()`, `getById()`, `getByCode()`, `create()`, `update()`, `deactivate()` where applicable.

---

## 1.10 RLS additions (per design doc §7)

For each new table:
- All policy USING/WITH-CHECK clauses wrap helpers in `(select public.<helper>())` for query-plan caching (R6).
- PHI tables: SELECT scoped via `is_staff() OR patient ownership`. INSERT/UPDATE role-gated. DELETE admin-only.
- Catalog permission split per §1.9.
- `staff_members`: SELECT for doctor/admin + self; INSERT/UPDATE doctor/admin; no DELETE (use `is_active`).
- `doctor_brand`: SELECT for any authenticated; INSERT/UPDATE doctor/admin; DELETE admin.
- System-row protection trigger: UPDATE/DELETE on rows where `is_system = true` raises an exception.

`is_staff()` helper is **unchanged in T1** (per R5).

---

## 1.11 File-by-file change map

### Migrations (3 new files)
| File | What |
|---|---|
| `supabase/migrations/20260506_tier1_doctor_pivot.sql` | All schema changes per design doc |
| `supabase/migrations/20260506_tier1_book_slot_intake_gate.sql` | New `book_slot` RPC with intake gate + clinic_id + visit_type_id snapshots |
| `supabase/migrations/20260506_tier1_seed_catalogs.sql` | Idempotent seed |

### `src/lib/`
| File | Change |
|---|---|
| `selects.js` | Add: `MEDICAL_INTAKE_FIELDS`, `STAFF_FIELDS`, `INSURANCE_PROVIDER_FIELDS`, `CLAIM_TEMPLATE_FIELDS`, `INSURANCE_CONTRACT_FIELDS`, `INSURANCE_POLICY_FIELDS`, `INSURANCE_CLAIM_FIELDS`, `DOCTOR_SCHEDULE_TEMPLATE_FIELDS`, `DOCTOR_BRAND_FIELDS`, `VISIT_TYPE_FIELDS`, `CITY_FIELDS`, `BLOOD_GROUP_FIELDS`, `OCCUPATION_FIELDS`, `SPECIALTY_FIELDS`, `VACCINE_FIELDS`, `DISEASE_FIELDS`, `SURGERY_TYPE_FIELDS`, `FAMILY_RELATION_FIELDS`, `PATIENT_VACCINATION_FIELDS`, `PATIENT_SURGERY_FIELDS`, `PATIENT_DISEASE_FIELDS`, `PATIENT_FAMILY_HISTORY_FIELDS`, `DOCTOR_SPECIALTY_FIELDS` |
| `authIdentity.js` | Compute `doctor_id` for doctor + staff in `buildSessionUser` |

### `src/services/`
| File | Change |
|---|---|
| `intakes.js` | New: scalar + 4 junction methods |
| `staff.js` | New: roster CRUD |
| `schedules.js` | New: templates + materialization |
| `insurance.js` | New: 5 named exports (provider/template/contract/policy/claim) |
| `catalogs.js` | New: per-catalog services |
| `brand.js` | New: doctor brand fetch/update |
| `clinics.js` | DELETE `getMainDoctor()`. Update doc comments to "practice locations" semantics |
| `appointments.js` | Translate `INTAKE_REQUIRED` RPC error to user-friendly string. New `bookFromSlot(slotId, patientId, visitTypeId, …)` signature |

### `src/contexts/`
| File | Change |
|---|---|
| `BrandContext.jsx` | New context, loaded after auth, before router |

### `src/App.jsx`
- Wrap router with `<BrandProvider>`.
- Add routes:
  - `/secretary-intake/:patientId` → `SecretaryIntakePage` (secretary)
  - `/doctor-staff` → `DoctorStaffPage` (doctor)
  - `/doctor-brand-settings` → `DoctorBrandSettingsPage` (doctor)
  - `/doctor-schedule` → `DoctorScheduleTemplatesPage` (doctor or secretary)
  - `/doctor-clinical-catalogs` → `DoctorClinicalCatalogsPage` (doctor)
  - `/secretary-ops-catalogs` → `SecretaryOpsCatalogsPage` (secretary)
  - `/secretary-insurance-providers` → `SecretaryInsuranceProvidersPage` (secretary)
  - `/secretary-claim-templates` → `SecretaryClaimTemplatesPage` (secretary)
  - `/secretary-patient-insurance/:patientId` → `SecretaryPatientInsurancePage` (secretary)
  - `/doctor-claim/:consultationId` → `DoctorClaimPage` (doctor)

### `src/pages/` — new (10 pages)
- `SecretaryIntakePage.jsx` (multi-tab)
- `DoctorStaffPage.jsx`
- `DoctorBrandSettingsPage.jsx`
- `DoctorScheduleTemplatesPage.jsx`
- `DoctorClinicalCatalogsPage.jsx`
- `SecretaryOpsCatalogsPage.jsx`
- `SecretaryInsuranceProvidersPage.jsx`
- `SecretaryClaimTemplatesPage.jsx`
- `SecretaryPatientInsurancePage.jsx`
- `DoctorClaimPage.jsx`

### `src/pages/` — modified
| File | Change |
|---|---|
| `PatientAppointmentsPage.jsx` | Use `user.doctor_id` (not `getMainDoctor()`); show location_type badge; pass visit_type to bookFromSlot; handle INTAKE_REQUIRED error |
| `SecretaryBookingPage.jsx` | Same. Plus prompt "Patient X needs intake → start now?" when patient is past first visit and intake is null |
| `SecretarySlotsPage.jsx` | Add tab "Recurring schedule" linking to `/doctor-schedule` |
| `DoctorDashboardPage.jsx` | Add "Patients awaiting intake" widget |
| `DashboardPage.jsx` (secretary) | Same widget + "Drafts in progress" (medical_intake.status = 'draft') |
| `DoctorPatientProfilePage.jsx` | Show intake status; tabs for Vaccinations / Surgeries / Diseases / Family history (read-only); insurance section; admin reopen-intake button |
| Landing page, all sidebars, login | Replace hardcoded "DOCTOLEB" with `useBrand().displayName` |

### `src/components/`
| File | Change |
|---|---|
| `Sidebar.jsx` (secretary) | Add: Ops catalogs, Insurance providers, Claim templates |
| `DoctorSidebar.jsx` | Add: Brand settings, Staff, Schedule templates, Clinical catalogs |
| `BrandLogo.jsx` (NEW) | Renders `useBrand().logoUrl` with fallback |

### `src/schemas/index.js`
Add: `medicalIntakeScalarsSchema`, `vaccinationSchema`, `surgerySchema`, `diseaseSchema`, `familyHistorySchema`, `staffMemberSchema`, `insuranceProviderSchema`, `claimTemplateSchema`, `doctorInsuranceContractSchema`, `patientInsuranceSchema`, `insuranceClaimSchema`, `doctorScheduleTemplateSchema`, `doctorBrandSchema`, `visitTypeSchema`, `appointmentBookingSchema` (extend with `visitTypeId`).

### `supabase/functions/`
| File | Change |
|---|---|
| `appointments/index.ts` | Surface INTAKE_REQUIRED to mobile |
| `intakes/index.ts` (NEW) | Mobile parity for intake flow |
| `staff/index.ts` (NEW) | Mobile parity |
| `schedules/index.ts` (NEW) | Mobile parity |
| `insurance/index.ts` (NEW) | Mobile parity for providers/policies/claims |
| `brand/index.ts` (NEW) | Mobile reads doctor brand |
| `catalogs/index.ts` (NEW) | Mobile reads catalogs |

### Documentation
| File | Change |
|---|---|
| `CLAUDE.md` | Rewrite Architecture, Routing Map, Service table, Conventions to v2 domain model. Document deprecation of `clinic_settings` and `patients.medical_history` |
| `TIER1_PLAN.md`–`TIER4_PLAN.md` | Archive into `docs/archive/legacy-tier-plans/` |
| `DOCTOLEB_FLOW_GAPS.md` | Reconcile open items; drop ones now addressed |
| `PLAN.md` | Replace with `ROADMAP.md` summarizing Phases 1–6 |
| `TIER1_SCHEMA_DESIGN.md` (this companion) | Already exists |

---

## 1.12 Reuse — what NOT to rewrite

- `src/services/api.js` (`apiCall`) — unchanged, perfect.
- `src/lib/selects.js` discipline — extend, don't replace.
- `src/lib/appointments.js` (`normalizeAppointment`, status state machine, `canTransitionAppointmentStatus`) — keep as is.
- `src/services/auth.js` — unchanged (just adds doctor_id via authIdentity).
- `src/contexts/AuthContext.jsx` — keep wiring; consume new `doctor_id` field.
- `src/contexts/Toast`, `Sidebar`, `Theme` — unchanged.
- `precheck_forms` table — KEEP. Per-appointment vitals, distinct from `medical_intake`.
- All RLS helpers (`is_staff`, `has_role`, `current_domain_user_id`, `current_user_role`) — unchanged in T1 (T1.6 widens).
- Soft-delete pattern (`is_archived`/`archived_at`/`archived_by`) — apply to new PHI tables only.
- `audit_log` trigger pattern — extend to new PHI tables.

---

## 1.13 Sub-phase execution order

Total scope grew vs v1 (catalog UIs + branding context + multi-tab intake added). New estimate: **~5–6 weeks** for one focused engineer.

### Phase 1.0 — Schema + auth scaffolding (2 days)
- Apply 3 migration files to live DB (after user explicit "apply").
- Update `authIdentity.buildSessionUser` to compute `doctor_id`.
- Delete `getMainDoctor()`, fix the 2 callers.
- Verify by logging in as each role and inspecting `useAuth().user.doctor_id`.
- Update `CLAUDE.md` Architecture + Conventions sections.

### Phase 1.1 — Catalogs + admin UIs (3–4 days)
- `src/services/catalogs.js` + Zod schemas.
- `DoctorClinicalCatalogsPage` + `SecretaryOpsCatalogsPage`.
- Sidebar entries.
- Smoke test: add a city, add a vaccine, deactivate one, verify is_system protection.

### Phase 1.2 — Visit types + booking changes (2–3 days)
- `book_slot` RPC migration applied.
- `appointmentService.bookFromSlot` signature update.
- Booking pages handle visit_type selector + INTAKE_REQUIRED error.
- Verify location snapshot (`appointments.clinic_id`) on a fresh booking.

### Phase 1.3 — Schedule templates (3–4 days)
- `src/services/schedules.js` + materialization logic.
- `DoctorScheduleTemplatesPage`.
- Backfill: if existing doctor has ad-hoc slots, write a single matching template to preserve current behavior.
- Verify: create template "Tuesday 14–18 at clinic A", run `materializeUpToDate('+30 days')`, confirm slots exist for the next 4 Tuesdays with `schedule_template_id` set.

### Phase 1.4 — Medical intake (multi-tab, 5–7 days)
- `src/services/intakes.js` + 5 Zod schemas.
- `SecretaryIntakePage` (5 tabs: Lifestyle / Vaccinations / Surgeries / Diseases / Family).
- "Patients awaiting intake" widget on dashboards.
- Mark complete + reopen workflow.
- Verify: full intake gate end-to-end (book first → complete → try second → block → fill intake → succeed).

### Phase 1.5 — Staff roster (2 days)
- `src/services/staff.js`.
- `DoctorStaffPage`.
- Smoke test: doctor adds Nurse Sarah (no user_id), edits her role, deactivates her.

### Phase 1.6 — Insurance subsystem (5–7 days)
- `src/services/insurance.js` (5 named exports) + Zod schemas.
- 4 new pages (providers, claim templates, patient insurance, claim generator).
- Browser-side claim form rendering with Handlebars-style template + `window.print()`.
- Verify: generic template fallback renders a printable page; per-provider templates override.

### Phase 1.7 — Doctor branding + BrandContext (2–3 days)
- `doctor_brand` row seeded for existing doctor.
- `BrandContext` + `useBrand()`.
- Replace ~15 hardcoded "DOCTOLEB" strings.
- `DoctorBrandSettingsPage`.
- Verify: change `doctor_brand.display_name` in DB → all UI surfaces reflect on next login.

### T1.5 — Cleanup (deferred, ~2 days)
After all of T1 is shipped and stable:
- Drop `clinic_settings` (deprecated).
- Drop `patients.medical_history` (deprecated; structured `patient_diseases` data is now the truth).
- Logo upload UI in `DoctorBrandSettingsPage`.
- Add `@react-pdf/renderer` for true PDF output (vs print-to-PDF).

### T1.6 — Staff role widening (deferred, ~3 days)
- Migration: widen `users.role` CHECK to include `nurse`, `assistant`, `junior_doctor`.
- Update `is_staff()` helper.
- Read-only stub dashboards: `NurseDashboardPage`, `AssistantDashboardPage`, `JuniorDoctorDashboardPage`.
- Auth flow: nurse signs up → secretary links to `staff_members.user_id`.
- RLS widening: nurses can write `precheck_forms` (per design); they cannot create consultations.

---

# PHASES 2–6 (sketched — unchanged from prior plan)

### Phase 2 — Extract control plane (~2 weeks)
Stand up second Supabase project: `doctoleb-control-plane`. Tables: `tenants`, `subscriptions`, `super_admins`, `tenant_branding`, `audit_events`. Pure metadata; no PHI.

### Phase 3 — Tenant onboarding automation (~2 weeks)
"Add doctor" button → Supabase Management API creates project → migrations applied from Git → edge functions deployed → seed doctor + clinic_settings → invite email. Requires a small Node/Deno backend service holding the Management API token.

### Phase 4 — White-label deploy (~2 weeks)
Subdomains (`dr-ahmad.doctoleb.app`). One Vercel deployment, custom-domain alias per tenant. Front-end reads hostname → tenants → tenant URL + brand.

### Phase 5 — Mobile apps (~6 weeks per platform)
React Native + Expo, sharing service-layer contracts. Per-tenant branded build pointing at tenant URL.

### Phase 6 — Super-admin dashboard (~2 weeks)
Aggregator across tenants: counts only (no PHI), MRR, support tickets, system health. Edge function fan-out.

---

# Multi-tenancy architecture summary

```
┌─────────────────────────┐            ┌─────────────────────────────┐
│ Super-admin (you)       │            │ Each Doctor (own brand)     │
│ → Vercel project A      │            │ → Vercel project per tenant │
│ → Control plane Supabase│            │ → Tenant Supabase project   │
└─────────────────────────┘            └─────────────────────────────┘
            │                                       │
            ├────── Supabase Mgmt API ──────────────┤  (provisions tenants)
            │                                       │
            ▼                                       ▼
┌─────────────────────────┐            ┌─────────────────────────────┐
│ control-plane DB        │            │ tenant-1 DB (Doctor 1)      │
│ - tenants               │  (no PHI)  │ - patients                  │  (PHI lives here)
│ - subscriptions         │            │ - consultations             │
│ - super_admins          │            │ - …everything else          │
│ - tenant_branding       │            │                             │
└─────────────────────────┘            └─────────────────────────────┘
                                       ┌─────────────────────────────┐
                                       │ tenant-2 DB (Doctor 2)      │
                                       │ (identical schema to t-1)   │
                                       └─────────────────────────────┘
```

**Source of truth for tenant DB schema = your Git repo.** Doctor 1's project is not special. Adding doctor 2 = create project + apply same migrations from Git.

**Where shared logic lives**:
- DB-side (RPCs, RLS, triggers): `supabase/migrations/*.sql`. Re-applied per tenant.
- API-side (edge functions): deployed identically per tenant project (`supabase functions deploy --project-ref X`).
- Front-end: same React build, different runtime config (tenant URL + brand) per deployment.

**Cross-tenant operations** (super-admin only):
- Read: aggregator edge function in control plane fans out to tenants using stored service-role keys.
- Write: avoid. Each tenant manages its own data.

**Cost** (rough): $25/mo/tenant (Supabase Pro) + $25/mo control plane + ~$20/mo Vercel Pro org. Healthcare data needs Pro tier (backups, PITR).

---

# Tier-plan reconciliation

`TIER1_PLAN.md`–`TIER4_PLAN.md` predate the pivot:
- **Archive** to `docs/archive/legacy-tier-plans/`.
- **Cherry-pick** surviving items (RLS hardening, admin pages) into `BACKLOG.md`, re-prioritized.

`PLAN.md` (top-level roadmap) is replaced by `ROADMAP.md` summarizing Phases 1–6. This file (`TIER1_DOCTOR_PIVOT_PLAN.md`) is the active T1 implementation plan; `TIER1_SCHEMA_DESIGN.md` is its companion schema spec.

---

# Verification (E2E, post-T1)

1. **Auth + tenancy**: log in as doctor / secretary / predoctor users. Confirm `useAuth().user.doctor_id` is set in each.
2. **Catalog admin**: secretary adds a city. Doctor adds a disease. System rows can't be deleted (UI + DB trigger).
3. **Schedule templates**: create "Tuesday 14:00–18:00 at Clinic A" template. `materializeUpToDate('+30 days')` writes 4 Tuesday slots, each with `schedule_template_id` set.
4. **Booking with snapshot**: book a slot. Verify `appointments.clinic_id` and `visit_type_id` are written. Edit the slot's clinic_id → appointment's clinic_id is unchanged (snapshot preserved).
5. **Intake gate (the headline test)**:
   - Create new patient.
   - Book first appointment with `visit_type='first_visit'` → succeeds (`requires_intake = false` for first_visit).
   - Mark first appointment `completed`.
   - Try second booking with `visit_type='follow_up'` → fails with `INTAKE_REQUIRED`.
   - Secretary opens `/secretary-intake/:patientId`, fills Lifestyle tab, clicks "Mark complete".
   - Verify `medical_intake.status='completed'`, `patients.intake_completed_at` set.
   - Retry second booking → succeeds.
6. **Intake reopen**: admin reopens. Verify `patients.intake_completed_at` cleared. Try booking → blocked again.
7. **Patient history (junctions)**: from intake page, add a vaccination (status `received`, given_at set). Verify row in `patient_vaccinations`. Try adding one with status `scheduled` and no `due_at` → CHECK constraint refuses.
8. **Family history fallback**: add a family entry with `condition_text='unknown cancer'` (no disease_id) → succeeds.
9. **Insurance flow**: secretary adds provider "BUPA". Doctor's contract created with `doctor_provider_code='DR-12345'`. Patient policy added. Generate a claim → renders generic template (no per-provider template exists yet) → print → status moves to `printed`.
10. **Per-provider template**: secretary adds a BUPA-specific template. Generate another claim → uses the BUPA template, not generic.
11. **Staff roster**: doctor adds Nurse Sarah (no user_id, role='nurse'). Verify she appears in the staff list. She does NOT log in (T1 scope; T1.6).
12. **Branding**: change `doctor_brand.display_name` in DB → all UI surfaces reflect on next login.
13. **DB schema diff**: zero ghost columns, zero missing columns. Use `mcp__supabase__list_tables verbose=true`.
14. **RLS smoke**: log in as patient B; try to read patient A's `medical_intake` directly via `supabase.from('medical_intake').select()` in browser console → empty result, not error.
15. **Edge function parity**: call each new edge function with valid JWT; responses match service-layer responses.
16. **Soft-delete sanctity**: archive a `patient_disease`. Confirm it stops appearing in default queries but remains in DB.
17. **Hard-delete blocked**: try `DELETE FROM patient_diseases WHERE id=<x>` as non-admin → RLS denies.

---

# Critical files to read before implementing

- [`TIER1_SCHEMA_DESIGN.md`](./TIER1_SCHEMA_DESIGN.md) — the schema spec (DDL, RLS, indexes, trade-offs)
- `src/lib/selects.js` — extend, don't replace
- `src/services/api.js` — `apiCall` is the error contract; do not change
- `src/lib/appointments.js` — status state machine reference
- `src/lib/authIdentity.js` — auth flow being extended
- `src/services/slots.js` + the live `book_slot` RPC — booking flow being modified
- `supabase/migrations/20260505020000_tier0_v2_revert_schema_expansion.sql` — cautionary tale of code-DB drift
- `CLAUDE.md` — project conventions; will need rewrites after T1.0

---

# Out of scope for Phase 1

- Mobile apps (Phase 5)
- Custom domains / Vercel multi-deploy setup (Phase 4)
- Stripe billing / subscriptions (Phase 2)
- Cross-tenant analytics (Phase 6)
- Audit log UI (data is collected today; no UI yet — separate small task)
- AI-assisted features (note summarization, etc.)
- Lebanese-Arabic localization (separate i18n effort; catalog tables are designed to support it via future `*_translations` tables)
- Native PDF export via `@react-pdf/renderer` (deferred to T1.5; T1 uses browser print-to-PDF)
- Logo upload UI (deferred to T1.5; T1 uses URL field)
- Nurse/assistant/junior_doctor login flow + dashboards (deferred to T1.6)

---

# Revision log (v1 → v2)

This plan was rewritten from v1 after an architecture review of the schema design. Major changes:

| # | Change | Where |
|---|---|---|
| 1 | Added `doctor_brand` table as first-class entity (not "repurpose `clinic_settings`") | §1.8 |
| 2 | Added `appointments.clinic_id` and `appointments.visit_type_id` snapshot columns | §1.4, §1.11 |
| 3 | Added `secretary_slots.schedule_template_id` for template traceability | §1.4 |
| 4 | All PHI FKs use `ON DELETE RESTRICT`, never `CASCADE` | §1.2 |
| 5 | `users.role` widening **DEFERRED** to T1.6; staff_members.user_id is nullable; nurse/assistant/junior_doctor are records-only in T1 | §1.6 |
| 6 | RLS helpers wrapped in `(select public.<helper>())` for query-plan caching | §1.10 |
| 7 | Catalog permission split: clinical vs ops vs static | §1.9 |
| 8 | `medical_intake` redesigned: scalar table + 4 separate junction tables (`patient_vaccinations`, `patient_surgeries`, `patient_diseases`, `patient_family_history`); status enum + reopen audit | §1.5 |
| 9 | Added `visit_types` catalog + `appointments.visit_type_id` for visit semantics | §1.4, §1.11 |
| 10 | `patient_vaccinations.given_at` nullable; added `due_at`; status-aware CHECK | §1.5 |
| 11 | `patient_family_history.condition_text` for narrative fallback | §1.5 |
| 12 | `patients.medical_history` kept as deprecated; drop in T1.5 | §1.2, §1.13 |
| 13 | Catalog hardening: `is_system`, `is_active`, `code` columns + `Other/Unknown` row + system-row protection trigger | §1.2, §1.9 |
| 14 | Added `claim_form_templates` table; per-provider OR generic fallback | §1.7 |
| 15 | Catalog admin UIs split into clinical (doctor/admin) vs ops (secretary/admin) pages | §1.9 |
| 16 | New `BrandContext` + `useBrand()` hook + `DoctorBrandSettingsPage` | §1.8 |
| 17 | Sub-phase order expanded from 5 to 7 sub-phases plus T1.5 cleanup and T1.6 role widening | §1.13 |
| 18 | New file count grew: 10 new pages, 7 new services, 7 new edge functions | §1.11 |
| 19 | Estimated effort updated 3–4 weeks → **5–6 weeks** | §1.13 |
| 20 | Verification expanded from 10 to 17 checks | Verification section |
