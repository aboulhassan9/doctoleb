import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import BorderGlow from '@/components/BorderGlow';
import DashboardSettingsModals from '@clinic-ops/components/dashboard/DashboardSettingsModals';
import DoctorProfileModal from '@clinic-ops/components/dashboard/DoctorProfileModal';
import DoctorTodayAppointments from '@clinic-ops/components/dashboard/DoctorTodayAppointments';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { notificationCoreService } from '@/services/notificationCore';
import { stagger, fadeUp } from '@/lib/animations';
import { formatClinicTime, isSameClinicDay } from '@/lib/time';
import { useAppointments } from '@/hooks/features/useAppointments';
import { useNotifications } from '@/hooks/features/useNotifications';
import { useDoctorProfile } from '@/hooks/features/useDoctorProfile';

export default function DoctorDashboardPage() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const { showToast } = useToast();
    const { user, logout } = useAuth();

    const doctorUser = user ? {
        name: `${user.first_name || ''} ${user.last_name || ''}`,
        role: user.role === 'doctor' ? 'Chief Resident' : 'Doctor',
        initials: `${user.first_name?.[0]||''}${user.last_name?.[0]||''}`.toUpperCase(),
    } : { name: 'Doctor', role: 'Doctor', initials: '??' };

    const { appointments, loading: loadingAppointments, refresh: refreshAppointments } = useAppointments({ mode: 'doctor' });
    const { notifications, unreadCount, loading: loadingNotifs, refresh: refreshNotifs } = useNotifications({ userId: user?.id });
    const { doctor: doctorRecord, loading: loadingProfile } = useDoctorProfile();

    const loading = loadingAppointments || loadingNotifs || loadingProfile;

    const todaysAppointments = React.useMemo(() => {
        return appointments.filter(a => a.scheduled_at && isSameClinicDay(a.scheduled_at, new Date()));
    }, [appointments]);

    const formattedAppts = React.useMemo(() => {
        return todaysAppointments.map(appt => {
            const s = appt.status || 'scheduled';
            const statusColor = s === 'confirmed' ? 'bg-success/10 text-success' : s === 'completed' ? 'bg-slate-100 text-slate-500' : 'bg-warning/10 text-warning';
            return {
                id: appt.id, patientId: appt.patient_id,
                name: appt.patientName || 'Unknown Patient',
                initials: appt.patientInitials || '??',
                time: formatClinicTime(appt.scheduled_at, { hour: '2-digit', minute: '2-digit' }),
                status: appt.statusLabel, statusColor
            };
        });
    }, [todaysAppointments]);

    const doctorStats = React.useMemo(() => {
        if (!doctorRecord?.id && !loadingProfile) {
            return [
                { label: 'Total Patients', value: '0', icon: 'groups', color: 'bg-primary/10 text-primary', change: 'Profile missing', changeColor: 'text-critical' },
                { label: "Today's Appointments", value: '0', icon: 'event_note', color: 'bg-primary/10 text-primary', change: 'Today', changeColor: 'text-primary' },
                { label: 'Pending Pre-Checks', value: '0', icon: 'pending_actions', color: 'bg-warning/10 text-warning', change: 'Action Needed', changeColor: 'text-warning' },
                { label: 'Unread Notifications', value: '0', icon: 'mail', color: 'bg-critical/10 text-critical', change: '', changeColor: 'text-critical' }
            ];
        }
        const totalPatients = new Set(appointments.map(a => a.patient_id).filter(Boolean)).size;
        return [
            { label: 'Total Patients', value: totalPatients.toString(), icon: 'groups', color: 'bg-primary/10 text-primary', change: 'Your panel', changeColor: 'text-success' },
            { label: "Today's Appointments", value: todaysAppointments.length.toString(), icon: 'event_note', color: 'bg-primary/10 text-primary', change: 'Today', changeColor: 'text-primary' },
            { label: 'Pending Pre-Checks', value: todaysAppointments.filter(a => a.status === 'pre_check').length.toString(), icon: 'pending_actions', color: 'bg-warning/10 text-warning', change: 'Action Needed', changeColor: 'text-warning' },
            { label: 'Unread Notifications', value: unreadCount.toString(), icon: 'mail', color: 'bg-critical/10 text-critical', change: unreadCount > 0 ? 'New' : '', changeColor: 'text-critical' }
        ];
    }, [doctorRecord, loadingProfile, appointments, todaysAppointments, unreadCount]);

    const activeAlerts = React.useMemo(() => {
        return notifications.filter(n => !n.is_read).slice(0, 5);
    }, [notifications]);

    // Real-time notification subscription
    useEffect(() => {
        let notifSub = null;
        if (user) {
            notifSub = notificationCoreService.subscribeToUserNotifications(user.id, () => {
                refreshNotifs();
                refreshAppointments();
                showToast('New notification received', 'info');
            });
        }
        return () => { if (notifSub) notifSub.unsubscribe(); };
    }, [user, refreshNotifs, refreshAppointments, showToast]);

    // Modal state
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showThemeModal, setShowThemeModal] = useState(false);
    const [showSecurityModal, setShowSecurityModal] = useState(false);

    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // Click-outside for settings dropdown
    const headerRef = useRef(null);
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (headerRef.current && !headerRef.current.contains(e.target)) setShowSettings(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <DashboardLayout role="doctor" title="Doctor Dashboard">
            <div className="flex-1 flex flex-col overflow-y-auto">
                {/* Header */}
                <header className="sticky top-0 z-20 h-20 hidden md:flex bg-white/80 backdrop-blur-md border-b border-slate-200 items-center justify-between px-8 shrink-0">
                    <div className="flex items-center gap-4 flex-1 max-w-xl">
                        <div className="relative w-full">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">search</span>
                            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search patients, records..." className="w-full bg-slate-100 border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/50" />
                        </div>
                    </div>
                    <div ref={headerRef} className="flex items-center gap-4 relative">
                        <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary transition-all">
                            <span className="material-symbols-outlined">notifications</span>
                        </button>
                        <button onClick={() => setShowSettings(!showSettings)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary transition-all">
                            <span className="material-symbols-outlined">settings</span>
                        </button>
                        <AnimatePresence>
                            {showSettings && (
                                <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="absolute top-[120%] right-0 w-56 bg-white shadow-2xl rounded-2xl border border-slate-100 z-50 overflow-hidden py-1.5">
                                    <button onClick={() => { setShowProfileModal(true); setShowSettings(false); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-3 transition-colors">
                                        <span className="material-symbols-outlined text-[18px]">manage_accounts</span> Profile Options
                                    </button>
                                    <button onClick={() => { setShowThemeModal(true); setShowSettings(false); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-3 transition-colors">
                                        <span className="material-symbols-outlined text-[18px]">display_settings</span> UI Preferences
                                    </button>
                                    <button onClick={() => { setShowSecurityModal(true); setShowSettings(false); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-3 transition-colors">
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
                    {/* Welcome */}
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

                    {/* Stats */}
                    <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                        {doctorStats.map((stat, i) => (
                            <motion.div key={i} variants={fadeUp} className="h-full">
                                <BorderGlow backgroundColor="#ffffff" borderRadius={12} glowRadius={20} glowIntensity={0.6} className="h-full p-6 border border-slate-100 shadow-sm transition-all">
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

                    {/* Alerts + Appointments grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Active Alerts */}
                        <div className="space-y-6">
                            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <span className="material-symbols-outlined text-critical">error</span> Active Alerts
                            </h3>
                            <div className="space-y-4">
                                {activeAlerts.length > 0 ? activeAlerts.map((alert, i) => (
                                    <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.1 }} className={`p-4 ${alert.type === 'critical' || alert.type === 'appointment' ? 'bg-critical/5 border-l-4 border-critical' : 'bg-primary/5 border-l-4 border-primary'} rounded-r-xl flex items-start gap-4 transition-all hover:translate-x-1`}>
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

                        {/* Today's Appointments */}
                        <div className="lg:col-span-2">
                            <DoctorTodayAppointments appointments={formattedAppts} loading={loading} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <DoctorProfileModal open={showProfileModal} onClose={() => setShowProfileModal(false)} doctorRecord={doctorRecord} />
            <DashboardSettingsModals
                showProfile={false} onCloseProfile={() => {}}
                showTheme={showThemeModal} onCloseTheme={() => setShowThemeModal(false)}
                showSecurity={showSecurityModal} onCloseSecurity={() => setShowSecurityModal(false)}
            />
        </DashboardLayout>
    );
}
