import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import CountUp from '../components/CountUp';
import BorderGlow from '../components/BorderGlow';
import PreDoctorSidebar from '../components/PreDoctorSidebar';
import MobileTopBar from '../components/MobileTopBar';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { notificationService } from '../services/notifications';
import { appointmentService } from '../services/appointments';

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export default function PreDoctorDashboardPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const { showToast } = useToast();
    const { isDarkMode, setIsDarkMode, customBg, setCustomBg } = useTheme();

    // Modals
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

    useEffect(() => {
        if (!user?.id) return;
        notificationService.getUnread(user.id).then(({ data }) => {
            if (data) setNotifications(data);
        });
        const sub = notificationService.subscribeToUserNotifications(user.id, () => {
            notificationService.getUnread(user.id).then(({ data }) => {
                if (data) setNotifications(data);
            });
        });
        return () => sub?.unsubscribe();
    }, [user?.id]);

    const handleMarkAllRead = async () => {
        if (user?.id) await notificationService.markAllAsRead(user.id);
        setNotifications([]);
        setShowNotifications(false);
        showToast('All notifications marked as read', 'success');
    };

    const handlePatientReady = async (appt) => {
        const pt = appt.patients?.users;
        const name = pt ? `${pt.first_name} ${pt.last_name}` : 'Patient';
        await appointmentService.update(appt.id, { status: 'pre_check' });
        await notificationService.notifyRole('doctor', {
            title: 'Patient Ready for Consultation',
            message: `${name} has completed pre-check and is ready for the doctor.`,
            type: 'precheck',
            related_id: appt.id,
            related_type: 'appointment',
        });
        showToast(`${name} marked as ready — doctor notified`, 'success');
        setAppointments(prev => prev.filter(a => a.id !== appt.id));
    };

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (headerRef.current && !headerRef.current.contains(e.target)) {
                setShowSettings(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                setApptLoading(true);
                const { data: appts } = await appointmentService.getUpcoming();
                if (appts) {
                    setAppointments(appts.slice(0, 5));
                    
                    const queueCount = appts.length;
                    const pendingCount = appts.filter(a => a.status === 'scheduled').length;
                    const unreadCount = notifications.length;

                    setStats([
                        { label: 'Today\'s Queue', value: queueCount, icon: 'group', color: 'bg-primary/10 text-primary', trend: `+${queueCount} total`, trendUp: true },
                        { label: 'Pending Check', value: pendingCount, icon: 'fact_check', color: 'bg-warning/10 text-warning', attention: pendingCount > 0 },
                        { label: 'Alerts', value: unreadCount, icon: 'notification_important', color: 'bg-critical/10 text-critical' }
                    ]);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setApptLoading(false);
            }
        };
        fetchDashboardData();

        const sub = appointmentService.subscribeToAppointments(null, () => {
            fetchDashboardData();
            showToast('Appointments list updated', 'info');
        });

        return () => {
            if (sub) sub.unsubscribe();
        };
    }, [showToast, notifications.length]);

    return (
        <div className="flex h-screen overflow-hidden font-display" style={{ backgroundColor: customBg || (isDarkMode ? '#0f172a' : '#f5f7f8') }}>
            <PreDoctorSidebar />

            <main className="flex-1 flex flex-col overflow-y-auto">
                <MobileTopBar title="Pre-Doctor Dashboard" />
                <header className="sticky top-0 z-20 h-20 hidden md:flex bg-white/80 backdrop-blur-md border-b border-slate-200 items-center justify-between px-8 shrink-0">
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
                            <AnimatePresence>
                                {searchQuery && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                                        className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2"
                                    >
                                        <div className="p-3 text-sm text-slate-500 font-medium">
                                            Searching for <span className="font-semibold text-slate-900">"{searchQuery}"</span>...
                                        </div>
                                        <button 
                                            onClick={() => navigate('/predoctor-patients')}
                                            className="w-full text-left px-3 py-2 text-xs font-bold text-primary hover:bg-primary/5 rounded-lg"
                                        >
                                            View all results
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                    <div ref={headerRef} className="flex items-center gap-4 relative">
                        <button
                            onClick={() => { setShowNotifications(!showNotifications); setShowSettings(false); }}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary transition-all relative"
                        >
                            <span className="material-symbols-outlined">notifications</span>
                            {notifications.length > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-critical text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                                    {notifications.length > 9 ? '9+' : notifications.length}
                                </span>
                            )}
                        </button>
                        <AnimatePresence>
                            {showNotifications && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                    className="absolute top-[120%] right-12 w-80 bg-white shadow-2xl rounded-2xl border border-slate-100 z-50 overflow-hidden"
                                >
                                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                        <span className="font-semibold text-slate-900 text-sm">Notifications</span>
                                        <button onClick={handleMarkAllRead} className="text-[11px] text-primary font-semibold uppercase tracking-wider hover:underline">
                                            Mark All Read
                                        </button>
                                    </div>
                                    <div className="max-h-72 overflow-y-auto p-2 space-y-1">
                                        {notifications.length === 0 ? (
                                            <div className="p-6 text-center">
                                                <span className="material-symbols-outlined text-slate-300 text-3xl block mb-2">notifications_off</span>
                                                <p className="text-sm text-slate-400 font-medium">All caught up!</p>
                                            </div>
                                        ) : notifications.map(n => (
                                            <div key={n.id} onClick={async () => { await notificationService.markAsRead(n.id); setNotifications(prev => prev.filter(x => x.id !== n.id)); setShowNotifications(false); }}
                                                className="flex items-start gap-3 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors">
                                                <div className="w-8 h-8 rounded-lg bg-warning/10 text-warning flex items-center justify-center shrink-0">
                                                    <span className="material-symbols-outlined text-[16px]">fact_check</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold text-slate-900 truncate">{n.title}</p>
                                                    {n.message && <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>}
                                                    <p className="text-[10px] font-bold text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
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
                                    <button onClick={() => navigate('/login')} className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-xs font-medium text-critical flex items-center gap-3 transition-colors">
                                        <span className="material-symbols-outlined text-[18px]">logout</span> Secure Sign Out
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </header>

                <div className="p-4 md:p-8 pb-12">
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

                    <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
                        {PREDOCTOR_STATS.map((stat, i) => (
                            <motion.div key={i} variants={fadeUp} className="h-full">
                                <BorderGlow
                                    backgroundColor="#ffffff"
                                    borderRadius={20}
                                    glowRadius={32}
                                    glowIntensity={0.8}
                                    className="bg-white p-6 h-full border border-slate-200 shadow-sm"
                                >
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

                    <div>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-xl font-black text-slate-900">Today's Appointments</h3>
                            <motion.button whileHover={{ x: 3 }} onClick={() => navigate('/predoctor-appointments')} className="text-primary text-sm font-bold flex items-center gap-1 hover:underline">
                                View All <span className="material-symbols-outlined text-sm">chevron_right</span>
                            </motion.button>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                            {apptLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-slate-100 last:border-0 animate-pulse">
                                        <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0"></div>
                                        <div className="flex-1 space-y-2">
                                            <div className="h-4 bg-slate-200 rounded w-36"></div>
                                            <div className="h-3 bg-slate-200 rounded w-24"></div>
                                        </div>
                                        <div className="space-y-2 text-right">
                                            <div className="h-4 bg-slate-200 rounded w-14 ml-auto"></div>
                                            <div className="h-3 bg-slate-200 rounded w-20 ml-auto"></div>
                                        </div>
                                    </div>
                                ))
                            ) : appointments.length > 0 ? appointments.map((appt, i) => {
                                const pt = appt.patients?.users;
                                const name = pt ? `${pt.first_name} ${pt.last_name}` : 'Unknown Patient';
                                const initials = pt ? `${(pt.first_name?.[0]||'').toUpperCase()}${(pt.last_name?.[0]||'').toUpperCase()}` : '?';
                                const time = new Date(appt.scheduled_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                                return (
                                    <motion.div
                                        key={appt.id || i}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.35 + i * 0.08 }}
                                        whileHover={{ backgroundColor: 'rgba(var(--primary-rgb), 0.03)' }}
                                        onClick={() => navigate('/predoctor-new-check', { state: { patient: appt.patients, appointmentId: appt.id } })}
                                        className="flex items-center gap-4 px-5 py-4 border-b border-slate-100 last:border-0 cursor-pointer transition-colors"
                                    >
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold bg-primary/10 text-primary">
                                            {initials}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-slate-900">{name}</p>
                                            <p className="text-xs text-slate-400">{appt.reason_for_visit || 'General Assessment'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-slate-900">{time}</p>
                                            <p className="text-xs text-slate-400">ID: {appt.patients?.id?.split('-')[0]}</p>
                                        </div>
                                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={() => navigate('/predoctor-new-check', { state: { patient: appt.patients, appointmentId: appt.id } })}
                                                className="px-3 py-1.5 text-xs font-bold text-primary border border-primary/20 rounded-lg hover:bg-primary hover:text-white transition-all"
                                            >
                                                Pre-Check
                                            </button>
                                            <button
                                                onClick={() => handlePatientReady(appt)}
                                                className="px-3 py-1.5 text-xs font-bold text-success border border-success/20 rounded-lg hover:bg-success hover:text-white transition-all"
                                            >
                                                Ready ✓
                                            </button>
                                        </div>
                                    </motion.div>
                                );
                            }) : (
                                <div className="py-14 text-center">
                                    <span className="material-symbols-outlined text-4xl text-slate-300 block mb-3">event_available</span>
                                    <p className="text-sm font-medium text-slate-400">No appointments in queue right now</p>
                                </div>
                            )}
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
                                <span className="material-symbols-outlined text-primary">manage_accounts</span> User Profile
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-semibold uppercase text-slate-400">Name</label>
                                    <input type="text" defaultValue={user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : ''} className="w-full px-4 py-2 border border-slate-200 rounded-xl" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-semibold uppercase text-slate-400">Role</label>
                                    <input type="text" defaultValue={user?.role || ''} disabled className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-500" />
                                </div>
                            </div>
                            <div className="mt-8 flex gap-3">
                                <button onClick={() => setShowProfileModal(false)} className="flex-1 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50 rounded-xl transition-colors">Cancel</button>
                                <button onClick={() => { setShowProfileModal(false); showToast('Profile updated', 'success'); }} className="flex-1 py-3 bg-primary text-white text-sm font-semibold rounded-xl">Save</button>
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
                                            className={`flex-1 py-3 text-sm font-semibold rounded-xl border flex items-center justify-center gap-2 transition-all ${!isDarkMode ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-500'}`}
                                        >
                                            <span className="material-symbols-outlined text-[18px]">light_mode</span> Light
                                        </button>
                                        <button 
                                            onClick={() => setIsDarkMode(true)} 
                                            className={`flex-1 py-3 text-sm font-semibold rounded-xl border flex items-center justify-center gap-2 transition-all ${isDarkMode ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-500'}`}
                                        >
                                            <span className="material-symbols-outlined text-[18px]">dark_mode</span> Dark
                                        </button>
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
                                <button onClick={() => showToast('Password reset link sent', 'success')} className="w-full text-left px-4 py-3 bg-slate-50 rounded-xl text-sm font-medium text-slate-700 flex items-center justify-between transition-colors hover:bg-slate-100">
                                    Change Password
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