import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { tenantConfigService } from '@/services/tenantConfig';

const DEFAULT_BRAND = {
  display_name: 'Clinic Portal',
  tagline: 'Clinic care, scheduling, and patient follow-up.',
  logo_url: null,
  favicon_url: null,
  primary_color: '#0891b2',
  secondary_color: '#0f172a',
  contact_phone: null,
  contact_email: null,
  website_url: null,
  about_md: null,
  doctor_display_name: null,
  doctor_tagline: null,
  doctor_logo_url: null,
  doctor_contact_phone: null,
  doctor_contact_email: null,
  doctor_website_url: null,
  languages: ['en'],
};

const BrandContext = createContext(null);

const APP_SURFACE_LABELS = Object.freeze({
  'patient-web': 'Patient Portal',
  'clinic-ops': 'Clinic Operations',
});

const SEED_BRAND_PLACEHOLDERS = new Set([
  'doctoleb',
  'doctor practice',
  'dr. smith',
]);

function isSeedPlaceholder(value) {
  if (!value || typeof value !== 'string') return true;
  return SEED_BRAND_PLACEHOLDERS.has(value.trim().toLowerCase());
}

function firstConfiguredValue(...values) {
  return values.find((value) => !isSeedPlaceholder(value));
}

function normalizeHexColor(value, fallback) {
  if (typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value.trim())) {
    return value.trim();
  }
  return fallback;
}

function hexToRgbParts(hex) {
  const value = normalizeHexColor(hex, '#0891b2').replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ].join(' ');
}

