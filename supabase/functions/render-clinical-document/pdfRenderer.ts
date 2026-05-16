/**
 * pdfRenderer.ts — Generates clinical-grade PDFs using pdf-lib.
 *
 * Contract: docs/specs/pdf-export-quality-spec.md
 *
 * Key decisions:
 *   - pdf-lib 1.17.1 pinned from esm.sh (no puppeteer/chromium)
 *   - Bundled Noto Sans fonts are embedded for PDF/A conformance
 *   - QR via qrcode-svg → drawSvgPath (vector, not raster)
 *   - Watermark is a text annotation, not a raster image
 *   - PDF/A-2b metadata, trailer ID, embedded fonts, and sRGB output intent
 *   - No PHI in any log output
 */

import {
  PDFDocument,
  PDFImage,
  rgb,
  degrees,
  PDFPage,
  PDFFont,
  PDFName,
  PDFString,
  PDFHexString,
  type RGB,
} from 'https://esm.sh/pdf-lib@1.17.1';
import fontkit from 'https://esm.sh/@pdf-lib/fontkit@1.1.1';
// qrcode-generator: pure-JS QR encoder, returns a module grid we draw with
// pdf-lib rectangles (vector — no raster, scales cleanly at any zoom).
import qrcode from 'https://esm.sh/qrcode-generator@1.4.4';

import type { RenderContext, TemplateSection, TemplateField } from './contextLoader.ts';
import { attachPdfA2bMetadata } from './pdfA.js';

// ── Constants from the spec ──────────────────────────────────────

export const API_VERSION = '1.0.0';

// Page geometry (§ 5)
const PAGE_WIDTH = 595;  // A4
const PAGE_HEIGHT = 842;
const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 50;
const MARGIN_LEFT = 60;
const MARGIN_RIGHT = 60;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT; // 475
const HEADER_HEIGHT = 60;
const FOOTER_HEIGHT = 30;
const USABLE_TOP = PAGE_HEIGHT - MARGIN_TOP - HEADER_HEIGHT;
const USABLE_BOTTOM = MARGIN_BOTTOM + FOOTER_HEIGHT;

// Spacing (§ 6)
const GAP_AFTER_HEADER = 24;
const GAP_BETWEEN_SECTIONS = 18;
const GAP_BETWEEN_FIELDS = 6;
const GAP_ABOVE_SIGNATURE = 36;

// Typography (§ 3)
const TYPE = {
  clinicName:   { size: 22, bold: true },
  clinicTag:    { size: 10, bold: false },
  docTitle:     { size: 16, bold: true },
  docTypeLabel: { size: 11, bold: true },
  sectionTitle: { size: 14, bold: true },
  fieldLabel:   { size: 10, bold: false },
  fieldValue:   { size: 11, bold: false },
  signatureLabel: { size: 9, bold: false },
  footer:       { size: 9, bold: false },
  watermark:    { size: 80, bold: true },
} as const;

// Colors (§ 4)
const COLORS = {
  textPrimary:   rgb(15 / 255, 23 / 255, 42 / 255),    // #0f172a
  textSecondary: rgb(51 / 255, 65 / 255, 85 / 255),     // #334155
  textTertiary:  rgb(100 / 255, 116 / 255, 139 / 255),  // #64748b
  divider:       rgb(203 / 255, 213 / 255, 225 / 255),  // #cbd5e1
  white:         rgb(1, 1, 1),
};

// Watermark config per status (§ 7)
const WATERMARK_CONFIG: Record<string, { textFn: (clinicName: string) => string; opacity: number }> = {
  draft:      { textFn: (n) => `DRAFT — ${n}`, opacity: 0.08 },
  final:      { textFn: (n) => n,               opacity: 0.05 },
  superseded: { textFn: () => 'SUPERSEDED',     opacity: 0.10 },
  void:       { textFn: () => 'VOID',           opacity: 0.18 },
};

// Document type labels for PDF metadata
const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  referral: 'Medical Referral',
  report: 'Medical Report',
  certificate: 'Medical Certificate',
  lab_request: 'Lab Request',
  prescription: 'Prescription',
  other: 'Clinical Document',
  custom: 'Clinical Document',
};

type PdfAAssets = {
  regularFont: Uint8Array;
  boldFont: Uint8Array;
  iccProfile: Uint8Array;
};

let pdfAAssetsPromise: Promise<PdfAAssets> | null = null;

function loadPdfAAssets(): Promise<PdfAAssets> {
  if (!pdfAAssetsPromise) {
    pdfAAssetsPromise = Promise.all([
      Deno.readFile(new URL('./assets/NotoSans-Regular.ttf', import.meta.url)),
      Deno.readFile(new URL('./assets/NotoSans-Bold.ttf', import.meta.url)),
      Deno.readFile(new URL('./assets/sRGB.icc', import.meta.url)),
    ]).then(([regularFont, boldFont, iccProfile]) => ({
      regularFont,
      boldFont,
      iccProfile,
    }));
  }
  return pdfAAssetsPromise;
}

// ── Utility ──────────────────────────────────────────────────────

function hexToRgb(hex: string): RGB {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
}

