import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ClipboardList,
  Download,
  Eye,
  FileText,
  FlaskConical,
  Images,
  ScrollText,
  Stethoscope,
} from 'lucide-react';
import { patientTimelineService } from '@core/services/patientTimeline';
import { documentService } from '@core/services/documents';
import { formatClinicDate, formatClinicTime } from '@core/lib/time';
import { logError } from '@core/lib/logger';
import { useAuth } from '@ui/contexts/AuthContext';
import { useToast } from '@ui/contexts/ToastContext';
import { PatientPortalShell } from '@ui/components/patient/PatientPortalShell';
import { Modal } from '@ui/components/ui';
import { patientFadeRise, patientStagger } from '@ui/styles/patientMotion';

const TAB_META = [
  { key: 'all', label: 'All records', icon: ClipboardList, match: () => true },
  { key: 'reports', label: 'Reports', icon: ScrollText, match: (doc) => doc.document_type === 'report' },
  { key: 'prescriptions', label: 'Prescriptions', icon: Stethoscope, match: (doc) => doc.document_type === 'prescription' },
  { key: 'labs', label: 'Labs', icon: FlaskConical, match: (doc) => doc.document_type === 'lab_request' || doc.document_type === 'lab_result' },
  { key: 'imaging', label: 'Imaging', icon: Images, match: (doc) => doc.document_type === 'imaging_result' },
  { key: 'forms', label: 'Forms', icon: FileText, match: (doc) => ['certificate', 'referral', 'insurance_form', 'insurance_claim'].includes(doc.document_type) },
];

function formatTimelineTimestamp(value) {
  if (!value) return 'Date unknown';
  const date = formatClinicDate(value, { month: 'short', day: 'numeric', year: 'numeric' });
  const time = formatClinicTime(value);
  return [date, time].filter(Boolean).join(' at ') || 'Date unknown';
}

function filterTimelineGroups(groups, activeTab) {
  const tab = TAB_META.find((item) => item.key === activeTab) || TAB_META[0];
  return (groups || [])
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => tab.match(item.source || {})),
    }))
    .filter((group) => group.items.length > 0);
}

function TimelineSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading care timeline">
      {[0, 1, 2].map((index) => (
        <div key={index} className="h-32 animate-pulse rounded-xl bg-[var(--patient-wash)]" />
      ))}
    </div>
  );
}

function EmptyTimeline({ activeTab }) {
  const label = TAB_META.find((tab) => tab.key === activeTab)?.label || 'records';
  return (
    <div className="patient-inset border border-dashed border-[var(--patient-outline)] p-8 text-center">
      <ClipboardList className="mx-auto h-10 w-10 text-[var(--patient-sage)]" />
      <h3 className="patient-display mt-4 text-2xl font-medium tracking-tight text-[var(--patient-ink)]">
        No {label.toLowerCase()} yet.
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-[var(--patient-muted)]">
        Finalized clinical documents and approved records will appear here after the clinic shares them.
      </p>
    </div>
  );
}

