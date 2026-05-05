import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, json, parseJson, requireAuth } from "../_shared/http.ts";

const CONSULTATION_SELECT = `
  id,
  appointment_id,
  doctor_id,
  patient_id,
  session_start,
  session_end,
  diagnosis,
  treatment_plan,
  notes,
  medications,
  status,
  is_archived,
  created_at,
  updated_at
`;

const REPORT_SELECT = `
  id,
  patient_id,
  doctor_id,
  report_type,
  title,
  content,
  file_url,
  is_archived,
  created_at,
  updated_at
`;

function normalizeConsultationStatus(status: unknown) {
  if (status === "in-progress") {
    return "in_progress";
  }

  return status;
}

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

    if (path === "/consultations" && req.method === "GET") {
      const { data, error } = await client
        .from("consultations")
        .select(CONSULTATION_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({ data }, 200);
    }

    if (path === "/consultations" && req.method === "POST") {
      const body = await parseJson<Record<string, unknown>>(req);
      const appointmentId = typeof body?.appointment_id === "string" ? body.appointment_id : null;
      const doctorId = typeof body?.doctor_id === "string" ? body.doctor_id : null;
      const patientId = typeof body?.patient_id === "string" ? body.patient_id : null;

      if (!appointmentId || !doctorId || !patientId) {
        return json({ error: "appointment_id, doctor_id, and patient_id are required" }, 422);
      }

      const { data, error } = await client
        .from("consultations")
        .insert([{
          appointment_id: appointmentId,
          doctor_id: doctorId,
          patient_id: patientId,
          session_start: new Date().toISOString(),
          diagnosis: body?.diagnosis ?? null,
          treatment_plan: body?.treatment_plan ?? null,
          notes: body?.notes ?? null,
          medications: body?.medications ?? null,
          status: normalizeConsultationStatus(body?.status) ?? "in_progress",
        }])
        .select(CONSULTATION_SELECT)
        .single();

      if (error) throw error;
      return json({ data }, 201);
    }

    if (path.match(/\/consultations\/[\w-]+$/) && req.method === "PUT") {
      const id = path.split("/").pop();
      const body = await parseJson<Record<string, unknown>>(req);
      const updatePayload: Record<string, unknown> = {};

      if (body?.status !== undefined) {
        updatePayload.status = normalizeConsultationStatus(body.status);
      }
      if (body?.diagnosis !== undefined) {
        updatePayload.diagnosis = body.diagnosis;
      }
      if (body?.treatment_plan !== undefined) {
        updatePayload.treatment_plan = body.treatment_plan;
      }
      if (body?.notes !== undefined) {
        updatePayload.notes = body.notes;
      }
      if (body?.medications !== undefined) {
        updatePayload.medications = body.medications;
      }
      if (body?.session_start !== undefined) {
        updatePayload.session_start = body.session_start;
      }
      if (body?.session_end !== undefined) {
        updatePayload.session_end = body.session_end;
      }

      if (updatePayload.status === "completed" && !updatePayload.session_end) {
        updatePayload.session_end = new Date().toISOString();
      }

      const { data, error } = await client
        .from("consultations")
        .update(updatePayload)
        .eq("id", id)
        .select(CONSULTATION_SELECT)
        .single();

      if (error) throw error;
      return json({ data }, 200);
    }

    if (path === "/medical-reports" && req.method === "GET") {
      const { data, error } = await client
        .from("medical_reports")
        .select(REPORT_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({ data }, 200);
    }

    if (path === "/medical-reports" && req.method === "POST") {
      const body = await parseJson<Record<string, unknown>>(req);
      const patientId = typeof body?.patient_id === "string" ? body.patient_id : null;
      const doctorId = typeof body?.doctor_id === "string" ? body.doctor_id : null;
      const reportType = typeof body?.report_type === "string" ? body.report_type : null;
      const title = typeof body?.title === "string" ? body.title : null;

      if (!patientId || !doctorId || !reportType || !title) {
        return json({ error: "patient_id, doctor_id, report_type, and title are required" }, 422);
      }

      const { data, error } = await client
        .from("medical_reports")
        .insert([{
          patient_id: patientId,
          doctor_id: doctorId,
          report_type: reportType,
          title,
          content: body?.content ?? null,
        }])
        .select(REPORT_SELECT)
        .single();

      if (error) throw error;
      return json({ data }, 201);
    }

    return json({ error: "Not found" }, 404);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
