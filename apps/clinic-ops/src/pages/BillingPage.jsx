/**
 * BillingPage — orchestrator for billing management dashboard.
 *
 * Composes: ViewInvoiceModal, EditInvoiceModal, InvoicePrintView.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import CountUp from '@/components/CountUp';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { useBilling } from '@/hooks/features/useBilling';
import { useNotifications } from '@/hooks/features/useNotifications';
import { getClinicOpsNotificationTarget, isUnreadNotification } from '@/lib/clinicOpsNavigation';
import { timeAgo } from '@/lib/dateUtils';

import ViewInvoiceModal from '@clinic-ops/components/billing/ViewInvoiceModal';
import EditInvoiceModal from '@clinic-ops/components/billing/EditInvoiceModal';
import InvoicePrintView from '@clinic-ops/components/billing/InvoicePrintView';
import ConfirmActionDialog from '@clinic-ops/components/common/ConfirmActionDialog';

export default function BillingPage() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { displayName } = useBrand();
    const { notifications, unreadCount, markRead, markAllRead } = useNotifications({ userId: user?.id });
    const { invoices, stats, activity, barData, updateInvoice: updateInvoiceHook, deleteInvoice: deleteInvoiceHook } = useBilling();

    /* ── Local state ── */
    const [search, setSearch]   = useState('');
    const [filter, setFilter]   = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [printInv, setPrintInv] = useState(null);
    const [viewInv, setViewInv]   = useState(null);
    const [editInv, setEditInv]   = useState(null);
    const [deleteCandidate, setDeleteCandidate] = useState(null);

    const ITEMS_PER_PAGE = 3;

    /* ── Derived ── */
    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
            const matchesSearch = inv.patient.toLowerCase().includes(search.toLowerCase()) || inv.id.toLowerCase().includes(search.toLowerCase());
            const matchesFilter = filter === 'All' || inv.status === filter;
            return matchesSearch && matchesFilter;
        });
    }, [search, invoices, filter]);

    const totalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE) || 1;
    const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    /* ── Handlers ── */
    const handleSaveEdit = (updatedInv) => { updateInvoiceHook(updatedInv); setEditInv(null); };
    const handleDelete = (id) => setDeleteCandidate(id);
    const confirmDelete = async () => {
        if (!deleteCandidate) return;
        await deleteInvoiceHook(deleteCandidate);
        if (paginatedInvoices.length === 1 && currentPage > 1) setCurrentPage(currentPage - 1);
        setDeleteCandidate(null);
    };
    const handlePrintInvoice = (inv) => {
        setPrintInv(inv);
        requestAnimationFrame(() => window.print());
    };
    const handleViewToEdit = (inv) => { setEditInv(inv); setViewInv(null); };
    const handleNotificationClick = async (notification) => {
        await markRead(notification.id);
        setShowNotifications(false);
        navigate(getClinicOpsNotificationTarget(notification, user?.role || 'secretary'));
    };
    const handleMarkAllRead = async () => {
        await markAllRead();
        setShowNotifications(false);
    };
    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const userInitials = user?.initials || `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase() || '—';

    useEffect(() => {
        const handleAfterPrint = () => setPrintInv(null);
        window.addEventListener('afterprint', handleAfterPrint);
        return () => window.removeEventListener('afterprint', handleAfterPrint);
    }, []);

    return (
        <React.Fragment>
            {/* Modals */}
            <AnimatePresence>{viewInv && <ViewInvoiceModal invoice={viewInv} onClose={() => setViewInv(null)} onPrint={handlePrintInvoice} onEdit={handleViewToEdit} />}</AnimatePresence>
            <AnimatePresence>{editInv && <EditInvoiceModal invoice={editInv} onClose={() => setEditInv(null)} onSave={handleSaveEdit} />}</AnimatePresence>
            <InvoicePrintView invoice={printInv} clinicName={displayName} />
            <ConfirmActionDialog
                open={Boolean(deleteCandidate)}
                title="Archive billing record?"
                description={`This will move payment ${deleteCandidate || ''} out of the active billing list while preserving the financial audit trail.`}
                confirmLabel="Archive record"
                cancelLabel="Keep record"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteCandidate(null)}
            />

            <DashboardLayout role="secretary">
                <div className={`flex-1 relative flex flex-col ${printInv ? 'print:hidden' : ''}`}>

                    {/* Header */}
                    <header className="fixed top-0 right-0 w-[calc(100%-18rem)] h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 z-40 flex items-center justify-between px-8">
                        <div className="flex items-center flex-1">
                            <div className="relative w-full max-w-md group">
                                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px] group-focus-within:text-primary transition-colors">search</span>
                                <input type="text" placeholder="Search patients, invoices, or records..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-11 pr-4 py-2.5 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-primary/20 text-sm outline-none font-medium placeholder:text-slate-400" />
                            </div>
                        </div>
                        <div className="flex items-center gap-4 relative">
                            <button type="button" onClick={() => { setShowNotifications(!showNotifications); setShowSettings(false); }} className="p-2 text-slate-500 hover:text-primary transition-colors relative" aria-label="Open billing notifications">
                                <span className="material-symbols-outlined">notifications</span>
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-critical text-white text-[10px] font-black rounded-full flex items-center justify-center px-1">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </button>
                            <AnimatePresence>
                                {showNotifications && (
                                    <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="absolute top-[120%] right-12 w-80 bg-white shadow-2xl rounded-2xl border border-slate-100 z-50 overflow-hidden">
                                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                            <span className="font-semibold text-slate-900 text-sm">Notifications</span>
                                            <button type="button" onClick={handleMarkAllRead} disabled={unreadCount === 0} className="text-[11px] text-primary font-semibold uppercase tracking-wider cursor-pointer hover:underline disabled:text-slate-300 disabled:cursor-not-allowed">Mark Read</button>
                                        </div>
                                        <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                                            {notifications.length === 0 ? (
                                                <div className="p-6 text-center">
                                                    <span className="material-symbols-outlined text-slate-300 text-3xl block mb-2">notifications_off</span>
                                                    <p className="text-sm text-slate-400 font-medium">No billing notifications.</p>
                                                </div>
                                            ) : notifications.slice(0, 6).map((notification) => (
                                                <button key={notification.id} type="button" onClick={() => handleNotificationClick(notification)} className="w-full p-3 text-left hover:bg-slate-50 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-slate-100">
                                                    <p className={`text-xs leading-tight ${isUnreadNotification(notification) ? 'font-black text-slate-950' : 'font-semibold text-slate-700'}`}>{notification.title || 'Clinic notification'}</p>
                                                    {notification.message && <p className="text-[10px] font-medium text-slate-500 mt-1 line-clamp-2">{notification.message}</p>}
                                                    <p className="text-[10px] font-bold text-slate-400 mt-1">{timeAgo(notification.created_at)}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>
                            <button type="button" onClick={() => { setShowSettings(!showSettings); setShowNotifications(false); }} className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-slate-50 transition-colors" aria-label="Open account menu">
                                <div className="w-8 h-8 rounded-full bg-primary-hover flex items-center justify-center text-white font-bold text-xs">{userInitials}</div>
                                <span className="material-symbols-outlined text-slate-400 text-[18px]">keyboard_arrow_down</span>
                            </button>
                            <AnimatePresence>
                                {showSettings && (
                                    <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="absolute top-[120%] right-0 w-56 bg-white shadow-2xl rounded-2xl border border-slate-100 z-50 overflow-hidden py-1.5">
                                        <button type="button" disabled title="Billing profile edits are read-only until staff account audit support is wired" className="w-full text-left px-4 py-2.5 text-xs font-medium text-slate-400 flex items-center gap-3 cursor-not-allowed">
                                            <span className="material-symbols-outlined text-[18px]">manage_accounts</span> Profile Read-only
                                        </button>
                                        <div className="border-t border-slate-100 my-1.5 mx-3"></div>
                                        <button type="button" onClick={handleLogout} className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-xs font-medium text-critical flex items-center gap-3 transition-colors">
                                            <span className="material-symbols-outlined text-[18px]">logout</span> Secure Sign Out
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </header>

                    {/* Main Content */}
                    <div className="pt-24 pb-12 px-8 flex-1 overflow-y-auto">
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-[1400px] mx-auto">
                            {/* Title */}
                            <div className="flex justify-between items-end mb-10">
                                <div>
                                    <h2 className="text-[32px] font-black tracking-tight text-slate-900 leading-none">Billing Management</h2>
                                    <p className="text-slate-500 mt-2.5 font-medium">Track invoices, manage patient balances, and monitor clinic revenue.</p>
                                </div>
                                <button onClick={() => navigate('/billing/new')} className="bg-primary hover:bg-primary/95 text-white px-7 py-3.5 rounded-2xl font-semibold flex items-center gap-2.5 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                                    <span className="material-symbols-outlined text-[22px]">add</span>
                                    <span>New Bill</span>
                                </button>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                                {stats.map((s, i) => (
                                    <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-white border border-slate-200/60 p-7 rounded-[24px] shadow-sm relative overflow-hidden group hover:shadow-md transition-all cursor-default">
                                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-all group-hover:scale-110">
                                            <span className="material-symbols-outlined text-[72px]">{s.icon}</span>
                                        </div>
                                        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2">{s.label}</p>
                                        <h3 className="text-[32px] font-black text-slate-900 leading-none flex items-baseline gap-1">
                                            {i === 1 && <span className="text-xl">$</span>}
                                            <CountUp to={s.value} separator="," />
                                        </h3>
                                        <div className={`mt-5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${s.badgeCls} w-fit px-3 py-1 rounded-full`}>
                                            <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'wght' 700" }}>{i === 2 ? 'warning' : i === 1 ? 'insights' : 'trending_up'}</span>
                                            <span>{s.badge}</span>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Filters */}
                            <div className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-200/60 flex flex-wrap gap-5 items-center mb-8">
                                <div className="flex-1 min-w-[280px]">
                                    <div className="relative group">
                                        <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px] group-focus-within:text-primary transition-colors">person_search</span>
                                        <input type="text" placeholder="Quick Search by Patient Name or ID..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                                        {['All', 'Paid', 'Pending', 'Overdue'].map(tab => (
                                            <button key={tab} onClick={() => setFilter(tab)} className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${filter === tab ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500 hover:text-slate-700'}`}>{tab}</button>
                                        ))}
                                    </div>
                                    <button className="p-3 text-slate-500 hover:bg-slate-50 rounded-xl transition-colors border border-slate-100" onClick={() => { setSearch(''); setFilter('All'); }}>
                                        <span className="material-symbols-outlined">refresh</span>
                                    </button>
                                </div>
                            </div>

                            {/* Invoice Table */}
                            <div className="bg-white rounded-[24px] border border-slate-200/60 shadow-sm overflow-hidden mb-12">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/80 border-b border-slate-200">
                                                {['Bill ID', 'Patient Information', 'Date Issued', 'Amount', 'Status', 'Actions'].map((col, i) => (
                                                    <th key={col} className={`px-8 py-5 text-[11px] font-semibold uppercase tracking-widest text-slate-500 ${i === 5 ? 'text-right' : ''}`}>{col}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            <AnimatePresence mode="popLayout">
                                                {paginatedInvoices.map(inv => (
                                                    <motion.tr key={inv.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -10 }} className="hover:bg-slate-50/50 transition-colors group cursor-default">
                                                        <td className="px-8 py-5 text-sm font-semibold text-primary uppercase tracking-tight">{inv.id}</td>
                                                        <td className="px-8 py-5">
                                                            <div className="flex items-center gap-3.5">
                                                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-[11px] shadow-sm">{inv.initials}</div>
                                                                <div>
                                                                    <p className="text-sm font-bold text-slate-900">{inv.patient}</p>
                                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Verified Account</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-5 text-sm font-semibold text-slate-500">{inv.date}</td>
                                                        <td className="px-8 py-5 text-sm font-semibold text-slate-900 leading-none">${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                        <td className="px-8 py-5"><span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${inv.statusCls} shadow-sm`}>{inv.status}</span></td>
                                                        <td className="px-8 py-5 text-right">
                                                            <div className="flex justify-end gap-1.5 opacity-30 group-hover:opacity-100 transition-opacity">
                                                                {[
                                                                    { icon: 'visibility', title: 'View', onClick: () => setViewInv(inv) },
                                                                    { icon: 'edit', title: 'Edit', onClick: () => setEditInv(inv) },
                                                                    { icon: 'print', title: 'Print', onClick: () => handlePrintInvoice(inv) },
                                                                    { icon: 'delete', title: 'Delete', onClick: () => handleDelete(inv.id), cls: 'hover:text-critical' },
                                                                ].map(btn => (
                                                                    <button key={btn.icon} onClick={btn.onClick} className={`w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-md ${btn.cls || 'hover:text-primary'} transition-all text-slate-400`} title={btn.title}>
                                                                        <span className="material-symbols-outlined text-[20px]">{btn.icon}</span>
                                                                    </button>
                                                                ))}
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
                                {/* Pagination */}
                                <div className="px-8 py-5 bg-slate-50/50 flex items-center justify-between border-t border-slate-200">
                                    <p className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Showing {paginatedInvoices.length} of {filteredInvoices.length} entries</p>
                                    <div className="flex gap-2">
                                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 border border-slate-200 rounded-xl text-[11px] font-semibold uppercase text-slate-500 hover:bg-white transition-colors disabled:opacity-40">Prev</button>
                                        {Array.from({ length: totalPages }).map((_, i) => {
                                            const n = i + 1;
                                            return <button key={n} onClick={() => setCurrentPage(n)} className={`px-4 py-2 border ${n === currentPage ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'border-slate-200 text-slate-600 hover:bg-white'} rounded-xl text-[11px] font-semibold uppercase transition-all`}>{n}</button>;
                                        })}
                                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 border border-slate-200 rounded-xl text-[11px] font-semibold uppercase text-slate-600 hover:bg-white transition-colors disabled:opacity-40">Next</button>
                                    </div>
                                </div>
                            </div>

                            {/* Insights */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
                                {/* Payment Feed */}
                                <div className="space-y-5">
                                    <h4 className="text-[20px] font-black tracking-tight text-slate-900">Recent Payment Activity</h4>
                                    <div className="bg-white border border-slate-200/60 rounded-[28px] overflow-hidden shadow-sm">
                                        {activity.map((a, i) => (
                                            <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className={`p-5 flex items-center gap-5 group hover:bg-slate-50 transition-colors ${i < activity.length - 1 ? 'border-b border-slate-100' : ''}`}>
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
                                {/* Revenue Chart */}
                                <div className="space-y-5">
                                    <h4 className="text-[20px] font-black tracking-tight text-slate-900">Revenue Projection</h4>
                                    <div className="bg-white border border-slate-200/60 rounded-[28px] p-8 shadow-sm h-full flex flex-col justify-between min-h-[280px]">
                                        <div className="flex items-end gap-3 h-48 flex-1 mb-4 pt-4">
                                            {barData.map((b, i) => (
                                                <div key={i} className="flex-1 flex flex-col items-center gap-3 h-full justify-end group">
                                                    <div className="w-full bg-slate-100 rounded-2xl relative overflow-hidden flex items-end grow shadow-inner">
                                                        <motion.div initial={{ height: 0 }} whileInView={{ height: b.h }} viewport={{ once: true }} transition={{ duration: 1, ease: 'circOut', delay: i * 0.05 }} className={`${b.cls} w-full rounded-2xl ${b.isToday ? 'shadow-lg shadow-primary/30' : ''}`} />
                                                    </div>
                                                    <p className={`text-[10px] font-semibold uppercase tracking-widest ${b.isToday ? 'text-primary' : 'text-slate-400'}`}>{b.day}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex justify-between items-center pt-5 border-t border-slate-100">
                                            <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 bg-primary rounded-full"></div><span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Completed</span></div>
                                            <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 bg-slate-200 rounded-full"></div><span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Projected</span></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </DashboardLayout>
        </React.Fragment>
    );
}
