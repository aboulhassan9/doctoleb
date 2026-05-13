/**
 * EditPatientModal — centered overlay for editing patient name and phone.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';

export default function EditPatientModal({ patient, onClose, onSave }) {
    const [name, setName] = useState(patient?.name || '');
    const [phone, setPhone] = useState(patient?.phone || '');
    if (!patient) return null;

    const handleSubmit = (e) => { e.preventDefault(); onSave(patient.id, name, phone); };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-semibold text-slate-800 text-lg">Edit Patient</h3>
                    <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col">
                    <div className="p-6 space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">Full Name</label>
                            <input autoFocus required value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">Phone Number</label>
                            <input required value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                        </div>
                    </div>
                    <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 mt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-white">Cancel</button>
                        <button type="submit" className="px-6 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">save</span> Save Changes
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
