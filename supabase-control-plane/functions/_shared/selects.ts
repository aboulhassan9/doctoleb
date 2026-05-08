export const CONTROL_PLANE_PLAN_SELECT = [
  'code',
  'name',
  'status',
  'billing_mode',
  'price_label',
  'stripe_product_lookup_key',
  'description',
  'sort_order',
  'created_at',
  'updated_at',
].join(', ')

export const CONTROL_PLANE_PLAN_ENTITLEMENT_SELECT = [
  'id',
  'plan_code',
  'feature_code',
  'is_enabled',
  'limits',
  'created_at',
  'updated_at',
].join(', ')

export const CONTROL_PLANE_PROVISIONING_JOB_SELECT = [
  'id',
  'client_request_id',
  'tenant_id',
  'requested_slug',
  'requested_display_name',
  'requested_plan',
  'requested_domains',
  'initial_branding',
  'status',
  'checklist',
  'assigned_admin_id',
  'last_error',
  'created_at',
  'updated_at',
  'completed_at',
].join(', ')

export const CONTROL_PLANE_TENANT_MUTATION_SELECT = [
  'id',
  'slug',
  'display_name',
  'status',
  'plan',
  'release_channel',
  'supabase_project_ref',
  'supabase_url',
  'schema_version',
  'notes',
  'updated_at',
].join(', ')

export const CONTROL_PLANE_DOMAIN_SELECT = [
  'id',
  'tenant_id',
  'hostname',
  'surface',
  'status',
  'dns_status',
  'ssl_status',
  'verified_at',
].join(', ')

export const TENANT_PROFILE_SELECT = [
  'id',
  'tenant_slug',
  'display_name',
  'timezone',
  'default_locale',
  'status',
  'schema_version',
  'updated_at',
].join(', ')

export const TENANT_APP_CONFIG_SELECT = [
  'id',
  'profile_id',
  'app_name',
  'app_tagline',
  'splash_logo_url',
  'icon_url',
  'primary_color',
  'secondary_color',
  'maintenance_message',
  'min_supported_version',
  'force_update_version',
  'enabled_locales',
  'support_phone',
  'support_email',
  'created_at',
  'updated_at',
].join(', ')

export const TENANT_FEATURE_FLAG_SELECT = [
  'id',
  'code',
  'name',
  'description',
  'audience',
  'is_enabled',
  'target_roles',
  'target_platforms',
  'config',
  'created_at',
  'updated_at',
].join(', ')
