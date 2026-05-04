import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getDomainUser, handleCors, json, requireAuth } from "../_shared/http.ts";

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  const url = new URL(req.url);
  const path = url.pathname;

  try {
    if (path === "/auth/register" && req.method === "POST") {
      return json(
        {
          error: "Custom auth registration is retired. Use Supabase Auth signUp from the application client.",
        },
        410,
      );
    }

    if (path === "/auth/profile" && req.method === "GET") {
      const authResult = await requireAuth(req);
      if (authResult.response) {
        return authResult.response;
      }

      const domainUser = await getDomainUser(authResult.client, authResult.authUser.id);

      return json(
        {
          auth_user_id: authResult.authUser.id,
          email: authResult.authUser.email ?? null,
          domain_user: domainUser,
        },
        200,
      );
    }

    if (path === "/health" && req.method === "GET") {
      return json(
        { status: "ok", timestamp: new Date().toISOString() },
        200,
      );
    }

    return json({ error: "Not found" }, 404);
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});
