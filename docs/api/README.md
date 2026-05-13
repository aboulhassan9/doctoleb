# DoctoLeb · Service API Reference

> One file per service in `packages/core/services/`. Each documents the
> method signatures the UI relies on so a new engineer (or AI agent) can
> integrate without reading every implementation.

If a service is missing from this directory, the source in
`packages/core/services/<name>.js` is still the authoritative contract.
File a PR to add it.

## How to read these docs

Every method follows the same envelope:

```ts
async someMethod(input): { data: T | null, error: string | null }
```

- `data` is non-null on success; `error` is non-null on failure. **Never
  both populated, never both null.**
- The `error` value is a human-readable string. Pages decide how to render
  it (toast, inline, log).
- Validation always happens via Zod in `packages/core/schemas/` before any
  DB call. Validation failures return a typed string error before the
  network roundtrip.

## Service index

| Service | File | Domain | Doc |
|---|---|---|---|
| `appointmentService` | `appointments.js` | Appointments CRUD + booking | [appointments.md](./appointments.md) |
| `authService` | `auth.js` | Sign in, sign up, OTP, session | [auth.md](./auth.md) |
| `clinicService` | `clinics.js` | Clinic / practice locations | TODO |
| `clinicalService` | `clinical.js` | Encounters, notes, diagnoses, prescriptions, orders, care tasks | [clinical.md](./clinical.md) |
| `documentService` | `documents.js` | Clinical documents (reports, certificates, referrals) | TODO |
| `doctorService` | `doctors.js` | Doctor profiles / availability | TODO |
| `notificationCoreService` | `notificationCore.js` | Notification events + deliveries | TODO |
| `patientService` | `patients.js` | Patient CRUD + walk-in registration | [patients.md](./patients.md) |
| `paymentService` | `payments.js` | Billing / invoices | TODO |
| `precheckService` | `prechecks.js` | Pre-doctor triage forms | TODO |
| `slotService` | `slots.js` | Appointment slots + booking RPC | [slots.md](./slots.md) |
| `storageService` | `storage.js` | Private bucket signed URLs | TODO |
| `tenantConfigService` | `tenantConfig.js` | Tenant profile + app config + branding | TODO |

## Template

When adding a doc, follow this structure:

```markdown
# `<serviceName>` — <one-line summary>

**File:** `packages/core/services/<file>.js`
**Schemas:** `packages/core/schemas/<file>.js`

## Methods

### `methodName(input)`

- **Input:** Zod schema name + key fields
- **Returns:** `{ data: <shape>, error: string | null }`
- **Side effects:** notifications, state transitions, anything outside the
  return value
- **Failure modes:** common errors and what causes them

## Conventions specific to this service
```
