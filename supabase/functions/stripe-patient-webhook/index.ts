import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function hex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function parseStripeSignature(header: string) {
  const parts = new Map<string, string[]>();
  for (const piece of header.split(',')) {
    const [key, value] = piece.split('=');
    if (!key || !value) continue;
    const values = parts.get(key) || [];
    values.push(value);
    parts.set(key, values);
  }
  return {
    timestamp: parts.get('t')?.[0] || '',
    signatures: parts.get('v1') || [],
  };
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

async function hmacSha256Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return hex(signature);
}

async function sha256Hex(message: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
  return hex(digest);
}

async function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string) {
  const { timestamp, signatures } = parseStripeSignature(signatureHeader);
  if (!timestamp || signatures.length === 0) return false;

  const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  return signatures.some((signature) => timingSafeEqual(signature, expected));
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json({ data: null, error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const webhookSecret = Deno.env.get('STRIPE_PATIENT_WEBHOOK_SECRET') || Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!supabaseUrl || !serviceRoleKey || !webhookSecret) {
    return json({ data: null, error: 'PATIENT_WEBHOOK_NOT_CONFIGURED' }, 503);
  }

  const signatureHeader = req.headers.get('Stripe-Signature') || '';
  const rawBody = await req.text();
  const verified = await verifyStripeSignature(rawBody, signatureHeader, webhookSecret);
  if (!verified) {
    return json({ data: null, error: 'INVALID_SIGNATURE' }, 401);
  }

  let event: {
    id?: string;
    type?: string;
    data?: { object?: Record<string, unknown> };
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ data: null, error: 'INVALID_JSON' }, 400);
  }

  const session = event.data?.object || {};
  const sessionId = typeof session.id === 'string' ? session.id : null;
  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;
  const paymentStatus = typeof session.payment_status === 'string' ? session.payment_status : null;

  if (!event.id || !event.type) {
    return json({ data: null, error: 'INVALID_EVENT' }, 400);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const payloadHash = await sha256Hex(rawBody);
  const { data, error } = await serviceClient.rpc('apply_patient_payment_gateway_event', {
    p_provider_event_id: event.id,
    p_event_type: event.type,
    p_provider_session_id: sessionId,
    p_provider_payment_intent_id: paymentIntentId,
    p_payment_status: paymentStatus,
    p_payload_hash: payloadHash,
  });

  if (error) {
    return json({ data: null, error: 'PAYMENT_EVENT_APPLY_FAILED' }, 409);
  }

  return json({ data, error: null }, 200);
});
