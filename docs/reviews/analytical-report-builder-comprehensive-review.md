# Analytical Report Builder — Comprehensive Code Review

**Date:** 2026-05-16
**Reviewer:** Agent (code-review-and-quality skill)
**Scope:** Report builder surface (ReportsPage, ReportViewerPage, ReportEditorPage, ChartRenderer, ChartErrorBoundary, analyticalReports service, analyticalReports schema, csv.js, reportLabels.js, FormField)
**Method:** Five-axis review (correctness, readability, architecture, security, performance) applied across UX, UI, Accessibility, and Features perspectives.
**Total findings:** 30 (7 Critical, 10 Important, 13 Nice-to-have)

---

## UX (User Experience)

### Critical

**UX-1. No unsaved-changes warning on Cancel / Back navigation**
*Files:* [`ReportEditorPage.jsx`](doctoleb/apps/clinic-ops/src/pages/ReportEditorPage.jsx:709) (Cancel button), [`ReportViewerPage.jsx`](doctoleb/apps/clinic-ops/src/pages/ReportViewerPage.jsx:320) (Back to library)
*Issue:* Both buttons call `navigate()` immediately with no confirmation dialog. A doctor who has spent 10 minutes building a report definition loses all work on one accidental click. The viewer's "← Back to library" is even more dangerous — it navigates away from a running report with no warning.
*Fix:* Add a `ConfirmDialog` (already imported in the viewer) that fires when `dirty` state is detected. Track dirty state by comparing current editor fields against the loaded definition. For the viewer, a simple "Leave this report?" confirmation suffices.

**UX-2. Auto-preview fires RPC on every state change with only 1.5s debounce**
*File:* [`ReportEditorPage.jsx`](doctoleb/apps/clinic-ops/src/pages/ReportEditorPage.jsx:357) (`triggerAutoPreview`)
*Issue:* The auto-preview effect (lines 388-392) watches 10 state variables and calls `run_analytical_report` RPC after a 1.5s debounce on every change. In a clinic with 10 doctors editing reports simultaneously, this creates sustained DB load. The debounce is too short for a database query — typical clinical datasets can take 2-5s per RPC call.
*Fix:* Increase debounce to 3-5s. Add a "preview throttle" that skips auto-preview if the previous preview is still running. Consider making auto-preview opt-in (a toggle checkbox) rather than always-on.

### Important

**UX-3. No loading/error feedback during auto-preview**
*File:* [`ReportEditorPage.jsx`](doctoleb/apps/clinic-ops/src/pages/ReportEditorPage.jsx:1069)
*Issue:* When auto-preview runs, only a tiny `animate-pulse` "Auto-refreshing…" label appears (line 1070). If the RPC takes 5+ seconds, the user has no progress indicator. The manual "Run now" button shows "Running…" but auto-preview provides minimal feedback.
*Fix:* Show the same loading state (skeleton or spinner) during auto-preview as during manual preview. Add a subtle progress bar or timer.

**UX-4. Filter strip uses raw `bind` key as label**
*File:* [`ReportViewerPage.jsx`](doctoleb/apps/clinic-ops/src/pages/ReportViewerPage.jsx:341)
*Issue:* `<FormField label={f.bind}>` renders the machine slug (e.g. `filter_1`, `doctor_id`) as the visible label. Doctors see "filter_1" instead of "Doctor" or "Status". The `bind` field is an identifier, not a human-readable name.
*Fix:* Resolve the label from the column metadata: `label={resolveColumnLabel(definition.dataSource, f.column)}`. Fall back to `f.bind` only if column metadata is unavailable.

**UX-5. No pagination on ReportsPage library**
*File:* [`ReportsPage.jsx`](doctoleb/apps/clinic-ops/src/pages/ReportsPage.jsx:59)
*Issue:* `pageSize: 100` is hardcoded. As the report catalog grows beyond 100 entries, older reports silently disappear. No "Load more" button or pagination controls are visible.
*Fix:* Add pagination controls (page number, next/prev) or infinite-scroll with a "Load more" button. Use the `apiPaged` count metadata already returned by the service.

