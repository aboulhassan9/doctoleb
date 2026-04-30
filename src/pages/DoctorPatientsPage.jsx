import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import DoctorSidebar from '../components/DoctorSidebar';
import { patientService } from '../services/patients';
import { useToast } from '../contexts/ToastContext';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function DoctorPatientsPage() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        fetchPatients();
    }, []);

    const fetchPatients = async () => {
        try {
            setLoading(true);
            const { data, error } = await patientService.getAll();
            if (!error && data) {
                setPatients(data || []);
            } else {
                showToast('Failed to load patients', 'error');
            }
        } catch (err) {
            console.error('Error fetching patients:', err);
            showToast('An error occurred', 'error');
        } finally {
            setLoading(false);
        }
    };

    const ITEMS_PER_PAGE = 5;
    const [currentPage, setCurrentPage] = useState(1);

    const filteredPatients = patients.filter(p => {
        const matchesSearch =
            (p.users?.first_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.users?.last_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.id || '').toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
    });

    const totalPages = Math.ceil(filteredPatients.length / ITEMS_PER_PAGE) || 1;
    const paginatedPatients = filteredPatients.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
        <div className="flex h-screen w-full bg-[#f5f7f8] text-[#0f172a] overflow-hidden font-['Inter']">
            <DoctorSidebar />

            <main className="flex-1 flex flex-col overflow-y-auto">
                <header className="sticky top-0 z-20 h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
                    <div className="flex items-center gap-4 flex-1 max-w-xl">
                        <div className="relative w-full">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">search</span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search patients by name or ID..."
                                className="w-full bg-slate-100 border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary">
                            <span className="material-symbols-outlined">notifications</span>
                        </button>
                        <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary">
                            <span className="material-symbols-outlined">settings</span>
                        </button>
                        <div className="h-8 w-px bg-slate-200 mx-2"></div>
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-xs font-bold text-slate-900">Dr. Julian Thorne</p>
                                <p className="text-[10px] text-slate-500">Chief Resident</p>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-xs">JT</div>
                        </div>
                    </div>
                </header>

                <div className="p-8 pb-12">
                    <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-10 flex items-end justify-between">
                        <div>
                            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Patient List</h2>
                            <p className="text-slate-500 mt-2 text-base">Manage and view all registered patients.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-primary text-white rounded-xl shadow-lg hover:bg-primary/90 transition-all">
                                <span className="material-symbols-outlined text-lg">add</span>Add Patient
                            </motion.button>
                        </div>
                    </motion.div>

                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                                <p className="text-slate-600">Loading patients...</p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Patient</th>
                                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Age / Sex</th>
                                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Phone</th>
                                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Email</th>
                                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {paginatedPatients.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-16 text-center">
                                                <span className="material-symbols-outlined text-4xl text-slate-300 block mb-3">person_search</span>
                                                <p className="text-sm font-bold text-slate-400">No patients found.</p>
                                            </td>
                                        </tr>
                                    )}
                                    {paginatedPatients.map((patient) => {
                                        const firstName = patient.users?.first_name || '';
                                        const lastName = patient.users?.last_name || '';
                                        const fullName = `${firstName} ${lastName}`.trim();
                                        const initials = (firstName?.charAt(0) || '') + (lastName?.charAt(0) || '');
                                        const age = patient.date_of_birth ? new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear() : 'N/A';

                                        return (
                                            <motion.tr
                                                key={patient.id}
                                                variants={fadeUp}
                                                whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.05)' }}
                                                className="group"
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm bg-primary/10 text-primary">
                                                            {initials || '?'}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-sm text-slate-900">{fullName}</p>
                                                            <p className="text-xs text-slate-500 font-mono">{patient.id}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-sm text-slate-600">{age} / {patient.sex || 'N/A'}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-sm text-slate-600">{patient.users?.phone || 'N/A'}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-sm text-slate-600">{patient.users?.email || 'N/A'}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                                                        Active
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => navigate(`/doctor-patient/${patient.id}`)} className="px-3 py-1.5 text-xs font-bold text-primary border border-primary/20 rounded-lg hover:bg-primary hover:text-white transition-all">
                                                            View Profile
                                                        </motion.button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            
                            {/* Pagination */}
                            <div className="px-6 py-4 flex items-center justify-between bg-slate-50 border-t border-slate-100">
                                <p className="text-xs font-semibold text-slate-500">
                                    Showing {paginatedPatients.length} of {filteredPatients.length} patients
                                </p>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors"
                                    >
                                        Previous
                                    </button>
                                    
                                    {Array.from({ length: totalPages }).map((_, i) => {
                                        const n = i + 1;
                                        return (
                                            <button 
                                                key={n} 
                                                onClick={() => setCurrentPage(n)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${n === currentPage ? 'bg-primary text-white border border-primary' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                            >
                                                {n}
                                            </button>
                                        );
                                    })}
                                    
                                    <button 
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}