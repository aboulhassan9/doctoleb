import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@ui/contexts/AuthContext';
import { useToast } from '@ui/contexts/ToastContext';
import { useBrand } from '@ui/contexts/BrandContext';
import DashboardLayout from '@ui/components/layouts/DashboardLayout';
import { LoadingSkeleton } from '@ui/components/ui';
import { tenantConfigService } from '@core/services/tenantConfig';
import { patientFormConfigService } from '@core/services/patientFormConfig';
import {
  PATIENT_FORM_CONTEXTS,
  PATIENT_FORM_SECTIONS,
  PATIENT_ONBOARDING_LOCKED_REQUIRED_KEYS,
  getPatientFormRegistry,
} from '@core/schemas';
import { stagger, fadeUp } from '@core/lib/animations';

const PATIENT_FORM_CONTEXT_OPTIONS = [
  { id: PATIENT_FORM_CONTEXTS.onboarding, label: 'Onboarding', description: 'First-visit clinical readiness.' },
  { id: PATIENT_FORM_CONTEXTS.profile, label: 'Profile', description: 'Patient-owned identity and support fields.' },
  { id: PATIENT_FORM_CONTEXTS.appointmentBooking, label: 'Booking', description: 'Care request and appointment questions.' },
  { id: PATIENT_FORM_CONTEXTS.billingContact, label: 'Billing', description: 'Receipt and billing contact details.' },
  { id: PATIENT_FORM_CONTEXTS.checkIn, label: 'Check-in', description: 'Predoctor vitals and visit preparation.' },
];

const CUSTOM_FIELD_INITIAL = {
  key: '',
  label: '',
  section: '',
  type: 'text',
  options: '',
};

