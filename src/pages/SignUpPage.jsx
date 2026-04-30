import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const SignUpPage = () => {
    const navigate = useNavigate();
    const { signUp } = useAuth();

    const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirm: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [agreed, setAgreed] = useState(false);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const set = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));

    const validate = () => {
        if (!form.firstName.trim() || !form.lastName.trim()) return 'Please enter your full name.';
        if (!form.email.trim()) return 'Email is required.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Please enter a valid email address.';
        if (form.password.length < 8) return 'Password must be at least 8 characters.';
        if (form.password !== form.confirm) return 'Passwords do not match.';
        if (!agreed) return 'You must agree to the Terms of Service.';
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const validationError = validate();
        if (validationError) { setError(validationError); return; }

        setSubmitting(true);
        const { success, error: signUpError } = await signUp(
            form.email.trim(),
            form.password,
            form.firstName.trim(),
            form.lastName.trim()
        );
        setSubmitting(false);

        if (!success) {
            setError(signUpError || 'Failed to create account. Please try again.');
            return;
        }

        navigate('/dashboard');
    };

    const benefits = [
        { icon: 'calendar_month', text: 'Smart appointment scheduling & auto-reminders'  },
        { icon: 'patient_list',   text: 'Secure cloud-based electronic health records'   },
        { icon: 'payments',       text: 'Automated billing & insurance processing'       },
        { icon: 'bar_chart',      text: 'Real-time dashboards & performance insights'    },
        { icon: 'security',       text: 'HIPAA compliant · 256-bit SSL encryption'       },
    ];

    return (
        <div className="flex min-h-screen w-full font-display">

            {/* ─── LEFT PANEL ─── */}
            <div className="hidden lg:flex w-[520px] bg-background-dark flex-col relative overflow-hidden shrink-0">
                <motion.div
                    animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0], borderRadius: ['40%', '50%', '40%'] }}
                    transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                    className="absolute top-[-10%] left-[30%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[90px] pointer-events-none"
                />
                <motion.div
                    animate={{ scale: [1, 1.3, 1], rotate: [0, -90, 0] }}
                    transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
                    className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-primary/10 rounded-full blur-[70px] pointer-events-none"
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
                            The smarter way to <span className="text-primary">run your clinic</span>
                        </h1>
                        <p className="text-slate-400 text-base leading-relaxed">
                            Join over 500 healthcare professionals who trust DoctoLeb for daily operations.
                        </p>
                    </div>
                    <div className="flex-1 flex flex-col gap-5">
                        {benefits.map((b, i) => (
                            <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.08 }} className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-primary text-xl">{b.icon}</span>
                                </div>
                                <p className="text-slate-300 text-sm font-medium">{b.text}</p>
                            </motion.div>
                        ))}
                    </div>
                    <div className="mt-10 pt-8 border-t border-slate-800 grid grid-cols-3 gap-4">
                        {[{ num: '10K+', label: 'Patients' }, { num: '500+', label: 'Clinicians' }, { num: '99.9%', label: 'Uptime' }].map((s, i) => (
                            <div key={i} className="text-center">
                                <p className="text-primary text-xl font-black">{s.num}</p>
                                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ─── RIGHT PANEL ─── */}
            <div className="flex-1 bg-background-light flex flex-col overflow-y-auto">
                <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200">
                    <Link to="/" className="flex lg:hidden items-center gap-2">
                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
                            <span className="material-symbols-outlined text-base">health_metrics</span>
                        </div>
                        <span className="text-slate-900 font-black text-lg">DoctoLeb</span>
                    </Link>
                    <div className="hidden lg:block" />
                    <div className="flex items-center gap-4">
                        <p className="text-sm text-slate-500 hidden sm:block">Already have an account?</p>
                        <Link to="/login" className="px-5 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-bold hover:border-primary hover:text-primary transition-all">
                            Sign In
                        </Link>
                    </div>
                </div>

                <div className="flex-1 flex flex-col justify-center max-w-[520px] w-full mx-auto px-8 py-12">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                            <span className="material-symbols-outlined text-primary text-3xl">person_add</span>
                        </div>
                        <h2 className="text-4xl font-black text-slate-900 mb-2">Create your account</h2>
                        <p className="text-slate-500 text-base">Join DoctoLeb and streamline your clinic today</p>
                    </motion.div>

                    {error && (
                        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                            {error}
                        </motion.div>
                    )}

                    <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="space-y-5" onSubmit={handleSubmit}>
                        {/* Name row */}
                        <div className="flex gap-3">
                            <div className="flex flex-col gap-2 flex-1">
                                <label className="text-slate-700 text-sm font-bold px-1">First Name</label>
                                <input
                                    type="text" required value={form.firstName} onChange={set('firstName')} placeholder="John"
                                    className="w-full px-4 py-4 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-400 text-sm shadow-sm"
                                />
                            </div>
                            <div className="flex flex-col gap-2 flex-1">
                                <label className="text-slate-700 text-sm font-bold px-1">Last Name</label>
                                <input
                                    type="text" required value={form.lastName} onChange={set('lastName')} placeholder="Smith"
                                    className="w-full px-4 py-4 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-400 text-sm shadow-sm"
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div className="flex flex-col gap-2">
                            <label className="text-slate-700 text-sm font-bold px-1">Email Address</label>
                            <div className="relative group">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors text-xl">mail</span>
                                <input
                                    type="email" required value={form.email} onChange={set('email')} placeholder="you@example.com"
                                    className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-400 text-sm shadow-sm"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="flex flex-col gap-2">
                            <label className="text-slate-700 text-sm font-bold px-1">Password</label>
                            <div className="relative group">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors text-xl">lock</span>
                                <input
                                    type={showPassword ? 'text' : 'password'} required minLength={8} value={form.password} onChange={set('password')} placeholder="Min. 8 characters"
                                    className="w-full pl-12 pr-12 py-4 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-400 text-sm shadow-sm"
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                                    <span className="material-symbols-outlined text-xl">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div className="flex flex-col gap-2">
                            <label className="text-slate-700 text-sm font-bold px-1">Confirm Password</label>
                            <div className="relative group">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors text-xl">lock_reset</span>
                                <input
                                    type={showConfirm ? 'text' : 'password'} required value={form.confirm} onChange={set('confirm')} placeholder="Repeat your password"
                                    className="w-full pl-12 pr-12 py-4 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-400 text-sm shadow-sm"
                                />
                                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                                    <span className="material-symbols-outlined text-xl">{showConfirm ? 'visibility_off' : 'visibility'}</span>
                                </button>
                            </div>
                        </div>

                        {/* Terms */}
                        <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl bg-primary/5 border border-primary/20">
                            <input type="checkbox" required checked={agreed} onChange={e => setAgreed(e.target.checked)} className="w-4 h-4 mt-0.5 rounded border-slate-300 accent-primary" />
                            <span className="text-sm text-slate-600 leading-relaxed">
                                I agree to the{' '}<a href="#" className="text-primary font-semibold hover:underline">Terms of Service</a>{' '}and{' '}
                                <a href="#" className="text-primary font-semibold hover:underline">Privacy Policy</a>.
                                My data is protected under HIPAA compliance standards.
                            </span>
                        </label>

                        <motion.button
                            whileHover={{ scale: (agreed && !submitting) ? 1.02 : 1 }}
                            whileTap={{ scale: (agreed && !submitting) ? 0.98 : 1 }}
                            type="submit"
                            disabled={!agreed || submitting}
                            className={`w-full font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-all text-base ${
                                agreed && !submitting ? 'bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                        >
                            {submitting ? (
                                <>
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Creating Account...
                                </>
                            ) : (
                                <>
                                    <span>Create Account</span>
                                    <span className="material-symbols-outlined text-xl">how_to_reg</span>
                                </>
                            )}
                        </motion.button>
                    </motion.form>
                </div>
            </div>
        </div>
    );
};

export default SignUpPage;
