/**
 * DashboardHeader — shared sticky header with search, notifications, and settings dropdown.
 *
 * Used by DashboardPage. Replaces ~140 lines of inline header.
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useNotifications } from '@/hooks/features/useNotifications';
import { timeAgo } from '@/lib/dateUtils';

const NOTIF_ICONS = {
    appointment: { icon: 'calendar_month', cls: 'bg-primary/10 text-primary' },
    patient:     { icon: 'person_add',     cls: 'bg-success/10 text-success' },
    encounter:   { icon: 'stethoscope',    cls: 'bg-tertiary/10 text-tertiary' },
    precheck:    { icon: 'fact_check',     cls: 'bg-warning/10 text-warning' },
    document:    { icon: 'description',    cls: 'bg-secondary/10 text-secondary' },
    default:     { icon: 'notifications',  cls: 'bg-slate-100 text-slate-500' },
};

export default function DashboardHeader({
    searchQuery,
    onSearchChange,
    onOpenProfile,
    onOpenTheme,
    onOpenSecurity,
}) {
    const navigate = useNavigate();
    const { logout, user } = useAuth();
    const { notifications, markRead, markAllRead } = useNotifications({ userId: user?.id });
    const [showNotifications, setShowNotifications] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
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

    const handleMarkRead = async () => {
        await markAllRead();
        setShowNotifications(false);
    };

    const handleNotifClick = async (notif) => {
        await markRead(notif.id);
        setShowNotifications(false);
    };

    return (
        <header className="sticky top-0 z-20 h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
            <div className="flex items-center gap-4 flex-1 max-w-xl">
                <div className="relative w-full">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">search</span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Search patients, doctors or appointments..."
                        className="w-full bg-slate-100 border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 transition-all relative z-10"
                    />
                    <AnimatePresence>
                        {searchQuery && (
                            <motion.div
                                initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                                className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2"
                            >
                                <div className="p-3 text-sm text-slate-500 font-medium">
                                    Searching database for <span className="text-slate-900 font-bold">"{searchQuery}"</span>...
                                </div>
                                <button
                                    onClick={() => {
                                        const q = searchQuery;
                                        onSearchChange('');
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
                {/* Notifications */}
                <button
                    onClick={() => { setShowNotifications(!showNotifications); setShowSettings(false); }}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary transition-all relative"
                >
                    <span className="material-symbols-outlined">notifications</span>
                    {notifications.length > 0 && (
                        <>
                            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-critical text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                                {notifications.length > 9 ? '9+' : notifications.length}
                            </span>
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </>
                    )}
                </button>
                <AnimatePresence>
                    {showNotifications && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="absolute top-[120%] right-12 w-80 bg-white shadow-2xl rounded-2xl border border-slate-100 z-50 overflow-hidden"
                        >
                            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                <span className="font-semibold text-slate-900 text-sm">Notifications</span>
                                <button onClick={handleMarkRead} className="text-[11px] text-primary font-semibold uppercase tracking-wider cursor-pointer hover:underline">Mark Read</button>
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

                {/* Settings */}
                <button
                    onClick={() => { setShowSettings(!showSettings); setShowNotifications(false); }}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary transition-all relative"
                >
                    <span className="material-symbols-outlined">settings</span>
                </button>
                <AnimatePresence>
                    {showSettings && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="absolute top-[120%] right-0 w-56 bg-white shadow-2xl rounded-2xl border border-slate-100 z-50 overflow-hidden py-1.5"
                        >
                            <button onClick={() => { onOpenProfile(); setShowSettings(false); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-3 transition-colors">
                                <span className="material-symbols-outlined text-[18px]">manage_accounts</span> Profile Options
                            </button>
                            <button onClick={() => { onOpenTheme(); setShowSettings(false); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-3 transition-colors">
                                <span className="material-symbols-outlined text-[18px]">display_settings</span> UI Preferences
                            </button>
                            <button onClick={() => { onOpenSecurity(); setShowSettings(false); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-3 transition-colors">
                                <span className="material-symbols-outlined text-[18px]">security</span> Security Settings
                            </button>
                            <div className="border-t border-slate-100 my-1.5 mx-3"></div>
                            <button onClick={async () => { await logout(); navigate('/login'); }} className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-xs font-medium text-critical flex items-center gap-3 transition-colors">
                                <span className="material-symbols-outlined text-[18px]">logout</span> Secure Sign Out
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </header>
    );
}
