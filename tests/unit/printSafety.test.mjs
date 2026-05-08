import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  escapeHtml,
  preparePrintableHtml,
  replaceHtmlTokens,
  safeFilenamePart,
  sanitizePrintableHtml,
} from '../../packages/core/lib/html.js';

const root = path.resolve(import.meta.dirname, '../..');

function listSourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name === 'dist') return [];
    if (entry.isDirectory()) return listSourceFiles(fullPath);
    if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) return [fullPath];
    return [];
  });
}

describe('printable HTML safety helpers', () => {
  it('escapes dynamic text before token replacement', () => {
    const html = replaceHtmlTokens('<h1>{{name}}</h1>', {
      '{{name}}': '<img src=x onerror=alert(1)>',
    });

    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.doesNotMatch(html, /<img src=x/i);
  });

  it('removes active content from printable HTML', () => {
    const html = sanitizePrintableHtml('<script>alert(1)</script><a onclick="x()" href="javascript:alert(1)">Open</a>');

    assert.doesNotMatch(html, /<script/i);
    assert.doesNotMatch(html, /onclick=/i);
    assert.doesNotMatch(html, /javascript:/i);
    assert.match(html, /href="#"/);
  });

  it('adds a restrictive print CSP when missing', () => {
    const html = preparePrintableHtml('<!doctype html><html><head><title>x</title></head><body>ok</body></html>');

    assert.match(html, /Content-Security-Policy/);
    assert.match(html, /default-src &#39;none&#39;/);
  });

  it('keeps filename fragments portable', () => {
    assert.equal(safeFilenamePart(' A/B <Patient> '), 'A_B_Patient');
    assert.equal(safeFilenamePart('', 'fallback'), 'fallback');
  });

  it('keeps document.write isolated to the shared print helper', () => {
    const files = [
      ...listSourceFiles(path.join(root, 'apps')),
      ...listSourceFiles(path.join(root, 'packages')),
    ];

    const offenders = files
      .filter((file) => path.normalize(file) !== path.normalize(path.join(root, 'packages/core/lib/html.js')))
      .filter((file) => fs.readFileSync(file, 'utf8').includes('document.write'))
      .map((file) => path.relative(root, file).replace(/\\/g, '/'));

    assert.deepEqual(offenders, []);
  });

  it('escapes HTML text without losing normal values', () => {
    assert.equal(escapeHtml('Dr. A & B'), 'Dr. A &amp; B');
  });
});
