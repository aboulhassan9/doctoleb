import { DEFAULT_BRANDING } from '../data/saasCatalog.js'

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

function text(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function nullableText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function color(value, fallback) {
  return typeof value === 'string' && HEX_COLOR.test(value.trim()) ? value.trim() : fallback
}

export function buildTenantBrandingDraft({ tenant = {}, runtimeBranding = null } = {}) {
  const profile = runtimeBranding?.profile || {}
  const appConfig = runtimeBranding?.appConfig || {}

  const displayName = text(profile.display_name, text(tenant.display_name, DEFAULT_BRANDING.display_name))
  const appName = text(appConfig.app_name, displayName)

  return {
    ...DEFAULT_BRANDING,
    display_name: displayName,
    app_name: appName,
    app_tagline: text(appConfig.app_tagline, DEFAULT_BRANDING.app_tagline),
    primary_color: color(appConfig.primary_color, DEFAULT_BRANDING.primary_color),
    secondary_color: color(appConfig.secondary_color, DEFAULT_BRANDING.secondary_color),
    accent_color: color(appConfig.accent_color, DEFAULT_BRANDING.accent_color),
    surface_color: color(appConfig.surface_color, DEFAULT_BRANDING.surface_color),
    text_color: color(appConfig.text_color, DEFAULT_BRANDING.text_color),
    support_email: nullableText(appConfig.support_email),
    support_phone: nullableText(appConfig.support_phone),
    splash_logo_url: nullableText(appConfig.splash_logo_url),
    icon_url: nullableText(appConfig.icon_url),
    enabled_locales: Array.isArray(appConfig.enabled_locales) && appConfig.enabled_locales.length > 0
      ? appConfig.enabled_locales
      : DEFAULT_BRANDING.enabled_locales,
  }
}

export function updateTenantBrandingDraft(current, key, value) {
  const next = { ...current, [key]: value }

  if (key === 'display_name' && (!current.app_name || current.app_name === current.display_name)) {
    next.app_name = value
  }

  return next
}
