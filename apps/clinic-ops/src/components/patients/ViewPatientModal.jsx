/**
 * ViewPatientModal — read-only patient profile overlay.
 */
import { motion } from 'framer-motion';

export default function ViewPatientModal({ patient, onClose }) {
    if (!patient) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-semibold text-slate-800">Patient Profile</h3>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                        <div className={`w-14 h-14 rounded-full ${patient.color} flex items-center justify-center text-xl font-bold shrink-0`}>{patient.initials}</div>
                        <div>
                            <h4 className="text-xl font-black text-slate-900">{patient.name}</h4>
                            <span className="text-sm font-semibold text-primary">{patient.id}</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <div><p className="text-xs font-bold text-slate-400 mb-1">Phone</p><p className="font-bold text-slate-700">{patient.phone}</p></div>
                        <div><p className="text-xs font-bold text-slate-400 mb-1">Last Visit</p><p className="font-bold text-slate-700">{patient.visit}</p></div>
                    </div>
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-right">
                    <button onClick={onClose} className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 flex items-center gap-2 ml-auto">
                        <span className="material-symbols-outlined text-[18px]">check</span> Done
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
