import { createClient } from '@supabase/supabase-js'

const controlPlaneUrl = import.meta.env.VITE_CONTROL_PLANE_SUPABASE_URL
const controlPlaneAnonKey = import.meta.env.VITE_CONTROL_PLANE_SUPABASE_ANON_KEY

export function getControlPlaneEnvStatus() {
  return {
    hasUrl: Boolean(controlPlaneUrl),
    hasAnonKey: Boolean(controlPlaneAnonKey),
  }
}

export function createControlPlaneClient() {
  if (!controlPlaneUrl || !controlPlaneAnonKey) {
    throw new Error(
      'Control-plane Supabase env is missing. Set VITE_CONTROL_PLANE_SUPABASE_URL and VITE_CONTROL_PLANE_SUPABASE_ANON_KEY.',
    )
  }

  return createClient(controlPlaneUrl, controlPlaneAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}
