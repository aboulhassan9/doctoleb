/**
 * DoctorReportsPage — Orchestrator for comprehensive medical report creation.
 *
 * Delegates rendering to:
 *   - DashboardHeader (shared sticky header)
 *   - DashboardSettingsModals (shared settings modals)
 *   - ReportFormSection (reusable section with icon + title + textarea)
 *   - ReportSidebar (context, signature, attachments)
 *
 * Reduced from 378 → ~175 lines.
 */
import { useState, useEffect } from 'react';
import { logError } from '@/lib/logger';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import DashboardHeader from '@clinic-ops/components/dashboard/DashboardHeader';
import DashboardSettingsModals from '@clinic-ops/components/dashboard/DashboardSettingsModals';
import ReportFormSection from '@clinic-ops/components/reports/ReportFormSection';
import ReportSidebar from '@clinic-ops/components/reports/ReportSidebar';
import { Modal } from '@/components/ui';
import { documentService } from '@/services/documents';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useBrand } from '@/contexts/BrandContext';
import { usePatients } from '@/hooks/features/usePatients';
import { useDoctorProfile } from '@/hooks/features/useDoctorProfile';

export default function DoctorReportsPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [medicalHistory, setMedicalHistory] = useState('');
    const [clinicalFindings, setClinicalFindings] = useState('');
    const [diagnosis, setDiagnosis] = useState('');
    const [treatmentPlan, setTreatmentPlan] = useState('');
    const [recommendations, setRecommendations] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [savedReportId, setSavedReportId] = useState(null);

    // Settings modals state
    const [showProfile, setShowProfile] = useState(false);
    const [showTheme, setShowTheme] = useState(false);
    const [showSecurity, setShowSecurity] = useState(false);

    const { user } = useAuth();
    const { showToast } = useToast();
    const { displayName } = useBrand();
    const { patients } = usePatients();
    const { doctorId } = useDoctorProfile();

    useEffect(() => {
        if (patients?.length > 0 && !selectedPatient) {
            setSelectedPatient(patients[0]);
        }
    }, [patients, selectedPatient]);

    const handleSave = async () => {
        if (!selectedPatient) {
            showToast('Please select a patient', 'error');
            return;
        }
        if (!doctorId) {
            showToast('Doctor profile not found. Please try again after your profile loads.', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const patientName = `${selectedPatient.users?.first_name || ''} ${selectedPatient.users?.last_name || ''}`.trim();
            const content = [
                `Patient: ${patientName || selectedPatient.id}`,
                '', 'Medical History', medicalHistory || 'Not provided.',
                '', 'Clinical Findings', clinicalFindings || 'Not provided.',
                '', 'Diagnosis', diagnosis || 'Not provided.',
                '', 'Treatment Plan', treatmentPlan || 'Not provided.',
                '', 'Recommendations', recommendations || 'Not provided.',
            ].join('\n');

            const { data, error } = await documentService.createReport({
                patient_id: selectedPatient.id,
                doctor_id: doctorId,
                title: `Comprehensive Report - ${patientName || selectedPatient.id.slice(0, 8)}`,
                content,
                created_by: user.id,
            });

            if (error) throw error;
            const saved = Array.isArray(data) ? data[0] : data;
            setSavedReportId(saved?.id || null);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (error) {
            logError('Failed to save report:', error);
            showToast('Failed to save report', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const doctorDisplayName = user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Doctor';

    return (
        <DashboardLayout role="doctor">
            <DashboardHeader
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onOpenProfile={() => setShowProfile(true)}
                onOpenTheme={() => setShowTheme(true)}
                onOpenSecurity={() => setShowSecurity(true)}
            />

            <div className="flex-1 overflow-y-auto p-8 pb-12">
                <div className="max-w-7xl mx-auto">
                    {/* Page title + actions */}
                    <div className="flex items-end justify-between mb-8 border-b-4 border-primary pb-6">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Department of Internal Medicine</span>
                            <h1 className="text-[30px] font-black tracking-tighter text-slate-900 mt-1 leading-none uppercase">Comprehensive Medical Report</h1>
                        </div>
                        <div className="flex items-center gap-3">
                            <button type="button" onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-slate-600 border border-slate-200 hover:border-primary hover:text-primary transition-all text-sm font-bold shadow-sm">
                                <span className="material-symbols-outlined text-lg">print</span> Print
                            </button>
                            <button type="button" disabled title="PDF export will be enabled after the report renderer is connected to saved report records." className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-slate-400 border border-slate-200 transition-all text-sm font-bold shadow-sm disabled:cursor-not-allowed">
                                <span className="material-symbols-outlined text-lg">picture_as_pdf</span> Export unavailable
                            </button>
                            <button type="button" disabled={isSaving} onClick={handleSave} className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-white shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50">
                                <span className="material-symbols-outlined text-lg">save</span> Save Report
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Left: Form */}
                        <div className="lg:col-span-8 space-y-8">
                            {/* Patient selector */}
                            <section className="grid grid-cols-1 gap-4">
                                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                                    <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block mb-1">Select Patient</label>
                                    <select
                                        value={selectedPatient?.id || ''}
                                        onChange={(e) => setSelectedPatient(patients.find(p => p.id === e.target.value))}
                                        className="w-full bg-slate-50 border-none rounded-xl py-2 px-4 text-lg font-bold focus:ring-2 focus:ring-primary/20"
                                    >
                                        {patients.map(p => (
                                            <option key={p.id} value={p.id}>{p.users?.first_name} {p.users?.last_name}</option>
                                        ))}
                                    </select>
                                </div>
                            </section>

                            {/* Report sections */}
                            <div className="space-y-6">
                                <ReportFormSection icon="history_edu" title="Medical History" value={medicalHistory} onChange={setMedicalHistory} rows={3} />
                                <ReportFormSection icon="stethoscope" title="Clinical Findings" value={clinicalFindings} onChange={setClinicalFindings} rows={4} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <ReportFormSection icon="vital_signs" title="Diagnosis" value={diagnosis} onChange={setDiagnosis} rows={3} bold />
                                    <ReportFormSection icon="medical_information" title="Treatment Plan" value={treatmentPlan} onChange={setTreatmentPlan} rows={3} />
                                </div>
                                <ReportFormSection icon="assignment_turned_in" title="Recommendations" value={recommendations} onChange={setRecommendations} rows={3} />
                            </div>
                        </div>

                        {/* Right: Sidebar */}
                        <ReportSidebar reportId={savedReportId} />
                    </div>

                    {/* Footer */}
                    <footer className="mt-12 pt-8 border-t border-slate-200 grid grid-cols-3 gap-8 items-end">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block">Authorized Signatory</label>
                            <p className="text-xl font-black text-slate-900">{doctorDisplayName}</p>
                            <p className="text-xs text-slate-500">{user?.role || 'Physician'}</p>
                        </div>
                        <div className="flex justify-center">
                            <div className="text-center">
                                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block mb-2">Signature Stamp</label>
                                <div className="w-32 h-16 border border-slate-100 rounded bg-slate-50 flex items-center justify-center italic text-primary/30 font-serif text-lg select-none">
                                    {doctorDisplayName}
                                </div>
                            </div>
                        </div>
                        <div className="text-right space-y-1">
                            <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block">Report Generation Date</label>
                            <p className="text-xl font-bold text-slate-900">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                            <p className="text-xs text-slate-500">Generated via {displayName}</p>
                        </div>
                    </footer>
                </div>
            </div>

            {/* Success modal */}
            <Modal isOpen={showSuccess} onClose={() => setShowSuccess(false)} size="sm">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-green-600 text-4xl">check</span>
                </div>
                <p className="text-lg font-bold text-slate-900">Report saved successfully!</p>
                <button type="button" onClick={() => setShowSuccess(false)} className="px-6 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">
                  Close
                </button>
              </div>
            </Modal>

            {/* Settings modals */}
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
