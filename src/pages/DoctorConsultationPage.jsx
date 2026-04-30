import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { consultationService } from '../services/consultations';
import { appointmentService } from '../services/appointments';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { notificationService } from '../services/notifications';
import { useAuth } from '../contexts/AuthContext';

// Live data will be fetched inside the component.

const AVATAR_COLORS = [
    'bg-primary/10 text-primary', 'bg-success/10 text-success',
    'bg-warning/10 text-warning', 'bg-secondary/10 text-secondary',
    'bg-indigo-100 text-indigo-600', 'bg-rose-100 text-rose-600',
];
const avatarColor = (initials = '') => AVATAR_COLORS[(initials.charCodeAt(0) || 0) % AVATAR_COLORS.length];

function formatTimer(secs) {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
}

export default function DoctorConsultationPage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const { showToast } = useToast();
    const { user } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [sessionSeconds, setSessionSeconds] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => setSessionSeconds(s => s + 1), 1000);
        return () => clearInterval(timer);
    }, []);
    const [notes, setNotes] = useState('');
    const [icd10, setIcd10] = useState('');
    const [severity, setSeverity] = useState('');
    const [medications, setMedications] = useState([{ name: '', dosage: '', duration: '' }]);
    
    const [patientInfo, setPatientInfo] = useState(null);
    const [vitalsInfo, setVitalsInfo] = useState([]);
    const [historyInfo, setHistoryInfo] = useState(null);

    useEffect(() => {
        const fetchConsultationData = async () => {
            if (!id) {
                setIsLoading(false);
                return;
            }
            try {
                const { data: appt } = await appointmentService.getById(id);
                if (appt && appt.patients) {
                    const pt = appt.patients;
                    const u = pt.users;
                    setPatientInfo({
                        name: `${u.first_name || ''} ${u.last_name || ''}`,
                        initials: u.initials || `${(u.first_name?.[0]||'').toUpperCase()}${(u.last_name?.[0]||'').toUpperCase()}`,
                        id: pt.id.split('-')[0],
                        age: pt.date_of_birth ? new Date().getFullYear() - new Date(pt.date_of_birth).getFullYear() : 'N/A',
                        sex: pt.sex || 'Unknown'
                    });

                    setHistoryInfo({
                        allergies: pt.allergies ? [{ name: pt.allergies, severity: 'Recorded' }] : [{ name: 'None known', severity: 'N/A' }],
                        familyHistory: ['Not recorded'],
                        vaccines: ['Not recorded'],
                        surgical: ['Not recorded'],
                        symptoms: appt.reason || 'No specific symptoms provided.',
                        clinicalNotes: appt.notes || 'No prior notes.',
                        medicalHistory: pt.medical_history || 'No medical history recorded.'
                    });

                    // Fetch precheck forms
                    const { data: prechecks } = await supabase
                        .from('precheck_forms')
                        .select('*')
                        .eq('patient_id', pt.id)
                        .order('created_at', { ascending: false })
                        .limit(1);

                    if (prechecks && prechecks.length > 0) {
                        const pc = prechecks[0];
                        setVitalsInfo([
                            { label: 'Blood Pressure', value: pc.blood_pressure || '---', unit: 'mmHg' },
                            { label: 'Temperature', value: pc.temperature || '---', unit: '°C' },
                            { label: 'Heart Rate', value: pc.heart_rate || '---', unit: 'bpm' },
                            { label: 'Weight', value: pc.weight || '---', unit: 'kg' },
                            { label: 'Height', value: pc.height || '---', unit: 'cm' }
                        ]);
                    } else {
                        setVitalsInfo([]);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch data', err);
            }
            setIsLoading(false);
        };
        fetchConsultationData();
    }, [id]);

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#f5f7f8]">
                <div className="w-full max-w-sm space-y-4 px-8 animate-pulse">
                    <div className="h-14 w-14 rounded-2xl bg-slate-200 mx-auto mb-6"></div>
                    <div className="h-5 bg-slate-200 rounded w-3/4 mx-auto"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/2 mx-auto"></div>
                    <div className="h-4 bg-slate-200 rounded w-2/3 mx-auto"></div>
                </div>
            </div>
        );
    }

    const addMedication = () => {
        setMedications([...medications, { name: '', dosage: '', duration: '' }]);
    };

    const updateMedication = (index, field, value) => {
        const updated = [...medications];
        updated[index][field] = value;
        setMedications(updated);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const data = {
                appointment_id: id || null,
                notes,
                diagnosis: icd10,
                medications: medications
            };
            
            const result = await consultationService.create(data);
            if (result.error) throw result.error;

            await notificationService.notifyRole('secretary', {
                title: 'Consultation Complete — Bill Ready',
                message: 'Doctor has completed a consultation. Please generate the invoice for this visit.',
                type: 'consultation',
                related_id: result.data?.id || id,
                related_type: 'consultation',
            });

            showToast('Consultation saved successfully', 'success');
            navigate('/doctor-dashboard');
        } catch (error) {
            console.error('Save failed', error);
            showToast('Failed to save consultation', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex h-screen w-full bg-[#f5f7f8] text-[#0f172a] overflow-hidden font-['Inter']">
            <aside className="hidden md:flex flex-col h-full p-4 gap-2 bg-slate-50 border-r border-slate-200 w-64 shrink-0">
                <div className="flex items-center gap-3 px-2 mb-8 mt-2">
                    <div className="w-10 h-10 rounded-xl bg-[#0d6cf2] flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">{user?.initials || 'DR'}</div>
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-[#0f172a] leading-none">
                            {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Doctor'}
                        </span>
                        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mt-1">General Practitioner</span>
                    </div>
                </div>
                <nav className="flex flex-col gap-1">
                    <div onClick={() => navigate('/doctor-dashboard')} className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-200/50 rounded-lg transition-all duration-200 ease-in-out cursor-pointer group">
                        <span className="material-symbols-outlined text-[20px]">dashboard</span>
                        <span className="text-sm font-medium tracking-tight">Dashboard</span>
                    </div>
                    <div onClick={() => navigate('/doctor-patients')} className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-200/50 rounded-lg transition-all duration-200 ease-in-out cursor-pointer group">
                        <span className="material-symbols-outlined text-[20px]">group</span>
                        <span className="text-sm font-medium tracking-tight">Patients</span>
                    </div>
                    <div onClick={() => navigate('/doctor-appointments')} className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-200/50 rounded-lg transition-all duration-200 ease-in-out cursor-pointer group">
                        <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                        <span className="text-sm font-medium tracking-tight">Appointments</span>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-200/50 rounded-lg transition-all duration-200 ease-in-out cursor-pointer group">
                        <span className="material-symbols-outlined text-[20px]">description</span>
                        <span className="text-sm font-medium tracking-tight">Reports</span>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-200/50 rounded-lg transition-all duration-200 ease-in-out cursor-pointer group">
                        <span className="material-symbols-outlined text-[20px]">forward_to_inbox</span>
                        <span className="text-sm font-medium tracking-tight">Referrals</span>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-200/50 rounded-lg transition-all duration-200 ease-in-out cursor-pointer group">
                        <span className="material-symbols-outlined text-[20px]">verified</span>
                        <span className="text-sm font-medium tracking-tight">Certificates</span>
                    </div>
                </nav>
                <div className="mt-auto p-2">
                    <button className="w-full bg-white border border-slate-200 text-[#0f172a] py-3 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-sm">add</span>
                        New Consultation
                    </button>
                </div>
            </aside>

            <div className="flex flex-col flex-1 overflow-hidden">
                <header className="flex justify-between items-center w-full px-6 h-16 sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4">
                        <span className="text-xl font-black tracking-tighter text-primary">Clinical Precision</span>
                        <div className="h-6 w-[1px] bg-slate-200 mx-2"></div>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-lg">search</span>
                            <input className="bg-slate-100 border-none rounded-xl pl-10 pr-4 py-1.5 text-sm w-64 focus:ring-2 focus:ring-blue-500 transition-all" placeholder="Search patient history..." type="text"/>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="p-2 text-slate-500 hover:bg-primary/5 transition-colors rounded-lg relative">
                            <span className="material-symbols-outlined">notifications</span>
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>
                        <button className="p-2 text-slate-500 hover:bg-primary/5 transition-colors rounded-lg">
                            <span className="material-symbols-outlined">settings</span>
                        </button>
                        <div className="flex items-center gap-3 ml-2 pl-4 border-l border-slate-200">
                            <div className="w-8 h-8 rounded-full bg-[#0d6cf2]/20 flex items-center justify-center text-[#0d6cf2] font-bold text-xs">{user?.initials || 'DR'}</div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
                    <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-wrap md:flex-nowrap justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold ${patientInfo ? avatarColor(patientInfo.initials) : 'bg-slate-100 text-slate-700'}`}>
                                {patientInfo?.initials || '?'}
                            </div>
                            <div>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-2xl font-black text-[#0f172a] tracking-tight">{patientInfo?.name || 'Unknown Patient'}</h1>
                                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Active Consultation</span>
                                </div>
                                <div className="flex items-center gap-4 mt-1">
                                    <span className="text-sm font-medium text-slate-500"><span className="text-slate-400 font-normal mr-1">ID:</span> {patientInfo?.id || 'N/A'}</span>
                                    <span className="text-sm font-medium text-slate-500"><span className="text-slate-400 font-normal mr-1">Age:</span> {patientInfo?.age || 'N/A'}</span>
                                    <span className="text-sm font-medium text-slate-500"><span className="text-slate-400 font-normal mr-1">Sex:</span> {patientInfo?.sex || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 bg-critical/10 text-critical px-4 py-2 rounded-xl border border-red-100 shadow-sm">
                            <span className="material-symbols-outlined text-[20px] animate-pulse">timer</span>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold uppercase tracking-tighter">In Session</span>
                                <span className="text-lg font-black leading-none tabular-nums">{formatTimer(sessionSeconds)}</span>
                            </div>
                        </div>
                    </section>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        <div className="lg:col-span-8 space-y-6">
                            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-bold text-[#0f172a] flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">edit_note</span>
                                        Clinical Examination Notes
                                    </h2>
                                    <button className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider bg-primary/5 px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors">
                                        <span className="material-symbols-outlined text-[16px]">mic</span>
                                        Voice Input
                                    </button>
                                </div>
                                <textarea 
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full h-48 bg-slate-50 border-slate-200 rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none resize-none placeholder:text-slate-400" 
                                    placeholder="Start typing clinical observations..."
                                />
                            </div>

                            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                                <h2 className="text-xl font-bold text-[#0f172a] mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">medical_services</span>
                                    Diagnosis
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">ICD-10 Classification</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-lg">search</span>
                                            <input 
                                                value={icd10}
                                                onChange={(e) => setIcd10(e.target.value)}
                                                className="w-full bg-slate-50 border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 transition-all" 
                                                placeholder="Search ICD-10 code or description..." 
                                                type="text"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Severity</label>
                                        <select 
                                            value={severity}
                                            onChange={(e) => setSeverity(e.target.value)}
                                            className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
                                        >
                                            <option value="">Select Severity</option>
                                            <option>Mild / Acute</option>
                                            <option>Moderate</option>
                                            <option>Severe / Critical</option>
                                            <option>Chronic / Routine</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-bold text-[#0f172a] flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">prescriptions</span>
                                        Treatment Plan
                                    </h2>
                                    <button onClick={addMedication} className="text-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1 hover:underline">
                                        <span className="material-symbols-outlined text-sm">add</span> Add Medication
                                    </button>
                                </div>
                                {medications.map((med, idx) => (
                                    <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Medication Name</label>
                                            <input value={med.name} onChange={(e) => updateMedication(idx, 'name', e.target.value)} className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 transition-all" placeholder="e.g. Lisinopril" type="text"/>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Dosage</label>
                                            <input value={med.dosage} onChange={(e) => updateMedication(idx, 'dosage', e.target.value)} className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 transition-all" placeholder="e.g. 10mg once daily" type="text"/>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Duration</label>
                                            <input value={med.duration} onChange={(e) => updateMedication(idx, 'duration', e.target.value)} className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 transition-all" placeholder="e.g. 30 Days" type="text"/>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="lg:col-span-4 h-full">
                            <div className="bg-indigo-50/50 rounded-xl border border-indigo-100 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-280px)]">
                                <div className="p-6 pb-4 border-b border-indigo-100 shrink-0 bg-indigo-50/80">
                                    <h2 className="text-[12px] font-semibold text-indigo-700 uppercase tracking-[0.1em] flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[18px]">verified_user</span>
                                        Pre-Doctor Assessment
                                    </h2>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    <section>
                                        <h3 className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-3 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">vitals</span> Core Vitals &amp; Biometrics
                                        </h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            {vitalsInfo.length > 0 ? vitalsInfo.map((vital, i) => (
                                                <div key={i} className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">{vital.label}</span>
                                                    <span className="text-base font-bold text-[#0f172a]">{vital.value}</span>
                                                    {vital.unit && <span className="text-[9px] font-medium text-slate-400 block">{vital.unit}</span>}
                                                </div>
                                            )) : (
                                                <div className="col-span-2 text-sm text-slate-500 italic p-4 bg-white/50 rounded-xl border border-indigo-50">No recent vitals or pre-check data found for this patient.</div>
                                            )}
                                        </div>
                                    </section>

                                    <section className="space-y-4">
                                        <h3 className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-1 border-t border-indigo-100 pt-4">
                                            <span className="material-symbols-outlined text-[14px]">history_edu</span> Clinical History
                                        </h3>
                                        <div className="bg-red-50 border border-red-100 p-3 rounded-xl">
                                            <span className="text-[9px] font-bold text-critical uppercase block mb-1">Allergies</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-red-900">{historyInfo?.allergies?.[0]?.name || 'None known'}</span>
                                                <span className="bg-red-200 text-critical text-[8px] px-1.5 py-0.5 rounded font-semibold uppercase">{historyInfo?.allergies?.[0]?.severity || ''}</span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4">
                                            <div>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Medical History</span>
                                                <div className="text-sm font-medium text-[#0f172a] flex flex-col gap-1">
                                                    <span className="flex items-center gap-2">
                                                        <span className="w-1 h-1 rounded-full bg-indigo-400"></span> {historyInfo?.medicalHistory}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    <section className="space-y-4">
                                        <h3 className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-1 border-t border-indigo-100 pt-4">
                                            <span className="material-symbols-outlined text-[14px]">psychology</span> Clinical Findings
                                        </h3>
                                        <div>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Reported Symptoms / Reason for Visit</span>
                                            <p className="text-sm font-medium text-[#0f172a] italic leading-relaxed bg-white/50 p-2 rounded-lg border border-indigo-50">
                                                "{historyInfo?.symptoms}"
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Pre-Doctor Clinical Notes</span>
                                            <p className="text-sm font-medium text-slate-600 leading-relaxed bg-white/50 p-2 rounded-lg border border-indigo-50">
                                                {historyInfo?.clinicalNotes}
                                            </p>
                                        </div>
                                    </section>
                                </div>
                                <div className="p-4 border-t border-indigo-100 bg-indigo-50/30 flex justify-center shrink-0">
                                    <button
                                        onClick={() => patientInfo?.id && navigate(`/doctor-patient/${patientInfo.id}`)}
                                        className="text-[10px] font-semibold text-indigo-600 uppercase tracking-widest flex items-center gap-1 hover:text-indigo-800 transition-colors"
                                    >
                                        View Detailed Patient Record <span className="material-symbols-outlined text-sm">open_in_new</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>

                <footer className="h-20 bg-white border-t border-slate-200 px-8 flex items-center justify-between shadow-[0_-4px_12px_rgba(0,0,0,0.03)] z-50">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/doctor-lab-request')} className="bg-slate-100 text-slate-700 font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-slate-200 transition-all flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">biotech</span>
                            Request Lab Test
                        </button>
                        <button onClick={() => navigate('/doctor-referrals')} className="bg-slate-100 text-slate-700 font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-slate-200 transition-all flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">forward</span>
                            Create Referral
                        </button>
                        <button onClick={() => navigate('/doctor-certificates')} className="bg-slate-100 text-slate-700 font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-slate-200 transition-all flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">assignment_turned_in</span>
                            Generate Certificate
                        </button>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="text-slate-500 font-medium text-sm px-6 py-2.5 hover:text-[#0f172a] transition-colors">
                            Discard
                        </button>
                        <button disabled={isSaving} onClick={handleSave} className="bg-[#0d6cf2] text-white font-semibold text-sm px-10 py-3 rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-2 disabled:opacity-50">
                            <span className="material-symbols-outlined text-[20px]">{isSaving ? 'hourglass_empty' : 'save'}</span>
                            {isSaving ? 'Saving...' : 'Save Consultation'}
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
}