**UX-6. CSV export uses raw column keys as headers**
*File:* [`csv.js`](doctoleb/packages/core/lib/csv.js:47), [`ReportViewerPage.jsx`](doctoleb/apps/clinic-ops/src/pages/ReportViewerPage.jsx:214)
*Issue:* `toCsv(rows)` builds headers from `Object.keys(row)` — raw database keys like `doctor_id`, `count`, `total_amount`. The viewer shows friendly labels via `labelMap`, but the CSV export bypasses it entirely. A doctor downloading "Appointments by Doctor" gets `doctor_id,count` instead of `Doctor,Count`.
*Fix:* Add a `headerMap` parameter to `toCsv`: `toCsv(rows, headerMap)`. When provided, replace raw keys with mapped labels in the header row. The viewer can pass `buildColumnLabelMap(definition)` as the header map.

### Nice-to-have

**UX-7. No report duplication from the library**
*File:* [`ReportsPage.jsx`](doctoleb/apps/clinic-ops/src/pages/ReportsPage.jsx:161)
*Issue:* Report cards only navigate to the viewer. To duplicate, a doctor must: open report → click Edit → click "Save as copy" (3 clicks). Duplication is a common operation for customizing built-in reports.
*Fix:* Add a "Duplicate" action on each card (icon button or context menu). Call `analyticalReportService.create` + `publishNewVersion` with the existing definition.

**UX-8. Quick-start templates don't show preview or description**
*File:* [`ReportEditorPage.jsx`](doctoleb/apps/clinic-ops/src/pages/ReportEditorPage.jsx:686)
*Issue:* Template buttons are plain text labels. No description of what the template produces, no mini chart thumbnail. The doctor clicks blindly and must wait for auto-preview to see the result.
*Fix:* Add a `description` field to each `QUICK_START_TEMPLATES` entry. Render it as a subtitle below the label. Optionally show a static mini-chart icon representing the viz type.

---

## UI (Visual / Layout)

### Critical

**UI-1. Print CSS injected via inline `<style>` tag**
*File:* [`ReportViewerPage.jsx`](doctoleb/apps/clinic-ops/src/pages/ReportViewerPage.jsx:265)
*Issue:* A `<style>` tag with `@media print` rules is injected directly into component JSX. This is fragile (conflicts with other print styles on the page), not theme-aware, bypasses the project's PostCSS/Tailwind architecture, and duplicates if the component mounts/unmounts.
*Fix:* Move print styles to a dedicated CSS file (e.g. `packages/ui/styles/print-report.css`) and import it at the module level. Alternatively, use Tailwind's `@media print` utilities with proper class composition.

### Important

**UI-2. No responsive chart height**
*File:* [`ChartRenderer.jsx`](doctoleb/packages/ui/components/ui/ChartRenderer.jsx:220) (BarViz), line 278 (LineViz), line 337 (PieViz)
*Issue:* All chart types use `height={320}` inside `ResponsiveContainer`. On mobile screens (320-400px viewport), 320px chart height dominates the viewport. On large desktop monitors, 320px is cramped for detailed data.
*Fix:* Make height responsive: use a CSS-based approach (e.g. `min-height: 280px; height: clamp(280px, 40vh, 480px)`), or pass `height` as a prop with a sensible default that adapts to viewport width.

**UI-3. KPI card doesn't format numbers**
*File:* [`ChartRenderer.jsx`](doctoleb/packages/ui/components/ui/ChartRenderer.jsx:127)
*Issue:* `{value == null ? '—' : String(value)}` renders raw numbers. A "Total revenue" KPI shows `45678.5` instead of `$45,678.50`. No locale-aware formatting, no currency symbols, no unit suffixes, no significant-digit rounding.
*Fix:* Add a `formatKpiValue(value, definition)` helper that applies locale-aware `Intl.NumberFormat` based on the aggregation type and column metadata. For `sum` on `amount`, format as currency. For `avg`, format with 2 decimal places. For `count`, format as integer.