/** Relative luminance per WCAG 2.x */
function luminance(hex: string): number {
  const c = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)]
    .map((s) => parseInt(s, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** WCAG contrast ratio — must be >= 4.5 for body text on white */
function contrastRatio(hexFg: string): number {
  const lFg = luminance(hexFg);
  const lBg = 1; // white background
  const lighter = Math.max(lFg, lBg);
  const darker = Math.min(lFg, lBg);
  return (lighter + 0.05) / (darker + 0.05);
}

function shortId(uuid: string): string {
  return uuid.replace(/-/g, '').slice(0, 5).toUpperCase();
}

function formatDate(iso: string | null, tz: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', { timeZone: tz, year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return new Date(iso).toISOString().split('T')[0];
  }
}

/** Crockford Base32 encode — used for QR verification URL (§ 8) */
function crockfordBase32(uuid: string): string {
  const hex = uuid.replace(/-/g, '');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  const alphabet = '0123456789abcdefghjkmnpqrstvwxyz';
  let bits = 0, value = 0, result = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += alphabet[(value >>> bits) & 0x1f];
    }
  }
  if (bits > 0) result += alphabet[(value << (5 - bits)) & 0x1f];
  return result;
}

/** Build the canonical content string for SHA-256 (§ 10) */
function buildContentCanon(ctx: RenderContext): string {
  const parts = [ctx.template.id, '|'];
  for (const section of ctx.template.sections) {
    parts.push(section.title, '|');
    for (const field of section.fields) {
      const val = resolveFieldValue(ctx, field);
      parts.push(`${field.key}=${normalizeForHash(val)}`, '|');
    }
  }
  return parts.join('');
}

function normalizeForHash(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ');
}

/** SHA-256 hex digest */
async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Autofill resolver (§ 8.10 from parent plan) ──────────────────

/**
 * Match a `{{binding.key}}` placeholder. Whitespace inside the braces is
 * tolerated so doctors can write `{{ patient.full_name }}` from the editor.
 */
const COMPOSITE_PLACEHOLDER_RE = /\{\{\s*([a-z][a-z0-9_.]*)\s*\}\}/g;

/**
 * Substitute every `{{binding}}` placeholder in `template` with the resolved
 * autofill value. Unknown bindings (which the schema should have rejected)
 * are rendered as the literal text `[binding.key]` so they fail visibly in
 * QA rather than silently disappearing.
 */
function renderCompositeTemplate(ctx: RenderContext, template: string): string {
  return template.replace(COMPOSITE_PLACEHOLDER_RE, (_match, binding) => {
    const value = resolveAutofill(ctx, binding);
    if (value) return value;
    // Empty-but-known binding → empty replacement (clean composite).
    // Unknown binding → literal placeholder so the bug is visible.
    return AUTOFILL_KEYS.has(binding) ? '' : `[${binding}]`;
  });
}

/**
 * Conditional-display gate. Returns `true` when the field should render,
 * `false` when the doctor's `show_if` predicate is configured and does not
 * match. Comparison is case-insensitive + trimmed because hand-typed
 * `equals` values from the editor tend to have ad-hoc casing/whitespace.
 */
function evaluateShowIf(ctx: RenderContext, field: TemplateField): boolean {
  const cond = (field as { show_if?: { binding?: string; equals?: string } | null }).show_if;
  if (!cond || !cond.binding || typeof cond.equals !== 'string') return true;
  const resolved = resolveAutofill(ctx, cond.binding);
  if (!resolved) return false;
  return resolved.trim().toLowerCase() === cond.equals.trim().toLowerCase();
}

/**
 * Closed-set named functions for the `derived` field type. Mirrors the
 * implementation in `packages/core/lib/composite.js` so the editor preview
 * and the renderer produce identical output. Adding a function here means
 * adding it to the schema's DERIVATION_FUNCTIONS list AND the JS mirror.
 */
function diffYears(fromIso: string, toIso: string): number | null {
  if (!fromIso || !toIso) return null;
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  let years = to.getUTCFullYear() - from.getUTCFullYear();
  const m = to.getUTCMonth() - from.getUTCMonth();
  if (m < 0 || (m === 0 && to.getUTCDate() < from.getUTCDate())) years -= 1;
  return years;
}

type DerivationArg = { binding?: string; literal?: string };
type Derivation = { fn?: string; args?: DerivationArg[] };

function evaluateDerivation(ctx: RenderContext, derivation: Derivation | null | undefined): string {
  if (!derivation || typeof derivation !== 'object') return '';
  const { fn, args } = derivation;
  const resolved = Array.isArray(args)
    ? args.map((a) => {
        if (typeof a.binding === 'string') {
          return resolveAutofill(ctx, a.binding) || '';
        }
        if (typeof a.literal === 'string') return a.literal;
        return '';
      })
    : [];
  switch (fn) {
    case 'age': {
      const y = diffYears(resolved[0], new Date().toISOString());
      return y == null ? '' : String(y);
    }
    case 'years_between': {
      const y = diffYears(resolved[0], resolved[1]);
      return y == null ? '' : String(y);
    }
    case 'concat':
      return resolved.join('');
    case 'upper':
      return (resolved[0] || '').toUpperCase();
    case 'lower':
      return (resolved[0] || '').toLowerCase();
    case 'trim':
      return (resolved[0] || '').trim();
    default:
      return '';
  }
}

