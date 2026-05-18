---
colors:
  primary: "oklch(55% 0.13 215)"
  primary_dark: "oklch(45% 0.12 215)"
  primary_soft: "oklch(92% 0.04 215)"
  accent: "oklch(62% 0.11 55)"
  surface: "oklch(98% 0.01 90)"
  surface_alt: "oklch(95% 0.015 90)"
  ink: "oklch(18% 0.03 240)"
  muted: "oklch(48% 0.025 240)"
  border: "oklch(84% 0.025 230)"
typography:
  display: "Cabinet Grotesk, sans-serif"
  body: "IBM Plex Sans, sans-serif"
  serif: "Source Serif 4, serif"
  mono: "JetBrains Mono, monospace"
  scale: [11, 13, 15, 17, 20, 24, 30, 36, 48, 64]
spacing:
  base: 4
  scale: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128]
radius:
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
  card: 12px
  full: 9999px
---

# DoctoLeb Design Contract

## 1. Visual Theme & Atmosphere

Default register: Industrial/Utilitarian with clinical calm.

DoctoLeb should feel like a trusted clinic operations system, not a generic AI startup, consumer fintech app, or glossy hospital brochure. Use cool clinical teal, midnight ink, warm off-white surfaces, restrained borders, purposeful density, and clear hierarchy.

Patient-facing surfaces may borrow from the Stitch "Tactile Patient Sanctuary" direction: warmer paper-like surfaces, softer pacing, narrative cards, and calmer forms. Staff-facing surfaces should remain operational, compact, and fast.

## 2. Color Palette & Roles

- Primary: clinical teal for core actions, focus states, selected navigation, and high-confidence affordances.
- Accent: restrained amber/clay for patient-facing warmth, caution, billing, and low-frequency highlights.
- Surface: off-white and tinted neutrals instead of pure white when building new patient-facing work.
- Ink: dark blue-black for primary text and critical operational labels.
- Muted: cool slate for secondary metadata, never for essential instructions on colored surfaces.
- Error, warning, and success colors must be semantic, accessible, and never only communicated by color.

Use OKLCH tokens in new design work when practical. Existing hex variables in `src/index.css` are current repo reality and should be migrated gradually, not rewritten in a risky sweep.

## 3. Typography Rules

- Current code still uses Inter widely. Do not expand that pattern into new expressive surfaces.
- Target display font for new public/patient redesign work: Cabinet Grotesk.
- Target body font: IBM Plex Sans for product clarity.
- Optional serif accent: Source Serif 4 for patient narrative blocks, quotes, or calm onboarding moments.
- Staff app views should use fixed type scales and prioritize scan speed.
- Patient marketing or onboarding pages may use larger editorial display sizes when the content benefits from it.

## 4. Component Styling

- Buttons should have clear hierarchy: primary, secondary, ghost, danger.
- Cards should be functional containers, not decorative boxes nested inside decorative boxes.
- Forms need visible labels, helper text, validation states, loading states, and accessible error messaging.
- Status pills should pair color with text and/or icon meaning.
- Tables and schedules should optimize density, filtering, sticky context, and row-level actions.
- Patient timeline/message cards can be warmer and more narrative, but must still expose dates, actors, statuses, and actions clearly.

## 5. Layout Principles

- Mobile padding: 16px.
- Tablet padding: 24px to 32px.
- Staff desktop layouts should use left navigation, persistent context, compact panels, and task-first grouping.
- Patient desktop layouts can use more breathing room and narrative composition.
- Avoid identical centered sections everywhere. Prefer left-anchored layouts for app work.
- Prefer CSS Grid for two-dimensional dashboard and schedule layouts; use Flexbox for simple alignment.

## 6. Depth & Elevation

- Use borders, surface contrast, and spacing before heavy shadows.
- Reserve elevated shadows for modals, drawers, active overlays, or dragged/interactive states.
- Staff surfaces should feel crisp and stable.
- Patient surfaces can use soft texture and subtle layering, but avoid muddy contrast.

## 7. Motion & Animation

- The repo currently uses `framer-motion`; do not assume standalone `motion/react` unless dependencies change.
- Motion should clarify transitions, reveal state, show progress, or orient the user.
- Avoid blanket `transition-all`, repeated hover scaling, and decorative page-load animation on every element.
- Always respect `prefers-reduced-motion`.
- Destructive or critical patient actions may use deliberate confirmation patterns, but must include accessible keyboard alternatives.

## 8. Do's And Don'ts

Do:

- Keep backend/API/service architecture unchanged unless the task explicitly asks for architecture work.
- Use Stitch pages as references for patient dashboard, booking, timeline, registration, and billing mood.
- Translate poetic Stitch vocabulary into clear DoctoLeb healthcare language.
- Reuse shared primitives before creating new one-off components.
- Improve local design debt when touching a screen.

Don't:

- Import standalone Stitch HTML into React production code.
- Ship `Aetheris Health` branding.
- Use "sanctuary", "sovereign", "presence", or similar poetic words as primary app navigation.
- Create fake SaaS claims, fake clinic counts, fake AI features, or fake customer logos.
- Put business logic, raw Supabase calls, or authorization decisions inside UI components.

## 9. Accessibility Notes

- Minimum target: WCAG 2.2 AA.
- Normal text contrast: at least 4.5:1.
- Large text and non-text UI controls: at least 3:1.
- Every input needs an associated label.
- Icon-only buttons need accessible names.
- Focus must be visible and must not be removed without a stronger replacement.
- Keyboard paths must exist for dialogs, menus, drawers, critical confirmations, booking, billing, and cancellation.
- Loading and error states must be announced where appropriate with `aria-busy`, `role="status"`, `role="alert"`, or equivalent patterns.
