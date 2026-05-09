import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

type StaffInviteReissueInput = {
  staff_member_id?: unknown;
  client_request_id?: unknown;
};

type PreparedReissueEvent = {
  event_id: string;
  staff_member_id: string;
  email: string;
  display_name: string;
  role: string;
  phone: string | null;
  hire_date: string | null;
  client_request_id: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  error_code: string | null;
  should_send: boolean;
};

const DEFAULT_ALLOWED_ORIGINS = new Set([
  'http://localhost:3002',
  'http://localhost:5173',
  'https://doctoleb-clinic-ops.vercel.app',
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STAFF_SELECT = [
  'id',
  'user_id',
  'doctor_id',
  'role',
  'display_name',
  'phone',
  'email',
  'invite_status',
  'invite_client_request_id',
  'disabled_previous_invite_status',
  'invite_resent_at',
  'invite_resent_by',
  'invite_resend_count',
  'reactivated_at',
  'reactivated_by',
  'reactivation_count',
  'invite_reissued_at',
  'invite_reissued_by',
  'invite_reissue_count',
  'reports_to',
  'hire_date',
  'is_active',
  'disabled_at',
  'disabled_by',
  'created_at',
  'updated_at',
].join(',');

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

function parseInput(body: unknown) {
  if (!body || typeof body !== 'object') {
    return { data: null, error: 'INVALID_REQUEST' };
  }

  const input = body as StaffInviteReissueInput;
  const staffMemberId = normalizeString(input.staff_member_id);
  const clientRequestId = normalizeString(input.client_request_id);

  if (!UUID_PATTERN.test(staffMemberId)) {
    return { data: null, error: 'INVALID_STAFF_MEMBER_ID' };
  }

  if (!UUID_PATTERN.test(clientRequestId)) {
    return { data: null, error: 'INVALID_CLIENT_REQUEST_ID' };
  }

  return {
    data: {
      staffMemberId,
      clientRequestId,
    },
    error: null,
  };
}

function mapDbError(message: string) {
  const known = [
    'INVALID_REQUEST',
    'FORBIDDEN',
    'DOCTOR_CONTEXT_NOT_FOUND',
    'STAFF_MEMBER_NOT_FOUND',
    'STAFF_INVITE_NOT_REISSUABLE',
    'STAFF_INVITE_USER_MISSING',
    'STAFF_INVITE_EMAIL_MISSING',
    'STAFF_INVITE_REISSUE_EVENT_NOT_FOUND',
    'CLIENT_REQUEST_ID_CONFLICT',
  ];

  return known.find((code) => message.includes(code)) || 'STAFF_INVITE_REISSUE_FAILED';
}

function statusForError(error: string) {
  if (error === 'FORBIDDEN') return 403;
  if (error === 'INVALID_REQUEST' || error.startsWith('INVALID_')) return 422;
  return 409;
}

async function getSafeStaffMember(serviceClient: ReturnType<typeof createClient>, staffMemberId: string) {
  const { data, error } = await serviceClient
    .from('staff_members')
    .select(STAFF_SELECT)
    .eq('id', staffMemberId)
    .maybeSingle();

  return { data, error };
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
    return invalid(503, 'STAFF_INVITE_REISSUE_NOT_CONFIGURED', headers);
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

  const parsed = parseInput(body);
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

  const { data: prepared, error: prepareError } = await serviceClient
    .rpc('create_staff_invite_reissue_event', {
      p_actor_auth_user_id: actorAuthUser.id,
      p_staff_member_id: parsed.data.staffMemberId,
      p_client_request_id: parsed.data.clientRequestId,
    })
    .single<PreparedReissueEvent>();

  if (prepareError || !prepared) {
    const mappedError = mapDbError(prepareError?.message || '');
    return invalid(statusForError(mappedError), mappedError, headers);
  }

  if (!prepared.should_send) {
    if (prepared.status === 'sent') {
      const { data: staffMember, error: staffError } = await getSafeStaffMember(serviceClient, prepared.staff_member_id);
      if (staffError || !staffMember) {
        return invalid(409, 'STAFF_INVITE_REISSUE_FAILED', headers);
      }
      return json({ data: staffMember, error: null }, 200, headers);
    }

    if (prepared.status === 'failed') {
      return invalid(409, prepared.error_code || 'AUTH_INVITE_FAILED', headers);
    }

    return invalid(409, 'STAFF_INVITE_REISSUE_IN_PROGRESS', headers);
  }

  const redirectTo = Deno.env.get('STAFF_INVITE_REDIRECT_URL') || undefined;

  const { data: invited, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(
    prepared.email,
    {
      data: {
        role: prepared.role,
        full_name: prepared.display_name,
      },
      redirectTo,
    },
  );

  const invitedAuthUserId = invited?.user?.id;
  if (inviteError || !invitedAuthUserId) {
    await serviceClient.rpc('finish_staff_invite_reissue_event', {
      p_event_id: prepared.event_id,
      p_status: 'failed',
      p_invited_auth_user_id: null,
      p_error_code: 'AUTH_INVITE_FAILED',
    });

    return invalid(409, 'AUTH_INVITE_FAILED', headers);
  }

  const { data: staffMember, error: finishError } = await serviceClient
    .rpc('finish_staff_invite_reissue_event', {
      p_event_id: prepared.event_id,
      p_status: 'sent',
      p_invited_auth_user_id: invitedAuthUserId,
      p_error_code: null,
    })
    .single();

  if (finishError || !staffMember) {
    const { error: compensationError } = await serviceClient.auth.admin.deleteUser(invitedAuthUserId, true);
    return invalid(
      409,
      compensationError ? 'STAFF_INVITE_REISSUE_COMPENSATION_FAILED' : 'STAFF_INVITE_REISSUE_RECORD_FAILED',
      headers,
    );
  }

  return json({ data: staffMember, error: null }, 200, headers);
});
