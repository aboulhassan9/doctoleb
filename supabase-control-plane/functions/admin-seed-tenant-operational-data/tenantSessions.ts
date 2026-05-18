import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { safeErrorMessage } from './seedUtils.ts'

export async function createAuthenticatedClient(tenant: Record<string, string>, serviceClient: SupabaseClient, user: Record<string, unknown>, label: string) {
  const email = typeof user.email === 'string' ? user.email : ''
  if (!email) throw new Error(`${label} has no email address`)

  const authClient = createClient(tenant.supabase_url, tenant.supabase_anon_key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const generated = await serviceClient.auth.admin.generateLink({ type: 'magiclink', email })
  if (generated.error) throw new Error(`${label} session link failed: ${safeErrorMessage(generated.error)}`)

  const tokenHash = generated.data?.properties?.hashed_token
  const emailOtp = generated.data?.properties?.email_otp
  const payload = tokenHash
    ? { type: 'magiclink' as const, token_hash: tokenHash }
    : { type: 'magiclink' as const, email, token: emailOtp }

  const { error } = await authClient.auth.verifyOtp(payload)
  if (error) throw new Error(`${label} seed session failed: ${safeErrorMessage(error)}`)
  return authClient
}
