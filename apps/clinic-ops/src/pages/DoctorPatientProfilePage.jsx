import React, { useState, useEffect } from 'react';
import { logError } from '@/lib/logger';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { patientService } from '@/services/patients';
import { precheckService } from '@/services/prechecks';
import { clinicalService } from '@/services/clinical';
import { useBrand } from '@/contexts/BrandContext';

function calcAge(dob) {
    if (!dob) return '—';
    return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

function formatDob(dob) {
    if (!dob) return '—';
    return new Date(dob + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function mapPatient(p) {
    const u = p.users || {};
    const firstName = u.first_name || '';
    const lastName = u.last_name || '';
    return {
        name: `${firstName} ${lastName}`.trim() || 'Unknown',
        initials: u.initials || ((firstName[0] || '') + (lastName[0] || '')).toUpperCase(),
        id: p.id,
        age: calcAge(p.date_of_birth),
        sex: p.sex || '—',
        dob: formatDob(p.date_of_birth),
        occupation: '—',
        bloodType: p.blood_type || '—',
        insurance: p.insurance_id || '—',
        location: '—',
        lastVisit: '—',
        primaryMD: '—',
        color: 'bg-primary/10 text-primary',
        allergies: Array.isArray(p.allergies) ? p.allergies : (p.allergies ? [p.allergies] : []),
        medical_history: p.medical_history || 'No medical history recorded.'
    };
}

export default function DoctorPatientProfilePage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const { displayName } = useBrand();
    const [searchQuery, setSearchQuery] = useState('');
    const [patient, setPatient] = useState(null);
    const [patientLoading, setPatientLoading] = useState(true);
    const [patientError, setPatientError] = useState(null);
    const [vitals, setVitals] = useState([]);
    const [medications, setMedications] = useState([]);

    useEffect(() => {
        if (!id) return;
        const fetchData = async () => {
            setPatientLoading(true);
            try {
                const [pRes, vRes, prescriptionsRes] = await Promise.all([
                    patientService.getById(id),
                    precheckService.getByPatientId(id),
                    clinicalService.getPrescriptions(id, { status: 'active', pageSize: 25 })
                ]);

                if (pRes.error || !pRes.data) {
                    setPatientError('Patient not found');
                } else {
                    setPatient(mapPatient(pRes.data));
                }

                if (vRes.data && vRes.data[0]) {
                    const pc = vRes.data[0];
                    setVitals([
                        { label: 'Blood Pressure', value: pc.blood_pressure || '—', unit: 'mmHg', icon: 'blood_pressure', color: 'text-primary' },
                        { label: 'Temperature', value: pc.temperature || '—', unit: '°C', icon: 'thermometer', color: 'text-orange-600' },
                        { label: 'Heart Rate', value: pc.heart_rate || '—', unit: 'BPM', icon: 'favorite', color: 'text-critical' },
                    ]);
                } else {
                    setVitals([
                        { label: 'Blood Pressure', value: '—', unit: 'mmHg', icon: 'blood_pressure', color: 'text-primary' },
                        { label: 'Temperature', value: '—', unit: '°C', icon: 'thermometer', color: 'text-orange-600' },
                        { label: 'Heart Rate', value: '—', unit: 'BPM', icon: 'favorite', color: 'text-critical' },
                    ]);
                }

                if (prescriptionsRes.data) {
                    setMedications(prescriptionsRes.data.map((prescription) => ({
                        name: prescription.medication_name,
                        dosage: [prescription.dosage, prescription.frequency].filter(Boolean).join(' • ') || '—',
                        duration: prescription.duration || prescription.status || 'Active',
                    })));
                }
            } catch (err) {
                logError('error', err);
                setPatientError('Failed to load data');
            } finally {
                setPatientLoading(false);
            }
        };
        fetchData();
    }, [id]);

    if (patientLoading) return (
        <div className="flex h-screen items-center justify-center bg-[var(--bg-base)]">
            <span className="material-symbols-outlined animate-spin text-primary text-4xl">progress_activity</span>
        </div>
    );

    if (patientError || !patient) return (
        <div className="flex h-screen items-center justify-center bg-[var(--bg-base)]">
            <p className="text-slate-500 font-semibold">{patientError || 'Patient not found'}</p>
        </div>
    );

    return (
        <DashboardLayout role="doctor">
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="bg-white border-b border-slate-100 shadow-sm h-16 px-6 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <span className="text-xl font-black text-slate-900 tracking-tighter">{displayName}</span>
                        <div className="hidden md:flex items-center ml-8 space-x-6 h-full">
                            <button className="text-primary border-b-2 border-blue-600 h-16 flex items-center text-sm font-medium">Profile</button>
                            <button className="text-slate-500 hover:bg-primary/5 h-16 flex items-center text-sm font-medium">Records</button>
                            <button className="text-slate-500 hover:bg-primary/5 h-16 flex items-center text-sm font-medium">Analytics</button>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative hidden sm:block">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                            <input 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-slate-50 rounded-xl pl-10 pr-4 py-2 text-sm border-none focus:ring-2 focus:ring-primary w-64" 
                                placeholder="Search records..." 
                                type="text"
                            />
                        </div>
                        <button className="text-slate-500 hover:bg-primary/5 p-2 rounded-full">
                            <span className="material-symbols-outlined">notifications</span>
                        </button>
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-black text-xs">—</div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8 max-w-7xl mx-auto w-full">
                    <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
                        <div className="flex items-center gap-6">
                            <div className="relative flex items-center">
                                <div className={`w-24 h-24 md:w-32 md:h-32 rounded-xl flex items-center justify-center text-4xl font-black shadow-lg border-4 border-white ${patient.color}`}>
                                    {patient.initials}
                                </div>
                                <span className="absolute -bottom-2 -right-2 bg-green-500 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm ring-2 ring-white">Active</span>
                                <button onClick={() => navigate(`/doctor-patient-history/${id}`)} className="ml-4 flex items-center gap-2 bg-primary hover:text-primary text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm transition-all">
                                    <span className="material-symbols-outlined text-sm">history</span>
                                    View Medical History
                                </button>
                            </div>
                            <div>
                                <h2 className="text-[30px] font-black text-slate-900 tracking-tight leading-none mb-1">{patient.name}</h2>
                                <p className="text-sm font-bold text-primary uppercase tracking-widest mb-2">ID: {patient.id}</p>
                                <div className="flex gap-4">
                                    <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase">
                                        <span className="material-symbols-outlined text-sm">cake</span>
                                        {patient.dob}
                                    </span>
                                    <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase">
                                        <span className="material-symbols-outlined text-sm">person</span>
                                        {patient.sex}, {patient.age}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <div className="px-4 py-2 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last Visit</span>
                                <span className="text-sm font-bold text-slate-800">{patient.lastVisit}</span>
                            </div>
                            <div className="px-4 py-2 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Primary MD</span>
                                <span className="text-sm font-bold text-slate-800">{patient.primaryMD}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        <div className="md:col-span-4 space-y-6">
                            <section className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">info</span>
                                    Personal Information
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                                        <span className="text-xs font-bold text-slate-400 uppercase">Job Title</span>
                                        <span className="text-sm font-medium text-slate-800">{patient.occupation}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                                        <span className="text-xs font-bold text-slate-400 uppercase">Blood Type</span>
                                        <span className="text-sm font-bold text-critical px-2 py-0.5 bg-red-50 rounded">{patient.bloodType}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                                        <span className="text-xs font-bold text-slate-400 uppercase">Insurance</span>
                                        <span className="text-sm font-medium text-slate-800">{patient.insurance}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-400 uppercase">Location</span>
                                        <span className="text-sm font-medium text-slate-800">{patient.location}</span>
                                    </div>
                                </div>
                            </section>

                            <section className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">monitoring</span>
                                        Recent Vitals
                                    </h3>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">From latest pre-check</span>
                                </div>
                                <div className="space-y-4">
                                    {vitals.map((vital, i) => (
                                        <div key={i} className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${vital.color.replace('text-', 'bg-').replace('600', '-50')}`}>
                                                    <span className={`material-symbols-outlined ${vital.color}`}>{vital.icon}</span>
                                                </div>
                                                <span className="text-xs font-bold text-slate-500 uppercase">{vital.label}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xl font-black text-slate-900">{vital.value}</span>
                                                <span className="text-[10px] block text-slate-400 font-bold">{vital.unit}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {vitals.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No recent vitals recorded</p>}
                                </div>
                            </section>
                        </div>

                        <div className="md:col-span-5 space-y-6">
                            <section className="bg-white rounded-xl p-8 shadow-sm border border-slate-100">
                                <h3 className="text-xl font-black text-slate-900 mb-8 border-l-4 border-primary pl-4">Medical Background</h3>
                                <div className="space-y-10">
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="material-symbols-outlined text-critical">warning</span>
                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Known Allergies</h4>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {patient.allergies?.length > 0 ? patient.allergies.map((allergy, i) => (
                                                <span key={i} className="bg-critical/10 text-critical text-[10px] font-bold uppercase px-3 py-1 rounded-full border border-red-200">{allergy}</span>
                                            )) : (
                                                <span className="text-xs text-slate-400">None recorded</span>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="material-symbols-outlined text-green-600">vaccines</span>
                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Vaccination Record</h4>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-sm text-slate-600 italic">Immunization records are maintained in the central registry.</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-8">
                                        <div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="material-symbols-outlined text-slate-400">history</span>
                                                <h4 className="text-xs font-bold text-slate-500 uppercase">Medical History Summary</h4>
                                            </div>
                                            <p className="text-sm font-medium text-slate-800 leading-relaxed">{patient.medical_history}</p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">medication</span>
                                    Active Medications
                                </h3>
                                <div className="space-y-3">
                                    {medications.length > 0 ? medications.map((med, i) => (
                                        <div key={i} className="flex items-center gap-4 p-4 bg-primary/5/50 rounded-xl border border-primary/20">
                                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-primary shadow-sm">
                                                <span className="material-symbols-outlined">pill</span>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-900">{med.name}</h4>
                                                <p className="text-xs font-medium text-slate-500">{med.dosage} • {med.duration}</p>
                                            </div>
                                        </div>
                                    )) : (
                                        <p className="text-xs text-slate-400 text-center py-4">No active medications found</p>
                                    )}
                                </div>
                            </section>
                        </div>

                        <div className="md:col-span-3 space-y-6">
                            <div className="space-y-4">
                                <div className="p-4 bg-white rounded-lg border border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-slate-400">description</span>
                                        <span className="text-xs font-bold text-slate-700 uppercase">Latest Lab Results</span>
                                    </div>
                                    <span className="material-symbols-outlined text-slate-300">chevron_right</span>
                                </div>
                                <div className="p-4 bg-white rounded-lg border border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-slate-400">image</span>
                                        <span className="text-xs font-bold text-slate-700 uppercase">Radiology Images</span>
                                    </div>
                                    <span className="material-symbols-outlined text-slate-300">chevron_right</span>
                                </div>
                                <div className="p-4 bg-white rounded-lg border border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-slate-400">assignment_ind</span>
                                        <span className="text-xs font-bold text-slate-700 uppercase">Consent Forms</span>
                                    </div>
                                    <span className="material-symbols-outlined text-slate-300">chevron_right</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <footer className="mt-auto py-8 px-8 border-t border-slate-100 flex justify-between items-center text-slate-400">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em]">© 2025 {displayName} • Secure Clinical Environment</p>
                    <div className="flex gap-4">
                        <span className="text-[10px] font-bold uppercase">Privacy Policy</span>
                        <span className="text-[10px] font-bold uppercase">System Status</span>
                    </div>
                </footer>
            </div>
        </DashboardLayout>
    );
}
