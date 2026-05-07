# Tier 2 Index & Performance Plan

> **Audience**: senior engineer applying targeted DB tuning, not a green-field design.
> **Date**: 2026-05-07.
> **Scope**: indexing strategy, partial-index policy, audit-log strategy, zero-downtime migration patterns, hot-table tuning. Tier 1 + Tier 2 + Tier 2.5 schema, post legacy burn-down.
> **Constraint**: live DB has zero production rows yet. Recommendations optimize for the *first paying tenant*, not for backfilling a hot system.
> **Output style**: every recommendation includes exact SQL or a migration sketch.
> **Implementation status**: Blocks A + C and the two redundant clinical-note drops were implemented/applied in `20260507102119_tier2_index_block_a_c.sql` on 2026-05-07.

---

## Executive summary

The Tier 2 foundation already ships a credible index baseline:

- **~50 indexes live**: catalog FKs, encounter timelines, messaging, notifications, partial archive/active filters, idempotency keys, tenant lookups.
- **Audit log** has the three indexes that matter (`actor_user_id`, `(table_name, record_id)`, `created_at desc`).
- **Soft-delete partials** (`WHERE is_archived = false`) are applied to the highest-churn PHI tables.

What is **not** there yet, and is worth adding before first-tenant production traffic:

| # | Recommendation | Why |
|---|---|---|
| A | 6 RLS-driven/reverse-lookup index definitions (`messages.sender_*`, `document_attachments.patient_id`, `patient_consents.consent_document_id`, `lab/imaging_orders.result_document_id`) | RLS predicates and cross-document joins. |
| B | Extend `WHERE is_archived = false` partial pattern to clinical_notes, diagnoses, prescriptions, lab/imaging orders, clinical_documents, care_tasks. | Active list views are the dominant query shape; cuts partial-index size by ~archive ratio. |
| C | One partial index on `messages` for non-deleted ordering (`WHERE deleted_at IS NULL`). | Inbox view filters out deleted messages — keeps the hot fan-out path tight. |
| D | Drop two redundant single-column indexes that are subsumed by composites: `idx_clinical_notes_patient_id`, `idx_clinical_notes_doctor_id`. | They duplicate the leading column of better composites; write-amplification with no read benefit. |
| E | Audit-log monthly partitioning **deferred** until row count crosses 1 M; document the trigger condition now. | Premature partitioning costs more than it saves at < 100 K rows. |
| F | Make every future index migration use `CREATE INDEX CONCURRENTLY` in a non-transactional file. | The foundation migration uses `begin/commit`, which forbids `CONCURRENTLY`. New tuning must not repeat that pattern. |

Total recommended writes: **7 new indexes, 2 drops, 1 deferred decision**. No structural rework. The implemented migration includes six RLS/reverse-lookup indexes plus the non-deleted message-history partial index.

---

## §1 · Index gap analysis

### What is already there (Tier 1 + 2 + 2.5)

Indexes confirmed in-repo migrations as of 2026-05-07. Treat this as the working set.

**Encounter & clinical core** (`20260506150820_tier2_product_core_foundation.sql` + `20260506171000_backend_contract_query_path_indexes.sql`):

| Table | Indexes |
|---|---|
| `encounters` | `(patient_id, started_at DESC NULLS LAST)`, `(doctor_id, status, started_at DESC NULLS LAST)`, partial `(patient_id) WHERE is_archived = false`. PK + UNIQUE on `appointment_id` cover those FKs. |
| `clinical_notes` | `(encounter_id, created_at DESC)`, `(encounter_id)`, `(patient_id)`, `(doctor_id)` — last two are redundant, see §1 drops. |
| `diagnoses` | `(encounter_id)`, `(patient_id, status)`, `(disease_id)`. |
| `prescriptions` | `(encounter_id)`, `(patient_id, status)`. |
| `lab_orders` | `(encounter_id)`, `(patient_id, status)`. |
| `imaging_orders` | `(encounter_id)`, `(patient_id, status)`. |
| `clinical_documents` | `(patient_id, created_at DESC)`, `(encounter_id)`, `(doctor_id)`. |
| `document_attachments` | `(document_id)`. |
| `care_tasks` | `(assigned_to, status, due_at)`, `(patient_id, status)`, `(encounter_id)`, `(appointment_id)`. |

**Messaging**:

