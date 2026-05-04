import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PreDoctorSidebar from '../components/PreDoctorSidebar';
import { stagger, fadeUp } from '../lib/animations';
import { useAuth } from '../contexts/AuthContext';
import { notificationService } from '../services/notifications';

export default function PreDoctorNotificationsPage() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState({ today: [], yesterday: [], lastWeek: [] });
    const [searchQuery, setSearchQuery] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [settings, setSettings] = useState({
        criticalVitals: true,
        newPatient: true,
        labResults: false,
        systemUpdates: true,
        securityAlerts: true,
        maintenance: false,
        inAppToast: true,
        browserPush: true,
        emailSummary: true,
        emailFrequency: 'daily',
        sms: false,
        criticalSound: 'High Alert Siren',
        warningSound: 'Standard Ping',
        infoSound: 'Muted',
    });

    const getIconForType = (type) => {
        switch (type) {
            case 'appointment': return 'event';
            case 'consultation': return 'medical_information';
            case 'referral': return 'assignment_ind';
            case 'critical': return 'warning';
            case 'lab': return 'description';
            default: return 'notifications';
        }
    };

    useEffect(() => {
        if (!user?.id) return;

        const fetchNotifications = async () => {
            const { data, error } = await notificationService.getAll(user.id);
            if (!error && data) {
                const now = new Date();
                const today = [];
                const yesterday = [];
                const lastWeek = [];

                data.forEach(n => {
                    const d = new Date(n.created_at);
                    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));

                    const formattedTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    const notif = {
                        id: n.id,
                        type: n.type || 'info',
                        icon: getIconForType(n.type),
                        title: n.title,
                        message: n.message,
                        time: diffDays === 0 ? formattedTime : diffDays === 1 ? `Yesterday, ${formattedTime}` : d.toLocaleDateString(),
                        unread: !n.is_read
                    };

                    if (diffDays === 0) today.push(notif);
                    else if (diffDays === 1) yesterday.push(notif);
                    else lastWeek.push(notif);
                });

                setNotifications({ today, yesterday, lastWeek });
            }
        };

        fetchNotifications();

        const sub = notificationService.subscribeToUserNotifications(user.id, () => {
            fetchNotifications();
        });

        return () => {
            if (sub) sub.unsubscribe();
        };
    }, [user?.id]);

    const handleMarkAllRead = async () => {
        if (!user?.id) return;
        await notificationService.markAllAsRead(user.id);
    };

    const handleMarkRead = async (id) => {
        await notificationService.markAsRead(id);
    };

    const getColor = (type) => {
        switch (type) {
            case 'critical': return { border: 'border-critical', bg: 'bg-red-50', iconBg: 'bg-critical/10 text-critical' };
            case 'info': return { border: 'border-primary', bg: 'bg-primary/5', iconBg: 'bg-primary/10 text-primary' };
            case 'lab': return { border: 'border-warning', bg: 'bg-warning/10', iconBg: 'bg-warning/10 text-warning' };
            default: return { border: 'border-slate-400', bg: 'bg-slate-50', iconBg: 'bg-slate-200 text-slate-600' };
        }
    };

    return (
        <div className="flex h-screen overflow-hidden font-display bg-background-light">
            <PreDoctorSidebar />

            <main className="flex-1 flex flex-col overflow-y-auto">
                <header className="Sticky top-0 z-20 h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
                    <div className="flex items-center gap-4 flex-1 max-w-xl">
                        <div className="relative w-full">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">search</span>
                            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search patients, records, or files..." className="w-full bg-slate-100 border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/50" />
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary"><span className="material-symbols-outlined">help</span></button>
                        <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary"><span className="material-symbols-outlined">settings</span></button>
                    </div>
                </header>

                <div className="p-8 pb-12">
                    <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-10 flex items-end justify-between">
                        <div>
                            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Notifications</h2>
                            <p className="text-slate-500 mt-2 text-base">Manage your clinical alerts and system updates</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <motion.button onClick={handleMarkAllRead} whileHover={{ scale: 1.02 }} className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl">
                                <span className="material-symbols-outlined text-lg">done_all</span>Mark all read
                            </motion.button>
                            <motion.button whileHover={{ scale: 1.02 }} onClick={() => setShowSettings(true)} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-primary text-white rounded-xl shadow-lg hover:opacity-90">
                                <span className="material-symbols-outlined text-lg">settings</span>Settings
                            </motion.button>
                        </div>
                    </motion.div>

                    <div className="space-y-12">
                        {['today', 'yesterday', 'lastWeek'].map((period, idx) => (
                            <motion.section key={period} variants={stagger} initial="hidden" animate="visible">
                                <div className="flex items-center gap-4 mb-4">
                                    <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${period === 'today' ? 'bg-primary/5 text-primary' : 'bg-slate-100 text-slate-500'}`}>{period === 'lastWeek' ? 'Last Week' : period.charAt(0).toUpperCase() + period.slice(1)}</span>
                                    <div className="h-px flex-1 bg-slate-100"></div>
                                </div>
                                <div className="space-y-3">
                                    {notifications[period].length === 0 && (
                                        <p className="text-sm text-slate-400 py-4 text-center">No notifications for this period.</p>
                                    )}
                                    {notifications[period].map((notif, i) => {
                                        const colors = getColor(notif.type);
                                        return (
                                            <motion.div onClick={() => notif.unread && handleMarkRead(notif.id)} key={notif.id} variants={fadeUp} whileHover={{ scale: 1.01 }} className={`group flex items-start gap-4 p-5 bg-white rounded-xl border-l-4 shadow-sm hover:shadow-md transition-all cursor-pointer ${colors.border} ${notif.unread ? '' : 'opacity-70'}`}>
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors.iconBg}`}><span className="material-symbols-outlined text-2xl">{notif.icon}</span></div>
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <h3 className="font-bold text-slate-900">{notif.title}</h3>
                                                        <span className="text-[11px] font-bold text-slate-400">{notif.time}</span>
                                                    </div>
                                                    <p className="text-sm text-slate-600 leading-relaxed">{notif.message}</p>
                                                    {notif.unread && <div className="mt-3 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary"></span><span className="text-[10px] font-bold text-primary uppercase">Unread</span></div>}
                                                </div>
                                                <button className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-slate-500"><span className="material-symbols-outlined">more_vert</span></button>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </motion.section>
                        ))}
                    </div>
                </div>
            </main>

            <AnimatePresence>
                {showSettings && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowSettings(false)}></div>
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
                            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">Notification Settings</h3>
                                    <p className="text-xs text-slate-500 mt-1">Configure how you receive critical clinical alerts.</p>
                                </div>
                                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                    <span className="material-symbols-outlined text-slate-400">close</span>
                                </button>
                            </div>

                            <div className="p-8 overflow-y-auto space-y-8">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                                        <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-50 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-critical">emergency</span>
                                            <h4 className="font-bold text-slate-900">Clinical Alerts</h4>
                                        </div>
                                        <div className="p-6 space-y-5">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">Critical Vitals</p>
                                                    <p className="text-xs text-slate-500">Alert for patients exceeding thresholds</p>
                                                </div>
                                                <button onClick={() => setSettings({ ...settings, criticalVitals: !settings.criticalVitals })} className={`w-12 h-6 rounded-full transition-all ${settings.criticalVitals ? 'bg-primary' : 'bg-slate-200'}`}>
                                                    <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.criticalVitals ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                                                </button>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">New Patient Assignment</p>
                                                    <p className="text-xs text-slate-500">Alert when new patient assigned</p>
                                                </div>
                                                <button onClick={() => setSettings({ ...settings, newPatient: !settings.newPatient })} className={`w-12 h-6 rounded-full transition-all ${settings.newPatient ? 'bg-primary' : 'bg-slate-200'}`}>
                                                    <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.newPatient ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                                                </button>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">Lab Results</p>
                                                    <p className="text-xs text-slate-500">Notification for lab diagnostics</p>
                                                </div>
                                                <button onClick={() => setSettings({ ...settings, labResults: !settings.labResults })} className={`w-12 h-6 rounded-full transition-all ${settings.labResults ? 'bg-primary' : 'bg-slate-200'}`}>
                                                    <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.labResults ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                                        <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-50 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-slate-600">settings_suggest</span>
                                            <h4 className="font-bold text-slate-900">System Notifications</h4>
                                        </div>
                                        <div className="p-6 space-y-5">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">System Updates</p>
                                                    <p className="text-xs text-slate-500">Deployment notifications</p>
                                                </div>
                                                <button onClick={() => setSettings({ ...settings, systemUpdates: !settings.systemUpdates })} className={`w-12 h-6 rounded-full transition-all ${settings.systemUpdates ? 'bg-primary' : 'bg-slate-200'}`}>
                                                    <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.systemUpdates ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                                                </button>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">Security Alerts</p>
                                                    <p className="text-xs text-slate-500">Security warnings</p>
                                                </div>
                                                <button onClick={() => setSettings({ ...settings, securityAlerts: !settings.securityAlerts })} className={`w-12 h-6 rounded-full transition-all ${settings.securityAlerts ? 'bg-primary' : 'bg-slate-200'}`}>
                                                    <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.securityAlerts ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                                                </button>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">Maintenance Schedule</p>
                                                    <p className="text-xs text-slate-500">System maintenance alerts</p>
                                                </div>
                                                <button onClick={() => setSettings({ ...settings, maintenance: !settings.maintenance })} className={`w-12 h-6 rounded-full transition-all ${settings.maintenance ? 'bg-primary' : 'bg-slate-200'}`}>
                                                    <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.maintenance ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-xl border border-slate-100 p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h4 className="font-bold text-slate-900">Delivery Methods</h4>
                                            <p className="text-xs text-slate-500">Select how you want to be notified.</p>
                                        </div>
                                        <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase">Multi-Channel</span>
                                    </div>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                        <label className="flex items-center p-4 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-primary transition-all">
                                            <input checked={settings.inAppToast} onChange={() => setSettings({ ...settings, inAppToast: !settings.inAppToast })} className="w-5 h-5 rounded border-slate-300 text-primary" type="checkbox" />
                                            <div className="ml-3">
                                                <p className="text-sm font-bold text-slate-900">In-App Toast</p>
                                                <p className="text-[10px] text-slate-500">Active session</p>
                                            </div>
                                        </label>
                                        <label className="flex items-center p-4 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-primary transition-all">
                                            <input checked={settings.browserPush} onChange={() => setSettings({ ...settings, browserPush: !settings.browserPush })} className="w-5 h-5 rounded border-slate-300 text-primary" type="checkbox" />
                                            <div className="ml-3">
                                                <p className="text-sm font-bold text-slate-900">Browser Push</p>
                                                <p className="text-[10px] text-slate-500">System level</p>
                                            </div>
                                        </label>
                                        <div className="flex items-start p-4 bg-white rounded-xl border border-slate-200">
                                            <input checked={settings.emailSummary} onChange={() => setSettings({ ...settings, emailSummary: !settings.emailSummary })} className="mt-1 w-5 h-5 rounded border-slate-300 text-primary" type="checkbox" />
                                            <div className="ml-3 flex-1">
                                                <p className="text-sm font-bold text-slate-900">Email</p>
                                                <select value={settings.emailFrequency} onChange={(e) => setSettings({ ...settings, emailFrequency: e.target.value })} className="mt-2 w-full text-xs border-none bg-slate-50 rounded-lg py-1.5 px-2">
                                                    <option>Daily</option>
                                                    <option>Weekly</option>
                                                </select>
                                            </div>
                                        </div>
                                        <label className="flex items-center p-4 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-primary transition-all">
                                            <input checked={settings.sms} onChange={() => setSettings({ ...settings, sms: !settings.sms })} className="w-5 h-5 rounded border-slate-300 text-primary" type="checkbox" />
                                            <div className="ml-3">
                                                <p className="text-sm font-bold text-slate-900">SMS</p>
                                                <p className="text-[10px] text-critical font-bold uppercase">Critical only</p>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="bg-white p-5 rounded-xl border border-slate-100">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="material-symbols-outlined text-critical text-lg">volume_up</span>
                                            <p className="text-xs font-bold uppercase text-slate-500">Critical Alerts</p>
                                        </div>
                                        <select value={settings.criticalSound} onChange={(e) => setSettings({ ...settings, criticalSound: e.target.value })} className="w-full bg-slate-50 border-none rounded-lg text-sm font-bold py-2.5 px-3">
                                            <option>High Alert Siren</option>
                                            <option>Urgent Pulse</option>
                                            <option>Digital Alarm</option>
                                        </select>
                                    </div>
                                    <div className="bg-white p-5 rounded-xl border border-slate-100">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="material-symbols-outlined text-warning text-lg">volume_down</span>
                                            <p className="text-xs font-bold uppercase text-slate-500">Warnings</p>
                                        </div>
                                        <select value={settings.warningSound} onChange={(e) => setSettings({ ...settings, warningSound: e.target.value })} className="w-full bg-slate-50 border-none rounded-lg text-sm font-bold py-2.5 px-3">
                                            <option>Standard Ping</option>
                                            <option>Subtle Chime</option>
                                            <option>Soft Buzz</option>
                                        </select>
                                    </div>
                                    <div className="bg-white p-5 rounded-xl border border-slate-100">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="material-symbols-outlined text-slate-400 text-lg">volume_mute</span>
                                            <p className="text-xs font-bold uppercase text-slate-500">Informational</p>
                                        </div>
                                        <select value={settings.infoSound} onChange={(e) => setSettings({ ...settings, infoSound: e.target.value })} className="w-full bg-slate-50 border-none rounded-lg text-sm font-bold py-2.5 px-3">
                                            <option>Muted</option>
                                            <option>Single Click</option>
                                            <option>Low Tone</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-2 text-slate-400">
                                    <span className="material-symbols-outlined text-sm">info</span>
                                    <span className="text-xs font-medium">Changes apply immediately across devices.</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setShowSettings(false)} className="px-5 py-2.5 rounded-xl text-slate-600 font-bold hover:bg-slate-200 transition-colors text-sm">Cancel</button>
                                    <button onClick={() => { alert('Settings saved!'); setShowSettings(false); }} className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold hover:text-primary transition-all text-sm">Save Changes</button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
