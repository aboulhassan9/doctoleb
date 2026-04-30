import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import DoctorSidebar from '../components/DoctorSidebar';
import MobileTopBar from '../components/MobileTopBar';
import BorderGlow from '../components/BorderGlow';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import { notificationService } from '../services/notifications';
import { useAuth } from '../contexts/AuthContext';
import { appointmentService } from '../services/appointments';
import { patientService } from '../services/patients';
import { doctorService } from '../services/doctors';
import { supabase } from '../lib/supabase';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export default function DoctorDashboardPage() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const { showToast } = useToast();
    const { isDarkMode, setIsDarkMode, customBg, setCustomBg } = useTheme();
    const { user, logout } = useAuth();
    
    const doctorUser = user ? {
        name: `${user.first_name || ''} ${user.last_name || ''}`,
        role: user.role === 'doctor' ? 'Chief Resident' : 'Doctor',
        initials: `${user.first_name?.[0]||''}${user.last_name?.[0]||''}`.toUpperCase(),
        department: 'General Practice'
    } : { name: 'Dr. Thorne', role: 'Doctor', initials: 'DT', department: 'General Practice' };

    const [doctorStats, setDoctorStats] = useState([
        { label: 'Total Patients', value: '...', icon: 'groups', color: 'bg-primary/10 text-primary', change: '', changeColor: 'text-success' },
        { label: "Today's Appointments", value: '...', icon: 'event_note', color: 'bg-primary/10 text-primary', change: '', changeColor: 'text-primary' },
        { label: 'Pending Pre-Checks', value: '...', icon: 'pending_actions', color: 'bg-warning/10 text-warning', change: '', changeColor: 'text-warning' },
        { label: 'Unread Notifications', value: '...', icon: 'mail', color: 'bg-critical/10 text-critical', change: '', changeColor: 'text-critical' }
    ]);
    const [doctorAppointments, setDoctorAppointments] = useState([]);
    const [activeAlerts, setActiveAlerts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            const [apptsRes, patientsRes, notifsRes] = await Promise.all([
                appointmentService.getAll(),
                patientService.getAll(),
                user ? notificationService.getUnread(user.id) : { data: [] }
            ]);

            if (apptsRes.data) {
                const todayStr = new Date().toLocaleDateString('en-US');
                const todays = apptsRes.data.filter(a => {
                    if(!a.scheduled_at) return false;
                    return new Date(a.scheduled_at).toLocaleDateString('en-US') === todayStr;
                });

                const formattedAppts = todays.map(appt => {
                    const fname = appt.patients?.users?.first_name || 'Unknown';
                    const lname = appt.patients?.users?.last_name || 'Patient';
                    const s = appt.status || 'Pending';
                    const date = new Date(appt.scheduled_at);
                    const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                    const statusColor = s.toLowerCase() === 'confirmed' ? 'bg-success/10 text-success' : s.toLowerCase() === 'completed' ? 'bg-slate-100 text-slate-500' : 'bg-warning/10 text-warning';
                    
                    return {
                        id: appt.id,
                        patientId: appt.patient_id,
                        name: `${fname} ${lname}`,
                        initials: `${fname[0]||''}${lname[0]||''}`.toUpperCase(),
                        time: timeStr,
                        status: s.charAt(0).toUpperCase() + s.slice(1),
                        statusColor
                    };
                });
                setDoctorAppointments(formattedAppts);

                const totalPatients = patientsRes.data ? patientsRes.data.length : 0;
                const unreadCount = notifsRes.data ? notifsRes.data.length : 0;
                setDoctorStats([
                    { label: 'Total Patients', value: totalPatients.toString(), icon: 'groups', color: 'bg-primary/10 text-primary', change: 'Total', changeColor: 'text-success' },
                    { label: "Today's Appointments", value: todays.length.toString(), icon: 'event_note', color: 'bg-primary/10 text-primary', change: 'Today', changeColor: 'text-primary' },
                    { label: 'Pending Pre-Checks', value: '0', icon: 'pending_actions', color: 'bg-warning/10 text-warning', change: 'Action Needed', changeColor: 'text-warning' },
                    { label: 'Unread Notifications', value: unreadCount.toString(), icon: 'mail', color: 'bg-critical/10 text-critical', change: unreadCount > 0 ? 'New' : '', changeColor: 'text-critical' }
                ]);
                
                if (notifsRes.data) {
                    setActiveAlerts(notifsRes.data.slice(0, 5));
                }
            }
            setLoading(false);
        };
        fetchDashboardData();

        let notifSub = null;
        if (user) {
            notifSub = notificationService.subscribeToUserNotifications(user.id, () => {
                fetchDashboardData(); // Refetch on new notification
                showToast('New notification received', 'info');
            });
        }

        return () => {
            if (notifSub) notifSub.unsubscribe();
        };
    }, [user, showToast]);

    const [doctorRecord, setDoctorRecord] = useState(null);
    const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', phone: '', specialization: '', department: '' });
    const [profileSaving, setProfileSaving] = useState(false);

    useEffect(() => {
        if (!user?.id) return;
        doctorService.getByUserId(user.id).then(({ data }) => {
            if (data) {
                setDoctorRecord(data);
                setProfileForm({
                    firstName: data.users?.first_name || '',
                    lastName: data.users?.last_name || '',
                    phone: data.users?.phone || '',
                    specialization: data.specialization || '',
                    department: data.department || '',
                });
            }
        });
    }, [user?.id]);

    const handleProfileSave = async () => {
        setProfileSaving(true);
        const initials = ((profileForm.firstName?.[0] || '') + (profileForm.lastName?.[0] || '')).toUpperCase();
        const [{ error: uErr }, { error: dErr }] = await Promise.all([
            supabase.from('users').update({
                first_name: profileForm.firstName,
                last_name: profileForm.lastName,
                phone: profileForm.phone || null,
                initials,
            }).eq('id', user.id),
            doctorRecord ? doctorService.update(doctorRecord.id, {
                specialization: profileForm.specialization || null,
                department: profileForm.department || null,
            }) : Promise.resolve({ error: null }),
        ]);
        setProfileSaving(false);
        if (uErr || dErr) {
            showToast('Failed to save profile', 'error');
        } else {
            showToast('Profile updated successfully', 'success');
            setShowProfileModal(false);
        }
    };

    // Modals
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showThemeModal, setShowThemeModal] = useState(false);
    const [showSecurityModal, setShowSecurityModal] = useState(false);

    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const headerRef = useRef(null);
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (headerRef.current && !headerRef.current.contains(e.target)) {
                setShowSettings(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="flex h-screen w-full overflow-hidden font-display" style={{ backgroundColor: customBg || (isDarkMode ? '#0f172a' : '#f5f7f8') }}>
            <DoctorSidebar />

            <main className="flex-1 flex flex-col overflow-y-auto">
                <MobileTopBar title="Doctor Dashboard" />
                <header className="sticky top-0 z-20 h-20 hidden md:flex bg-white/80 backdrop-blur-md border-b border-slate-200 items-center justify-between px-8 shrink-0">
                    <div className="flex items-center gap-4 flex-1 max-w-xl">
                        <div className="relative w-full">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">search</span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search patients, records..."
                                className="w-full bg-slate-100 border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                    </div>
                    <div ref={headerRef} className="flex items-center gap-4 relative">
                        <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary transition-all">
                            <span className="material-symbols-outlined">notifications</span>
                        </button>
                        <button 
                            onClick={() => setShowSettings(!showSettings)}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary transition-all"
                        >
                            <span className="material-symbols-outlined">settings</span>
                        </button>

                        <AnimatePresence>
                            {showSettings && (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                    className="absolute top-[120%] right-0 w-56 bg-white shadow-2xl rounded-2xl border border-slate-100 z-50 overflow-hidden py-1.5"
                                >
                                    <button 
                                        onClick={() => { setShowProfileModal(true); setShowSettings(false); }}
                                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-3 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">manage_accounts</span> Profile Options
                                    </button>
                                    <button 
                                        onClick={() => { setShowThemeModal(true); setShowSettings(false); }}
                                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-3 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">display_settings</span> UI Preferences
                                    </button>
                                    <button 
                                        onClick={() => { setShowSecurityModal(true); setShowSettings(false); }}
                                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-3 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">security</span> Security Settings
                                    </button>
                                    <div className="border-t border-slate-100 my-1.5 mx-3"></div>
                                    <button onClick={async () => { await logout(); navigate('/login'); }} className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-xs font-medium text-critical flex items-center gap-3 transition-colors">
                                        <span className="material-symbols-outlined text-[18px]">logout</span> Secure Sign Out
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="h-8 w-px bg-slate-200 mx-2"></div>
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-xs font-bold text-slate-900">{doctorUser.name}</p>
                                <p className="text-[10px] text-slate-500">{doctorUser.role}</p>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">{doctorUser.initials}</div>
                        </div>
                    </div>
                </header>

                <div className="p-4 md:p-8 pb-12 max-w-7xl mx-auto w-full">
                    <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-10 flex flex-col md:flex-row md:items-end justify-between">
                        <div>
                            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Doctor Dashboard</h2>
                            <p className="text-slate-500 mt-2 text-base">Welcome back, {doctorUser.name}. Here's your clinic status for today.</p>
                        </div>
                        <div className="flex items-center gap-3 mt-4 md:mt-0">
                            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
                                <span className="material-symbols-outlined text-primary text-lg">calendar_today</span>
                                <span className="text-sm font-bold text-slate-900">{today}</span>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                        {doctorStats.map((stat, i) => (
                            <motion.div key={i} variants={fadeUp} className="h-full">
                                <BorderGlow
                                    backgroundColor="#ffffff"
                                    borderRadius={12}
                                    glowRadius={20}
                                    glowIntensity={0.6}
                                    className="h-full p-6 border border-slate-100 shadow-sm transition-all"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`p-2 rounded-lg ${stat.color}`}>
                                            <span className="material-symbols-outlined text-xl">{stat.icon}</span>
                                        </div>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${stat.changeColor} bg-white/50 border border-slate-100`}>{stat.change}</span>
                                    </div>
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">{stat.label}</p>
                                    <h3 className="text-2xl font-black mt-1 text-slate-900">{stat.value}</h3>
                                </BorderGlow>
                            </motion.div>
                        ))}
                    </motion.div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="space-y-6">
                            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <span className="material-symbols-outlined text-critical">error</span>
                                Active Alerts
                            </h3>
                            <div className="space-y-4">
                                {activeAlerts.length > 0 ? activeAlerts.map((alert, i) => (
                                    <motion.div 
                                        key={i} 
                                        initial={{ opacity: 0, x: -10 }} 
                                        animate={{ opacity: 1, x: 0 }} 
                                        transition={{ delay: 0.3 + i * 0.1 }}
                                        className={`p-4 ${alert.type === 'critical' || alert.type === 'appointment' ? 'bg-critical/5 border-l-4 border-critical' : 'bg-primary/5 border-l-4 border-primary'} rounded-r-xl flex items-start gap-4 transition-all hover:translate-x-1`}
                                    >
                                        <span className={`material-symbols-outlined mt-1 ${alert.type === 'critical' || alert.type === 'appointment' ? 'text-critical' : 'text-primary'}`} style={{ fontVariationSettings: alert.type === 'critical' || alert.type === 'appointment' ? "'FILL' 1" : "" }}>
                                            {alert.type === 'appointment' ? 'event' : 'notifications'}
                                        </span>
                                        <div>
                                            <p className={`text-sm font-bold ${alert.type === 'critical' || alert.type === 'appointment' ? 'text-critical' : 'text-slate-900'}`}>{alert.title}</p>
                                            <p className="text-xs text-slate-500 mt-1">{alert.message}</p>
                                            <button className={`mt-2 text-[10px] font-bold uppercase tracking-widest ${alert.type === 'critical' || alert.type === 'appointment' ? 'text-critical' : 'text-primary'} hover:underline`}>View Details</button>
                                        </div>
                                    </motion.div>
                                )) : (
                                    <p className="text-sm text-slate-500 italic">No active alerts</p>
                                )}
                            </div>
                        </div>

                        <div className="lg:col-span-2">
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                                    <h3 className="text-xl font-bold text-slate-900">Today's Appointment List</h3>
                                    <button onClick={() => navigate('/doctor-appointments')} className="text-primary text-sm font-bold flex items-center gap-1 hover:underline">
                                        View Calendar <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Patient Name</th>
                                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Time</th>
                                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {loading ? (
                                                Array.from({ length: 4 }).map((_, i) => (
                                                    <tr key={`skel-${i}`} className="animate-pulse">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-slate-200"></div>
                                                                <div className="h-4 bg-slate-200 rounded w-28"></div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                                                        <td className="px-6 py-4"><div className="h-5 bg-slate-200 rounded-full w-20"></div></td>
                                                        <td className="px-6 py-4 text-right"><div className="h-7 bg-slate-200 rounded-lg w-24 ml-auto"></div></td>
                                                    </tr>
                                                ))
                                            ) : doctorAppointments.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-16 text-center">
                                                        <span className="material-symbols-outlined text-4xl text-slate-300 block mb-3">event_busy</span>
                                                        <p className="text-sm font-medium text-slate-400">No appointments scheduled for today</p>
                                                    </td>
                                                </tr>
                                            ) : doctorAppointments.map((appt, i) => (
                                                <motion.tr key={i} variants={fadeUp} whileHover={{ backgroundColor: 'rgba(var(--primary-rgb), 0.05)' }} className="group cursor-pointer">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3" onClick={() => navigate(`/doctor-patient/${appt.patientId}`)}>
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${appt.statusColor}`}>
                                                                {appt.initials}
                                                            </div>
                                                            <span className="font-bold text-sm text-slate-900">{appt.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm font-medium text-slate-600 tabular-nums">{appt.time}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${appt.statusColor}`}>
                                                            {appt.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button onClick={() => navigate(`/doctor-consultation/${appt.id}`)} className="px-3 py-1.5 text-xs font-bold text-primary border border-primary/20 rounded-lg hover:bg-primary hover:text-white transition-all">Start Consult</button>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* ── Profile Modals ── */}
            <AnimatePresence>
                {showProfileModal && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
                        onClick={() => setShowProfileModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-8"
                            onClick={e => e.stopPropagation()}
                        >
                            <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">manage_accounts</span> Doctor Profile
                            </h2>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-semibold uppercase text-slate-400">First Name</label>
                                        <input type="text" value={profileForm.firstName} onChange={e => setProfileForm(f => ({...f, firstName: e.target.value}))} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/30 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-semibold uppercase text-slate-400">Last Name</label>
                                        <input type="text" value={profileForm.lastName} onChange={e => setProfileForm(f => ({...f, lastName: e.target.value}))} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/30 outline-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-semibold uppercase text-slate-400">Phone</label>
                                    <input type="tel" value={profileForm.phone} onChange={e => setProfileForm(f => ({...f, phone: e.target.value}))} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/30 outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-semibold uppercase text-slate-400">Specialization</label>
                                    <input type="text" value={profileForm.specialization} onChange={e => setProfileForm(f => ({...f, specialization: e.target.value}))} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/30 outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-semibold uppercase text-slate-400">Department</label>
                                    <input type="text" value={profileForm.department} onChange={e => setProfileForm(f => ({...f, department: e.target.value}))} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/30 outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-semibold uppercase text-slate-400">Email</label>
                                    <input type="email" value={user?.email || ''} disabled className="w-full px-4 py-2 border border-slate-100 rounded-xl bg-slate-50 text-slate-400 cursor-not-allowed" />
                                </div>
                            </div>
                            <div className="mt-8 flex gap-3">
                                <button onClick={() => setShowProfileModal(false)} className="flex-1 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50 rounded-xl transition-colors">Cancel</button>
                                <button onClick={handleProfileSave} disabled={profileSaving} className="flex-1 py-3 bg-primary text-white text-sm font-semibold rounded-xl shadow-lg shadow-primary/20 disabled:opacity-60">{profileSaving ? 'Saving…' : 'Save'}</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {showThemeModal && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
                        onClick={() => setShowThemeModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-8"
                            onClick={e => e.stopPropagation()}
                        >
                            <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">display_settings</span> UI Preferences
                            </h2>
                            <div className="space-y-6">
                                <div>
                                    <label className="text-xs font-semibold uppercase text-slate-400 mb-3 block">Theme Mode</label>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setIsDarkMode(false)} 
                                            className={`flex-1 py-3 text-sm font-semibold rounded-xl border flex items-center justify-center gap-2 transition-all ${!isDarkMode ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            <span className="material-symbols-outlined text-[18px]">light_mode</span> Light
                                        </button>
                                        <button 
                                            onClick={() => setIsDarkMode(true)} 
                                            className={`flex-1 py-3 text-sm font-semibold rounded-xl border flex items-center justify-center gap-2 transition-all ${isDarkMode ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            <span className="material-symbols-outlined text-[18px]">dark_mode</span> Dark
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase text-slate-400 mb-3 block">Custom Background Color</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['', '#f5f7f8', '#eef2ff', '#f0fdf4', '#fffbeb', '#fef2f2'].map(c => (
                                            <button 
                                                key={c}
                                                onClick={() => setCustomBg(c)}
                                                className={`w-10 h-10 rounded-full border-2 shadow-sm transition-all ${customBg === c ? 'border-primary scale-110' : 'border-slate-200 hover:scale-105'}`}
                                                style={{ backgroundColor: c || '#ffffff' }}
                                            >
                                                {c === '' && <span className="material-symbols-outlined text-slate-300 text-sm">block</span>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-8 flex justify-end">
                                <button onClick={() => setShowThemeModal(false)} className="px-8 py-3 bg-slate-900 text-white text-sm font-semibold rounded-xl shadow-lg">Done</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {showSecurityModal && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
                        onClick={() => setShowSecurityModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-8"
                            onClick={e => e.stopPropagation()}
                        >
                            <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">security</span> Security Settings
                            </h2>
                            <div className="space-y-4">
                                <button onClick={() => showToast('Reset link sent', 'success')} className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl text-sm font-medium text-slate-700 flex items-center justify-between transition-colors">
                                    Change Password
                                    <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                                </button>
                                <button onClick={() => showToast('Active sessions view opened', 'info')} className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl text-sm font-medium text-slate-700 flex items-center justify-between transition-colors">
                                    Manage Sessions
                                    <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                                </button>
                            </div>
                            <div className="mt-8 flex justify-end">
                                <button onClick={() => setShowSecurityModal(false)} className="px-8 py-3 bg-slate-900 text-white text-sm font-semibold rounded-xl">Close</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}