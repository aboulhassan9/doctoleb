# DoctoLeb PDF Export — Quality Specification

| | |
|---|---|
| **Status** | LOCKED — v2 of the plan |
| **Version** | 1.0.0 (2026-05-15) |
| **Parent** | [`clinical-documents-and-medication-catalog.md`](../plans/clinical-documents-and-medication-catalog.md) |
| **Scope** | Every PDF DoctoLeb generates: referrals, medical reports, certificates, lab requests, prescriptions, future custom documents |
| **Audience** | Engineers implementing slice 4; reviewers verifying acceptance |

This document defines what a "best-in-class exportable clinical document" means at DoctoLeb. It is the contract for the `render-clinical-document` Edge Function. If a generated PDF fails any of these requirements, the slice is rejected.

The plan's executive summary in `clinical-documents-and-medication-catalog.md § 8` is the management view. **This document is the engineering view.**

---

## 1. North star

A doctor opens their generated PDF in any major reader (Adobe Acrobat, Apple Preview, Chrome, Firefox, on phone, on a tablet, on a printer in their clinic, archived for 10 years). The document:

- **Looks like it came from their clinic.** Not a generic template.
- **Reads correctly.** Body text legible at 100% zoom; selectable, searchable, copy-pasteable.
- **Survives time.** Self-contained — fonts embedded, no external dependencies.
- **Survives audit.** Embedded metadata proves who issued it, when, against what template version.
- **Is accessible.** A screen reader can navigate it. A low-vision patient can copy the text into their preferred reader.
- **Is verifiable.** A QR code links to a verification page (forward-compat in v1; live later).

Anything that doesn't serve those five goals is a feature for v2.

---

## 2. Standards we conform to

| Standard | What it gives us | Where it applies |
|---|---|---|
| **PDF 1.7** (ISO 32000-1) | Baseline. Any PDF reader. | Every output |
| **PDF/A-2b** (ISO 19005-2) | Archival quality — fonts embedded, no transparency-only content, sRGB color profile, no external deps | `referral`, `report`, `certificate` templates (mandatory). Optional for `lab_request`, `prescription` (allowed if it fits — usually does) |
| **PDF/UA** (ISO 14289) | Tagged PDF for screen readers — headings, paragraphs, lists, tables marked with semantic roles | Every output, "Best Effort" tier in v1 (full conformance in v2) |
| **WCAG 2.2 AA** | Color contrast (4.5:1 normal text, 3:1 large), focus order, alternative text | Every output |
| **Unicode (NFC normalization)** | All text encoded as NFC; ensures Arabic/French diacritics survive copy-paste | Every output |
| **sRGB IEC61966-2.1** | Color profile embedded | Every output |

**What we deliberately do NOT conform to in v1:** PDF/X (print press), PDF/A-3 (with embedded source files), PAdES (digital signatures), PDF Forms (AcroForm/XFA). These are v2+ topics.

---

## 3. Typography — the type system

**Fonts (v1):** `Helvetica` and `Helvetica-Bold` via `pdf-lib`'s `StandardFonts`. These are the 14 standard PDF fonts; readers don't need to embed them and the bytes stay tiny. v2 will switch to **Inter** (subset, embedded) for brand cohesion with the web UI.

**Type scale:**

| Role | Size (pt) | Weight | Color | Tracking |
|---|---|---|---|---|
| Clinic name (header) | 22 | Bold | primary | 0 |
| Clinic tagline (header) | 10 | Regular | slate-500 | 0 |
| Document title | 16 | Bold | primary | 0 |
| Document type label | 11 | Bold UPPERCASE | slate-500 | +0.4 pt |
| Section title | 14 | Bold | primary | 0 |
| Section description | 9 | Regular italic | slate-500 | 0 |
| Field label | 10 | Regular | slate-700 | +0.2 pt |
| Field value | 11 | Regular | slate-900 | 0 |
| Signature label | 9 | Regular | slate-500 | 0 |
| Footer text | 9 | Regular | slate-500 | 0 |
| Watermark | 80 | Bold | slate-300 at 8% alpha | -0.5 pt |

**Line height:** all body text at 1.4× the font size. Section title at 1.25×.

**Justification:** left-aligned, never justified. Justified text gives ugly rivers in narrow columns.

**Hyphenation:** off. PDF text break opportunities are unreliable; break at word boundaries only.

