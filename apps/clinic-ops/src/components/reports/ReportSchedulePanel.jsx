/**
 * ReportSchedulePanel — set up an automated run schedule for a report.
 * Review FEAT-4.
 *
 * A scheduled report runs daily / weekly / monthly via a pg_cron-driven
 * executor; each run lands in the shared `analytical_report_runs` ledger,
 * so the owner sees it in the viewer's "Your recent runs" panel.
 *
 * Self-contained overlay modal. One schedule per report.
 *
 * Props:
 *   report        — the analytical_reports row (needs id, name, created_by)
 *   currentUserId — the acting user's users.id
 *   isAdmin       — whether the actor is an admin
 *   onClose       — close callback
 */

import { useEffect, useState } from 'react';
import { analyticalReportService } from '@core/services/analyticalReports';
import { timeAgo } from '@core/lib/dateUtils';

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
];

const DOW_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => ({
  value: h,
  label: `${String(h).padStart(2, '0')}:00`,
}));

const DOM_OPTIONS = Array.from({ length: 28 }, (_, i) => ({
  value: i + 1,
  label: String(i + 1),
}));

// A curated set keeps the value a valid IANA zone — free text could feed
// `AT TIME ZONE 'garbage'` and fail the schedule's next-run computation.
const TIMEZONE_OPTIONS = [
  'UTC',
  'Asia/Beirut',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Dubai',
];

export default function ReportSchedulePanel({ report, currentUserId, isAdmin, onClose }) {
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [frequency, setFrequency] = useState('weekly');
  const [hour, setHour] = useState(8);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [timezone, setTimezone] = useState('UTC');
  const [isActive, setIsActive] = useState(true);

  const isOwner = Boolean(report?.created_by) && report.created_by === currentUserId;
  const canManage = isOwner || isAdmin;

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const res = await analyticalReportService.getScheduleByReport(report.id);
      if (!alive) return;
      if (res.error) setError(res.error);
      if (res.data) {
        const s = res.data;
        setSchedule(s);
        setFrequency(s.frequency);
        setHour(s.hour ?? 8);
        setDayOfWeek(s.day_of_week ?? 1);
        setDayOfMonth(s.day_of_month ?? 1);
        setTimezone(s.timezone || 'UTC');
        setIsActive(s.is_active);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [report.id]);

  function buildPayload() {
    return {
      frequency,
      hour: Number(hour),
      day_of_week: frequency === 'weekly' ? Number(dayOfWeek) : null,
      day_of_month: frequency === 'monthly' ? Number(dayOfMonth) : null,
      timezone: timezone || 'UTC',
      is_active: isActive,
    };
  }

  async function handleSave() {
    setBusy(true);
    setError('');
    const res = schedule
      ? await analyticalReportService.updateSchedule(schedule.id, buildPayload())
      : await analyticalReportService.createSchedule({
        ...buildPayload(),
        report_id: report.id,
        created_by: currentUserId,
      });
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    setSchedule(res.data);
  }

  async function handleDelete() {
    if (!schedule) return;
    setBusy(true);
    setError('');
    const res = await analyticalReportService.deleteSchedule(schedule.id);
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    setSchedule(null);
    setFrequency('weekly');
    setHour(8);
    setDayOfWeek(1);
    setDayOfMonth(1);
    setTimezone('UTC');
    setIsActive(true);
  }

  const selectClass = 'rounded border border-slate-300 px-2 py-1.5 text-sm';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Schedule report"
    >
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-800">
            Schedule “{report?.name || 'report'}”
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <>
              <p className="text-xs text-slate-500">
                The report runs automatically and the result appears in “Your recent runs”.
                Runs use your access — a scheduled run sees exactly what you would.
              </p>

              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                  Frequency
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    disabled={!canManage || busy}
                    className={selectClass}
                  >
                    {FREQUENCY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>

                {frequency === 'weekly' && (
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    Day
                    <select
                      value={dayOfWeek}
                      onChange={(e) => setDayOfWeek(e.target.value)}
                      disabled={!canManage || busy}
                      className={selectClass}
                    >
                      {DOW_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                )}

                {frequency === 'monthly' && (
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    Day of month
                    <select
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(e.target.value)}
                      disabled={!canManage || busy}
                      className={selectClass}
                    >
                      {DOM_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                  At
                  <select
                    value={hour}
                    onChange={(e) => setHour(e.target.value)}
                    disabled={!canManage || busy}
                    className={selectClass}
                  >
                    {HOUR_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                  Timezone
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    disabled={!canManage || busy}
                    className={selectClass}
                  >
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  disabled={!canManage || busy}
                  className="rounded border-slate-300"
                />
                Active
              </label>

              {schedule && (
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 space-y-0.5">
                  {schedule.is_active && schedule.next_run_at && (
                    <div>Next run: {new Date(schedule.next_run_at).toLocaleString()}</div>
                  )}
                  {!schedule.is_active && <div>Paused — no runs are scheduled.</div>}
                  {schedule.last_run_at && (
                    <div>
                      Last run: {timeAgo(schedule.last_run_at)}
                      {schedule.last_status ? ` · ${schedule.last_status}` : ''}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
          <div>
            {schedule && canManage && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
              >
                Remove schedule
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
            {canManage && (
              <button
                type="button"
                onClick={handleSave}
                disabled={busy || loading}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? 'Saving…' : (schedule ? 'Save changes' : 'Create schedule')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
