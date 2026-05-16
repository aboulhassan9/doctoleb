/**
 * sampleRenderContext.js — Synthetic context used by the template editor's
 * live preview.
 *
 * Doctors building a `composite_text` field need to SEE what their template
 * will resolve to. We feed the editor's preview substitution this curated
 * "fake patient / fake doctor" bundle so the preview matches the renderer's
 * autofill shape without touching real PHI.
 *
 * Every value is intentionally unmistakeable as fake (date 1990-01-01, first
 * name "Sample") so a doctor never mistakes the preview for a live render.
 *
 * Keys here are the same `TEMPLATE_AUTOFILL_KEYS` the renderer resolves.
 * Adding a new binding to the closed set means adding it here too —
 * otherwise the editor preview drops it as "known-but-empty" and the doctor
 * sees a confusing blank.
 */

export const SAMPLE_BINDINGS = Object.freeze({
  'patient.full_name': 'Sample Patient',
  'patient.date_of_birth': '1990-01-01',
  'patient.sex': 'Female',
  'patient.gender': 'Female',
  'patient.phone': '+961 1 234 567',
  'patient.email': 'patient@example.com',
  'doctor.full_name': 'Dr. Sample Provider',
  'doctor.specialization': 'Internal Medicine',
  'doctor.license_number': 'LEB-00000',
  'clinic.name': 'Sample Clinic',
  'clinic.address': '123 Sample Street, Beirut',
  'clinic.phone': '+961 1 999 999',
  'tenant.display_name': 'Sample Tenant',
  'tenant.support_phone': '+961 1 888 888',
  'tenant.support_email': 'support@example.com',
  'tenant.timezone': 'Asia/Beirut',
  'encounter.chief_complaint': 'Routine follow-up',
  'encounter.summary': 'Stable; continue current regimen.',
  'encounter.started_at': '2026-05-15',
  'document.created_at': '2026-05-15',
});