| Table | Indexes |
|---|---|
| `conversations` | `(patient_id, status, updated_at DESC)`. |
| `conversation_participants` | partial UNIQUE `(conversation_id, user_id) WHERE user_id IS NOT NULL`, partial UNIQUE `(conversation_id, patient_id) WHERE patient_id IS NOT NULL`, `(user_id, is_active)`, `(patient_id, is_active)`, partial `(staff_member_id, is_active) WHERE staff_member_id IS NOT NULL`. |
| `messages` | `(conversation_id, created_at DESC)`. |
| `message_attachments` | `(message_id)`. |
| `message_read_receipts` | `(user_id)`, UNIQUE `(message_id, user_id)`. |

**Notifications & devices**:

| Table | Indexes |
|---|---|
| `patient_devices` | `(patient_id, is_active)`, `(user_id, is_active)`, UNIQUE on `push_token`. |
| `notification_events` | `(user_id, status, scheduled_for)`, `(patient_id, created_at DESC)`. |
| `notification_deliveries` | `(event_id)`, `(user_id, status, created_at DESC)`, `(device_id)`. |
| `reminder_rules` | `(related_type, is_active)`, UNIQUE on `code`. |

**Tenant / config / consent**:

| Table | Indexes |
|---|---|
| `tenant_profile` | UNIQUE on `doctor_id`, UNIQUE on `tenant_slug`, `(status)`. |
| `tenant_app_config` | UNIQUE on `profile_id`. |
| `feature_flags` | UNIQUE on `code`, `(is_enabled)`. |
| `content_pages` | UNIQUE on `slug`, `(audience, status)`. |
| `consent_documents` | UNIQUE `(code, version)`, `(code, is_active)`. |
| `patient_consents` | UNIQUE `(patient_id, consent_document_id)`, `(patient_id)`. |

**Tier 2.5 idempotency** (`20260506155237`): six UNIQUE `client_request_id` indexes on `messages`, `notification_events`, `notification_deliveries`, `care_tasks`, `clinical_documents`, plus `tenant_profile_doctor_id_unique`.

**Audit log** (`20260505_tier1_operator_hardening.sql`): `(actor_user_id)`, `(table_name, record_id)`, `(created_at DESC)`.

### Real gaps (recommended additions)

The "every FK should have an index" rule is misleading: most non-indexed FKs are audit/provenance columns (`created_by`, `archived_by`, `recorded_by`, `prescribed_by`, `ordered_by`, `author_user_id`, `uploaded_by`) that the app projects but does not filter. Skip those.

**Real gaps that the application's RLS or UI actually traverses**:

```sql
-- A.1  RLS sender filter on messages_sender_update policy
create index concurrently if not exists idx_messages_sender_user_id
  on public.messages (sender_user_id)
  where sender_user_id is not null;

-- A.2  Patient-side message authorship (rare today, RN-mobile sender path)
create index concurrently if not exists idx_messages_sender_patient_id
  on public.messages (sender_patient_id)
  where sender_patient_id is not null;

-- A.3  document_attachments RLS policy filters by patient_id
create index concurrently if not exists idx_document_attachments_patient_id
  on public.document_attachments (patient_id);

-- A.4  "Who accepted this consent doc version?" admin reverse lookup
create index concurrently if not exists idx_patient_consents_consent_document_id
  on public.patient_consents (consent_document_id);

-- A.5  Reverse lookup from a document to its lab/imaging order (rare but unbounded scan otherwise)
create index concurrently if not exists idx_lab_orders_result_document_id
  on public.lab_orders (result_document_id) where result_document_id is not null;
create index concurrently if not exists idx_imaging_orders_result_document_id
  on public.imaging_orders (result_document_id) where result_document_id is not null;
```

**Indexes to drop** (subsumed by better composites):

```sql
-- D.1  duplicates the leading column of idx_clinical_notes_encounter_created_at
--      every clinical_notes read uses encounter_id, never patient_id alone
drop index if exists public.idx_clinical_notes_patient_id;

-- D.2  same reasoning; doctor lookups are always scoped through encounter or RLS
drop index if exists public.idx_clinical_notes_doctor_id;
```

If a future feature needs them back (e.g. "all notes for patient X across all encounters"), reintroduce as composite `(patient_id, created_at desc)` rather than single-column.

**Indexes that look missing but are not worth adding now**:

- `encounters.created_by`, `encounters.archived_by`, `encounters.clinic_id`, `encounters.visit_type_id`: rare filter targets; full-table scan is fine on a tenant DB with one doctor's data.
- All `archived_by` columns: archive-listing UIs filter by `is_archived` first; FK-back is a join projection, not a filter.
- `recorded_by`, `prescribed_by`, `ordered_by`, `author_user_id`: same — projection, not filter.
- `consent_documents.created_by`, `content_pages.created_by`: low-traffic admin pages.
- `notification_events.created_by`: same.

