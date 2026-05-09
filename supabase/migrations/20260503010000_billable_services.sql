CREATE TABLE IF NOT EXISTS billable_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE billable_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active billable services" ON billable_services
    FOR SELECT
    USING (is_active = true);

CREATE POLICY "Secretaries and admins can manage billable services" ON billable_services
    FOR ALL
    USING (
        (SELECT role FROM users WHERE id = auth.uid()) IN ('secretary', 'admin')
    );

-- Seed some initial data
INSERT INTO billable_services (code, name, description, price) VALUES
('CPT-99213', 'Doctor Consultation', 'Regular primary care check-up', 120.00),
('CPT-94760', 'Vital Signs Check', 'BP, Heart Rate, SpO2', 25.00),
('CPT-82947', 'Blood Glucose Test', 'Point-of-care testing', 15.00),
('CPT-93000', 'ECG / EKG', '12-lead electrocardiogram', 75.00)
ON CONFLICT (code) DO NOTHING;
