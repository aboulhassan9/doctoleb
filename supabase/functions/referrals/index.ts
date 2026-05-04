import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, json, parseJson, requireAuth } from "../_shared/http.ts";

const REFERRAL_SELECT = `
  id,
  from_doctor_id,
  to_doctor_id,
  patient_id,
  reason,
  notes,
  status,
  created_at,
  updated_at
`;

const NOTIFICATION_SELECT = `
  id,
  user_id,
  title,
  message,
  type,
  related_id,
  related_type,
  is_read,
  created_at,
  updated_at
`;

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname;

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authResult = await requireAuth(req);
    if (authResult.response) {
      return authResult.response;
    }

    const { client } = authResult;

    if (path === "/referrals" && req.method === "GET") {
      const { data, error } = await client
        .from("referrals")
        .select(REFERRAL_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({ data }, 200);
    }

    if (path === "/referrals" && req.method === "POST") {
      const body = await parseJson<Record<string, unknown>>(req);
      const fromDoctorId = typeof body?.from_doctor_id === "string" ? body.from_doctor_id : null;
      const toDoctorId = typeof body?.to_doctor_id === "string" ? body.to_doctor_id : null;
      const patientId = typeof body?.patient_id === "string" ? body.patient_id : null;
      const reason = typeof body?.reason === "string" ? body.reason : null;

      if (!fromDoctorId || !toDoctorId || !patientId || !reason) {
        return json({ error: "from_doctor_id, to_doctor_id, patient_id, and reason are required" }, 422);
      }

      const { data, error } = await client
        .from("referrals")
        .insert([{
          from_doctor_id: fromDoctorId,
          to_doctor_id: toDoctorId,
          patient_id: patientId,
          reason,
          notes: typeof body?.notes === "string" ? body.notes : null,
          status: typeof body?.status === "string" ? body.status : "pending",
        }])
        .select(REFERRAL_SELECT)
        .single();

      if (error) throw error;
      return json({ data }, 201);
    }

    if (path.match(/\/referrals\/[\w-]+$/) && req.method === "PUT") {
      const id = path.split("/").pop();
      const body = await parseJson<Record<string, unknown>>(req);
      const updatePayload: Record<string, unknown> = {};

      if (body?.status !== undefined) {
        updatePayload.status = body.status;
      }
      if (body?.notes !== undefined) {
        updatePayload.notes = body.notes;
      }
      if (body?.reason !== undefined) {
        updatePayload.reason = body.reason;
      }

      const { data, error } = await client
        .from("referrals")
        .update(updatePayload)
        .eq("id", id)
        .select(REFERRAL_SELECT)
        .single();
      if (error) throw error;
      return json({ data }, 200);
    }

    if (path === "/notifications" && req.method === "GET") {
      const { data, error } = await client
        .from("notifications")
        .select(NOTIFICATION_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({ data }, 200);
    }

    if (path.match(/\/notifications\/[\w-]+\/read$/) && req.method === "PUT") {
      const id = path.split("/")[2];
      const { data, error } = await client
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id)
        .select(NOTIFICATION_SELECT)
        .single();
      if (error) throw error;
      return json({ data }, 200);
    }

    return json({ error: "Not found" }, 404);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
