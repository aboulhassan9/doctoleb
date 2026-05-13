# DoctoLeb Changelog

All notable changes to DoctoLeb are documented here. Dates are local to the
commit author's timezone. Earlier history before this changelog was started
lives in `git log` only.

## [Unreleased] — 2026-05-13

### Added

- **Marketing site** — new `apps/marketing` Vite app at port 3000 with hero,
  features, pricing, FAQ, lead-capture form, and footer. Wired to a real
  control-plane Edge Function (`marketing-capture-lead`) and `prospect_leads`
  table with rate limiting and IP hashing.
- **Supabase Management API automation foundation** —
  `_shared/supabaseManagementApi.ts` (`createProject`, `getProject`,
  `listProjectApiKeys`, `patchTenantAuthConfig`) for server-side provider
  automation. PATs never leave the Edge Function process.
- **New provisioning step `normalize_tenant_auth_settings`** — calls Supabase
  Management API to set OTP length to 6, OTP expiry to 10 min, the site URL,
  and the redirect URL allowlist before the first-doctor invite goes out. Kills
  the 8-digit-vs-6-digit OTP mismatch for newly provisioned tenants.
- **`create_supabase_project` step is now fully automated** — for jobs in
  `assisted` or `automatic` mode with a Supabase provider connection, the step
  creates the project, stores the generated DB password + service-role key in
  Vault, and persists the anon key once the project reaches ACTIVE_HEALTHY.
- **Tiered CI/CD pipeline** — `scripts/ci-change-classifier.mjs` routes PRs
  into `frontend`, `backend`, `full`, or `docs` lanes so unrelated changes
  skip irrelevant deploys, smoke tests, and DB migrations. Fail-closed on
  unknown paths.
- **Three new shared form primitives** at `packages/ui/components/ui/`:
  - `DatePickerInput` — labelled date input with min/max, hint, error,
    full a11y.
  - `PhoneInput` — country-code dropdown (LB +961 first) + national number,
    serialized as one E.164-style string.
  - `SearchableSelect` — combobox with filter-as-you-type, full keyboard nav,
    click-outside, and aria-combobox semantics.
- **Response-shape validation (F3)** for `appointmentService.bookFromSlot`,
  `patientService.createWalkIn`, and `authService.signIn`. Schemas live in
  `packages/core/schemas/responses.js` and use `.passthrough()` so optional
  column additions don't break the gate.

### Changed

- **First-doctor invite redirect URL is now built from tenant routing
  config** instead of a single env var. Custom-domain tenants get
  `https://<active-ops-host>/login`; path-routed tenants get
  `https://<shared-ops-app>/t/<slug>/login`. Fails closed with
  `FIRST_DOCTOR_INVITE_REDIRECT_UNAVAILABLE` if neither resolves.
- **First-doctor invite step is idempotent on retry** — already-registered
  emails are looked up via `get_auth_user_id_by_email` instead of failing.
- **Ops login page** uses `ops-password-email` for the password form to
  eliminate a duplicate HTML id collision with the OTP form.
- **StatusBadge** now uses an explicit `STATUS_LABELS` override map so
  statuses like `none`, `in_consultation`, `no_show`, `entered_in_error`
  render as `Not Invited`, `In Consultation`, `No Show`, `Entered in Error`
  instead of the awkward humanize() defaults.
- **UI-side schema validation** (F2) replaces inline `if (!form.x)` checks
  with `parseWithSchema()` in `QuickAddPatientModal`, `SecretaryBookingPage`,
  and `SecretarySlotsPage`. Form errors now surface through toast messages
  rather than silently disabling submit.

### Documentation

- Runbook: `docs/runbooks/normalize-tenant-auth-settings.md` covering the new
  Auth-config step, prerequisites, retrofit path, error codes, and security
  posture.
- Memory pinned: first-doctor login mode is email OTP code; SMTP provider is
  deferred (Supabase default for now); Supabase MCP token only sees the
  control plane and legacy clinic-website projects.

---

## Earlier work (pre-changelog)

Master plan Sessions 1-6 landed as a single bundle commit `cdb5f3e`. See
`master_100_plan.md` for the session-by-session breakdown of the audit-score
improvement work (Phase D readability, Phase B UI components, Phase C
reusability, Phase F1 schema split, Phase B3 design tokens, etc.).

See `git log --oneline` for the full pre-changelog history.