**Decision rule for future FK additions**: index a FK when **any one** of these holds:

1. RLS policy filters on the column.
2. A documented service method (in `services/*.js`) filters or orders by it.
3. Cascade/restrict delete cost is dominated by reverse-FK scans (only matters at 1 M+ rows).

Otherwise leave it un-indexed. Every index has measurable INSERT/UPDATE cost.

---

## §2 · Composite indexes for canonical query shapes

The eight canonical query shapes the app issues (verified by reading service methods + RLS policies):

| # | Query shape | Covered by |
|---|---|---|
| 1 | "Encounter timeline for patient X" — `WHERE patient_id = ? ORDER BY started_at DESC` | `idx_encounters_patient_started_at` ✓ |
| 2 | "Doctor's active encounters" — `WHERE doctor_id = ? AND status = 'in_progress'` | `idx_encounters_doctor_status` ✓ |
| 3 | "Notes inside encounter Y, newest first" — `WHERE encounter_id = ? ORDER BY created_at DESC` | `idx_clinical_notes_encounter_created_at` ✓ |
| 4 | "Active diagnoses for patient" — `WHERE patient_id = ? AND status = 'active'` | `idx_diagnoses_patient_status` ✓ |
| 5 | "Open care tasks assigned to user, sorted by due date" — `WHERE assigned_to = ? AND status IN ('open','in_progress') ORDER BY due_at` | `idx_care_tasks_assigned_status_due` ✓ |
| 6 | "Inbox: unread notifications for user" — `WHERE user_id = ? AND status != 'read' ORDER BY created_at DESC` | `idx_notification_deliveries_user_status` ✓ |
| 7 | "Conversation message history" — `WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 50` | `idx_messages_conversation_created_at` ✓ |
| 8 | "Slot board for booking" — `WHERE clinic_id = ? AND scheduled_at BETWEEN ? AND ?` | `idx_appointments_clinic_scheduled_at` ✓ (Tier 1) |

All eight are covered. **No new composite indexes are needed** for the query shapes the codebase issues today.

When new query shapes appear (e.g. "all prescriptions written by doctor X this month"), add them in a follow-up migration rather than speculatively pre-indexing now.

---

## §3 · Partial indexes (`WHERE is_archived = false`)

### Rationale

PHI tables in this codebase are **soft-deleted, never hard-deleted** (see CLAUDE.md rule 3). Production traffic only ever reads `is_archived = false`. Indexing the archived rows wastes IO and B-tree depth. Partial indexes are the right answer.

### Currently applied

```sql
-- already in place
idx_encounters_active_patient                   on encounters       (patient_id) where is_archived = false
idx_patient_vaccinations_active_patient         on patient_vaccin.. (patient_id) where is_archived = false
idx_patient_family_history_active_patient       on patient_family.. (patient_id) where is_archived = false
idx_staff_members_active_doctor                 on staff_members    (doctor_id)  where is_active   = true
idx_doctor_insurance_contracts_active_doctor    on doctor_insur..   (doctor_id)  where is_active   = true
```

### Recommended extensions

Apply the same partial pattern to the rest of the soft-deleted PHI surface where the active-list query is the dominant read:

```sql
-- B.1  active clinical notes per encounter (encounter view is the hot path)
create index concurrently if not exists idx_clinical_notes_active_encounter
  on public.clinical_notes (encounter_id, created_at desc)
  where is_archived = false;

-- B.2  active diagnoses per patient
create index concurrently if not exists idx_diagnoses_active_patient
  on public.diagnoses (patient_id, status)
  where is_archived = false;

-- B.3  active prescriptions per patient
create index concurrently if not exists idx_prescriptions_active_patient
  on public.prescriptions (patient_id, status)
  where is_archived = false;

-- B.4  active orders per patient
create index concurrently if not exists idx_lab_orders_active_patient
  on public.lab_orders (patient_id, status)
  where is_archived = false;
create index concurrently if not exists idx_imaging_orders_active_patient
  on public.imaging_orders (patient_id, status)
  where is_archived = false;

-- B.5  active documents per patient
create index concurrently if not exists idx_clinical_documents_active_patient
  on public.clinical_documents (patient_id, created_at desc)
  where is_archived = false;

-- B.6  active care tasks per assignee (often the dashboard query)
create index concurrently if not exists idx_care_tasks_active_assigned
  on public.care_tasks (assigned_to, status, due_at)
  where is_archived = false;
```

