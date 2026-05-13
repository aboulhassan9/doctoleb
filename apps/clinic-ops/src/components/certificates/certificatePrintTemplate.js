import { escapeHtml } from '@/lib/html';

/**
 * certificatePrintTemplate — Builds printable HTML for a medical certificate.
 *
 * Pure function — no React, no side-effects.
 *
 * @param {{ patientName: string, diagnosis: string, treatment: string, recommendations: string, startDate: string, endDate: string, durationDays: number, doctorName: string, doctorRole: string, brandName: string }} params
 * @returns {string} Full HTML document string for printing.
 */
export function buildCertificatePrintHtml({
    patientName,
    diagnosis,
    treatment,
    recommendations,
    startDate,
    endDate,
    durationDays,
    doctorName,
    doctorRole,
    brandName,
}) {
    const safe = {
        brandName: escapeHtml(brandName).toUpperCase(),
        patientName: escapeHtml(patientName || '[Patient Name]'),
        diagnosis: escapeHtml(diagnosis || '[Diagnosis Input]'),
        treatment: escapeHtml(treatment || '[Treatment Details]'),
        recommendations: escapeHtml(recommendations || '[Recommendations]'),
        startDate: escapeHtml(startDate || 'Start Date'),
        endDate: escapeHtml(endDate || 'End Date'),
        doctorName: escapeHtml(doctorName),
        doctorRole: escapeHtml(doctorRole),
    };

    const dateStr = new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });

    return `<!DOCTYPE html>
<html>
<head>
    <title>Medical Certificate - ${safe.patientName}</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
        .header { border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { font-size: 28px; margin: 0; }
        .header .id { color: #0d6cf2; font-weight: bold; }
        .patient { border-bottom: 1px solid #ccc; padding: 15px 0; font-size: 18px; font-style: italic; }
        .content { line-height: 1.8; margin: 30px 0; }
        .duration { background: #dbeafe; padding: 5px 10px; border-radius: 4px; font-weight: bold; color: #0d6cf2; }
        .footer { border-top: 1px solid #ccc; padding-top: 20px; margin-top: 40px; display: flex; justify-content: space-between; }
        .signature { border-top: 1px solid #000; width: 200px; padding-top: 5px; }
        .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-35deg); font-size: 80px; opacity: 0.05; }
    </style>
</head>
<body>
    <div class="header">
        <h1>MEDICAL CERTIFICATE</h1>
        <p style="font-size: 12px; color: #666;">Confidential Clinical Document</p>
        <p>Date: ${dateStr}</p>
    </div>
    <div class="patient">
        <strong>${safe.patientName}</strong>
    </div>
    <div class="content">
        <p>Was examined on this date and found to be suffering from <strong>${safe.diagnosis}</strong>.</p>
        <p>For which the following treatment was administered: <em>${safe.treatment}</em>.</p>
        <p>The patient is advised <strong>${safe.recommendations}</strong> and is deemed unfit for work/duty for a period of <span class="duration">${durationDays} days</span>, from ${safe.startDate} to ${safe.endDate}.</p>
    </div>
    <div class="footer">
        <div>
            <div class="signature"></div>
            <p><strong>${safe.doctorName}</strong></p>
            <p style="font-size: 12px; text-transform: capitalize;">${safe.doctorRole}</p>
        </div>
        <div>
            <div style="width: 80px; height: 80px; border: 1px solid #ccc;"></div>
            <p style="font-size: 10px; color: #666;">Scan to verify</p>
        </div>
    </div>
    <div class="watermark">${safe.brandName}</div>
</body>
</html>`;
}