export default function DoctorTenantSettingsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { displayName, refresh: refreshBrand } = useBrand();
  const doctorId = user?.doctor_id || null;
  const userId = user?.id || null;

  const [profile, setProfile] = useState(null);
  const [appConfig, setAppConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('brand');
  const [activeFormContext, setActiveFormContext] = useState(PATIENT_FORM_CONTEXTS.onboarding);
  const [formConfigs, setFormConfigs] = useState([]);
  const [formsLoading, setFormsLoading] = useState(false);
  const [formsSaving, setFormsSaving] = useState(false);
  const [customDraft, setCustomDraft] = useState(CUSTOM_FIELD_INITIAL);

  const [profileForm, setProfileForm] = useState({
    display_name: '', tenant_slug: '', timezone: '', default_locale: '',
  });
  const [configForm, setConfigForm] = useState({
    app_name: '', app_tagline: '', primary_color: '', secondary_color: '',
    accent_color: '', surface_color: '', text_color: '',
    splash_logo_url: '', icon_url: '', support_phone: '', support_email: '',
    maintenance_message: '', min_supported_version: '', force_update_version: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [profileResult, configResult] = await Promise.all([
      tenantConfigService.getTenantProfile(),
      tenantConfigService.getAppConfig(),
    ]);
    if (profileResult.data) {
      setProfile(profileResult.data);
      setProfileForm({
        display_name: profileResult.data.display_name || '',
        tenant_slug: profileResult.data.tenant_slug || '',
        timezone: profileResult.data.timezone || 'Asia/Beirut',
        default_locale: profileResult.data.default_locale || 'en',
      });
    }
    if (configResult.data) {
      setAppConfig(configResult.data);
      setConfigForm({
        app_name: configResult.data.app_name || '',
        app_tagline: configResult.data.app_tagline || '',
        primary_color: configResult.data.primary_color || '#455548',
        secondary_color: configResult.data.secondary_color || '#263126',
        accent_color: configResult.data.accent_color || '#9b6a3f',
        surface_color: configResult.data.surface_color || '#fcf9f2',
        text_color: configResult.data.text_color || '#1c1c18',
        splash_logo_url: configResult.data.splash_logo_url || '',
        icon_url: configResult.data.icon_url || '',
        support_phone: configResult.data.support_phone || '',
        support_email: configResult.data.support_email || '',
        maintenance_message: configResult.data.maintenance_message || '',
        min_supported_version: configResult.data.min_supported_version || '',
        force_update_version: configResult.data.force_update_version || '',
      });
    }
    if (profileResult.error) showToast(profileResult.error, 'error');
    if (configResult.error) showToast(configResult.error, 'error');
    setLoading(false);
  }, [showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadFormConfigs = useCallback(async () => {
    if (!doctorId) {
      setFormConfigs([]);
      return;
    }

    setFormsLoading(true);
    const result = await patientFormConfigService.list({
      context: activeFormContext,
      scope: 'doctor',
      doctorId,
    });
    if (result.error) {
      showToast(result.error, 'error');
      setFormConfigs([]);
    } else {
      setFormConfigs(result.data || []);
    }
    setFormsLoading(false);
  }, [activeFormContext, doctorId, showToast]);

  useEffect(() => {
    if (activeTab === 'patientForms') {
      void loadFormConfigs();
    }
  }, [activeTab, loadFormConfigs]);

  const formRegistry = useMemo(
    () => getPatientFormRegistry(activeFormContext),
    [activeFormContext]
  );
  const formSections = PATIENT_FORM_SECTIONS[activeFormContext] || [];
  const configByField = useMemo(() => {
    const map = new Map();
    for (const row of formConfigs) map.set(`${row.field_kind}:${row.field_key}`, row);
    return map;
  }, [formConfigs]);
  const customRows = formConfigs.filter((row) => row.field_kind === 'custom' && row.status !== 'archived');

  const handleSaveProfile = async () => {
    setSaving(true);
    const result = await tenantConfigService.updateTenantProfile(profile.id, profileForm);
    if (result.error) {
      showToast(result.error, 'error');
    } else {
      showToast('Practice profile updated.', 'success');
      refreshBrand?.();
    }
    setSaving(false);
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    const payload = { ...configForm };
    // Clean empty strings to null
    for (const key of Object.keys(payload)) {
      if (payload[key] === '') payload[key] = null;
    }
    const result = await tenantConfigService.updateAppConfig(appConfig.id, payload);
    if (result.error) {
      showToast(result.error, 'error');
    } else {
      showToast('App configuration updated.', 'success');
      refreshBrand?.();
    }
    setSaving(false);
  };

  const handleSaveBaseField = async (field, patch) => {
    if (!doctorId) {
      showToast('Doctor profile is required before configuring patient fields.', 'error');
      return;
    }

    const existing = configByField.get(`base:${field.key}`);
    const lockedRequired = activeFormContext === PATIENT_FORM_CONTEXTS.onboarding
      && PATIENT_ONBOARDING_LOCKED_REQUIRED_KEYS.includes(field.key);

    setFormsSaving(true);
    const result = await patientFormConfigService.save({
      id: existing?.id,
      context: activeFormContext,
      scope: 'doctor',
      doctorId,
      fieldKind: 'base',
      fieldKey: field.key,
      section: patch.section ?? existing?.section ?? field.section,
      visible: lockedRequired ? true : (patch.visible ?? existing?.is_visible ?? true),
      required: lockedRequired ? true : (patch.required ?? existing?.is_required ?? field.required),
      order: patch.order ?? existing?.sort_order ?? field.order,
      label: patch.label ?? existing?.label ?? null,
      placeholder: patch.placeholder ?? existing?.placeholder ?? null,
      helpText: patch.helpText ?? existing?.help_text ?? null,
      rows: patch.rows ?? existing?.rows ?? field.rows,
    });
    if (result.error) {
      showToast(result.error, 'error');
    } else {
      showToast('Patient field rule saved.', 'success');
      await loadFormConfigs();
    }
    setFormsSaving(false);
  };

  const handleAddCustomField = async () => {
    if (!doctorId) {
      showToast('Doctor profile is required before configuring patient fields.', 'error');
      return;
    }

    const keySuffix = customDraft.key.trim().replace(/^custom\./, '').replace(/[^a-z0-9_]/g, '_');
    const fieldKey = `custom.${keySuffix}`;
    const options = customDraft.options
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [value, label] = line.split('|').map((part) => part?.trim());
        return { value, label: label || value };
      });

    setFormsSaving(true);
    const result = await patientFormConfigService.save({
      context: activeFormContext,
      scope: 'doctor',
      doctorId,
      fieldKind: 'custom',
      fieldKey,
      section: customDraft.section || formSections[0]?.id,
      type: customDraft.type,
      label: customDraft.label,
      options,
      createdBy: userId,
    });
    if (result.error) {
      showToast(result.error, 'error');
    } else {
      showToast('Custom patient field added.', 'success');
      setCustomDraft(CUSTOM_FIELD_INITIAL);
      await loadFormConfigs();
    }
    setFormsSaving(false);
  };

  const handleArchiveCustomField = async (id) => {
    setFormsSaving(true);
    const result = await patientFormConfigService.archive(id);
    if (result.error) {
      showToast(result.error, 'error');
    } else {
      showToast('Custom field archived.', 'success');
      await loadFormConfigs();
    }
    setFormsSaving(false);
  };

  const tabs = [
    { id: 'brand', label: 'Practice Info', icon: 'badge' },
    { id: 'appearance', label: 'Appearance', icon: 'palette' },
    { id: 'patientForms', label: 'Patient Forms', icon: 'dynamic_form' },
    { id: 'mobile', label: 'Mobile App', icon: 'smartphone' },
    { id: 'support', label: 'Support', icon: 'support_agent' },
  ];

  return (
    <DashboardLayout role="doctor" pageTitle="Tenant Settings">
      <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-6 p-6">

        <motion.div variants={fadeUp}>
          <h1 className="text-2xl font-bold text-slate-900">Practice Settings</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure your practice branding, mobile app appearance, and support info.
          </p>
        </motion.div>

        {loading ? <LoadingSkeleton rows={6} /> : (
          <>
            {/* Tab bar */}
            <motion.div variants={fadeUp} className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </motion.div>

            {/* Practice Info */}
            {activeTab === 'brand' && (
              <motion.div variants={fadeUp} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">badge</span>
                  Practice Profile
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Practice Name</label>
                    <input type="text" value={profileForm.display_name}
                      onChange={(e) => setProfileForm((p) => ({ ...p, display_name: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">URL Slug</label>
                    <div className="flex items-center">
                      <span className="text-xs text-slate-400 mr-1">dr-</span>
                      <input type="text" value={profileForm.tenant_slug}
                        onChange={(e) => setProfileForm((p) => ({ ...p, tenant_slug: e.target.value }))}
                        className="flex-1 px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="your-name"
                      />
                      <span className="text-xs text-slate-400 ml-1">.doctoleb.app</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Timezone</label>
                    <select value={profileForm.timezone}
                      onChange={(e) => setProfileForm((p) => ({ ...p, timezone: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="Asia/Beirut">Asia/Beirut (GMT+3)</option>
                      <option value="Europe/Paris">Europe/Paris (GMT+2)</option>
                      <option value="America/New_York">America/New_York (GMT-4)</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Default Language</label>
                    <select value={profileForm.default_locale}
                      onChange={(e) => setProfileForm((p) => ({ ...p, default_locale: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="en">English</option>
                      <option value="ar">العربية</option>
                      <option value="fr">Français</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button onClick={handleSaveProfile} disabled={saving}
                    className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium shadow-lg shadow-primary/20 hover:brightness-110 disabled:opacity-50 transition-all">
                    {saving ? 'Saving…' : 'Save Profile'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Appearance */}
            {activeTab === 'appearance' && (
              <motion.div variants={fadeUp} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">palette</span>
                  Brand Appearance
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">App Name</label>
                    <input type="text" value={configForm.app_name}
                      onChange={(e) => setConfigForm((p) => ({ ...p, app_name: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tagline</label>
                    <input type="text" value={configForm.app_tagline}
                      onChange={(e) => setConfigForm((p) => ({ ...p, app_tagline: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="Your health, your way"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[
                    ['primary_color', 'Primary Color'],
                    ['secondary_color', 'Secondary Color'],
                    ['accent_color', 'Accent Color'],
                    ['surface_color', 'Surface Color'],
                    ['text_color', 'Text Color'],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
                      <div className="flex items-center gap-3">
                        <input type="color" value={configForm[key] || '#000000'}
                          onChange={(e) => setConfigForm((p) => ({ ...p, [key]: e.target.value }))}
                          className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer"
                        />
                        <input type="text" value={configForm[key] || ''}
                          onChange={(e) => setConfigForm((p) => ({ ...p, [key]: e.target.value }))}
                          className="flex-1 px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Preview */}
                <div className="rounded-xl p-4" style={{ backgroundColor: configForm.surface_color || '#fcf9f2' }}>
                  <p className="text-xs text-slate-500 mb-2">Preview</p>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: configForm.primary_color }}>
                      {(configForm.app_name || 'DL')[0]}
                    </div>
                    <div>
                      <p className="font-semibold" style={{ color: configForm.text_color || configForm.secondary_color }}>{configForm.app_name || displayName}</p>
                      <p className="text-xs" style={{ color: configForm.accent_color || '#6d492c' }}>{configForm.app_tagline || 'Your health, your way'}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Logo URL</label>
                    <input type="url" value={configForm.splash_logo_url}
                      onChange={(e) => setConfigForm((p) => ({ ...p, splash_logo_url: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">App Icon URL</label>
                    <input type="url" value={configForm.icon_url}
                      onChange={(e) => setConfigForm((p) => ({ ...p, icon_url: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="https://..."
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button onClick={handleSaveConfig} disabled={saving}
                    className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium shadow-lg shadow-primary/20 hover:brightness-110 disabled:opacity-50 transition-all">
                    {saving ? 'Saving…' : 'Save Appearance'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Patient Forms */}
            {activeTab === 'patientForms' && (
              <motion.div variants={fadeUp} className="space-y-5">
                <section className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">dynamic_form</span>
                        Patient Journey Fields
                      </h2>
                      <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                        Configure visible and required patient fields from the allowlisted registry. This is zero-PHI configuration; patient answers stay in clinical tables and RPCs.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={loadFormConfigs}
                      disabled={formsLoading}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-base">refresh</span>
                      Refresh
                    </button>
                  </div>

                  <div className="mt-5 grid gap-3 lg:grid-cols-5">
                    {PATIENT_FORM_CONTEXT_OPTIONS.map((context) => (
                      <button
                        key={context.id}
                        type="button"
                        onClick={() => {
                          setActiveFormContext(context.id);
                          setCustomDraft(CUSTOM_FIELD_INITIAL);
                        }}
                        className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                          activeFormContext === context.id
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-primary/30'
                        }`}
                      >
                        <span className="block text-sm font-black">{context.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">{context.description}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="border-b border-slate-100 px-5 py-4">
                    <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">Base fields</h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {formsLoading ? (
                      <div className="p-5 text-sm font-semibold text-slate-500">Loading patient form rules...</div>
                    ) : formRegistry.map((field) => {
                      const existing = configByField.get(`base:${field.key}`);
                      const lockedRequired = activeFormContext === PATIENT_FORM_CONTEXTS.onboarding
                        && PATIENT_ONBOARDING_LOCKED_REQUIRED_KEYS.includes(field.key);
                      const visible = lockedRequired ? true : (existing?.is_visible ?? true);
                      const required = lockedRequired ? true : (existing?.is_required ?? field.required);
                      return (
                        <article key={field.key} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-bold text-slate-900">{existing?.label || field.label}</h4>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">{field.key}</span>
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">{field.section}</span>
                              {lockedRequired ? (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">Safety locked</span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm leading-6 text-slate-500">
                              {existing?.help_text || field.placeholder || 'No helper copy configured.'}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={formsSaving || lockedRequired}
                              onClick={() => handleSaveBaseField(field, { visible: !visible })}
                              className={`rounded-lg px-3 py-2 text-xs font-black transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                visible ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {visible ? 'Visible' : 'Hidden'}
                            </button>
                            <button
                              type="button"
                              disabled={formsSaving || lockedRequired}
                              onClick={() => handleSaveBaseField(field, { required: !required })}
                              className={`rounded-lg px-3 py-2 text-xs font-black transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                required ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {required ? 'Required' : 'Optional'}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">Add custom field</h3>
                    <div className="mt-4 space-y-3">
                      <input
                        type="text"
                        value={customDraft.key}
                        onChange={(event) => setCustomDraft((draft) => ({ ...draft, key: event.target.value }))}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="custom.follow_up_goal"
                      />
                      <input
                        type="text"
                        value={customDraft.label}
                        onChange={(event) => setCustomDraft((draft) => ({ ...draft, label: event.target.value }))}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="Patient-facing label"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={customDraft.section || formSections[0]?.id || ''}
                          onChange={(event) => setCustomDraft((draft) => ({ ...draft, section: event.target.value }))}
                          className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          {formSections.map((section) => (
                            <option key={section.id} value={section.id}>{section.title}</option>
                          ))}
                        </select>
                        <select
                          value={customDraft.type}
                          onChange={(event) => setCustomDraft((draft) => ({ ...draft, type: event.target.value }))}
                          className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          <option value="text">Text</option>
                          <option value="textarea">Textarea</option>
                          <option value="select">Select</option>
                        </select>
                      </div>
                      {customDraft.type === 'select' ? (
                        <textarea
                          value={customDraft.options}
                          onChange={(event) => setCustomDraft((draft) => ({ ...draft, options: event.target.value }))}
                          rows={4}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                          placeholder={'value|Label\nsecond_value|Second label'}
                        />
                      ) : null}
                      <button
                        type="button"
                        onClick={handleAddCustomField}
                        disabled={formsSaving}
                        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                      >
                        Add allowlisted custom field
                      </button>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">Custom fields in this context</h3>
                    <div className="mt-4 space-y-3">
                      {customRows.length ? customRows.map((row) => (
                        <div key={row.id} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3">
                          <div>
                            <p className="text-sm font-bold text-slate-900">{row.label}</p>
                            <p className="mt-1 text-xs font-mono text-slate-500">{row.field_key} · {row.section} · {row.field_type}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleArchiveCustomField(row.id)}
                            disabled={formsSaving}
                            className="rounded-lg px-3 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                          >
                            Archive
                          </button>
                        </div>
                      )) : (
                        <p className="rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                          No custom fields are active for this context. Base fields above still render from the shared registry.
                        </p>
                      )}
                    </div>
                  </div>
                </section>
              </motion.div>
            )}

            {/* Mobile App */}
            {activeTab === 'mobile' && (
              <motion.div variants={fadeUp} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">smartphone</span>
                  Mobile App Settings
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Min Supported Version</label>
                    <input type="text" value={configForm.min_supported_version}
                      onChange={(e) => setConfigForm((p) => ({ ...p, min_supported_version: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="1.0.0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Force Update Version</label>
                    <input type="text" value={configForm.force_update_version}
                      onChange={(e) => setConfigForm((p) => ({ ...p, force_update_version: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="1.0.0"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Maintenance Message</label>
                  <textarea value={configForm.maintenance_message}
                    onChange={(e) => setConfigForm((p) => ({ ...p, maintenance_message: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    placeholder="Leave empty for normal operation. Set a message to show a maintenance banner."
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <button onClick={handleSaveConfig} disabled={saving}
                    className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium shadow-lg shadow-primary/20 hover:brightness-110 disabled:opacity-50 transition-all">
                    {saving ? 'Saving…' : 'Save Mobile Settings'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Support */}
            {activeTab === 'support' && (
              <motion.div variants={fadeUp} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">support_agent</span>
                  Support Contact
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Support Phone</label>
                    <input type="tel" value={configForm.support_phone}
                      onChange={(e) => setConfigForm((p) => ({ ...p, support_phone: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="+961 ..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Support Email</label>
                    <input type="email" value={configForm.support_email}
                      onChange={(e) => setConfigForm((p) => ({ ...p, support_email: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="support@yourdomain.com"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button onClick={handleSaveConfig} disabled={saving}
                    className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium shadow-lg shadow-primary/20 hover:brightness-110 disabled:opacity-50 transition-all">
                    {saving ? 'Saving…' : 'Save Contact Info'}
                  </button>
                </div>
              </motion.div>
            )}
          </>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
