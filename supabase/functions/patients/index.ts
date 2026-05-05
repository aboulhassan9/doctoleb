import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, json, requireAuth } from "../_shared/http.ts";

const PATIENT_SELECT = `
  id,
  user_id,
  date_of_birth,
  sex,
  blood_type,
  allergies,
  medical_history,
  insurance_id,
  emergency_contact,
  emergency_phone,
  created_at,
  updated_at,
  is_archived,
  users!patients_user_id_fkey (
    id,
    email,
    role,
    first_name,
    last_name,
    phone,
    initials,
    avatar_url,
    created_at,
    updated_at
  )
`;

const DOCTOR_SELECT = `
  id,
  user_id,
  department,
  specialization,
  license_number,
  bio,
  consultation_fee,
  availability,
  created_at,
  updated_at,
  users!doctors_user_id_fkey (
    id,
    email,
    role,
    first_name,
    last_name,
    phone,
    initials,
    avatar_url,
    created_at,
    updated_at
  )
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

    if (path === "/patients" && req.method === "GET") {
      const { data, error } = await client
        .from("patients")
        .select(PATIENT_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({ data }, 200);
    }

    if (path === "/patients" && req.method === "POST") {
      return json(
        {
          error: "Patient creation is not supported through this edge function. Use the secured app sign-up or staff workflows instead.",
        },
        410,
      );
    }

    if (path.match(/\/patients\/[\w-]+$/) && req.method === "PUT") {
      return json(
        {
          error: "Direct patient mutation is not supported through this edge function. Use the dedicated profile update RPC or service layer.",
        },
        410,
      );
    }

    if (path === "/doctors" && req.method === "GET") {
      const { data, error } = await client
        .from("doctors")
        .select(DOCTOR_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({ data }, 200);
    }

    if (path === "/doctors" && req.method === "POST") {
      return json(
        {
          error: "Doctor creation is not supported through this edge function. Use the secured admin or staff workflow instead.",
        },
        410,
      );
    }

    if (path.match(/\/doctors\/[\w-]+$/) && req.method === "PUT") {
      return json(
        {
          error: "Direct doctor mutation is not supported through this edge function. Use the secured profile workflow instead.",
        },
        410,
      );
    }

    return json({ error: "Not found" }, 404);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
