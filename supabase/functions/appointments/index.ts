import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getDomainUser, handleCors, json, parseJson, requireAuth } from "../_shared/http.ts";

const APPOINTMENT_SELECT = `
  id,
  slot_id,
  patient_id,
  doctor_id,
  booked_by,
  status,
  reason,
  notes,
  duration_minutes,
  scheduled_at,
  created_at,
  updated_at
`;

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname;

  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  try {
    const authResult = await requireAuth(req);
    if (authResult.response) {
      return authResult.response;
    }

    const { client, authUser } = authResult;

    if (path === "/appointments" && req.method === "GET") {
      const { data, error } = await client
        .from("appointments")
        .select(APPOINTMENT_SELECT)
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      return json({ data }, 200);
    }

    if (path === "/appointments" && req.method === "POST") {
      const body = await parseJson<Record<string, unknown>>(req);
      const slotId = typeof body?.slot_id === "string" ? body.slot_id : null;
      const patientId = typeof body?.patient_id === "string" ? body.patient_id : null;
      const bookedBy = typeof body?.booked_by === "string" ? body.booked_by : null;
      const status = typeof body?.status === "string" ? body.status : "scheduled";
      const reason = typeof body?.reason === "string" ? body.reason : null;
      const durationMinutes = Number.isInteger(body?.duration_minutes)
        ? Number(body.duration_minutes)
        : 30;

      if (!slotId || !patientId) {
        return json({ error: "slot_id and patient_id are required" }, 422);
      }

      const domainUser = await getDomainUser(client, authUser.id);
      if (!domainUser) {
        return json({ error: "Caller has no domain user profile" }, 403);
      }

      const appointmentCreator = bookedBy ?? domainUser.id;
      const { data: appointmentId, error } = await client.rpc("book_slot", {
        p_slot: slotId,
        p_patient: patientId,
        p_booked_by: appointmentCreator,
        p_status: status,
        p_reason: reason,
        p_duration_minutes: durationMinutes,
      });

      if (error) throw error;

      const { data: appointment, error: fetchError } = await client
        .from("appointments")
        .select(APPOINTMENT_SELECT)
        .eq("id", appointmentId)
        .maybeSingle();

      if (fetchError) {
        return json({ data: { id: appointmentId } }, 201);
      }

      return json({ data: appointment }, 201);
    }

    if (path.match(/\/appointments\/[\w-]+$/) && req.method === "PUT") {
      const id = path.split("/").pop();
      const body = await parseJson<Record<string, unknown>>(req);
      const status = typeof body?.status === "string" ? body.status : null;
      const reason = typeof body?.cancellation_reason === "string"
        ? body.cancellation_reason
        : typeof body?.reason === "string"
          ? body.reason
          : null;

      if (status !== "cancelled") {
        return json(
          {
            error: "Only cancellation is supported through this endpoint. Use dedicated service-layer updates for other appointment changes.",
          },
          405,
        );
      }

      const { error } = await client.rpc("cancel_appointment", {
        appointment_id: id,
        cancellation_reason: reason,
      });

      if (error) throw error;
      return json({ success: true }, 200);
    }

    if (path.match(/\/appointments\/[\w-]+$/) && req.method === "DELETE") {
      const id = path.split("/").pop();
      const body = await parseJson<Record<string, unknown>>(req, true);
      const reason = typeof body?.cancellation_reason === "string"
        ? body.cancellation_reason
        : url.searchParams.get("reason");
      const { error } = await client.rpc("cancel_appointment", {
        appointment_id: id,
        cancellation_reason: reason,
      });

      if (error) throw error;
      return json({ success: true }, 200);
    }

    return json({ error: "Not found" }, 404);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
