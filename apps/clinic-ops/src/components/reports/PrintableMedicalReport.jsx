import {
  CLINICAL_REPORT_SECTIONS,
  getPatientIdentitySummary,
  sanitizeClinicalReportText,
} from '@core/lib/clinicalReportBuilder';

function formatDate(value) {
  if (!value) return 'Not documented';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not documented';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatReportReference(reportId) {
  if (!reportId) return 'Draft pending save';
  return `RPT-${String(reportId).replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

function sectionBody(value) {
  const text = sanitizeClinicalReportText(value);
  return text || 'Not documented.';
}

export default function PrintableMedicalReport({
  patient,
  purpose,
  sections,
  sourceEncounter,
  doctorName,
  doctorRole,
  clinicName,
  reportId,
  generatedAt,
}) {
  const identity = getPatientIdentitySummary(patient, { now: generatedAt ? new Date(generatedAt) : new Date() });
  const generatedDate = formatDate(generatedAt);

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 14mm 13mm 16mm;
          }

          html,
          body,
          #root,
          #root > div,
          #root main {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
            display: block !important;
          }

          body {
            margin: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body * {
            visibility: hidden !important;
          }

          .doctor-report-print-document,
          .doctor-report-print-document * {
            visibility: visible !important;
          }

          .doctor-report-print-document {
            display: block !important;
            position: static !important;
            width: auto !important;
            max-width: none !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            color: #0f172a !important;
            background: #ffffff !important;
            box-shadow: none !important;
            font-family: "Fira Sans", Arial, sans-serif !important;
          }

          .doctor-report-print-document .avoid-break {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .doctor-report-print-document .report-section {
            break-inside: auto;
            page-break-inside: auto;
          }

          .doctor-report-print-document .signature-block {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <article className="doctor-report-print-document print-only bg-white text-slate-950">
        <header className="avoid-break border-b-4 border-primary pb-5">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">{clinicName}</p>
              <h1 className="mt-2 text-3xl font-black uppercase leading-tight tracking-tight">{purpose?.documentTitle || 'Medical Report'}</h1>
              <p className="mt-1 text-xs italic text-slate-500">{purpose?.description || 'Confidential clinical document for authorized medical use only.'}</p>
            </div>
            <div className="min-w-48 rounded-lg border border-slate-200 p-3 text-right">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Reference</p>
              <p className="mt-1 font-mono text-sm font-black text-slate-900">{formatReportReference(reportId)}</p>
              <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Date</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{generatedDate}</p>
            </div>
          </div>
        </header>

        <section className="avoid-break mt-6 rounded-xl border border-slate-200 p-4">
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Patient</p>
              <p className="mt-1 text-lg font-black text-slate-950">{identity?.name || 'Patient not selected'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Report Purpose</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{purpose?.label || 'Medical report'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Prepared For</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{purpose?.audience || 'Authorized recipient'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Date of Birth / Age</p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {identity?.dateOfBirth || 'Not recorded'}{identity?.age !== null && identity?.age !== undefined ? ` / ${identity.age} years` : ''}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Sex / Blood Type</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{[identity?.sex, identity?.bloodType].filter(Boolean).join(' / ') || 'Not recorded'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Document Use</p>
              <p className="mt-1 text-sm font-bold leading-relaxed text-slate-900">{purpose?.useCase || 'Clinical documentation.'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Allergies</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{identity?.allergies || 'No allergies recorded'}</p>
            </div>
            {sourceEncounter?.id ? (
              <div className="col-span-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Source Encounter</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{sanitizeClinicalReportText(sourceEncounter.chief_complaint || sourceEncounter.summary) || sourceEncounter.id}</p>
              </div>
            ) : null}
          </div>
        </section>

        <div className="mt-6 space-y-5">
          {CLINICAL_REPORT_SECTIONS.map((section) => (
            <section key={section.key} className="report-section">
              <h2 className="border-b border-slate-300 pb-1 text-[12px] font-black uppercase tracking-[0.18em] text-slate-700">{section.title}</h2>
              <p className="mt-3 whitespace-pre-wrap text-[13px] leading-7 text-slate-900">{sectionBody(sections?.[section.key])}</p>
            </section>
          ))}
        </div>

        <footer className="signature-block mt-12 grid grid-cols-2 gap-10 border-t border-slate-300 pt-8">
          <div>
            <div className="h-12 border-b border-slate-800" />
            <p className="mt-2 text-sm font-black text-slate-950">{doctorName || 'Doctor'}</p>
            <p className="text-xs capitalize text-slate-500">{doctorRole || 'Physician'}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Generated by</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{clinicName}</p>
            <p className="mt-5 text-[10px] leading-relaxed text-slate-500">
              This printout is a draft unless it is finalized and signed through the clinical document workflow.
            </p>
          </div>
        </footer>
      </article>
    </>
  );
}
