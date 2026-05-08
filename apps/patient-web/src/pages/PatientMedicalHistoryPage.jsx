import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { logError } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { documentService } from '@/services/documents';
import { formatClinicDate, formatClinicTime } from '@/lib/time';
import PatientPageHeader from '@ui/components/patient/PatientPageHeader';
import { StatusBadge, Modal } from '@ui/components/ui';

// ── Constants ────────────────────────────────────────────────────────────

const TAB_FILTERS = Object.freeze({
  all: () => true,
  prescriptions: (d) => d.document_type === 'prescription',
  labs: (d) => d.document_type === 'lab_request' || d.document_type === 'lab_result',
  imaging: (d) => d.document_type === 'imaging_result',
  certificates: (d) => d.document_type === 'certificate',
  referrals: (d) => d.document_type === 'referral',
  reports: (d) => d.document_type === 'report',
});

const TAB_META = [
  { key: 'all', label: 'All', icon: '📋' },
  { key: 'prescriptions', label: 'Prescriptions', icon: '💊' },
  { key: 'labs', label: 'Lab Results', icon: '🧪' },
  { key: 'imaging', label: 'Imaging', icon: '🩻' },
  { key: 'certificates', label: 'Certificates', icon: '📜' },
  { key: 'referrals', label: 'Referrals', icon: '🏥' },
  { key: 'reports', label: 'Reports', icon: '📝' },
];

const DOC_TYPE_ICON = {
  prescription: '💊',
  lab_request: '🧪',
  lab_result: '🧪',
  imaging_result: '🩻',
  certificate: '📜',
  referral: '🏥',
  report: '📝',
  insurance_form: '🛡️',
  insurance_claim: '🛡️',
};

// `clinical_documents.status` enum is `draft | final | superseded | void`.
// Drafts are never patient-visible; everything else is shown (with `void`
// gated behind the "Show voided records" toggle so retracted records remain
// discoverable).
const VISIBLE_STATUSES = new Set(['final', 'void', 'superseded']);
const VOIDED_STATUS = 'void';

function formatDocumentTimestamp(value) {
  if (!value) return 'Date unknown';
  const date = formatClinicDate(value, { month: 'short', day: 'numeric', year: 'numeric' });
  const time = formatClinicTime(value);
  if (!date && !time) return 'Date unknown';
  return date && time ? `${date} at ${time}` : (date || time);
}

// ── Component ────────────────────────────────────────────────────────────

export default function PatientMedicalHistoryPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [allDocuments, setAllDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [openContentDoc, setOpenContentDoc] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const patientId = user?.patient_id;

  useEffect(() => {
    if (!patientId) return undefined;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await documentService.getByPatientId(patientId, { pageSize: 100 });
        if (cancelled) return;
        if (error) {
          showToast(error, 'error');
          setAllDocuments([]);
          return;
        }
        setAllDocuments(Array.isArray(data) ? data : []);
      } catch (err) {
        if (cancelled) return;
        logError('PatientMedicalHistoryPage:fetch', err);
        showToast('Failed to load medical history', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId, showToast]);

  const visibleDocuments = useMemo(() => allDocuments.filter((doc) => {
    if (!VISIBLE_STATUSES.has(doc.status)) return false;
    if (doc.status === VOIDED_STATUS && !includeArchived) return false;
    return true;
  }), [allDocuments, includeArchived]);

  const tabbedDocuments = useMemo(() => {
    const filter = TAB_FILTERS[activeTab] || TAB_FILTERS.all;
    return visibleDocuments.filter(filter);
  }, [visibleDocuments, activeTab]);

  // Single pass to compute all tab counts instead of N filter() calls.
  const tabCounts = useMemo(() => {
    const counts = Object.fromEntries(TAB_META.map((t) => [t.key, 0]));
    for (const doc of visibleDocuments) {
      for (const tab of TAB_META) {
        if (TAB_FILTERS[tab.key](doc)) counts[tab.key] += 1;
      }
    }
    return counts;
  }, [visibleDocuments]);

  const archivedCount = useMemo(
    () => allDocuments.filter((d) => d.status === VOIDED_STATUS).length,
    [allDocuments]
  );

  const handleDownload = useCallback(async (doc) => {
    if (downloadingId) return;
    setDownloadingId(doc.id);
    try {
      const { data, error } = await documentService.getDownloadUrl(doc.id);
      if (error || !data?.signedUrl) {
        showToast(error || 'No file is attached to this document yet.', 'error');
        return;
      }
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      logError('PatientMedicalHistoryPage:download', err);
      showToast('Could not generate a download link. Please try again.', 'error');
    } finally {
      setDownloadingId(null);
    }
  }, [downloadingId, showToast]);

  return (
    <div className="min-h-screen bg-background-light">
      <PatientPageHeader title="Medical History" subtitle="Your finalized clinical records" />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <LoadingState />
        ) : (
          <>
            <TabBar tabs={TAB_META} counts={tabCounts} activeTab={activeTab} onChange={setActiveTab} />

            <div className="mb-6 flex items-center justify-between gap-4">
              <p className="text-sm text-slate-500">
                Showing {tabbedDocuments.length} of {visibleDocuments.length}{' '}
                {activeTab === 'all' ? 'records' : activeTab}
              </p>
              {archivedCount > 0 && (
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeArchived}
                    onChange={(e) => setIncludeArchived(e.target.checked)}
                    className="rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  Show voided records ({archivedCount})
                </label>
              )}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-slate-200 p-6"
            >
              {tabbedDocuments.length > 0 ? (
                <div className="space-y-4">
                  {tabbedDocuments.map((doc) => (
                    <DocumentCard
                      key={doc.id}
                      doc={doc}
                      onDownload={() => handleDownload(doc)}
                      onViewContent={() => setOpenContentDoc(doc)}
                      isDownloading={downloadingId === doc.id}
                    />
                  ))}
                </div>
              ) : (
                <EmptyDocumentsState activeTab={activeTab} />
              )}
            </motion.div>

            {visibleDocuments.length > 0 && <SummaryStats counts={tabCounts} />}
          </>
        )}
      </main>

      <AnimatePresence>
        {openContentDoc && (
          <ContentModal doc={openContentDoc} onClose={() => setOpenContentDoc(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────

function TabBar({ tabs, counts, activeTab, onChange }) {
  return (
    <div className="flex gap-2 mb-6 border-b border-slate-200 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`px-5 py-3 font-semibold text-sm border-b-2 transition-all whitespace-nowrap ${
              isActive ? 'border-primary text-primary' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="mr-1.5" aria-hidden="true">{tab.icon}</span>
            {tab.label} ({counts[tab.key] ?? 0})
          </button>
        );
      })}
    </div>
  );
}