function resolveFieldValue(ctx: RenderContext, field: TemplateField): string {
  // If the document carries structured per-field overrides, prefer them.
  const override = ctx.document.contentOverrides?.[field.key];
  if (typeof override === 'string' && override.trim()) return override;

  if (field.type === 'composite_text' && typeof field.template === 'string' && field.template.trim()) {
    return renderCompositeTemplate(ctx, field.template);
  }

  if (field.type === 'derived') {
    const d = (field as TemplateField & { derivation?: Derivation | null }).derivation ?? null;
    return evaluateDerivation(ctx, d);
  }

  if (field.autofill) {
    const resolved = resolveAutofill(ctx, field.autofill);
    if (resolved) return resolved;
  }

  return '';
}

/**
 * The closed set of autofill keys this renderer knows. Kept in lockstep
 * with `TEMPLATE_AUTOFILL_KEYS` in `packages/core/schemas/documentTemplates.js`.
 * Used by `renderCompositeTemplate` to distinguish "known-but-empty" from
 * "unknown binding."
 */
const AUTOFILL_KEYS = new Set<string>([
  'patient.full_name',
  'patient.date_of_birth',
  'patient.sex',
  'patient.gender',
  'patient.phone',
  'patient.email',
  'doctor.full_name',
  'doctor.specialization',
  'doctor.license_number',
  'clinic.name',
  'clinic.address',
  'clinic.phone',
  'tenant.display_name',
  'tenant.support_phone',
  'tenant.support_email',
  'encounter.chief_complaint',
  'encounter.summary',
  'encounter.started_at',
  'document.created_at',
]);

function resolveAutofill(ctx: RenderContext, key: string): string {
  const map: Record<string, string | null | undefined> = {
    'patient.full_name': ctx.patient.fullName,
    'patient.date_of_birth': ctx.patient.dateOfBirth,
    // The live column is `patients.sex`. We accept the legacy `patient.gender`
    // key from already-seeded templates and route it to the same value so
    // no migration is required for existing tenant data.
    'patient.sex': ctx.patient.sex,
    'patient.gender': ctx.patient.sex,
    'patient.phone': ctx.patient.phone,
    'patient.email': ctx.patient.email,
    'doctor.full_name': ctx.doctor.fullName,
    'doctor.specialization': ctx.doctor.specialization,
    'doctor.license_number': ctx.doctor.licenseNumber,
    'clinic.name': ctx.clinic.name,
    'clinic.address': ctx.clinic.address,
    'clinic.phone': ctx.clinic.phone,
    'tenant.display_name': ctx.tenant.displayName,
    'tenant.support_phone': ctx.brand.supportPhone,
    'tenant.support_email': ctx.brand.supportEmail,
    'encounter.chief_complaint': ctx.encounter?.chiefComplaint ?? null,
    'encounter.summary': ctx.encounter?.summary ?? null,
    'encounter.started_at': ctx.encounter?.startedAt
      ? formatDate(ctx.encounter.startedAt, ctx.tenant.timezone)
      : null,
    'document.created_at': formatDate(ctx.document.createdAt, ctx.tenant.timezone),
  };
  return map[key] ?? '';
}

// ── Hyperlink detection (§ 8.8 of the parent plan) ───────────────

/**
 * Conservative patterns: phone (E.164-ish), email, https URL. Anything else
 * is rendered as plain text. The regex set is intentionally narrow to keep
 * doctors from accidentally hyperlinking domain-like trailers in clinical
 * shorthand (e.g. "10mg q.d.").
 */
const PHONE_RE = /\+?\d[\d\s().-]{6,}\d/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const HTTPS_RE = /^https:\/\/\S+$/i;
const MAX_LINKS_PER_PAGE = 5;

function classifyLink(value: string): { kind: 'phone' | 'email' | 'url'; href: string } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (HTTPS_RE.test(trimmed)) return { kind: 'url', href: trimmed };
  if (EMAIL_RE.test(trimmed)) return { kind: 'email', href: `mailto:${trimmed}` };
  if (PHONE_RE.test(trimmed) && /^\+?[\d\s().-]+$/.test(trimmed)) {
    // Strip whitespace + hyphens for the tel: target; keep the leading +.
    const tel = trimmed.replace(/[\s().-]/g, '');
    return { kind: 'phone', href: `tel:${tel}` };
  }
  return null;
}

/**
 * Attach a clickable URI annotation to a previously-drawn text box.
 *
 * pdf-lib doesn't expose a `drawLink` helper at the page level, so we build
 * the annotation dictionary by hand and append it to the page's
 * `/Annots` array. The hot-zone uses the same bounds the renderer used for
 * the underlying drawText call.
 */
