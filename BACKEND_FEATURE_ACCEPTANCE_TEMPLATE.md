# Backend Feature Acceptance Template

Use this template before implementing any new backend/API feature. If a section is not applicable, write `N/A` and explain why.

## 1. Domain And Duplicate Check

- Domain:
- Business operation:
- Canonical owner:
- Existing related tables:
- Existing related services:
- Existing related RPCs/functions/triggers:
- Existing related Edge Functions:
- Why this is not duplicating an existing concept:
- Compatibility/deprecation impact:

## 2. Data Contract

- Tables touched:
- New columns:
- Existing columns reused:
- Primary keys:
- Foreign keys:
- `ON DELETE` behavior:
- Unique constraints:
- Check constraints/status enum:
- Indexes:
- Soft archive fields:
- Audit trigger coverage:
- Backfill required:
- Rollback/migration note:

## 3. Auth And RLS Contract

- Roles that can read:
- Roles that can insert:
- Roles that can update:
- Roles that can delete/archive:
- Patient self-access rules:
- Staff scoping rules:
- Anon access, if any:
- Spoofing risks and prevention:
- Direct write bypasses blocked:

## 4. API And Service Contract

- Service module:
- Public methods:
- List response shape: `{ data, meta, error }`
- Single/write response shape: `{ data, error }`
- Zod schemas:
- Normalizers/select constants:
- Lifecycle method/RPC required:
- Idempotency key required:
- Realtime subscription required:
- Edge Function wrapper required:

## 5. Failure Modes

- Validation failure:
- RLS/auth failure:
- Duplicate retry:
- Partial failure:
- Network/offline retry:
- Concurrent write/race:
- External provider failure:
- Rollback path:

## 6. Tests

- DB/RLS tests:
- Service contract tests:
- Lifecycle tests:
- Idempotency tests:
- Forbidden direct-write tests:
- Edge Function tests:
- Smoke test data:

## 7. Release Gate

- `npm run lint`:
- `npm run build`:
- `npm run audit:backend-contract`:
- Supabase branch DB audit:
- Migration reviewed:
- Rollback reviewed:
- No frontend page imports Supabase directly:
