import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { tenantConfigService } from '@/services/tenantConfig';

const DEFAULT_BRAND = {
  display_name: 'DoctoLeb',
  tagline: 'Doctor-branded care, scheduling, and patient follow-up.',
  logo_url: null,
  favicon_url: null,
  primary_color: '#0891b2',
  secondary_color: '#0f172a',
  contact_phone: null,
  contact_email: null,
  website_url: null,
  about_md: null,
  languages: ['en'],
};

const BrandContext = createContext(null);

function normalizeBrand(row) {
  const config = Array.isArray(row) ? row[0] : row;
  const appConfig = config?.app || config?.app_config || config;
  const profile = config?.profile || config?.tenant_profile || {};

  return {
    ...DEFAULT_BRAND,
    display_name: profile?.display_name || appConfig?.app_name || config?.display_name || DEFAULT_BRAND.display_name,
    tagline: appConfig?.app_tagline || config?.tagline || DEFAULT_BRAND.tagline,
    logo_url: appConfig?.splash_logo_url || config?.logo_url || null,
    favicon_url: appConfig?.icon_url || config?.favicon_url || null,
    primary_color: appConfig?.primary_color || config?.primary_color || DEFAULT_BRAND.primary_color,
    secondary_color: appConfig?.secondary_color || config?.secondary_color || DEFAULT_BRAND.secondary_color,
    contact_phone: appConfig?.support_phone || config?.contact_phone || null,
    contact_email: appConfig?.support_email || config?.contact_email || null,
    languages: appConfig?.enabled_locales || config?.languages || DEFAULT_BRAND.languages,
    maintenance_message: appConfig?.maintenance_message || null,
    min_supported_version: appConfig?.min_supported_version || null,
    force_update_version: appConfig?.force_update_version || null,
    tenant_status: profile?.status || config?.status || 'active',
  };
}

export function BrandProvider({ children }) {
  const [brand, setBrand] = useState(DEFAULT_BRAND);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadBrand() {
      try {
        setLoading(true);
        const result = await tenantConfigService.getPublicConfig();

        if (!isMounted) return;

        if (result.error) {
          setBrand(DEFAULT_BRAND);
          setError(result.error);
        } else {
          setBrand(normalizeBrand(result.data));
          setError(null);
        }
      } catch (brandError) {
        if (!isMounted) return;
        setBrand(DEFAULT_BRAND);
        setError(brandError.message || 'Failed to load tenant app configuration.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void loadBrand();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--doctor-brand-primary', brand.primary_color || DEFAULT_BRAND.primary_color);
    root.style.setProperty('--doctor-brand-secondary', brand.secondary_color || DEFAULT_BRAND.secondary_color);
  }, [brand.primary_color, brand.secondary_color]);

  const value = useMemo(() => ({
    brand,
    loading,
    error,
    displayName: brand.display_name || DEFAULT_BRAND.display_name,
    tagline: brand.tagline || DEFAULT_BRAND.tagline,
  }), [brand, error, loading]);

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