function DocumentCard({ doc, onDownload, onViewContent, isDownloading }) {
  const isVoided = doc.status === VOIDED_STATUS;
  const hasFile = Boolean(doc.file_url);
  const hasContent = Boolean(doc.content && String(doc.content).trim().length > 0);
  const icon = DOC_TYPE_ICON[doc.document_type] || '📋';
  const typeLabel = documentService.labels[doc.document_type] || doc.document_type;
  const finalizedDate = doc.finalized_at || doc.created_at;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-5 rounded-xl border transition-all ${
        isVoided
          ? 'bg-rose-50/40 border-rose-200'
          : 'bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200 hover:border-primary hover:shadow-lg'
      }`}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 text-xl ${
            isVoided ? 'bg-rose-100 text-rose-700' : 'bg-primary/10 text-primary'
          }`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className={`font-bold text-lg ${isVoided ? 'text-rose-900' : 'text-slate-900'}`}>
                {doc.title || typeLabel}
              </h3>
              <span className="px-2.5 py-1 bg-primary/10 text-primary text-[10px] font-bold uppercase rounded-full">
                {typeLabel}
              </span>
              <StatusBadge status={doc.status} size="sm" />
            </div>
            {hasContent && !isVoided && (
              <p className="text-sm text-slate-600 mb-2 line-clamp-2">{doc.content}</p>
            )}
            {isVoided && doc.void_reason && (
              <p className="text-sm text-rose-700 mb-2">
                <span className="font-semibold">Voided:</span> {doc.void_reason}
              </p>
            )}
            <p className="text-xs text-slate-500">
              {isVoided ? '🚫' : '📅'} {formatDocumentTimestamp(finalizedDate)}
            </p>
          </div>
        </div>

        {!isVoided && (
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            {hasContent && (
              <button
                onClick={onViewContent}
                className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-lg transition-all"
              >
                👁 View
              </button>
            )}
            {hasFile && (
              <button
                onClick={onDownload}
                disabled={isDownloading}
                className="px-4 py-2 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDownloading ? '…' : '📥 Download'}
              </button>
            )}
            {!hasFile && !hasContent && (
              <span className="text-xs text-slate-400 italic px-4 py-2">Empty document</span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ContentModal({ doc, onClose }) {
  const subtitle = `${documentService.labels[doc.document_type] || doc.document_type} · ${formatDocumentTimestamp(doc.finalized_at || doc.created_at)}`;
  return (
    <Modal isOpen onClose={onClose} title={doc.title} size="lg">
      <p className="text-xs text-slate-500 -mt-2 mb-4">{subtitle}</p>
      <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans leading-relaxed">
        {doc.content}
      </pre>
    </Modal>
  );
}

function LoadingState() {
  return (
    <div className="text-center py-16">
      <div className="inline-block w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin mb-3" />
      <p className="text-slate-500">Loading medical history…</p>
    </div>
  );
}

function EmptyDocumentsState({ activeTab }) {
  const label = activeTab === 'all' ? 'medical records' : activeTab;
  return (
    <div className="text-center py-16">
      <div className="text-5xl mb-4" aria-hidden="true">📭</div>
      <p className="text-slate-500 font-medium mb-2">No {label} yet</p>
      <p className="text-sm text-slate-400">
        Your {label} will appear here once your doctor finalizes them.
      </p>
    </div>
  );
}

function SummaryStats({ counts }) {
  const cards = [
    { key: 'prescriptions', label: 'Prescriptions', color: 'text-primary' },
    { key: 'labs', label: 'Lab Results', color: 'text-emerald-600' },
    { key: 'imaging', label: 'Imaging', color: 'text-indigo-600' },
    { key: 'certificates', label: 'Certificates', color: 'text-amber-600' },
    { key: 'referrals', label: 'Referrals', color: 'text-rose-600' },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-4"
    >
      {cards.map((card) => (
        <div
          key={card.key}
          className="bg-white rounded-2xl border border-slate-200 p-6 text-center hover:shadow-lg transition-all"
        >
          <p className={`text-3xl font-black mb-2 ${card.color}`}>{counts[card.key] ?? 0}</p>
          <p className="text-sm font-semibold text-slate-600">{card.label}</p>
        </div>
      ))}
    </motion.div>
  );
}
