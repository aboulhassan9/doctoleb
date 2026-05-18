# Stitch Project Analysis: DoctoLeb Tactile Patient Sanctuary

Project: `projects/9966518933119406027`
Title: `DoctoLeb: Tactile Patient Sanctuary`
Fetched via Stitch MCP on 2026-05-18.

## Retrieved Assets

All available screen screenshots and generated HTML were downloaded locally.

- Visible screens: 9
- Hidden screens: 3
- Desktop pages: 10
- Mobile pages: 2
- Design-system instance: 1, present in project metadata but not treated as an app page

Primary folder:

- `G:\project\doctoleb\docs\stitch-analysis\9966518933119406027`

Hidden screen folder:

- `G:\project\doctoleb\docs\stitch-analysis\9966518933119406027\hidden`

## Page Inventory

| # | Type | Title | Notes |
|---|---|---|---|
| 1 | Desktop | Digital Front Door & Data Vault | Entry/login, identity link, biometrics, data-vault explanation |
| 2 | Desktop | Ambient Narrative Dashboard | Patient dashboard with next visit, vitals, sidebar |
| 3 | Mobile | Care Timeline & Contextual Messaging | Medication/refill and patient message flow |
| 4 | Desktop | Clinical Synthesis & Timeline | Clinical trends and archived formulary surface |
| 5 | Desktop | Detailed Hybrid Care Navigation | Care intent, available windows, active sanctuary |
| 6 | Desktop | Financial Sanctuary & Sovereign Payment | Billing/payment experience |
| 7 | Mobile | Hybrid Care Navigation | Mobile version of care scheduling/cancel flow |
| 8 | Desktop | Seek Care | Care-seeking and appointment slot selection |
| 9 | Desktop | Clinical Identity Registration | Patient registration identity form |
| H1 | Desktop Hidden | Initial Intake & Intent | Alternate registration/intake concept |
| H2 | Desktop Hidden | Care Timeline & Contextual Messaging | Expanded desktop timeline/message flow |
| H3 | Desktop Hidden | Hybrid Care Navigation | Alternate desktop care-navigation concept |

## Overall Read

This Stitch project has a coherent patient-facing art direction: warm parchment surfaces, sage/clay accents, Newsreader headings, Fira Sans body text, slow tactile interactions, and an intentional "calm healthcare" mood. It is much stronger visually than the current generic marketing surfaces in the app.

The strongest value is not the generated code. The strongest value is the interaction thesis: patient care as a guided narrative, not a pile of forms. The timeline, contextual messaging, appointment intent, and payment confirmation patterns are worth mining.

## What Works

- The visual system is memorable. It avoids the default blue-white clinic dashboard look and gives the patient portal a distinct atmosphere.
- The screens form a credible patient journey: identity, dashboard, timeline, care request, payment, clinical synthesis.
- The sidebar/bottom-nav split gives a recognizable desktop/mobile navigation model.
- The patient timeline and contextual message cards are the best concepts. They turn passive medical history into a useful, conversational care surface.
- The billing screen feels calmer than a normal invoice page and could reduce anxiety around payments.
- The mobile care timeline has a clear progression and a useful bottom navigation pattern.

## Critical Fit Issues

### Brand Mismatch

Several generated pages use `Aetheris Health`, not `DoctoLeb`. This must not ship. The name, tone, and copy should be rewritten into the real DoctoLeb single-clinic product model.

### Product Scope Mismatch

The Stitch project is almost entirely patient-facing. DoctoLeb is a clinic management SPA with patient, doctor, predoctor, secretary, and admin roles. These screens can guide the patient app and public surfaces, but they do not solve the operational staff dashboards.

### Design Contract Conflict

The Stitch design system is `Organic Calm`: parchment, sage, clay, Newsreader, Fira Sans, high warmth, tactile minimalism.

The repo design docs currently define DoctoLeb as `Industrial/Utilitarian with clinical calm`: teal, cool neutrals, denser app surfaces, operational clarity.

Recommendation: use Stitch as a patient-facing subtheme inspiration, not the global product design system unless the team explicitly chooses a full rebrand.

### Copy Tone Risk

Terms like `sanctuary`, `sovereign`, `presence`, `threads`, and `data vault` create atmosphere, but they may reduce clarity in a real clinical product. For production, keep the warmth but translate copy into operational healthcare language.

Example direction:

- `Sanctuary` -> `Care`
- `Presence` -> `Overview`
- `Threads` -> `History`
- `Sovereign Payment` -> `Payment`
- `Data Vault` -> `Health Records`

