/**
 * CertificateTable — Renders the certificates list table with status badges.
 *
 * Replaces ~55 lines of inline table markup from DoctorCertificatesPage.
 */
import { motion } from 'framer-motion';

export default function CertificateTable({ certificates }) {
    if (certificates.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
                <span className="material-symbols-outlined text-slate-300 text-5xl block mb-3">description</span>
                <p className="text-sm text-slate-400 font-medium">No certificates found.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Certificate ID</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Type</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Patient</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Date</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                        <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {certificates.map((cert) => (
                        <motion.tr
                            key={cert.id}
                            whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.05)' }}
                            className="group"
                        >
                            <td className="px-6 py-4">
                                <span className="text-sm font-bold font-mono text-primary">{cert.id}</span>
                            </td>
                            <td className="px-6 py-4">
                                <span className="text-sm text-slate-900">Medical Certificate</span>
                            </td>
                            <td className="px-6 py-4">
                                <span className="text-sm font-bold text-slate-900">
                                    {cert.title || 'Medical Certificate'}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <span className="text-sm text-slate-600">
                                    {new Date(cert.created_at).toLocaleDateString()}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                    cert.is_archived ? 'bg-warning/10 text-warning' : 'bg-green-100 text-green-700'
                                }`}>
                                    {cert.is_archived ? 'Archived' : 'Active'}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="px-3 py-1.5 text-xs font-bold text-primary border border-primary/20 rounded-lg hover:bg-primary hover:text-white transition-all">
                                        View
                                    </motion.button>
                                    <button className="p-1.5 text-slate-400 hover:text-slate-600">
                                        <span className="material-symbols-outlined text-lg">more_vert</span>
                                    </button>
                                </div>
                            </td>
                        </motion.tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
