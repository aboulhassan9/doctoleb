/**
 * PatientTable — paginated patient table with search, filters, and action buttons.
 */
import { useMemo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { stagger } from '@/lib/animations';
import { rowAnim } from './patientFormHelpers';

const ITEMS_PER_PAGE = 5;

export default function PatientTable({
    patientList,
    loading,
    onView,
    onEdit,
    onDelete,
    onOpenRegister,
}) {
    const [search, setSearch] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const searchInputRef = useRef(null);
    const location = useLocation();

    // Handle location-state driven actions
    useEffect(() => {
        if (location.state?.focusSearch) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
            window.history.replaceState({}, document.title);
        }
        if (location.state?.searchQuery) {
            setSearch(location.state.searchQuery);
            setTimeout(() => searchInputRef.current?.focus(), 100);
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    const filtered = useMemo(() => {
        const query = search.toLowerCase();
        return patientList.filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.id.toLowerCase().includes(query) ||
            (p.phone && p.phone.includes(search))
        );
    }, [patientList, search]);

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
    const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
        <>
            {/* Title */}
            <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Patient Directory</h1>
                <p className="text-slate-500 mt-1 text-base">Manage records, access histories, and update patient profiles.</p>
            </motion.div>

            {/* Search + filter bar */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="flex gap-3">
                <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
                    <input
                        ref={searchInputRef}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name, ID, or phone number..."
                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                    />
                </div>
                <div className="relative">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:border-primary hover:text-primary transition-all shadow-sm whitespace-nowrap"
                    >
                        <span className="material-symbols-outlined text-xl">filter_list</span>
                        Filters
                    </button>
                    <AnimatePresence>
                        {showFilters && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                className="absolute top-[120%] right-0 w-64 bg-white shadow-2xl rounded-2xl border border-slate-100 z-50 overflow-hidden p-4"
                            >
                                <h4 className="font-semibold text-slate-900 mb-3 text-sm">Filter By Status</h4>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" className="rounded text-primary focus:ring-primary" defaultChecked />
                                        <span className="text-sm font-semibold text-slate-700">Active Patients</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" className="rounded text-primary focus:ring-primary" defaultChecked />
                                        <span className="text-sm font-semibold text-slate-700">Recent Visits (30 days)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" className="rounded text-primary focus:ring-primary" />
                                        <span className="text-sm font-semibold text-slate-700">Pending Insurance</span>
                                    </label>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            {/* Table */}
            <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                {['Patient ID', 'Name', 'Contact Number', 'Last Visit', 'Actions'].map((col, i) => (
                                    <th key={i} className={`px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider ${i === 4 ? 'text-right' : ''}`}>{col}</th>
                                ))}
                            </tr>
                        </thead>
                        <motion.tbody variants={stagger} initial="hidden" animate="visible" className="divide-y divide-slate-100">
                            <AnimatePresence>
                                {loading ? (
                                    Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
                                        <tr key={`skel-${i}`} className="animate-pulse">
                                            <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                                            <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-slate-200"></div><div className="h-4 bg-slate-200 rounded w-32"></div></div></td>
                                            <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                                            <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                                            <td className="px-6 py-4"><div className="h-6 bg-slate-200 rounded w-20 ml-auto"></div></td>
                                        </tr>
                                    ))
                                ) : (
                                    paginated.map(p => (
                                        <motion.tr key={p.id} variants={rowAnim} layout exit={{ opacity: 0, height: 0 }} className="group hover:bg-slate-50/80 transition-colors">
                                            <td className="px-6 py-4 text-sm font-semibold text-primary">{p.id}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full ${p.color} flex items-center justify-center text-xs font-bold shrink-0`}>{p.initials}</div>
                                                    <span className="text-sm font-bold text-slate-900">{p.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500 font-medium">{p.phone}</td>
                                            <td className="px-6 py-4 text-sm text-slate-500 font-medium">{p.visit}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                                    <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.88 }} onClick={() => onView(p)} className="p-1.5 text-slate-400 hover:text-primary transition-colors">
                                                        <span className="material-symbols-outlined text-xl">visibility</span>
                                                    </motion.button>
                                                    <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.88 }} onClick={() => onEdit(p)} className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors">
                                                        <span className="material-symbols-outlined text-xl">edit</span>
                                                    </motion.button>
                                                    <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.88 }} onClick={() => onDelete(p.id)} className="p-1.5 text-slate-400 hover:text-critical transition-colors">
                                                        <span className="material-symbols-outlined text-xl">delete</span>
                                                    </motion.button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))
                                )}
                            </AnimatePresence>
                            {!loading && filtered.length === 0 && (
                                <tr><td colSpan={5} className="px-6 py-14 text-center text-slate-400 text-sm font-medium">No patients found matching "{search}"</td></tr>
                            )}
                        </motion.tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 flex items-center justify-between bg-slate-50 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-500">Showing {paginated.length} of {patientList.length} patients</p>
                    <div className="flex gap-2">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors">Previous</button>
                        {Array.from({ length: totalPages }).map((_, i) => {
                            const n = i + 1;
                            return (
                                <button key={n} onClick={() => setCurrentPage(n)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${n === currentPage ? 'bg-primary text-white border border-primary' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{n}</button>
                            );
                        })}
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors">Next</button>
                    </div>
                </div>
            </motion.div>
        </>
    );
}
