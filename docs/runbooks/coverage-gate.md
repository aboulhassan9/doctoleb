# Runbook · Test Coverage Gate

> Coverage reporting is enabled via `npm run test:unit:coverage` using Node's
> native `--experimental-test-coverage` flag. The CI currently runs this in
> reporting mode (no gate). This runbook explains the path to enforcing a
> coverage threshold.

## Current state

- **Tooling:** Node 22+ built-in coverage. No `c8` / `nyc` / `vitest` needed.
- **Local command:** `npm run test:unit:coverage` — prints a per-file
  line/branch/function coverage report at the end of the test run.
- **CI:** the `verify-full` lane runs `npm run test:unit`. Coverage is **not
  yet gated** — running it would require setting a realistic baseline first.
- **Baseline:** unknown. Many tests in `tests/unit/` are contract tests that
  read files via `fs.readFileSync` (no executed code under coverage), so the
  numeric coverage of the *service* layer is currently very low even though
  the contracts are well-tested.

## Why we're not gating yet

A coverage gate set above the current baseline would block every PR until
the gap is filled. A gate set at the current baseline would be meaningless.
We add coverage as we add unit tests in Phase A (service layer first).

## Plan

1. **Phase A** (master plan §A) — write service unit tests that actually
   execute service code. After each service lands, re-run
   `npm run test:unit:coverage` and record the new floor in this runbook.
2. Once Phase A's first three critical services are tested
   (`appointments.js`, `patients.js`, `clinical.js`), set the first
   threshold:
   - **Line coverage ≥ 60%** for `packages/core/services/**`.
3. Add a CI step in the `verify-full` lane:

   ```yaml
   - name: Run unit tests with coverage
     run: npm run test:unit:coverage > output/coverage/report.txt

   - name: Enforce coverage threshold
     run: node scripts/coverage-gate.mjs --min-line 60 --scope packages/core/services
   ```

   (The script does not exist yet — it's part of the same Phase A slice
   that introduces the gate.)
4. After every Phase A milestone, raise the threshold by 5 points until we
   reach 80%. Never lower it without a runbook entry explaining why.

## Reading the coverage report

```
ℹ ----------------------------------------------------------
ℹ file      | line % | branch % | funcs % | uncovered lines
ℹ ----------------------------------------------------------
ℹ packages/core/services/appointments.js | 72.50 | 60.00 | 80.00 | 113-117, 198-204
ℹ ----------------------------------------------------------
ℹ all files | 35.21 | 28.40 | 41.10 |
ℹ ----------------------------------------------------------
```

- **Line %** — percentage of executed lines.
- **Branch %** — percentage of conditional branches both taken and not
  taken. Always lower than line %.
- **Funcs %** — percentage of declared functions that were called at least
  once.
- **Uncovered lines** — line ranges that need new tests.

## Excluding files

We do **not** exclude generated files from coverage (the tenant migration
bundle is generated but tiny and not executed at test time). If we ever
need to exclude, do it in the gate script, not in `node --test` flags —
keep the raw report honest.