function attachLinkAnnotation(
  pdf: PDFDocument,
  page: PDFPage,
  rect: { x: number; y: number; width: number; height: number },
  uri: string,
) {
  const annotDict = pdf.context.obj({
    Type: PDFName.of('Annot'),
    Subtype: PDFName.of('Link'),
    Rect: [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height],
    Border: [0, 0, 0],
    A: {
      Type: PDFName.of('Action'),
      S: PDFName.of('URI'),
      URI: PDFString.of(uri),
    },
  });
  const annotRef = pdf.context.register(annotDict);
  const existing = page.node.Annots() ?? pdf.context.obj([]);
  existing.push(annotRef);
  page.node.set(PDFName.of('Annots'), existing);
}

// ── Text wrapping ────────────────────────────────────────────────

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (!text) return ['—'];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, size);
    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length ? lines : ['—'];
}

// ── Measure helpers ──────────────────────────────────────────────

interface Fonts { regular: PDFFont; bold: PDFFont }

function measureField(field: TemplateField, ctx: RenderContext, fonts: Fonts): number {
  const labelHeight = TYPE.fieldLabel.size * 1.4;
  const value = resolveFieldValue(ctx, field);
  const valueLines = wrapText(value, fonts.regular, TYPE.fieldValue.size, CONTENT_WIDTH - 140);
  const valueHeight = valueLines.length * TYPE.fieldValue.size * 1.4;
  return Math.max(labelHeight, valueHeight);
}

function measureSection(section: TemplateSection, ctx: RenderContext, fonts: Fonts): number {
  let h = TYPE.sectionTitle.size * 1.25 + 6; // title + gap
  for (let i = 0; i < section.fields.length; i++) {
    h += measureField(section.fields[i], ctx, fonts);
    if (i < section.fields.length - 1) h += GAP_BETWEEN_FIELDS;
  }
  return h;
}

// ── Drawing primitives ───────────────────────────────────────────

/**
 * The clinic logo (when present) sits on the left of the header band. We
 * reserve `LOGO_BOX_WIDTH` for it and shift the clinic name to the right so
 * the two never overlap. If no logo is embedded, the clinic name takes the
 * full left side.
 */
const LOGO_BOX_WIDTH = 52;
const LOGO_BOX_HEIGHT = 52;

function drawHeader(
  page: PDFPage,
  fonts: Fonts,
  ctx: RenderContext,
  primaryColor: RGB,
  logoImage: PDFImage | null,
) {
  const y = PAGE_HEIGHT - MARGIN_TOP;

  // Optional logo on the left. We fit it inside (LOGO_BOX_WIDTH × LOGO_BOX_HEIGHT)
  // preserving aspect ratio so a wide or tall logo never blows out the band.
  if (logoImage) {
    const dims = logoImage.size();
    const aspect = dims.width / dims.height;
    let drawW = LOGO_BOX_WIDTH;
    let drawH = drawW / aspect;
    if (drawH > LOGO_BOX_HEIGHT) {
      drawH = LOGO_BOX_HEIGHT;
      drawW = drawH * aspect;
    }
    page.drawImage(logoImage, {
      x: MARGIN_LEFT,
      y: y - drawH,
      width: drawW,
      height: drawH,
    });
  }

  const nameX = logoImage ? MARGIN_LEFT + LOGO_BOX_WIDTH + 12 : MARGIN_LEFT;

  page.drawText(ctx.tenant.displayName, {
    x: nameX,
    y: y - TYPE.clinicName.size,
    size: TYPE.clinicName.size,
    font: fonts.bold,
    color: primaryColor,
  });

  if (ctx.brand.supportPhone) {
    const phoneWidth = fonts.regular.widthOfTextAtSize(ctx.brand.supportPhone, TYPE.clinicTag.size);
    page.drawText(ctx.brand.supportPhone, {
      x: PAGE_WIDTH - MARGIN_RIGHT - phoneWidth,
      y: y - TYPE.clinicTag.size,
      size: TYPE.clinicTag.size,
      font: fonts.regular,
      color: COLORS.textTertiary,
    });
  }

  if (ctx.brand.supportEmail) {
    const emailWidth = fonts.regular.widthOfTextAtSize(ctx.brand.supportEmail, TYPE.clinicTag.size);
    page.drawText(ctx.brand.supportEmail, {
      x: PAGE_WIDTH - MARGIN_RIGHT - emailWidth,
      y: y - TYPE.clinicTag.size - 14,
      size: TYPE.clinicTag.size,
      font: fonts.regular,
      color: COLORS.textTertiary,
    });
  }

  const dividerY = y - HEADER_HEIGHT;
  page.drawLine({
    start: { x: MARGIN_LEFT, y: dividerY },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: dividerY },
    thickness: 1,
    color: primaryColor,
  });
}

function drawFooter(
  page: PDFPage, fonts: Fonts, ctx: RenderContext,
  pageNum: number, totalPages: number,
) {
  const y = MARGIN_BOTTOM;

  // Clinic name + page number
  const footerText = `${ctx.tenant.displayName} · Page ${pageNum} of ${totalPages}`;
  page.drawText(footerText, {
    x: MARGIN_LEFT,
    y: y + 8,
    size: TYPE.footer.size,
    font: fonts.regular,
    color: COLORS.textTertiary,
  });
}

