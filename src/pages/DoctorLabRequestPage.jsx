import React, { useState, useEffect } from 'react';
import { logError } from '@/lib/logger';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { documentService } from '@/services/documents';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { usePatients } from '@/hooks/features/usePatients';
import { useDoctorProfile } from '@/hooks/features/useDoctorProfile';
import DashboardLayout from '@/components/layouts/DashboardLayout';


const CATEGORIES = ['Hematology', 'Biochemistry', 'Immunology', 'Toxicology'];

export default function DoctorLabRequestPage() {
    const navigate = useNavigate();
    const [tests, setTests] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [justification, setJustification] = useState('');
    const [urgency, setUrgency] = useState('normal');
    const [specimenType, setSpecimenType] = useState('Venous Blood');
    const [volume, setVolume] = useState('5');
    const [collectionDate, setCollectionDate] = useState(new Date().toISOString().split('T')[0]);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const { user } = useAuth();
    const { showToast } = useToast();

    const { patients } = usePatients();
    const { doctorId } = useDoctorProfile();

    useEffect(() => {
        if (patients && patients.length > 0 && !selectedPatient) {
            setSelectedPatient(patients[0]);
        }
    }, [patients, selectedPatient]);

    const removeTest = (index) => {
        setTests(tests.filter((_, i) => i !== index));
    };

    const handleSaveDraft = () => {
        showToast('Draft feature coming soon — please submit to save.', 'info');
    };

    const handleDiscard = () => {
        if (confirm('Are you sure you want to discard this lab request?')) {
            navigate(selectedPatient?.id ? `/doctor-patient/${selectedPatient.id}` : '/doctor-patients');
        }
    };

    const handlePrint = () => {
        if (!selectedPatient) {
            showToast('Please select a patient before printing', 'error');
            return;
        }
        if (tests.length === 0) {
            showToast('Please add at least one test', 'error');
            return;
        }
        const pt = selectedPatient;
        const u = pt.users;
        const patientName = `${u?.first_name || ''} ${u?.last_name || ''}`;
        const patientId = pt.id.split('-')[0];
        const age = pt.date_of_birth ? new Date().getFullYear() - new Date(pt.date_of_birth).getFullYear() : 'N/A';
        const sex = pt.sex || 'N/A';

        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Lab Test Label - ${patientName}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .label { border: 2px solid #000; padding: 20px; max-width: 300px; }
                    .header { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
                    .patient { margin: 10px 0; }
                    .tests { margin: 10px 0; }
                    .footer { font-size: 12px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="label">
                    <div class="header">MEDCORE LABORATORY</div>
                    <div class="patient">
                        <strong>Patient:</strong> ${patientName}<br/>
                        <strong>ID:</strong> ${patientId}<br/>
                        <strong>Age:</strong> ${age} years<br/>
                        <strong>Sex:</strong> ${sex}
                    </div>
                    <div class="tests">
                        <strong>Tests:</strong><br/>
                        ${tests.map(t => `• ${t.name}`).join('<br/>')}
                    </div>
                    <div class="footer">
                        <strong>Priority:</strong> ${urgency.toUpperCase()}<br/>
                        <strong>Specimen:</strong> ${specimenType}<br/>
                        <strong>Date:</strong> ${new Date().toLocaleDateString()}
                    </div>
                </div>
            </body>
            </html>
        `;
        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.print();
    };

    const handleSubmit = async () => {
        if (tests.length === 0) {
            showToast('Please select at least one test before submitting.', 'error');
            return;
        }
        if (!selectedPatient) {
            showToast('Please select a patient.', 'error');
            return;
        }
        if (!doctorId) {
            showToast('Doctor profile not found. Please try again after your profile loads.', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const testNames = tests.map(t => t.name);
            const content = [
                `Tests: ${testNames.join(', ')}`,
                `Justification: ${justification || 'Not provided.'}`,
                `Urgency: ${urgency}`,
                `Specimen type: ${specimenType}`,
                `Volume: ${volume} mL`,
                `Collection date: ${collectionDate}`,
            ].join('\n');

            const { error } = await documentService.createLabRequest({
                patient_id: selectedPatient.id,
                doctor_id: doctorId,
                title: `Lab Request - ${testNames.join(', ').slice(0, 160)}`,
                content,
                created_by: user.id,
            });

            if (error) throw error;

            setShowSuccess(true);
            setSuccessMessage('Lab request submitted successfully!');
            setTimeout(() => {
                setShowSuccess(false);
                navigate('/doctor-dashboard');
            }, 2000);
        } catch (error) {
            logError('Failed to submit lab request:', error);
            showToast('Failed to submit lab request', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <DashboardLayout role="doctor">
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="flex items-center justify-between px-6 w-full h-16 bg-white shadow-sm sticky top-0 z-40 border-b border-slate-100">
                    <div className="flex items-center gap-4 flex-1">
                        <div className="relative w-full max-w-md">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                            <input className="w-full bg-[#f1f5f9] border-none rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-[#0d6cf2]/20 transition-all" placeholder="Search patient, record, or test..." type="text"/>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-primary/5 rounded-lg transition-colors">
                            <span className="material-symbols-outlined">notifications</span>
                        </button>
                        <button className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-primary/5 rounded-lg transition-colors">
                            <span className="material-symbols-outlined">help_outline</span>
                        </button>
                        <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-xs font-bold text-slate-900 leading-none">{user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Doctor'}</p>
                                <p className="text-[10px] text-slate-500 font-medium">{user?.role || 'Physician'}</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-[#0d6cf2]/20 flex items-center justify-center text-[#0d6cf2] font-black text-xs">{user?.first_name ? `${user.first_name[0]}${(user.last_name || '')[0] || ''}`.toUpperCase() : '?'}</div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <nav className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                                <span onClick={() => navigate('/doctor-patients')} className="hover:text-[#0d6cf2] transition-colors cursor-pointer">Patients</span>
                                <span className="material-symbols-outlined text-[10px]">chevron_right</span>
                                <span onClick={() => navigate(selectedPatient?.id ? `/doctor-patient/${selectedPatient.id}` : '/doctor-patients')} className="hover:text-[#0d6cf2] transition-colors cursor-pointer text-slate-500">{selectedPatient ? `${selectedPatient.users?.first_name || ''} ${selectedPatient.users?.last_name || ''}`.trim() : 'Patient'}</span>
                                <span className="material-symbols-outlined text-[10px]">chevron_right</span>
                                <span className="text-[#0d6cf2]">New Lab Request</span>
                            </nav>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tighter leading-none">Lab Test Request</h2>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => navigate(selectedPatient?.id ? `/doctor-patient/${selectedPatient.id}` : '/doctor-patients')} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-[#0d6cf2] transition-colors px-4 py-2">
                                <span className="material-symbols-outlined text-lg">arrow_back</span>
                                Back to Patient
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-100 p-6 flex flex-wrap items-center gap-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#0d6cf2]/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                        <div className="flex items-center gap-5 relative z-10 w-full">
                            <div className="flex-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Select Patient</label>
                                <select 
                                    value={selectedPatient?.id || ''} 
                                    onChange={(e) => setSelectedPatient(patients.find(p => p.id === e.target.value))}
                                    className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-lg font-bold focus:ring-2 focus:ring-primary/20"
                                >
                                    {patients.map(p => (
                                        <option key={p.id} value={p.id}>{p.users?.first_name} {p.users?.last_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="ml-auto flex items-center gap-8 border-l border-slate-100 pl-8">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Age / Sex</p>
                                    <p className="text-lg font-bold text-slate-900">{selectedPatient?.date_of_birth ? new Date().getFullYear() - new Date(selectedPatient.date_of_birth).getFullYear() : 'N/A'} / {selectedPatient?.sex || 'Unknown'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Patient ID</p>
                                    <p className="text-lg font-bold text-slate-900">{selectedPatient?.id?.split('-')[0] || '---'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-7 space-y-6">
                            <section className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                                <div className="p-5 border-b border-slate-50 flex items-center justify-between">
                                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Test Selection</h4>
                                    <span className="px-2 py-1 bg-[#0d6cf2]/10 text-[#0d6cf2] text-[10px] font-bold rounded">{tests.length} Selected</span>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="relative">
                                        <label className="block text-xs font-bold text-slate-500 mb-2">Search Laboratory Tests</label>
                                        <div className="flex items-center bg-[#f8fafc] rounded-xl px-4 py-3 border border-transparent focus-within:border-[#0d6cf2]/30 transition-all">
                                            <span className="material-symbols-outlined text-slate-400 mr-2">search</span>
                                            <input 
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="flex-1 bg-transparent border-none text-sm p-0 focus:ring-0" 
                                                placeholder="Type test name (e.g. Lipid, CBC, Glucose)..." 
                                                type="text"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        {tests.map((test, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 bg-[#f8fafc] rounded-xl border border-slate-100">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${test.color}`}>
                                                        <span className="material-symbols-outlined text-lg">{test.icon}</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900">{test.name}</p>
                                                        <p className="text-[10px] text-slate-500 font-medium">Category: {test.category}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right mr-4">
                                                    <p className="text-xs font-bold text-slate-900">{test.turnaround}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">Turnaround</p>
                                                </div>
                                                <button onClick={() => removeTest(i)} className="text-slate-400 hover:text-critical transition-colors">
                                                    <span className="material-symbols-outlined">close</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="pt-4 border-t border-slate-50">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Browse Categories</p>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {CATEGORIES.map((cat) => (
                                                <button key={cat} className="px-3 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:border-[#0d6cf2] hover:text-[#0d6cf2] transition-all">{cat}</button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                                <div className="p-5 border-b border-slate-50">
                                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Clinical Justification</h4>
                                </div>
                                <div className="p-6">
                                    <textarea 
                                        value={justification}
                                        onChange={(e) => setJustification(e.target.value)}
                                        className="w-full bg-[#f8fafc] border-none rounded-xl p-4 text-sm focus:ring-2 focus:ring-[#0d6cf2]/20 transition-all placeholder:text-slate-400" 
                                        placeholder="Provide detailed medical reasoning for this request..." 
                                        rows="4"
                                    ></textarea>
                                    <div className="mt-3 flex gap-2">
                                        <button className="px-2 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded cursor-pointer hover:bg-slate-200 transition-colors">Routine Screen</button>
                                        <button className="px-2 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded cursor-pointer hover:bg-slate-200 transition-colors">Symptom Follow-up</button>
                                        <button className="px-2 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded cursor-pointer hover:bg-slate-200 transition-colors">Pre-operative</button>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <div className="lg:col-span-5 space-y-6">
                            <section className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                                <div className="p-5 border-b border-slate-50">
                                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Urgency Level</h4>
                                </div>
                                <div className="p-6 grid grid-cols-3 gap-3">
                                    <label className="relative cursor-pointer">
                                        <input checked={urgency === 'normal'} onChange={() => setUrgency('normal')} className="peer sr-only" name="urgency" type="radio"/>
                                        <div className="flex flex-col items-center justify-center p-4 border-2 border-slate-100 rounded-xl bg-white peer-checked:border-[#0d6cf2] peer-checked:bg-primary/5 transition-all">
                                            <span className="material-symbols-outlined text-slate-400 peer-checked:text-[#0d6cf2] mb-1">schedule</span>
                                            <span className="text-xs font-black uppercase text-slate-600">Normal</span>
                                        </div>
                                    </label>
                                    <label className="relative cursor-pointer">
                                        <input checked={urgency === 'urgent'} onChange={() => setUrgency('urgent')} className="peer sr-only" name="urgency" type="radio"/>
                                        <div className="flex flex-col items-center justify-center p-4 border-2 border-slate-100 rounded-xl bg-white peer-checked:border-warning peer-checked:bg-warning/10 transition-all">
                                            <span className="material-symbols-outlined text-slate-400 peer-checked:text-warning mb-1">priority_high</span>
                                            <span className="text-xs font-black uppercase text-slate-600">Urgent</span>
                                        </div>
                                    </label>
                                    <label className="relative cursor-pointer">
                                        <input checked={urgency === 'stat'} onChange={() => setUrgency('stat')} className="peer sr-only" name="urgency" type="radio"/>
                                        <div className="flex flex-col items-center justify-center p-4 border-2 border-slate-100 rounded-xl bg-white peer-checked:border-critical peer-checked:bg-red-50/5 transition-all">
                                            <span className="material-symbols-outlined text-slate-400 peer-checked:text-critical mb-1" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                                            <span className="text-xs font-black uppercase text-slate-600">STAT</span>
                                        </div>
                                    </label>
                                </div>
                            </section>

                            <section className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                                <div className="p-5 border-b border-slate-50">
                                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Specimen Details</h4>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-2">Specimen Type</label>
                                        <select 
                                            value={specimenType}
                                            onChange={(e) => setSpecimenType(e.target.value)}
                                            className="w-full bg-[#f8fafc] border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-[#0d6cf2]/20 appearance-none"
                                        >
                                            <option>Venous Blood</option>
                                            <option>Capillary Blood</option>
                                            <option>Random Urine</option>
                                            <option>24-hour Urine</option>
                                            <option>Nasopharyngeal Swab</option>
                                            <option>Saliva</option>
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-2">Volume (mL)</label>
                                            <input 
                                                value={volume}
                                                onChange={(e) => setVolume(e.target.value)}
                                                className="w-full bg-[#f8fafc] border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-[#0d6cf2]/20" 
                                                placeholder="5" 
                                                type="number"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-2">Collection Date</label>
                                            <div className="relative">
                                                <input 
                                                    value={collectionDate}
                                                    onChange={(e) => setCollectionDate(e.target.value)}
                                                    className="w-full bg-[#f8fafc] border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-[#0d6cf2]/20" 
                                                    type="text"
                                                />
                                                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">calendar_month</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 p-3 bg-primary/5/50 rounded-xl border border-primary/20/50">
                                        <span className="material-symbols-outlined text-[#0d6cf2] text-lg">info</span>
                                        <p className="text-[11px] text-primary font-medium">Fasting for 12 hours is recommended for Lipid Profile.</p>
                                    </div>
                                </div>
                            </section>

                            <div className="bg-slate-900 rounded-xl p-6 text-white shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-2 opacity-10">
                                    <span className="material-symbols-outlined text-7xl">lab_profile</span>
                                </div>
                                <h5 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Request Summary</h5>
                                <div className="space-y-3 relative z-10">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Total Tests</span>
                                        <span className="font-bold">0{tests.length}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Priority</span>
                                        <span className="font-bold text-blue-400 capitalize">{urgency}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Est. Results</span>
                                        <span className="font-bold">By tomorrow, 09:00 AM</span>
                                    </div>
                                    <div className="pt-3 border-t border-slate-700 mt-3">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">Requesting MD</span>
                                            <span className="font-bold">{user?.first_name ? `Dr. ${user.last_name || user.first_name}` : 'Doctor'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="sticky bottom-0 bg-white/80 backdrop-blur-md border border-slate-100 rounded-2xl p-4 shadow-2xl flex flex-wrap items-center justify-between gap-4 z-30">
                        <div className="flex items-center gap-4">
                            <button onClick={handleSaveDraft} className="px-6 py-3 bg-slate-100 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-200 transition-all flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">save</span>
                                Save as Draft
                            </button>
                            <button onClick={handleDiscard} className="px-4 py-3 text-critical text-sm font-bold hover:bg-red-50 rounded-xl transition-all">
                                Discard Request
                            </button>
                        </div>
                        <div className="flex items-center gap-4">
                            <button onClick={handlePrint} className="px-6 py-3 border border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:border-[#0d6cf2] hover:text-[#0d6cf2] transition-all">
                                Print Label Preview
                            </button>
                            <button onClick={handleSubmit} className="px-10 py-3 bg-[#0d6cf2] text-white text-sm font-black rounded-xl hover:text-primary shadow-lg shadow-[#0d6cf2]/20 active:scale-95 transition-all flex items-center gap-2">
                                <span className="material-symbols-outlined">send</span>
                                Submit Lab Request
                            </button>
                        </div>
                    </div>
                    {showSuccess && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                            <div className="bg-white rounded-xl p-8 shadow-2xl flex flex-col items-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-green-600 text-4xl">check</span>
                                </div>
                                <p className="text-lg font-bold text-slate-900">{successMessage}</p>
                                <button onClick={() => setShowSuccess(false)} className="px-6 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">
                                    Close
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
    </DashboardLayout>
    );
}
