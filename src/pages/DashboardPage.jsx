import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import CountUp from '@/components/CountUp';
import BorderGlow from '@/components/BorderGlow';
import { useToast } from '@/contexts/ToastContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/auth';
import PatientDashboardPage from './PatientDashboardPage';

const ACTION_CARDS = [
    {
        title: 'Register Patient',
        desc: 'Add a new patient with insurance and contact details.',
        icon: 'person_add',
        action: 'New Registration',
        path: '/patients',
        accent: { bg: 'bg-primary/10', text: 'text-primary' },
        glowColor: '215 90 60',
        colors: ['#0d6cf2', '#38bdf8', '#60a5fa'],
    },
    {
        title: 'Manage Appointments',
        desc: 'Schedule, edit, or cancel appointments and check availability.',
        icon: 'calendar_today',
        action: 'Open Calendar',
        path: '/appointments',
        accent: { bg: 'bg-indigo-500/10', text: 'text-indigo-500' },
        glowColor: '239 84 65',
        colors: ['#6366f1', '#818cf8', '#a5b4fc'],
    },
    {
        title: 'Patient Records',
        desc: 'Search patient history, medical documents, and reports.',
        icon: 'description',
        action: 'Search Records',
        path: '/patients',
        accent: { bg: 'bg-success/10', text: 'text-success' },
        glowColor: '160 84 40',
        colors: ['#10b981', '#34d399', '#6ee7b7'],
    },
    {
        title: 'Billing & Payments',
        desc: 'Generate invoices, track balances, and process payments.',
        icon: 'payments',
        action: 'Manage Billing',
        path: '/billing',
        accent: { bg: 'bg-warning/10', text: 'text-warning' },
        glowColor: '38 92 50',
        colors: ['#f59e0b', '#fbbf24', '#fcd34d'],
    },
];

import { appointmentService } from '@/services/appointments';
import { patientService } from '@/services/patients';
import { useAppointments } from '@/hooks/features/useAppointments';
import { usePatients } from '@/hooks/features/usePatients';
import { useNotifications } from '@/hooks/features/useNotifications';
import { stagger, fadeUp } from '@/lib/animations';
import { getUserDisplayName } from '@/lib/userDisplay';
import { timeAgo } from '@/lib/dateUtils';


const NOTIF_ICONS = {
    appointment: { icon: 'calendar_month', cls: 'bg-primary/10 text-primary' },
    patient:     { icon: 'person_add',     cls: 'bg-success/10 text-success' },
    encounter:   { icon: 'stethoscope',    cls: 'bg-tertiary/10 text-tertiary' },
    precheck:    { icon: 'fact_check',     cls: 'bg-warning/10 text-warning' },
    document:    { icon: 'description',    cls: 'bg-secondary/10 text-secondary' },
    default:     { icon: 'notifications',  cls: 'bg-slate-100 text-slate-500' },
};

const staggerSec = stagger;
const fadeUpSec = fadeUp;

