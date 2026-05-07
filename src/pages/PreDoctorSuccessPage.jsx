import React from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';

export default function PreDoctorSuccessPage() {
    const navigate = useNavigate();
    const { state } = useLocation();
    const patient = state?.patient || { name: 'Patient', id: 'N/A' };

    return (
        <DashboardLayout role="pre_doctor">
            <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30 flex items-center justify-between w-full px-6 h-16">
                    <div className="flex items-center gap-8">
                        <div className="uppercase text-xl font-black tracking-tighter text-slate-900">DoctoLeb</div>
                        <div className="relative hidden md:block">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                            <input className="bg-slate-50 border-none rounded-xl pl-10 pr-4 py-2 text-sm w-64 focus:ring-2 focus:ring-primary focus:bg-white transition-all" placeholder="Search patient or ID..." type="text"/>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-primary/5 text-slate-500 transition-colors">
                            <span className="material-symbols-outlined">notifications</span>
                        </button>
                        <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-primary/5 text-slate-500 transition-colors">
                            <span className="material-symbols-outlined">help_outline</span>
                        </button>
                        <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>
                        <div className="flex items-center gap-3 cursor-pointer group">
                            <div className="text-right hidden sm:block">
                                <p className="text-xs font-bold text-slate-900 leading-none">Pre-Doctor Staff</p>
                                <p className="text-[10px] text-slate-500 font-medium">Assessment Complete</p>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                ✔
                            </div>
                        </div>
                    </div>
                </header>

                <div className="p-8 max-w-4xl mx-auto w-full flex flex-col items-center justify-center min-h-[calc(100vh-64px)]">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, type: 'spring' }}
                        className="flex flex-col items-center text-center mb-10"
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
                            className="w-24 h-24 bg-success/10 text-success rounded-full flex items-center justify-center mb-8 shadow-sm border border-success/20"
                        >
                            <span className="material-symbols-outlined text-6xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        </motion.div>
                        <h2 className="text-[42px] font-black tracking-tight text-slate-900 mb-4 uppercase leading-tight">Submission Successful</h2>
                        <p className="text-slate-500 font-medium text-lg max-w-xl">The clinical assessment records for this patient have been successfully synchronized with the central medical system.</p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-12 flex items-center gap-5"
                    >
                        <div className="w-16 h-16 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-xl font-bold">
                            {patient.name.charAt(0)}
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-900 leading-tight">{patient.name}</h3>
                            <p className="text-sm font-bold text-primary uppercase tracking-widest mt-1">ID: {patient.id.split('-')[0]}</p>
                        </div>
                        <div className="ml-auto flex items-center gap-1.5 px-3 py-1 bg-success/10 text-success rounded-full">
                            <div className="w-1.5 h-1.5 rounded-full bg-success/100"></div>
                            <span className="text-[10px] font-black uppercase">Synced</span>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full"
                    >
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => navigate('/predoctor-dashboard')}
                            className="w-full sm:w-auto px-8 py-4 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-lg">dashboard</span>
                            Return to Dashboard
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => window.print()}
                            className="w-full sm:w-auto px-8 py-4 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-lg">print</span>
                            Print Summary
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => navigate('/predoctor-new-check')}
                            className="w-full sm:w-auto px-8 py-4 bg-white text-primary border border-primary/20 rounded-xl font-bold text-sm hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-lg">arrow_forward</span>
                            View Next Patient
                        </motion.button>
                    </motion.div>
                </div>
            </div>
        </DashboardLayout>
    );
}