export function getDoctorDisplayName(doctor = {}) {
  const firstName = doctor.users?.first_name || doctor.first_name || '';
  const lastName = doctor.users?.last_name || doctor.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim();

  if (fullName) return `Dr. ${fullName}`;
  if (doctor.display_name) return doctor.display_name;
  return 'Doctor';
}

export function normalizeBookingDoctorOptions(doctors = []) {
  return doctors
    .filter((doctor) => doctor?.id)
    .map((doctor) => ({
      id: doctor.id,
      label: getDoctorDisplayName(doctor),
      specialization: doctor.specialization || null,
      department: doctor.department || null,
    }));
}

export function resolveInitialBookingDoctorId({ sessionDoctorId = null, doctors = [] } = {}) {
  if (sessionDoctorId) return sessionDoctorId;

  const options = normalizeBookingDoctorOptions(doctors);
  return options.length === 1 ? options[0].id : '';
}

export function canLoadPatientBookingSlots({ selectedDoctorId, selectedDate } = {}) {
  return Boolean(selectedDoctorId && selectedDate);
}
