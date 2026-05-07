---
colors:
  primary: "oklch(62% 0.11 215)"
  primary-strong: "oklch(53% 0.1 215)"
  accent: "oklch(76% 0.08 185)"
  surface: "oklch(98% 0.01 235)"
  surface-alt: "oklch(95% 0.015 235)"
  border: "oklch(90% 0.015 235)"
  text: "oklch(23% 0.02 255)"
  text-muted: "oklch(55% 0.02 240)"
  secondary: "oklch(24% 0.03 255)"
  success: "oklch(68% 0.12 160)"
  warning: "oklch(76% 0.14 75)"
  danger: "oklch(62% 0.2 15)"
typography:
  display: "Cabinet Grotesk, sans-serif"
  body: "IBM Plex Sans, sans-serif"
  mono: "IBM Plex Mono, monospace"
  legacy_body: "Inter, sans-serif"
  scale: [11, 13, 15, 17, 20, 24, 30, 36, 48, 64]
spacing:
  base: 4
  scale: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128]
radius:
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  full: 9999px
motion:
  fast: 150ms
  normal: 250ms
  slow: 400ms
  ease-out: "cubic-bezier(0.16, 1, 0.3, 1)"
  ease-smooth: "cubic-bezier(0.4, 0, 0.2, 1)"
---

## 1. Visual Theme & Atmosphere

DoctoLeb should present as a clinically calm, operationally sharp product. The dominant mood is `Industrial/Utilitarian` softened by clean healthcare cues: bright surfaces, cool neutrals, precise teal emphasis, and confident typography. The interface should feel doctor-owned, not startup-generic, playful, or over-styled.

For role-based product screens, design serves flow first. For public-facing screens, the product can be slightly more editorial and expressive, but it must still feel grounded in care delivery and real clinic operations.

## 2. Color Palette & Roles

The palette should stay tight:

- `primary`: clinical teal for key actions, active states, and selected moments
- `secondary`: midnight blue for authority, dark surfaces, and dense framing
- `surface`: cold white with subtly tinted neutrals, never flat pure gray sludge
- `accent`: restrained aqua highlight for supportive emphasis, not for primary CTA overload
- `success`, `warning`, `danger`: clear semantic states with sober saturation

Rules:

- Prefer semantic variables over raw literals inside components.
- New tokens should be authored in OKLCH, even if legacy code still contains hex values.
- Do not introduce purple-blue startup gradients.
- Do not expand the hue set beyond the existing teal, cool neutral, and semantic companions.

## 3. Typography Rules

Typography should separate personality from legibility.

- Display font: `Cabinet Grotesk` for major headings, landing hero moments, and campaign-level statements
- Body font: `IBM Plex Sans` for interface copy, tables, forms, and dense operational screens
- Mono font: `IBM Plex Mono` for IDs, timestamps, code-like metadata, or audit surfaces

Current implementation note:

The repo still uses `Inter` globally. Treat that as legacy body typography, not the future display direction. Do not spread `Inter` into new headline systems or polished marketing redesigns.

Product UI uses a fixed type scale. Large expressive fluid typography is acceptable only on public marketing surfaces where it improves hierarchy without weakening clarity.

## 4. Component Styling

Buttons should feel deliberate and trustworthy:

- Primary buttons: solid teal, strong label weight, clean focus treatment
- Secondary buttons: outline or pale-surface treatment with clear hover contrast
- Destructive actions: explicit and sparing

Cards should be functional containers, not decorative nesting dolls. A page may use one structural card level and one highlighted inset state, but repeated card-within-card composition should be avoided.

Forms should feel sturdy:

- strong labels
- visible validation
- obvious active states
- enough spacing for speed, not luxury emptiness

Tables, lists, and schedule surfaces should reward scanning before they reward spectacle.

## 5. Layout Principles

Use a 4px base grid. Product layouts should be left-anchored, information-forward, and comfortable under real staff use. Dense does not mean cramped; it means intentional.

Defaults:

- Mobile horizontal padding: `16px`
- Tablet horizontal padding: `24px`
- Desktop application content width: `1200px` max, with exceptions for operational layouts
- Wider marketing sections may stretch to `1440px`

Use CSS Grid for complex page structure and Flexbox for local alignment. Avoid making every page feel identical through copy-pasted container classes. Public pages can introduce asymmetry where it improves rhythm or drama.

## 6. Depth & Elevation

Depth should be economical. Most surfaces should rely on contrast, border, and spacing before shadow.

- Base cards: hairline border plus subtle shadow
- Floating panels and modals: stronger separation, not cartoon blur
- Active or selected states: use color and border reinforcement before adding more shadow

Do not put glow, heavy blur, or oversized shadow on every interactive element. Clinical software should feel crisp, not inflated.

## 7. Motion & Animation

Motion exists to orient, confirm, and reduce ambiguity.

Use the existing `framer-motion` dependency in this repo for animated UI. New motion should follow:

- entrances: vertical reveal or light fade-up for grouped content
- state change: fast, clear, low-distance transitions
- hover: restrained lift or emphasis, not constant scale theatrics

Rules:

- Respect `prefers-reduced-motion`
- Avoid `transition-all` as a blanket habit
- Avoid repeated `scale(1.05)` hover behavior across the whole interface
- Use motion most sparingly on staff pages and more expressively on public surfaces

## 8. Do's and Don'ts

Do:

- Reflect the single-clinic, multi-doctor model truthfully
- Build confidence through clarity, not hype
- Use stronger type hierarchy before adding more decoration
- Improve shared primitives when patterns repeat
- Let dashboard pages feel operational rather than promotional

Don't:

- Invent fake clinic scale, fake logos, fake countries, or fake AI features
- Default to six identical marketing cards
- Center every section by habit
- Stack decorative cards inside decorative cards
- Use purple gradients, rainbow text, or startup-fintech tropes
- Turn healthcare workflows into novelty interactions

## 9. Accessibility Notes

The minimum bar is WCAG 2.2 AA.

- Normal text contrast: `4.5:1`
- Large text contrast: `3:1`
- Controls and focus indicators: `3:1`

Interaction rules:

- every interactive element must have a visible focus state
- status cannot rely on color alone
- keyboard users must be able to complete booking, filtering, and form flows
- animations must degrade gracefully under reduced motion
- dark mode must preserve contrast and information hierarchy

When in doubt, choose the clearer and calmer option. In this product, trust is part of the design system.
