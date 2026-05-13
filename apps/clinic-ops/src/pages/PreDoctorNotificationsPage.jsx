/**
 * PreDoctorNotificationsPage — Orchestrator for pre-doctor notification management.
 *
 * Delegates rendering to:
 *   - DashboardHeader (shared sticky header)
 *   - NotificationList (grouped notification cards)
 *   - NotificationSettingsModal (preferences modal)
 *
 * Reduced from 360 → ~120 lines.
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import DashboardHeader from '@clinic-ops/components/dashboard/DashboardHeader';
import DashboardSettingsModals from '@clinic-ops/components/dashboard/DashboardSettingsModals';
import NotificationList from '@clinic-ops/components/notifications/NotificationList';
import NotificationSettingsModal from '@clinic-ops/components/notifications/NotificationSettingsModal';
import { useAuth } from '@/contexts/AuthContext';
import { notificationCoreService } from '@/services/notificationCore';

const ICON_MAP = {
    appointment: 'event',
    encounter: 'medical_information',
    document: 'assignment_ind',
    critical: 'warning',
    lab: 'description',
};

export default function PreDoctorNotificationsPage() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState({ today: [], yesterday: [], lastWeek: [] });
    const [searchQuery, setSearchQuery] = useState('');
    const [showSettings, setShowSettings] = useState(false);

    // Settings modals state
    const [showProfile, setShowProfile] = useState(false);
    const [showTheme, setShowTheme] = useState(false);
    const [showSecurity, setShowSecurity] = useState(false);

    useEffect(() => {
        if (!user?.id) return;

        const fetchNotifications = async () => {
            const { data, error } = await notificationCoreService.getAll(user.id);
            if (!error && data) {
                const now = new Date();
                const grouped = { today: [], yesterday: [], lastWeek: [] };

                data.forEach(n => {
                    const created = new Date(n.created_at);
                    const diffDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));
                    const formattedTime = created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    const notif = {
                        id: n.id,
                        type: n.type || 'info',
                        icon: ICON_MAP[n.type] || 'notifications',
                        title: n.title,
                        message: n.message,
                        time: diffDays === 0 ? formattedTime : diffDays === 1 ? `Yesterday, ${formattedTime}` : created.toLocaleDateString(),
                        unread: !n.is_read,
                    };

                    if (diffDays === 0) grouped.today.push(notif);
                    else if (diffDays === 1) grouped.yesterday.push(notif);
                    else grouped.lastWeek.push(notif);
                });

                setNotifications(grouped);
            }
        };

        fetchNotifications();

        const sub = notificationCoreService.subscribeToUserNotifications(user.id, () => {
            fetchNotifications();
        });

        return () => { if (sub) sub.unsubscribe(); };
    }, [user?.id]);

    const handleMarkAllRead = async () => {
        if (!user?.id) return;
        await notificationCoreService.markAllAsRead(user.id);
    };

    const handleMarkRead = async (id) => {
        await notificationCoreService.markAsRead(id);
    };

    return (
        <DashboardLayout role="pre_doctor">
            <div className="flex-1 flex flex-col overflow-y-auto">
                <DashboardHeader
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    onOpenProfile={() => setShowProfile(true)}
                    onOpenTheme={() => setShowTheme(true)}
                    onOpenSecurity={() => setShowSecurity(true)}
                />

                <div className="p-8 pb-12">
                    {/* Page title + actions */}
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

                    {/* Notification list */}
                    <NotificationList notifications={notifications} onMarkRead={handleMarkRead} />
                </div>
            </div>

            {/* Notification settings modal */}
            <NotificationSettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

            {/* Dashboard settings modals */}
            <DashboardSettingsModals
                showProfile={showProfile}
                showTheme={showTheme}
                showSecurity={showSecurity}
                onCloseProfile={() => setShowProfile(false)}
                onCloseTheme={() => setShowTheme(false)}
                onCloseSecurity={() => setShowSecurity(false)}
            />
        </DashboardLayout>
    );
}
