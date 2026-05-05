import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import CountUp from '../components/CountUp';
import { useToast } from '../contexts/ToastContext';

import { paymentService } from '../services/payments';

/* ─────────────────────────────────────────────────────────
   Main BillingPage Component
───────────────────────────────────────────────────────── */
export default function BillingPage() {
    const navigate = useNavigate();
    const [search, setSearch]       = useState('');
    const [invoices, setInvoices]   = useState([]);
    const [stats, setStats]         = useState([
        { label: 'Total Invoices', value: 0, icon: 'description', badge: 'Active system records', badgeCls: 'text-success bg-success/10' },
        { label: 'Total Revenue', value: 0, icon: 'payments', badge: 'Lifetime Collected', badgeCls: 'text-primary bg-primary/5' },
        { label: 'Unpaid Balance', value: 0, icon: 'account_balance_wallet', badge: '0 overdue invoices', badgeCls: 'text-critical bg-red-50' }
    ]);
    const [activity, setActivity]   = useState([]);
    const [barData, setBarData]     = useState([]);
    const [filter, setFilter]       = useState('All');
    const [loading, setLoading]     = useState(true);

    useEffect(() => {
        const fetchPayments = async () => {
            setLoading(true);
            const { data } = await paymentService.getAll();
            if (data) {
                const formatted = data.map(p => {
                    const fname = p.patients?.users?.first_name || 'Unknown';
                    const lname = p.patients?.users?.last_name || 'Patient';
                    const canonicalStatus = (p.status || 'pending').toLowerCase();
                    const displayStatus = canonicalStatus === 'completed'
                        ? 'Paid'
                        : canonicalStatus.charAt(0).toUpperCase() + canonicalStatus.slice(1);
                    const sCls = canonicalStatus === 'completed' ? 'bg-success/10 text-success' : canonicalStatus === 'pending' ? 'bg-warning/10 text-warning' : 'bg-error-container text-on-error-container';
                    return {
                        id: `#INV-${p.id.split('-')[0].toUpperCase()}`,
                        dbId: p.id,
                        patient: `${fname} ${lname}`,
                        initials: `${fname[0]||''}${lname[0]||''}`.toUpperCase(),
                        date: new Date(p.created_at || new Date()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                        amount: parseFloat(p.amount) || 0,
                        status: displayStatus,
                        statusCls: sCls
                    };
                });
                setInvoices(formatted);

                const totalInvoices = formatted.length;
                const totalRevenue = formatted.filter(i => i.status === 'Paid').reduce((sum, i) => sum + i.amount, 0);
                const unpaidBalance = formatted.filter(i => i.status !== 'Paid').reduce((sum, i) => sum + i.amount, 0);
                const overdueCount = formatted.filter(i => i.status === 'Overdue').length;

                setStats([
                    { label: 'Total Invoices', value: totalInvoices, icon: 'description', badge: 'Active system records', badgeCls: 'text-success bg-success/10' },
                    { label: 'Total Revenue', value: totalRevenue, icon: 'payments', badge: 'Lifetime Collected', badgeCls: 'text-primary bg-primary/5' },
                    { label: 'Unpaid Balance', value: unpaidBalance, icon: 'account_balance_wallet', badge: `${overdueCount} overdue invoices`, badgeCls: 'text-critical bg-red-50' }
                ]);

                // Map recent activity
                setActivity(formatted.slice(0, 5).map(inv => ({
                    title: `Invoice ${inv.status}`,
                    sub: `Patient: ${inv.patient}`,
                    amount: `$${inv.amount.toFixed(2)}`,
                    icon: inv.status === 'Paid' ? 'check_circle' : 'pending',
                    iconCls: inv.status === 'Paid' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning',
                    mutedAmount: inv.status !== 'Paid'
                })));

                // Calculate Bar Data (Revenue per day of week)
                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                const todayIdx = new Date().getDay();
                const revenueByDay = new Array(7).fill(0);
                
                data.forEach(p => {
                    if (p.status === 'completed') {
                        const d = new Date(p.created_at).getDay();
                        revenueByDay[d] += parseFloat(p.amount) || 0;
                    }
                });

                const maxRev = Math.max(...revenueByDay, 100);
                setBarData(days.map((day, i) => ({
                    day,
                    h: `${(revenueByDay[i] / maxRev) * 100}%`,
                    cls: i === todayIdx ? 'bg-primary' : 'bg-slate-200',
                    isToday: i === todayIdx
                })));
            }
            setLoading(false);
        };
        fetchPayments();
    }, []);
    
    // Header dropdowns
    const [showNotifications, setShowNotifications] = useState(false);
    const [showSettings,      setShowSettings]      = useState(false);

    const { showToast } = useToast();

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 3;

    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
            const matchesSearch = inv.patient.toLowerCase().includes(search.toLowerCase()) || inv.id.toLowerCase().includes(search.toLowerCase());
            const matchesFilter = filter === 'All' || inv.status === filter;
            return matchesSearch && matchesFilter;
        });
    }, [search, invoices, filter]);

    const totalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE) || 1;
    const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    // View/Edit/Print state
    const [printInv, setPrintInv] = useState(null);
    const [viewInv,  setViewInv]  = useState(null);
    const [editInv,  setEditInv]  = useState(null);

    const updateInvoice = (updatedInv) => {
        setInvoices(prev => prev.map(inv => inv.id === updatedInv.id ? updatedInv : inv));
        setEditInv(null);
        showToast('Invoice updated successfully', 'success');
    };

    const handleDelete = (id) => {
        if(window.confirm(`Are you sure you want to delete Invoice ${id}?`)) {
            setInvoices(prev => prev.filter(inv => inv.id !== id));
            
            // Adjust pagination if necessary
            if (paginatedInvoices.length === 1 && currentPage > 1) {
                setCurrentPage(currentPage - 1);
            }
            
            showToast('Invoice deleted', 'success');
        }
    };

    const handlePrintInvoice = (inv) => {
        setPrintInv(inv);
        setTimeout(() => {
            window.print();
        }, 100);
    };

    // Listen for print events to clear state after (though typically not strictly necessary, it's safe)
    useEffect(() => {
        const handleAfterPrint = () => setPrintInv(null);
        window.addEventListener('afterprint', handleAfterPrint);
        return () => window.removeEventListener('afterprint', handleAfterPrint);
    }, []);

    return (
        <React.Fragment>
            {/* ── View Modal ──────────────────────────── */}
            <AnimatePresence>
                {viewInv && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
                        onClick={() => setViewInv(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden relative"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <h2 className="text-xl font-black text-slate-900">Invoice Details</h2>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handlePrintInvoice(viewInv)}
                                        className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-colors"
                                    >
                                        <span className="material-symbols-outlined">print</span>
                                    </button>
                                    <button 
                                        onClick={() => setViewInv(null)}
                                        className="p-2 text-slate-400 hover:text-slate-900 transition-colors"
                                    >
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>
                            </div>
                            <div className="p-10 max-h-[70vh] overflow-y-auto">
                                <div className="flex justify-between items-start mb-10">
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-1">Invoice Reference</p>
                                        <h3 className="text-3xl font-black text-slate-900">{viewInv.id}</h3>
                                        <p className="text-sm text-slate-400 font-bold mt-1 uppercase tracking-tighter">Status: {viewInv.status}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Amount Due</p>
                                        <p className="text-3xl font-black text-slate-900">${viewInv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-8 py-8 border-y border-slate-100 mb-8">
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Billed To</p>
                                        <p className="text-lg font-semibold text-slate-900">{viewInv.patient}</p>
                                        <p className="text-xs text-slate-500 mt-1">Patient ID: CP-{viewInv.id.replace(/\D/g, '')}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Issue Date</p>
                                        <p className="text-lg font-bold text-slate-900">{viewInv.date}</p>
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/60">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Service Description</p>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold text-slate-900">Clinical Services & Consultation</p>
                                            <p className="text-xs text-slate-500 mt-1">General medical evaluation and follow-up.</p>
                                        </div>
                                        <p className="font-black text-slate-900">${viewInv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                                <button 
                                    onClick={() => setViewInv(null)}
                                    className="px-6 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
                                >
                                    Close
                                </button>
                                <button 
                                    onClick={() => { setEditInv(viewInv); setViewInv(null); }}
                                    className="px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all"
                                >
                                    Edit Invoice
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Edit Modal ──────────────────────────── */}
            <AnimatePresence>
                {editInv && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
                        onClick={() => setEditInv(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900">Edit Invoice</h2>
                                    <p className="text-sm text-slate-500 font-medium">Updating {editInv.id}</p>
                                </div>
                                <button onClick={() => setEditInv(null)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <div className="p-8 space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-1">Patient Name</label>
                                    <input 
                                        type="text" 
                                        value={editInv.patient}
                                        onChange={e => setEditInv({...editInv, patient: e.target.value})}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-1">Bill Amount ($)</label>
                                        <input 
                                            type="number" 
                                            value={editInv.amount}
                                            onChange={e => setEditInv({...editInv, amount: parseFloat(e.target.value) || 0})}
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black tabular-nums text-slate-900 outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-1">Status</label>
                                        <select 
                                            value={editInv.status}
                                            onChange={e => {
                                                const s = e.target.value;
                                                const cls = s === 'Paid' ? 'bg-success/10 text-success' : s === 'Pending' ? 'bg-warning/10 text-warning' : 'bg-error-container text-on-error-container';
                                                setEditInv({...editInv, status: s, statusCls: cls});
                                            }}
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                                        >
                                            <option value="Paid">Paid</option>
                                            <option value="Pending">Pending</option>
                                            <option value="Overdue">Overdue</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-1">Effective Date</label>
                                    <input 
                                        type="text" 
                                        value={editInv.date}
                                        onChange={e => setEditInv({...editInv, date: e.target.value})}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-3">
                                <button 
                                    onClick={() => setEditInv(null)}
                                    className="flex-1 py-4 text-sm font-medium text-slate-500 hover:bg-white rounded-2xl transition-all"
                                >
                                    Discard Changes
                                </button>
                                <button 
                                    onClick={() => updateInvoice(editInv)}
                                    className="flex-[2] py-4 bg-slate-900 text-white font-semibold rounded-2xl shadow-xl shadow-slate-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            {printInv && (
                <div className="hidden print:block absolute inset-0 bg-white z-[9999] p-12 font-sans w-full h-full text-slate-900">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex justify-between items-start mb-16">
                            <div>
                                <h1 className="text-5xl font-black tracking-tighter text-slate-900">INVOICE</h1>
                                <p className="text-slate-500 font-bold mt-2 text-lg">DoctoLeb</p>
                                <p className="text-slate-400 mt-1 text-sm">Clinic Management Platform</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Invoice Reference</p>
                                <p className="text-2xl font-black text-slate-900 mt-1">{printInv.id}</p>
                                <span className={`inline-block mt-3 px-3 py-1 rounded-full text-xs font-semibold uppercase ${printInv.statusCls} border border-current`}>
                                    {printInv.status}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-10 border-y-2 border-slate-100 py-8 mb-12">
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Billed To</p>
                                <p className="text-xl font-black text-slate-900">{printInv.patient}</p>
                                <p className="text-sm text-slate-500 mt-1">Patient ID: CP-{printInv?.id?.replace(/\D/g, '').substring(0, 4) || '1024'}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Issue Date</p>
                                <p className="text-xl font-bold text-slate-900">{printInv.date}</p>
                            </div>
                        </div>

                        <table className="w-full text-left mb-16">
                            <thead>
                                <tr className="border-b-2 border-slate-900">
                                    <th className="pb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">Description</th>
                                    <th className="pb-4 text-xs font-semibold uppercase tracking-widest text-slate-400 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-slate-100">
                                    <td className="py-6">
                                        <p className="font-bold text-slate-900 text-lg">Clinical Services & Consultation</p>
                                        <p className="text-sm text-slate-500 mt-1">Comprehensive medical evaluation, lab tests, and diagnostics.</p>
                                    </td>
                                    <td className="py-6 text-right font-black text-xl text-slate-900">
                                        ${printInv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <div className="flex justify-end mb-24">
                            <div className="w-72">
                                <div className="flex justify-between py-3 border-b border-slate-100 text-sm font-bold text-slate-500">
                                    <span>Subtotal</span>
                                    <span>${printInv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between py-4 text-2xl font-black text-slate-900">
                                    <span>Total Due</span>
                                    <span>${printInv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>

                        <div className="text-center mt-auto pt-8 border-t border-slate-100 text-slate-400 text-sm font-medium">
                            <p className="mb-2 font-bold text-slate-500">Thank you for your trust in DoctoLeb.</p>
                            <p>For billing inquiries, please contact your clinic administration.</p>
                        </div>
                    </div>
                </div>
            )}

            <div className={`flex bg-slate-50 min-h-screen font-body selection:bg-primary/10 ${printInv ? 'print:hidden' : ''}`}>
            <Sidebar />

            <div className="flex-1 min-h-screen relative flex flex-col">
                
                {/* Header Anchor */}
                <header className="fixed top-0 right-0 w-[calc(100%-18rem)] h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 z-40 flex items-center justify-between px-8">
                    <div className="flex items-center flex-1">
                        <div className="relative w-full max-w-md group">
                            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px] group-focus-within:text-primary transition-colors" data-icon="search">search</span>
                            <input 
                                type="text" 
                                placeholder="Search patients, invoices, or records..." 
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-primary/20 text-sm outline-none font-medium placeholder:text-slate-400"
                            />
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4 relative">
                        <button 
                            onClick={() => { setShowNotifications(!showNotifications); setShowSettings(false); }}
                            className="p-2 text-slate-500 hover:text-primary transition-colors relative"
                        >
                            <span className="material-symbols-outlined" data-icon="notifications">notifications</span>
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>

                        <AnimatePresence>
                            {showNotifications && (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                    className="absolute top-[120%] right-12 w-80 bg-white shadow-2xl rounded-2xl border border-slate-100 z-50 overflow-hidden"
                                >
                                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                        <span className="font-semibold text-slate-900 text-sm">Notifications</span>
                                        <span className="text-[11px] text-primary font-semibold uppercase tracking-wider cursor-pointer hover:underline">Mark Read</span>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                                        <div className="p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-slate-100">
                                            <p className="text-xs font-semibold text-slate-900 leading-tight">Payment Verified</p>
                                            <p className="text-[10px] font-medium text-slate-400 mt-1">Invoice #INV-88241 settled.</p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>
                        
                        <button 
                            onClick={() => { setShowSettings(!showSettings); setShowNotifications(false); }}
                            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-slate-50 transition-colors"
                        >
                            <div className="w-8 h-8 rounded-full bg-primary-hover flex items-center justify-center text-white font-bold text-xs">—</div>
                            <span className="material-symbols-outlined text-slate-400 text-[18px]" data-icon="keyboard_arrow_down">keyboard_arrow_down</span>
                        </button>

                        <AnimatePresence>
                            {showSettings && (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                    className="absolute top-[120%] right-0 w-56 bg-white shadow-2xl rounded-2xl border border-slate-100 z-50 overflow-hidden py-1.5"
                                >
                                    <button className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-3 transition-colors">
                                        <span className="material-symbols-outlined text-[18px]">manage_accounts</span> Profile Options
                                    </button>
                                    <div className="border-t border-slate-100 my-1.5 mx-3"></div>
                                    <button className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-xs font-medium text-critical flex items-center gap-3 transition-colors">
                                        <span className="material-symbols-outlined text-[18px]">logout</span> Secure Sign Out
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </header>

                {/* Main Content Scroll Canvas */}
                <main className="pt-24 pb-12 px-8 flex-1 overflow-y-auto">
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className="max-w-[1400px] mx-auto"
                    >
                        {/* Title Bar */}
                        <div className="flex justify-between items-end mb-10">
                            <div>
                                <h2 className="text-[32px] font-black tracking-tight text-slate-900 leading-none">Billing Management</h2>
                                <p className="text-slate-500 mt-2.5 font-medium">Track invoices, manage patient balances, and monitor clinic revenue.</p>
                            </div>
                            <button 
                                onClick={() => navigate('/billing/new')}
                                className="bg-primary hover:bg-primary/95 text-white px-7 py-3.5 rounded-2xl font-semibold flex items-center gap-2.5 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                <span className="material-symbols-outlined text-[22px]" data-icon="add">add</span>
                                <span>New Bill</span>
                            </button>
                        </div>

                        {/* Summary Bento Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                            {stats.map((s, i) => (
                                <motion.div 
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="bg-white border border-slate-200/60 p-7 rounded-[24px] shadow-sm relative overflow-hidden group hover:shadow-md transition-all cursor-default"
                                >
                                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-all group-hover:scale-110">
                                        <span className="material-symbols-outlined text-[72px]" data-icon={s.icon}>{s.icon}</span>
                                    </div>
                                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2">{s.label}</p>
                                    <h3 className="text-[32px] font-black text-slate-900 leading-none flex items-baseline gap-1">
                                        {i === 1 && <span className="text-xl">$</span>}
                                        <CountUp to={s.value} separator="," />
                                    </h3>
                                    <div className={`mt-5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${s.badgeCls} w-fit px-3 py-1 rounded-full`}>
                                        <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'wght' 700" }}>
                                            {i === 2 ? 'warning' : i === 1 ? 'insights' : 'trending_up'}
                                        </span>
                                        <span>{s.badge}</span>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Table Filter Module */}
                        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-200/60 flex flex-wrap gap-5 items-center mb-8">
                            <div className="flex-1 min-w-[280px]">
                                <div className="relative group">
                                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px] group-focus-within:text-primary transition-colors" data-icon="person_search">person_search</span>
                                    <input 
                                        type="text" 
                                        placeholder="Quick Search by Patient Name or ID..." 
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                                    {['All', 'Paid', 'Pending', 'Overdue'].map(tab => (
                                        <button 
                                            key={tab}
                                            onClick={() => setFilter(tab)}
                                            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                                                filter === tab ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>
                                <button className="p-3 text-slate-500 hover:bg-slate-50 rounded-xl transition-colors border border-slate-100" onClick={() => { setSearch(''); setFilter('All'); }}>
                                    <span className="material-symbols-outlined" data-icon="refresh">refresh</span>
                                </button>
                            </div>
                        </div>

                        {/* High Precision Data Table */}
                        <div className="bg-white rounded-[24px] border border-slate-200/60 shadow-sm overflow-hidden mb-12">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/80 border-b border-slate-200">
                                            <th className="px-8 py-5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Bill ID</th>
                                            <th className="px-8 py-5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Patient Information</th>
                                            <th className="px-8 py-5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Date Issued</th>
                                            <th className="px-8 py-5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Amount</th>
                                            <th className="px-8 py-5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Status</th>
                                            <th className="px-8 py-5 text-[11px] font-semibold uppercase tracking-widest text-slate-500 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        <AnimatePresence mode="popLayout">
                                            {paginatedInvoices.map((inv) => (
                                                <motion.tr 
                                                    key={inv.id}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0, x: -10 }}
                                                    className="hover:bg-slate-50/50 transition-colors group cursor-default"
                                                >
                                                    <td className="px-8 py-5 text-sm font-semibold text-primary uppercase tracking-tight">{inv.id}</td>
                                                    <td className="px-8 py-5">
                                                        <div className="flex items-center gap-3.5">
                                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-[11px] shadow-sm">
                                                                {inv.initials}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-slate-900">{inv.patient}</p>
                                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Verified Account</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5 text-sm font-semibold text-slate-500">{inv.date}</td>
                                                    <td className="px-8 py-5 text-sm font-semibold text-slate-900 leading-none">
                                                        ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-8 py-5">
                                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${inv.statusCls} shadow-sm`}>
                                                            {inv.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-8 py-5 text-right">
                                                        <div className="flex justify-end gap-1.5 opacity-30 group-hover:opacity-100 transition-opacity">
                                                            <button 
                                                                onClick={() => setViewInv(inv)}
                                                                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-md hover:text-primary transition-all text-slate-400" 
                                                                title="View"
                                                            >
                                                                <span className="material-symbols-outlined text-[20px]">visibility</span>
                                                            </button>
                                                            <button 
                                                                onClick={() => setEditInv(inv)}
                                                                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-md hover:text-primary transition-all text-slate-400" 
                                                                title="Edit"
                                                            >
                                                                <span className="material-symbols-outlined text-[20px]">edit</span>
                                                            </button>
                                                            <button 
                                                                onClick={() => handlePrintInvoice(inv)}
                                                                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-md hover:text-primary transition-all text-slate-400" 
                                                                title="Print"
                                                            >
                                                                <span className="material-symbols-outlined text-[20px]">print</span>
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDelete(inv.id)}
                                                                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-md hover:text-critical transition-all text-slate-400" 
                                                                title="Delete"
                                                            >
                                                                <span className="material-symbols-outlined text-[20px]">delete</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </AnimatePresence>
                                        {filteredInvoices.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="px-8 py-20 text-center">
                                                    <span className="material-symbols-outlined text-5xl text-slate-200 mb-4 block">search_off</span>
                                                    <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">No matching records found</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            
                            {/* Pagination Module */}
                            <div className="px-8 py-5 bg-slate-50/50 flex items-center justify-between border-t border-slate-200">
                                <p className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Showing {paginatedInvoices.length} of {filteredInvoices.length} entries</p>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-4 py-2 border border-slate-200 rounded-xl text-[11px] font-semibold uppercase text-slate-500 hover:bg-white transition-colors disabled:opacity-40"
                                    >
                                        Prev
                                    </button>
                                    
                                    {Array.from({ length: totalPages }).map((_, i) => {
                                        const n = i + 1;
                                        return (
                                            <button 
                                                key={n} 
                                                onClick={() => setCurrentPage(n)}
                                                className={`px-4 py-2 border ${n === currentPage ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'border-slate-200 text-slate-600 hover:bg-white'} rounded-xl text-[11px] font-semibold uppercase transition-all`}
                                            >
                                                {n}
                                            </button>
                                        );
                                    })}
                                    
                                    <button 
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-4 py-2 border border-slate-200 rounded-xl text-[11px] font-semibold uppercase text-slate-600 hover:bg-white transition-colors disabled:opacity-40"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Deep Insights Secondary Canvas */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
                            {/* Payment Feed */}
                            <div className="space-y-5">
                                <h4 className="text-[20px] font-black tracking-tight text-slate-900">Recent Payment Activity</h4>
                                <div className="bg-white border border-slate-200/60 rounded-[28px] overflow-hidden shadow-sm">
                                    {activity.map((a, i) => (
                                        <motion.div 
                                            key={i}
                                            initial={{ opacity: 0, x: -20 }}
                                            whileInView={{ opacity: 1, x: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ delay: i * 0.1 }}
                                            className={`p-5 flex items-center gap-5 group hover:bg-slate-50 transition-colors ${i < activity.length - 1 ? 'border-b border-slate-100' : ''}`}
                                        >
                                            <div className={`w-12 h-12 rounded-2xl ${a.iconCls} flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform`}>
                                                <span className="material-symbols-outlined text-[24px]">{a.icon}</span>
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                <p className="text-[15px] font-bold text-slate-900 truncate tracking-tight">{a.title}</p>
                                                <p className="text-xs text-slate-500 mt-1 truncate font-medium">{a.sub}</p>
                                            </div>
                                            <span className={`text-sm font-semibold tracking-tight shrink-0 ${a.mutedAmount ? 'text-slate-400' : 'text-slate-900'}`}>{a.amount}</span>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>

                            {/* Revenue Projection Anchor */}
                            <div className="space-y-5">
                                <h4 className="text-[20px] font-black tracking-tight text-slate-900">Revenue Projection</h4>
                                <div className="bg-white border border-slate-200/60 rounded-[28px] p-8 shadow-sm h-full flex flex-col justify-between min-h-[280px]">
                                    <div className="flex items-end gap-3 h-48 flex-1 mb-4 pt-4">
                                        {barData.map((b, i) => (
                                            <div key={i} className="flex-1 flex flex-col items-center gap-3 h-full justify-end group">
                                                <div className="w-full bg-slate-100 rounded-2xl relative overflow-hidden flex items-end grow shadow-inner">
                                                    <motion.div 
                                                        initial={{ height: 0 }}
                                                        whileInView={{ height: b.h }}
                                                        viewport={{ once: true }}
                                                        transition={{ duration: 1, ease: 'circOut', delay: i * 0.05 }}
                                                        className={`${b.cls} w-full rounded-2xl ${b.isToday ? 'shadow-lg shadow-primary/30' : ''}`}
                                                    />
                                                </div>
                                                <p className={`text-[10px] font-semibold uppercase tracking-widest ${b.isToday ? 'text-primary' : 'text-slate-400'}`}>{b.day}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-between items-center pt-5 border-t border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2.5 h-2.5 bg-primary rounded-full"></div>
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Completed</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-2.5 h-2.5 bg-slate-200 rounded-full"></div>
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Projected</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </main>

            </div>
        </div>
        </React.Fragment>
    );
}
