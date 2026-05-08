export const PLAN_OPTIONS = Object.freeze([
  { code: 'starter', label: 'Starter Clinic' },
  { code: 'growth', label: 'Growth Clinic' },
  { code: 'scale', label: 'Scale Clinic' },
])

export const TENANT_STATUSES = Object.freeze([
  { code: 'draft', label: 'Draft' },
  { code: 'provisioning', label: 'Provisioning' },
  { code: 'active', label: 'Active' },
  { code: 'maintenance', label: 'Maintenance' },
  { code: 'suspended', label: 'Suspended' },
  { code: 'inactive', label: 'Inactive' },
  { code: 'archived', label: 'Archived' },
])

export const FEATURE_CATALOG = Object.freeze([
  {
    code: 'messaging',
    label: 'Messaging',
    description: 'Secure clinic and patient communication.',
  },
  {
    code: 'custom_branding',
    label: 'Custom branding',
    description: 'Logo, colors, app name, and support identity.',
  },
  {
    code: 'staff_accounts',
    label: 'Staff accounts',
    description: 'Additional doctor, secretary, and pre-doctor seats.',
  },
  {
    code: 'custom_domain',
    label: 'Custom domain',
    description: 'Clinic-owned domain and SSL readiness.',
  },
  {
    code: 'advanced_reports',
    label: 'Advanced reports',
    description: 'Operational reporting beyond the base dashboards.',
  },
  {
    code: 'ai_clinical_summary',
    label: 'AI clinical summary',
    description: 'Server-side AI summary generation, gated before execution.',
  },
  {
    code: 'bi_dashboard',
    label: 'BI dashboard',
    description: 'Business intelligence dashboards for clinic owners.',
  },
])

export const DEFAULT_BRANDING = Object.freeze({
  display_name: 'DoctoLeb Dev Clinic',
  app_name: 'DoctoLeb Dev Clinic',
  app_tagline: 'Care operations, patient access, and clinic growth in one secure workspace.',
  primary_color: '#0891b2',
  secondary_color: '#0f172a',
  support_email: 'support@doctoleb.example',
  support_phone: '',
  splash_logo_url: '',
  icon_url: '',
  enabled_locales: ['en'],
})