**UI-4. Pie chart labels overlap with many slices**
*File:* [`ChartRenderer.jsx`](doctoleb/packages/ui/components/ui/ChartRenderer.jsx:344)
*Issue:* The label function concatenates `name + percentage`. With 15+ slices (common for "Top diagnoses"), labels collide and become unreadable. Recharts doesn't auto-avoid collisions.
*Fix:* When `rows.length > 8`, switch to an external legend with no inline labels (or truncate labels to 15 chars). For ≤8 slices, keep inline labels. Add a `maxSlices` prop or auto-detect.

**UI-5. No visual distinction between default and custom reports**
*File:* [`ReportsPage.jsx`](doctoleb/apps/clinic-ops/src/pages/ReportsPage.jsx:170)
*Issue:* Default reports get a tiny `text-[10px]` "Built-in" badge. Custom reports have no badge at all. There's no visual hierarchy distinguishing "reports I created" from "reports that came with the system".
*Fix:* Add a distinct visual treatment: default reports get a subtle gradient or icon prefix; custom reports show an "My report" badge or the creator's avatar. Use different card border colors.

### Nice-to-have

**UI-6. No dark-mode support for charts**
*File:* [`ChartRenderer.jsx`](doctoleb/packages/ui/components/ui/ChartRenderer.jsx:222)
*Issue:* Hardcoded colors: `stroke="#e2e8f0"` for grid, `stroke="#64748b"` for axes, `fill` styles on labels. In dark mode, these light-slate values are invisible against a dark background.
*Fix:* Read theme from `ThemeContext` or CSS custom properties. Map chart primitives to theme-aware tokens: grid → `border-muted`, axis text → `text-muted-foreground`.

**UI-7. No chart animation configuration**
*File:* [`ChartRenderer.jsx`](doctoleb/packages/ui/components/ui/ChartRenderer.jsx:241)
*Issue:* Recharts supports `isAnimationActive` and `animationDuration` props on `Bar`, `Line`, `Pie`. ChartRenderer doesn't configure these. On large datasets (>100 rows), default animations cause jank. On small datasets, animations are a nice polish opportunity missed.
*Fix:* Set `isAnimationActive={rows.length <= 100}` and `animationDuration={400}` on all chart primitives. Disable animation for large datasets to avoid jank.

---

## Accessibility (WCAG / ARIA)

### Critical

**A11y-1. Report table has no accessible caption or summary**
*File:* [`ChartRenderer.jsx`](doctoleb/packages/ui/components/ui/ChartRenderer.jsx:142)
*Issue:* The `<table>` element in `ReportTable` has no `<caption>`, no `summary`, and no `aria-label`. Screen readers announce "table" with no context about what data it contains. WCAG 1.3.1 (Info and Relationships) and 4.1.2 (Name, Role, Value) require table purpose to be identifiable.
*Fix:* Add a `<caption>` element derived from the report definition: `<caption>{definition.header.title} — detail rows</caption>`. Alternatively, add `aria-label` on the `<table>` element.

**A11y-2. Drill-down buttons lack discernible accessible names**
*File:* [`ChartRenderer.jsx`](doctoleb/packages/ui/components/ui/ChartRenderer.jsx:167)
*Issue:* The drill-down `<button>` in table cells has visible text equal to the cell value (e.g. "Dr. Smith"). The `title` attribute provides context ("Drill down on Doctor: Dr. Smith") but `title` is not reliably read by all screen readers and is not a substitute for `aria-label`. WCAG 4.1.2 requires the accessible name to describe the action.
*Fix:* Add `aria-label={`Drill down on ${labelMap?.[c] || c}: ${cellValue}`}` to the button. Remove reliance on `title` for accessible name.

### Important

