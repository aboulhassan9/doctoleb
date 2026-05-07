# DoctoLeb ERD Export

This folder is the schema snapshot handoff point for future agents and
white-label tenant onboarding.

## Current Status

- `tables.txt` is generated from the local migration directory after the legacy
  burn-down and Block F baseline migrations. It should contain 57 active public
  tables.
- `schema_dump.sql` and `erd.png` still require a disposable branch/local
  database connection. They are intentionally not faked from partial tooling
  output.

## Generate The Full Artifacts

Use a Supabase branch or local database, not the live development tenant:

```bash
mkdir -p docs/erd

pg_dump "$BACKEND_TEST_DATABASE_URL" \
  --schema-only \
  --schema=public \
  --no-owner \
  --no-privileges \
  > docs/erd/schema_dump.sql

psql "$BACKEND_TEST_DATABASE_URL" \
  -c "\dt public.*" \
  > docs/erd/tables.txt
```

Then import `docs/erd/schema_dump.sql` into dbdiagram.io, export the visual ERD
as `docs/erd/erd.png`, and commit all three files together.

## Drift Rule

If a migration adds or removes a public table, update `tables.txt` in the same
change. Do not manually edit `schema_dump.sql`; regenerate it from a branch/local
database after migrations replay cleanly.