---

## 4. Color system

**Source of brand colors:**
- `primary` ← `tenant_app_config.primary_color` if it matches `^#[0-9a-fA-F]{6}$`, else `#0f172a` (slate-900).
- `accent` ← `tenant_app_config.secondary_color` if valid hex, else `#38bdf8` (sky-400).

**Neutral palette (always these values, regardless of tenant brand):**

| Token | Hex | Use |
|---|---|---|
| `text-primary` | `#0f172a` | Body text |
| `text-secondary` | `#334155` | Labels |
| `text-tertiary` | `#64748b` | Footer, watermark |
| `divider` | `#cbd5e1` | Horizontal lines |
| `page` | `#ffffff` | Background — never overridden |

**Contrast rule:** every text-on-background combination must be ≥ 4.5:1 contrast against pure white. The renderer asserts this at startup; if a tenant's primary color violates it, the renderer logs a warning and falls back to `text-primary`.

**Color profile:** sRGB IEC61966-2.1, embedded. `pdf-lib` requires manual color profile embedding for PDF/A; the renderer does this in its bootstrap.

---

## 5. Page geometry

| Property | Value |
|---|---|
| Default size | A4 (595 × 842 pt) |
| Orientation | Portrait |
| Margins | 50 pt top/bottom, 60 pt left/right |
| Content area | 475 × 742 pt |
| Header band height | 60 pt |
| Footer band height | 30 pt |
| Auto-landscape trigger | Any section with a `checkbox_grid` field where the widest group has > 6 items |

**Why A4 and not Letter?** DoctoLeb's primary market is Lebanon (A4 default). Future: per-tenant override via `tenant_app_config.config.pdf_page_size`.

**Bleed:** none. We are not designing for press printing.

---

## 6. Layout — the page

```
┌────────────────────────────────────────────────────────────────┐ ─┐
│                                                                │  │
│  [logo 40pt]   {clinic.display_name}      {clinic.support_phone}│  │ 60pt
│                {clinic.tagline}           {clinic.support_email}│  │ header
│                                                                │  │ band
├──────────────────────────────────────────────────── primary ───┤ ─┘
│
│   {DOCUMENT TYPE LABEL}                  {short-id e.g. #A3F7B}
│
│   {Document title}                       {Date · timezone}
│
│   ─────────────────── divider ─────────────────────────────────
│
│
│   {Section 1 title}
│     {label}    {value or empty placeholder "—"}
│     {label}    {value}
│
│   {Section 2 title}
│     ...
│
│   (page break safety — see § 9)
│
│
│   _________________________  ← signature line
│   {Dr. doctor.full_name}
│   {doctor.specialization}  ·  License #{doctor.license_number}
│
│
├────────────────────────────────────────────────────────────────┤ ─┐
│  {clinic.display_name} · Page n of N             [QR 60×60]    │  │ 30pt
└────────────────────────────────────────────────────────────────┘ ─┘ footer
```

**Spacing rules:**

- 24pt gap below the header band before the document title.
- 18pt gap between sections.
- 6pt gap between fields within a section.
- 36pt gap above the signature block.

**Watermark:** behind everything else (drawn first), centered, rotated -35°, 8% opacity (or per § 7 below for status-based text).

---

## 7. Watermark — status-based

The watermark text and opacity depend on `clinical_documents.status`:

| Status | Text | Opacity | Notes |
|---|---|---|---|
| `draft` | "DRAFT — " + clinic.display_name | 8% | Both texts on one line, large rotated |
| `final` | clinic.display_name | 5% | Quiet, just a tasteful brand signal |
| `superseded` | "SUPERSEDED" | 10% | Above the brand name |
| `void` | "VOID" | 18% | Loud — must be unmistakable |

Watermark is a **text annotation, not a raster image.** Stays sharp at any zoom level and prints well.

---

## 8. QR verification

**Where:** bottom-right corner of the footer, 60 × 60 pt.

**What it encodes:**

```
https://verify.doctoleb.com/v1/{document-id-base32}
```

where `document-id-base32` is the `clinical_documents.id` UUID re-encoded in Crockford Base32 (lower-case, 26-char strings, no ambiguous characters like I/L/0/O).

**The verification endpoint (forward-compat in v1):**

A v1 client opening the URL sees:

> Verification for document …yz9. Issued by {clinic} on {date}. Coming soon: content hash verification.

