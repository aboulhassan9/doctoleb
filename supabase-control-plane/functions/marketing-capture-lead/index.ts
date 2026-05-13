/**
 * marketing-capture-lead · Supabase Edge Function (Deno)
 *
 * Public lead-capture endpoint for the doctoleb.com marketing site. Receives
 * doctor interest from the landing-page CTA form, rate-limits per IP, and
 * writes to public.prospect_leads via the service-role-only RPC
 * `marketing_insert_prospect_lead` defined in migration 00010000000028.
 *
 * Endpoint contract:
 *   POST /marketing-capture-lead
 *   body: { email, clinicName?, doctorName?, message?, source? }
 *   200 → { data: { id }, error: null }
 *   400 → { data: null, error: 'INVALID_REQUEST' | 'INVALID_EMAIL' }
 *   405 → { data: null, error: 'INVALID_REQUEST' }
 *   429 → { data: null, error: 'RATE_LIMITED' }
 *   503 → { data: null, error: 'LEAD_CAPTURE_DOWN' }
 *
 * Zero PHI flows through this endpoint. IP is hashed (never stored raw) and
 * user-agent is truncated.
 *
 * Deploy:
 *   supabase functions deploy marketing-capture-lead --no-verify-jwt
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkEdgeRateLimit } from '../_shared/rateLimit.ts'

const ALLOWED_ORIGINS_ENV = Deno.env.get('MARKETING_ALLOWED_ORIGINS') ?? '*'
const ALLOWED_ORIGINS = ALLOWED_ORIGINS_ENV.split(',').map((s) => s.trim()).filter(Boolean)

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
)

function corsHeaders(origin: string | null): Record<string, string> {
  let allow: string
  if (ALLOWED_ORIGINS.includes('*')) {
    allow = '*'
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    allow = origin
  } else {
    allow = ALLOWED_ORIGINS[0] ?? '*'
  }

  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}

function jsonResponse(body: unknown, status: number, cors: Record<string, string>, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      'content-type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex',
      ...extra,
    },
  })
}

function firstForwardedIp(req: Request): string {
  const candidates = [
    req.headers.get('cf-connecting-ip'),
    req.headers.get('x-real-ip'),
    req.headers.get('x-forwarded-for')?.split(',')[0],
  ]
  return candidates.map((v) => v?.trim()).find(Boolean) ?? 'unknown'
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function safeTrim(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed || null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('origin'))

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ data: null, error: 'INVALID_REQUEST' }, 405, cors, { Allow: 'POST, OPTIONS' })
  }

  let body: Record<string, unknown>
  try {
    const text = await req.text()
    if (!text) {
      return jsonResponse({ data: null, error: 'INVALID_REQUEST' }, 400, cors)
    }
    body = JSON.parse(text)
    if (!body || typeof body !== 'object') {
      return jsonResponse({ data: null, error: 'INVALID_REQUEST' }, 400, cors)
    }
  } catch (_error) {
    return jsonResponse({ data: null, error: 'INVALID_REQUEST' }, 400, cors)
  }

  const email = (typeof body.email === 'string' ? body.email.trim().toLowerCase() : '')
  if (!email || email.length > 200 || !EMAIL_RE.test(email)) {
    return jsonResponse({ data: null, error: 'INVALID_EMAIL' }, 400, cors)
  }

  const clinicName = safeTrim(body.clinicName, 160)
  const doctorName = safeTrim(body.doctorName, 160)
  const message = safeTrim(body.message, 1000)
  const source = safeTrim(body.source, 64) ?? 'landing'

  // Rate limit: 10 submissions per minute per IP. Generous enough for a real
  // user fat-fingering, tight enough to stop trivial bots.
  const rateLimit = await checkEdgeRateLimit(supabase, {
    req,
    route: 'marketing_capture_lead',
    keyParts: [email],
    limit: 10,
    windowSeconds: 60,
  })

  if (!rateLimit.allowed) {
    return jsonResponse({ data: null, error: 'RATE_LIMITED' }, rateLimit.status, cors, rateLimit.headers)
  }

  const ipSalt = Deno.env.get('EDGE_RATE_LIMIT_SALT') || Deno.env.get('SUPABASE_URL') || 'doctoleb-edge'
  const ipHash = await sha256Hex(`${ipSalt}|marketing|${firstForwardedIp(req)}`)
  const userAgent = safeTrim(req.headers.get('user-agent'), 500)

  const { data, error } = await supabase.rpc('marketing_insert_prospect_lead', {
    p_email: email,
    p_clinic_name: clinicName,
    p_doctor_name: doctorName,
    p_message: message,
    p_source: source,
    p_ip_hash: ipHash,
    p_user_agent: userAgent,
  })

  if (error) {
    console.error('marketing_insert_prospect_lead failed', { code: error.code })
    return jsonResponse({ data: null, error: 'LEAD_CAPTURE_DOWN' }, 503, cors, rateLimit.headers)
  }

  const envelope = (data && typeof data === 'object' ? data : { data: null, error: 'LEAD_CAPTURE_DOWN' }) as {
    data?: { id?: string } | null
    error?: string | null
  }

  if (envelope.error) {
    const status = envelope.error === 'INVALID_EMAIL' ? 400 : 503
    return jsonResponse({ data: null, error: envelope.error }, status, cors, rateLimit.headers)
  }

  return jsonResponse(
    { data: { id: envelope.data?.id ?? null }, error: null },
    200,
    cors,
    rateLimit.headers,
  )
})
