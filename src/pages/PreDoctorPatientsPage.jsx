import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { patientService } from '../services/patients';
import { useToast } from '../contexts/ToastContext';
import PreDoctorSidebar from '../components/PreDoctorSidebar';
import { stagger, fadeUp } from '../lib/animations';

export default function PreDoctorPatientsPage() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchPatients = async () => {
        try {
            setLoading(true);
            const { data, error } = await patientService.getAll();
            if (!error && data) {
                setPatients(data || []);
            } else {
                showToast('Failed to load patients', 'error');
            }
        } catch (err) {
            console.error('Error fetching patients:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPatients();
    }, []);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    return (
        <div className="flex h-screen overflow-hidden font-display bg-background-light">
            <PreDoctorSidebar />

            <main className="flex-1 flex flex-col overflow-y-auto">
                <header className="sticky top-0 z-20 h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
                    <div className="flex items-center gap-4 flex-1 max-w-xl">
                        <div className="relative w-full">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">search</span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search patients, records, or files..."
                                className="w-full bg-slate-100 border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 transition-all relative z-10"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-4 relative">
                        <button onClick={() => { setShowNotifications(!showNotifications); setShowSettings(false); }} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary transition-all relative">
                            <span className="material-symbols-outlined">notifications</span>
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>
                        <button onClick={() => { setShowSettings(!showSettings); setShowNotifications(false); }} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary transition-all">
                            <span className="material-symbols-outlined">settings</span>
                        </button>
                    </div>
                </header>

                <div className="p-8 pb-12">
                    <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-10 flex items-end justify-between">
                        <div>
                            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Patients</h2>
                            <p className="text-slate-500 mt-2 text-base">Manage your patient records and pre-check queue.</p>
                        </div>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-6 py-4 text-[12px] font-black uppercase tracking-widest text-slate-500">Patient ID</th>
                                    <th className="px-6 py-4 text-[12px] font-black uppercase tracking-widest text-slate-500">Full Name</th>
                                    <th className="px-6 py-4 text-[12px] font-black uppercase tracking-widest text-slate-500">Phone Number</th>
                                    <th className="px-6 py-4 text-[12px] font-black uppercase tracking-widest text-slate-500">Last Visit</th>
                                    <th className="px-6 py-4 text-right text-[12px] font-black uppercase tracking-widest text-slate-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    [1,2,3].map(i => (
                                        <tr key={i}><td colSpan={5} className="px-6 py-4"><div className="h-4 bg-slate-200 rounded animate-pulse" /></td></tr>
                                    ))
                                ) : patients.length === 0 ? (
                                    <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">No patients found.</td></tr>
                                ) : patients.filter(p => {
                                    const name = `${p.users?.first_name || ''} ${p.users?.last_name || ''}`.toLowerCase();
                                    return name.includes(searchQuery.toLowerCase()) || (p.users?.phone || '').includes(searchQuery);
                                }).map((patient, i) => {
                                    const firstName = patient.users?.first_name || '';
                                    const lastName = patient.users?.last_name || '';
                                    const name = `${firstName} ${lastName}`.trim() || 'Unknown';
                                    const initials = ((firstName[0] || '') + (lastName[0] || '')).toUpperCase() || '?';
                                    const COLORS = ['bg-primary/10 text-primary','bg-success/10 text-success','bg-warning/10 text-warning','bg-secondary/10 text-secondary'];
                                    return (
                                        <motion.tr key={patient.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} whileHover={{ backgroundColor: 'rgba(59,130,246,0.05)' }} className="group">
                                            <td className="px-6 py-5"><span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-mono font-bold">{patient.id.slice(0,8)}</span></td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${COLORS[i % COLORS.length]}`}>{initials}</div>
                                                    <span className="text-sm font-bold text-slate-900">{name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5"><span className="text-sm text-slate-500 font-medium">{patient.users?.phone || '—'}</span></td>
                                            <td className="px-6 py-5"><span className="text-sm font-medium text-slate-700">{new Date(patient.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></td>
                                            <td className="px-6 py-5 text-right">
                                                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => navigate(`/patient-profile/${patient.id}`)} className="bg-primary text-white px-5 py-2 rounded-lg text-xs font-bold shadow-md hover:opacity-90 transition-all">View Profile</motion.button>
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
