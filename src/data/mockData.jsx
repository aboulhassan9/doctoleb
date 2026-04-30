/* ════════════════════════════════════════════════════════════════
   CENTRAL MOCK DATA REPOSITORY
   This file contains all the dummy data used across the application.
   Removing these from the UI components prepares the codebase for
   backend integration.
   ════════════════════════════════════════════════════════════════ */
import React from 'react';

// --- GLOBAL / SHARED ---
export const CURRENT_USER = {
    name: 'Sarah Jenkins',
    role: 'Head Secretary',
    initials: 'SJ',
    avatar: null
};

export const DOCTOR_USER = {
    name: 'Dr. Julian Thorne',
    role: 'Chief Resident',
    initials: 'JT',
    department: 'General Practice'
};

export const PREDOCTOR_USER = {
    name: 'Dr. Aris Thorne',
    role: 'Pre-Doctor',
    initials: 'AT'
};

// --- SECRETARY MODULE ---
export const SECRETARY_STATS = [
    { label: 'Pending Appointments', value: 12, icon: 'calendar_month', trend: '+4 more than yesterday', trendIcon: 'trending_up', trendCls: 'text-success' },
    { label: 'New Registrations', value: 8, icon: 'person_add', trend: 'Daily target reached', trendIcon: 'group_add', trendCls: 'text-primary' },
    { label: 'Pending Payments', value: 1420, prefix: '$', icon: 'credit_card', trend: '3 invoices overdue', trendIcon: 'history', trendCls: 'text-warning' },
];

export const PATIENTS = [
    { id: '#PT-8801', name: 'James Wilson', initials: 'JW', color: 'bg-primary/10 text-primary', phone: '(555) 123-4567', visit: 'Apr 12, 2026' },
    { id: '#PT-8802', name: 'Maria Garcia', initials: 'MG', color: 'bg-secondary/10 text-secondary', phone: '(555) 987-6543', visit: 'Apr 15, 2026' },
    { id: '#PT-8803', name: 'Robert Chen', initials: 'RC', color: 'bg-success/10 text-success', phone: '(555) 246-8135', visit: 'Apr 16, 2026' },
    { id: '#PT-8804', name: 'Sarah Miller', initials: 'SM', color: 'bg-warning/10 text-warning', phone: '(555) 369-1470', visit: 'Apr 17, 2026' },
    { id: '#PT-8805', name: 'William Taylor', initials: 'WT', color: 'bg-secondary/10 text-secondary', phone: '(555) 159-7531', visit: 'Apr 18, 2026' },
];

export const SECRETARY_ACTIVITIES = [
    { icon: 'check_circle', bg: 'bg-success/10', text: 'text-success', msg: <><span className="font-black text-slate-800">John Doe</span> checked-in for General Checkup.</>, sub: '10 min ago · Dr. Smith', time: '10:45 AM' },
    { icon: 'person_add', bg: 'bg-primary/10', text: 'text-primary', msg: <><span className="font-black text-slate-800">Mary Williams</span> was added to the database.</>, sub: '25 min ago · Secretary Sarah', time: '10:30 AM' },
    { icon: 'payments', bg: 'bg-warning/10', text: 'text-warning', msg: <>Payment of <span className="font-black text-slate-800">$150.00</span> received from Robert Black.</>, sub: '1 hour ago · Invoice #8842', time: '09:50 AM' },
    { icon: 'cancel', bg: 'bg-critical/10', text: 'text-critical', msg: <>Appointment for <span className="font-black text-slate-800">Linda Carter</span> was cancelled.</>, sub: '2 hours ago · Dr. Patel', time: '09:05 AM' },
];

export const FOOTER_STATS = [
    { label: 'Total Patients', value: 1284, prefix: '', suffix: '', bg: 'bg-primary/5', border: 'border-primary/10', text: 'text-primary' },
    { label: 'New This Month', value: 48, prefix: '+', suffix: '', bg: 'bg-success/5', border: 'border-success/10', text: 'text-success' },
    { label: 'Active Records', value: 94, prefix: '', suffix: '%', bg: 'bg-primary/5', border: 'border-primary/10', text: 'text-primary' },
];

