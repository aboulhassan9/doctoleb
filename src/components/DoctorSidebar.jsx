import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSidebar } from '../contexts/SidebarContext';
import { useAuth } from '../contexts/AuthContext';

const menuItems = [
    { icon: 'dashboard', label: 'Dashboard', path: '/doctor-dashboard' },
    { icon: 'group', label: 'Patients', path: '/doctor-patients' },
    { icon: 'calendar_today', label: 'Appointments', path: '/doctor-appointments' },
    { icon: 'description', label: 'Reports', path: '/doctor-reports' },
    { icon: 'outbound', label: 'Referrals', path: '/doctor-referrals' },
    { icon: 'verified_user', label: 'Certificates', path: '/doctor-certificates' },
];

function DoctorSidebarInner({ onLogout, isMobile = false }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { isCollapsed, toggleSidebar, closeMobile } = useSidebar();
    const { user, logout } = useAuth();

    const expanded = isMobile || !isCollapsed;
    const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

    const handleLogout = async () => {
        if (onLogout) { onLogout(); return; }
        await logout();
        navigate('/login');
    };

    return (
        <aside className={`${isMobile ? 'w-72' : isCollapsed ? 'w-24' : 'w-64'} flex flex-col h-full bg-white border-r border-slate-200 transition-all duration-300 relative group`}>
            
            {!isMobile && (
                <button
                    onClick={toggleSidebar}
                    className="absolute -right-3 top-20 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-primary hover:border-primary shadow-sm z-50 transition-all opacity-40 group-hover:opacity-100"
                >
                    <span className={`material-symbols-outlined text-[18px] transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}>chevron_left</span>
                </button>
            )}

            <div className={`p-6 flex items-center ${expanded ? 'gap-3' : 'justify-center'} h-[84px]`}>
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white font-bold shadow-lg shadow-primary/20 shrink-0">{user?.first_name ? `${user.first_name[0]}${(user.last_name || '')[0] || ''}`.toUpperCase() : 'DR'}</div>
                {expanded && (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex-1 flex flex-col overflow-hidden">
                        <span className="text-sm font-bold text-slate-900 leading-none truncate">
                            {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Doctor'}
                        </span>
                        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mt-1 truncate">{user?.role || 'doctor'}</span>
                    </motion.div>
                )}
                {isMobile && (
                    <button onClick={closeMobile} aria-label="Close menu" className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
                        <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                )}
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1">
                {menuItems.map((item, i) => (
                    <motion.div
                        key={i}
                        onClick={() => { if (item.path) { navigate(item.path); if (isMobile) closeMobile(); } }}
                        title={!expanded ? item.label : ''}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        className={`flex items-center ${expanded ? 'gap-3 px-4' : 'justify-center'} py-3 rounded-xl transition-all duration-200 ease-in-out cursor-pointer ${
                            isActive(item.path) ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[20px]" style={isActive(item.path) ? { fontVariationSettings: "'FILL' 1" } : {}}>{item.icon}</span>
                        {expanded && <span className="text-sm font-medium tracking-tight truncate">{item.label}</span>}
                    </motion.div>
                ))}
            </nav>

            <div className={`p-4 border-t border-slate-200 ${!expanded ? 'flex flex-col items-center gap-4' : ''}`}>
                {expanded ? (
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { navigate('/doctor-consultation'); if (isMobile) closeMobile(); }}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 py-3 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 mb-2"
                    >
                        <span className="material-symbols-outlined text-sm">add</span>
                        New Consultation
                    </motion.button>
                ) : (
                    <button
                        onClick={() => navigate('/doctor-consultation')}
                        title="New Consultation"
                        className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20"
                    >
                        <span className="material-symbols-outlined">add</span>
                    </button>
                )}
                <button
                    onClick={handleLogout}
                    title={!expanded ? 'Logout' : ''}
                    className={`w-full flex items-center ${expanded ? 'gap-3 px-4' : 'justify-center'} py-3 text-slate-600 hover:bg-red-50 hover:text-critical rounded-xl transition-all`}
                >
                    <span className="material-symbols-outlined text-[20px]">logout</span>
                    {expanded && <span className="text-sm font-medium">Logout</span>}
                </button>
            </div>
        </aside>
    );
}

export default function DoctorSidebar({ onLogout }) {
    const { mobileOpen, closeMobile, isCollapsed, toggleSidebar } = useSidebar();
    return (
        <>
            <div className="hidden md:flex h-full shrink-0">
                <DoctorSidebarInner onLogout={onLogout} isMobile={false} />
            </div>
            <AnimatePresence>
                {mobileOpen && (
                    <>
                        <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeMobile} className="fixed inset-0 bg-black/40 z-40 md:hidden" />
                        <motion.div key="drawer" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'tween', duration: 0.25 }} className="fixed top-0 left-0 h-full z-50 md:hidden">
                            <DoctorSidebarInner onLogout={onLogout} isMobile={true} />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}