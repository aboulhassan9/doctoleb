import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';

const referralPage = fs.readFileSync('apps/clinic-ops/src/pages/DoctorReferralsPage.jsx', 'utf8');
const globalCss = fs.readFileSync('src/index.css', 'utf8');

describe('referral print contract', () => {
  it('prints the referral document without app actions or form controls', () => {
    const actionStart = referralPage.indexOf('mb-8 print-hidden');
    const documentStart = referralPage.indexOf('bg-white shadow-2xl');
    const actionSection = referralPage.slice(actionStart, documentStart);

    assert.match(globalCss, /\.print-only\s*\{/);
    assert.match(globalCss, /@media print[\s\S]*\.print-only\s*\{[\s\S]*display: block !important;/);

    assert.match(referralPage, /className="flex justify-between items-end mb-8 print-hidden"/);
    assert.match(actionSection, /Print Letter/);
    assert.match(actionSection, /Send via Secure Message/);
    assert.match(referralPage, /<textarea[\s\S]*?className="print-hidden/);
    assert.match(referralPage, /<select[\s\S]*?className="print-hidden/);
    assert.match(referralPage, /className="print-only[^"]*"[\s\S]{0,80}\{selectedPatientName\}/);
    assert.match(referralPage, /className="print-only[^"]*"[\s\S]{0,80}\{recipientDoctorName\}/);
    assert.match(referralPage, /className="print-only[^"]*"[\s\S]{0,160}\{reason \|\| 'Not provided'\}/);
  });
});
