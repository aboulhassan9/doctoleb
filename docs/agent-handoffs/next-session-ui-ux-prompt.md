# Next Session UI/UX Handoff Prompt

You are joining the DoctoLeb project as the next coding agent. Keep the existing development plan intact. Do not change the backend/API/database/frontend architecture plan unless the user explicitly asks for that.

Your role is to improve, redesign, and build UI/UX professionally when the current plan reaches UI work. You should use the design rules and MCP/skill setup below as the way to execute UI work, not as permission to rewrite the product.

## First Context To Read

1. `G:\project\AGENTS.md`
2. `G:\project\doctoleb\CLAUDE.md`
3. `G:\project\doctoleb\.codex\instructions.md`
4. `G:\project\doctoleb\PRODUCT.md`
5. `G:\project\doctoleb\DESIGN.md`
6. `G:\project\doctoleb\docs\plans\patient-web-functional-audit-redesign-plan.md`
7. `G:\project\doctoleb\docs\stitch-analysis\9966518933119406027\ANALYSIS.md`

## Non-Negotiable Product Boundary

DoctoLeb V1 is a production-bound clinic system for one clinic with multiple doctors.

- Patients may self-register.
- Staff users are internal accounts.
- Patient web and clinic operations are separate app surfaces.
- Pages/components must not contain raw Supabase calls, authorization decisions, or business logic.
- Shared contracts belong in `packages/core`.
- Shared reusable UI belongs in `packages/ui`.
- App-specific composition belongs in `apps/patient-web` or `apps/clinic-ops`.

## MCP And Tooling Expectations

Configured Codex MCP servers include:

- `@21st-dev/magic`
- `magic-ui`
- `shadcn`
- `figma`
- `framelink`
- `design-systems`
- `browsermcp`
- `playwright`
- `github`
- `context7`
- `stitch`

If a server is configured but not visible in the active tool list, say so briefly and use the best available fallback. Do not pretend an MCP call happened.

Use these installed skills proactively when relevant:

- `frontend-skill` for strong UI design and implementation.
- `frontend-ui-engineering` for production-quality React UI work.
- `browser-testing-with-devtools`, `playwright`, or `playwright-interactive` for browser verification.
- `code-review-and-quality` before considering UI work complete.
- `security-best-practices` for auth, PHI, payments, permissions, or secrets.

## Stitch Project Context

The Stitch project `9966518933119406027` was fetched through the Stitch MCP. All visible and hidden desktop/mobile pages are saved under:

`G:\project\doctoleb\docs\stitch-analysis\9966518933119406027`

It contains 12 screen references:

- 9 visible screens.
- 3 hidden screens.
- 10 desktop pages.
- 2 mobile pages.

Use Stitch as patient-experience inspiration only. Do not import its standalone HTML into production. Do not ship its `Aetheris Health` branding. Translate its poetic language into clear DoctoLeb product language.

Best Stitch patterns to reuse thoughtfully:

- Patient dashboard mood.
- Care timeline and contextual messaging.
- Guided appointment booking.
- Calm billing/payment flow.
- Softer patient registration and onboarding.

Do not use Stitch as the basis for:

- Doctor dashboards.
- Secretary operations.
- Predoctor triage operations.
- A global product rebrand without explicit approval.
- Direct HTML/CSS import.

## Design Direction

Default DoctoLeb direction: Industrial/Utilitarian with clinical calm.

Patient-facing screens can be warmer, more tactile, and more editorial. Staff-facing screens must be denser, clearer, and faster. The design must feel trustworthy, clinical, and real.

Use `DESIGN.md` as the design contract. Respect accessibility, keyboard navigation, contrast, reduced motion, loading states, errors, and responsive behavior.

## How To Work

1. Inspect the current page, route, service, and shared UI before editing.
2. Keep changes small and reviewable.
3. Reuse existing primitives before creating new patterns.
4. If using a library or framework API that may have changed, use `context7`.
5. If building or verifying UI, use browser tooling when available.
6. Run targeted verification, and run `npm run lint` / `npm run build` when feasible.
7. Document anything that affects public contracts, architecture, migrations, or next steps.

## Patient-Web Redesign Gate

For `apps/patient-web`, do not start visual redesign first. Follow `docs\plans\patient-web-functional-audit-redesign-plan.md`:

- First produce the weakness audit with severity, file references, business impact, and owner layer.
- Check patient actions against doctor, predoctor, secretary, notification, billing, and Supabase consequences.
- Define or approve the data contracts before building new screens.
- Keep business logic in Supabase/RPCs or `packages/core`, reusable UI in `packages/ui`, and page composition in `apps/patient-web`.
- Use Stitch as patient-only visual inspiration after the contracts and audit are clear.

Your job is to make the UI/UX professional and memorable while protecting the current plan, codebase architecture, patient safety, and production discipline.
