import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { authService } from '@/services/auth';

const ForgotPasswordPage = () => {
    const [email, setEmail] = useState('');
    const [step, setStep] = useState(1);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const fadeUp = {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } }
    };

    const handleSendReset = async (e) => {
        e.preventDefault();
        setError('');
        if (!email.trim()) { setError('Please enter your email address.'); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Please enter a valid email address.'); return; }

        setSubmitting(true);
        const { error: resetError } = await authService.requestPasswordReset(email.trim());
        setSubmitting(false);

        if (resetError) { setError(resetError); return; }
        setStep(2);
    };

    return (
        <div className="flex min-h-screen w-full font-display">
            {/* LEFT PANEL */}
            <div className="hidden lg:flex w-[640px] bg-background-dark flex-col relative overflow-hidden shrink-0">
                <motion.div
                    animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0], borderRadius: ['40%', '50%', '40%'] }}
                    transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                    className="absolute top-[-10%] left-[40%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[80px]"
                />
                <div className="relative z-10 p-16 flex flex-col h-full">
                    <motion.div initial="hidden" animate="visible" variants={fadeUp}>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-primary/20">DL</div>
                            <div>
                                <h1 className="text-white font-black text-4xl tracking-tight">DoctoLeb</h1>
                                <p className="text-slate-400 text-lg mt-1 font-medium">Recovery Portal</p>
                            </div>
                        </div>
                    </motion.div>

                    <div className="flex-1 mt-20">
                        <div className="space-y-4 relative">
                            <div className="absolute left-[17px] top-8 bottom-8 w-0.5 bg-primary/30 z-0" />
                            {[
                                { num: 1, text: 'Enter your email' },
                                { num: 2, text: 'Check your inbox' },
                                { num: 3, text: 'Click the reset link' },
                            ].map((s, idx) => (
                                <motion.div key={s.num} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + idx * 0.1 }} className="flex items-center gap-6 relative z-10">
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${step >= s.num ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                                        {step > s.num ? <span className="material-symbols-outlined text-sm">check</span> : s.num}
                                    </div>
                                    <span className={`text-lg font-medium transition-colors ${step >= s.num ? 'text-slate-200' : 'text-slate-600'}`}>{s.text}</span>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="mt-auto pt-8">
                        <Link to="/login" className="text-sm font-semibold text-primary hover:text-white transition-colors flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">arrow_back</span>
                            Back to Login
                        </Link>
                    </motion.div>
                </div>
            </div>

            {/* RIGHT PANEL */}
            <div className="flex-1 bg-background-light flex flex-col relative overflow-y-auto">
                <div className="flex-1 flex flex-col justify-center max-w-[580px] w-full mx-auto px-6 py-12 xs:px-10">

                    <motion.div initial="hidden" animate="visible" variants={fadeUp} className="mb-10">
                        <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-2">Reset Password</h2>
                        <p className="text-slate-500 text-base">Enter your registered email and we'll send a recovery link.</p>
                    </motion.div>

                    <div className="space-y-6">
                        {/* Step 1 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                            className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${step === 1 ? 'border-primary/40 shadow-lg shadow-primary/5' : 'border-slate-200 opacity-60'}`}
                        >
                            <div className={`px-6 py-4 border-b ${step === 1 ? 'bg-primary/5 border-primary/20' : 'bg-slate-50 border-slate-200'}`}>
                                <h3 className={`text-sm font-bold ${step === 1 ? 'text-primary' : 'text-slate-500'}`}>Step 1 of 3 — Email Verification</h3>
                            </div>
                            <div className="p-6">
                                {error && (
                                    <p className="mb-4 text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
                                )}
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 pl-1">Your Email Address</label>
                                <form onSubmit={handleSendReset} className="flex flex-col gap-4">
                                    <input
                                        type="email" required disabled={step > 1}
                                        value={email} onChange={e => setEmail(e.target.value)}
                                        placeholder="doctor@clinicflow.com"
                                        className="w-full bg-white border border-slate-200 text-slate-900 text-sm rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:bg-slate-50 disabled:text-slate-400"
                                    />
                                    {step === 1 && (
                                        <motion.button
                                            whileHover={{ scale: submitting ? 1 : 1.02 }} whileTap={{ scale: submitting ? 1 : 0.98 }}
                                            type="submit" disabled={submitting}
                                            className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-base rounded-xl py-3.5 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                        >
                                            {submitting ? (
                                                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending...</>
                                            ) : (
                                                <>Send Reset Link <span className="material-symbols-outlined text-sm">send</span></>
                                            )}
                                        </motion.button>
                                    )}
                                </form>
                            </div>
                        </motion.div>

                        {/* Step 2 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                            className={`bg-white rounded-2xl border transition-all duration-300 p-6 ${step === 2 ? 'border-primary/40 shadow-lg shadow-primary/5' : 'border-slate-200 opacity-60 bg-slate-50/50'}`}
                        >
                            <h3 className={`text-sm font-bold mb-2 ${step >= 2 ? 'text-slate-900' : 'text-slate-500'}`}>Step 2 — Check your email</h3>
                            {step === 2 ? (
                                <div className="flex flex-col gap-3">
                                    <p className="text-sm text-slate-600">A password reset link has been sent to <span className="font-semibold text-slate-900">{email}</span>. Please check your inbox and spam folder.</p>
                                    <button onClick={() => { setStep(1); setEmail(''); }} className="text-xs text-slate-400 hover:text-slate-600 transition-colors self-start">
                                        Didn't receive it? Try again
                                    </button>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500">A link will be sent to your inbox. Check spam if you don't see it.</p>
                            )}
                        </motion.div>

                        {/* Step 3 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                            className={`bg-white rounded-2xl border transition-all duration-300 p-6 border-slate-200 ${step < 2 ? 'opacity-60 bg-slate-50/50' : ''}`}
                        >
                            <h3 className={`text-sm font-bold mb-2 ${step >= 2 ? 'text-slate-900' : 'text-slate-500'}`}>Step 3 — Click the reset link</h3>
                            <p className="text-sm text-slate-500">Click the link in your email to set a new secure password. The link expires in 1 hour.</p>
                        </motion.div>
                    </div>

                    <div className="mt-8 flex justify-between items-center lg:hidden">
                        <Link to="/login" className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">arrow_back</span>
                            Back to Login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;