**A11y-3. Category filter pills have no ARIA role/state**
*File:* [`ReportsPage.jsx`](doctoleb/apps/clinic-ops/src/pages/ReportsPage.jsx:106)
*Issue:* The category filter buttons are plain `<button>` elements with no `role="tab"`, no `aria-selected`, and the container has no `role="tablist"`. Screen readers announce these as a sequence of unrelated buttons, not as a filter/tab group.
*Fix:* Wrap the container in `role="tablist" aria-label="Report category filter"`. Add `role="tab"` and `aria-selected={activeCategory === cat}` to each button. Add `role="tabpanel"` to the results section.

**A11y-4. FormField `name` prop is often missing, breaking label association**
*File:* [`FormField.jsx`](doctoleb/packages/ui/components/ui/FormField.jsx:27), [`ReportEditorPage.jsx`](doctoleb/apps/clinic-ops/src/pages/ReportEditorPage.jsx:758)
*Issue:* `FormField` generates `id` from `name` (`const id = field-${name}`). In ReportEditorPage, many FormField usages don't pass `name` — e.g. line 758 `<FormField label="Report name" value={name} onChange={setName}>`. When `name` is undefined, `id` becomes `field-undefined`, breaking `<label htmlFor>` and `aria-describedby` error linking. Multiple fields share the same broken ID.
*Fix:* Always pass `name` to FormField. If `name` is not provided, generate a unique ID via `useId()` (React 18+) or a counter. Add a dev-only warning when `name` is missing.

**A11y-5. No skip-link or focus management for report viewer**
*File:* [`ReportViewerPage.jsx`](doctoleb/apps/clinic-ops/src/pages/ReportViewerPage.jsx:262)
*Issue:* When the report loads and auto-runs, focus stays at the page level. Keyboard users must tab through the entire header, filter strip, and action buttons before reaching the chart. Long pages with multiple regions need skip-navigation links.
*Fix:* Add skip-link anchors: "Skip to chart", "Skip to detail table", "Skip to filters". Place them at the top of the page, hidden until focused.

**A11y-6. Step progress indicator lacks click navigation on completed steps**
*File:* [`ReportEditorPage.jsx`](doctoleb/apps/clinic-ops/src/pages/ReportEditorPage.jsx:213)
*Issue:* `StepProgress` shows completed steps with a checkmark but they're not clickable or keyboard-navigable. A doctor who wants to jump back to step 2 must scroll down. The `role="navigation"` was added but the steps themselves aren't links.
*Fix:* Make completed steps into `<a>` or `<button>` elements with `onClick` that scrolls to the corresponding section. Add `aria-label={`Go to step ${i+1}: ${s.label}`}`.

### Nice-to-have

**A11y-7. No `aria-live` region for run status announcements**
*File:* [`ReportViewerPage.jsx`](doctoleb/apps/clinic-ops/src/pages/ReportViewerPage.jsx:412)
*Issue:* When a report run completes (loading → results) or fails (loading → error), the status change isn't announced to screen readers. The chart container has `role="region"` but no `aria-live`.
*Fix:* Add `aria-live="polite"` to the chart region div. When rows load, set a brief status message: "Report loaded with {rows.length} results." When error occurs, the existing error div already has visual content but needs `role="alert"` (it currently has no ARIA role).

---

## Features (Functional Gaps)

### Critical

**FEAT-1. `publishNewVersion` has a race condition with no retry**
*File:* [`analyticalReports.js`](doctoleb/packages/core/services/analyticalReports.js:258)
*Issue:* The method: (1) reads latest version_number, (2) supersedes current version, (3) inserts new version. Between step 2 and 3, the report has no current version. Two concurrent saves both read the same `version_number` and try to insert version N+1 — one fails on the unique index. The code comment (lines 252-256) acknowledges this but provides no retry or recovery mechanism.
*Fix:* Wrap the three-step sequence in a database transaction via an RPC (`publish_report_version`) that atomically supersedes + inserts. Short-term: add a client-side retry (up to 3 attempts with exponential backoff) on unique-constraint violation.

