/**
 * NotificationList — Renders grouped notification cards with time-period sections.
 *
 * Handles: today/yesterday/lastWeek grouping, read/unread states, icon + color mapping.
 * Replaces ~70 lines of inline notification rendering from PreDoctorNotificationsPage.
 */
import { motion } from 'framer-motion';
import { stagger, fadeUp } from '@/lib/animations';

const PERIOD_LABELS = {
    today: 'Today',
    yesterday: 'Yesterday',
    lastWeek: 'Last Week',
};

const COLOR_MAP = {
    critical: { border: 'border-critical', iconBg: 'bg-critical/10 text-critical' },
    info:     { border: 'border-primary',  iconBg: 'bg-primary/10 text-primary' },
    lab:      { border: 'border-warning',  iconBg: 'bg-warning/10 text-warning' },
    default:  { border: 'border-slate-400', iconBg: 'bg-slate-200 text-slate-600' },
};

export default function NotificationList({ notifications, onMarkRead }) {
    const periods = ['today', 'yesterday', 'lastWeek'];

    return (
        <div className="space-y-12">
            {periods.map((period) => {
                const colors = (type) => COLOR_MAP[type] || COLOR_MAP.default;
                const label = PERIOD_LABELS[period];
                const items = notifications[period] || [];

                return (
                    <motion.section key={period} variants={stagger} initial="hidden" animate="visible">
                        <div className="flex items-center gap-4 mb-4">
                            <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${period === 'today' ? 'bg-primary/5 text-primary' : 'bg-slate-100 text-slate-500'}`}>
                                {label}
                            </span>
                            <div className="h-px flex-1 bg-slate-100"></div>
                        </div>
                        <div className="space-y-3">
                            {items.length === 0 && (
                                <p className="text-sm text-slate-400 py-4 text-center">No notifications for this period.</p>
                            )}
                            {items.map((notif) => {
                                const c = colors(notif.type);
                                return (
                                    <motion.div
                                        key={notif.id}
                                        variants={fadeUp}
                                        whileHover={{ scale: 1.01 }}
                                        onClick={() => notif.unread && onMarkRead(notif.id)}
                                        className={`group flex items-start gap-4 p-5 bg-white rounded-xl border-l-4 shadow-sm hover:shadow-md transition-all cursor-pointer ${c.border} ${notif.unread ? '' : 'opacity-70'}`}
                                    >
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${c.iconBg}`}>
                                            <span className="material-symbols-outlined text-2xl">{notif.icon}</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="font-bold text-slate-900">{notif.title}</h3>
                                                <span className="text-[11px] font-bold text-slate-400">{notif.time}</span>
                                            </div>
                                            <p className="text-sm text-slate-600 leading-relaxed">{notif.message}</p>
                                            {notif.unread && (
                                                <div className="mt-3 flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-primary"></span>
                                                    <span className="text-[10px] font-bold text-primary uppercase">Unread</span>
                                                </div>
                                            )}
                                        </div>
                                        <button className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-slate-500">
                                            <span className="material-symbols-outlined">more_vert</span>
                                        </button>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </motion.section>
                );
            })}
        </div>
    );
}
