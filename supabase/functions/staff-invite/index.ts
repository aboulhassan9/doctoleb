import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

type StaffInviteInput = {
  display_name?: unknown;
  role?: unknown;
  email?: unknown;
  phone?: unknown;
  hire_date?: unknown;
  client_request_id?: unknown;
};

const SUPPORTED_ROLES = new Set(['secretary', 'predoctor']);
const DEFAULT_ALLOWED_ORIGINS = new Set([
  'http://localhost:3002',
  'http://localhost:5173',
  'https://doctoleb-clinic-ops.vercel.app',
]);
const STAFF_SELECT = 'id,user_id,doctor_id,role,display_name,phone,email,invite_status,hire_date,is_active,created_at,updated_at';

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

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalString(value: unknown) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function validateInput(input: StaffInviteInput) {
  const displayName = normalizeString(input.display_name);
  const role = normalizeString(input.role);
  const email = normalizeString(input.email).toLowerCase();
  const phone = normalizeOptionalString(input.phone);
  const hireDate = normalizeOptionalString(input.hire_date);
  const clientRequestId = normalizeOptionalString(input.client_request_id);

  if (!displayName || displayName.length > 160) {
    return { data: null, error: 'DISPLAY_NAME_REQUIRED' };
  }

  if (!SUPPORTED_ROLES.has(role)) {
    return { data: null, error: 'UNSUPPORTED_STAFF_ROLE' };
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 320) {
    return { data: null, error: 'INVALID_EMAIL' };
  }

  if (phone && phone.length > 40) {
    return { data: null, error: 'INVALID_PHONE' };
  }

  if (hireDate && !/^\d{4}-\d{2}-\d{2}$/.test(hireDate)) {
    return { data: null, error: 'INVALID_HIRE_DATE' };
  }

  if (clientRequestId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientRequestId)) {
    return { data: null, error: 'INVALID_CLIENT_REQUEST_ID' };
  }

  return {
    data: {
      displayName,
      role,
      email,
      phone,
      hireDate,
      clientRequestId,
    },
    error: null,
  };
}

function mapDbError(message: string) {
  const known = [
    'INVALID_REQUEST',
    'INVALID_EMAIL',
    'UNSUPPORTED_STAFF_ROLE',
    'DISPLAY_NAME_REQUIRED',
    'FORBIDDEN',
    'DOCTOR_CONTEXT_NOT_FOUND',
    'STAFF_EMAIL_ALREADY_EXISTS',
    'USER_EMAIL_ALREADY_LINKED',
  ];

  return known.find((code) => message.includes(code)) || 'STAFF_INVITE_FAILED';
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
    return invalid(503, 'STAFF_INVITE_NOT_CONFIGURED', headers);
  }

  const authorization = req.headers.get('Authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  if (!token) {
    return invalid(401, 'UNAUTHENTICATED', headers);
  }

  let body: StaffInviteInput;
  try {
    body = await req.json();
  } catch {
    return invalid(400, 'INVALID_JSON', headers);
  }

  const parsed = validateInput(body);
  if (parsed.error) {
    return invalid(422, parsed.error, headers);
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

  const input = parsed.data;

  const { data: actorProfile, error: actorProfileError } = await serviceClient
    .from('users')
    .select('id,role,is_active')
    .eq('auth_user_id', actorAuthUser.id)
    .eq('is_active', true)
    .maybeSingle();

  if (actorProfileError) {
    return invalid(500, 'STAFF_INVITE_FAILED', headers);
  }

  if (!actorProfile || actorProfile.role !== 'doctor') {
    return invalid(403, 'FORBIDDEN', headers);
  }

  const { data: doctor, error: doctorError } = await serviceClient
    .from('doctors')
    .select('id')
    .eq('user_id', actorProfile.id)
    .maybeSingle();

  if (doctorError) {
    return invalid(500, 'STAFF_INVITE_FAILED', headers);
  }

  if (!doctor?.id) {
    return invalid(403, 'DOCTOR_CONTEXT_NOT_FOUND', headers);
  }

  if (input.clientRequestId) {
    const { data: existingByRequest, error: requestLookupError } = await serviceClient
      .from('staff_members')
      .select(STAFF_SELECT)
      .eq('invite_client_request_id', input.clientRequestId)
      .maybeSingle();

    if (requestLookupError) {
      return invalid(500, 'STAFF_INVITE_FAILED', headers);
    }

    if (existingByRequest) {
      return json({ data: existingByRequest, error: null }, 200, headers);
    }
  }

  const { data: existingByEmail, error: emailLookupError } = await serviceClient
    .from('staff_members')
    .select(STAFF_SELECT)
    .eq('doctor_id', doctor.id)
    .eq('email', input.email)
    .maybeSingle();

  if (emailLookupError) {
    return invalid(500, 'STAFF_INVITE_FAILED', headers);
  }

  if (existingByEmail) {
    if (
      existingByEmail.is_active === true &&
      existingByEmail.role === input.role &&
      ['invited', 'accepted'].includes(existingByEmail.invite_status)
    ) {
      return json({ data: existingByEmail, error: null }, 200, headers);
    }

    return invalid(409, 'STAFF_EMAIL_ALREADY_EXISTS', headers);
  }

  const redirectTo = Deno.env.get('STAFF_INVITE_REDIRECT_URL') || undefined;

  const { data: invited, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(
    input.email,
    {
      data: {
        role: input.role,
        full_name: input.displayName,
      },
      redirectTo,
    },
  );

  const invitedAuthUserId = invited?.user?.id;
  if (inviteError || !invitedAuthUserId) {
    return invalid(409, 'AUTH_INVITE_FAILED', headers);
  }

  const { data: staffMember, error: domainError } = await serviceClient
    .rpc('create_staff_invite_domain_identity', {
      p_actor_auth_user_id: actorAuthUser.id,
      p_invited_auth_user_id: invitedAuthUserId,
      p_email: input.email,
      p_role: input.role,
      p_display_name: input.displayName,
      p_phone: input.phone,
      p_hire_date: input.hireDate,
      p_client_request_id: input.clientRequestId,
    })
    .single();

  if (domainError || !staffMember) {
    const { error: compensationError } = await serviceClient.auth.admin.deleteUser(invitedAuthUserId, true);
    const mappedError = mapDbError(domainError?.message || '');
    return invalid(
      mappedError === 'FORBIDDEN' ? 403 : 409,
      compensationError ? 'STAFF_INVITE_COMPENSATION_FAILED' : mappedError,
      headers,
    );
  }

  return json({ data: staffMember, error: null }, 200, headers);
});
