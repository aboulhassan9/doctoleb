/**
 * Shared constants and style maps for appointment calendar views.
 */
import { motion } from 'framer-motion';

/* ── Calendar labels ── */
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const CAL_DAYS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* ── Time grid dimensions ── */
export const HOUR_HEIGHT = 96;
export const START_HOUR  = 8;
export const END_HOUR    = 18;
export const HOURS = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, i) => START_HOUR + i,
);

/* ── Department / service catalog ──
   TODO: Replace with dynamic fetch from service catalog once available. */
export const DEPARTMENTS = [
  'General Consultation', 'Cardiology', 'Pediatrics', 'Neurology',
  'Orthopedics', 'Dermatology', 'Ophthalmology', 'Psychiatry',
];

/* ── Slot display times (used in the schedule modal) ── */
export const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30',
];

/* ── Priority options ── */
export const PRIORITY_OPTS = [
  { label: 'Low',    val: 'low',    checked: 'bg-success/10 border-success text-success' },
  { label: 'Medium', val: 'medium', checked: 'bg-warning/10  border-warning  text-warning' },
  { label: 'Urgent', val: 'urgent', checked: 'bg-red-50    border-critical    text-critical' },
];

/* ── Blank appointment form default ── */
export const BLANK_APPT = {
  patient_id: '',
  department: DEPARTMENTS[0],
  doctor_id: '',
  reason: '',
  time: '',
  priority: 'medium',
};

/* ── Shared form input class ── */
export const sInput =
  'w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all';

/* ── Week Style Map — controls card appearance in the week time-grid ── */
export const WSM = {
  primary: { card: 'bg-primary border-transparent shadow-lg shadow-primary/20', time: 'text-blue-100',   name: 'text-white',     type: 'text-blue-100/75' },
  light:   { card: 'bg-white border border-primary/20 shadow-sm',               time: 'text-primary',    name: 'text-slate-900', type: 'text-slate-500' },
  dark:    { card: 'bg-slate-900 border border-slate-700 shadow-lg',             time: 'text-slate-400',  name: 'text-white',     type: 'text-slate-300' },
  amber:   { card: 'bg-warning/10 border-l-4 border-warning',                   time: 'text-warning',    name: 'text-slate-900', type: 'text-warning/80' },
  indigo:  { card: 'bg-indigo-100 border-l-4 border-indigo-500',                time: 'text-indigo-700', name: 'text-indigo-900', type: 'text-indigo-600' },
  emerald: { card: 'bg-success/10 border-l-4 border-success',                   time: 'text-success',    name: 'text-slate-900', type: 'text-success' },
};

/* ── Day Style Map — controls card appearance in the day view ── */
export const DSM = {
  confirmed: { card: 'bg-primary/5 border-l-4 border-blue-600',  time: 'text-blue-800',  name: 'text-slate-900', type: 'text-primary/70',  badge: 'bg-primary-hover/10 text-primary' },
  active:    { card: 'bg-primary shadow-md scale-[1.01]',        time: 'text-blue-100',  name: 'text-white',     type: 'text-blue-100/80', badge: 'bg-white/20 text-white' },
  pending:   { card: 'bg-warning/10 border-l-4 border-warning',  time: 'text-amber-800', name: 'text-slate-900', type: 'text-warning/70',  badge: 'bg-warning/100/10 text-warning' },
};

/* ── Reusable micro-components ── */

/** Small form label used in appointment forms */
export function SLabel({ children }) {
  return (
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">
      {children}
    </p>
  );
}

/** Bordered icon button (prev/next navigation) */
export function IconBtn({ icon, onClick, className = '' }) {
  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      className={`p-2 bg-white rounded-xl border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors ${className}`}
    >
      <span className="material-symbols-outlined text-slate-600">{icon}</span>
    </motion.button>
  );
}
