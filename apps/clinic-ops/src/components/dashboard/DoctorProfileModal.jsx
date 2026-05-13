/**
 * DoctorProfileModal — editable doctor profile with specialization & department fields.
 *
 * Unlike the secretary DashboardSettingsModals, this modal has real save logic 
 * that patches both `users` and `doctors` tables.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { patientService } from '@/services/patients';
import { doctorService } from '@/services/doctors';

export default function DoctorProfileModal({ open, onClose, doctorRecord }) {
    const { user } = useAuth();
    const { showToast } = useToast();

    const [profileForm, setProfileForm] = useState({
        firstName: '', lastName: '', phone: '', specialization: '', department: ''
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (doctorRecord) {
            setProfileForm({
                firstName: doctorRecord.users?.first_name || '',
                lastName: doctorRecord.users?.last_name || '',
                phone: doctorRecord.users?.phone || '',
                specialization: doctorRecord.specialization || '',
                department: doctorRecord.department || '',
            });
        }
    }, [doctorRecord]);

    const handleSave = async () => {
        setSaving(true);
        const [{ error: uErr }, { error: dErr }] = await Promise.all([
            patientService.updateUserInfo(user.id, {
                firstName: profileForm.firstName,
                lastName: profileForm.lastName,
                phone: profileForm.phone,
            }),
            doctorRecord ? doctorService.update(doctorRecord.id, {
                specialization: profileForm.specialization || null,
                department: profileForm.department || null,
            }) : Promise.resolve({ error: null }),
        ]);
        setSaving(false);
        if (uErr || dErr) {
            showToast('Failed to save profile', 'error');
        } else {
            showToast('Profile updated successfully', 'success');
            onClose();
        }
    };

    if (!open) return null;

    return (
        <AnimatePresence>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
                <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-8" onClick={e => e.stopPropagation()}>
                    <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">manage_accounts</span> Doctor Profile
                    </h2>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-semibold uppercase text-slate-400">First Name</label>
                                <input type="text" value={profileForm.firstName} onChange={e => setProfileForm(f => ({...f, firstName: e.target.value}))} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/30 outline-none" />
                            </div>
                            <div>
                                <label className="text-[10px] font-semibold uppercase text-slate-400">Last Name</label>
                                <input type="text" value={profileForm.lastName} onChange={e => setProfileForm(f => ({...f, lastName: e.target.value}))} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/30 outline-none" />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-semibold uppercase text-slate-400">Phone</label>
                            <input type="tel" value={profileForm.phone} onChange={e => setProfileForm(f => ({...f, phone: e.target.value}))} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/30 outline-none" />
                        </div>
                        <div>
                            <label className="text-[10px] font-semibold uppercase text-slate-400">Specialization</label>
                            <input type="text" value={profileForm.specialization} onChange={e => setProfileForm(f => ({...f, specialization: e.target.value}))} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/30 outline-none" />
                        </div>
                        <div>
                            <label className="text-[10px] font-semibold uppercase text-slate-400">Department</label>
                            <input type="text" value={profileForm.department} onChange={e => setProfileForm(f => ({...f, department: e.target.value}))} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/30 outline-none" />
                        </div>
                        <div>
                            <label className="text-[10px] font-semibold uppercase text-slate-400">Email</label>
                            <input type="email" value={user?.email || ''} disabled className="w-full px-4 py-2 border border-slate-100 rounded-xl bg-slate-50 text-slate-400 cursor-not-allowed" />
                        </div>
                    </div>
                    <div className="mt-8 flex gap-3">
                        <button onClick={onClose} className="flex-1 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50 rounded-xl transition-colors">Cancel</button>
                        <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-primary text-white text-sm font-semibold rounded-xl shadow-lg shadow-primary/20 disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