// --- BILLING DATA ---
export const BILLING_INVOICES = [
    { id: '#INV-88241', patient: 'Johnathan Doe', initials: 'JD', date: 'Oct 24, 2023', amount: 420.00, status: 'Paid', statusCls: 'bg-success/10 text-success' },
    { id: '#INV-88242', patient: 'Amanda Smith', initials: 'AS', date: 'Oct 24, 2023', amount: 1250.00, status: 'Pending', statusCls: 'bg-warning/10 text-warning' },
    { id: '#INV-88243', patient: 'Robert King', initials: 'RK', date: 'Oct 23, 2023', amount: 185.50, status: 'Overdue', statusCls: 'bg-red-50 text-critical' },
    { id: '#INV-88244', patient: 'Linda Miller', initials: 'LM', date: 'Oct 23, 2023', amount: 300.00, status: 'Paid', statusCls: 'bg-success/10 text-success' },
    { id: '#INV-88245', patient: 'Thomas Clark', initials: 'TC', date: 'Oct 22, 2023', amount: 2450.00, status: 'Pending', statusCls: 'bg-warning/10 text-warning' },
];

export const BILLING_STATS = [
    { label: 'Total Invoices', value: 1248, icon: 'description', badge: '12% from last month', badgeCls: 'text-success bg-success/10' },
    { label: 'Total Revenue', value: 142580, icon: 'payments', badge: 'System Target: 94%', badgeCls: 'text-primary bg-primary/5' },
    { label: 'Unpaid Balance', value: 12450, icon: 'account_balance_wallet', badge: '18 overdue invoices', badgeCls: 'text-critical bg-red-50' },
];

export const BILLING_ACTIVITY = [
    { icon: 'check_circle', iconCls: 'bg-success/10 text-success', title: 'Payment Received from Johnathan Doe', sub: 'Invoice #INV-88241 • Credit Card • 2 hours ago', amount: '+$420.00' },
    { icon: 'check_circle', iconCls: 'bg-success/10 text-success', title: 'Payment Received from Linda Miller', sub: 'Invoice #INV-88244 • Insurance Payout • 5 hours ago', amount: '+$300.00' },
    { icon: 'info', iconCls: 'bg-warning/10 text-warning', title: 'Pending Verification for Thomas Clark', sub: 'Invoice #INV-88245 • Bank Transfer • 8 hours ago', amount: '$2,450.00', mutedAmount: true },
];

export const BILLING_BAR_DATA = [
    { day: 'Mon', h: '60%', cls: 'bg-primary/20' },
    { day: 'Tue', h: '80%', cls: 'bg-primary/40' },
    { day: 'Wed', h: '45%', cls: 'bg-primary/60' },
    { day: 'Thu', h: '95%', cls: 'bg-primary', isToday: true },
    { day: 'Fri', h: '30%', cls: 'bg-slate-200' },
    { day: 'Sat', h: '20%', cls: 'bg-slate-200' },
];

