import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { TopBar, LoadingSkeleton, ErrorState, StatusBadge, ConfirmDialog } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { useBrand } from '@/contexts/BrandContext';
import {
  useEncounter,
  useDoctorEncounterTimeline,
  useEncounterNotes,
  useEncounterDiagnoses,
  useEncounterPrescriptions,
  useEncounterOrders,
  useEncounterCareTasks,
  useEncounterDocuments,
  useConfirmDialog,
  useDocumentTitle,
} from '@/hooks';
import {
  EncounterPatientContext,
  EncounterNotesTab,
  EncounterDiagnosesTab,
  EncounterPrescriptionsTab,
  EncounterOrdersTab,
  EncounterCareTasksTab,
  EncounterDocumentsTab,
} from '@/components/encounter';
import { TEXTAREA_CLASS, BUTTON_PRIMARY, BUTTON_SECONDARY, BUTTON_DANGER } from '@/lib/styles';

const TABS = [
  { id: 'patient', label: 'Patient', icon: 'person' },
  { id: 'notes', label: 'Notes', icon: 'edit_note' },
  { id: 'diagnoses', label: 'Diagnoses', icon: 'diagnosis' },
  { id: 'prescriptions', label: 'Rx', icon: 'medication' },
  { id: 'orders', label: 'Orders', icon: 'science' },
  { id: 'tasks', label: 'Tasks', icon: 'task_alt' },
  { id: 'documents', label: 'Docs', icon: 'description' },
];