### Trade-off

Each partial above duplicates an existing full-table composite. Pre-launch, tables are empty, so this is a **defer until measurable**: keep the SQL on file, ship them only when:

- archive ratio crosses ~10 %, **or**
- `EXPLAIN (ANALYZE, BUFFERS)` on the active-list query shows large heap fetches.

Carrying both indexes long term is wasteful; the migration should `DROP` the full-table index in favor of the partial once the partial proves out.

### Special case: `messages.deleted_at`

`messages` already has `(conversation_id, created_at DESC)` but no archive flag — instead, `deleted_at` is a soft-delete tombstone. The hot read path filters out deleted rows. Add:

```sql
-- C.1  inbox view excludes soft-deleted messages
create index concurrently if not exists idx_messages_active_conversation
  on public.messages (conversation_id, created_at desc)
  where deleted_at is null;
```

Same defer-until-measurable rule applies.

---

## §4 · Audit-log strategy

`audit_log` already has the right working-set:

```sql
-- existing
idx_audit_log_actor_user_id  on audit_log (actor_user_id)
idx_audit_log_table_record   on audit_log (table_name, record_id)
idx_audit_log_created_at     on audit_log (created_at desc)
```

These cover the three legitimate query shapes: "what did user X do," "history of record Y on table T," and "recent activity." Nothing else is needed at zero rows.

### Growth budget

`write_audit_log()` fires on INSERT/UPDATE/DELETE for **31 tables** (Tier 0 set + 19 Tier 2 tables added in `20260506150820`). For one busy clinic:

- ~50 patients/day × ~5 row writes per visit = 250 row events/day.
- ~90 K rows/year. Linear B-tree behaviour, no partition needed.

For 10 tenants on one database (we run silo, not pooled, so this is theoretical):

- 900 K rows/year. Approaching but not crossing the typical "consider partitioning" line.

### When to partition

Only when **one** of these is true on production:

1. `audit_log` row count crosses **1 M** rows AND p95 query time on the index exceeds 50 ms.
2. The retention policy ("delete audit older than N years") becomes painful — partitions make `DETACH PARTITION` instant; row-by-row delete is not.

### Partitioning sketch (when triggered)

Range-partition by month on `created_at`, with a 12-month rolling window plus an "archive" partition for everything older. Sketch:

```sql
-- step 1: rename current table out of the way
alter table public.audit_log rename to audit_log_legacy;

-- step 2: create partitioned parent with same shape
create table public.audit_log (
  id bigint generated always as identity,
  table_name text not null,
  record_id  uuid,
  action     text not null,
  actor_user_id uuid,
  before_data jsonb,
  after_data  jsonb,
  created_at timestamptz not null default now()
) partition by range (created_at);

-- step 3: monthly partitions for current + next 12 months
create table public.audit_log_y2026m05 partition of public.audit_log
  for values from ('2026-05-01') to ('2026-06-01');
-- ...repeat for each month

-- step 4: an "old" catch-all partition for the legacy data
create table public.audit_log_archive partition of public.audit_log
  for values from (minvalue) to ('2026-05-01');

-- step 5: copy legacy rows into the right partitions
insert into public.audit_log
  select * from public.audit_log_legacy;

-- step 6: rebuild the three indexes on the parent (cascade to partitions)
create index idx_audit_log_actor_user_id  on public.audit_log (actor_user_id);
create index idx_audit_log_table_record   on public.audit_log (table_name, record_id);
create index idx_audit_log_created_at     on public.audit_log (created_at desc);

-- step 7: drop the legacy table
drop table public.audit_log_legacy;
```

This is **deferred work**. Document it in `BACKLOG.md` with the trigger condition above, do not migrate now.

---

## §5 · Zero-downtime migration patterns

### The foundation problem

The big foundation migrations (`20260506150820_tier2_product_core_foundation.sql`, etc.) are wrapped in `begin/commit`. That is correct for atomic schema-and-RLS rollout, but **`CREATE INDEX CONCURRENTLY` cannot run inside a transaction**. So those migrations couldn't use it; they used plain `CREATE INDEX`. That's safe at zero rows, fatal at scale.

### Rule for all post-launch tuning migrations

1. **One concern per migration file**: index additions go in their own migration, no `BEGIN`/`COMMIT` wrapper, no other DDL alongside.
2. **Always `CREATE INDEX CONCURRENTLY IF NOT EXISTS`**. If the migration is rerun after a crash, idempotent.
3. **Always include the matching `DROP INDEX CONCURRENTLY` in a rollback script** (in `supabase/sql/`, not as a migration).

