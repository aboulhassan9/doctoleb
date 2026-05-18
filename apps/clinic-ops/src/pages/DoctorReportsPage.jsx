import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { logError } from '@/lib/logger';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import DashboardHeader from '@clinic-ops/components/dashboard/DashboardHeader';
import DashboardSettingsModals from '@clinic-ops/components/dashboard/DashboardSettingsModals';
import PatientReportPicker from '@clinic-ops/components/reports/PatientReportPicker';
import ReportFormSection from '@clinic-ops/components/reports/ReportFormSection';
import ReportHistoryPanel from '@clinic-ops/components/reports/ReportHistoryPanel';
import ReportPatientContext from '@clinic-ops/components/reports/ReportPatientContext';
import ReportSidebar from '@clinic-ops/components/reports/ReportSidebar';
import { Modal } from '@/components/ui';
import { patientService } from '@/services/patients';
import { documentService } from '@/services/documents';
import { clinicalService } from '@/services/clinical';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useBrand } from '@/contexts/BrandContext';
import { useDoctorProfile } from '@/hooks/features/useDoctorProfile';
import {
    CLINICAL_REPORT_PURPOSES,
    buildClinicalReportContent,
    buildClinicalSummarySnippets,
    getClinicalReportPurpose,
    getPatientDisplayName,
    getReportReadiness,
    parseClinicalReportSections,
} from '@core/lib/clinicalReportBuilder';

const EMPTY_SECTIONS = {
    medicalHistory: '',
    clinicalFindings: '',
    diagnosis: '',
    treatmentPlan: '',
    recommendations: '',
};

