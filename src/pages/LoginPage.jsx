import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { getHomeRouteForRole } from '@/lib/routes';

const LoginPage = () => {
    const navigate = useNavigate();
    const { signIn } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { showToast } = useToast();

    const features = [
        { icon: 'calendar_month', text: 'Smart appointment scheduling & auto-reminders' },
        { icon: 'patient_list',   text: 'Secure cloud-based electronic health records'  },
        { icon: 'payments',       text: 'Automated billing & insurance processing'      },
        { icon: 'bar_chart',      text: 'Real-time dashboards & analytics'              },
        { icon: 'security',       text: 'HIPAA compliant · 256-bit SSL encryption'      },
    ];

    return (
        <div className="flex min-h-screen w-full font-display">

            {/* ─── LEFT PANEL ─── */}
            <div className="hidden lg:flex w-[520px] bg-background-dark flex-col relative overflow-hidden shrink-0">
                <motion.div
                    animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0], borderRadius: ['40%', '50%', '40%'] }}
                    transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                    className="absolute top-[-10%] left-[35%] w-[480px] h-[480px] bg-primary/20 rounded-full blur-[80px] pointer-events-none"
                />
                <motion.div
                    animate={{ scale: [1, 1.3, 1], rotate: [0, -90, 0] }}
                    transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
                    className="absolute bottom-[-10%] left-[-10%] w-[380px] h-[380px] bg-primary/10 rounded-full blur-[60px] pointer-events-none"
                />

                <div className="relative z-10 p-14 flex flex-col h-full">
                    <Link to="/" className="flex items-center gap-3 mb-14">
                        <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/30">
                            <span className="material-symbols-outlined text-xl">health_metrics</span>
                        </div>
                        <span className="text-white font-black text-2xl tracking-tight">DoctoLeb</span>
                    </Link>

                    <div className="mb-10">
                        <h1 className="text-white font-black text-4xl leading-tight mb-4">
                            Your clinic, <span className="text-primary">intelligently</span> managed
                        </h1>
                        <p className="text-slate-400 text-base leading-relaxed">
                            Sign in to access your personalized dashboard and everything your team needs to deliver exceptional care.
                        </p>
                    </div>

                    <div className="flex-1 flex flex-col gap-5">
                        {features.map((f, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 + i * 0.08 }}
                                className="flex items-center gap-4"
                            >
                                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-primary text-xl">{f.icon}</span>
                                </div>
                                <p className="text-slate-300 text-sm font-medium">{f.text}</p>
                            </motion.div>
                        ))}
                    </div>

                    <div className="mt-10 pt-8 border-t border-slate-800">
                        <div className="flex items-center gap-8 mb-5">
                            <div className="flex items-center gap-2 opacity-50">
                                <span className="material-symbols-outlined text-sm text-slate-400">verified_user</span>
                                <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">HIPAA Compliant</span>
                            </div>
                            <div className="flex items-center gap-2 opacity-50">
                                <span className="material-symbols-outlined text-sm text-slate-400">security</span>
                                <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">256-Bit SSL</span>
                            </div>
                        </div>
                        <div className="flex justify-between text-slate-600 text-xs font-semibold uppercase tracking-wider">
                            <span>v2.0 · April 2026</span>
                            <span>Authorized Access Only</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── RIGHT PANEL ─── */}
            <div className="flex-1 bg-background-light flex flex-col overflow-y-auto">

                {/* Top bar */}
                <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200">
                    <Link to="/" className="flex lg:hidden items-center gap-2">
                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
                            <span className="material-symbols-outlined text-base">health_metrics</span>
                        </div>
                        <span className="text-slate-900 font-black text-lg">DoctoLeb</span>
                    </Link>
                    <div className="hidden lg:block" />
                    <div className="flex items-center gap-4">
                        <p className="text-sm text-slate-500 hidden sm:block">Don't have an account?</p>
                        <Link
                            to="/signup"
                            className="px-5 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                        >
                            Sign Up Free
                        </Link>
                    </div>
                </div>

                {/* Form */}
                <div className="flex-1 flex flex-col justify-center max-w-[520px] w-full mx-auto px-8 py-12">

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                            <span className="material-symbols-outlined text-primary text-3xl">health_metrics</span>
                        </div>
                        <h2 className="text-4xl font-black text-slate-900 mb-2">Welcome back</h2>
                        <p className="text-slate-500 text-base">Sign in to your DoctoLeb account to continue</p>
                    </motion.div>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="p-4 rounded-xl bg-critical/10 border border-critical/20 text-critical text-sm mb-4"
                        >
                            {error}
                        </motion.div>
                    )}

                    <motion.form
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
                        className="space-y-5"
                        onSubmit={async (e) => {
                            e.preventDefault();
                            setError('');
                            setLoading(true);

                            const { success, error: authError, user } = await signIn(email, password);
                            setLoading(false);

                            if (!success || authError) {
                                setError(authError || 'Invalid email or password');
                                return;
                            }

                            if (user) {
                                showToast(`Welcome, ${user.first_name}!`, 'success');
                                navigate(getHomeRouteForRole(user.role));
                            }
                        }}
                    >
                        {/* Email */}
                        <div className="flex flex-col gap-2">
                            <label className="text-slate-700 text-sm font-bold px-1">Email Address</label>
                            <div className="relative group">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors text-xl">mail</span>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="cp@clinic.com"
                                    className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-400 text-sm shadow-sm"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between px-1">
                                <label className="text-slate-700 text-sm font-bold">Password</label>
                                <Link
                                    to="/forgot-password"
                                    className="text-primary hover:underline text-xs font-bold"
                                >
                                    Forgot Password?
                                </Link>
                            </div>
                            <div className="relative group">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors text-xl">lock</span>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full pl-12 pr-12 py-4 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-400 text-sm shadow-sm"
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    disabled={loading}
                                >
                                    <span className="material-symbols-outlined text-xl">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                </button>
                            </div>
                        </div>

                        {/* Remember me */}
                        <label className="flex items-center gap-2.5 px-1 cursor-pointer">
                            <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-slate-300 accent-primary"
                            />
                            <span className="text-sm text-slate-600 font-medium select-none">Remember this device</span>
                        </label>

                        {/* Submit */}
                        <motion.button
                            whileHover={{ scale: !loading ? 1.02 : 1 }}
                            whileTap={{ scale: !loading ? 0.98 : 1 }}
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary hover:bg-primary/90 disabled:bg-slate-300 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/25 flex items-center justify-center gap-3 transition-all text-base"
                        >
                            {loading ? (
                                <>
                                    <span className="animate-spin">
                                        <span className="material-symbols-outlined text-xl">hourglass_top</span>
                                    </span>
                                    <span>Signing in...</span>
                                </>
                            ) : (
                                <>
                                    <span>Sign In</span>
                                    <span className="material-symbols-outlined text-xl">login</span>
                                </>
                            )}
                        </motion.button>
                    </motion.form>

                    {/* Security note */}
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                        className="mt-8 p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-3"
                    >
                        <span className="material-symbols-outlined text-primary text-xl mt-0.5">lock</span>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            All sessions are encrypted and protected by role-based access control.
                        </p>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