## Accessibility And UX Risks

- Many controls have no visible labels or ARIA support in the generated HTML.
- Icon-only controls are often unlabeled.
- Some low-contrast helper text and placeholders are too faint.
- Slide-to-cancel/payment patterns are visually interesting but risky for keyboard and assistive-tech users unless rebuilt with accessible state and fallback buttons.
- Several pages rely on small body text inside large quiet layouts; this may be hard to scan quickly.
- Mobile screens have bottom navigation, fixed headers, and long content; safe-area padding and scroll/focus management need real device testing.

## Implementation Risks

The downloaded HTML should not be dropped directly into the React app.

Observed from HTML:

- Standalone generated HTML, not app-integrated React components
- Heavy use of fixed and absolute positioning
- Google Fonts loaded per screen
- Many `transition-all` patterns
- Many large radii such as `rounded-2xl`, `rounded-[2rem]`, and `rounded-full`
- Limited accessibility attributes
- Prototype-only dummy content

Use these files as design references. Rebuild patterns using existing React, routing, auth, Supabase services, and shared DoctoLeb layout conventions.

## Page-Level Notes

### Digital Front Door & Data Vault

Strong first impression and clean authentication framing. The data-vault explanation helps trust, but the page is too abstract for DoctoLeb. Production should say what actually happens: login, booking, records access, privacy.

### Ambient Narrative Dashboard

Best candidate for a patient dashboard redesign. The narrative greeting and next-visit card are strong. Needs more explicit appointment actions and real patient status states.

### Care Timeline & Contextual Messaging

The strongest interaction pattern. Medication, symptoms, triage routing, and nurse response are organized as a living timeline. This could become a patient history/messages surface if tied to real services.

### Clinical Synthesis & Timeline

Elegant, but too sparse for clinician-facing work. Good for patient-readable summaries, not doctor dashboards. Clinical graphs need real units, ranges, dates, and accessibility labels.

### Detailed Hybrid Care Navigation

Good structure for guided appointment booking. The "intention for care" pattern is useful. Needs clearer labels, actual triage states, and a less poetic vocabulary.

### Financial Sanctuary & Sovereign Payment

Visually polished billing concept. The calm payment flow is useful, but `sovereign` and `sanctuary` should be rewritten. Payment controls need explicit confirmation, receipts, failure states, and accessibility.

### Hybrid Care Navigation Mobile

Good mobile adaptation, but too long and vertically sparse. It needs stronger hierarchy, sticky action safety, and clear cancellation alternatives.

### Seek Care

Clear care-request flow with appointment windows. This is a strong basis for patient booking, especially if connected to the existing slot service. Needs better doctor/clinic selection and reason capture.

### Clinical Identity Registration

Simple and elegant, but too minimal for real registration. DoctoLeb needs required account fields, consent, validation, error states, and role constraints.

### Hidden: Initial Intake & Intent

Beautiful editorial form concept, but insufficiently explicit for medical intake. Useful as tone inspiration, not as production form structure.

### Hidden: Desktop Care Timeline

The richest desktop timeline concept. The medication card and routed nurse response are worth preserving. Needs simplified copy and clearer action priority.

### Hidden: Desktop Hybrid Care Navigation

Good layout density compared with the visible version. This is likely the best desktop reference for rebuilding guided booking.

## Recommended Use In DoctoLeb

Use Stitch for:

- patient dashboard mood
- patient timeline/message flow
- guided booking flow
- billing visual calm
- patient-facing registration tone

Do not use Stitch for:

- doctor dashboards
- secretary scheduling operations
- predoctor triage operations
- global brand replacement without explicit approval
- direct HTML import

## Implementation Direction

1. Keep the current backend/API plan unchanged.
2. Extract visual ideas only where UI work overlaps the plan.
3. Rebuild in React using existing routes, services, auth, and layout components.
4. Translate `Aetheris Health` and poetic vocabulary into DoctoLeb product language.
5. Preserve the strongest interaction patterns: timeline, next visit, contextual triage, appointment windows.
6. Align production tokens with `DESIGN.md` unless the user explicitly chooses the Stitch theme as the new brand.
7. Verify every rebuilt screen with keyboard navigation, mobile viewport, desktop viewport, and real data states.

## Bottom Line

The Stitch work is valuable as a patient-experience concept deck. It is not ready production UI, and it should not override the current DoctoLeb architecture or implementation plan. The best path is selective extraction: borrow the care journey, timeline, booking, and calm billing patterns, then rebuild them inside the existing DoctoLeb system with clearer clinical copy and production accessibility.
