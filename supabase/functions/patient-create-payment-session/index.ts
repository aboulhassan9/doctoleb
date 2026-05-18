import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_ALLOWED_ORIGINS = new Set([
  'http://localhost:3001',
  'http://localhost:3003',
  'http://localhost:5173',
  'https://doctoleb-patient-web.vercel.app',
]);

type CheckoutContext = {
  paymentId: string;
  patientId: string;
  amount: number | string;
  currency: string;
  status: string;
};

function json(data: unknown, status: number, headers: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function getAllowedOrigins() {
  const configured = Deno.env.get('PATIENT_PAYMENT_ALLOWED_ORIGINS');
  if (!configured) return DEFAULT_ALLOWED_ORIGINS;
  return new Set(configured.split(',').map((origin) => origin.trim()).filter(Boolean));
}

function corsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = getAllowedOrigins().has(origin) ? origin : '';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function invalid(status: number, error: string, headers: HeadersInit) {
  return json({ data: null, error }, status, headers);
}

function normalizeReturnUrl(envName: string, fallbackPath: string, req: Request) {
  const configured = Deno.env.get(envName);
  if (configured) return configured;

  const origin = req.headers.get('Origin');
  if (origin && getAllowedOrigins().has(origin)) {
    return `${origin}${fallbackPath}`;
  }

  return fallbackPath;
}

function toStripeAmount(amount: number | string) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.round(numeric * 100);
}

function mapDbError(message = '') {
  const known = [
    'INVALID_REQUEST',
    'PATIENT_CONTEXT_NOT_FOUND',
    'PAYMENT_NOT_FOUND_OR_FORBIDDEN',
    'PAYMENT_NOT_PAYABLE',
  ];
  return known.find((code) => message.includes(code)) || 'PAYMENT_SESSION_FAILED';
}

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req);
  const origin = req.headers.get('Origin') || '';

  if (req.method === 'OPTIONS') {
    if (origin && !headers['Access-Control-Allow-Origin']) {
      return invalid(403, 'ORIGIN_NOT_ALLOWED', headers);
    }
    return new Response('ok', { headers });
  }

  if (origin && !headers['Access-Control-Allow-Origin']) {
    return invalid(403, 'ORIGIN_NOT_ALLOWED', headers);
  }

  if (req.method !== 'POST') {
    return invalid(405, 'METHOD_NOT_ALLOWED', headers);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

  if (!supabaseUrl || !serviceRoleKey || !stripeSecretKey) {
    return invalid(503, 'PATIENT_PAYMENTS_NOT_CONFIGURED', headers);
  }

  const authorization = req.headers.get('Authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  if (!token) {
    return invalid(401, 'UNAUTHENTICATED', headers);
  }

  let body: { payment_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return invalid(400, 'INVALID_JSON', headers);
  }

  const paymentId = typeof body.payment_id === 'string' ? body.payment_id.trim() : '';
  if (!UUID_RE.test(paymentId)) {
    return invalid(422, 'INVALID_PAYMENT_ID', headers);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user: actorAuthUser },
    error: actorError,
  } = await serviceClient.auth.getUser(token);

  if (actorError || !actorAuthUser?.id) {
    return invalid(401, 'UNAUTHENTICATED', headers);
  }

  const { data: checkoutContext, error: contextError } = await serviceClient
    .rpc('create_patient_payment_checkout_context', {
      p_actor_auth_user_id: actorAuthUser.id,
      p_payment_id: paymentId,
    })
    .single<CheckoutContext>();

  if (contextError || !checkoutContext) {
    const mapped = mapDbError(contextError?.message);
    return invalid(mapped.includes('FORBIDDEN') || mapped.includes('CONTEXT') ? 403 : 409, mapped, headers);
  }

  const unitAmount = toStripeAmount(checkoutContext.amount);
  if (!unitAmount) {
    return invalid(409, 'PAYMENT_AMOUNT_INVALID', headers);
  }

  const successUrl = normalizeReturnUrl('PATIENT_PAYMENT_SUCCESS_URL', '/patient-billing?payment=success', req);
  const cancelUrl = normalizeReturnUrl('PATIENT_PAYMENT_CANCEL_URL', '/patient-billing?payment=cancelled', req);
  const successWithSession = successUrl.includes('?')
    ? `${successUrl}&session_id={CHECKOUT_SESSION_ID}`
    : `${successUrl}?session_id={CHECKOUT_SESSION_ID}`;

  const stripeParams = new URLSearchParams();
  stripeParams.set('mode', 'payment');
  stripeParams.set('success_url', successWithSession);
  stripeParams.set('cancel_url', cancelUrl);
  stripeParams.set('line_items[0][quantity]', '1');
  stripeParams.set('line_items[0][price_data][currency]', checkoutContext.currency.toLowerCase());
  stripeParams.set('line_items[0][price_data][unit_amount]', String(unitAmount));
  stripeParams.set('line_items[0][price_data][product_data][name]', 'Clinic balance');
  stripeParams.set('metadata[payment_id]', checkoutContext.paymentId);
  stripeParams.set('metadata[patient_id]', checkoutContext.patientId);

  const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: stripeParams,
  });

  const stripeSession = await stripeResponse.json().catch(() => null) as {
    id?: string;
    url?: string;
    expires_at?: number;
  } | null;

  if (!stripeResponse.ok || !stripeSession?.id || !stripeSession?.url) {
    return invalid(502, 'PAYMENT_PROVIDER_FAILED', headers);
  }

  const expiresAt = stripeSession.expires_at
    ? new Date(stripeSession.expires_at * 1000).toISOString()
    : null;

  const { data: recordedSession, error: recordError } = await serviceClient
    .rpc('record_patient_payment_checkout_session', {
      p_actor_auth_user_id: actorAuthUser.id,
      p_payment_id: paymentId,
      p_provider_session_id: stripeSession.id,
      p_checkout_url: stripeSession.url,
      p_expires_at: expiresAt,
    })
    .single();

  if (recordError || !recordedSession) {
    return invalid(409, mapDbError(recordError?.message), headers);
  }

  return json({
    data: {
      checkoutUrl: stripeSession.url,
      sessionId: stripeSession.id,
      paymentId,
      expiresAt,
    },
    error: null,
  }, 200, headers);
});