Implementation note from 2026-05-07: Supabase MCP migration application wraps SQL in a transaction, so `CREATE INDEX CONCURRENTLY` failed with `CREATE INDEX CONCURRENTLY cannot run inside a transaction block`. Because this tenant has no production rows, `20260507102119_tier2_index_block_a_c.sql` intentionally uses normal idempotent index DDL. For a high-volume tenant later, use a non-transactional maintenance path or a dedicated migration runner that supports concurrent index DDL.
4. **Never combine** index drops with index creates in the same transaction — they need separate, non-transactional migrations.
5. **Verify post-deploy** with `\d+ tablename` and `pg_stat_user_indexes` for `idx_scan` movement.

### Migration template

```sql
-- supabase/migrations/<timestamp>_<slug>.sql
-- NOTE: no BEGIN / COMMIT. CONCURRENTLY forbids that.

-- A.3  document_attachments RLS predicate optimization
create index concurrently if not exists idx_document_attachments_patient_id
  on public.document_attachments (patient_id);

-- B.1  partial replacement once archive ratio justifies it
create index concurrently if not exists idx_clinical_notes_active_encounter
  on public.clinical_notes (encounter_id, created_at desc)
  where is_archived = false;
```

### Drop-replace pattern (for the redundant `clinical_notes` indexes)

To avoid a window with no covering index:

```sql
-- migration N+0: create the replacement
create index concurrently if not exists idx_clinical_notes_active_encounter
  on public.clinical_notes (encounter_id, created_at desc)
  where is_archived = false;

-- migration N+1 (deploy after N+0 is verified live and used):
drop index concurrently if exists public.idx_clinical_notes_patient_id;
drop index concurrently if exists public.idx_clinical_notes_doctor_id;
```

Two deploys, never one. The N+1 migration may be days or weeks after N+0; gate it on `pg_stat_user_indexes.idx_scan` showing the dropped indexes are no longer used.

### Other zero-downtime gotchas in this codebase

- **`ALTER TABLE … ADD COLUMN NOT NULL` is unsafe at scale**. Use `ADD COLUMN`, then `UPDATE` in batches, then `SET NOT NULL`. Already irrelevant at zero rows; remember it for tier-2 additions later.
- **`ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY`** is the same: use `NOT VALID`, then `VALIDATE CONSTRAINT` separately. The Tier 2 foundation already uses `NOT VALID` for `lab_orders_result_document_id_fkey` / `imaging_orders_result_document_id_fkey` — match that pattern.
- **`DROP TABLE`** acquires `ACCESS EXCLUSIVE`. Always wrap in low-traffic window if the table has any traffic. The legacy burndown (`20260506190000`) drops `consultations`/`certificates`/etc. with zero rows — fine. Future drops on populated tables: rename first, drop later.
- **RLS policy changes**: editing a policy takes `ACCESS EXCLUSIVE` briefly. Cheap, but stack with index work in the same window.

---

## §6 · Hot-table tuning checklist

Five tables will see the bulk of write traffic on a real tenant. Tune them, ignore the rest.

### `messages`

- ✅ `(conversation_id, created_at DESC)` covers inbox view.
- ➕ Add **C.1** partial `WHERE deleted_at IS NULL` once we ship message deletion UX.
- 🔍 Watch for `idx_messages_conversation_created_at` `idx_scan` vs `seq_scan` — should be > 99 % index hits.
- ⚠️ Don't add an index on `(sender_user_id, created_at)` for "my sent messages" until product asks for that view.

### `notification_deliveries`

- ✅ `(event_id)`, `(user_id, status, created_at DESC)`, `(device_id)` cover fan-out + inbox + push retry.
- 🔍 Monitor unread-count query: `WHERE user_id = ? AND status NOT IN ('read','cancelled')`. Current composite is good.
- ➕ If push retry job becomes hot, add partial: `(status, created_at) WHERE status = 'failed'`.

### `audit_log`

- ✅ Three indexes, see §4.
- ⚠️ Do not `LIKE` on `record_id::text` — `record_id` is `uuid`, equality only.
- 📊 Add `pg_stat_statements` watch: anything reading `audit_log` without a leading-column predicate is a UI bug, not a tuning problem.

### `appointments`

