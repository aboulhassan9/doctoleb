import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import CountUp from '@/components/CountUp';
import BorderGlow from '@/components/BorderGlow';
import DashboardHeader from '@clinic-ops/components/dashboard/DashboardHeader';
import DashboardSettingsModals from '@clinic-ops/components/dashboard/DashboardSettingsModals';
import { useAuth } from '@/contexts/AuthContext';
import { useAppointments } from '@/hooks/features/useAppointments';
import { usePatients } from '@/hooks/features/usePatients';
import { useNotifications } from '@/hooks/features/useNotifications';
import { stagger, fadeUp } from '@/lib/animations';
import { getUserDisplayName } from '@/lib/userDisplay';
import PatientDashboardPage from '@patient-web/pages/PatientDashboardPage';

const ACTION_CARDS = [
    { title: 'Register Patient', desc: 'Add a new patient with insurance and contact details.', icon: 'person_add', action: 'New Registration', path: '/patients', accent: { bg: 'bg-primary/10', text: 'text-primary' }, glowColor: '215 90 60', colors: ['#0d6cf2', '#38bdf8', '#60a5fa'] },
    { title: 'Manage Appointments', desc: 'Schedule, edit, or cancel appointments and check availability.', icon: 'calendar_today', action: 'Open Calendar', path: '/appointments', accent: { bg: 'bg-indigo-500/10', text: 'text-indigo-500' }, glowColor: '239 84 65', colors: ['#6366f1', '#818cf8', '#a5b4fc'] },
    { title: 'Patient Records', desc: 'Search patient history, medical documents, and reports.', icon: 'description', action: 'Search Records', path: '/patients', accent: { bg: 'bg-success/10', text: 'text-success' }, glowColor: '160 84 40', colors: ['#10b981', '#34d399', '#6ee7b7'] },
    { title: 'Billing & Payments', desc: 'Generate invoices, track balances, and process payments.', icon: 'payments', action: 'Manage Billing', path: '/billing', accent: { bg: 'bg-warning/10', text: 'text-warning' }, glowColor: '38 92 50', colors: ['#f59e0b', '#fbbf24', '#fcd34d'] },
];

const ACTION_ROUTES = [
    (nav) => nav('/patients', { state: { openAddModal: true } }),
    (nav) => nav('/appointments'),
    (nav) => nav('/patients', { state: { focusSearch: true } }),
    (nav) => nav('/billing'),
];

export default function DashboardPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const role = user?.role;

    const [searchQuery, setSearchQuery] = useState('');

    const { appointments, loading: loadingAppointments } = useAppointments({ mode: 'all' });
    const { patients, loading: loadingPatients } = usePatients();
    const { notifications } = useNotifications({ userId: user?.id });

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

    const activities = React.useMemo(() => {
        return notifications.filter(n => !n.is_read).slice(0, 5).map(n => ({
            title: n.title,
            sub: n.message,
            time: new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            icon: n.type === 'appointment' ? 'calendar_month' : 'notifications',
            iconCls: 'bg-primary/10 text-primary'
        }));
    }, [notifications]);

    // Modal state
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showThemeModal, setShowThemeModal] = useState(false);
    const [showSecurityModal, setShowSecurityModal] = useState(false);

    if (role === 'patient') return <PatientDashboardPage />;

    return (
        <DashboardLayout role="secretary" title="Secretary Dashboard">
            <div className="flex-1 flex flex-col overflow-y-auto">
                <DashboardHeader
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    onOpenProfile={() => setShowProfileModal(true)}
                    onOpenTheme={() => setShowThemeModal(true)}
                    onOpenSecurity={() => setShowSecurityModal(true)}
                />

                <div className="p-4 md:p-8 pb-12">
                    {/* Welcome */}
                    <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-10 flex items-end justify-between">
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
                    <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-12">
                        {ACTION_CARDS.map((card, i) => (
                            <motion.div key={i} variants={fadeUp} className="h-full">
                                <BorderGlow glowColor={card.glowColor} backgroundColor="#ffffff" borderRadius={20} glowRadius={28} glowIntensity={0.85} colors={card.colors} className="group cursor-pointer h-full" onClick={() => ACTION_ROUTES[i](navigate)}>
                                    <div className="p-6 flex flex-col h-full">
                                        <motion.div whileHover={{ scale: 1.12, rotate: 6 }} transition={{ type: 'spring', stiffness: 300 }} className={`w-14 h-14 rounded-2xl ${card.accent.bg} flex items-center justify-center ${card.accent.text} mb-5 shrink-0`}>
                                            <span className="material-symbols-outlined text-[32px]">{card.icon}</span>
                                        </motion.div>
                                        <h3 className="text-[17px] font-semibold text-slate-900 mb-2">{card.title}</h3>
                                        <p className="text-slate-500 text-sm leading-relaxed flex-1 mb-5">{card.desc}</p>
                                        <div className={`flex items-center gap-1 ${card.accent.text} font-bold text-sm`}>
                                            {card.action}
                                            <motion.span className="material-symbols-outlined text-sm" animate={{ x: [0, 2, 0] }} transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}>arrow_forward</motion.span>
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
                                <motion.div variants={stagger} initial="hidden" animate="visible" className="contents">
                                    {stats.map((s, i) => (
                                        <motion.div key={i} variants={fadeUp} whileHover={{ y: -4, boxShadow: '0 12px 40px rgba(0,0,0,0.08)' }} className="p-6 bg-white border border-slate-200 rounded-2xl relative overflow-hidden transition-all shadow-sm">
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
                                            <motion.span animate={{ rotate: [0, 6, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} className="material-symbols-outlined text-[90px] absolute -right-4 -bottom-4 opacity-[0.04] select-none pointer-events-none text-slate-900">{s.icon}</motion.span>
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
                            <motion.button whileHover={{ x: 3 }} onClick={() => navigate('/patients')} className="text-primary text-sm font-bold flex items-center gap-1 hover:underline">
                                View All <span className="material-symbols-outlined text-sm">chevron_right</span>
                            </motion.button>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                            {activities.length > 0 ? activities.map((a, i) => (
                                <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 + i * 0.08 }} whileHover={{ backgroundColor: '#f8fafc' }} className="flex items-center gap-4 px-5 py-4 border-b border-slate-100 last:border-0 cursor-pointer transition-colors">
                                    <div className={`w-10 h-10 rounded-full ${a.iconCls} flex items-center justify-center shrink-0`}>
                                        <span className="material-symbols-outlined text-[20px]">{a.icon}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-slate-900 font-semibold leading-snug">{a.title}</p>
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

            <DashboardSettingsModals
                showProfile={showProfileModal} onCloseProfile={() => setShowProfileModal(false)}
                showTheme={showThemeModal} onCloseTheme={() => setShowThemeModal(false)}
                showSecurity={showSecurityModal} onCloseSecurity={() => setShowSecurityModal(false)}
            />
        </DashboardLayout>
    );
}
