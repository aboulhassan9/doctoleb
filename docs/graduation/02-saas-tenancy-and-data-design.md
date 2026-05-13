# 02 - SaaS Tenancy And Data Design

## Tenancy Model
DoctoLeb separates SaaS metadata from clinical data.

```mermaid
flowchart LR
  cp["Control plane\nSaaS metadata only"]
  t1["Tenant A Supabase\nClinic A clinical data"]
  t2["Tenant B Supabase\nClinic B clinical data"]
  t3["Tenant C Supabase\nClinic C clinical data"]

  cp -. routes to .-> t1
  cp -. routes to .-> t2
  cp -. routes to .-> t3
```

| Plane | Stores | Does Not Store |
|---|---|---|
| Control plane | Tenants, domains, plans, features, provisioning, audit events. | PHI, diagnoses, messages, documents, appointments. |
| Tenant project | Patients, staff, appointments, encounters, messages, files, tenant config. | Other tenants' data, SaaS provider tokens. |

## Routing Data
The control plane maps hostnames to tenants.

| Column | Example | Meaning |
|---|---|---|
| `hostname` | `dr-hassan.doctoleb.com` | Incoming URL host. |
| `surface` | `patient` | Patient portal or staff portal. |
| `tenant_id` | `dr-hassan` tenant UUID | Which clinic to load. |
| `status` | `active` | Whether routing is allowed. |
| `dns_status` / `ssl_status` | `verified` / `issued` | Domain readiness. |

## Tenant Boot
```mermaid
sequenceDiagram
  participant App as Patient/Ops App
  participant Resolver as tenant-resolve
  participant CP as Control Plane DB
  participant Tenant as Tenant Supabase

  App->>Resolver: host + surface
  Resolver->>CP: find tenant domain
  CP-->>Resolver: tenant URL + anon key
  Resolver-->>App: { data, error }
  App->>Tenant: configure runtime client
  App->>Tenant: load auth, branding, features, data
```

## Example Resolution
| Input Host | Surface | Result |
|---|---|---|
| `doctoleb-patient-web.vercel.app` | `patient` | Load dev tenant patient app. |
| `doctoleb-clinic-ops.vercel.app` | `ops` | Load dev tenant staff app. |
| `dr-hassan.doctoleb.com` | `patient` | Load Dr. Hassan patient portal. |
| `dr-hassan.doctoleb.com` | `ops` | Return `SURFACE_MISMATCH`. |
| Unknown host | `patient` | Return `TENANT_NOT_FOUND`. |
| Maintenance tenant | `patient` | Return `TENANT_INACTIVE`. |

## Control-Plane Tables
| Table | Purpose |
|---|---|
| `tenants` | Clinic tenant identity, status, plan, Supabase public runtime config. |
| `tenant_domains` | Hostname to tenant/surface mapping. |
| `plans` | Subscription plan definitions. |
| `plan_entitlements` | Default features per plan. |
| `tenant_entitlements` | Manual feature overrides/add-ons. |
| `tenant_provisioning_jobs` | Step-by-step tenant creation ledger. |
| `super_admins` | SaaS admin RBAC. |
| `tenant_events` | Zero-PHI audit trail. |

## Tenant Project Data
| Area | Examples |
|---|---|
| Identity | Auth users, doctors, staff, patient accounts. |
| Clinical | Patient profiles, medical history, encounters, documents. |
| Operations | Slots, bookings, billing, claims-ready data. |
| Communication | Conversations, messages, attachments, read receipts. |
| Runtime config | `tenant_profile`, `tenant_app_config`, `feature_flags`. |

## Branding And Feature Control
```mermaid
flowchart LR
  console["SaaS admin console"]
  edge["Secure admin Edge Function"]
  config["Tenant config tables"]
  apps["Patient web + Ops web + Flutter later"]

  console --> edge --> config --> apps
```

| Setting | Runtime Effect |
|---|---|
| Clinic/doctor name | Titles, headers, landing copy. |
| Logo/favicon | App logo and browser icon. |
| Primary/secondary colors | CSS variables and Flutter theme later. |
| Feature flags | Hide/show UI and block backend actions. |
| Maintenance/min version | App access and upgrade messaging. |

## New Tenant Creation
```mermaid
flowchart LR
  start["+ New tenant"]
  clinic["Step 1\nClinic identity"]
  doctor["Step 2\nFirst doctor"]
  hosting["Step 3\nHosting path"]
  review["Step 4\nReview"]
  ledger["Provisioning ledger"]
  active["Tenant online"]

  start --> clinic --> doctor --> hosting --> review --> ledger --> active
```

Creation is separate from editing an existing tenant. The selected tenant cannot be changed by accident during the creation wizard.
