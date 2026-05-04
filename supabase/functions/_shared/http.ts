import { createClient, type SupabaseClient, type User } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function handleCors(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  return null;
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export function errorResponse(message: string, status = 400) {
  return json({ error: message }, status);
}

export function createRequestClient(req: Request) {
  const authHeader = req.headers.get("Authorization");

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });
}

export async function requireAuth(req: Request): Promise<
  | { client: SupabaseClient; authUser: User; response: null }
  | { client: null; authUser: null; response: Response }
> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return {
      client: null,
      authUser: null,
      response: errorResponse("Missing authorization header", 401),
    };
  }

  const client = createRequestClient(req);
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    return {
      client: null,
      authUser: null,
      response: errorResponse("Unauthorized", 401),
    };
  }

  return { client, authUser: user, response: null };
}

export async function getDomainUser(
  client: SupabaseClient,
  authUserId: string,
) {
  const { data, error } = await client
    .from("users")
    .select("id, auth_user_id, email, role, first_name, last_name")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function parseJson<T>(req: Request, allowEmpty = false): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch (_error) {
    if (allowEmpty) {
      return null;
    }

    throw new Error("Invalid JSON request body");
  }
}
