/**
 * NotificationSettingsModal — Modal for configuring notification preferences.
 *
 * Contains: clinical alerts toggles, system notification toggles,
 * delivery methods (in-app, push, email, SMS), and alert sound selection.
 *
 * Replaces ~180 lines of inline modal from PreDoctorNotificationsPage.
 * Note: Settings are currently UI-only (not persisted to backend).
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const INITIAL_SETTINGS = {
    criticalVitals: true,
    newPatient: true,
    labResults: false,
    systemUpdates: true,
    securityAlerts: true,
    maintenance: false,
    inAppToast: true,
    browserPush: true,
    emailSummary: true,
    emailFrequency: 'daily',
    sms: false,
    criticalSound: 'High Alert Siren',
    warningSound: 'Standard Ping',
    infoSound: 'Muted',
};

function ToggleRow({ label, description, checked, onChange }) {
    return (
        <div className="flex items-center justify-between">
            <div>
                <p className="text-sm font-bold text-slate-800">{label}</p>
                <p className="text-xs text-slate-500">{description}</p>
            </div>
            <button onClick={onChange} className={`w-12 h-6 rounded-full transition-all ${checked ? 'bg-primary' : 'bg-slate-200'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
            </button>
        </div>
    );
}

function SoundSelector({ icon, iconColor, label, value, onChange, options }) {
    return (
        <div className="bg-white p-5 rounded-xl border border-slate-100">
            <div className="flex items-center gap-2 mb-3">
                <span className={`material-symbols-outlined ${iconColor} text-lg`}>{icon}</span>
                <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
            </div>
            <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-slate-50 border-none rounded-lg text-sm font-bold py-2.5 px-3">
                {options.map(opt => <option key={opt}>{opt}</option>)}
            </select>
        </div>
    );
}

export default function NotificationSettingsModal({ isOpen, onClose }) {
    const [settings, setSettings] = useState(INITIAL_SETTINGS);

    const update = (key) => setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    const set = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Notification Settings</h3>
                                <p className="text-xs text-slate-500 mt-1">Configure how you receive critical clinical alerts.</p>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                <span className="material-symbols-outlined text-slate-400">close</span>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-8 overflow-y-auto space-y-8">
                            {/* Alert toggles */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Clinical Alerts */}
                                <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                                    <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-50 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-critical">emergency</span>
                                        <h4 className="font-bold text-slate-900">Clinical Alerts</h4>
                                    </div>
                                    <div className="p-6 space-y-5">
                                        <ToggleRow label="Critical Vitals" description="Alert for patients exceeding thresholds" checked={settings.criticalVitals} onChange={() => update('criticalVitals')} />
                                        <ToggleRow label="New Patient Assignment" description="Alert when new patient assigned" checked={settings.newPatient} onChange={() => update('newPatient')} />
                                        <ToggleRow label="Lab Results" description="Notification for lab diagnostics" checked={settings.labResults} onChange={() => update('labResults')} />
                                    </div>
                                </div>

                                {/* System Notifications */}
                                <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                                    <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-50 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-slate-600">settings_suggest</span>
                                        <h4 className="font-bold text-slate-900">System Notifications</h4>
                                    </div>
                                    <div className="p-6 space-y-5">
                                        <ToggleRow label="System Updates" description="Deployment notifications" checked={settings.systemUpdates} onChange={() => update('systemUpdates')} />
                                        <ToggleRow label="Security Alerts" description="Security warnings" checked={settings.securityAlerts} onChange={() => update('securityAlerts')} />
                                        <ToggleRow label="Maintenance Schedule" description="System maintenance alerts" checked={settings.maintenance} onChange={() => update('maintenance')} />
                                    </div>
                                </div>
                            </div>

                            {/* Delivery Methods */}
                            <div className="bg-slate-50 rounded-xl border border-slate-100 p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h4 className="font-bold text-slate-900">Delivery Methods</h4>
                                        <p className="text-xs text-slate-500">Select how you want to be notified.</p>
                                    </div>
                                    <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase">Multi-Channel</span>
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <label className="flex items-center p-4 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-primary transition-all">
                                        <input checked={settings.inAppToast} onChange={() => update('inAppToast')} className="w-5 h-5 rounded border-slate-300 text-primary" type="checkbox" />
                                        <div className="ml-3">
                                            <p className="text-sm font-bold text-slate-900">In-App Toast</p>
                                            <p className="text-[10px] text-slate-500">Active session</p>
                                        </div>
                                    </label>
                                    <label className="flex items-center p-4 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-primary transition-all">
                                        <input checked={settings.browserPush} onChange={() => update('browserPush')} className="w-5 h-5 rounded border-slate-300 text-primary" type="checkbox" />
                                        <div className="ml-3">
                                            <p className="text-sm font-bold text-slate-900">Browser Push</p>
                                            <p className="text-[10px] text-slate-500">System level</p>
                                        </div>
                                    </label>
                                    <div className="flex items-start p-4 bg-white rounded-xl border border-slate-200">
                                        <input checked={settings.emailSummary} onChange={() => update('emailSummary')} className="mt-1 w-5 h-5 rounded border-slate-300 text-primary" type="checkbox" />
                                        <div className="ml-3 flex-1">
                                            <p className="text-sm font-bold text-slate-900">Email</p>
                                            <select value={settings.emailFrequency} onChange={(e) => set('emailFrequency', e.target.value)} className="mt-2 w-full text-xs border-none bg-slate-50 rounded-lg py-1.5 px-2">
                                                <option>Daily</option>
                                                <option>Weekly</option>
                                            </select>
                                        </div>
                                    </div>
                                    <label className="flex items-center p-4 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-primary transition-all">
                                        <input checked={settings.sms} onChange={() => update('sms')} className="w-5 h-5 rounded border-slate-300 text-primary" type="checkbox" />
                                        <div className="ml-3">
                                            <p className="text-sm font-bold text-slate-900">SMS</p>
                                            <p className="text-[10px] text-critical font-bold uppercase">Critical only</p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Sound selectors */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <SoundSelector icon="volume_up" iconColor="text-critical" label="Critical Alerts" value={settings.criticalSound} onChange={(v) => set('criticalSound', v)} options={['High Alert Siren', 'Urgent Pulse', 'Digital Alarm']} />
                                <SoundSelector icon="volume_down" iconColor="text-warning" label="Warnings" value={settings.warningSound} onChange={(v) => set('warningSound', v)} options={['Standard Ping', 'Subtle Chime', 'Soft Buzz']} />
                                <SoundSelector icon="volume_mute" iconColor="text-slate-400" label="Informational" value={settings.infoSound} onChange={(v) => set('infoSound', v)} options={['Muted', 'Single Click', 'Low Tone']} />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2 text-slate-400">
                                <span className="material-symbols-outlined text-sm">info</span>
                                <span className="text-xs font-medium">Changes apply immediately across devices.</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-slate-600 font-bold hover:bg-slate-200 transition-colors text-sm">Cancel</button>
                                <button onClick={onClose} className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold hover:brightness-110 transition-all text-sm">Save Changes</button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
