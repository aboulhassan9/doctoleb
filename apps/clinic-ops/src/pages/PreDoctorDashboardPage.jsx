import React, { useState, useEffect, useRef } from 'react';
import { logError } from '@/lib/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import CountUp from '@/components/CountUp';
import BorderGlow from '@/components/BorderGlow';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import MobileTopBar from '@/components/MobileTopBar';
import DashboardSettingsModals from '@clinic-ops/components/dashboard/DashboardSettingsModals';
import PreDoctorQueueList from '@clinic-ops/components/dashboard/PreDoctorQueueList';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { notificationCoreService } from '@/services/notificationCore';
import { appointmentService } from '@/services/appointments';
import { precheckService } from '@/services/prechecks';
import { normalizeAppointments } from '@/lib/appointments';
import { getClinicOpsNotificationTarget, getClinicOpsSearchTarget } from '@/lib/clinicOpsNavigation';
import { stagger, fadeUp } from '@/lib/animations';
import { timeAgo } from '@/lib/dateUtils';

export default function PreDoctorDashboardPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const { showToast } = useToast();

    // Modal state
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showThemeModal, setShowThemeModal] = useState(false);
    const [showSecurityModal, setShowSecurityModal] = useState(false);

    const headerRef = useRef(null);
    const [appointments, setAppointments] = useState([]);
    const [apptLoading, setApptLoading] = useState(true);
    const [stats, setStats] = useState([
        { label: 'Today\'s Queue', value: 0, icon: 'group', color: 'bg-primary/10 text-primary', trend: '+2 today', trendUp: true },
        { label: 'Pending Check', value: 0, icon: 'fact_check', color: 'bg-warning/10 text-warning', attention: true },
        { label: 'Alerts', value: 0, icon: 'notification_important', color: 'bg-critical/10 text-critical' }
    ]);

    // Notifications subscription
    useEffect(() => {
        if (!user?.id) return;
        notificationCoreService.getUnread(user.id).then(({ data }) => {
            if (data) setNotifications(data);
        });
        const sub = notificationCoreService.subscribeToUserNotifications(user.id, () => {
            notificationCoreService.getUnread(user.id).then(({ data }) => {
                if (data) setNotifications(data);
            });
        });
        return () => sub?.unsubscribe();
    }, [user?.id]);

    const handleMarkAllRead = async () => {
        if (user?.id) await notificationCoreService.markAllAsRead(user.id);
        setNotifications([]);
        setShowNotifications(false);
        showToast('All notifications marked as read', 'success');
    };

    const handleNotificationClick = async (notification) => {
        await notificationCoreService.markAsRead(notification.id);
        setNotifications(prev => prev.filter(x => x.id !== notification.id));
        setShowNotifications(false);
        navigate(getClinicOpsNotificationTarget(notification, 'predoctor'));
    };

    const handleSearchSubmit = (event) => {
        event.preventDefault();
        const q = searchQuery.trim();
        if (!q) return;
        setSearchQuery('');
        navigate(getClinicOpsSearchTarget(q, 'predoctor'));
    };

    const handlePatientReady = async (appt) => {
        const pt = appt.patients?.users;
        const name = pt ? `${pt.first_name} ${pt.last_name}` : 'Patient';
        const { data: prechecks, error: precheckError } = await precheckService.getByPatientId(appt.patient_id || appt.patients?.id, { limit: 1 });
        const submittedPrecheck = Array.isArray(prechecks) ? prechecks.find((item) => item.status === 'submitted') : null;
        if (precheckError || !submittedPrecheck) {
            showToast('Submit a valid pre-check before marking the patient ready.', 'error');
            return;
        }
        const { error } = await appointmentService.markPreChecked(appt.id);
        if (error) {
            showToast(error, 'error');
            return;
        }
        await notificationCoreService.notifyRole('doctor', {
            title: 'Patient Ready for Encounter',
            message: `${name} has completed pre-check and is ready for the doctor.`,
            type: 'precheck',
            related_type: 'appointment',
            related_id: appt.id,
        });
        showToast(`${name} marked as ready — doctor notified`, 'success');
        setAppointments(prev => prev.filter(a => a.id !== appt.id));
    };

    // Click-outside for settings/notifications dropdown
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (headerRef.current && !headerRef.current.contains(e.target)) setShowSettings(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch dashboard data
    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                setApptLoading(true);
                const { data: appts } = await appointmentService.getUpcoming();
                if (appts) {
                    const normalizedAppts = normalizeAppointments(appts);
                    setAppointments(normalizedAppts.slice(0, 5));
                    const queueCount = normalizedAppts.length;
                    const pendingCount = normalizedAppts.filter(a => a.status === 'scheduled').length;
                    const unreadCount = notifications.length;
                    setStats([
                        { label: 'Today\'s Queue', value: queueCount, icon: 'group', color: 'bg-primary/10 text-primary', trend: `+${queueCount} total`, trendUp: true },
                        { label: 'Pending Check', value: pendingCount, icon: 'fact_check', color: 'bg-warning/10 text-warning', attention: pendingCount > 0 },
                        { label: 'Alerts', value: unreadCount, icon: 'notification_important', color: 'bg-critical/10 text-critical' }
                    ]);
                }
            } catch (err) {
                logError('error', err);
            } finally {
                setApptLoading(false);
            }
        };
        fetchDashboardData();

        const sub = appointmentService.subscribeToAppointments(null, () => {
            fetchDashboardData();
            showToast('Appointments list updated', 'info');
        });

        return () => { if (sub) sub.unsubscribe(); };
    }, [showToast, notifications.length]);

    return (
        <DashboardLayout role="pre_doctor">
            <div className="flex-1 flex flex-col overflow-y-auto">
                <MobileTopBar title="Pre-Doctor Dashboard" />

                {/* Header */}
                <header className="sticky top-0 z-20 h-20 hidden md:flex bg-white/80 backdrop-blur-md border-b border-slate-200 items-center justify-between px-8 shrink-0">
                    <div className="flex items-center gap-4 flex-1 max-w-xl">
                        <form className="relative w-full" onSubmit={handleSearchSubmit}>
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">search</span>
                            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search patients, records, or files..." className="w-full bg-slate-100 border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 transition-all relative z-10" />
                            <AnimatePresence>
                                {searchQuery && (
                                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2">
                                        <div className="p-3 text-sm text-slate-500 font-medium">
                                            Searching for <span className="font-semibold text-slate-900">"{searchQuery}"</span>...
                                        </div>
                                        <button type="button" onClick={() => navigate(getClinicOpsSearchTarget(searchQuery, 'predoctor'))} className="w-full text-left px-3 py-2 text-xs font-bold text-primary hover:bg-primary/5 rounded-lg">
                                            View all results
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </form>
                    </div>
                    <div ref={headerRef} className="flex items-center gap-4 relative">
                        {/* Notification bell */}
                        <button onClick={() => { setShowNotifications(!showNotifications); setShowSettings(false); }} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary transition-all relative">
                            <span className="material-symbols-outlined">notifications</span>
                            {notifications.length > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-critical text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                                    {notifications.length > 9 ? '9+' : notifications.length}
                                </span>
                            )}
                        </button>
                        {/* Notification dropdown */}
                        <AnimatePresence>
                            {showNotifications && (
                                <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="absolute top-[120%] right-12 w-80 bg-white shadow-2xl rounded-2xl border border-slate-100 z-50 overflow-hidden">
                                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                        <span className="font-semibold text-slate-900 text-sm">Notifications</span>
                                        <button onClick={handleMarkAllRead} className="text-[11px] text-primary font-semibold uppercase tracking-wider hover:underline">Mark All Read</button>
                                    </div>
                                    <div className="max-h-72 overflow-y-auto p-2 space-y-1">
                                        {notifications.length === 0 ? (
                                            <div className="p-6 text-center">
                                                <span className="material-symbols-outlined text-slate-300 text-3xl block mb-2">notifications_off</span>
                                                <p className="text-sm text-slate-400 font-medium">All caught up!</p>
                                            </div>
                                        ) : notifications.map(n => (
                                            <button key={n.id} type="button" onClick={() => handleNotificationClick(n)} className="flex w-full items-start gap-3 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors text-left">
                                                <div className="w-8 h-8 rounded-lg bg-warning/10 text-warning flex items-center justify-center shrink-0">
                                                    <span className="material-symbols-outlined text-[16px]">fact_check</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold text-slate-900 truncate">{n.title}</p>
                                                    {n.message && <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>}
                                                    <p className="text-[10px] font-bold text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        {/* Settings button + dropdown */}
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
                                    <button onClick={() => navigate('/login')} className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-xs font-medium text-critical flex items-center gap-3 transition-colors">
                                        <span className="material-symbols-outlined text-[18px]">logout</span> Secure Sign Out
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </header>

                <div className="p-4 md:p-8 pb-12">
                    {/* Welcome */}
                    <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-10 flex items-end justify-between">
                        <div>
                            <p className="text-slate-500 font-medium mb-1 flex items-center gap-2">
                                <span>👋</span> Good morning, {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Pre-Doctor'}
                            </p>
                            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Pre-Doctor Dashboard</h2>
                            <p className="text-slate-500 mt-2 text-base">Manage your clinical queue and patient pre-checks.</p>
                        </div>
                        <div className="hidden xl:flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-500 shadow-sm font-medium">
                            <span className="material-symbols-outlined text-primary text-base">today</span>
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </div>
                    </motion.div>

                    {/* Stats */}
                    <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
                        {stats.map((stat, i) => (
                            <motion.div key={i} variants={fadeUp} className="h-full">
                                <BorderGlow backgroundColor="#ffffff" borderRadius={20} glowRadius={32} glowIntensity={0.8} className="bg-white p-6 h-full border border-slate-200 shadow-sm">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.color}`}>
                                            <span className="material-symbols-outlined text-2xl">{stat.icon}</span>
                                        </div>
                                        {stat.attention && (
                                            <span className="px-2 py-1 bg-warning/10 text-warning text-[10px] font-semibold uppercase rounded-full">Attention</span>
                                        )}
                                    </div>
                                    <h3 className="text-3xl font-black text-slate-900">
                                        <CountUp from={0} to={stat.value} duration={2} separator="," />
                                    </h3>
                                    <p className="text-slate-500 text-sm font-medium mt-1">{stat.label}</p>
                                    {stat.trend && (
                                        <div className={`mt-2 text-xs flex items-center gap-1 font-bold ${stat.trendUp ? 'text-success' : ''}`}>
                                            <span className="material-symbols-outlined text-sm">trending_up</span>
                                            {stat.trend}
                                        </div>
                                    )}
                                </BorderGlow>
                            </motion.div>
                        ))}
                    </motion.div>

                    {/* Appointment Queue */}
                    <div>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-xl font-black text-slate-900">Today's Appointments</h3>
                            <motion.button whileHover={{ x: 3 }} onClick={() => navigate('/predoctor-appointments')} className="text-primary text-sm font-bold flex items-center gap-1 hover:underline">
                                View All <span className="material-symbols-outlined text-sm">chevron_right</span>
                            </motion.button>
                        </div>
                        <PreDoctorQueueList appointments={appointments} loading={apptLoading} onPatientReady={handlePatientReady} />
                    </div>
                </div>
            </div>

            {/* Modals — reuse shared components */}
            <DashboardSettingsModals
                showProfile={showProfileModal} onCloseProfile={() => setShowProfileModal(false)}
                showTheme={showThemeModal} onCloseTheme={() => setShowThemeModal(false)}
                showSecurity={showSecurityModal} onCloseSecurity={() => setShowSecurityModal(false)}
            />
        </DashboardLayout>
    );
}