function formatDateTime(value) {
    if (!value) return 'Not saved yet';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not saved yet';
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function buildReportTitle({ patient, purposeCode }) {
    const patientName = getPatientDisplayName(patient);
    const purpose = getClinicalReportPurpose(purposeCode);
    return `${purpose.label} - ${patientName}`;
}

export default function DoctorReportsPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const patientIdFromUrl = searchParams.get('patientId') || '';
    const encounterIdFromUrl = searchParams.get('encounterId') || '';

    const [searchQuery, setSearchQuery] = useState('');
    const [sections, setSections] = useState(() => ({ ...EMPTY_SECTIONS }));
    const [showSuccess, setShowSuccess] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [purposeCode, setPurposeCode] = useState('general');
    const [sourceEncounterId, setSourceEncounterId] = useState(encounterIdFromUrl);
    const [sourceEncounter, setSourceEncounter] = useState(null);
    const [patientDocuments, setPatientDocuments] = useState([]);
    const [patientDiagnoses, setPatientDiagnoses] = useState([]);
    const [patientPrescriptions, setPatientPrescriptions] = useState([]);
    const [patientEncounters, setPatientEncounters] = useState([]);
    const [contextLoading, setContextLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [savedReportId, setSavedReportId] = useState(null);
    const [lastSavedAt, setLastSavedAt] = useState('');
    const [dirty, setDirty] = useState(false);

    const [showProfile, setShowProfile] = useState(false);
    const [showTheme, setShowTheme] = useState(false);
    const [showSecurity, setShowSecurity] = useState(false);

    const { user } = useAuth();
    const { showToast } = useToast();
    const { displayName } = useBrand();
    const { doctorId } = useDoctorProfile();

    useEffect(() => {
        if (!patientIdFromUrl || selectedPatient?.id === patientIdFromUrl) return;
        let cancelled = false;
        async function loadPatientFromUrl() {
            const { data, error } = await patientService.getById(patientIdFromUrl);
            if (cancelled) return;
            if (error) {
                showToast(error.message || error || 'Unable to load patient for this report.', 'error');
                return;
            }
            setSelectedPatient(data || null);
        }
        loadPatientFromUrl();
        return () => { cancelled = true; };
    }, [patientIdFromUrl, selectedPatient?.id, showToast]);

    useEffect(() => {
        setSourceEncounterId(encounterIdFromUrl);
    }, [encounterIdFromUrl]);

    useEffect(() => {
        if (!dirty) return undefined;
        function warnBeforeUnload(event) {
            event.preventDefault();
            event.returnValue = '';
        }
        window.addEventListener('beforeunload', warnBeforeUnload);
        return () => window.removeEventListener('beforeunload', warnBeforeUnload);
    }, [dirty]);

    useEffect(() => {
        if (!selectedPatient?.id) {
            setPatientDocuments([]);
            setPatientDiagnoses([]);
            setPatientPrescriptions([]);
            setPatientEncounters([]);
            setSourceEncounter(null);
            return undefined;
        }

        let cancelled = false;
        async function loadPatientContext() {
            setContextLoading(true);
            try {
                const [documentsRes, diagnosesRes, prescriptionsRes, encountersRes] = await Promise.all([
                    documentService.getByPatientId(selectedPatient.id, { pageSize: 12 }),
                    clinicalService.getDiagnoses(selectedPatient.id, { pageSize: 20 }),
                    clinicalService.getPrescriptions(selectedPatient.id, { status: 'active', pageSize: 20 }),
                    clinicalService.getEncountersByPatient(selectedPatient.id, { pageSize: 12 }),
                ]);

                if (cancelled) return;
                setPatientDocuments(documentsRes.data || []);
                setPatientDiagnoses(diagnosesRes.data || []);
                setPatientPrescriptions(prescriptionsRes.data || []);
                setPatientEncounters(encountersRes.data || []);

                if (sourceEncounterId) {
                    const localEncounter = (encountersRes.data || []).find((encounter) => encounter.id === sourceEncounterId);
                    if (localEncounter) {
                        setSourceEncounter(localEncounter);
                    } else {
                        const sourceRes = await clinicalService.getEncounterById(sourceEncounterId);
                        if (!cancelled) setSourceEncounter(sourceRes.data || null);
                    }
                } else {
                    setSourceEncounter(null);
                }
            } catch (error) {
                if (!cancelled) {
                    logError('Failed to load report patient context:', error);
                    showToast('Failed to load patient context for report.', 'error');
                }
            } finally {
                if (!cancelled) setContextLoading(false);
            }
        }

        loadPatientContext();
        return () => { cancelled = true; };
    }, [selectedPatient?.id, sourceEncounterId, showToast]);

    const readiness = getReportReadiness({
        patient: selectedPatient,
        doctorId,
        purposeCode,
        sections,
        sourceEncounter,
        savedReportId,
    });
    const snippets = buildClinicalSummarySnippets({
        patient: selectedPatient,
        diagnoses: patientDiagnoses,
        prescriptions: patientPrescriptions,
        encounters: patientEncounters,
        documents: patientDocuments,
    });

    function updateSection(key, value) {
        setSections((current) => ({ ...current, [key]: value }));
        setDirty(true);
    }

    function appendToSection(key, value) {
        const cleanValue = String(value || '').trim();
        if (!cleanValue) {
            showToast('No chart data is available for that insert.', 'error');
            return;
        }

        setSections((current) => ({
            ...current,
            [key]: [current[key], cleanValue].filter(Boolean).join(current[key] ? '\n\n' : ''),
        }));
        setDirty(true);
    }

    function handlePatientSelect(patient) {
        setSelectedPatient(patient);
        setSourceEncounterId('');
        setSourceEncounter(null);
        setSections({ ...EMPTY_SECTIONS });
        setSavedReportId(null);
        setLastSavedAt('');
        setDirty(false);
    }

    function handlePurposeChange(value) {
        setPurposeCode(value);
        setDirty(true);
    }

    function handleEncounterChange(encounterId) {
        setSourceEncounterId(encounterId);
        setSourceEncounter(patientEncounters.find((encounter) => encounter.id === encounterId) || null);
        setDirty(true);
    }

    function handleInsertSnippet(type) {
        if (type === 'medicalHistory') appendToSection('medicalHistory', snippets.medicalHistory);
        if (type === 'allergies') appendToSection('medicalHistory', snippets.allergies);
        if (type === 'diagnosisSummary') appendToSection('diagnosis', snippets.diagnosisSummary);
        if (type === 'activeMedications') appendToSection('treatmentPlan', snippets.activeMedications);
        if (type === 'latestEncounterSummary') appendToSection('clinicalFindings', snippets.latestEncounterSummary);
    }

    function handleUseDocumentAsBase(document) {
        const parsed = parseClinicalReportSections(document.content);
        if (Object.keys(parsed).length === 0) {
            showToast('This report does not contain reusable structured sections.', 'error');
            return;
        }
        setSections((current) => ({ ...current, ...parsed }));
        setDirty(true);
        showToast('Previous report sections copied into this draft.', 'success');
    }

    function handleCopySection(key, value) {
        setSections((current) => ({ ...current, [key]: value }));
        setDirty(true);
        showToast('Section copied from previous report.', 'success');
    }

    async function handleSave() {
        if (!readiness.canSave) {
            showToast(`Complete before saving: ${readiness.missingRequired.join(', ')}`, 'error');
            return;
        }
        if (!user?.id) {
            showToast('Your user profile is still loading. Please retry in a moment.', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const title = buildReportTitle({ patient: selectedPatient, purposeCode });
            const content = buildClinicalReportContent({
                patient: selectedPatient,
                purposeCode,
                sections,
                sourceEncounter,
            });
            const payload = {
                patient_id: selectedPatient.id,
                doctor_id: doctorId,
                encounter_id: sourceEncounter?.id || null,
                title,
                content,
                created_by: user.id,
            };

            const result = savedReportId
                ? await documentService.updateDraft(savedReportId, payload)
                : await documentService.createReport(payload);

            if (result.error) throw result.error;
            const saved = Array.isArray(result.data) ? result.data[0] : result.data;
            setSavedReportId(saved?.id || savedReportId || null);
            setLastSavedAt(new Date().toISOString());
            setDirty(false);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2500);
            const documentsRes = await documentService.getByPatientId(selectedPatient.id, { pageSize: 12 });
            setPatientDocuments(documentsRes.data || []);
        } catch (error) {
            logError('Failed to save report:', error);
            showToast(error.message || error || 'Failed to save report', 'error');
        } finally {
            setIsSaving(false);
        }
    }

    async function handleExport() {
        if (!savedReportId) {
            showToast('Save the report before exporting.', 'error');
            return;
        }
        const { data, error } = await documentService.getDownloadUrl(savedReportId);
        if (error || !data) {
            showToast('No rendered PDF artifact exists for this draft yet.', 'error');
            return;
        }
        window.open(data.signedUrl || data.signedURL || data, '_blank', 'noopener,noreferrer');
    }

    function handlePrintDraft() {
        if (!savedReportId) {
            showToast('Save the draft before printing so the report has a stable record reference.', 'error');
            return;
        }
        window.print();
    }

    const doctorDisplayName = user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Doctor';
    const purpose = getClinicalReportPurpose(purposeCode);

    return (
        <DashboardLayout role="doctor">
            <DashboardHeader
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onOpenProfile={() => setShowProfile(true)}
                onOpenTheme={() => setShowTheme(true)}
                onOpenSecurity={() => setShowSecurity(true)}
            />

            <div className="flex-1 overflow-y-auto bg-[#f8faf7] p-6 pb-12 lg:p-8">
                <div className="mx-auto max-w-7xl">
                    <div className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b-4 border-primary pb-6">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Clinical document builder</span>
                            <h1 className="mt-1 text-[30px] font-black uppercase leading-none tracking-tighter text-slate-900">Medical Report Workspace</h1>
                            <p className="mt-2 max-w-2xl text-sm text-slate-500">Build reports from verified patient data, prior documents, and current encounter context.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                onClick={handlePrintDraft}
                                disabled={!savedReportId}
                                title={savedReportId ? 'Print the saved draft workspace.' : 'Save the draft first so the print has a stable record reference.'}
                                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition-all hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:border-slate-200"
                            >
                                <span className="material-symbols-outlined text-lg">print</span> Print saved draft
                            </button>
                            <button type="button" disabled={isSaving} onClick={handleSave} className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
                                <span className="material-symbols-outlined text-lg">save</span> {savedReportId ? 'Update Draft' : 'Save Draft'}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                        <div className="space-y-6 lg:col-span-8">
                            <PatientReportPicker selectedPatient={selectedPatient} onSelect={handlePatientSelect} />

                            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-primary">Report purpose</p>
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                    {CLINICAL_REPORT_PURPOSES.map((item) => (
                                        <button
                                            key={item.code}
                                            type="button"
                                            onClick={() => handlePurposeChange(item.code)}
                                            className={`rounded-xl border p-4 text-left transition ${purposeCode === item.code ? 'border-primary bg-primary/5 ring-4 ring-primary/10' : 'border-slate-200 bg-white hover:border-primary/50'}`}
                                        >
                                            <p className="text-sm font-black text-slate-950">{item.label}</p>
                                            <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.description}</p>
                                        </button>
                                    ))}
                                </div>
                            </section>

                            <ReportPatientContext
                                patient={selectedPatient}
                                encounters={patientEncounters}
                                selectedEncounterId={sourceEncounterId}
                                diagnoses={patientDiagnoses}
                                prescriptions={patientPrescriptions}
                                onEncounterChange={handleEncounterChange}
                                onOpenTimeline={() => selectedPatient?.id && navigate(`/doctor-patient-history/${selectedPatient.id}`)}
                                onInsert={handleInsertSnippet}
                            />

                            <ReportHistoryPanel
                                documents={patientDocuments}
                                loading={contextLoading}
                                onUseAsBase={handleUseDocumentAsBase}
                                onCopySection={handleCopySection}
                            />

                            <div className="space-y-6">
                                <ReportFormSection
                                    icon="history_edu"
                                    title="Medical History"
                                    value={sections.medicalHistory}
                                    onChange={(value) => updateSection('medicalHistory', value)}
                                    rows={4}
                                    actions={[
                                        { label: 'Insert chart history', onClick: () => handleInsertSnippet('medicalHistory'), disabled: !snippets.medicalHistory, disabledReason: 'No medical history recorded for this patient.' },
                                        { label: 'Insert allergies', onClick: () => handleInsertSnippet('allergies'), disabled: !snippets.allergies, disabledReason: 'No allergies recorded.' },
                                    ]}
                                />
                                <ReportFormSection
                                    icon="stethoscope"
                                    title="Clinical Findings"
                                    value={sections.clinicalFindings}
                                    onChange={(value) => updateSection('clinicalFindings', value)}
                                    rows={5}
                                    actions={[
                                        { label: 'Insert latest visit', onClick: () => handleInsertSnippet('latestEncounterSummary'), disabled: !snippets.latestEncounterSummary, disabledReason: 'No encounter summary available.' },
                                    ]}
                                />
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <ReportFormSection
                                        icon="vital_signs"
                                        title="Diagnosis"
                                        value={sections.diagnosis}
                                        onChange={(value) => updateSection('diagnosis', value)}
                                        rows={4}
                                        bold
                                        actions={[
                                            { label: 'Insert diagnoses', onClick: () => handleInsertSnippet('diagnosisSummary'), disabled: !snippets.diagnosisSummary, disabledReason: 'No diagnoses recorded.' },
                                        ]}
                                    />
                                    <ReportFormSection
                                        icon="medical_information"
                                        title="Treatment Plan"
                                        value={sections.treatmentPlan}
                                        onChange={(value) => updateSection('treatmentPlan', value)}
                                        rows={4}
                                        actions={[
                                            { label: 'Insert active meds', onClick: () => handleInsertSnippet('activeMedications'), disabled: !snippets.activeMedications, disabledReason: 'No active prescriptions recorded.' },
                                        ]}
                                    />
                                </div>
                                <ReportFormSection
                                    icon="assignment_turned_in"
                                    title="Recommendations"
                                    value={sections.recommendations}
                                    onChange={(value) => updateSection('recommendations', value)}
                                    rows={4}
                                />
                            </div>
                        </div>

                        <ReportSidebar
                            reportId={savedReportId}
                            purpose={purpose}
                            readiness={readiness}
                            documents={patientDocuments}
                            lastSavedAt={dirty ? 'Unsaved changes' : formatDateTime(lastSavedAt)}
                            onExport={handleExport}
                        />
                    </div>

                    <footer className="mt-12 grid grid-cols-1 gap-6 border-t border-slate-200 pt-8 md:grid-cols-3 md:items-end">
                        <div className="space-y-1">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Authorized Signatory</label>
                            <p className="text-xl font-black text-slate-900">{doctorDisplayName}</p>
                            <p className="text-xs text-slate-500">{user?.role || 'Physician'}</p>
                        </div>
                        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center">
                            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Signature Position</label>
                            <p className="text-xs leading-relaxed text-slate-500">Final signature belongs in the rendered document preview, not in a disconnected side widget.</p>
                        </div>
                        <div className="space-y-1 text-left md:text-right">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Report Date</label>
                            <p className="text-xl font-bold text-slate-900">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                            <p className="text-xs text-slate-500">Generated via {displayName}</p>
                        </div>
                    </footer>
                </div>
            </div>

            <Modal isOpen={showSuccess} onClose={() => setShowSuccess(false)} size="sm">
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                        <span className="material-symbols-outlined text-4xl text-green-600">check</span>
                    </div>
                    <p className="text-lg font-bold text-slate-900">Report draft saved.</p>
                    <p className="text-sm text-slate-500">The draft is now in clinical documents and can be updated before final signing/export.</p>
                    <button type="button" onClick={() => setShowSuccess(false)} className="rounded-lg bg-slate-100 px-6 py-2 text-slate-600 hover:bg-slate-200">
                        Close
                    </button>
                </div>
            </Modal>

            <DashboardSettingsModals
                showProfile={showProfile}
                showTheme={showTheme}
                showSecurity={showSecurity}
                onCloseProfile={() => setShowProfile(false)}
                onCloseTheme={() => setShowTheme(false)}
                onCloseSecurity={() => setShowSecurity(false)}
            />
        </DashboardLayout>
    );
}
