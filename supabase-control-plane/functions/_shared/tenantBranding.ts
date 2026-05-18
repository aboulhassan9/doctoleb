const HEX = /^#[0-9A-Fa-f]{6}$/

type BrandingOptions = {
  profileDisplayNameFallback?: string | null
  appNameFallback?: string | null
}

function nullableText(value: unknown, max = 2000) {
  if (value === null || value === undefined || value === '') return null
  return typeof value === 'string' ? value.trim().slice(0, max) : null
}

function nullableHttpsUrl(value: unknown, max = 2000) {
  const text = nullableText(value, max)
  if (!text) return null

  try {
    const url = new URL(text)
    return url.protocol === 'https:' ? text : null
  } catch (_error) {
    return null
  }
}

function normalizeLocales(value: unknown) {
  if (!Array.isArray(value)) return ['en']
  const locales = value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => /^[a-z]{2}(?:-[a-z]{2})?$/.test(item))
  return locales.length > 0 ? Array.from(new Set(locales)) : ['en']
}

export function tenantBrandingRequestedKeys(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value)
    : []
}

export function normalizeTenantBranding(value: unknown, options: BrandingOptions = {}) {
  const input = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

  const primary = nullableText(input.primary_color, 20)
  const secondary = nullableText(input.secondary_color, 20)
  const accent = nullableText(input.accent_color, 20)
  const surface = nullableText(input.surface_color, 20)
  const textColor = nullableText(input.text_color, 20)
  const enabledLocales = normalizeLocales(input.enabled_locales)

  return {
    profile: {
      display_name: nullableText(input.display_name, 160) ?? nullableText(options.profileDisplayNameFallback, 160),
      default_locale: enabledLocales[0],
    },
    app: {
      app_name: nullableText(input.app_name ?? input.display_name, 160)
        ?? nullableText(options.appNameFallback, 160)
        ?? 'DoctoLeb Clinic',
      app_tagline: nullableText(input.app_tagline, 240),
      splash_logo_url: nullableHttpsUrl(input.splash_logo_url, 2000),
      icon_url: nullableHttpsUrl(input.icon_url, 2000),
      primary_color: primary && HEX.test(primary) ? primary : null,
      secondary_color: secondary && HEX.test(secondary) ? secondary : null,
      accent_color: accent && HEX.test(accent) ? accent : null,
      surface_color: surface && HEX.test(surface) ? surface : null,
      text_color: textColor && HEX.test(textColor) ? textColor : null,
      support_phone: nullableText(input.support_phone, 80),
      support_email: nullableText(input.support_email, 240),
      enabled_locales: enabledLocales,
      maintenance_message: nullableText(input.maintenance_message, 1000),
    },
  }
}