// --- APPOINTMENTS DATA ---
export const APPOINTMENTS_MONTH = {
    '2026-4-3': [{ time: '09:00', patient: 'Clara S.', cls: 'bg-success/10 text-success border-l-2 border-success' }],
    '2026-4-7': [
        { time: '09:30', patient: 'Robert M.', cls: 'bg-primary/10 text-primary border-l-2 border-primary' },
        { time: '11:00', patient: 'Jim A.', cls: 'bg-secondary/10 text-secondary border-l-2 border-indigo-500' },
    ],
    '2026-4-10': [{ time: '14:00', patient: 'David K.', cls: 'bg-warning/10 text-warning border-l-2 border-warning' }],
    '2026-4-14': [
        { time: '08:00', patient: 'Alice J.', cls: 'bg-primary/10 text-primary border-l-2 border-primary' },
        { time: '13:30', patient: 'Frank W.', cls: 'bg-primary/10 text-primary border-l-2 border-primary' },
    ],
    '2026-4-18': [
        { time: '10:00', patient: 'May Chen', cls: 'bg-secondary/10 text-secondary border-l-2 border-indigo-500' },
        { time: '14:00', patient: 'Paul N.', cls: 'bg-success/10 text-success border-l-2 border-success' },
    ],
    '2026-4-22': [{ time: '09:00', patient: 'Lucy R.', cls: 'bg-warning/10 text-warning border-l-2 border-warning' }],
    '2026-4-25': [{ time: '11:30', patient: 'Dan P.', cls: 'bg-primary/10 text-primary border-l-2 border-primary' }],
    '2026-4-28': [{ time: '15:00', patient: 'Ann M.', cls: 'bg-success/10 text-success border-l-2 border-success' }],
};

export const APPOINTMENTS_WEEK = [
    { dayIdx: 1, startH: 9, startM: 0, dur: 90, patient: 'Tiffany Chen', type: 'Post-op Checkup', style: 'primary' },
    { dayIdx: 1, startH: 14, startM: 0, dur: 45, patient: 'Michael Ross', type: 'Consultation', style: 'light' },
    { dayIdx: 2, startH: 10, startM: 15, dur: 60, patient: 'Arthur Morgan', type: 'Cardiology Panel', style: 'dark' },
    { dayIdx: 3, startH: 13, startM: 0, dur: 60, patient: 'Frank Wright', type: 'Post-Op Assessment', style: 'amber' },
    { dayIdx: 5, startH: 10, startM: 0, dur: 60, patient: 'May Chen', type: 'Consultation', style: 'indigo' },
    { dayIdx: 5, startH: 14, startM: 0, dur: 60, patient: 'Paul Newman', type: 'Blood Test', style: 'emerald' },
];

export const APPOINTMENTS_DAY = [
    { startH: 8, startM: 0, dur: 45, patient: 'Emily Davis', type: 'Routine Check-up · Room 302', status: 'Confirmed', sn: 'confirmed' },
    { startH: 9, startM: 15, dur: 45, patient: 'Alice Johnson', type: 'Follow-up Consultation · Room 104', status: 'In Progress', sn: 'active' },
    { startH: 11, startM: 30, dur: 45, patient: 'Michael Ross', type: 'Lab Results Review · Room 210', status: 'Pending', sn: 'pending' },
    { startH: 13, startM: 0,  dur: 60, patient: 'Frank Wright',   type: 'Post-Op Assessment · Specialist Wing', status: 'Confirmed',   sn: 'confirmed' },
];

export const TODAY_SCHEDULE = [
    { time: '08:30', patient: 'Alice Johnson', type: 'General Check-up', status: 'In Progress', sc: 'bg-primary text-white', cc: 'bg-primary/5 border-l-4 border-primary' },
    { time: '10:00', patient: 'May Chen', type: 'Consultation', status: 'Confirmed', sc: 'bg-success/10 text-success', cc: 'bg-white border border-slate-100' },
    { time: '14:00', patient: 'Paul Newman', type: 'Blood Test', status: 'Pending', sc: 'bg-warning/10 text-warning', cc: 'bg-white border border-slate-100' },
    { time: '16:00', patient: 'Emily Davis', type: 'X-Ray Review', status: 'Confirmed', sc: 'bg-success/10 text-success', cc: 'bg-white border border-slate-100' },
];

