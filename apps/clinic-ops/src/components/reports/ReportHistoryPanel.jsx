import {
  parseClinicalReportSections,
  sanitizeClinicalReportText,
} from '@core/lib/clinicalReportBuilder';

function formatDate(value) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function documentLabel(documentType) {
  return String(documentType || 'document').replaceAll('_', ' ');
}

function displayDocumentTitle(document) {
  const cleanTitle = sanitizeClinicalReportText(document?.title)
    .replace(/^Seed\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleanTitle || 'Medical report';
}

export default function ReportHistoryPanel({ documents = [], loading = false, onUseAsBase, onCopySection }) {
  const previousReports = documents.filter((document) => document.document_type === 'report');
  const supportingDocuments = documents.filter((document) => document.document_type !== 'report').slice(0, 4);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-primary">Patient history</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">Reuse prior documentation</h2>
          <p className="mt-1 text-xs text-slate-500">Open old reports and copy useful sections instead of typing from scratch.</p>
        </div>
        <span className="rounded-full bg-slate-50 px-3 py-1 text-[11px] font-black text-slate-500">{documents.length} docs</span>
      </div>

      {loading ? (
        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">Loading prior documents...</div>
      ) : previousReports.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
          No previous medical reports found for this patient yet.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {previousReports.slice(0, 5).map((document) => {
            const parsedSections = parseClinicalReportSections(document.content);
            return (
              <article key={document.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900">{displayDocumentTitle(document)}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(document.created_at)} • {document.status || 'draft'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUseAsBase(document)}
                    className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-black text-white hover:brightness-110"
                  >
                    Use as base
                  </button>
                </div>
                {Object.keys(parsedSections).length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(parsedSections).map(([key]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => onCopySection(key, parsedSections[key])}
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:border-primary hover:text-primary"
                      >
                        Copy {key.replace(/[A-Z]/g, (value) => ` ${value.toLowerCase()}`)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {supportingDocuments.length > 0 ? (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Other documents</p>
          <div className="mt-2 grid gap-2">
            {supportingDocuments.map((document) => (
              <div key={document.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                <span className="truncate text-xs font-bold capitalize text-slate-700">{documentLabel(document.document_type)} — {displayDocumentTitle(document)}</span>
                <span className="shrink-0 text-[11px] text-slate-400">{formatDate(document.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
