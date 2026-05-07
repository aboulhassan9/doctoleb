import React, { useState, useEffect } from 'react';
import { logError } from '@/lib/logger';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { documentService } from '@/services/documents';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useBrand } from '@/contexts/BrandContext';
import { usePatients } from '@/hooks/features/usePatients';
import { useDoctorProfile } from '@/hooks/features/useDoctorProfile';
import DashboardLayout from '@/components/layouts/DashboardLayout';


export default function DoctorReportsPage() {
    const navigate = useNavigate();
    const [medicalHistory, setMedicalHistory] = useState('');
    const [clinicalFindings, setClinicalFindings] = useState('');
    const [diagnosis, setDiagnosis] = useState('');
    const [treatmentPlan, setTreatmentPlan] = useState('');
    const [recommendations, setRecommendations] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const { user } = useAuth();
    const { showToast } = useToast();
    const { displayName } = useBrand();

    const { patients } = usePatients();
    const { doctorId } = useDoctorProfile();

    useEffect(() => {
        if (patients && patients.length > 0 && !selectedPatient) {
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
                '',
                'Medical History',
                medicalHistory || 'Not provided.',
                '',
                'Clinical Findings',
                clinicalFindings || 'Not provided.',
                '',
                'Diagnosis',
                diagnosis || 'Not provided.',
                '',
                'Treatment Plan',
                treatmentPlan || 'Not provided.',
                '',
                'Recommendations',
                recommendations || 'Not provided.',
            ].join('\n');

            const { error } = await documentService.createReport({
                patient_id: selectedPatient.id,
                doctor_id: doctorId,
                title: `Comprehensive Report - ${patientName || selectedPatient.id.slice(0, 8)}`,
                content,
                created_by: user.id,
            });

            if (error) throw error;

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

    const handleExport = () => {
        if (!selectedPatient) {
            showToast('Please select a patient before exporting', 'error');
            return;
        }
        const patientName = `${selectedPatient.users?.first_name} ${selectedPatient.users?.last_name}`;
        const patientId = selectedPatient.id;

        const content = `
            <!DOCTYPE html>
            <html>
            <head><title>Medical Report - ${patientName}</title></head>
            <body>
                <h1>Comprehensive Medical Report</h1>
                <h2>Patient: ${patientName}</h2>
                <h2>ID: ${patientId}</h2>
                <hr/>
                <h3>Medical History</h3>
                <p>${medicalHistory}</p>
                <h3>Clinical Findings</h3>
                <p>${clinicalFindings}</p>
                <h3>Diagnosis</h3>
                <p>${diagnosis}</p>
                <h3>Treatment Plan</h3>
                <p>${treatmentPlan}</p>
                <h3>Recommendations</h3>
                <p>${recommendations}</p>
                <br/>
                <p>Report Generated On: ${new Date().toLocaleDateString()}</p>
            </body>
            </html>
        `;
        const blob = new Blob([content], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Medical_Report_${patientName}.html`;
        a.click();
    };

    return (
        <DashboardLayout role="doctor">
                <header className="sticky top-0 z-20 h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
                    <div className="flex items-center gap-4 flex-1 max-w-xl">
                        <div className="relative w-full">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">search</span>
                            <input className="w-full bg-slate-100 border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/50" placeholder="Search patient reports..." type="text"/>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary">
                            <span className="material-symbols-outlined">notifications</span>
                        </button>
                        <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary">
                            <span className="material-symbols-outlined">help_outline</span>
                        </button>
                        <div className="h-8 w-px bg-slate-200 mx-2"></div>
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-xs font-bold text-slate-900">{user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Doctor'}</p>
                                <p className="text-[10px] text-slate-500">{user?.role || 'Physician'}</p>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-xs">{user?.first_name ? `${user.first_name[0]}${(user.last_name || '')[0] || ''}`.toUpperCase() : '?'}</div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8 pb-12">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex items-end justify-between mb-8 border-b-4 border-primary pb-6">
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Department of Internal Medicine</span>
                                <h1 className="text-[30px] font-black tracking-tighter text-slate-900 mt-1 leading-none uppercase">Comprehensive Medical Report</h1>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-slate-600 border border-slate-200 hover:border-primary hover:text-primary transition-all text-sm font-bold shadow-sm">
                                    <span className="material-symbols-outlined text-lg">print</span>
                                    Print
                                </button>
                                <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-slate-600 border border-slate-200 hover:border-primary hover:text-primary transition-all text-sm font-bold shadow-sm">
                                    <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                                    Export PDF
                                </button>
                                <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-white shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all text-sm font-bold">
                                    <span className="material-symbols-outlined text-lg">save</span>
                                    Save Report
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            <div className="lg:col-span-8 space-y-8">
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

                                <div className="space-y-6">
                                    <div className="bg-white rounded-xl overflow-hidden border border-slate-100 shadow-sm">
                                        <div className="bg-slate-50 px-6 py-3 flex items-center justify-between">
                                            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-600 flex items-center gap-2">
                                                <span className="material-symbols-outlined text-primary text-lg">history_edu</span>
                                                Medical History
                                            </h3>
                                        </div>
                                        <div className="p-6">
                                            <textarea 
                                                value={medicalHistory}
                                                onChange={(e) => setMedicalHistory(e.target.value)}
                                                className="w-full border-none focus:ring-0 p-0 text-sm leading-relaxed text-slate-600 min-h-[100px] bg-transparent resize-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-xl overflow-hidden border border-slate-100 shadow-sm">
                                        <div className="bg-slate-50 px-6 py-3 flex items-center justify-between">
                                            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-600 flex items-center gap-2">
                                                <span className="material-symbols-outlined text-primary text-lg">stethoscope</span>
                                                Clinical Findings
                                            </h3>
                                        </div>
                                        <div className="p-6">
                                            <textarea 
                                                value={clinicalFindings}
                                                onChange={(e) => setClinicalFindings(e.target.value)}
                                                className="w-full border-none focus:ring-0 p-0 text-sm leading-relaxed text-slate-600 min-h-[120px] bg-transparent resize-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white rounded-xl overflow-hidden border border-slate-100 shadow-sm">
                                            <div className="bg-slate-50 px-6 py-3 flex items-center justify-between">
                                                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-600 flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-primary text-lg">vital_signs</span>
                                                    Diagnosis
                                                </h3>
                                            </div>
                                            <div className="p-6">
                                                <textarea 
                                                    value={diagnosis}
                                                    onChange={(e) => setDiagnosis(e.target.value)}
                                                    className="w-full border-none focus:ring-0 p-0 text-sm font-bold text-slate-900 min-h-[80px] bg-transparent resize-none"
                                                />
                                            </div>
                                        </div>
                                        <div className="bg-white rounded-xl overflow-hidden border border-slate-100 shadow-sm">
                                            <div className="bg-slate-50 px-6 py-3 flex items-center justify-between">
                                                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-600 flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-primary text-lg">medical_information</span>
                                                    Treatment Plan
                                                </h3>
                                            </div>
                                            <div className="p-6">
                                                <textarea 
                                                    value={treatmentPlan}
                                                    onChange={(e) => setTreatmentPlan(e.target.value)}
                                                    className="w-full border-none focus:ring-0 p-0 text-sm leading-relaxed text-slate-600 min-h-[80px] bg-transparent resize-none"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-xl overflow-hidden border border-slate-100 shadow-sm">
                                        <div className="bg-slate-50 px-6 py-3 flex items-center justify-between">
                                            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-600 flex items-center gap-2">
                                                <span className="material-symbols-outlined text-primary text-lg">assignment_turned_in</span>
                                                Recommendations
                                            </h3>
                                        </div>
                                        <div className="p-6">
                                            <textarea 
                                                value={recommendations}
                                                onChange={(e) => setRecommendations(e.target.value)}
                                                className="w-full border-none focus:ring-0 p-0 text-sm leading-relaxed text-slate-600 min-h-[100px] bg-transparent resize-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="lg:col-span-4 space-y-8">
                                <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
                                    <h4 className="text-xs font-bold uppercase text-slate-500 tracking-widest border-b border-slate-100 pb-2">Report Context</h4>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-slate-500">Status</span>
                                            <span className="px-2 py-1 bg-warning/10 text-amber-800 text-[10px] font-black uppercase rounded">Draft - Unsigned</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-slate-500">Priority</span>
                                            <span className="px-2 py-1 bg-primary/10 text-blue-800 text-[10px] font-black uppercase rounded">Routine</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-slate-500">Ref No.</span>
                                            <span className="text-xs font-bold font-mono">RPT-{Date.now().toString().slice(-6)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
                                    <h4 className="text-xs font-bold uppercase text-slate-500 tracking-widest flex items-center justify-between">
                                        Digital Signature
                                        <button className="text-primary text-[10px] hover:underline">Clear</button>
                                    </h4>
                                    <div className="w-full h-48 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center relative overflow-hidden group bg-slate-50">
                                        <span className="material-symbols-outlined text-slate-300 text-4xl group-hover:scale-110 transition-transform">draw</span>
                                        <div className="absolute bottom-2 right-2 text-[10px] text-slate-400 font-medium">Draw Signature Here</div>
                                    </div>
                                    <p className="text-[10px] text-slate-500 leading-tight italic">By signing, you certify that the information contained in this medical report is accurate and reflects your professional clinical assessment.</p>
                                </div>

                                <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
                                    <h4 className="text-xs font-bold uppercase text-slate-500 tracking-widest">Linked Attachments</h4>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer group">
                                            <span className="material-symbols-outlined text-slate-500 group-hover:text-primary">fingerprint</span>
                                            <div className="flex-1">
                                                <p className="text-[11px] font-bold text-slate-900">ECG_Scan_2410.pdf</p>
                                                <p className="text-[9px] text-slate-500">Attached today at 09:12 AM</p>
                                            </div>
                                            <span className="material-symbols-outlined text-sm text-slate-300">open_in_new</span>
                                        </div>
                                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer group">
                                            <span className="material-symbols-outlined text-slate-500 group-hover:text-primary">bloodtype</span>
                                            <div className="flex-1">
                                                <p className="text-[11px] font-bold text-slate-900">Blood_Work_Q3.pdf</p>
                                                <p className="text-[9px] text-slate-500">Attached 14 Oct 2023</p>
                                            </div>
                                            <span className="material-symbols-outlined text-sm text-slate-300">open_in_new</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <footer className="mt-12 pt-8 border-t border-slate-200 grid grid-cols-3 gap-8 items-end">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block">Authorized Signatory</label>
                                <p className="text-xl font-black text-slate-900">{user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Doctor'}</p>
                                <p className="text-xs text-slate-500">{user?.role || 'Physician'}</p>
                            </div>
                            <div className="flex justify-center">
                                <div className="text-center">
                                    <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block mb-2">Signature Stamp</label>
                                    <div className="w-32 h-16 border border-slate-100 rounded bg-slate-50 flex items-center justify-center italic text-primary/30 font-serif text-lg select-none">
                                        {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Doctor'}
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

            {showSuccess && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-8 shadow-2xl flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                            <span className="material-symbols-outlined text-green-600 text-4xl">check</span>
                        </div>
                        <p className="text-lg font-bold text-slate-900">Report saved successfully!</p>
                        <button onClick={() => setShowSuccess(false)} className="px-6 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">
                            Close
                        </button>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
