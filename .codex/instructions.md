# DoctoLeb Codex Instructions

This file adapts the frontend design prompt for the real DoctoLeb workspace.

Use this file together with [CLAUDE.md](/G:/project/doctoleb/CLAUDE.md), [PRODUCT.md](/G:/project/doctoleb/PRODUCT.md), and [DESIGN.md](/G:/project/doctoleb/DESIGN.md).

## Source Of Truth

When these files disagree, prefer them in this order:

1. `CLAUDE.md` for architecture, service-layer, routing, and data rules.
2. `PRODUCT.md` for audience, scope, and brand truth.
3. `DESIGN.md` for visual direction, tokens, motion, and accessibility.
4. Generic design prompts only when they do not conflict with repo reality.

## Product Mode

DoctoLeb is a product UI first, not a startup landing-page generator.

- The product model is one clinic with multiple doctors.
- Patients may self-register.
- Staff roles are internal clinic accounts.
- Most UI work should optimize clarity, speed, and trust under real clinic pressure.
- Marketing pages must still describe the actual product, not a fake SaaS marketplace.

## Current Stack Reality

Design and implementation must fit the current repo unless the user explicitly asks for a migration.

- React `19`
- Vite `8`
- React Router `7`
- Tailwind CSS `3`
- Framer Motion `12`
- Supabase JS `2`
- Existing shared UI in `src/components/ui`, `src/components/layouts`, and `src/lib/styles.js`

Do not assume:

- Next.js
- Tailwind v4
- Radix primitives
- Motion's standalone `motion/react` package
- Impeccable is installed in this workspace

Configured design MCP targets for this repo include:

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

These may require the host app to reload before they appear in an active session. If a configured MCP is not available in the current tool list, say so briefly and fall back cleanly.

## Default Frontend Direction

Use this design direction unless the user asks for a different campaign or surface:

- Register: `Industrial/Utilitarian` with clinical calm
- Personality: calm, trustworthy, efficient
- Public surfaces: slightly more editorial and expressive
- App surfaces: denser, more operational, more left-anchored

The UI should feel doctor-owned and operationally serious, not playful, crypto, consumer-fintech, or generic AI-startup.

## Before Writing UI Code

1. Read the relevant route/page and any shared component it depends on.
2. Check `PRODUCT.md` for audience and workflow context.
3. Check `DESIGN.md` for color, type, spacing, and motion rules.
4. Reuse or improve existing shared primitives before creating new one-off patterns.
5. Keep role differences visible without fragmenting the design system.

## Design Rules For This Repo

### Typography

- Do not expand the current all-`Inter` pattern into new hero or marketing work.
- For new or redesigned public-facing surfaces, introduce a distinct display font from `DESIGN.md`.
- For app flows, prioritize legibility and scanning speed over personality.
- Use fixed scales for dense product views.
- Avoid oversized airy spacing that slows operational pages.

### Color

- Prefer semantic tokens and CSS variables over raw color literals in components.
- New color work should move toward OKLCH tokens defined in `DESIGN.md`.
- Existing hex tokens are tolerated where already entrenched, but do not spread them further.
- Keep the palette tight: clinical teal, midnight neutrals, restrained success/warning states.
- Do not introduce purple-blue startup gradients.

### Layout

- Avoid repetitive `max-w-7xl mx-auto px-4` sameness when a page needs stronger composition.
- Do not nest decorative cards inside decorative cards.
- App shells should privilege task flow, filtering, and information density.
- Marketing sections should avoid stock six-card feature grids unless the content truly needs them.

### Motion

- Use the existing `framer-motion` dependency for animated UI in this repo.
- Respect `prefers-reduced-motion`.
- Avoid blanket `transition-all` and hover-scale patterns on every element.
- Motion should clarify hierarchy, reveal state changes, or support orientation.

### Copy And Truthfulness

- Do not invent scale claims, fake customer logos, fake uptime, fake country counts, or fake AI features.
- Copy must reflect the single-clinic, multi-doctor model already documented in `docs/decisions/ADR-001-single-clinic-multi-doctor.md`.
- Healthcare copy should sound confident and human, never sensational.

## Component Guidance

Prefer this order:

1. Existing shared primitives in `src/components/ui`
2. Existing layout shells in `src/components/layouts`
3. Small repo-local abstractions extracted from repetition
4. New custom components only when reuse would force a bad fit

Every new reusable interactive component should support:

- `className`
- forwarded refs when relevant
- keyboard access
- visible focus
- loading and empty states when applicable
- reduced-motion-safe behavior if animated

## Accessibility

Minimum bar:

- WCAG 2.2 AA contrast
- keyboard reachability for interactive controls
- visible focus states
- no color-only status communication
- touch targets that feel deliberate, not cramped

Do not remove focus outlines unless replacing them with something stronger.

## Verification

For meaningful UI changes:

1. Run `npm run lint`
2. Run `npm run build`
3. Verify the touched route in browser tooling when available
4. Check mobile, tablet, and desktop breakpoints
5. Check dark mode if the screen supports it

If verification could not be completed, say so explicitly.

## Frontend Debt To Keep In Mind

These are known gaps worth improving when a task touches them:

- Global typography is still `Inter`-only.
- Global color tokens are still mostly hex-based.
- Some public pages use generic marketing patterns and exaggerated copy.
- Some components overuse `transition-all`, hover scaling, and heavy shadows.
- Print styles and dark mode currently rely on coarse global behavior in places.

Do not rewrite the whole app just to fix these, but improve them locally when your task overlaps.
