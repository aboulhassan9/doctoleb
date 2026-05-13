// Marketing lead capture — posts to the public control-plane Edge Function.
// The function rate-limits per IP and writes to public.prospect_leads.
// No PHI; this is a pre-sales contact form for doctors interested in DoctoLeb.

const CONTROL_PLANE_URL = import.meta.env.VITE_CONTROL_PLANE_SUPABASE_URL
  || 'https://xouqxgwccewvbtkqming.supabase.co'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function submitMarketingLead({ email, clinicName, doctorName, message, source }) {
  const trimmedEmail = typeof email === 'string' ? email.trim() : ''
  if (!EMAIL_RE.test(trimmedEmail) || trimmedEmail.length > 200) {
    return { ok: false, error: 'INVALID_EMAIL' }
  }

  try {
    const response = await fetch(`${CONTROL_PLANE_URL}/functions/v1/marketing-capture-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: trimmedEmail,
        clinicName: typeof clinicName === 'string' ? clinicName.trim().slice(0, 160) : null,
        doctorName: typeof doctorName === 'string' ? doctorName.trim().slice(0, 160) : null,
        message: typeof message === 'string' ? message.trim().slice(0, 1000) : null,
        source: typeof source === 'string' ? source.slice(0, 64) : 'landing',
      }),
    })

    if (response.status === 429) {
      return { ok: false, error: 'RATE_LIMITED' }
    }
    if (!response.ok) {
      return { ok: false, error: 'SUBMIT_FAILED' }
    }

    return { ok: true }
  } catch (_error) {
    return { ok: false, error: 'NETWORK_ERROR' }
  }
}