export default function DashboardPage() {
    const navigate = useNavigate();
    const { logout, user } = useAuth();
    const role = user?.role;

    const [searchQuery, setSearchQuery] = useState('');

    const { appointments, loading: loadingAppointments } = useAppointments({ mode: 'all' });
    const { patients, loading: loadingPatients } = usePatients();
    const { notifications, unreadCount, markRead, markAllRead, loading: loadingNotifs } = useNotifications({ userId: user?.id });

    const stats = React.useMemo(() => {
        const pendingAppts = appointments.filter(a => a.status === 'scheduled').length;
        const todayStr = new Date().toLocaleDateString('en-US');
        const newToday = patients.filter(p => new Date(p.created_at).toLocaleDateString('en-US') === todayStr).length;

        return [
            { label: 'Pending Appointments', value: pendingAppts, icon: 'calendar_month', trend: 'Scheduled', trendIcon: 'trending_up', trendCls: 'text-success' },
            { label: 'New Registrations', value: newToday, icon: 'person_add', trend: 'Registered today', trendIcon: 'group_add', trendCls: 'text-primary' },
            { label: 'Total Patients', value: patients.length, icon: 'groups', trend: 'All time', trendIcon: 'history', trendCls: 'text-warning' },
        ];
    }, [appointments, patients]);

    const statsLoading = loadingAppointments || loadingPatients;

    const [showNotifications, setShowNotifications] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const { showToast } = useToast();
    const { isDarkMode, setIsDarkMode, customBg, setCustomBg } = useTheme();

    // Modals
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showThemeModal, setShowThemeModal] = useState(false);
    const [showSecurityModal, setShowSecurityModal] = useState(false);

    const activities = React.useMemo(() => {
        return notifications.filter(n => !n.is_read).slice(0, 5).map(n => ({
            title: n.title,
            sub: n.message,
            time: new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            icon: n.type === 'appointment' ? 'calendar_month' : 'notifications',
            iconCls: 'bg-primary/10 text-primary'
        }));
    }, [notifications]);

    const handleMarkRead = async () => {
        await markAllRead();
        setShowNotifications(false);
    };

    const handleNotifClick = async (notif) => {
        await markRead(notif.id);
        setShowNotifications(false);
    };

    const headerRef = useRef(null);
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (headerRef.current && !headerRef.current.contains(e.target)) {
                setShowNotifications(false);
                setShowSettings(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (role === 'patient') {
        return <PatientDashboardPage />;
    }

    return (
        <DashboardLayout role="secretary" title="Secretary Dashboard">
            <div className="flex-1 flex flex-col overflow-y-auto">
                {/* Header */}
                <header className="sticky top-0 z-20 h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
                    <div className="flex items-center gap-4 flex-1 max-w-xl">
                        <div className="relative w-full">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">search</span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search patients, doctors or appointments..."
                                className="w-full bg-slate-100 border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 transition-all relative z-10"
                            />
                            {/* Search Dropdown Mock */}
                            <AnimatePresence>
                                {searchQuery && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 5 }}
                                        className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2"
                                    >
                                        <div className="p-3 text-sm text-slate-500 font-medium">
                                            Searching database for <span className="text-slate-900 font-bold">"{searchQuery}"</span>...
                                        </div>
                                        <button
                                            onClick={() => {
                                                const q = searchQuery;
                                                setSearchQuery('');
                                                navigate('/patients', { state: { searchQuery: q } });
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs font-bold text-primary hover:bg-primary/5 rounded-lg transition-colors"
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
                            {notifications.length > 0 && (
                                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
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
                                        <button
                                            onClick={handleMarkRead}
                                            className="text-[11px] text-primary font-semibold uppercase tracking-wider cursor-pointer hover:underline"
                                        >
                                            Mark Read
                                        </button>
                                    </div>
                                    <div className="max-h-72 overflow-y-auto p-2 space-y-1">
                                        {notifications.length === 0 ? (
                                            <div className="p-6 text-center">
                                                <span className="material-symbols-outlined text-slate-300 text-3xl block mb-2">notifications_off</span>
                                                <p className="text-sm text-slate-400 font-medium">All caught up!</p>
                                            </div>
                                        ) : (
                                            notifications.map((notif) => {
                                                const ni = NOTIF_ICONS[notif.type] || NOTIF_ICONS.default;
                                                return (
                                                    <div key={notif.id} onClick={() => handleNotifClick(notif)} className="flex items-start gap-3 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-slate-100">
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${ni.cls}`}>
                                                            <span className="material-symbols-outlined text-[16px]">{ni.icon}</span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-semibold text-slate-900 leading-tight truncate">{notif.title}</p>
                                                            {notif.message && <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-2">{notif.message}</p>}
                                                            <p className="text-[10px] font-bold text-slate-400 mt-1">{timeAgo(notif.created_at)}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <button
                            onClick={() => { setShowSettings(!showSettings); setShowNotifications(false); }}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary transition-all relative"
                        >
                            <span className="material-symbols-outlined">settings</span>
                        </button>

                        <AnimatePresence>
                            {showSettings && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
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
                                    <button
                                        onClick={async () => { await logout(); navigate('/login'); }}
                                        className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-xs font-medium text-critical flex items-center gap-3 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">logout</span> Secure Sign Out
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </header>

                {/* Page content */}
                <div className="p-4 md:p-8 pb-12">

                    {/* Welcome */}
                    <motion.div
                        initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
                        className="mb-10 flex items-end justify-between"
                    >
                        <div>
                            <p className="text-slate-500 font-medium mb-1 flex items-center gap-2">
                                <span>👋</span> Good morning, {getUserDisplayName(user, 'Secretary').split(' ')[0]}
                            </p>
                            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Secretary Dashboard</h2>
                            <p className="text-slate-500 mt-2 text-base">Manage patients, appointments, and billing from one place.</p>
                        </div>
                        <div className="hidden xl:flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-500 shadow-sm font-medium">
                            <span className="material-symbols-outlined text-primary text-base">today</span>
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </div>
                    </motion.div>

                    {/* Action Cards */}
                    <motion.div
                        variants={staggerSec} initial="hidden" animate="visible"
                        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-12"
                    >
                        {ACTION_CARDS.map((card, i) => (
                            <motion.div key={i} variants={fadeUpSec} className="h-full">
                                <BorderGlow
                                    glowColor={card.glowColor}
                                    backgroundColor="#ffffff"
                                    borderRadius={20}
                                    glowRadius={28}
                                    glowIntensity={0.85}
                                    colors={card.colors}
                                    className="group cursor-pointer h-full"
                                    onClick={() => {
                                        if (i === 0) navigate('/patients', { state: { openAddModal: true } });
                                        else if (i === 1) navigate('/appointments');
                                        else if (i === 2) navigate('/patients', { state: { focusSearch: true } });
                                        else navigate('/billing');
                                    }}
                                >
                                    <div className="p-6 flex flex-col h-full">
                                        <motion.div
                                            whileHover={{ scale: 1.12, rotate: 6 }}
                                            transition={{ type: 'spring', stiffness: 300 }}
                                            className={`w-14 h-14 rounded-2xl ${card.accent.bg} flex items-center justify-center ${card.accent.text} mb-5 shrink-0`}
                                        >
                                            <span className="material-symbols-outlined text-[32px]">{card.icon}</span>
                                        </motion.div>
                                        <h3 className="text-[17px] font-semibold text-slate-900 mb-2">{card.title}</h3>
                                        <p className="text-slate-500 text-sm leading-relaxed flex-1 mb-5">{card.desc}</p>
                                        <div className={`flex items-center gap-1 ${card.accent.text} font-bold text-sm`}>
                                            {card.action}
                                            <motion.span
                                                className="material-symbols-outlined text-sm"
                                                animate={{ x: [0, 2, 0] }}
                                                transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                                            >
                                                arrow_forward
                                            </motion.span>
                                        </div>
                                    </div>
                                </BorderGlow>
                            </motion.div>
                        ))}
                    </motion.div>

                    {/* Stats */}
                    <div className="mb-12">
                        <h3 className="text-xl font-black text-slate-900 mb-5">Today's Quick Statistics</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {statsLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="p-6 bg-white border border-slate-200 rounded-2xl animate-pulse">
                                    <div className="h-3 bg-slate-200 rounded w-32 mb-4"></div>
                                    <div className="h-9 bg-slate-200 rounded w-20 mb-3"></div>
                                    <div className="h-3 bg-slate-200 rounded w-24"></div>
                                </div>
                            ))
                        ) : (
                        <motion.div
                            variants={staggerSec} initial="hidden" animate="visible"
                            className="contents"
                        >
                            {stats.map((s, i) => (
                                <motion.div
                                    key={i} variants={fadeUpSec}
                                    whileHover={{ y: -4, boxShadow: '0 12px 40px rgba(0,0,0,0.08)' }}
                                    className="p-6 bg-white border border-slate-200 rounded-2xl relative overflow-hidden transition-all shadow-sm"
                                >
                                    <div className="relative z-10">
                                        <p className="text-slate-500 text-sm font-semibold mb-2">{s.label}</p>
                                        <div className="text-4xl font-black text-slate-900 flex items-baseline gap-0.5">
                                            {s.prefix && <span className="text-2xl font-black mr-0.5">{s.prefix}</span>}
                                            <CountUp from={0} to={s.value} duration={2.5} separator="," />
                                        </div>
                                        <div className={`mt-3 text-xs flex items-center gap-1 font-semibold ${s.trendCls}`}>
                                            <span className="material-symbols-outlined text-sm">{s.trendIcon}</span>
                                            <span>{s.trend}</span>
                                        </div>
                                    </div>
                                    <motion.span
                                        animate={{ rotate: [0, 6, 0] }}
                                        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                                        className="material-symbols-outlined text-[90px] absolute -right-4 -bottom-4 opacity-[0.04] select-none pointer-events-none text-slate-900"
                                    >
                                        {s.icon}
                                    </motion.span>
                                </motion.div>
                            ))}
                        </motion.div>
                        )}
                        </div>
                    </div>

                    {/* Activity Feed */}
                    <div>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-xl font-black text-slate-900">Recent Activity</h3>
                            <motion.button
                                whileHover={{ x: 3 }}
                                onClick={() => navigate('/patients')}
                                className="text-primary text-sm font-bold flex items-center gap-1 hover:underline"
                            >
                                View All
                                <span className="material-symbols-outlined text-sm">chevron_right</span>
                            </motion.button>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                            {activities.length > 0 ? activities.map((a, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.35 + i * 0.08 }}
                                    whileHover={{ backgroundColor: '#f8fafc' }}
                                    onClick={() => showToast('Viewing activity details...', 'info')}
                                    className="flex items-center gap-4 px-5 py-4 border-b border-slate-100 last:border-0 cursor-pointer transition-colors"
                                >
                                    <div className={`w-10 h-10 rounded-full ${a.bg} flex items-center justify-center ${a.text} shrink-0`}>
                                        <span className="material-symbols-outlined text-[20px]">{a.icon}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-slate-600 leading-snug">{a.msg}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">{a.sub}</p>
                                    </div>
                                    <span className="text-xs font-bold text-slate-400 shrink-0 tabular-nums">{a.time}</span>
                                </motion.div>
                            )) : (
                                <div className="py-12 text-center text-slate-400">
                                    <span className="material-symbols-outlined text-4xl block mb-2">notifications_off</span>
                                    <p className="text-sm font-medium">No recent activities</p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>

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
                                <span className="material-symbols-outlined text-primary">manage_accounts</span> Profile Settings
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-semibold uppercase text-slate-400">Name</label>
                                    <input type="text" defaultValue={getUserDisplayName(user, '')} className="w-full px-4 py-2 border border-slate-200 rounded-xl" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-semibold uppercase text-slate-400">Role</label>
                                    <input type="text" defaultValue={user?.role || ''} disabled className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-500" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-semibold uppercase text-slate-400">Email</label>
                                    <input type="email" defaultValue={user?.email || ''} className="w-full px-4 py-2 border border-slate-200 rounded-xl" />
                                </div>
                            </div>
                            <div className="mt-8 flex gap-3">
                                <button onClick={() => setShowProfileModal(false)} className="flex-1 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50 rounded-xl">Cancel</button>
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
                                            className={`flex-1 py-3 text-sm font-semibold rounded-xl border flex items-center justify-center gap-2 ${!isDarkMode ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-500'}`}
                                        >
                                            <span className="material-symbols-outlined text-[18px]">light_mode</span> Light
                                        </button>
                                        <button
                                            onClick={() => setIsDarkMode(true)}
                                            className={`flex-1 py-3 text-sm font-semibold rounded-xl border flex items-center justify-center gap-2 ${isDarkMode ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-500'}`}
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
                                                className={`w-10 h-10 rounded-full border-2 shadow-sm ${customBg === c ? 'border-primary scale-110' : 'border-slate-200 hover:scale-105'}`}
                                                style={{ backgroundColor: c || '#ffffff' }}
                                                title={c || 'Default'}
                                            >
                                                {c === '' && <span className="material-symbols-outlined text-slate-300 text-sm">block</span>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-8 flex justify-end gap-3">
                                <button onClick={() => setShowThemeModal(false)} className="px-6 py-3 bg-slate-900 text-white text-sm font-semibold rounded-xl">Done</button>
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
                                <button onClick={() => showToast('Password reset link sent', 'success')} className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl text-sm font-medium text-slate-700 flex items-center justify-between">
                                    Change Password
                                    <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                                </button>
                                <button onClick={() => showToast('2FA settings opened', 'info')} className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl text-sm font-medium text-slate-700 flex items-center justify-between">
                                    Two-Factor Authentication
                                    <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                                </button>
                                <button onClick={() => showToast('Active sessions view opened', 'info')} className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl text-sm font-medium text-slate-700 flex items-center justify-between">
                                    Active Sessions
                                    <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                                </button>
                            </div>
                            <div className="mt-8 flex justify-end">
                                <button onClick={() => setShowSecurityModal(false)} className="px-6 py-3 bg-slate-900 text-white text-sm font-semibold rounded-xl">Close</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </DashboardLayout>
    );
}
