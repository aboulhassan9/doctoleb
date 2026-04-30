-- Migration: Create scheduling tables and RLS policies
-- Clinics table
CREATE TABLE IF NOT EXISTS public.clinics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  address text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Secretary slots table
CREATE TABLE IF NOT EXISTS public.secretary_slots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id uuid REFERENCES auth.users(id),
  clinic_id uuid REFERENCES public.clinics(id),
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  recurrence_group_id uuid NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Appointments table
CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot_id uuid REFERENCES public.secretary_slots(id) NOT NULL,
  patient_id uuid REFERENCES auth.users(id) NOT NULL,
  doctor_id uuid REFERENCES auth.users(id) NOT NULL,
  booked_by uuid REFERENCES auth.users(id) NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','confirmed','cancelled')),
  created_at timestamp with time zone DEFAULT now()
);

-- Patients table
CREATE TABLE IF NOT EXISTS public.patients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  date_of_birth date,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable row level security
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secretary_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- RLS policies
-- Clinics: everyone can SELECT
CREATE POLICY "allow_select_all" ON public.clinics FOR SELECT USING (true);

-- Secretary slots policies
CREATE POLICY "secretary_insert_update_delete" ON public.secretary_slots
  FOR ALL USING (auth.role() = 'secretary' AND created_by = auth.uid());
CREATE POLICY "doctor_predoctor_select" ON public.secretary_slots
  FOR SELECT USING (auth.role() IN ('doctor','predoctor'));
CREATE POLICY "patient_select_active" ON public.secretary_slots
  FOR SELECT USING (auth.role() = 'patient' AND is_active = true);

-- Appointments policies
CREATE POLICY "secretary_insert_appointment" ON public.appointments
  FOR INSERT WITH CHECK (auth.role() = 'secretary' AND booked_by = auth.uid());
CREATE POLICY "doctor_predoctor_select_appointment" ON public.appointments
  FOR SELECT USING (auth.role() IN ('doctor','predoctor'));
CREATE POLICY "patient_select_own_appointment" ON public.appointments
  FOR SELECT USING (auth.role() = 'patient' AND patient_id = auth.uid());
CREATE POLICY "patient_insert_own_appointment" ON public.appointments
  FOR INSERT WITH CHECK (auth.role() = 'patient' AND patient_id = auth.uid());

-- Patients policies
CREATE POLICY "secretary_insert_patient" ON public.patients
  FOR INSERT WITH CHECK (auth.role() = 'secretary' AND created_by = auth.uid());
CREATE POLICY "doctor_predoctor_select_patient" ON public.patients
  FOR SELECT USING (auth.role() IN ('doctor','predoctor'));
CREATE POLICY "patient_select_own" ON public.patients
  FOR SELECT USING (auth.role() = 'patient' AND id = auth.uid());

-- RPC: get_available_slots
CREATE OR REPLACE FUNCTION public.get_available_slots(p_doctor uuid, p_date date)
RETURNS TABLE (
  id uuid,
  clinic_id uuid,
  date date,
  start_time time,
  end_time time,
  is_active boolean,
  clinic_name text,
  clinic_address text
) AS $$
  SELECT s.id, s.clinic_id, s.date, s.start_time, s.end_time, s.is_active,
         c.name, c.address
  FROM public.secretary_slots s
  JOIN public.clinics c ON s.clinic_id = c.id
  WHERE s.doctor_id = p_doctor AND s.date = p_date AND s.is_active = true;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- RPC: book_slot (transactional)
CREATE OR REPLACE FUNCTION public.book_slot(p_slot uuid, p_patient uuid, p_booked_by uuid, p_status text DEFAULT 'pending')
RETURNS void AS $$
DECLARE v_is_active boolean;
BEGIN
  -- Verify slot is still active
  SELECT is_active INTO v_is_active FROM public.secretary_slots WHERE id = p_slot;
  IF NOT v_is_active THEN
    RAISE EXCEPTION 'Slot is no longer available';
  END IF;

  -- Insert appointment
  INSERT INTO public.appointments (slot_id, patient_id, doctor_id, booked_by, status)
  SELECT id, p_patient, doctor_id, p_booked_by, p_status
  FROM public.secretary_slots WHERE id = p_slot;

  -- Deactivate slot
  UPDATE public.secretary_slots SET is_active = false WHERE id = p_slot;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on RPCs to all roles
GRANT EXECUTE ON FUNCTION public.get_available_slots(uuid, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_slot(uuid, uuid, uuid, text) TO anon, authenticated;