The page reads the document id from the path, looks up the `clinical_documents` row, and returns the issued-by clinic + date. Content hash matching is v2+.

**Why it's worth shipping in v1:** every PDF generated today is verifiable tomorrow. Doing it later means a forklift retrofit of every PDF.

**QR encoding:**

- Error correction level: M (medium). Tolerates ~15% damage. Good for printed PDFs that might be photocopied.
- Margin: 4 modules (the QR standard "quiet zone").
- Rendering: pdf-lib has no native QR; the renderer uses a small Deno-compatible QR library (e.g. `qrcode-svg`) to produce SVG path data, then draws the path via `pdf-lib`'s `drawSvgPath`.

---

## 9. Page-break rules

| Block | Rule |
|---|---|
| Section | Keep-together if section is < 70% of full content area. Otherwise allowed to break, but only AFTER a field boundary, never mid-field. |
| Field with multi-line value | Allowed to break between lines, never mid-line. |
| Signature block | Always keep-together. If insufficient space, push to next page (even if it's mostly empty). |
| `checkbox_grid` section | Each group is keep-together. Groups can split across pages. |
| Header / footer | Re-rendered on every page. |
| Watermark | Re-rendered on every page. |

**Algorithm:** the renderer measures section height first (dry run), then walks pages and assigns sections to pages greedily, applying the rules above. If a single field can't fit on an entire page (extremely unlikely, but possible with a 5000-char free-text field), it splits at sentence boundaries with an indent on continuation lines.

---

## 10. PDF metadata

Every generated PDF MUST carry these in the `/Info` dictionary AND in XMP:

```
/Title           {clinical_documents.title}
/Author          {tenant_profile.display_name}
/Subject         {DOCUMENT_TYPE_LABELS[document_type]}
/Producer        DoctoLeb / pdf-lib 1.17.1
/Creator         DoctoLeb render-clinical-document v{API_VERSION}
/CreationDate    {ISO timestamp at render time, in UTC}
/ModDate         {same}
/Keywords        clinical, {document_type}, {tenant_slug}
```

XMP additions (custom namespace `doctoleb`):

```
doctoleb:tenant         {tenant_profile.tenant_slug}
doctoleb:templateId     {document_templates.id}
doctoleb:templateName   {document_templates.name}
doctoleb:renderedBy     {doctors.id of the requesting doctor}
doctoleb:encounterId    {encounters.id or null}
doctoleb:contentSha256  {hex SHA-256 of the rendered text canon}
doctoleb:apiVersion     {API_VERSION constant in the Edge Function}
```

**`contentSha256` definition:** the SHA-256 of a canonical string built by concatenating, in order:

```
{template_id}|{template_version}|
{section_1.title}|{section_1.field_1.key}={section_1.field_1.value}|...|
{section_2.title}|...
```

with each value normalized (NFC, trimmed, whitespace collapsed). This hash is the anchor for the future verification endpoint.

---

## 11. Hyperlinks

The renderer scans field values for these patterns and inserts clickable link annotations:

| Pattern | Annotation type | Target |
|---|---|---|
| `\+?[0-9][0-9\s().-]{6,20}` (phone) | `tel:` | The matched number, normalized |
| `\S+@\S+\.\S+` | `mailto:` | The matched address |
| `https?://\S+` | URI | The URL |

**Limits:**

- Max 5 link annotations per page (prevents abuse via a hyperlink-heavy template).
- Link annotation rectangles must be ≥ 12pt tall and ≥ 30pt wide for touch-target accessibility.
- Each link annotation gets a tooltip (`/Contents`) matching the visible text — screen readers announce it.

---

## 12. Storage path and bucket

**Bucket:** `clinical-documents` (per `STORAGE_BUCKETS.CLINICAL_DOCUMENTS`).

**Path:**

```
<tenant_slug>/<patient_id>/<yyyy>/<mm>/<template_type>-<unix_timestamp_ms>-<short_uuid>.pdf
```

| Segment | Format | Why |
|---|---|---|
| `tenant_slug` | lowercase alphanumeric + hyphens | Per-tenant isolation; matches `tenant_profile.tenant_slug` validation regex |
| `patient_id` | UUID | NO PII — never the patient name |
| `yyyy/mm` | 2026/05 | Date-range retention sweeps are trivial |
| `template_type` | matches the `document_templates.template_type` enum | Easy visual scan in Storage browser |
| `unix_timestamp_ms` | milliseconds | Sortable; collision resistance over 1 second window |
| `short_uuid` | first 8 chars of a uuid v4 | Extra collision protection if 2 renders land in same millisecond |

**Example:** `clinical-documents/assad/22222222-2222-4222-8222-222222222222/2026/05/referral-1747312800123-a4b1c8d9.pdf`

**Why this matters:**

- A leaked storage signed URL never reveals the patient's name.
- Audit queries by date range or template type are O(prefix-scan).
- Per-tenant retention policies (slice 10+) can do `where path like '<slug>/%'`.

---

## 13. Retention policy

v1: PDFs persist indefinitely. Archiving the `clinical_documents` row sets `is_archived = true` but DOES NOT delete the storage object. This is intentional — a doctor archiving a document does not mean they want the file gone.

v2: a scheduled job sweeps storage objects whose `clinical_documents` row has been archived for more than N days (default 90, per-tenant overridable). The job logs every deletion.

v3: per-document expiry policy (e.g. drafts auto-delete after 30 days).

---

## 14. Performance budget

| Phase | Budget |
|---|---|
| Edge Function cold start (handler + pdf-lib import) | < 1.5 s |
| Context load (tenant, encounter, diagnoses, prescriptions, template) | < 400 ms |
| Render (text + watermark + QR) | < 600 ms for a single-page document |
| Upload to storage | < 300 ms |
| Total p50 | < 800 ms |
| Total p95 | < 2.5 s |
| Output PDF size, single-page | < 200 KB |
| Output PDF size, longest lab request (3 pages) | < 1 MB |

**Optimization techniques used (none of which compromise quality):**

- Font subsetting: only include glyphs actually used in the document.
- Compressed content streams: pdf-lib does this by default.
- No raster images larger than 200 KB embedded (logos are limited via § 16).
- A single SVG QR path drawn via `drawSvgPath`, not a raster QR image.
- Cached embedded fonts and color profile across renders within a warm Edge Function lifetime.

---

## 15. Accessibility (PDF/UA "Best Effort" in v1)

v1 ships these accessibility features:

| Feature | How |
|---|---|
| Logical reading order | Content drawn top-to-bottom, left-to-right; PDF structure tree follows the same order |
| Tagged structure | Section titles tagged as `H2`, field labels as `Lbl`, field values as `LBody`, signature block as `Sect` |
| Language attribute | `/Lang` set to `tenant_profile.default_locale` (e.g. `en`) at the document level |
| Alt text on logos | `/Alt` = clinic display name when a logo image is embedded |
| Color independence | Information never conveyed by color alone — status conveyed by watermark TEXT, not background color |
| Contrast | Verified ≥ 4.5:1 for all body text |
| Hyperlinks announced | Link annotations have a `/Contents` matching the visible text |
| Form fields | v1 has no PDF AcroForm fields — the values are static text. v2+ may add form fields. |

**What v1 does NOT yet ship for PDF/UA:**

- Full role mapping for every drawing operator.
- `StructTreeRoot` integrity check.
- Reading-order verification via `axe-core`-equivalent for PDFs.

These are v2 work, tracked under SC-Accessibility-v2.

---

## 16. Logo embedding

**Source:** `tenant_app_config.splash_logo_url`. Must be a valid `https://` URL.

**Fetch rules:**

| Rule | Value |
|---|---|
| Protocol | `https://` only |
| Allowlist | Any host EXCEPT private/loopback ranges (10/8, 172.16/12, 192.168/16, 127/8, ::1) |
| Timeout | 8 seconds |
| Max byte size | 200 KB |
| Allowed MIME types | `image/png`, `image/jpeg`, `image/svg+xml` (SVG converted to path drawing) |
| On failure | Render WITHOUT logo. Log `clinical_document.logo_skipped` with reason. Never block the render. |

**Why so strict:** logo fetch is the only outbound network call the Edge Function makes. SSRF protection is non-negotiable.

---

## 17. Internationalization readiness

v1 ships English-only content. The data model is forward-compatible with Arabic and French:

| Forward-compat decision | Why |
|---|---|
| Text encoded as NFC | Arabic diacritics survive |
| Standard fonts embedded include Helvetica's Latin-1 subset only | v2 swaps in Inter or Noto Sans Arabic when locale is `ar` |
| `tenant_profile.default_locale` already exists and is set at render time as the document `/Lang` attribute | A future Arabic render path reads this and switches the font + flips text direction |
| `tenant_profile.timezone` formats `encounter.started_at` in the right tz (Lebanon = `Asia/Beirut`) | Same |

**v2 RTL plan (not in scope for this work):**

- Detect `default_locale.startsWith('ar')` and switch font family.
- Mirror the layout: header logo on the right, support contact on the left.
- Apply Unicode bidi algorithm to mixed-language text (e.g. an Arabic patient name in an English referral).

---

## 18. pdf-lib implementation guidance

Concrete patterns for the renderer module. Keep these in `supabase/functions/render-clinical-document/pdfRenderer.ts` and import them.

### 18.1. Document bootstrap

```ts
import { PDFDocument, StandardFonts, rgb, degrees } from 'https://esm.sh/pdf-lib@1.17.1'

export async function newDocument({ title, subject, tenant, doctor, templateId, contentHash }) {
  const pdf = await PDFDocument.create()
  pdf.setTitle(title)
  pdf.setAuthor(tenant.displayName)
  pdf.setSubject(subject)
  pdf.setProducer('DoctoLeb / pdf-lib 1.17.1')
  pdf.setCreator(`DoctoLeb render-clinical-document v${API_VERSION}`)
  pdf.setCreationDate(new Date())
  pdf.setModificationDate(new Date())
  pdf.setKeywords(['clinical', subject, tenant.slug])
  pdf.setLanguage(tenant.defaultLocale ?? 'en')

  // Custom XMP — pdf-lib exposes setCustomMetadata via low-level dict access
  // … inject doctoleb:* keys here
  return pdf
}
```

### 18.2. Embedded font reuse

```ts
const fonts = await Promise.all([
  pdf.embedFont(StandardFonts.Helvetica),
  pdf.embedFont(StandardFonts.HelveticaBold),
])
const [regular, bold] = fonts
```

Cache these on the warm Edge Function (module-level) — pdf-lib re-uses fonts only within the same `PDFDocument`. Across documents we re-create.

### 18.3. Watermark drawing

```ts
function drawWatermark(page, { text, opacity, font, color }) {
  const { width, height } = page.getSize()
  page.drawText(text, {
    x: width / 2,
    y: height / 2,
    size: 80,
    font,
    color,
    opacity,
    rotate: degrees(-35),
    // pdf-lib draws from the baseline; center via x/y adjustments
  })
}
```

### 18.4. QR drawing (SVG path)

```ts
// 1. Generate QR SVG path with qrcode-svg.
// 2. Extract the `d` attribute.
// 3. Draw with pdf-lib's drawSvgPath, scaled to 60pt × 60pt.
```

### 18.5. Hyperlink annotation

```ts
import { PDFName, PDFArray, PDFDict } from 'https://esm.sh/pdf-lib@1.17.1'

function attachLink(page, { rect, url }) {
  const annot = page.doc.context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height],
    Border: [0, 0, 0],
    A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
    Contents: PDFString.of(url),
  })
  const annotsArr = page.node.lookup(PDFName.of('Annots'), PDFArray) ?? page.doc.context.obj([])
  annotsArr.push(annot)
  page.node.set(PDFName.of('Annots'), annotsArr)
}
```

### 18.6. Page-break loop

Pseudocode for the placement engine:

```ts
let cursorY = page.height - margins.top - HEADER_HEIGHT
for (const section of template.sections) {
  const sectionHeight = measureSection(section, fields)
  if (sectionHeight < CONTENT_AREA_HEIGHT * 0.7) {
    if (sectionHeight > cursorY - margins.bottom - FOOTER_HEIGHT) {
      // Push to a new page
      page = pdf.addPage(PAGE_SIZE)
      cursorY = page.height - margins.top - HEADER_HEIGHT
      drawHeader(page); drawFooter(page); drawWatermark(page)
    }
    drawSection(page, section, cursorY)
    cursorY -= sectionHeight + SECTION_GAP
  } else {
    // Large section — allow split AT field boundaries
    for (const field of section.fields) {
      const fh = measureField(field)
      if (fh > cursorY - margins.bottom - FOOTER_HEIGHT) {
        page = pdf.addPage(PAGE_SIZE); cursorY = page.height - margins.top - HEADER_HEIGHT
        drawHeader(page); drawFooter(page); drawWatermark(page)
      }
      drawField(page, field, cursorY)
      cursorY -= fh + FIELD_GAP
    }
  }
}
```

### 18.7. PDF/A-2b conformance

`pdf-lib` does NOT automatically emit a PDF/A-2b-conformant file. The renderer manually adds:

- An OutputIntents entry referencing the embedded sRGB ICC profile.
- A `pdfaid:part=2`, `pdfaid:conformance=B` entry in the XMP metadata.
- Removes any transparency-only effects (we don't use them).
- Ensures every font is fully embedded with `/Type /TrueType` or `/Type /Type1`, never just referenced.

Validation: run `verapdf` in CI (Docker image is small) against the fixture-generated PDFs. AT-4.2 in slice 4.

---

## 19. Anti-patterns — do NOT do these

| ❌ Anti-pattern | Why it's wrong |
|---|---|
| Use `puppeteer` / `playwright` / `chromium` to render HTML → PDF | Too heavy, breaks in Edge Function runtime |
| Embed raster images of clinic logos > 200 KB | Bloats every PDF; violates the size budget |
| Use `pdf-lib` `unsafe-` APIs to write arbitrary `/AcroForm` fields | We do not ship form-fillable PDFs in v1 |
| Hardcode the clinic name | Renders the same name for every tenant; defeats the brand goal |
| Pass the service-role key to the browser | Critical security violation |
| Build the QR code as a raster PNG | Pixelates at high zoom; doesn't print well |
| Use `pdf-lib`'s `drawText` with a font that wasn't embedded | The PDF will render with a fallback in some readers, breaking brand |
| Skip the watermark | Doctors expect a visible status indicator on drafts; legal posture |
| Inline patient name in the storage path | PII leak in storage browser |
| Generate the QR URL using the document's title or content | Title is mutable; the URL must point at the immutable id |

---

## 20. Quality bar — reviewer checklist

Before approving a slice 4 PR, verify:

- [ ] A generated `referral` PDF passes `verapdf` PDF/A-2b validation.
- [ ] PDF opens correctly in: Acrobat Reader (Windows), Apple Preview (macOS), Chrome PDF viewer, Firefox PDF viewer, an Android phone, an iPhone.
- [ ] Body text is selectable + copy-pasteable. Copying "Maya Haddad" into a text editor yields "Maya Haddad".
- [ ] Watermark visible on a draft; absent on a final (subtle brand only).
- [ ] QR code at the bottom right scans on a phone and opens a URL containing the document id.
- [ ] Header shows the clinic name, logo (if uploaded), and support contact.
- [ ] Footer shows the page number.
- [ ] No PHI in the storage path.
- [ ] No PHI in any `console.log` from the Edge Function.
- [ ] PDF byte size for a single-page document is under 200 KB.
- [ ] PDF metadata in Acrobat's File → Properties shows the right Title, Author, Subject, Producer, Creator, and the custom DoctoLeb fields.
- [ ] Print preview renders correctly on A4. Margins are visually identical to the screen render.
- [ ] All text passes 4.5:1 contrast (spot-check at least the section title and field value against the white background).
- [ ] All hyperlinks in the body are tappable.
- [ ] A doctor with a Lebanese phone number sees `+961 ...` as a `tel:` link.
- [ ] Re-rendering the same template + same values + same encounter produces a PDF with the SAME `doctoleb:contentSha256` value.

---

## 21. Open questions

| # | Question | Status |
|---|---|---|
| Q-1 | Move from Helvetica to Inter in v2? | DEFERRED — license clean, subset embedding works, just bytes |
| Q-2 | When should the verification endpoint go live? | Backlog — separate spec |
| Q-3 | Per-tenant page-size override? | DEFERRED — A4 default in v1 |
| Q-4 | PAdES digital signatures? | DEFERRED — legal review needed |
| Q-5 | Cryptographically sealed audit metadata? | DEFERRED — content hash + future verification endpoint is enough for v1 |

---

## 22. Change log

| Version | Date | Changes |
|---|---|---|
| 1.0.0 | 2026-05-15 | Initial spec, extracted from the parent plan v2 |

---

*This spec is the contract for the `render-clinical-document` Edge Function. The acceptance test IDs (AT-4.x) in the parent plan are bound to the rules in this spec — failing one fails the slice.*
