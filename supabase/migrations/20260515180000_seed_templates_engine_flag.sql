-- Seed the templates_engine feature flag so the Template Editor UI
-- is gated by entitlements (AT-7.1).  The flag is OFF by default;
-- the control-plane admin flips it on per-tenant.
INSERT INTO feature_flags (code, name, description, audience, is_enabled, target_roles, target_platforms)
VALUES (
  'templates_engine',
  'Templates Engine',
  'Access to the document template editor — create, edit, and archive clinical document templates.',
  'staff',
  false,
  ARRAY['doctor'],
  ARRAY['web']
)
ON CONFLICT (code) DO NOTHING;