function shadeHexColor(hex, percent) {
  const value = normalizeHexColor(hex, '#0891b2').replace('#', '');
  const amount = Math.round(2.55 * percent);
  const channels = [0, 2, 4].map((index) => {
    const channel = parseInt(value.slice(index, index + 2), 16);
    return Math.max(0, Math.min(255, channel + amount));
  });

  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function normalizeBrand(row) {
  const config = Array.isArray(row) ? row[0] : row;
  const appConfig = config?.app || config?.app_config || config;
  const profile = config?.profile || config?.tenant_profile || {};

  return {
    ...DEFAULT_BRAND,
    display_name: firstConfiguredValue(appConfig?.app_name, profile?.display_name, config?.display_name) || DEFAULT_BRAND.display_name,
    tagline: firstConfiguredValue(appConfig?.app_tagline, config?.tagline) || DEFAULT_BRAND.tagline,
    logo_url: appConfig?.splash_logo_url || config?.logo_url || null,
    favicon_url: appConfig?.icon_url || config?.favicon_url || null,
    primary_color: normalizeHexColor(appConfig?.primary_color || config?.primary_color, DEFAULT_BRAND.primary_color),
    secondary_color: normalizeHexColor(appConfig?.secondary_color || config?.secondary_color, DEFAULT_BRAND.secondary_color),
    contact_phone: appConfig?.support_phone || config?.contact_phone || null,
    contact_email: appConfig?.support_email || config?.contact_email || null,
    website_url: config?.doctor_website_url || config?.website_url || null,
    about_md: config?.doctor_about_md || profile?.about_md || config?.about_md || null,
    doctor_display_name: firstConfiguredValue(config?.doctor_display_name, profile?.doctor_display_name) || null,
    doctor_tagline: firstConfiguredValue(config?.doctor_tagline, config?.tagline) || null,
    doctor_logo_url: config?.doctor_logo_url || null,
    doctor_contact_phone: config?.doctor_contact_phone || null,
    doctor_contact_email: config?.doctor_contact_email || null,
    doctor_website_url: config?.doctor_website_url || null,
    languages: appConfig?.enabled_locales || config?.languages || DEFAULT_BRAND.languages,
    maintenance_message: appConfig?.maintenance_message || null,
    min_supported_version: appConfig?.min_supported_version || null,
    force_update_version: appConfig?.force_update_version || null,
    tenant_status: profile?.status || config?.status || 'active',
  };
}

function applyTenantFavicon(faviconUrl) {
  const existingIcon = document.querySelector("link[rel='icon']");
  const icon = existingIcon || document.createElement('link');
  icon.setAttribute('rel', 'icon');

  if (faviconUrl) {
    icon.setAttribute('href', faviconUrl);
  } else {
    icon.setAttribute('href', "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='%230891b2'/><path d='M30 16h4v14h14v4H34v14h-4V34H16v-4h14z' fill='white'/></svg>");
  }

  if (!existingIcon) document.head.appendChild(icon);
}

export function BrandProvider({ children, appSurface = 'patient-web' }) {
  const [brand, setBrand] = useState(DEFAULT_BRAND);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async (shouldApply = () => true) => {
    try {
      setLoading(true);
      const result = await tenantConfigService.getPublicConfig();

      if (!shouldApply()) return;

      if (result.error) {
        setBrand(DEFAULT_BRAND);
        setError(result.error);
      } else {
        setBrand(normalizeBrand(result.data));
        setError(null);
      }
    } catch (brandError) {
      if (!shouldApply()) return;
      setBrand(DEFAULT_BRAND);
      setError(brandError.message || 'Failed to load tenant app configuration.');
    } finally {
      if (shouldApply()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    void refresh(() => isMounted);

    return () => {
      isMounted = false;
    };
  }, [refresh]);

  useEffect(() => {
    let isMounted = true;
    const refreshVisibleBrand = () => {
      if (document.visibilityState === 'hidden') return;
      void refresh(() => isMounted);
    };

    window.addEventListener('focus', refreshVisibleBrand);
    document.addEventListener('visibilitychange', refreshVisibleBrand);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', refreshVisibleBrand);
      document.removeEventListener('visibilitychange', refreshVisibleBrand);
    };
  }, [refresh]);

  useEffect(() => {
    const root = document.documentElement;
    const primary = normalizeHexColor(brand.primary_color, DEFAULT_BRAND.primary_color);
    const primaryHover = shadeHexColor(primary, -8);
    const secondary = normalizeHexColor(brand.secondary_color, DEFAULT_BRAND.secondary_color);

    root.style.setProperty('--doctor-brand-primary', primary);
    root.style.setProperty('--doctor-brand-secondary', secondary);
    root.style.setProperty('--tenant-brand-primary', primary);
    root.style.setProperty('--tenant-brand-secondary', secondary);
    root.style.setProperty('--color-primary', primary);
    root.style.setProperty('--color-primary-rgb', hexToRgbParts(primary));
    root.style.setProperty('--color-primary-hover', primaryHover);
    root.style.setProperty('--color-primary-hover-rgb', hexToRgbParts(primaryHover));
    root.style.setProperty('--color-secondary', secondary);
    root.style.setProperty('--color-secondary-rgb', hexToRgbParts(secondary));
    root.style.setProperty('--color-primary-light', `rgb(${hexToRgbParts(primary)} / 0.1)`);
  }, [brand.primary_color, brand.secondary_color]);

  useEffect(() => {
    const surfaceLabel = APP_SURFACE_LABELS[appSurface] || 'Portal';
    const name = brand.display_name || DEFAULT_BRAND.display_name;
    document.title = `${name} — ${surfaceLabel}`;

    const metaDescription = document.querySelector("meta[name='description']");
    if (metaDescription) {
      metaDescription.setAttribute('content', `${name} ${surfaceLabel} — ${brand.tagline || DEFAULT_BRAND.tagline}`);
    }

    applyTenantFavicon(brand.favicon_url || brand.logo_url);
  }, [appSurface, brand.display_name, brand.favicon_url, brand.logo_url, brand.tagline]);

  const value = useMemo(() => ({
    brand,
    loading,
    error,
    displayName: brand.display_name || DEFAULT_BRAND.display_name,
    tagline: brand.tagline || DEFAULT_BRAND.tagline,
    refresh,
  }), [brand, error, loading, refresh]);

  return (
    <BrandContext.Provider value={value}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  const context = useContext(BrandContext);
  if (!context) throw new Error('useBrand must be used within BrandProvider');
  return context;
}