/**
 * Center-anchored rotated watermark.
 *
 * pdf-lib's `drawText` anchors at the lower-left of the (unrotated) text and
 * then rotates the whole string about that anchor. To land the visual center
 * of the text at the page center after a θ rotation, we solve for the
 * lower-left anchor (x, y) such that the rotated bounding-box center sits at
 * (W/2, H/2). With θ = -35° this expands to:
 *   x = W/2 - (w/2)·cosθ + (size/2)·sinθ
 *   y = H/2 - (w/2)·sinθ - (size/2)·cosθ
 */
function drawWatermark(page: PDFPage, font: PDFFont, ctx: RenderContext) {
  const config = WATERMARK_CONFIG[ctx.document.status] || WATERMARK_CONFIG.draft;
  const text = config.textFn(ctx.tenant.displayName);
  const size = TYPE.watermark.size;
  const textWidth = font.widthOfTextAtSize(text, size);
  const { width, height } = page.getSize();

  const angleRad = -35 * Math.PI / 180;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  const anchorX = width / 2 - (textWidth / 2) * cosA + (size / 2) * sinA;
  const anchorY = height / 2 - (textWidth / 2) * sinA - (size / 2) * cosA;

  page.drawText(text, {
    x: anchorX,
    y: anchorY,
    size,
    font,
    color: COLORS.textTertiary,
    opacity: config.opacity,
    rotate: degrees(-35),
  });
}

/**
 * Real QR code rendered as vector rectangles via the `qrcode-generator`
 * module grid. This stays sharp at any zoom level and adds no raster bytes
 * to the PDF.
 */
const QR_BOX_PT = 60;        // visual size on page
const QR_TYPE_NUMBER = 0;    // 0 = auto-pick smallest QR version that fits
const QR_ERROR_LEVEL = 'M' as const; // 15% recovery — balances density vs robustness

function drawQrCode(
  page: PDFPage,
  fonts: Fonts,
  documentId: string,
) {
  const verifyUrl = `https://verify.doctoleb.com/v1/${crockfordBase32(documentId)}`;
  const qr = qrcode(QR_TYPE_NUMBER, QR_ERROR_LEVEL);
  qr.addData(verifyUrl);
  qr.make();
  const moduleCount = qr.getModuleCount();
  const moduleSize = QR_BOX_PT / moduleCount;

  const qrX = PAGE_WIDTH - MARGIN_RIGHT - QR_BOX_PT;
  const qrY = MARGIN_BOTTOM;

  // White quiet zone — required by the QR spec for reliable scanning.
  page.drawRectangle({
    x: qrX,
    y: qrY,
    width: QR_BOX_PT,
    height: QR_BOX_PT,
    color: COLORS.white,
  });

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (qr.isDark(row, col)) {
        page.drawRectangle({
          // QR row 0 is the TOP row visually; pdf y grows upward → flip rows.
          x: qrX + col * moduleSize,
          y: qrY + QR_BOX_PT - (row + 1) * moduleSize,
          width: moduleSize,
          height: moduleSize,
          color: COLORS.textPrimary,
        });
      }
    }
  }

  // Tiny caption under the QR — helps non-technical users know it's scannable.
  page.drawText('Verify document', {
    x: qrX,
    y: qrY - 9,
    size: 6,
    font: fonts.regular,
    color: COLORS.textTertiary,
  });
}

// ── Logo embedding ───────────────────────────────────────────────

/**
 * Try to embed the logo bytes into the PDF. Returns `null` (and logs a
 * non-PHI reason) when the bytes are missing or not embeddable. We never
 * throw — a missing logo is a soft failure, never a render abort.
 *
 * pdf-lib supports PNG and JPEG natively. SVG/WebP are NOT supported and
 * must be rejected here even though `logoFetch.js` accepted them upstream.
 */
async function embedLogo(
  pdf: PDFDocument,
  bytes: Uint8Array | null,
): Promise<PDFImage | null> {
  if (!bytes || bytes.byteLength === 0) return null;
  // PNG magic: 89 50 4E 47. JPEG magic: FF D8 FF.
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  try {
    if (isPng) return await pdf.embedPng(bytes);
    if (isJpeg) return await pdf.embedJpg(bytes);
  } catch (err) {
    const reason = err instanceof Error ? err.name : 'unknown';
    console.warn('[render] logo_embed_failed', { reason });
    return null;
  }
  console.warn('[render] logo_embed_skipped', { reason: 'unsupported_format' });
  return null;
}

// ── Main render function ─────────────────────────────────────────