**FEAT-2. No date-range filter UI for timestamp columns**
*File:* [`ReportEditorPage.jsx`](doctoleb/apps/clinic-ops/src/pages/ReportEditorPage.jsx:966)
*Issue:* The schema supports `gt/gte/lt/lte` operators on timestamp columns, but the editor's filter value input is a plain text field. A doctor filtering "appointments after June 1" must type a raw ISO date string like `2026-06-01` or `2026-06-01T00:00:00Z`. No date picker, no calendar widget, no relative date shortcuts.
*Fix:* When the column type is `timestamp` or `date`, render a `<input type="date">` or a calendar picker component. For `gt/gte/lt/lte` operators on timestamps, show two date inputs for range filters. Add relative date shortcuts ("Today", "This week", "This month").

### Important

**FEAT-3. No report sharing or ownership transfer**
*Files:* [`analyticalReports.js`](doctoleb/packages/core/services/analyticalReports.js:137) (create), [`ReportsPage.jsx`](doctoleb/apps/clinic-ops/src/pages/ReportsPage.jsx:45)
*Issue:* Reports are scoped by `audience` (staff/doctor/admin/public_safe) but there's no mechanism to share a specific report with a specific colleague, or to transfer ownership when a doctor leaves the clinic. `created_by` is set once and never changeable.
*Fix:* Add a `share` method to the service that creates a `report_shares` table entry (report_id, shared_with_user_id, permission_level). Add a "Share" button on the viewer. For ownership transfer, add an `transferOwnership` service method gated to admins.

**FEAT-4. No scheduled/automated report runs**
*File:* [`analyticalReports.js`](doctoleb/packages/core/services/analyticalReports.js:308)
*Issue:* Reports are purely on-demand. There's no "run this report every Monday at 8am" or "email me this report weekly" feature. The `analytical_report_runs` table tracks runs but has no scheduling fields.
*Fix:* Add a `schedule` field to the report metadata (cron expression, next_run_at, timezone). Add an Edge Function that runs scheduled reports and stores results. Add a "Schedule" tab in the viewer/editor.

**FEAT-5. No report version history browser**
*File:* [`analyticalReports.js`](doctoleb/packages/core/services/analyticalReports.js:199)
*Issue:* The service has `listVersions` but neither the viewer nor editor surfaces version history. A doctor can't see what changed between v1 and v2, can't roll back, and can't compare versions. Every edit creates a new version but the old ones are invisible.
*Fix:* Add a "Version history" panel in the viewer (collapsible section below recent runs). Show version number, date, author, and a diff summary. Add "View this version" and "Restore this version" actions (restore = publish a new version with the old definition).

**FEAT-6. No PDF export for reports**
*File:* [`ReportViewerPage.jsx`](doctoleb/apps/clinic-ops/src/pages/ReportViewerPage.jsx:290)
*Issue:* The document engine has a full PDF pipeline (Edge Function + pdfA compliance), but reports only offer CSV export and browser Print. Browser Print produces unstyled, inconsistent output. A proper PDF with the report title, chart image, and detail table would be valuable for clinical compliance and sharing.
*Fix:* Add a "Export PDF" button that calls a new Edge Function (`render-analytical-report-pdf`) or reuses the existing PDF pipeline with a report-specific template. The PDF should include: report title, chart as embedded SVG/image, detail table, run timestamp, and tenant branding.

### Nice-to-have

**FEAT-7. No relative date filter shortcuts**
*File:* [`ReportEditorPage.jsx`](doctoleb/apps/clinic-ops/src/pages/ReportEditorPage.jsx:966)
*Issue:* Even with a date picker (FEAT-2), there are no shortcuts for the most common clinical time ranges: "Today", "This week", "This month", "Last 30 days", "This quarter", "This year". These account for 80% of date filter usage in clinical settings.
*Fix:* Add a "Quick dates" dropdown next to the date picker. Each shortcut computes the appropriate ISO date for the operator (e.g. "This month" → `gte: startOfMonth, lt: startOfNextMonth`).

