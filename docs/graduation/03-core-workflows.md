# 03 - Core Workflows

## Patient Workflow
```mermaid
flowchart LR
  landing["Clinic landing"]
  auth["Signup / Login"]
  consent["Consent gate"]
  profile["Profile"]
  booking["Book appointment"]
  messages["Secure messages"]
  records["Records"]

  landing --> auth --> consent
  consent --> profile
  consent --> booking
  consent --> messages
  consent --> records
```

| Action | Precondition | Result |
|---|---|---|
| Open landing page | Tenant resolves. | Clinic branding appears. |
| Login/signup | Tenant Auth is available. | Patient session is created. |
| Accept consent | Required consent exists. | Consent record saved; revoked state cleared. |
| Book slot | Slot is active and available. | Appointment is created. |
| Cancel booking | User owns appointment or staff is authorized. | Appointment is cancelled and slot is released. |
| Send message | Messaging is enabled and user is participant. | Message is saved; retry uses same `client_request_id`. |

## Staff Workflow
```mermaid
flowchart LR
  login["Staff login"]
  route["Role routing"]
  schedule["Schedule"]
  patients["Patients"]
  encounter["Encounter"]
  billing["Billing"]
  staff["Staff lifecycle"]

  login --> route
  route --> schedule
  route --> patients --> encounter
  route --> billing
  route --> staff
```

| Role | Current Work |
|---|---|
| Doctor | Dashboard, encounters, reports, staff management. |
| Secretary | Front desk, registration, booking, billing support. |
| Predoctor | Intake, preparation, precheck support. |
| Junior doctor | Deferred until role/RLS/sign-off model is designed. |

## SaaS Admin Workflow
```mermaid
flowchart TB
  login["Control-plane login"]
  existing["Open existing tenant"]
  create["Click + New tenant"]
  wizard["Installer-style creation"]
  provision["Run provisioning steps"]
  config["Tenant tabs\nTenant, Domains, Provisioning, Branding, Features, Audit"]

  login --> existing --> config
  login --> create --> wizard --> provision --> config
```

| SaaS Action | Safety Rule |
|---|---|
| Open tenant | Reads zero-PHI SaaS metadata only. |
| Create draft | Does not mutate selected tenant. |
| Run step | Uses RBAC, idempotency key, and step ledger. |
| Cancel job | Marks job cancelled instead of deleting history. |
| Compensate step | Runs explicit undo when available. |
| Activate tenant | Requires resolver/domain readiness. |

## Realtime Chat
```mermaid
sequenceDiagram
  participant UserA as Patient/Staff A
  participant DB as Tenant Postgres
  participant RT as Supabase Realtime
  participant UserB as Patient/Staff B

  UserA->>DB: insert message
  DB-->>RT: Postgres change event
  RT-->>UserB: message event
  UserB->>DB: read authorized conversation
```

| Part | Design |
|---|---|
| Storage | Messages are persisted in tenant Postgres. |
| Authorization | RLS/RPC checks participant access. |
| Realtime | Subscribes to message changes. |
| Attachments | Private storage and signed URLs. |
| Mobile push | Planned through Firebase FCM. |

## Future Video Visit
```mermaid
sequenceDiagram
  participant Patient
  participant App as DoctoLeb App
  participant API as Server API
  participant LK as LiveKit
  participant Doctor

  Patient->>App: Join video visit
  App->>API: Request call token
  API->>API: Check tenant, role, appointment, entitlement
  API-->>App: LiveKit URL + short-lived token
  Patient->>LK: Join room
  Doctor->>LK: Join room
```

| Rule | Reason |
|---|---|
| Room name uses appointment UUID. | Avoid PHI in provider metadata. |
| Token generated server-side. | Client never sees LiveKit secret. |
| Appointment authorization required. | Only real participants can join. |
| Recording is deferred. | Needs consent, retention, storage, and legal design. |