export const DEPARTMENTS = ['Cardiology Consultation', 'General Check-up', 'Dermatology', 'Physiotherapy', 'Pediatrics', 'Ophthalmology'];
export const DOCTORS = ['Dr. Aris Thorne', 'Dr. Elena Vance', 'Dr. Marcus Holloway', 'Dr. Sarah Lin', 'Dr. Robert Chen'];
export const TIME_SLOTS = ['09:00 AM', '10:30 AM', '11:00 AM', '01:15 PM', '02:00 PM', '03:30 PM', '04:00 PM', '04:45 PM'];
export const BUSY_SLOTS = ['11:00 AM', '03:30 PM'];

// --- DOCTOR MODULE ---
export const DOCTOR_STATS = [
    { label: 'Total Patients', value: '1,284', icon: 'groups', color: 'bg-primary/10 text-primary', change: '+12%', changeColor: 'text-success' },
    { label: "Today's Appointments", value: '14', icon: 'event_note', color: 'bg-primary/10 text-primary', change: 'Today', changeColor: 'text-primary' },
    { label: 'Pending Pre-Checks', value: '6', icon: 'pending_actions', color: 'bg-warning/10 text-warning', change: 'Action Needed', changeColor: 'text-warning' },
    { label: 'Unread Notifications', value: '3', icon: 'mail', color: 'bg-critical/10 text-critical', change: 'New', changeColor: 'text-critical' },
];

export const DOCTOR_ALERTS = [
    { type: 'critical', title: 'Critical Vitals: Sarah Miller', message: 'BP 165/105 mmHg - Immediate review required.', icon: 'warning' },
    { type: 'info', title: 'Lab Result Ready: Arthur Morgan', message: 'Blood Chemistry panel completed at 09:15 AM.', icon: 'lab_research' },
];

export const DOCTOR_APPOINTMENTS = [
    { name: 'Sarah Miller', initials: 'SM', time: '09:00 AM', status: 'Confirmed', statusColor: 'bg-success/10 text-success' },
    { name: 'Arthur Morgan', initials: 'AM', time: '09:45 AM', status: 'In Progress', statusColor: 'bg-primary/10 text-primary' },
    { name: 'Evelyn Harper', initials: 'EH', time: '10:30 AM', status: 'Waiting', statusColor: 'bg-warning/10 text-warning' },
    { name: 'James Wilson', initials: 'JW', time: '11:15 AM', status: 'Confirmed', statusColor: 'bg-success/10 text-success' },
];

// --- PRE-DOCTOR MODULE ---
export const PREDOCTOR_STATS = [
    { label: 'Total Patients Today', value: 24, icon: 'person_search', color: 'bg-primary/10 text-primary', trend: '+12% vs yesterday', trendUp: true },
    { label: 'Pending Pre-Checks', value: 5, icon: 'pending_actions', color: 'bg-warning/10 text-warning', attention: true },
    { label: 'Completed Pre-Checks', value: 19, icon: 'verified', color: 'bg-success/10 text-success', progress: 80 },
];

export const PREDOCTOR_PATIENTS = [
    { name: 'Sarah Miller', id: '#CP-9021', initials: 'SM', time: '09:30 AM', status: 'Waiting', focus: 'General Screening', statusColor: 'bg-warning/10 text-warning' },
    { name: 'James Wilson', id: '#CP-8842', initials: 'JW', time: '10:15 AM', status: 'In Progress', focus: 'Post-Op Vital Review', statusColor: 'bg-primary/10 text-primary' },
    { name: 'Emily Chen', id: '#CP-7719', initials: 'EC', time: '11:00 AM', status: 'Waiting', focus: 'Cardiology Baseline', statusColor: 'bg-warning/10 text-warning' },
    { name: 'Michael Brown', id: '#CP-6634', initials: 'MB', time: '11:45 AM', status: 'Scheduled', focus: 'Blood Pressure Check', statusColor: 'bg-secondary/10 text-secondary' },
    { name: 'Lisa Anderson', id: '#CP-5521', initials: 'LA', time: '12:30 PM', status: 'Scheduled', focus: 'Diabetes Screening', statusColor: 'bg-secondary/10 text-secondary' },
];
