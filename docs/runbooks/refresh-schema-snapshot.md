# Runbook · Refresh the DB schema snapshot

The `tests/fixtures/db-schema-snapshot.json` file is a frozen view of the live
`clinic-website` Supabase schema (project ref `gezmfmskhmjgnquoyosq`). The
`scripts/audit-selects-drift.mjs` script (run on every `npm run verify`)
parses `packages/core/lib/selects.js` and asserts every column referenced
in every select string exists in this snapshot.

**Why a snapshot instead of querying live on every run:** the audit must
run in CI without network access and without leaking the anon key into
test logs. The snapshot makes the contract explicit and reviewable: every
migration PR also updates this file, so the diff makes the schema change
visible.

## When to refresh

After **any** migration lands that adds, renames, drops, or retypes a
column in the public schema. If `selects.js` changes but the snapshot
hasn't refreshed since the last migration, the audit will likely emit a
false negative (passing when it shouldn't) or a false positive (failing
on a column that does exist).

## How to refresh

Run the snapshot SQL against the live `clinic-website` project. Two options:

### Option A — via the Supabase dashboard SQL editor

1. Open `https://supabase.com/dashboard/project/gezmfmskhmjgnquoyosq/sql`
2. Run:

   ```sql
   select jsonb_object_agg(table_name, columns) as schema
   from (
     select table_name,
            jsonb_agg(column_name order by ordinal_position) as columns
     from information_schema.columns
     where table_schema = 'public'
     group by table_name
   ) t;
   ```

3. Copy the `schema` JSON object into `tests/fixtures/db-schema-snapshot.json`
   under the `"schema"` key. Update `"$generatedAt"` to today's date.

### Option B — via Supabase MCP

If you have the Supabase MCP server connected, run the same query through
`mcp__supabase__execute_sql` with `project_id: 'gezmfmskhmjgnquoyosq'`.
Paste the `schema` object into the fixture file.

## What to expect

After refresh:

```
npm run audit:selects-drift
```

should print `✅ No drift found.` and exit 0. If it emits `UNKNOWN COLUMN`
or `UNKNOWN TABLE` lines, that's the intended signal — either `selects.js`
references a column that no longer exists (drift) or you forgot to add
the new column to a select constant.

## Verifying the audit catches drift

The audit script's parser + validator are unit-tested at
`tests/unit/selectsAuditParser.test.mjs`. Those tests exercise the drift
detection against synthetic inputs with known-bad columns, so a green
"audit-selects-drift / validator catches real drift" block is the proof
that the script does its job.

## CI integration

`audit:selects-drift` is wired into the canonical `npm run verify` pipeline
between `audit:backend-contract` and `test:backend-db-contract`. Any PR
that introduces drift fails CI.
