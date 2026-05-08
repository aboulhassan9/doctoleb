const PROJECT_REF = /^[a-z0-9]{20}$/;

export function normalizeSupabaseProjectRef(value) {
  const projectRef = String(value || '').trim().toLowerCase();
  return PROJECT_REF.test(projectRef) ? projectRef : projectRef.replace(/[^a-z0-9]/g, '').slice(0, 20);
}

export function buildSupabaseUrl(projectRef) {
  const normalized = normalizeSupabaseProjectRef(projectRef);
  return PROJECT_REF.test(normalized) ? `https://${normalized}.supabase.co` : '';
}

export function normalizeSupabaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return raw;
    return `https://${url.hostname.toLowerCase()}`;
  } catch (_error) {
    return raw;
  }
}

export function validateRuntimeConfigDraft({ projectRef, supabaseUrl, supabaseAnonKey }) {
  const normalizedProjectRef = normalizeSupabaseProjectRef(projectRef);
  const normalizedUrl = normalizeSupabaseUrl(supabaseUrl);
  const anonKey = String(supabaseAnonKey || '').trim();

  if (!PROJECT_REF.test(normalizedProjectRef)) return 'Supabase project ref must be the 20-character project id.';
  if (normalizedUrl !== buildSupabaseUrl(normalizedProjectRef)) return 'Supabase URL must match the project ref.';
  if (anonKey.length < 20 || anonKey.length > 4096 || /\s/.test(anonKey)) return 'Tenant anon key is required and cannot contain spaces.';
  return '';
}
