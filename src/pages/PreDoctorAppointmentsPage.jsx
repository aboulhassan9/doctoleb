import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import PreDoctorSidebar from '../components/PreDoctorSidebar';
import { appointmentService } from '../services/appointments';

const AVATAR_COLORS = [
    'bg-primary/10 text-primary', 'bg-success/10 text-success',
    'bg-warning/10 text-warning', 'bg-secondary/10 text-secondary',
];

const STATUS_STYLE = {
    scheduled:   'bg-slate-100 text-slate-600',
    pre_check:   'bg-warning/10 text-warning',
    in_progress: 'bg-primary/10 text-primary',
    completed:   'bg-success/10 text-success',
    cancelled:   'bg-red-100 text-red-600',
};

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function PreDoctorAppointmentsPage() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        (async () => {
            setLoading(true);
            const { data } = await appointmentService.getAll();
            if (data) {
                const start = new Date(); start.setHours(0, 0, 0, 0);
                const end   = new Date(); end.setHours(23, 59, 59, 999);
                setAppointments(data.filter(a => {
                    const d = new Date(a.scheduled_at);
                    return d >= start && d <= end;
                }));
            }
            setLoading(false);
        })();
    }, []);

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
                            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Appointments</h2>
                            <p className="text-slate-500 mt-2 text-base">Manage today's clinical queue and patient intake.</p>
                        </div>
                    </motion.div>

                    {/* Stats derived from live data */}
                    <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
                        {[
                            { label: 'Total Today', value: appointments.length, color: 'text-slate-900' },
                            { label: 'Waiting / Scheduled', value: appointments.filter(a => a.status === 'scheduled' || a.status === 'pre_check').length, color: 'text-warning' },
                            { label: 'Completed', value: appointments.filter(a => a.status === 'completed').length, color: 'text-success' },
                        ].map((stat, i) => (
                            <motion.div variants={fadeUp} key={i} whileHover={{ y: -4, boxShadow: '0 12px 40px rgba(0,0,0,0.08)' }} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <span className="text-[12px] font-black uppercase tracking-wider text-slate-500">{stat.label}</span>
                                <h3 className={`text-3xl font-black mt-2 ${stat.color}`}>{loading ? '—' : stat.value}</h3>
                            </motion.div>
                        ))}
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest">
                                Daily Schedule — {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </h3>
                        </div>
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Patient</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Time</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Status</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    [1,2,3].map(i => (
                                        <tr key={i}><td colSpan={4} className="px-6 py-4"><div className="h-4 bg-slate-200 rounded animate-pulse" /></td></tr>
                                    ))
                                ) : appointments.length === 0 ? (
                                    <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400">No appointments scheduled for today.</td></tr>
                                ) : appointments.filter(a => {
                                    const firstName = a.patients?.users?.first_name || '';
                                    const lastName  = a.patients?.users?.last_name  || '';
                                    const name = `${firstName} ${lastName}`.toLowerCase();
                                    return name.includes(searchQuery.toLowerCase());
                                }).map((appt, i) => {
                                    const firstName = appt.patients?.users?.first_name || '';
                                    const lastName  = appt.patients?.users?.last_name  || '';
                                    const name     = `${firstName} ${lastName}`.trim() || 'Unknown';
                                    const initials = appt.patients?.users?.initials || ((firstName[0] || '') + (lastName[0] || '')).toUpperCase() || '?';
                                    const color    = AVATAR_COLORS[i % AVATAR_COLORS.length];
                                    const statusStyle = STATUS_STYLE[appt.status] || 'bg-slate-100 text-slate-600';
                                    const time = new Date(appt.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                                    const isDone = appt.status === 'completed' || appt.status === 'cancelled';
                                    return (
                                        <motion.tr key={appt.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.05)' }} className="group">
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${color}`}>{initials}</div>
                                                    <div>
                                                        <p className="font-bold text-slate-900">{name}</p>
                                                        <p className="text-xs text-slate-400 font-mono">{appt.id.slice(0, 8)}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className="font-bold text-sm text-slate-900">{time}</span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${statusStyle}`}>
                                                    {appt.status.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                {isDone ? (
                                                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg font-bold text-xs uppercase">
                                                        View Record
                                                    </motion.button>
                                                ) : (
                                                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => navigate('/predoctor-new-check')} className="px-4 py-2 bg-primary text-white rounded-lg font-bold text-xs uppercase">
                                                        {appt.status === 'pre_check' ? 'Resume' : 'Start Pre-Check'}
                                                    </motion.button>
                                                )}
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