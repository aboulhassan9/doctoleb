# DoctoLeb Block D Plan — Runtime Gate And Tier 3 Cleanup

> Status: import standardization verified; runtime browser gate pending known doctor login.
> Created: 2026-05-06.
> Source: `BLOCK_D_AGENT_HANDOFF_PROMPT.md` and `TIER3_PLAN.md`.

---

## Goal

Close the safe work that does not require a known staff password, then leave the browser runtime gate explicit.

Block D has two tracks:

1. **Runtime gate**: verify the doctor encounter flow in browser once a known doctor login is available.
2. **Tier 3 cleanup**: remove remaining non-behavioral frontend drift that can be verified statically.

---

## Implemented In This Slice

- Standardized remaining `../lib`, `../services`, `../contexts`, `../schemas`, and `../components` imports in source files to the `@/` alias.
- Verified the relative import scan is clean across:
  - `src/pages`
  - `src/components`
  - `src/hooks`
  - `src/services`
  - `src/contexts`
  - `src/lib`
- Removed stale consultation/referral lifecycle exports from frontend and Edge Function shared state-machine helpers. Referrals remain a `clinical_documents.document_type`, not a separate workflow table.

---

## Runtime Gate Still Pending

Browser-level encounter testing still needs a known doctor login.

Known live Auth/domain users exist:

- `doctor@doctoleb.com`
- `secretary@doctoleb.com`
- `predoctor@doctoleb.com`

Do **not** reset these passwords silently. If the user approves a dev-only reset, do it intentionally and record that it was a development credential reset.

---

## Next Safe Tasks

After this slice verifies:

1. Get/approve a dev doctor login.
2. Run the browser encounter checklist from `BLOCK_D_AGENT_HANDOFF_PROMPT.md`.
3. Fix only runtime data-shape bugs found during testing.
4. Continue Tier 3 cleanup in small slices:
   - hook adoption for large pages,
   - shared loading/error states,
   - page size reduction,
   - final grep/audit checks.

---

## Verification

Required after each Block D slice:

```bash
npm run verify
rg -n "\\.\\./" src/pages src/components src/hooks src/services src/contexts src/lib
rg -n "supabase\\.from" src/pages
rg -n "consultationService|notificationService|reportService|certificateService|referralService|brandService" src
```

Latest result:

- `npm run verify` passed on 2026-05-06 after import standardization and stale state-machine cleanup.
- Backend contract audit passed with only tracked migration-history warnings for repeated function definitions.
- DB contract tests were skipped for external branch credentials because `BACKEND_TEST_DATABASE_URL` / Supabase test env vars are not set.
