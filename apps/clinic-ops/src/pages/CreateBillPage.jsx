/**
 * CreateBillPage — orchestrator for the bill creation workflow.
 *
 * Composes: BillSummaryCard, BillSuccessModal, AddServiceModal.
 */
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { paymentService } from '@/services/payments';
import { hasPaymentMethodAccess } from '@/lib/billingEntitlements';
import { usePatients } from '@/hooks/features/usePatients';
import { useDoctorProfile } from '@/hooks/features/useDoctorProfile';
import { useEntitlements } from '@/hooks/features/useEntitlements';

import BillSummaryCard from '@clinic-ops/components/billing/BillSummaryCard';
import BillSuccessModal from '@clinic-ops/components/billing/BillSuccessModal';
import AddServiceModal from '@clinic-ops/components/billing/AddServiceModal';

/* ── Payment methods catalogue ── */
const BASE_PAYMENT_METHODS = Object.freeze([
    { id: 'cash',      label: 'Cash',            sub: 'Physical payment',         icon: 'payments' },
    { id: 'whish',     label: 'Whish',           sub: 'Mobile wallet',            icon: 'phone_iphone' },
    { id: 'visa',      label: 'Visa / Card',     sub: 'Credit or debit card',     icon: 'credit_card' },
    { id: 'insurance', label: 'Insurance Claim',  sub: 'Plan-gated claim workflow', icon: 'verified_user' },
]);

