import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { slotService } from '../services/slots';
import { patientService } from '../services/patients';
import { clinicService } from '../services/clinics';
import { appointmentService } from '../services/appointments';

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${m} ${ampm}`;
}

const inputCls =
  'w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-300';

export default function SecretaryBookingPage() {
  const { showToast } = useToast();
  const { user } = useAuth();

  const [step, setStep] = useState(1); // 1=patient search, 2=slot selection, 3=confirm

  // Patient search
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showNewPatientForm, setShowNewPatientForm] = useState(false);
  const [newPatient, setNewPatient] = useState({ full_name: '', phone: '', email: '', date_of_birth: '' });

  // Slot selection
  const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingReason, setBookingReason] = useState('');

  const [booking, setBooking] = useState(false);
  const [confirmedAppointment, setConfirmedAppointment] = useState(null);

  // Search patients
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    const { data, error } = await patientService.search(searchQuery);
    setSearchLoading(false);
    if (error) { showToast('Search failed', 'error'); return; }
    setPatients(data || []);
  };

  // Load slots when date changes
  const loadSlots = async (date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    if (!date) return;
    setSlotsLoading(true);
    const { data: doctor, error: doctorError } = await clinicService.getMainDoctor();
    if (doctorError || !doctor?.id) { showToast('No doctor found in system', 'error'); setSlotsLoading(false); return; }
    const { data, error } = await slotService.getAvailableSlots(doctor.id, date);
    setSlotsLoading(false);
    if (error) { showToast('Failed to load slots', 'error'); return; }
    setAvailableSlots(data || []);
  };

  // Create new patient on the fly
  const handleCreatePatient = async (e) => {
    e.preventDefault();
    if (!newPatient.full_name || !newPatient.phone) {
      showToast('Name and phone are required', 'error'); return;
    }
    const { data, error } = await patientService.createWalkIn({ ...newPatient, created_by: user.id });
    if (error) { showToast('Failed to create patient: ' + error.message, 'error'); return; }
    setSelectedPatient(data);
    setShowNewPatientForm(false);
    setStep(2);
    showToast('Patient profile created', 'success');
  };

  // Confirm booking
  const handleBook = async () => {
    if (!selectedSlot || !selectedPatient || !bookingReason.trim()) {
      showToast('Please add a booking reason before confirming.', 'error');
      return;
    }
    setBooking(true);
    const { data, error } = await appointmentService.bookFromSlot({
      slotId: selectedSlot.id,
      patientId: selectedPatient.id,
      bookedBy: user.id,
      reason: bookingReason.trim(),
      status: 'scheduled',
    });
    setBooking(false);
    if (error) {
      if (error?.includes?.('no longer available')) {
        showToast('This slot was just taken. Please choose another.', 'error');
        loadSlots(selectedDate);
        setSelectedSlot(null);
      } else {
        showToast('Booking failed: ' + error, 'error');
      }
      return;
    }
    setConfirmedAppointment({ patient: selectedPatient, slot: selectedSlot, appointment: data });
    setStep(3);
    showToast('Appointment booked successfully!', 'success');
  };

  const reset = () => {
    setStep(1);
    setSelectedPatient(null);
    setSelectedSlot(null);
    setAvailableSlots([]);
    setSelectedDate('');
    setSearchQuery('');
    setPatients([]);
    setBookingReason('');
    setConfirmedAppointment(null);
    setShowNewPatientForm(false);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-8 ml-64 overflow-y-auto max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Book Appointment</h1>
          <p className="text-slate-500 mt-1 text-sm">Book an appointment on behalf of a patient</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-3 mb-10">
          {[
            { n: 1, label: 'Select Patient' },
            { n: 2, label: 'Choose Slot' },
            { n: 3, label: 'Confirmed' },
          ].map(({ n, label }, i, arr) => (
            <React.Fragment key={n}>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black transition-all ${
                  step > n ? 'bg-emerald-500 text-white' :
                  step === n ? 'bg-blue-600 text-white' :
                  'bg-slate-200 text-slate-400'
                }`}>
                  {step > n ? '✓' : n}
                </div>
                <span className={`text-sm font-semibold ${step === n ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span>
              </div>
              {i < arr.length - 1 && <div className="flex-1 h-0.5 bg-slate-200 rounded-full" />}
            </React.Fragment>
          ))}
        </div>

        {/* ── Step 1: Patient Search ── */}
        {step === 1 && (
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 mb-6">
              <h2 className="text-base font-black text-slate-900 mb-4">Search Patient</h2>
              <div className="flex gap-3">
                <input
                  className={`${inputCls} flex-1`}
                  placeholder="Search by name or phone number…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                <button
                  onClick={handleSearch}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all"
                >
                  🔍 Search
                </button>
              </div>

              {searchLoading && <p className="text-sm text-slate-400 mt-4">Searching…</p>}

              {patients.length > 0 && (
                <div className="mt-4 divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                  {patients.map(p => {
                    const name = p.users ? `${p.users.first_name} ${p.users.last_name}` : p.full_name || 'Unknown';
                    return (
                      <button
                        key={p.id}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors flex items-center gap-3"
                        onClick={() => { setSelectedPatient(p); setStep(2); }}
                      >
                        <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-black">
                          {name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{name}</p>
                          <p className="text-xs text-slate-400">{p.users?.phone || p.phone || 'No phone'}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {patients.length === 0 && searchQuery && !searchLoading && (
                <p className="text-sm text-slate-400 mt-4">No patients found.</p>
              )}
            </div>

            {/* Create new patient */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
              <button
                className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors"
                onClick={() => setShowNewPatientForm(v => !v)}
              >
                ➕ {showNewPatientForm ? 'Hide' : 'Create New Patient Profile'}
              </button>

              <AnimatePresence>
                {showNewPatientForm && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleCreatePatient}
                    className="mt-5 space-y-4 overflow-hidden"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name *</label>
                        <input className={inputCls} value={newPatient.full_name}
                          onChange={e => setNewPatient(p => ({ ...p, full_name: e.target.value }))} required />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone *</label>
                        <input className={inputCls} value={newPatient.phone}
                          onChange={e => setNewPatient(p => ({ ...p, phone: e.target.value }))} required />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email (optional)</label>
                        <input type="email" className={inputCls} value={newPatient.email}
                          onChange={e => setNewPatient(p => ({ ...p, email: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date of Birth (optional)</label>
                        <input type="date" className={inputCls} value={newPatient.date_of_birth}
                          onChange={e => setNewPatient(p => ({ ...p, date_of_birth: e.target.value }))} />
                      </div>
                    </div>
                    <button type="submit"
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-all">
                      ✅ Create & Select Patient
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* ── Step 2: Slot Selection ── */}
        {step === 2 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            {/* Selected patient banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide">Selected Patient</p>
                <p className="text-sm font-black text-blue-900 mt-0.5">
                  {selectedPatient?.users
                    ? `${selectedPatient.users.first_name} ${selectedPatient.users.last_name}`
                    : selectedPatient?.full_name || 'Unknown'}
                </p>
              </div>
              <button onClick={() => { setSelectedPatient(null); setStep(1); }}
                className="text-blue-500 hover:text-blue-700 text-xs font-semibold">
                Change
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 mb-6">
              <h2 className="text-base font-black text-slate-900 mb-4">Select a Date</h2>
              <input
                type="date"
                className={`${inputCls} max-w-xs`}
                min={new Date().toISOString().split('T')[0]}
                value={selectedDate}
                onChange={e => loadSlots(e.target.value)}
              />
            </div>

            {selectedDate && (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                <h2 className="text-base font-black text-slate-900 mb-4">Available Slots</h2>
                {slotsLoading ? (
                  <div className="flex items-center gap-3 text-slate-400 text-sm">
                    <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    Loading slots…
                  </div>
                ) : availableSlots.length === 0 ? (
                  <p className="text-sm text-slate-400">No available slots for this date.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {availableSlots.map(slot => (
                      <button
                        key={slot.id}
                        onClick={() => setSelectedSlot(slot)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          selectedSlot?.id === slot.id
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-slate-200 hover:border-blue-300 bg-white'
                        }`}
                      >
                        <p className="text-sm font-black text-slate-900">{formatTime(slot.start_time)}</p>
                        <p className="text-xs text-slate-400 mt-0.5">– {formatTime(slot.end_time)}</p>
                        {slot.clinic_name && (
                          <p className="text-xs text-blue-600 mt-1 truncate">📍 {slot.clinic_name}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {selectedSlot && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <p className="text-sm font-semibold text-slate-700 mb-3">Selected: {formatTime(selectedSlot.start_time)} – {formatTime(selectedSlot.end_time)}</p>
                    <textarea
                      value={bookingReason}
                      onChange={(event) => setBookingReason(event.target.value)}
                      placeholder="Reason for visit..."
                      className="w-full mb-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                      rows={3}
                    />
                    <button
                      onClick={handleBook}
                      disabled={booking}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-black rounded-xl transition-all disabled:opacity-60"
                    >
                      {booking ? '⏳ Booking…' : '✅ Confirm Booking'}
                    </button>
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Step 3: Confirmed ── */}
        {step === 3 && confirmedAppointment && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="bg-white border border-emerald-200 rounded-2xl shadow-sm p-10">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">✅</div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">Appointment Confirmed!</h2>
              <p className="text-slate-500 mb-6 text-sm">
                {confirmedAppointment.patient.users
                  ? `${confirmedAppointment.patient.users.first_name} ${confirmedAppointment.patient.users.last_name}`
                  : confirmedAppointment.patient.full_name}
                {' '}is booked at {formatTime(confirmedAppointment.slot.start_time)}
                {confirmedAppointment.slot.clinic_name && ` — ${confirmedAppointment.slot.clinic_name}`}
              </p>
              <button
                onClick={reset}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-black rounded-xl transition-all"
              >
                📋 Book Another
              </button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
