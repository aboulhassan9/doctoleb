import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { patientService } from '../services/patients';
import { paymentService } from '../services/payments';

/* ─────────────────────────────────────────────────────────
   Create Bill Page
───────────────────────────────────────────────────────── */

export default function CreateBillPage() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { user } = useAuth();
    
    // ─── STATE ──────────────────────────────────────────────────
    const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'whish' | 'visa' | 'insurance'
    const [availableServices, setAvailableServices] = useState([]);
    const [services, setServices] = useState([]);
    const [isLoadingServices, setIsLoadingServices] = useState(true);
    
    const [patientsList, setPatientsList] = useState([]);
    const [selectedPatientId, setSelectedPatientId] = useState('');

    React.useEffect(() => {
        const fetchPatients = async () => {
            const { data } = await patientService.getAll();
            if (data) {
                setPatientsList(data);
                if (data.length > 0) setSelectedPatientId(data[0].id);
            }
        };
        const fetchServices = async () => {
            const { data } = await paymentService.getBillableServices();
            if (data) {
                setAvailableServices(data);
            }
            setIsLoadingServices(false);
        };
        fetchPatients();
        fetchServices();
    }, []);

    const selectedPatient = useMemo(() => {
        return patientsList.find(p => p.id === selectedPatientId);
    }, [patientsList, selectedPatientId]);
    
    // Insurance specific fields
    const [insurance, setInsurance] = useState({
        provider: 'BlueCross BlueShield',
        policyId: 'BCBS-99887766',
        copay: 20
    });

    // Cash specific fields
    const [tenderedAmount, setTenderedAmount] = useState(150);

    // ─── CALCULATIONS ───────────────────────────────────────────
    const subtotal = useMemo(() => {
        return services.reduce((sum, s) => sum + (s.price * s.quantity), 0);
    }, [services]);

    const insuranceCoverage = useMemo(() => {
        if (paymentMethod !== 'insurance') return 0;
        // Mock coverage: Total - copay (simplified for demo)
        return Math.max(0, subtotal - insurance.copay);
    }, [subtotal, paymentMethod, insurance.copay]);

    const totalDue = useMemo(() => {
        if (paymentMethod === 'insurance') return insurance.copay;
        return subtotal;
    }, [subtotal, paymentMethod, insurance.copay]);

    const changeDue = useMemo(() => {
        if (paymentMethod !== 'cash') return 0;
        return Math.max(0, tenderedAmount - totalDue);
    }, [tenderedAmount, totalDue, paymentMethod]);

    // ─── BILL SUBMISSION STATE ────────────────────────────────
    const [submitState, setSubmitState] = useState('idle'); // 'idle' | 'processing' | 'success'
    const [isDownloading, setIsDownloading] = useState(false);

    const handleSavePost = async () => {
        if (!selectedPatientId) {
            showToast('Please select a patient', 'error');
            return;
        }

        if (services.length === 0) {
            showToast('Please add at least one service to the bill', 'error');
            return;
        }

        if (totalDue <= 0) {
            showToast('Total amount must be greater than zero', 'error');
            return;
        }
        
        setSubmitState('processing');
        
        const invoiceData = {
            patient_id: selectedPatientId,
            amount: totalDue,
            status: ['cash', 'whish', 'visa'].includes(paymentMethod) ? 'Paid' : 'Pending',
            payment_method: paymentMethod,
            insurance_provider: paymentMethod === 'insurance' ? insurance.provider : null,
            insurance_policy_id: paymentMethod === 'insurance' ? insurance.policyId : null,
            insurance_copay: paymentMethod === 'insurance' ? insurance.copay : null,
            line_items: services.map(s => ({ name: s.name, quantity: s.quantity, unit_price: s.price })),
        };
        
        const { error } = await paymentService.create(invoiceData);
        
        if (error) {
            setSubmitState('idle');
            showToast('Failed to create bill: ' + error.message, 'error');
            return;
        }

        setSubmitState('success');
        showToast('Bill successfully submitted and posted.', 'success');
    };

    const handleDownloadReceipt = async () => {
        setIsDownloading(true);
        await new Promise(r => setTimeout(r, 1500)); // Simulate PDF generation
        setIsDownloading(false);
        alert("Receipt PDF downloaded successfully!");
    };

    // ─── ADD SERVICE MODAL STATE ──────────────────────────────
    const [showAddService,  setShowAddService]  = useState(false);
    const [modalServiceIdx, setModalServiceIdx] = useState(0);
    const [modalQty,        setModalQty]        = useState(1);

    const openAddModal = () => {
        setModalServiceIdx(0);
        setModalQty(1);
        setShowAddService(true);
    };

    const handleConfirmService = () => {
        const svc = availableServices[modalServiceIdx];
        if (svc) {
            setServices(prev => [...prev, { 
                name: svc.name, 
                code: svc.code, 
                price: parseFloat(svc.price), 
                desc: svc.description,
                quantity: modalQty 
            }]);
        }
        setShowAddService(false);
    };

    const removeService = (index) => {
        setServices(services.filter((_, i) => i !== index));
    };

    return (
        <div className="flex h-screen bg-background font-body text-on-background antialiased overflow-hidden">
            <Sidebar />

            <main className="flex-1 h-full flex flex-col overflow-y-auto">
                {/* Header (Matching existing design tokens) */}
                <header className="sticky top-0 z-40 flex items-center justify-between px-8 h-20 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
                    <div className="flex items-center gap-8 flex-1">
                        <span className="text-[22px] font-black tracking-tighter text-slate-900">DoctoLeb</span>
                        <div className="relative w-full max-w-md">
                            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
                            <input 
                                className="w-full pl-11 pr-4 py-2.5 bg-slate-100/50 rounded-xl border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-sm font-medium" 
                                placeholder="Search patient or bill ID..." type="text"
                            />
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3 pr-6 border-r border-slate-200">
                            <button 
                                onClick={() => showToast('Opening notifications...', 'info')}
                                className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors relative"
                            >
                                <span className="material-symbols-outlined">notifications</span>
                                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                            </button>
                            <button 
                                onClick={() => showToast('Connecting to Help Center...', 'info')}
                                className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <span className="material-symbols-outlined">help_outline</span>
                            </button>
                        </div>
                        <button 
                            onClick={() => showToast('Opening profile options...', 'info')}
                            className="flex items-center gap-3 p-1 pr-4 hover:bg-slate-100 transition-colors rounded-full transition-all active:scale-95 group"
                        >
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

                {/* Content Area */}
                <div className="p-10 max-w-[1440px] w-full mx-auto grid grid-cols-12 gap-10">
                    
                    {/* Main Form (Bento Style) */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className="col-span-8 space-y-10"
                    >
                        {/* Page Title */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-[34px] font-black text-slate-900 tracking-tight leading-none">Create New Bill</h2>
                                <p className="text-slate-500 font-medium mt-3 text-lg">Generate medical invoice for services rendered</p>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => navigate('/billing')}
                                    className="px-5 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all"
                                >
                                    Dashboard
                                </button>
                                <button 
                                    onClick={() => navigate('/billing')}
                                    className="px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:brightness-110 transition-all"
                                >
                                    History
                                </button>
                            </div>
                        </div>

                        {/* Patient & Provider Info */}
                        <section className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/20 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                <span className="material-symbols-outlined text-[80px]">contact_page</span>
                            </div>
                            
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                                        <span className="material-symbols-outlined text-primary">person</span>
                                    </div>
                                    Patient & Provider Information
                                </h3>
                                <span className="px-4 py-1.5 bg-success/10 text-success text-[10px] font-black rounded-full uppercase tracking-widest border border-success/20">
                                    Identity Verified
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-8">
                                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 group/item transition-all hover:bg-white hover:shadow-lg hover:border-primary/20">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2 block">Patient Details</label>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center border border-slate-200 text-primary font-black">
                                            {selectedPatient?.users?.initials || '??'}
                                        </div>
                                        <div className="flex-1 w-full">
                                            <select 
                                                value={selectedPatientId} 
                                                onChange={e => setSelectedPatientId(e.target.value)}
                                                className="w-full bg-transparent border-none text-xl font-black text-slate-900 tracking-tight p-0 focus:ring-0 appearance-none cursor-pointer"
                                            >
                                                {patientsList.map(p => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.users?.first_name} {p.users?.last_name}
                                                    </option>
                                                ))}
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
                                    <button className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-primary hover:bg-primary/5 transition-all">
                                        <span className="material-symbols-outlined">edit</span>
                                    </button>
                                </div>
                            </div>
                        </section>

                        {/* Billable Services */}
                        <section className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/20 overflow-hidden">
                            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                                <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                                    <div className="w-10 h-10 bg-primary/50/10 rounded-xl flex items-center justify-center">
                                        <span className="material-symbols-outlined text-primary">medical_services</span>
                                    </div>
                                    Billable Services
                                </h3>
                                <button 
                                    onClick={openAddModal}
                                    className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-black flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-slate-900/10"
                                >
                                    <span className="material-symbols-outlined text-lg">add_circle</span> 
                                    Add Service
                                </button>
                            </div>
                            
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-white">
                                            <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Service Description</th>
                                            <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Code</th>
                                            <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] text-center">Qty</th>
                                            <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] text-right">Unit Price</th>
                                            <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] text-right">Ext. Total</th>
                                            <th className="px-6 py-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        <AnimatePresence mode="popLayout">
                                            {services.map((item, idx) => (
                                                <motion.tr 
                                                    layout
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: 20 }}
                                                    key={`${item.code}-${idx}`}
                                                    className="group hover:bg-slate-50/50 transition-colors"
                                                >
                                                    <td className="px-8 py-5">
                                                        <div className="font-black text-slate-900 text-sm tracking-tight">{item.name}</div>
                                                        <div className="text-[12px] text-slate-500 font-medium">{item.desc}</div>
                                                    </td>
                                                    <td className="px-8 py-5 text-sm font-bold text-slate-400 tabular-nums">{item.code}</td>
                                                    <td className="px-8 py-5 text-sm font-black text-slate-900 text-center tabular-nums">{item.quantity}</td>
                                                    <td className="px-8 py-5 text-sm font-bold text-slate-600 text-right tabular-nums">${item.price.toFixed(2)}</td>
                                                    <td className="px-8 py-5 text-sm font-black text-slate-900 text-right tabular-nums">${(item.price * item.quantity).toFixed(2)}</td>
                                                    <td className="px-6 py-5">
                                                        <button 
                                                            onClick={() => removeService(idx)}
                                                            className="p-2 text-slate-300 hover:text-critical hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                        >
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

                        {/* Payment Method Section */}
                        <section className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/20">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                                    <div className="w-10 h-10 bg-warning/100/10 rounded-xl flex items-center justify-center">
                                        <span className="material-symbols-outlined text-warning">account_balance_wallet</span>
                                    </div>
                                    Payment Configuration
                                </h3>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-10">
                                {[
                                    { id: 'cash', label: 'Cash', sub: 'Physical payment', icon: 'payments' },
                                    { id: 'whish', label: 'Whish', sub: 'Mobile wallet', icon: 'phone_iphone' },
                                    { id: 'visa', label: 'Visa / Card', sub: 'Credit or debit card', icon: 'credit_card' },
                                    { id: 'insurance', label: 'Insurance Claim', sub: 'Third-party coverage', icon: 'verified_user' },
                                ].map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setPaymentMethod(opt.id)}
                                        className={`flex items-center gap-4 p-5 border-2 rounded-2xl transition-all ${
                                            paymentMethod === opt.id
                                                ? 'border-primary bg-primary/5 shadow-inner'
                                                : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                                            paymentMethod === opt.id ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'
                                        }`}>
                                            <span className="material-symbols-outlined">{opt.icon}</span>
                                        </div>
                                        <div className="text-left">
                                            <p className={`font-black text-sm tracking-tight ${paymentMethod === opt.id ? 'text-primary' : 'text-slate-900'}`}>{opt.label}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{opt.sub}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Contextual Fields */}
                            <AnimatePresence mode="wait">
                                {paymentMethod === 'whish' || paymentMethod === 'visa' ? (
                                    <motion.div
                                        key={paymentMethod}
                                        initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
                                        className="p-8 rounded-3xl bg-slate-50/50 border border-slate-100 flex items-center gap-6"
                                    >
                                        <span className="material-symbols-outlined text-4xl text-primary">{paymentMethod === 'whish' ? 'phone_iphone' : 'credit_card'}</span>
                                        <div>
                                            <p className="text-sm font-black text-slate-900">{paymentMethod === 'whish' ? 'Whish Money' : 'Visa / Card'} payment</p>
                                            <p className="text-xs text-slate-500 mt-1">Total due: <span className="font-black text-primary">${totalDue.toFixed(2)}</span> — mark as paid after terminal confirmation.</p>
                                        </div>
                                    </motion.div>
                                ) : paymentMethod === 'insurance' ? (
                                    <motion.div 
                                        key="insurance-fields"
                                        initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
                                        className="grid grid-cols-2 gap-8 p-8 rounded-3xl bg-slate-50/50 border border-slate-100"
                                    >
                                        <div className="space-y-6">
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.1em] mb-2 block">Insurance Provider</label>
                                                <input 
                                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-black focus:ring-4 focus:ring-primary/10 transition-all outline-none" 
                                                    type="text" value={insurance.provider}
                                                    onChange={e => setInsurance({...insurance, provider: e.target.value})}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.1em] mb-2 block">Policy / Member ID</label>
                                                <input 
                                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-black focus:ring-4 focus:ring-primary/10 transition-all outline-none" 
                                                    type="text" value={insurance.policyId}
                                                    onChange={e => setInsurance({...insurance, policyId: e.target.value})}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-6">
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.1em] mb-2 block">Verification Status</label>
                                                <div className="flex items-center gap-3 px-4 py-3 bg-success/10 border border-success/20 rounded-xl">
                                                    <span className="material-symbols-outlined text-success text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                                    <span className="text-sm font-black text-success tracking-tight">Eligibility Active</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.1em] mb-2 block">Patient Co-pay (USD)</label>
                                                <div className="relative">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">$</span>
                                                    <input 
                                                        className="w-full pl-8 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:ring-4 focus:ring-primary/10 transition-all outline-none" 
                                                        type="number" value={insurance.copay}
                                                        onChange={e => setInsurance({...insurance, copay: parseFloat(e.target.value) || 0})}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div 
                                        key="cash-fields"
                                        initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
                                        className="grid grid-cols-2 gap-8 p-8 rounded-3xl bg-slate-50/50 border border-slate-100"
                                    >
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.1em] mb-2 block">Amount Tendered</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">$</span>
                                                <input 
                                                    className="w-full pl-8 pr-4 py-4 bg-white border-2 border-slate-200 rounded-2xl text-xl font-black text-slate-900 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none" 
                                                    type="number" value={tenderedAmount}
                                                    onChange={e => setTenderedAmount(parseFloat(e.target.value) || 0)}
                                                />
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

                    {/* Right Column: Sticky Summary */}
                    <div className="col-span-4">
                        <div className="sticky top-28 space-y-8">
                            
                            {/* Detailed Summary Card */}
                            <section className="bg-white border-2 border-slate-200 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-slate-200/50 transform transition-transform hover:scale-[1.01]">
                                <div className="p-8 bg-slate-900 text-white relative overflow-hidden">
                                    <div className="absolute top--10 right--10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                                    <div className="relative z-10">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-xl font-black tracking-tight">Payment Summary</h3>
                                            <div className="px-3 py-1 bg-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest border border-white/10">In Draft</div>
                                        </div>
                                        <p className="text-slate-400 text-xs font-bold font-mono">INV-{(new Date().getFullYear())}-8842X</p>
                                    </div>
                                </div>
                                
                                <div className="p-8 space-y-5">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Gross Subtotal</span>
                                        <span className="font-black text-slate-900 tabular-nums">${subtotal.toFixed(2)}</span>
                                    </div>
                                    
                                    {paymentMethod === 'insurance' ? (
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-success font-bold uppercase tracking-widest text-[10px]">Insurance Coverage</span>
                                            <span className="font-black text-success tabular-nums">-${insuranceCoverage.toFixed(2)}</span>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Sales Tax (Exempt)</span>
                                            <span className="font-black text-slate-900 tabular-nums">$0.00</span>
                                        </div>
                                    )}

                                    <div className="pt-6 border-t-2 border-slate-100 border-dashed">
                                        <div className="flex justify-between items-end mb-4">
                                            <div>
                                                <span className="text-slate-900 font-black text-lg block leading-none mb-1">Total Due</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Wait for processing</span>
                                            </div>
                                            <div className="text-right">
                                                <motion.span 
                                                    key={totalDue}
                                                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                                                    className="text-[42px] font-black text-primary leading-none tracking-tighter tabular-nums block"
                                                >
                                                    ${totalDue.toFixed(2)}
                                                </motion.span>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1 mr-1 text-right">USD</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="px-8 py-5 bg-primary/5 flex items-start gap-4 border-t border-slate-100">
                                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
                                    </div>
                                    <p className="text-[11px] text-slate-600 font-bold leading-relaxed">
                                        {paymentMethod === 'insurance' 
                                            ? "Patient is responsible for co-payment. Remaining balance will be processed directly with the provider."
                                            : "Verify physical cash or electronic proof of payment before finalizing this transaction."}
                                    </p>
                                </div>
                            </section>

                            {/* Action Stack */}
                            <div className="flex flex-col gap-4">
                                <button 
                                    onClick={handleSavePost}
                                    disabled={submitState === 'processing'}
                                    className="w-full py-5 bg-primary text-white rounded-[1.5rem] font-black text-lg shadow-2xl shadow-primary/30 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3 group disabled:opacity-80 disabled:cursor-wait"
                                >
                                    {submitState === 'processing' ? (
                                        <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="material-symbols-outlined text-2xl">
                                            progress_activity
                                        </motion.span>
                                    ) : (
                                        <span className="material-symbols-outlined text-2xl group-hover:animate-bounce">cloud_upload</span>
                                    )}
                                    {submitState === 'processing' ? 'Processing Transaction...' : 'Save & Post Bill'}
                                </button>
                                
                                <button className="w-full py-5 bg-white border-2 border-slate-200 text-slate-700 rounded-[1.5rem] font-black text-lg hover:bg-slate-50 active:scale-[0.98] transition-all flex items-center justify-center gap-3">
                                    <span className="material-symbols-outlined text-2xl">print</span>
                                    Save & Print Receipt
                                </button>
                                
                                <button 
                                    onClick={() => navigate('/billing')}
                                    className="w-full py-4 text-slate-400 font-black text-xs hover:text-critical hover:bg-red-50 rounded-xl transition-all uppercase tracking-[0.2em] flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-lg">cancel</span>
                                    Cancel Transaction
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* ── Success Modal overlay ──────────────────────────── */}
            <AnimatePresence>
                {submitState === 'success' && (
                    <motion.div
                        key="success-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
                    >
                        <motion.div
                            key="success-card"
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                            className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden flex flex-col items-center p-8 border border-white/20 relative"
                        >
                            {/* Confetti-like decor */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/10 rounded-full blur-xl pointer-events-none" />

                            <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/10 relative z-10">
                                <span className="material-symbols-outlined text-5xl text-success" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                            </div>
                            
                            <h2 className="text-2xl font-black text-slate-900 mb-2 relative z-10">Payment Posted!</h2>
                            <p className="text-slate-500 text-center font-medium mb-8 relative z-10">
                                Invoice <span className="font-bold text-slate-700">#INV-8842X</span> has been successfully generated and recorded.
                            </p>

                            <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 mb-8 relative z-10">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Amount</span>
                                    <span className="text-lg font-black text-slate-900">${totalDue.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center pb-4 border-b border-slate-200/60">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Method</span>
                                    <span className="text-sm font-bold text-slate-900 capitalize">{paymentMethod}</span>
                                </div>
                                <div className="flex justify-between items-center pt-4">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Status</span>
                                    <span className="px-2.5 py-1 bg-success/10 text-success rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm">Paid In Full</span>
                                </div>
                            </div>

                            <div className="w-full flex gap-3 relative z-10">
                                <button 
                                    onClick={handleDownloadReceipt}
                                    disabled={isDownloading}
                                    className="flex-1 py-3.5 bg-slate-900 text-white rounded-xl text-sm font-black shadow-lg shadow-slate-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait"
                                >
                                    <motion.span 
                                        animate={isDownloading ? { rotate: 360 } : {}}
                                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                        className="material-symbols-outlined text-[18px]"
                                    >
                                        {isDownloading ? 'progress_activity' : 'file_download'}
                                    </motion.span>
                                    {isDownloading ? 'Generating...' : 'Receipt'}
                                </button>
                                <button 
                                    onClick={() => navigate('/billing')}
                                    className="flex-[1.5] flex items-center justify-center gap-2 bg-primary text-white py-3.5 rounded-xl text-sm font-black shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                >
                                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                                    Return to Billing
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Add Service Modal ──────────────────────────── */}
            <AnimatePresence>
                {showAddService && (() => {
                    const svc        = availableServices[modalServiceIdx];
                    const lineTotal  = svc ? parseFloat(svc.price) * modalQty : 0;

                    return (
                        <motion.div
                            key="modal-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
                            onClick={() => setShowAddService(false)}
                        >
                            <motion.div
                                key="modal-card"
                                initial={{ scale: 0.92, opacity: 0, y: 24 }}
                                animate={{ scale: 1,    opacity: 1, y: 0  }}
                                exit={{    scale: 0.92, opacity: 0, y: 24 }}
                                transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                                className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-white overflow-hidden"
                                onClick={e => e.stopPropagation()}
                            >
                                {/* Modal Header */}
                                <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between">
                                    <div>
                                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Add Service</h2>
                                        <p className="text-xs font-medium text-slate-500 mt-0.5">Bill a procedure or test to this patient</p>
                                    </div>
                                    <button
                                        onClick={() => setShowAddService(false)}
                                        className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors mt-0.5"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">close</span>
                                    </button>
                                </div>

                                {/* Modal Body */}
                                <div className="p-6 space-y-5">

                                    {/* Service Selector */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Select Service</label>
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px] pointer-events-none">search</span>
                                            <select
                                                value={modalServiceIdx}
                                                onChange={e => setModalServiceIdx(Number(e.target.value))}
                                                className="w-full pl-10 pr-10 py-3 bg-slate-100 border-none rounded-xl text-sm font-semibold text-slate-900 appearance-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                                            >
                                                {availableServices.length === 0 && <option value={0}>Loading services...</option>}
                                                {availableServices.map((s, i) => (
                                                    <option key={s.code} value={i}>{s.name} - ${parseFloat(s.price).toFixed(2)}</option>
                                                ))}
                                            </select>
                                            <span className="material-symbols-outlined absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px] pointer-events-none">expand_more</span>
                                        </div>
                                    </div>

                                    {/* Price + Quantity */}
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Unit Price (read-only) */}
                                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Unit Price</p>
                                            <motion.div
                                                key={svc?.price || 0}
                                                initial={{ opacity: 0, y: -6 }}
                                                animate={{ opacity: 1, y: 0  }}
                                                className="flex items-baseline gap-1"
                                            >
                                                <span className="text-slate-400 font-bold text-sm">$</span>
                                                <span className="text-xl font-black text-slate-900">{svc ? parseFloat(svc.price).toFixed(2) : '0.00'}</span>
                                            </motion.div>
                                        </div>

                                        {/* Quantity Stepper */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Quantity</label>
                                            <div className="flex items-center bg-slate-100 rounded-xl overflow-hidden">
                                                <button
                                                    onClick={() => setModalQty(q => Math.max(1, q - 1))}
                                                    className="w-10 h-10 flex items-center justify-center hover:bg-slate-200 text-slate-600 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">remove</span>
                                                </button>
                                                <input
                                                    type="number" min="1"
                                                    value={modalQty}
                                                    onChange={e => setModalQty(Math.max(1, parseInt(e.target.value) || 1))}
                                                    className="w-full bg-transparent border-none text-center font-black text-slate-900 focus:ring-0 p-0 text-sm"
                                                />
                                                <button
                                                    onClick={() => setModalQty(q => q + 1)}
                                                    className="w-10 h-10 flex items-center justify-center hover:bg-slate-200 text-slate-600 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">add</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Live Total */}
                                    <motion.div
                                        key={lineTotal}
                                        initial={{ scale: 0.97 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                                        className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-primary">
                                                <span className="material-symbols-outlined text-[18px]">payments</span>
                                            </div>
                                            <p className="text-xs font-bold text-blue-900 uppercase tracking-wide">Total Cost</p>
                                        </div>
                                        <p className="text-2xl font-black text-primary">${lineTotal.toFixed(2)}</p>
                                    </motion.div>
                                </div>

                                {/* Modal Footer */}
                                <div className="px-6 py-5 bg-slate-50 border-t border-slate-100 flex gap-3">
                                    <button
                                        onClick={() => setShowAddService(false)}
                                        className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-100 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleConfirmService}
                                        className="flex-[1.5] px-4 py-3 bg-primary text-white font-black rounded-xl text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                        Add Service
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    );
                })()}
            </AnimatePresence>
        </div>
    );
}
