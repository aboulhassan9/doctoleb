import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSidebar } from '../contexts/SidebarContext';
import { useAuth } from '../contexts/AuthContext';

const menuItems = [
    { icon: 'dashboard',     label: 'Dashboard',    path: '/predoctor-dashboard'   },
    { icon: 'group',         label: 'Patients',     path: '/predoctor-patients'    },
    { icon: 'fact_check',    label: 'Pre-Check',    path: '/predoctor-new-check'   },
    { icon: 'calendar_today',label: 'Appointments', path: '/predoctor-appointments'},
    { icon: 'schedule',      label: 'Schedule',     path: '/predoctor-schedule'    },
    { icon: 'notifications', label: 'Notifications',path: '/predoctor-notifications'},
];

function PreDoctorSidebarInner({ isMobile = false }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { isCollapsed, toggleSidebar, closeMobile } = useSidebar();
    const { user, logout } = useAuth();

    const expanded = isMobile || !isCollapsed;
    const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

    return (
        <aside className={`${isMobile ? 'w-72' : isCollapsed ? 'w-24' : 'w-72'} flex flex-col h-full bg-white border-r border-slate-200 transition-all duration-300 relative group`}>
            {!isMobile && (
                <button
                    onClick={toggleSidebar}
                    className="absolute -right-3 top-20 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-primary hover:border-primary shadow-sm z-50 transition-all opacity-40 group-hover:opacity-100"
                >
                    <span className={`material-symbols-outlined text-[18px] transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}>chevron_left</span>
                </button>
            )}

            <div className={`p-6 flex items-center ${expanded ? 'gap-3' : 'justify-center'} h-[84px]`}>
                <div className="bg-primary/10 p-2 rounded-lg shrink-0">
                    <span className="material-symbols-outlined text-primary text-3xl">medical_services</span>
                </div>
                {expanded && (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex-1 min-w-0">
                        <h1 className="font-bold text-slate-900 leading-tight">DoctoLeb</h1>
                        <p className="text-xs text-slate-500 truncate">Pre-Doctor Module</p>
                    </motion.div>
                )}
                {isMobile && (
                    <button onClick={closeMobile} aria-label="Close menu" className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
                        <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                )}
            </div>

            <nav className="flex-1 px-4 py-4 space-y-2">
                {menuItems.map((item, i) => (
                    <motion.button
                        key={i}
                        onClick={() => { if (item.path) { navigate(item.path); if (isMobile) closeMobile(); } }}
                        title={!expanded ? item.label : ''}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        className={`w-full flex items-center ${expanded ? 'gap-3 px-4' : 'justify-center'} py-3 rounded-xl transition-all font-medium text-sm ${
                            isActive(item.path) ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[22px] shrink-0">{item.icon}</span>
                        {expanded && <span className="truncate">{item.label}</span>}
                    </motion.button>
                ))}
            </nav>

            <div className="p-4 border-t border-slate-200">
                <div className={`flex items-center ${expanded ? 'gap-3 px-4' : 'justify-center'} py-3 mb-3 bg-slate-50 rounded-xl`}>
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {user?.first_name ? `${user.first_name[0]}${(user.last_name || '')[0] || ''}`.toUpperCase() : 'PD'}
                    </div>
                    {expanded && (
                        <div className="overflow-hidden">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                                {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Pre-Doctor'}
                            </p>
                            <p className="text-xs text-slate-500 truncate">Pre-Doctor</p>
                        </div>
                    )}
                </div>
                <button
                    onClick={async () => { await logout(); navigate('/login'); }}
                    title={!expanded ? 'Logout' : ''}
                    className={`w-full flex items-center ${expanded ? 'gap-3 px-4' : 'justify-center'} py-3 rounded-xl text-critical hover:bg-red-50 transition-colors font-medium text-sm`}
                >
                    <span className="material-symbols-outlined text-[22px] shrink-0">logout</span>
                    {expanded && <span className="truncate">Logout</span>}
                </button>
            </div>
        </aside>
    );
}

export default function PreDoctorSidebar() {
    const { mobileOpen, closeMobile } = useSidebar();
    return (
        <>
            <div className="hidden md:flex h-full shrink-0">
                <PreDoctorSidebarInner isMobile={false} />
            </div>
            <AnimatePresence>
                {mobileOpen && (
                    <>
                        <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeMobile} className="fixed inset-0 bg-black/40 z-40 md:hidden" />
                        <motion.div key="drawer" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'tween', duration: 0.25 }} className="fixed top-0 left-0 h-full z-50 md:hidden">
                            <PreDoctorSidebarInner isMobile={true} />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
