import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const DEFAULT_ALLOWED_ORIGINS = new Set([
  'http://localhost:3002',
  'http://localhost:5173',
  'https://doctoleb-clinic-ops.vercel.app',
]);

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
  const configured = Deno.env.get('STAFF_INVITE_ALLOWED_ORIGINS');
  if (!configured) return DEFAULT_ALLOWED_ORIGINS;
  return new Set(configured.split(',').map((origin) => origin.trim()).filter(Boolean));
}

function corsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigins = getAllowedOrigins();
  const allowedOrigin = allowedOrigins.has(origin) ? origin : '';

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

function mapDbError(message: string) {
  const known = [
    'INVALID_REQUEST',
    'FORBIDDEN',
    'DOCTOR_CONTEXT_NOT_FOUND',
    'STAFF_MEMBER_NOT_FOUND',
  ];

  return known.find((code) => message.includes(code)) || 'STAFF_MEMBER_DISABLE_FAILED';
}

function parseStaffMemberId(body: unknown) {
  if (!body || typeof body !== 'object') return '';
  const candidate = (body as { staff_member_id?: unknown }).staff_member_id;
  return typeof candidate === 'string' ? candidate.trim() : '';
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

  if (!supabaseUrl || !serviceRoleKey) {
    return invalid(503, 'STAFF_MEMBER_DISABLE_NOT_CONFIGURED', headers);
  }

  const authorization = req.headers.get('Authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  if (!token) {
    return invalid(401, 'UNAUTHENTICATED', headers);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return invalid(400, 'INVALID_JSON', headers);
  }

  const staffMemberId = parseStaffMemberId(body);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(staffMemberId)) {
    return invalid(422, 'INVALID_STAFF_MEMBER_ID', headers);
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

  const { data: disabled, error: disableError } = await serviceClient
    .rpc('disable_staff_member_domain_identity', {
      p_actor_auth_user_id: actorAuthUser.id,
      p_staff_member_id: staffMemberId,
    })
    .single();

  if (disableError || !disabled) {
    const mappedError = mapDbError(disableError?.message || '');
    return invalid(mappedError === 'FORBIDDEN' ? 403 : 409, mappedError, headers);
  }

  const authUserId = disabled.auth_user_id;
  const previous_invite_status = disabled.previous_invite_status;
  if (authUserId && previous_invite_status !== 'accepted') {
    const { error: softDeleteError } = await serviceClient.auth.admin.deleteUser(authUserId, true);
    if (softDeleteError) {
      return invalid(409, 'STAFF_MEMBER_DISABLE_AUTH_SOFT_DELETE_FAILED', headers);
    }
  }

  const {
    auth_user_id: _authUserId,
    previous_invite_status: _previousInviteStatus,
    ...safeStaffMember
  } = disabled;

  return json({ data: safeStaffMember, error: null }, 200, headers);
});