function TimelineItem({ item, onView, onDownload, downloadingId }) {
  const doc = item.source || {};
  const hasContent = Boolean(doc.content && String(doc.content).trim().length > 0);
  const hasFile = Boolean(doc.file_url);
  const isDownloading = downloadingId === item.id;

  return (
    <article className="patient-inset relative p-5">
      <span aria-hidden="true" className="absolute -left-[1.68rem] top-7 h-3 w-3 rounded-full border-2 border-[var(--patient-surface)] bg-[var(--patient-sage)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--patient-sage)_12%,transparent)]" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="patient-status-sage uppercase tracking-wide">
              {item.label}
            </span>
            <span className="patient-status-muted">
              {item.status}
            </span>
          </div>
          <h3 className="patient-display mt-3 text-2xl font-medium tracking-tight text-[var(--patient-ink)]">
            {item.title}
          </h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--patient-muted)]">
            {formatTimelineTimestamp(item.occurredAt)}
            {item.doctor ? ` · ${item.doctor}` : ''}
          </p>
          {hasContent ? (
            <p className="mt-3 line-clamp-2 text-sm font-semibold leading-6 text-[color-mix(in_srgb,var(--patient-muted)_80%,transparent)]">
              {doc.content}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {hasContent ? (
            <button
              type="button"
              onClick={() => onView(doc)}
              className="patient-button-secondary px-4 py-2 text-xs"
            >
              <Eye className="h-4 w-4" />
              View
            </button>
          ) : null}
          {hasFile ? (
            <button
              type="button"
              onClick={() => onDownload(doc)}
              disabled={isDownloading}
              className="patient-button-primary px-4 py-2 text-xs disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {isDownloading ? 'Opening...' : 'Download'}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ContentModal({ doc, onClose }) {
  const subtitle = `${documentService.labels[doc.document_type] || doc.document_type} · ${formatTimelineTimestamp(doc.finalized_at || doc.created_at)}`;
  return (
    <Modal isOpen onClose={onClose} title={doc.title || 'Clinical document'} size="lg">
      <p className="-mt-2 mb-4 text-xs font-bold text-[color-mix(in_srgb,var(--patient-muted)_70%,transparent)]">{subtitle}</p>
      <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-[var(--patient-muted)]">
        {doc.content}
      </pre>
    </Modal>
  );
}

export default function PatientMedicalHistoryPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [openContentDoc, setOpenContentDoc] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadTimeline = async () => {
      if (!user?.patient_id) {
        setTimeline(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const result = await patientTimelineService.getTimeline({ patientId: user.patient_id, pageSize: 100 });
      if (cancelled) return;

      if (result.error) {
        showToast(result.error, 'error');
        setTimeline(null);
      } else {
        setTimeline(result.data);
      }
      setLoading(false);
    };

    void loadTimeline();
    return () => {
      cancelled = true;
    };
  }, [user?.patient_id, showToast]);

  const counts = useMemo(() => {
    const items = timeline?.items || [];
    return Object.fromEntries(TAB_META.map((tab) => [
      tab.key,
      items.filter((item) => tab.match(item.source || {})).length,
    ]));
  }, [timeline?.items]);

  const visibleGroups = useMemo(
    () => filterTimelineGroups(timeline?.groups || [], activeTab),
    [timeline?.groups, activeTab]
  );

  const handleDownload = useCallback(async (doc) => {
    if (!doc?.id || downloadingId) return;
    setDownloadingId(doc.id);
    try {
      const { data, error } = await documentService.getDownloadUrl(doc.id);
      if (error || !data?.signedUrl) {
        showToast(error || 'No file is attached to this document yet.', 'error');
        return;
      }
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      logError('PatientMedicalHistoryPage.download', err);
      showToast('Could not generate a download link. Please try again.', 'error');
    } finally {
      setDownloadingId(null);
    }
  }, [downloadingId, showToast]);

  return (
    <PatientPortalShell title="Care Timeline" subtitle="Finalized records shared by your clinic">
        <motion.section
          variants={patientStagger}
          initial="hidden"
          animate="visible"
          className="mb-8 grid gap-6 lg:grid-cols-[1fr_auto]"
        >
          <motion.div variants={patientFadeRise}>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--patient-sage)]">Clinical record</p>
            <h1 className="patient-display mt-3 max-w-3xl text-5xl font-medium leading-[0.98] tracking-tight text-[var(--patient-ink)]">
              A timeline, not a file cabinet.
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-[var(--patient-muted)]">
              The patient app shows finalized, patient-safe documents in date order. Drafts and retracted clinical work stay out of this surface.
            </p>
          </motion.div>
        </motion.section>

        <motion.nav
          variants={patientFadeRise}
          initial="hidden"
          animate="visible"
          className="mb-6 flex gap-2 overflow-x-auto"
          aria-label="Care timeline filters"
        >
          {TAB_META.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`patient-focus inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-3 text-sm font-black transition ${
                  isActive
                    ? 'bg-[var(--patient-sage)] text-white shadow-sm'
                    : 'border border-[var(--patient-outline)] bg-[color-mix(in_srgb,var(--patient-surface)_80%,transparent)] text-[var(--patient-muted)] hover:border-[color-mix(in_srgb,var(--patient-sage)_40%,transparent)] hover:text-[var(--patient-ink)]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label} ({counts[tab.key] || 0})
              </button>
            );
          })}
        </motion.nav>

        <motion.section
          variants={patientFadeRise}
          initial="hidden"
          animate="visible"
          className="patient-paper-strong patient-surface p-6"
          aria-busy={loading}
        >
          {loading ? (
            <TimelineSkeleton />
          ) : visibleGroups.length ? (
            <div className="space-y-8">
              {visibleGroups.map((group) => (
                <section key={group.key} className="relative pl-7">
                  <span aria-hidden="true" className="absolute bottom-0 left-1 top-9 w-px bg-[var(--patient-outline)]" />
                  <p className="mb-4 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--patient-clay)]">
                    {group.date ? formatClinicDate(group.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'Undated'}
                  </p>
                  <div className="space-y-4">
                    {group.items.map((item) => (
                      <TimelineItem
                        key={item.id}
                        item={item}
                        onView={setOpenContentDoc}
                        onDownload={handleDownload}
                        downloadingId={downloadingId}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <EmptyTimeline activeTab={activeTab} />
          )}
        </motion.section>


      <AnimatePresence>
        {openContentDoc ? (
          <ContentModal doc={openContentDoc} onClose={() => setOpenContentDoc(null)} />
        ) : null}
      </AnimatePresence>
    </PatientPortalShell>
  );
}
