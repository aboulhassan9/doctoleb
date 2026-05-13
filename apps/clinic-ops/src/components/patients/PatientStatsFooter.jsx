/**
 * PatientStatsFooter — gender/total summary cards shown below the patient table.
 */
import { motion } from 'framer-motion';
import CountUp from '@/components/CountUp';

export default function PatientStatsFooter({ patientList }) {
    const stats = [
        { label: 'Total Patients', value: patientList.length, bg: 'bg-primary/5', border: 'border-primary/10', text: 'text-primary' },
        { label: 'Male',           value: patientList.filter(p => (p.raw?.sex || '').toLowerCase() === 'male').length,   bg: 'bg-sky-50',  border: 'border-sky-100',  text: 'text-sky-600' },
        { label: 'Female',         value: patientList.filter(p => (p.raw?.sex || '').toLowerCase() === 'female').length, bg: 'bg-pink-50', border: 'border-pink-100', text: 'text-pink-600' },
    ];

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-5 pb-4"
        >
            {stats.map((s, i) => (
                <motion.div
                    key={i}
                    whileHover={{ y: -3, boxShadow: '0 10px 25px rgba(0,0,0,0.07)' }}
                    className={`p-6 ${s.bg} border ${s.border} rounded-2xl transition-all`}
                >
                    <p className={`text-sm font-semibold ${s.text} mb-2`}>{s.label}</p>
                    <h3 className="text-3xl font-black text-slate-900 flex items-baseline">
                        <CountUp from={0} to={s.value} duration={2.2} separator="," />
                    </h3>
                </motion.div>
            ))}
        </motion.div>
    );
}
