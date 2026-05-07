-- Mobile-ready patient-facing RPCs for Flutter/mobile app parity
-- Migration: 20260507123600_mobile_ready_patient_rpcs.sql

-- 1. get_my_appointments: patient sees their own appointments
CREATE OR REPLACE FUNCTION public.get_my_appointments(
  p_status text DEFAULT NULL,
  p_from_date date DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid, scheduled_at timestamptz, duration_minutes int, status text,
  reason text, notes text, clinic_name text, clinic_address text,
  clinic_location_type text, doctor_first_name text, doctor_last_name text,
  doctor_specialty text, visit_type_name text, created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_patient_id uuid;
BEGIN
  SELECT p.id INTO v_patient_id FROM patients p JOIN users u ON u.id = p.user_id WHERE u.auth_user_id = auth.uid();
  IF v_patient_id IS NULL THEN RAISE EXCEPTION 'PATIENT_NOT_FOUND' USING HINT = 'No patient record linked to this account.'; END IF;
  RETURN QUERY
  SELECT a.id, a.scheduled_at, a.duration_minutes, a.status::text, a.reason, a.notes,
    c.name, c.address, c.location_type::text, du.first_name, du.last_name,
    sp.name, vt.name, a.created_at
  FROM appointments a
  LEFT JOIN clinics c ON c.id = a.clinic_id
  LEFT JOIN secretary_slots ss ON ss.id = a.slot_id
  LEFT JOIN doctors d ON d.id = ss.doctor_id
  LEFT JOIN users du ON du.id = d.user_id
  LEFT JOIN doctor_specialties ds ON ds.doctor_id = d.id AND ds.is_primary = true
  LEFT JOIN specialties sp ON sp.id = ds.specialty_id
  LEFT JOIN visit_types vt ON vt.id = a.visit_type_id
  WHERE a.patient_id = v_patient_id
    AND (p_status IS NULL OR a.status = p_status)
    AND (p_from_date IS NULL OR a.scheduled_at >= p_from_date)
  ORDER BY a.scheduled_at DESC LIMIT p_limit OFFSET p_offset;
END; $$;
REVOKE ALL ON FUNCTION public.get_my_appointments FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_appointments TO authenticated, service_role;

-- 2. get_my_medical_summary
CREATE OR REPLACE FUNCTION public.get_my_medical_summary()
RETURNS TABLE (
  patient_id uuid, total_appointments bigint, completed_appointments bigint,
  total_encounters bigint, total_prescriptions bigint, total_lab_orders bigint,
  total_documents bigint, intake_completed boolean, established boolean,
  unread_notifications bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_patient_id uuid; v_user_id uuid;
BEGIN
  SELECT p.id, p.user_id INTO v_patient_id, v_user_id FROM patients p JOIN users u ON u.id = p.user_id WHERE u.auth_user_id = auth.uid();
  IF v_patient_id IS NULL THEN RAISE EXCEPTION 'PATIENT_NOT_FOUND'; END IF;
  RETURN QUERY SELECT v_patient_id,
    (SELECT count(*) FROM appointments WHERE appointments.patient_id = v_patient_id),
    (SELECT count(*) FROM appointments WHERE appointments.patient_id = v_patient_id AND appointments.status = 'completed'),
    (SELECT count(*) FROM encounters WHERE encounters.patient_id = v_patient_id),
    (SELECT count(*) FROM prescriptions WHERE prescriptions.patient_id = v_patient_id AND prescriptions.is_archived = false),
    (SELECT count(*) FROM lab_orders WHERE lab_orders.patient_id = v_patient_id AND lab_orders.is_archived = false),
    (SELECT count(*) FROM clinical_documents WHERE clinical_documents.patient_id = v_patient_id AND clinical_documents.is_archived = false AND clinical_documents.status = 'final'),
    (SELECT p2.intake_completed_at IS NOT NULL FROM patients p2 WHERE p2.id = v_patient_id),
    (SELECT p2.established_at IS NOT NULL FROM patients p2 WHERE p2.id = v_patient_id),
    (SELECT count(*) FROM notification_deliveries nd JOIN notification_events ne ON ne.id = nd.event_id
     WHERE (ne.patient_id = v_patient_id OR nd.user_id = v_user_id) AND nd.channel = 'in_app' AND nd.status IN ('queued','sent') AND nd.read_at IS NULL);
END; $$;
REVOKE ALL ON FUNCTION public.get_my_medical_summary FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_medical_summary TO authenticated, service_role;

-- 3. get_my_notifications
CREATE OR REPLACE FUNCTION public.get_my_notifications(p_limit int DEFAULT 30, p_offset int DEFAULT 0, p_unread_only boolean DEFAULT false)
RETURNS TABLE (
  delivery_id uuid, event_id uuid, title text, body text, event_type text,
  severity text, channel text, status text, sent_at timestamptz,
  read_at timestamptz, created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_patient_id uuid; v_user_id uuid;
BEGIN
  SELECT p.id, p.user_id INTO v_patient_id, v_user_id FROM patients p JOIN users u ON u.id = p.user_id WHERE u.auth_user_id = auth.uid();
  IF v_patient_id IS NULL THEN RAISE EXCEPTION 'PATIENT_NOT_FOUND'; END IF;
  RETURN QUERY SELECT nd.id, ne.id, ne.title, ne.body, ne.event_type::text, ne.severity::text, nd.channel::text, nd.status::text, nd.sent_at, nd.read_at, ne.created_at
  FROM notification_deliveries nd JOIN notification_events ne ON ne.id = nd.event_id
  WHERE (ne.patient_id = v_patient_id OR nd.user_id = v_user_id) AND nd.channel = 'in_app' AND (NOT p_unread_only OR nd.read_at IS NULL)
  ORDER BY ne.created_at DESC LIMIT p_limit OFFSET p_offset;
END; $$;
REVOKE ALL ON FUNCTION public.get_my_notifications FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_notifications TO authenticated, service_role;

-- 4. mark_notification_read
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_delivery_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user_id uuid; v_patient_id uuid; v_delivery_owner uuid; v_delivery_patient uuid;
BEGIN
  SELECT p.id, p.user_id INTO v_patient_id, v_user_id FROM patients p JOIN users u ON u.id = p.user_id WHERE u.auth_user_id = auth.uid();
  IF v_patient_id IS NULL THEN RAISE EXCEPTION 'PATIENT_NOT_FOUND'; END IF;
  SELECT nd.user_id, ne.patient_id INTO v_delivery_owner, v_delivery_patient FROM notification_deliveries nd JOIN notification_events ne ON ne.id = nd.event_id WHERE nd.id = p_delivery_id;
  IF v_delivery_owner IS DISTINCT FROM v_user_id AND v_delivery_patient IS DISTINCT FROM v_patient_id THEN
    RAISE EXCEPTION 'ACCESS_DENIED' USING HINT = 'You can only mark your own notifications as read.';
  END IF;
  UPDATE notification_deliveries SET read_at = now(), status = 'read' WHERE id = p_delivery_id AND read_at IS NULL;
END; $$;
REVOKE ALL ON FUNCTION public.mark_notification_read FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mark_notification_read TO authenticated, service_role;

-- 5. register_patient_device
CREATE OR REPLACE FUNCTION public.register_patient_device(
  p_platform text, p_push_token text, p_device_label text DEFAULT NULL,
  p_app_version text DEFAULT NULL, p_locale text DEFAULT NULL, p_timezone text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_patient_id uuid; v_user_id uuid; v_device_id uuid;
BEGIN
  SELECT p.id, p.user_id INTO v_patient_id, v_user_id FROM patients p JOIN users u ON u.id = p.user_id WHERE u.auth_user_id = auth.uid();
  IF v_patient_id IS NULL THEN RAISE EXCEPTION 'PATIENT_NOT_FOUND'; END IF;
  INSERT INTO patient_devices (patient_id, user_id, platform, push_token, device_label, app_version, locale, timezone, is_active, last_seen_at)
  VALUES (v_patient_id, v_user_id, p_platform, p_push_token, p_device_label, p_app_version, p_locale, p_timezone, true, now())
  ON CONFLICT (patient_id, push_token) DO UPDATE SET
    platform = EXCLUDED.platform, device_label = EXCLUDED.device_label, app_version = EXCLUDED.app_version,
    locale = EXCLUDED.locale, timezone = EXCLUDED.timezone, is_active = true, last_seen_at = now()
  RETURNING id INTO v_device_id;
  RETURN v_device_id;
END; $$;
REVOKE ALL ON FUNCTION public.register_patient_device FROM public, anon;
GRANT EXECUTE ON FUNCTION public.register_patient_device TO authenticated, service_role;

-- Unique constraint for device upsert
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patient_devices_patient_push_token_unique') THEN
    ALTER TABLE public.patient_devices ADD CONSTRAINT patient_devices_patient_push_token_unique UNIQUE (patient_id, push_token);
  END IF;
END; $$;