export async function renderPdf(
  ctx: RenderContext,
  options: { logoBytes?: Uint8Array | null } = {},
): Promise<{
  bytes: Uint8Array;
  contentHash: string;
  storagePath: string;
}> {
  // ── Brand color with contrast check (§ 4) ──
  let primaryColor: RGB;
  if (contrastRatio(ctx.brand.primaryColor) >= 4.5) {
    primaryColor = hexToRgb(ctx.brand.primaryColor);
  } else {
    console.warn('[render] primary color fails contrast, falling back', {
      color: ctx.brand.primaryColor,
    });
    primaryColor = COLORS.textPrimary;
  }

  // ── Content hash ──
  const contentCanon = buildContentCanon(ctx);
  const contentHash = await sha256(contentCanon);

  // ── Create document ──
  const assets = await loadPdfAAssets();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [regular, bold] = await Promise.all([
    pdf.embedFont(assets.regularFont, { subset: true }),
    pdf.embedFont(assets.boldFont, { subset: true }),
  ]);
  const fonts: Fonts = { regular, bold };

  // Embed the logo once; reuse the same image object on every page.
  const logoImage = await embedLogo(pdf, options.logoBytes ?? null);

  // ── Metadata (§ 10) ──
  const subject = DOCUMENT_TYPE_LABELS[ctx.document.documentType] || 'Clinical Document';
  const metadataDate = new Date();
  attachPdfA2bMetadata(
    pdf,
    { PDFName, PDFString, PDFHexString },
    {
      title: ctx.document.title,
      author: ctx.tenant.displayName,
      subject,
      producer: 'DoctoLeb / pdf-lib 1.17.1',
      creator: `DoctoLeb render-clinical-document v${API_VERSION}`,
      createdAt: metadataDate,
      modifiedAt: metadataDate,
      keywords: ['clinical', subject, ctx.tenant.slug],
      language: ctx.tenant.defaultLocale,
      stableFileId: `${ctx.document.id}:${contentHash.slice(0, 32)}`,
      iccProfile: assets.iccProfile,
    },
  );

  // ── Plan pages (§ 9 page-break algorithm) ──
  // First pass: measure everything and assign to pages
  interface PagePlan {
    sections: Array<{ section: TemplateSection; height: number }>;
    hasSignature: boolean;
  }

  const pagePlans: PagePlan[] = [];
  let currentPlan: PagePlan = { sections: [], hasSignature: false };
  const contentAreaHeight = USABLE_TOP - USABLE_BOTTOM - GAP_AFTER_HEADER;
  let cursorBudget = contentAreaHeight;

  /**
   * Split a tall section at a field boundary so it fits the remaining
   * budget. Returns the head (this page) and the tail (next page). Never
   * splits a single field's body. If the section title alone doesn't fit,
   * pushes the entire section to the next page.
   *
   * The tail section reuses the same `key` so duplicate-key detection
   * doesn't fire on the runtime structure, and its `title` gets a
   * "(continued)" suffix so doctors see the section is split.
   */
  function splitSectionAtFieldBoundary(
    section: TemplateSection,
    remainingBudget: number,
  ): { head: TemplateSection | null; tail: TemplateSection | null; headHeight: number } {
    const titleHeight = TYPE.sectionTitle.size * 1.25 + 6;
    // If even the title can't fit, the whole section moves to the next page.
    if (titleHeight > remainingBudget) {
      return { head: null, tail: section, headHeight: 0 };
    }
    let cursor = titleHeight;
    const headFields: TemplateField[] = [];
    let i = 0;
    for (; i < section.fields.length; i++) {
      const f = section.fields[i];
      const fHeight = measureField(f, ctx, fonts);
      // Stop as soon as adding this field would overflow.
      if (cursor + fHeight + (headFields.length > 0 ? GAP_BETWEEN_FIELDS : 0) > remainingBudget) {
        break;
      }
      headFields.push(f);
      cursor += fHeight + (headFields.length > 1 ? GAP_BETWEEN_FIELDS : 0);
    }
    if (headFields.length === 0) {
      // Title fits but no field does — push the whole section instead of
      // leaving a header-only stub at the bottom of the page.
      return { head: null, tail: section, headHeight: 0 };
    }
    const tailFields = section.fields.slice(i);
    if (tailFields.length === 0) {
      // Everything fit; no split needed (caller will not call us in this case
      // but we handle it defensively).
      return {
        head: { ...section, fields: headFields },
        tail: null,
        headHeight: cursor,
      };
    }
    return {
      head: { ...section, fields: headFields },
      tail: {
        ...section,
        title: `${section.title} (continued)`,
        fields: tailFields,
      },
      headHeight: cursor,
    };
  }

  // Work queue — sections still to place. We push tails back onto the head
  // of the queue when a section gets split.
  const queue: TemplateSection[] = [...ctx.template.sections];

  while (queue.length > 0) {
    const section = queue.shift()!;
    const sectionHeight = measureSection(section, ctx, fonts);
    const needed = sectionHeight + GAP_BETWEEN_SECTIONS;

    if (needed <= cursorBudget) {
      // Whole section fits on this page.
      currentPlan.sections.push({ section, height: sectionHeight });
      cursorBudget -= needed;
      continue;
    }

    // Doesn't fit. Decide: split, or push to next page.
    const isLarge = sectionHeight >= contentAreaHeight * 0.7;
    const hasRoomForSomeFields = cursorBudget > TYPE.sectionTitle.size * 1.25 + 6 + 40;

    if (isLarge && hasRoomForSomeFields) {
      // Split at the next field boundary.
      const { head, tail, headHeight } = splitSectionAtFieldBoundary(section, cursorBudget);
      if (head) {
        currentPlan.sections.push({ section: head, height: headHeight });
      }
      // Always flush the current page after a split.
      pagePlans.push(currentPlan);
      currentPlan = { sections: [], hasSignature: false };
      cursorBudget = contentAreaHeight;
      if (tail) queue.unshift(tail);
      continue;
    }

    // Small-or-medium section that doesn't fit: flush, then place on a
    // fresh page.
    if (currentPlan.sections.length > 0) {
      pagePlans.push(currentPlan);
      currentPlan = { sections: [], hasSignature: false };
      cursorBudget = contentAreaHeight;
    }
    if (needed > cursorBudget && sectionHeight >= contentAreaHeight * 0.7) {
      // Even on a fresh page it still doesn't fit — split.
      const { head, tail, headHeight } = splitSectionAtFieldBoundary(section, cursorBudget);
      if (head) {
        currentPlan.sections.push({ section: head, height: headHeight });
      }
      pagePlans.push(currentPlan);
      currentPlan = { sections: [], hasSignature: false };
      cursorBudget = contentAreaHeight;
      if (tail) queue.unshift(tail);
    } else {
      currentPlan.sections.push({ section, height: sectionHeight });
      cursorBudget -= needed;
    }
  }

  // Signature block — never split, always placed on whichever page has room.
  const signatureHeight = 70;
  if (signatureHeight + GAP_ABOVE_SIGNATURE > cursorBudget && currentPlan.sections.length > 0) {
    pagePlans.push(currentPlan);
    currentPlan = { sections: [], hasSignature: true };
  } else {
    currentPlan.hasSignature = true;
  }
  pagePlans.push(currentPlan);

  // Strip page plans that ended up empty (e.g. a section that perfectly
  // filled the previous budget pushed an empty currentPlan during the loop).
  const filteredPlans = pagePlans.filter(
    (plan) => plan.sections.length > 0 || plan.hasSignature,
  );
  // Always render at least one page so the PDF is structurally valid.
  if (filteredPlans.length === 0) {
    filteredPlans.push({ sections: [], hasSignature: true });
  }

  pagePlans.length = 0;
  pagePlans.push(...filteredPlans);

  const totalPages = pagePlans.length;

  // ── Second pass: render each page ──
  for (let pageIdx = 0; pageIdx < pagePlans.length; pageIdx++) {
    const plan = pagePlans[pageIdx];
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    // Per-page link budget — guards against an abusive template that turns
    // every field into a clickable URI annotation.
    let linksOnPage = 0;

    // Watermark first (behind everything)
    drawWatermark(page, bold, ctx);

    // Header
    drawHeader(page, fonts, ctx, primaryColor, logoImage);

    // Footer (page number) — draw last on every page
    drawFooter(page, fonts, ctx, pageIdx + 1, totalPages);

    // QR on every page
    drawQrCode(page, fonts, ctx.document.id);

    // Content
    let cursorY = USABLE_TOP - GAP_AFTER_HEADER;

    // Document title block (first page only)
    if (pageIdx === 0) {
      // Document type label
      const typeLabel = (DOCUMENT_TYPE_LABELS[ctx.document.documentType] || 'DOCUMENT').toUpperCase();
      page.drawText(typeLabel, {
        x: MARGIN_LEFT,
        y: cursorY,
        size: TYPE.docTypeLabel.size,
        font: bold,
        color: COLORS.textSecondary,
      });

      // Short ID (right-aligned)
      const sid = `#${shortId(ctx.document.id)}`;
      const sidWidth = fonts.regular.widthOfTextAtSize(sid, TYPE.docTypeLabel.size);
      page.drawText(sid, {
        x: PAGE_WIDTH - MARGIN_RIGHT - sidWidth,
        y: cursorY,
        size: TYPE.docTypeLabel.size,
        font: fonts.regular,
        color: COLORS.textSecondary,
      });
      cursorY -= TYPE.docTypeLabel.size * 1.4 + 4;

      // Document title
      page.drawText(ctx.document.title, {
        x: MARGIN_LEFT,
        y: cursorY,
        size: TYPE.docTitle.size,
        font: bold,
        color: primaryColor,
      });

      // Date (right-aligned)
      const dateStr = formatDate(ctx.document.createdAt, ctx.tenant.timezone);
      const dateWidth = fonts.regular.widthOfTextAtSize(dateStr, TYPE.fieldLabel.size);
      page.drawText(dateStr, {
        x: PAGE_WIDTH - MARGIN_RIGHT - dateWidth,
        y: cursorY,
        size: TYPE.fieldLabel.size,
        font: fonts.regular,
        color: COLORS.textSecondary,
      });
      cursorY -= TYPE.docTitle.size * 1.4 + 8;

      // Divider
      page.drawLine({
        start: { x: MARGIN_LEFT, y: cursorY },
        end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: cursorY },
        thickness: 0.5,
        color: COLORS.divider,
      });
      cursorY -= 12;
    }

    // Render sections assigned to this page
    for (const { section } of plan.sections) {
      // Section title
      page.drawText(section.title, {
        x: MARGIN_LEFT,
        y: cursorY,
        size: TYPE.sectionTitle.size,
        font: bold,
        color: primaryColor,
      });
      cursorY -= TYPE.sectionTitle.size * 1.25 + 6;

      // Fields
      for (let fi = 0; fi < section.fields.length; fi++) {
        const field = section.fields[fi];
        // Conditional skip — `show_if` lets a doctor suppress a field unless
        // the configured binding matches a literal value (e.g. show
        // "gestational age" only when patient.sex equals "female").
        if (!evaluateShowIf(ctx, field)) {
          continue;
        }
        const value = resolveFieldValue(ctx, field);

        if (field.type === 'static_text' || field.type === 'composite_text') {
          // Both render as flowing body text. For static_text, `value` came
          // from `field.content`; for composite_text, `value` is the result
          // of `renderCompositeTemplate(ctx, field.template)`.
          const textContent = field.type === 'static_text'
            ? (field.content || value || '')
            : (value || '');
          const lines = wrapText(textContent, regular, TYPE.fieldValue.size, CONTENT_WIDTH);
          for (const line of lines) {
            page.drawText(line, {
              x: MARGIN_LEFT,
              y: cursorY,
              size: TYPE.fieldValue.size,
              font: regular,
              color: COLORS.textPrimary,
            });
            cursorY -= TYPE.fieldValue.size * 1.4;
          }
        } else if (field.type === 'signature') {
          // Handled in signature block below
          continue;
        } else {
          // Standard label: value layout
          const labelX = MARGIN_LEFT;
          const valueX = MARGIN_LEFT + 140;
          const maxValueWidth = CONTENT_WIDTH - 140;

          // Label
          page.drawText(field.label, {
            x: labelX,
            y: cursorY,
            size: TYPE.fieldLabel.size,
            font: regular,
            color: COLORS.textSecondary,
          });

          // Value (potentially multi-line)
          const lines = wrapText(value || '—', regular, TYPE.fieldValue.size, maxValueWidth);
          for (let li = 0; li < lines.length; li++) {
            page.drawText(lines[li], {
              x: valueX,
              y: cursorY - (li * TYPE.fieldValue.size * 1.4),
              size: TYPE.fieldValue.size,
              font: regular,
              color: COLORS.textPrimary,
            });
          }

          // Hyperlink the FIRST line of the value when it matches the
          // phone / email / URL patterns. Multi-line links are intentionally
          // out of scope for v1 — clinical values almost always fit on one
          // line, and a multi-line hot-zone is rarely the right UX.
          if (
            linksOnPage < MAX_LINKS_PER_PAGE
            && lines.length > 0
            && lines[0] !== '—'
          ) {
            const link = classifyLink(lines[0]);
            if (link) {
              const lineWidth = regular.widthOfTextAtSize(lines[0], TYPE.fieldValue.size);
              attachLinkAnnotation(pdf, page, {
                x: valueX,
                y: cursorY - 2,
                width: lineWidth,
                height: TYPE.fieldValue.size + 2,
              }, link.href);
              linksOnPage += 1;
            }
          }

          cursorY -= Math.max(TYPE.fieldLabel.size * 1.4, lines.length * TYPE.fieldValue.size * 1.4);
        }

        if (fi < section.fields.length - 1) cursorY -= GAP_BETWEEN_FIELDS;
      }

      cursorY -= GAP_BETWEEN_SECTIONS;
    }

    // Signature block (§ 6)
    if (plan.hasSignature) {
      cursorY -= GAP_ABOVE_SIGNATURE;

      // Signature line
      const lineY = cursorY;
      page.drawLine({
        start: { x: MARGIN_LEFT, y: lineY },
        end: { x: MARGIN_LEFT + 200, y: lineY },
        thickness: 0.5,
        color: COLORS.textPrimary,
      });
      cursorY -= 14;

      // Doctor name
      page.drawText(`Dr. ${ctx.doctor.fullName}`, {
        x: MARGIN_LEFT,
        y: cursorY,
        size: TYPE.fieldValue.size,
        font: bold,
        color: COLORS.textPrimary,
      });
      cursorY -= TYPE.fieldValue.size * 1.4;

      // Specialization + license
      const credentials = [
        ctx.doctor.specialization,
        ctx.doctor.licenseNumber ? `License #${ctx.doctor.licenseNumber}` : null,
      ].filter(Boolean).join(' · ');

      if (credentials) {
        page.drawText(credentials, {
          x: MARGIN_LEFT,
          y: cursorY,
          size: TYPE.signatureLabel.size,
          font: regular,
          color: COLORS.textTertiary,
        });
      }
    }
  }

  // ── Serialize ──
  const bytes = await pdf.save({ useObjectStreams: false });

  // ── Storage path (§ 12) ──
  const now = new Date();
  const yyyy = now.getUTCFullYear().toString();
  const mm = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  const tsMs = now.getTime().toString();
  const shortUuid = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  const templateType = ctx.template.templateType;

  const storagePath = [
    ctx.tenant.slug,
    ctx.patient.id,
    yyyy,
    mm,
    `${templateType}-${tsMs}-${shortUuid}.pdf`,
  ].join('/');

  return { bytes: new Uint8Array(bytes), contentHash, storagePath };
}
