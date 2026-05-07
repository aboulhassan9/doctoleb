import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@ui/contexts/AuthContext';
import { useToast } from '@ui/contexts/ToastContext';
import { useBrand } from '@ui/contexts/BrandContext';
import DashboardLayout from '@ui/components/layouts/DashboardLayout';
import { LoadingSkeleton } from '@ui/components/ui';
import { tenantConfigService } from '@core/services/tenantConfig';
import { stagger, fadeUp } from '@core/lib/animations';

export default function DoctorTenantSettingsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { displayName, refresh: refreshBrand } = useBrand();

  const [profile, setProfile] = useState(null);
  const [appConfig, setAppConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('brand');

  const [profileForm, setProfileForm] = useState({
    display_name: '', tenant_slug: '', timezone: '', default_locale: '',
  });
  const [configForm, setConfigForm] = useState({
    app_name: '', app_tagline: '', primary_color: '', secondary_color: '',
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
        primary_color: configResult.data.primary_color || '#0891b2',
        secondary_color: configResult.data.secondary_color || '#0f172a',
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

  const tabs = [
    { id: 'brand', label: 'Practice Info', icon: 'badge' },
    { id: 'appearance', label: 'Appearance', icon: 'palette' },
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Primary Color</label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={configForm.primary_color}
                        onChange={(e) => setConfigForm((p) => ({ ...p, primary_color: e.target.value }))}
                        className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer"
                      />
                      <input type="text" value={configForm.primary_color}
                        onChange={(e) => setConfigForm((p) => ({ ...p, primary_color: e.target.value }))}
                        className="flex-1 px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Secondary Color</label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={configForm.secondary_color}
                        onChange={(e) => setConfigForm((p) => ({ ...p, secondary_color: e.target.value }))}
                        className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer"
                      />
                      <input type="text" value={configForm.secondary_color}
                        onChange={(e) => setConfigForm((p) => ({ ...p, secondary_color: e.target.value }))}
                        className="flex-1 px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>
                </div>
                {/* Preview */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-2">Preview</p>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: configForm.primary_color }}>
                      {(configForm.app_name || 'DL')[0]}
                    </div>
                    <div>
                      <p className="font-semibold" style={{ color: configForm.secondary_color }}>{configForm.app_name || displayName}</p>
                      <p className="text-xs text-slate-500">{configForm.app_tagline || 'Your health, your way'}</p>
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
