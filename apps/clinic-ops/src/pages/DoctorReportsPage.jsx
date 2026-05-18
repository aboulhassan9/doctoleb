import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { logError } from '@/lib/logger';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import DashboardHeader from '@clinic-ops/components/dashboard/DashboardHeader';
import DashboardSettingsModals from '@clinic-ops/components/dashboard/DashboardSettingsModals';
import PatientReportPicker from '@clinic-ops/components/reports/PatientReportPicker';
import PrintableMedicalReport from '@clinic-ops/components/reports/PrintableMedicalReport';
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
    buildSuggestedClinicalReportSections,
    getClinicalReportPurpose,
    getPatientDisplayName,
    getReportReadiness,
    getReportSectionPresentation,
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
    return `${purpose.documentTitle || purpose.label} - ${patientName}`;
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
    const [isExporting, setIsExporting] = useState(false);
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
    const suggestedDraft = buildSuggestedClinicalReportSections({
        purposeCode,
        snippets,
        existingSections: sections,
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

    function handleBuildSuggestedDraft() {
        if (!selectedPatient?.id) {
            showToast('Choose a patient first.', 'error');
            return;
        }
        if (!suggestedDraft.hasSuggestions) {
            showToast('No verified chart data is available for this patient yet.', 'error');
            return;
        }

        setSections(suggestedDraft.sections);
        setDirty(true);
        const filledCount = suggestedDraft.filledSections.length;
        const missingCount = suggestedDraft.missingRequired.length;
        const message = missingCount
            ? `Draft started from chart data. Review ${missingCount} required section${missingCount === 1 ? '' : 's'}.`
            : `Draft started from chart data with ${filledCount} section${filledCount === 1 ? '' : 's'}.`;
        showToast(message, missingCount ? 'info' : 'success');
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

    async function persistDraft({ showSuccessModal = true } = {}) {
        if (!readiness.canSave) {
            showToast(`Complete before saving: ${readiness.missingRequired.join(', ')}`, 'error');
            return null;
        }
        if (!user?.id) {
            showToast('Your user profile is still loading. Please retry in a moment.', 'error');
            return null;
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
            const nextReportId = saved?.id || savedReportId || null;
            setSavedReportId(nextReportId);
            const savedAt = new Date().toISOString();
            setLastSavedAt(savedAt);
            setDirty(false);
            if (showSuccessModal) {
                setShowSuccess(true);
                setTimeout(() => setShowSuccess(false), 2500);
            }
            const documentsRes = await documentService.getByPatientId(selectedPatient.id, { pageSize: 12 });
            setPatientDocuments(documentsRes.data || []);
            return nextReportId;
        } catch (error) {
            logError('Failed to save report:', error);
            showToast(error.message || error || 'Failed to save report', 'error');
            return null;
        } finally {
            setIsSaving(false);
        }
    }

    async function handleSave() {
        await persistDraft({ showSuccessModal: true });
    }

    async function ensureSavedBeforeOutput() {
        if (savedReportId && !dirty) return savedReportId;
        return persistDraft({ showSuccessModal: false });
    }

    async function handleExportPdf() {
        const reportId = await ensureSavedBeforeOutput();
        if (!reportId) return;

        setIsExporting(true);
        try {
            const { data, error } = await documentService.getDownloadUrl(reportId);
            const artifactUrl = typeof data === 'string' ? data : data?.signedUrl || data?.signedURL;
            if (!error && artifactUrl) {
                window.open(artifactUrl, '_blank', 'noopener,noreferrer');
                return;
            }

            showToast('Rendered PDF is not ready yet. Opening print dialog; choose Save as PDF.', 'info');
            setTimeout(() => window.print(), 100);
        } catch (error) {
            logError('Failed to export report PDF:', error);
            showToast('PDF renderer unavailable. Opening print dialog; choose Save as PDF.', 'info');
            setTimeout(() => window.print(), 100);
        } finally {
            setIsExporting(false);
        }
    }

    async function handlePrintReport() {
        const reportId = await ensureSavedBeforeOutput();
        if (!reportId) {
            return;
        }
        setTimeout(() => window.print(), 100);
    }

    const doctorDisplayName = user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Doctor';
    const purpose = getClinicalReportPurpose(purposeCode);
    const reportGeneratedAt = lastSavedAt || new Date().toISOString();
    const sectionPresentation = Object.fromEntries(
        Object.keys(EMPTY_SECTIONS).map((key) => [key, getReportSectionPresentation(key, purposeCode)])
    );

    return (
        <DashboardLayout role="doctor">
            <div className="report-builder-workspace print-hidden contents">
                <DashboardHeader
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    onOpenProfile={() => setShowProfile(true)}
                    onOpenTheme={() => setShowTheme(true)}
                    onOpenSecurity={() => setShowSecurity(true)}
                />
            </div>

            <PrintableMedicalReport
                patient={selectedPatient}
                purpose={purpose}
                sections={sections}
                sourceEncounter={sourceEncounter}
                doctorName={doctorDisplayName}
                doctorRole={user?.role || 'Physician'}
                clinicName={displayName}
                reportId={savedReportId}
                generatedAt={reportGeneratedAt}
            />

            <div className="report-builder-workspace print-hidden flex-1 overflow-y-auto bg-[#f8faf7] p-4 pb-10 lg:p-6">
                <div className="mx-auto max-w-6xl">
                    <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b-4 border-primary pb-5">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Clinical report</span>
                            <h1 className="mt-1 text-3xl font-black leading-none tracking-tighter text-slate-950">{purpose.documentTitle}</h1>
                            <p className="mt-2 max-w-xl text-sm font-medium text-slate-500">Build from chart data, review only what matters, then save or export.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                onClick={handlePrintReport}
                                disabled={isSaving || !readiness.canSave}
                                title={readiness.canSave ? 'Print the clean medical report document.' : 'Complete required report fields before printing.'}
                                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition-all hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:border-slate-200"
                            >
                                <span className="material-symbols-outlined text-lg">print</span> Print report
                            </button>
                            <button
                                type="button"
                                onClick={handleExportPdf}
                                disabled={isSaving || isExporting || !readiness.canSave}
                                title={readiness.canSave ? 'Export rendered PDF or open Save as PDF print fallback.' : 'Complete required report fields before exporting.'}
                                className="flex items-center gap-2 rounded-lg border border-primary/30 bg-white px-4 py-2 text-sm font-bold text-primary shadow-sm transition-all hover:bg-primary/5 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                            >
                                <span className="material-symbols-outlined text-lg">picture_as_pdf</span> {isExporting ? 'Preparing PDF...' : 'Export PDF'}
                            </button>
                            <button type="button" disabled={isSaving} onClick={handleSave} className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
                                <span className="material-symbols-outlined text-lg">save</span> {savedReportId ? 'Update Draft' : 'Save Draft'}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                        <div className="space-y-5 lg:col-span-8">
                            <section className="rounded-2xl border border-primary/20 bg-white p-4 shadow-sm">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-primary">Fast start</p>
                                        <h2 className="mt-1 text-lg font-black text-slate-950">Create the first draft in one click</h2>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleBuildSuggestedDraft}
                                        disabled={!selectedPatient?.id || contextLoading || !suggestedDraft.hasSuggestions}
                                        title={!selectedPatient?.id ? 'Choose a patient first.' : !suggestedDraft.hasSuggestions ? 'No verified chart data available yet.' : 'Fill empty sections from verified patient chart data.'}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-950/10 transition hover:bg-primary disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
                                    >
                                        <span className="material-symbols-outlined text-lg">auto_awesome</span>
                                        Build from chart
                                    </button>
                                </div>
                                <div className="mt-4 grid gap-2 md:grid-cols-3">
                                    <div className={`rounded-xl border px-3 py-2 ${selectedPatient?.id ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                                        <p className="text-[10px] font-black uppercase tracking-wider">Patient</p>
                                        <p className="truncate text-sm font-black">{selectedPatient ? getPatientDisplayName(selectedPatient) : 'Choose patient'}</p>
                                    </div>
                                    <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-primary">
                                        <p className="text-[10px] font-black uppercase tracking-wider">Recipient</p>
                                        <p className="truncate text-sm font-black">{purpose.audience}</p>
                                    </div>
                                    <div className={`rounded-xl border px-3 py-2 ${suggestedDraft.hasSuggestions ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                                        <p className="text-[10px] font-black uppercase tracking-wider">Chart data</p>
                                        <p className="truncate text-sm font-black">{suggestedDraft.hasSuggestions ? `${suggestedDraft.filledSections.length} ready sections` : 'Needs records'}</p>
                                    </div>
                                </div>
                            </section>

                            <PatientReportPicker selectedPatient={selectedPatient} onSelect={handlePatientSelect} />

                            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="flex flex-wrap items-end justify-between gap-3">
                                    <div>
                                        <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-primary">Recipient</p>
                                        <h2 className="mt-1 text-lg font-black text-slate-950">Who will use this?</h2>
                                    </div>
                                    <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-primary">{purpose.audience}</span>
                                </div>
                                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                    {CLINICAL_REPORT_PURPOSES.map((item) => (
                                        <button
                                            key={item.code}
                                            type="button"
                                            onClick={() => handlePurposeChange(item.code)}
                                            className={`rounded-xl border px-3 py-2.5 text-left transition ${purposeCode === item.code ? 'border-primary bg-primary text-white shadow-lg shadow-primary/15' : 'border-slate-200 bg-white text-slate-700 hover:border-primary/50 hover:bg-primary/5'}`}
                                        >
                                            <p className="truncate text-sm font-black">{item.label}</p>
                                            <p className={`mt-0.5 truncate text-[11px] font-bold ${purposeCode === item.code ? 'text-white/75' : 'text-slate-400'}`}>{item.audience}</p>
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                                    {purpose.useCase}
                                </p>
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
                                    title={sectionPresentation.medicalHistory.title}
                                    helperText={sectionPresentation.medicalHistory.guidance}
                                    placeholder={sectionPresentation.medicalHistory.placeholder}
                                    required={sectionPresentation.medicalHistory.required}
                                    value={sections.medicalHistory}
                                    onChange={(value) => updateSection('medicalHistory', value)}
                                    rows={4}
                                    actions={[
                                        { label: 'History', onClick: () => handleInsertSnippet('medicalHistory'), disabled: !snippets.medicalHistory, disabledReason: 'No medical history recorded for this patient.' },
                                        { label: 'Allergies', onClick: () => handleInsertSnippet('allergies'), disabled: !snippets.allergies, disabledReason: 'No allergies recorded.' },
                                    ]}
                                />
                                <ReportFormSection
                                    icon="stethoscope"
                                    title={sectionPresentation.clinicalFindings.title}
                                    helperText={sectionPresentation.clinicalFindings.guidance}
                                    placeholder={sectionPresentation.clinicalFindings.placeholder}
                                    required={sectionPresentation.clinicalFindings.required}
                                    value={sections.clinicalFindings}
                                    onChange={(value) => updateSection('clinicalFindings', value)}
                                    rows={5}
                                    actions={[
                                        { label: 'Latest visit', onClick: () => handleInsertSnippet('latestEncounterSummary'), disabled: !snippets.latestEncounterSummary, disabledReason: 'No encounter summary available.' },
                                    ]}
                                />
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <ReportFormSection
                                        icon="vital_signs"
                                        title={sectionPresentation.diagnosis.title}
                                        helperText={sectionPresentation.diagnosis.guidance}
                                        placeholder={sectionPresentation.diagnosis.placeholder}
                                        required={sectionPresentation.diagnosis.required}
                                        value={sections.diagnosis}
                                        onChange={(value) => updateSection('diagnosis', value)}
                                        rows={4}
                                        bold
                                        actions={[
                                            { label: 'Diagnoses', onClick: () => handleInsertSnippet('diagnosisSummary'), disabled: !snippets.diagnosisSummary, disabledReason: 'No diagnoses recorded.' },
                                        ]}
                                    />
                                    <ReportFormSection
                                        icon="medical_information"
                                        title={sectionPresentation.treatmentPlan.title}
                                        helperText={sectionPresentation.treatmentPlan.guidance}
                                        placeholder={sectionPresentation.treatmentPlan.placeholder}
                                        required={sectionPresentation.treatmentPlan.required}
                                        value={sections.treatmentPlan}
                                        onChange={(value) => updateSection('treatmentPlan', value)}
                                        rows={4}
                                        actions={[
                                            { label: 'Active meds', onClick: () => handleInsertSnippet('activeMedications'), disabled: !snippets.activeMedications, disabledReason: 'No active prescriptions recorded.' },
                                        ]}
                                    />
                                </div>
                                <ReportFormSection
                                    icon="assignment_turned_in"
                                    title={sectionPresentation.recommendations.title}
                                    helperText={sectionPresentation.recommendations.guidance}
                                    placeholder={sectionPresentation.recommendations.placeholder}
                                    required={sectionPresentation.recommendations.required}
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
                            onExport={handleExportPdf}
                            exportDisabled={isSaving || isExporting || !readiness.canSave}
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