- ✅ `(clinic_id, scheduled_at)`, `(visit_type_id)`.
- ➕ Future: when patient-portal "my upcoming appointments" page exists, consider `(patient_id, scheduled_at) WHERE status NOT IN ('cancelled','no_show')`.
- ⚠️ `book_slot` RPC takes a row-level lock on `secretary_slots`, not on `appointments` — race-safety is at the slot layer; appointments writes are post-lock and don't need their own concurrency hardening.

### `secretary_slots`

- ✅ `(schedule_template_id)`.
- 🔍 The available-slots RPC (`get_available_slots`) filters by `clinic_id + date`. Confirm an index exists on `(clinic_id, date, is_active)` — if not, add it. This was Tier 0 turf; verify before adding.
- ⚠️ Avoid composite `(date, clinic_id, …)`: equality on `clinic_id` should lead.

### Quick smoke-test queries to run after deploy

```sql
-- Indexes that have never been read since DB started:
select indexrelname, idx_scan
from   pg_stat_user_indexes
where  schemaname = 'public'
order  by idx_scan asc, indexrelname asc
limit  20;

-- Tables doing seq scans where they shouldn't:
select relname, seq_scan, idx_scan
from   pg_stat_user_tables
where  schemaname = 'public'
  and  seq_scan > idx_scan * 5
order  by seq_scan desc;

-- Index bloat (rough; needs pgstattuple for accuracy):
select schemaname, relname, n_live_tup, n_dead_tup,
       round(100 * n_dead_tup::numeric / nullif(n_live_tup + n_dead_tup, 0), 2) as dead_pct
from   pg_stat_user_tables
where  schemaname = 'public'
order  by dead_pct desc nulls last
limit  20;
```

Run weekly post-launch. Anything in the bottom of query 1 with `idx_scan = 0` after a month of traffic is a drop candidate.

---

## §7 · Out of scope for this plan

- **No new tables, no new RLS, no schema changes.** Pure performance hardening.
- **No partitioning yet.** §4 covers the trigger condition.
- **No `pg_stat_statements` install instructions.** Supabase enables it by default; just turn on the dashboard view.
- **No application-side caching.** That's a frontend hooks concern; out of band here.
- **No `VACUUM`/autovacuum tuning.** Defaults are correct for this workload until measurable bloat appears.
- **No connection pool sizing** (Supabase manages PgBouncer; tenant traffic unlikely to saturate).

---

## §8 · Recommended migration order (when to ship each block)

| Block | Files | Trigger to deploy |
|---|---|---|
| **Block A — RLS-driven FK indexes** (6 index definitions) | ✅ `20260507102119_tier2_index_block_a_c.sql` | Applied before first real-user traffic. |
| **Block C — `messages.deleted_at` partial** (1 index) | ✅ `20260507102119_tier2_index_block_a_c.sql` | Applied with Block A because the redaction/delete model is already in the DB. |
| **Block B — Soft-delete partials** (6 indexes) | one new migration, non-transactional | When `pg_stat_user_tables.n_live_tup` shows ≥10 % archived ratio on any of those tables. |
| **Block D — Drop subsumed `clinical_notes` indexes** (2 drops) | separate migration, non-transactional, deploy ≥1 week after Block B B.1 | Gate on `pg_stat_user_indexes.idx_scan` for the two indexes. |
| **Block E — `audit_log` partitioning** | major migration with rebuild | When row count > 1 M *and* p95 > 50 ms. Document only for now. |

---

## §9 · References

- `supabase/migrations/202605060001_tier1_doctor_pivot.sql` (Tier 1 indexes, lines 948–978)
- `supabase/migrations/20260506150820_tier2_product_core_foundation.sql` (Tier 2 indexes, lines 1202–1232; RLS policies that drive index choices, lines 791–1200)
- `supabase/migrations/20260506171000_backend_contract_query_path_indexes.sql` (encounter-tab path indexes)
- `supabase/migrations/20260506155237_tier2_5_lifecycle_idempotency_hardening.sql` (UNIQUE idempotency keys)
- `supabase/migrations/20260505_tier1_operator_hardening.sql` (audit-log indexes, line 153–155)
- `supabase/migrations/20260503_secure_web_v1_foundation.sql` (audit_log table + write trigger, line 207–276)
- `CLAUDE.md` — soft-delete rule (rule 3), domain status enums.
- `TIER2_REVIEW.md` — 10-section senior architect review, P1/P2 ledger.

---

**End of TIER2_INDEX_AND_PERF_PLAN.md.** Blocks A + C are applied. Defer the remaining work behind concrete telemetry triggers.
