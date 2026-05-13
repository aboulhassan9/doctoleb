import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { PageHeader, LoadingSkeleton, EmptyState } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { slotService } from '@/services/slots';
import { clinicService } from '@/services/clinics';

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${m} ${ampm}`;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export default function PreDoctorSchedulePage() {
  const { showToast } = useToast();

  const [slots, setSlots] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(todayStr());
  const [filterClinic, setFilterClinic] = useState('');

  useEffect(() => {
    clinicService.getAll().then(({ data }) => setClinics(data || []));
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await slotService.getByDate(filterDate);
      if (error) showToast('Failed to load schedule', 'error');
      setSlots(data || []);
      setLoading(false);
    }
    if (filterDate) load();
  }, [filterDate]);

  const filteredSlots = useMemo(() => {
    if (!filterClinic) return slots;
    return slots.filter(s => s.clinic_id === filterClinic);
  }, [slots, filterClinic]);

  const booked = filteredSlots.filter(s => !s.is_active).length;
  const available = filteredSlots.filter(s => s.is_active).length;

  return (
    <DashboardLayout role="pre_doctor">
      <div className="flex-1 p-8 ml-64 overflow-y-auto">
        <PageHeader
          title="Daily Schedule"
          subtitle="Read-only view of today's appointment slots"
        />

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Slots', value: filteredSlots.length, color: 'blue', icon: '🗓️' },
            { label: 'Available', value: available, color: 'emerald', icon: '✅' },
            { label: 'Booked', value: booked, color: 'orange', icon: '👤' },
          ].map(({ label, value, color, icon }) => (
            <div key={label} className={`bg-white border border-${color}-100 rounded-2xl p-5 shadow-sm`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{icon}</span>
                <div>
                  <p className="text-2xl font-black text-slate-900">{value}</p>
                  <p className="text-xs text-slate-500 font-medium">{label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <input
            type="date"
            className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
          />
          <select
            className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
            value={filterClinic}
            onChange={e => setFilterClinic(e.target.value)}
          >
            <option value="">All clinics</option>
            {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {filterClinic && (
            <button
              onClick={() => setFilterClinic('')}
              className="px-4 py-2.5 bg-red-50 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-100 transition-all"
            >
              Clear Filter
            </button>
          )}
        </div>

        {/* Slot List */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <h2 className="text-base font-black text-slate-900">
              Schedule for {new Date(filterDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h2>
          </div>

          {loading ? (
            <LoadingSkeleton variant="list" rows={5} />
          ) : filteredSlots.length === 0 ? (
            <EmptyState
              icon="event_busy"
              title="No slots scheduled for this date"
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredSlots.map((slot, i) => {
                const appointment = slot.appointments?.[0];
                const patient = appointment?.patients;
                const patientName = patient?.users
                  ? `${patient.users.first_name} ${patient.users.last_name}`
                  : 'Walk-in';

                return (
                  <motion.div
                    key={slot.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }}
                    className="px-6 py-4 flex items-center gap-4"
                  >
                    {/* Time */}
                    <div className="w-28 flex-shrink-0 text-center bg-blue-50 border border-blue-100 rounded-xl py-2">
                      <p className="text-sm font-black text-blue-700">{formatTime(slot.start_time)}</p>
                      <p className="text-[11px] text-blue-500 font-medium">– {formatTime(slot.end_time)}</p>
                    </div>

                    {/* Patient info */}
                    <div className="flex-1 min-w-0">
                      {!slot.is_active && appointment ? (
                        <>
                          <p className="text-sm font-bold text-slate-900">{patientName}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Status: <span className="font-semibold text-slate-600 capitalize">{appointment.status}</span>
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-slate-400 italic">No patient booked</p>
                      )}
                      {slot.clinics && (
                        <p className="text-xs text-blue-600 mt-0.5">📍 {slot.clinics.name}</p>
                      )}
                    </div>

                    {/* Status */}
                    <span className={`px-3 py-1.5 rounded-full text-xs font-bold flex-shrink-0 ${
                      slot.is_active
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-orange-50 text-orange-700'
                    }`}>
                      {slot.is_active ? '✅ Available' : '👤 Booked'}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}