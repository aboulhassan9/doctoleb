export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

const PRINT_CSP_CONTENT = "default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; font-src data:";
const PRINT_CSP_META = `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(PRINT_CSP_CONTENT)}">`;

export function sanitizePrintableHtml(value) {
  return String(value ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\s+on[a-z][\w:-]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(href|src|xlink:href)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, ' $1="#"')
    .replace(/\s+(href|src|xlink:href)\s*=\s*javascript:[^\s>]*/gi, ' $1="#"')
    .replace(/url\(\s*(['"]?)\s*javascript:[\s\S]*?\1\s*\)/gi, 'url(about:blank)');
}

export function applyPrintableCsp(value) {
  const html = String(value ?? '');
  if (/http-equiv=["']Content-Security-Policy["']/i.test(html)) return html;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${PRINT_CSP_META}`);
  }
  return `<!DOCTYPE html><html><head>${PRINT_CSP_META}<title>Printable Document</title></head><body>${html}</body></html>`;
}

export function preparePrintableHtml(value) {
  return applyPrintableCsp(sanitizePrintableHtml(value));
}

export function replaceHtmlTokens(template, replacements) {
  let html = sanitizePrintableHtml(template);
  Object.entries(replacements || {}).forEach(([token, value]) => {
    html = html.replaceAll(token, escapeHtml(value));
  });
  return applyPrintableCsp(html);
}

export function openPrintableHtml(html, { printDelayMs = 100 } = {}) {
  if (typeof window === 'undefined') return false;

  const printWindow = window.open('', '_blank');
  if (!printWindow?.document) return false;

  try {
    printWindow.opener = null;
  } catch {
    // Some browsers expose opener as read-only; the printable CSP still applies.
  }

  printWindow.document.open('text/html', 'replace');
  printWindow.document.write(preparePrintableHtml(html));
  printWindow.document.close();

  const runPrint = () => {
    printWindow.focus();
    printWindow.print();
  };

  if (printDelayMs > 0) {
    window.setTimeout(runPrint, printDelayMs);
  } else {
    runPrint();
  }

  return true;
}

export function safeFilenamePart(value, fallback = 'document') {
  const cleaned = String(value ?? '')
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || fallback;
}
