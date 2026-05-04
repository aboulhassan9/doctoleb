import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, json, parseJson, requireAuth } from "../_shared/http.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  try {
    const authResult = await requireAuth(req);
    if (authResult.response) {
      return authResult.response;
    }

    const body = await parseJson<Record<string, unknown>>(req);
    const amount = typeof body?.amount === "number" ? body.amount : null;
    const paymentMethod = typeof body?.payment_method === "string" ? body.payment_method : null;

    if (!amount || amount <= 0 || !paymentMethod) {
      return json({ error: "amount and payment_method are required" }, 422);
    }

    return json(
      {
        error: "Payment processing is not configured in Secure Web V1 yet. Keep billing in CRUD/manual mode until a real gateway is integrated.",
      },
      501,
    );
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
});
