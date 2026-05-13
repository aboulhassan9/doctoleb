/**
 * DashboardSettingsModals — Profile, Theme, and Security modals.
 *
 * Extracted from DashboardPage to reduce inline modal boilerplate (~127 lines).
 */
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getUserDisplayName } from '@/lib/userDisplay';

export default function DashboardSettingsModals({
    showProfile, onCloseProfile,
    showTheme, onCloseTheme,
    showSecurity, onCloseSecurity,
}) {
    const { user } = useAuth();
    const { showToast } = useToast();
    const { isDarkMode, setIsDarkMode, customBg, setCustomBg } = useTheme();

    return (
        <AnimatePresence>
            {/* Profile Modal */}
            {showProfile && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onCloseProfile}>
                    <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-8" onClick={e => e.stopPropagation()}>
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
                            <button onClick={onCloseProfile} className="flex-1 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50 rounded-xl">Cancel</button>
                            <button onClick={() => { onCloseProfile(); showToast('Profile updated', 'success'); }} className="flex-1 py-3 bg-primary text-white text-sm font-semibold rounded-xl">Save</button>
                        </div>
                    </motion.div>
                </motion.div>
            )}

            {/* Theme Modal */}
            {showTheme && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onCloseTheme}>
                    <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-8" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">display_settings</span> UI Preferences
                        </h2>
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-semibold uppercase text-slate-400 mb-3 block">Theme Mode</label>
                                <div className="flex gap-2">
                                    <button onClick={() => setIsDarkMode(false)} className={`flex-1 py-3 text-sm font-semibold rounded-xl border flex items-center justify-center gap-2 ${!isDarkMode ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-500'}`}>
                                        <span className="material-symbols-outlined text-[18px]">light_mode</span> Light
                                    </button>
                                    <button onClick={() => setIsDarkMode(true)} className={`flex-1 py-3 text-sm font-semibold rounded-xl border flex items-center justify-center gap-2 ${isDarkMode ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-500'}`}>
                                        <span className="material-symbols-outlined text-[18px]">dark_mode</span> Dark
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase text-slate-400 mb-3 block">Custom Background Color</label>
                                <div className="flex flex-wrap gap-2">
                                    {['', '#f5f7f8', '#eef2ff', '#f0fdf4', '#fffbeb', '#fef2f2'].map(c => (
                                        <button key={c} onClick={() => setCustomBg(c)} className={`w-10 h-10 rounded-full border-2 shadow-sm ${customBg === c ? 'border-primary scale-110' : 'border-slate-200 hover:scale-105'}`} style={{ backgroundColor: c || '#ffffff' }} title={c || 'Default'}>
                                            {c === '' && <span className="material-symbols-outlined text-slate-300 text-sm">block</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="mt-8 flex justify-end gap-3">
                            <button onClick={onCloseTheme} className="px-6 py-3 bg-slate-900 text-white text-sm font-semibold rounded-xl">Done</button>
                        </div>
                    </motion.div>
                </motion.div>
            )}

            {/* Security Modal */}
            {showSecurity && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onCloseSecurity}>
                    <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-8" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">security</span> Security Settings
                        </h2>
                        <div className="space-y-4">
                            <button onClick={() => showToast('Password reset link sent', 'success')} className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl text-sm font-medium text-slate-700 flex items-center justify-between">
                                Change Password <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                            </button>
                            <button onClick={() => showToast('2FA settings opened', 'info')} className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl text-sm font-medium text-slate-700 flex items-center justify-between">
                                Two-Factor Authentication <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                            </button>
                            <button onClick={() => showToast('Active sessions view opened', 'info')} className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl text-sm font-medium text-slate-700 flex items-center justify-between">
                                Active Sessions <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                            </button>
                        </div>
                        <div className="mt-8 flex justify-end">
                            <button onClick={onCloseSecurity} className="px-6 py-3 bg-slate-900 text-white text-sm font-semibold rounded-xl">Close</button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