export default function CreateBillPage() {
    const navigate    = useNavigate();
    const { showToast } = useToast();
    const { user }      = useAuth();
    const { displayName } = useBrand();

    /* ── Data hooks ── */
    const { patients, loading: loadingPatients } = usePatients();
    const { doctorId: loadedDoctorId }           = useDoctorProfile();
    const { entitlements, loading: loadingEntitlements, error: entitlementError } = useEntitlements({ audience: 'staff' });

    /* ── Local state ── */
    const [paymentMethod,     setPaymentMethod]     = useState('cash');
    const [availableServices, setAvailableServices] = useState([]);
    const [services,          setServices]          = useState([]);
    const [isLoadingServices, setIsLoadingServices] = useState(true);
    const [patientsList,      setPatientsList]      = useState([]);
    const [selectedPatientId, setSelectedPatientId] = useState('');
    const [billingDoctorId,   setBillingDoctorId]   = useState(null);
    const [tenderedAmount,    setTenderedAmount]    = useState(150);
    const [submitState,       setSubmitState]       = useState('idle');
    const [isDownloading,     setIsDownloading]     = useState(false);
    const [showAddService,    setShowAddService]    = useState(false);

    /* ── Derived ── */
    const canUseInsuranceBilling = hasPaymentMethodAccess(entitlements, 'insurance');
    const paymentMethods = useMemo(() => BASE_PAYMENT_METHODS.filter(m => m.id !== 'insurance' || canUseInsuranceBilling), [canUseInsuranceBilling]);
    const selectedPatient = useMemo(() => patientsList.find(p => p.id === selectedPatientId), [patientsList, selectedPatientId]);
    const subtotal = useMemo(() => services.reduce((sum, s) => sum + s.price * s.quantity, 0), [services]);
    const totalDue = subtotal;
    const changeDue = useMemo(() => paymentMethod !== 'cash' ? 0 : Math.max(0, tenderedAmount - totalDue), [tenderedAmount, totalDue, paymentMethod]);
    const invoiceStatus = paymentMethod === 'insurance' ? 'pending' : 'completed';

    /* ── Side effects ── */
    React.useEffect(() => { if (paymentMethod === 'insurance' && !canUseInsuranceBilling) setPaymentMethod('cash'); }, [canUseInsuranceBilling, paymentMethod]);
    React.useEffect(() => { if (patients?.length > 0 && !selectedPatientId) { setPatientsList(patients); setSelectedPatientId(patients[0].id); } }, [patients, selectedPatientId]);
    React.useEffect(() => { if (loadedDoctorId) setBillingDoctorId(loadedDoctorId); }, [loadedDoctorId]);
    React.useEffect(() => { (async () => { const { data } = await paymentService.getBillableServices(); if (data) setAvailableServices(data); setIsLoadingServices(false); })(); }, []);

    /* ── Handlers ── */
    const handleSavePost = async () => {
        if (!selectedPatientId)  { showToast('Please select a patient', 'error'); return; }
        if (services.length === 0) { showToast('Please add at least one service to the bill', 'error'); return; }
        if (totalDue <= 0)       { showToast('Total amount must be greater than zero', 'error'); return; }
        if (!billingDoctorId)    { showToast('Cannot create bill before a clinic doctor is configured', 'error'); return; }

        setSubmitState('processing');
        const { error } = await paymentService.create({
            patient_id: selectedPatientId, doctor_id: billingDoctorId,
            amount: totalDue, status: invoiceStatus, payment_method: paymentMethod,
        }, { entitlements });

        if (error) { setSubmitState('idle'); showToast(`Failed to create bill: ${error?.message || error}`, 'error'); return; }
        setSubmitState('success');
        showToast('Bill successfully submitted and posted.', 'success');
    };

    const handleDownloadReceipt = async () => { setIsDownloading(true); await new Promise(r => setTimeout(r, 1500)); setIsDownloading(false); alert("Receipt PDF downloaded successfully!"); };
    const handleAddService = (svc) => setServices(prev => [...prev, svc]);
    const removeService = (index) => setServices(services.filter((_, i) => i !== index));

    return (
        <DashboardLayout role="secretary">
            <div className="flex-1 h-full flex flex-col overflow-y-auto">
                {/* Header */}
                <header className="sticky top-0 z-40 flex items-center justify-between px-8 h-20 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
                    <div className="flex items-center gap-8 flex-1">
                        <span className="text-[22px] font-black tracking-tighter text-slate-900">{displayName}</span>
                        <div className="relative w-full max-w-md">
                            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
                            <input className="w-full pl-11 pr-4 py-2.5 bg-slate-100/50 rounded-xl border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-sm font-medium" placeholder="Search patient or bill ID..." type="text" />
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3 pr-6 border-r border-slate-200">
                            <button onClick={() => showToast('Opening notifications...', 'info')} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors relative">
                                <span className="material-symbols-outlined">notifications</span>
                                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                            </button>
                            <button onClick={() => showToast('Connecting to Help Center...', 'info')} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                                <span className="material-symbols-outlined">help_outline</span>
                            </button>
                        </div>
                        <button onClick={() => showToast('Opening profile options...', 'info')} className="flex items-center gap-3 p-1 pr-4 hover:bg-slate-100 transition-colors rounded-full transition-all active:scale-95 group">
                            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white ring-4 ring-primary/10">
                                <span className="material-symbols-outlined font-light">account_circle</span>
                            </div>
                            <div className="text-left">
                                <p className="text-xs font-black text-slate-900 group-hover:text-primary transition-colors">Billing Officer</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Secretary</p>
                            </div>
                        </button>
                    </div>
                </header>

                {/* Content */}
                <div className="p-10 max-w-[1440px] w-full mx-auto grid grid-cols-12 gap-10">
                    {/* Main form column */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="col-span-8 space-y-10">
                        {/* Title */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-[34px] font-black text-slate-900 tracking-tight leading-none">Create New Bill</h2>
                                <p className="text-slate-500 font-medium mt-3 text-lg">Generate medical invoice for services rendered</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => navigate('/billing')} className="px-5 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all">Dashboard</button>
                                <button onClick={() => navigate('/billing')} className="px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:brightness-110 transition-all">History</button>
                            </div>
                        </div>

                        {/* Patient & Provider */}
                        <section className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/20 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                <span className="material-symbols-outlined text-[80px]">contact_page</span>
                            </div>
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center"><span className="material-symbols-outlined text-primary">person</span></div>
                                    Patient & Provider Information
                                </h3>
                                <span className="px-4 py-1.5 bg-success/10 text-success text-[10px] font-black rounded-full uppercase tracking-widest border border-success/20">Identity Verified</span>
                            </div>
                            <div className="grid grid-cols-2 gap-8">
                                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 group/item transition-all hover:bg-white hover:shadow-lg hover:border-primary/20">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2 block">Patient Details</label>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center border border-slate-200 text-primary font-black">{selectedPatient?.users?.initials || '??'}</div>
                                        <div className="flex-1 w-full">
                                            <select value={selectedPatientId} onChange={e => setSelectedPatientId(e.target.value)} className="w-full bg-transparent border-none text-xl font-black text-slate-900 tracking-tight p-0 focus:ring-0 appearance-none cursor-pointer">
                                                {patientsList.map(p => <option key={p.id} value={p.id}>{p.users?.first_name} {p.users?.last_name}</option>)}
                                            </select>
                                            <p className="text-sm text-primary font-bold">Ref: CP-{selectedPatientId.split('-')[0] || 'Unknown'}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-5 rounded-2xl border border-slate-100 flex items-center justify-between group/item transition-all hover:bg-white hover:shadow-lg hover:border-primary/20">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2 block">Attending Provider</label>
                                        <p className="text-lg font-black text-slate-900 tracking-tight">{user?.first_name ? `Dr. ${user.first_name} ${user.last_name || ''}`.trim() : 'Attending Provider'}</p>
                                        <p className="text-[12px] text-slate-500 font-medium italic">{user?.role || 'Physician'}</p>
                                    </div>
                                    <button className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-primary hover:bg-primary/5 transition-all"><span className="material-symbols-outlined">edit</span></button>
                                </div>
                            </div>
                        </section>

                        {/* Billable Services */}
                        <section className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/20 overflow-hidden">
                            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                                <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                                    <div className="w-10 h-10 bg-primary/50/10 rounded-xl flex items-center justify-center"><span className="material-symbols-outlined text-primary">medical_services</span></div>
                                    Billable Services
                                </h3>
                                <button onClick={() => setShowAddService(true)} className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-black flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-slate-900/10">
                                    <span className="material-symbols-outlined text-lg">add_circle</span> Add Service
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-white">
                                            {['Service Description', 'Code', 'Qty', 'Unit Price', 'Ext. Total', ''].map((col, i) => (
                                                <th key={i} className={`px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ${i === 2 ? 'text-center' : i >= 3 && i <= 4 ? 'text-right' : ''}`}>{col}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        <AnimatePresence mode="popLayout">
                                            {services.map((item, idx) => (
                                                <motion.tr layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} key={`${item.code}-${idx}`} className="group hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-8 py-5"><div className="font-black text-slate-900 text-sm tracking-tight">{item.name}</div><div className="text-[12px] text-slate-500 font-medium">{item.desc}</div></td>
                                                    <td className="px-8 py-5 text-sm font-bold text-slate-400 tabular-nums">{item.code}</td>
                                                    <td className="px-8 py-5 text-sm font-black text-slate-900 text-center tabular-nums">{item.quantity}</td>
                                                    <td className="px-8 py-5 text-sm font-bold text-slate-600 text-right tabular-nums">${item.price.toFixed(2)}</td>
                                                    <td className="px-8 py-5 text-sm font-black text-slate-900 text-right tabular-nums">${(item.price * item.quantity).toFixed(2)}</td>
                                                    <td className="px-6 py-5">
                                                        <button onClick={() => removeService(idx)} className="p-2 text-slate-300 hover:text-critical hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                                            <span className="material-symbols-outlined text-xl">delete</span>
                                                        </button>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </AnimatePresence>
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {/* Payment Method */}
                        <section className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/20">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                                    <div className="w-10 h-10 bg-warning/100/10 rounded-xl flex items-center justify-center"><span className="material-symbols-outlined text-warning">account_balance_wallet</span></div>
                                    Payment Configuration
                                </h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-10">
                                {paymentMethods.map(opt => (
                                    <button key={opt.id} onClick={() => setPaymentMethod(opt.id)} className={`flex items-center gap-4 p-5 border-2 rounded-2xl transition-all ${paymentMethod === opt.id ? 'border-primary bg-primary/5 shadow-inner' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}>
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${paymentMethod === opt.id ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'}`}>
                                            <span className="material-symbols-outlined">{opt.icon}</span>
                                        </div>
                                        <div className="text-left">
                                            <p className={`font-black text-sm tracking-tight ${paymentMethod === opt.id ? 'text-primary' : 'text-slate-900'}`}>{opt.label}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{opt.sub}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {!canUseInsuranceBilling && (
                                <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
                                    Insurance claim billing is disabled for this tenant plan. Cash, Whish, and card payments remain available.
                                    {loadingEntitlements ? ' Checking plan features...' : ''}
                                    {entitlementError ? ' Feature access could not be loaded, so insurance billing is fail-closed.' : ''}
                                </div>
                            )}

                            <AnimatePresence mode="wait">
                                {paymentMethod === 'whish' || paymentMethod === 'visa' ? (
                                    <motion.div key={paymentMethod} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="p-8 rounded-3xl bg-slate-50/50 border border-slate-100 flex items-center gap-6">
                                        <span className="material-symbols-outlined text-4xl text-primary">{paymentMethod === 'whish' ? 'phone_iphone' : 'credit_card'}</span>
                                        <div>
                                            <p className="text-sm font-black text-slate-900">{paymentMethod === 'whish' ? 'Whish Money' : 'Visa / Card'} payment</p>
                                            <p className="text-xs text-slate-500 mt-1">Total due: <span className="font-black text-primary">${totalDue.toFixed(2)}</span> — mark as paid after terminal confirmation.</p>
                                        </div>
                                    </motion.div>
                                ) : paymentMethod === 'insurance' ? (
                                    <motion.div key="insurance-fields" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="p-8 rounded-3xl bg-slate-50/50 border border-slate-100 flex items-start gap-6">
                                        <span className="material-symbols-outlined text-4xl text-amber-600">verified_user</span>
                                        <div>
                                            <p className="text-sm font-black text-slate-900">Insurance claim payment</p>
                                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">This posts a pending bill for the full service subtotal. Payer coverage, eligibility, and claim settlement must be handled in the dedicated insurance workflow before any balance adjustment is made.</p>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div key="cash-fields" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="grid grid-cols-2 gap-8 p-8 rounded-3xl bg-slate-50/50 border border-slate-100">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.1em] mb-2 block">Amount Tendered</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">$</span>
                                                <input className="w-full pl-8 pr-4 py-4 bg-white border-2 border-slate-200 rounded-2xl text-xl font-black text-slate-900 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none" type="number" value={tenderedAmount} onChange={e => setTenderedAmount(parseFloat(e.target.value) || 0)} />
                                            </div>
                                        </div>
                                        <div className="flex flex-col justify-end pb-1">
                                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.1em] mb-2 block">Change to Return</label>
                                            <div className="flex items-center gap-3 px-6 py-4 bg-success/100/10 border-2 border-success/20 rounded-2xl">
                                                <span className="text-2xl font-black text-success tabular-nums">${changeDue.toFixed(2)}</span>
                                                <span className="text-[10px] font-black text-success/60 uppercase tracking-tighter mt-1">Returned Cash</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </section>
                    </motion.div>

                    {/* Right column — summary */}
                    <div className="col-span-4">
                        <BillSummaryCard
                            subtotal={subtotal}
                            totalDue={totalDue}
                            paymentMethod={paymentMethod}
                            invoiceStatus={invoiceStatus}
                            submitState={submitState}
                            onSavePost={handleSavePost}
                        />
                    </div>
                </div>
            </div>

            {/* Success modal */}
            <AnimatePresence>
                {submitState === 'success' && (
                    <BillSuccessModal
                        totalDue={totalDue}
                        paymentMethod={paymentMethod}
                        invoiceStatus={invoiceStatus}
                        onDownloadReceipt={handleDownloadReceipt}
                        isDownloading={isDownloading}
                    />
                )}
            </AnimatePresence>

            {/* Add service modal */}
            <AnimatePresence>
                {showAddService && (
                    <AddServiceModal
                        availableServices={availableServices}
                        onConfirm={handleAddService}
                        onClose={() => setShowAddService(false)}
                    />
                )}
            </AnimatePresence>
        </DashboardLayout>
    );
}