export default function DoctorEncounterPage() {
  const { appointmentId, encounterId: routeEncounterId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { displayName } = useBrand();
  const [activeTab, setActiveTab] = useState('patient');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [completeSummary, setCompleteSummary] = useState('');
  const [showCompleteForm, setShowCompleteForm] = useState(false);

  useDocumentTitle('Encounter', displayName);

  // Core encounter hook
  const {
    encounter, patient, appointment, loading, error,
    isStarting, isCompleting, isCancelling,
    startEncounter, completeEncounter, cancelEncounter,
    refresh, user,
  } = useEncounter({ appointmentId, encounterId: routeEncounterId });

  // Derived state
  const encId = encounter?.id;
  const patId = encounter?.patient_id || patient?.id;
  const docId = encounter?.doctor_id;
  const userId = user?.id;
  const isActive = encounter?.status === 'in_progress';
  const isPlanned = encounter?.status === 'planned';
  const isTerminal = ['completed', 'cancelled', 'entered_in_error'].includes(encounter?.status);
  const canStart = !encounter || isPlanned;
  const canComplete = isActive;

  // Sub-hooks — only load when encounter exists
  const notesHook = useEncounterNotes(encId);
  const encounterScope = { encounterId: encId, patientId: patId };
  const timelineHook = useDoctorEncounterTimeline(patId, { pageSize: 5 });
  const diagnosesHook = useEncounterDiagnoses(encounterScope);
  const prescriptionsHook = useEncounterPrescriptions(encounterScope);
  const ordersHook = useEncounterOrders(encounterScope);
  const careTasksHook = useEncounterCareTasks(encounterScope);
  const documentsHook = useEncounterDocuments(encId);
  const draftDocuments = documentsHook.documents.filter((clinicalDocument) => clinicalDocument.status === 'draft');

  // Cancel confirmation dialog
  const cancelDialog = useConfirmDialog();

  const handleStart = async () => {
    const success = await startEncounter(chiefComplaint.trim() || null);
    if (success) {
      setChiefComplaint('');
      setActiveTab('notes');
    }
  };

  const hasBlockingDraftDocuments = () => {
    if (draftDocuments.length === 0) return false;

    const label = draftDocuments.length === 1 ? 'document' : 'documents';
    showToast(`Finalize or void ${draftDocuments.length} draft ${label} before completing this encounter.`, 'error');
    setActiveTab('documents');
    setShowCompleteForm(false);
    return true;
  };

  const handleComplete = async () => {
    if (hasBlockingDraftDocuments()) return;

    const summary = completeSummary.trim();
    if (notesHook.notes.length === 0 && !summary) {
      showToast('Add at least one clinical note or write a completion summary before completing this encounter.', 'error');
      return;
    }

    const success = await completeEncounter(summary || null);
    if (success) {
      setCompleteSummary('');
      setShowCompleteForm(false);
    }
  };

  const handleCancel = () => {
    cancelDialog.open(
      'Cancel Encounter',
      'This will permanently cancel the encounter. Clinical data already recorded will be preserved but the encounter cannot be resumed.',
      async () => {
        await cancelEncounter();
        cancelDialog.close();
      },
    );
  };

  // ── Loading / Error states ──
  if (loading) {
    return (
      <DashboardLayout role="doctor">
        <TopBar />
        <div className="flex-1 overflow-y-auto p-8">
          <LoadingSkeleton rows={8} />
        </div>
      </DashboardLayout>
    );
  }

  if (error && !encounter) {
    return (
      <DashboardLayout role="doctor">
        <TopBar />
        <div className="flex-1 overflow-y-auto p-8">
          <ErrorState
            message={error}
            onRetry={refresh}
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="doctor">
      <TopBar>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Back
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <h1 className="text-sm font-bold text-slate-900">Clinical Encounter</h1>
          {encounter && <StatusBadge status={encounter.status} />}
        </div>
      </TopBar>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

          {/* ── Start Encounter Banner ── */}
          {canStart && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-gradient-to-br from-primary to-blue-700 text-white p-6 shadow-lg shadow-primary/20"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">play_circle</span>
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold mb-1">Start Encounter</h2>
                  <p className="text-sm text-blue-100 mb-4">
                    {appointment
                      ? `Appointment for ${patient?.users?.first_name || 'patient'} is ready. Begin the clinical encounter to start documenting.`
                      : 'Begin a new clinical encounter for this appointment.'}
                  </p>
                  <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
                    <div className="flex-1 w-full sm:max-w-md">
                      <label className="text-xs text-blue-200 font-medium mb-1 block">Chief Complaint (optional)</label>
                      <textarea
                        value={chiefComplaint}
                        onChange={(e) => setChiefComplaint(e.target.value)}
                        placeholder="Enter the patient's chief complaint..."
                        rows={2}
                        className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder:text-blue-200 focus:outline-none focus:ring-2 focus:ring-white/30 resize-none"
                      />
                    </div>
                    <button
                      onClick={handleStart}
                      disabled={isStarting}
                      className="flex items-center gap-2 px-6 py-3 bg-white text-primary rounded-xl font-bold text-sm hover:bg-blue-50 transition-all disabled:opacity-50 shadow-md"
                    >
                      {isStarting ? (
                        <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                      ) : (
                        <span className="material-symbols-outlined text-lg">play_arrow</span>
                      )}
                      {isStarting ? 'Starting...' : 'Start Encounter'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Active Encounter Actions ── */}
          {encounter && !canStart && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {encounter.chief_complaint && (
                  <div className="bg-slate-50 rounded-xl px-4 py-2 border border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Chief Complaint</span>
                    <span className="text-sm text-slate-700">{encounter.chief_complaint}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {canComplete && !showCompleteForm && (
                  <>
                    <button onClick={handleCancel} disabled={isCancelling} className={`${BUTTON_DANGER} flex items-center gap-2 text-xs`}>
                      <span className="material-symbols-outlined text-sm">cancel</span>
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (!hasBlockingDraftDocuments()) setShowCompleteForm(true);
                      }}
                      className={`${BUTTON_PRIMARY} flex items-center gap-2`}
                    >
                      <span className="material-symbols-outlined text-lg">check_circle</span>
                      Complete Encounter
                    </button>
                  </>
                )}
                {isTerminal && (
                  <span className="text-xs font-medium text-slate-400">
                    This encounter is {encounter.status.replace(/_/g, ' ')} and read-only.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ── Complete Encounter Form ── */}
          {showCompleteForm && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="bg-emerald-50 rounded-xl border border-emerald-200 p-5 space-y-3">
              <h4 className="text-sm font-bold text-emerald-800">Complete Encounter</h4>
              <textarea value={completeSummary} onChange={(e) => setCompleteSummary(e.target.value)} placeholder="Encounter summary (optional)..." rows={3} className={TEXTAREA_CLASS} />
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowCompleteForm(false)} className={BUTTON_SECONDARY}>Cancel</button>
                <button onClick={handleComplete} disabled={isCompleting} className={`${BUTTON_PRIMARY} flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700`}>
                  {isCompleting && <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>}
                  Confirm Complete
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Tab Navigation ── */}
          {encounter && (
            <>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ── Tab Content ── */}
              <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                {activeTab === 'patient' && (
                  <EncounterPatientContext
                    encounter={encounter}
                    patient={patient}
                    previousEncounters={timelineHook.encounters}
                    historyLoading={timelineHook.loading}
                  />
                )}
                {activeTab === 'notes' && (
                  <EncounterNotesTab
                    notes={notesHook.notes} loading={notesHook.loading} isSaving={notesHook.isSaving}
                    onAddNote={notesHook.addNote} encounterId={encId} patientId={patId}
                    doctorId={docId} authorUserId={userId} isActive={isActive}
                  />
                )}
                {activeTab === 'diagnoses' && (
                  <EncounterDiagnosesTab
                    diagnoses={diagnosesHook.diagnoses} loading={diagnosesHook.loading} isSaving={diagnosesHook.isSaving}
                    onAddDiagnosis={diagnosesHook.addDiagnosis} encounterId={encId} patientId={patId}
                    doctorId={docId} recordedBy={userId} isActive={isActive}
                  />
                )}
                {activeTab === 'prescriptions' && (
                  <EncounterPrescriptionsTab
                    prescriptions={prescriptionsHook.prescriptions} loading={prescriptionsHook.loading} isSaving={prescriptionsHook.isSaving}
                    onAddPrescription={prescriptionsHook.addPrescription} encounterId={encId} patientId={patId}
                    doctorId={docId} prescribedBy={userId} isActive={isActive}
                    hasEncounterDiagnosis={diagnosesHook.diagnoses.length > 0}
                  />
                )}
                {activeTab === 'orders' && (
                  <EncounterOrdersTab
                    labOrders={ordersHook.labOrders} imagingOrders={ordersHook.imagingOrders}
                    loading={ordersHook.loading} isSaving={ordersHook.isSaving}
                    onCreateOrder={ordersHook.createOrder} encounterId={encId} patientId={patId}
                    doctorId={docId} orderedBy={userId} isActive={isActive}
                  />
                )}
                {activeTab === 'tasks' && (
                  <EncounterCareTasksTab
                    tasks={careTasksHook.tasks} loading={careTasksHook.loading} isSaving={careTasksHook.isSaving}
                    onCreateTask={careTasksHook.createTask} onUpdateTask={careTasksHook.updateTask}
                    encounterId={encId} patientId={patId} createdBy={userId} isActive={isActive}
                  />
                )}
                {activeTab === 'documents' && (
                  <EncounterDocumentsTab
                    documents={documentsHook.documents}
                    loading={documentsHook.loading}
                    isSaving={documentsHook.isSaving}
                    onCreateDocument={documentsHook.createDocument}
                    onFinalizeDocument={documentsHook.finalizeDocument}
                    encounterId={encId} patientId={patId} doctorId={docId}
                    createdBy={userId} isActive={isActive}
                  />
                )}
              </motion.div>
            </>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        isOpen={cancelDialog.isOpen}
        title={cancelDialog.title}
        message={cancelDialog.message}
        confirmLabel="Cancel Encounter"
        variant="danger"
        onConfirm={cancelDialog.onConfirm}
        onCancel={cancelDialog.close}
      />
    </DashboardLayout>
  );
}