**FEAT-8. No chart data comparison (overlay two periods)**
*File:* [`ChartRenderer.jsx`](doctoleb/packages/ui/components/ui/ChartRenderer.jsx:374)
*Issue:* The schema supports multiple aggregations, but there's no way to overlay "this month vs last month" on the same chart. Period-over-period comparison is the single most requested feature in clinical analytics.
*Fix:* Add a `comparison` field to the definition schema: `{ period: 'previous_period' | 'same_period_last_year', offset: number }`. The compiler runs two queries and merges results into a dual-series dataset. ChartRenderer renders both series with distinct colors and a legend entry.

---

## Summary Matrix

| ID | Category | Priority | One-line summary |
|----|----------|----------|-----------------|
| UX-1 | UX | Critical | No unsaved-changes warning on Cancel/Back |
| UX-2 | UX | Critical | Auto-preview fires RPC every 1.5s debounce |
| UX-3 | UX | Important | No loading feedback during auto-preview |
| UX-4 | UX | Important | Filter strip uses raw bind key as label |
| UX-5 | UX | Important | No pagination on ReportsPage |
| UX-6 | UX | Important | CSV export uses raw column keys as headers |
| UX-7 | UX | Nice-to-have | No report duplication from library |
| UX-8 | UX | Nice-to-have | Quick-start templates lack preview/description |
| UI-1 | UI | Critical | Print CSS injected via inline `<style>` tag |
| UI-2 | UI | Important | No responsive chart height |
| UI-3 | UI | Important | KPI card doesn't format numbers |
| UI-4 | UI | Important | Pie chart labels overlap with many slices |
| UI-5 | UI | Important | No visual distinction for default vs custom reports |
| UI-6 | UI | Nice-to-have | No dark-mode support for charts |
| UI-7 | UI | Nice-to-have | No chart animation configuration |
| A11y-1 | Accessibility | Critical | Report table has no accessible caption |
| A11y-2 | Accessibility | Critical | Drill-down buttons lack discernible accessible names |
| A11y-3 | Accessibility | Important | Category filter pills have no ARIA role/state |
| A11y-4 | Accessibility | Important | FormField `name` prop often missing, breaks label association |
| A11y-5 | Accessibility | Important | No skip-link or focus management for report viewer |
| A11y-6 | Accessibility | Important | Step progress lacks click navigation on completed steps |
| A11y-7 | Accessibility | Nice-to-have | No `aria-live` region for run status announcements |
| FEAT-1 | Features | Critical | `publishNewVersion` race condition with no retry |
| FEAT-2 | Features | Critical | No date-range filter UI for timestamp columns |
| FEAT-3 | Features | Important | No report sharing or ownership transfer |
| FEAT-4 | Features | Important | No scheduled/automated report runs |
| FEAT-5 | Features | Important | No report version history browser |
| FEAT-6 | Features | Important | No PDF export for reports |
| FEAT-7 | Features | Nice-to-have | No relative date filter shortcuts |
| FEAT-8 | Features | Nice-to-have | No chart data comparison (overlay two periods) |

**Critical count:** 7 (UX-1, UX-2, UI-1, A11y-1, A11y-2, FEAT-1, FEAT-2)
**Important count:** 10 (UX-3–UX-6, UI-2–UI-5, A11y-3–A11y-6, FEAT-3–FEAT-6)
**Nice-to-have count:** 13 (UX-7–UX-8, UI-6–UI-7, A11y-7, FEAT-7–FEAT-8)

---

## Recommended Fix Order (Critical first)

1. **FEAT-1** — Race condition in `publishNewVersion` (data integrity risk)
2. **A11y-1** — Table caption (WCAG compliance, quick fix)
3. **A11y-2** — Drill-down button aria-labels (WCAG compliance, quick fix)
4. **UX-1** — Unsaved-changes confirmation (data loss risk)
5. **UI-1** — Move print CSS to proper file (architecture hygiene)
6. **UX-2** — Increase auto-preview debounce + throttle (DB load risk)
7. **FEAT-2** — Date picker for timestamp filters (major UX gap)
8. Then proceed through Important findings in dependency order