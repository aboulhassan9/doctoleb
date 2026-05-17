/**
 * ReportSharePanel — manage who can edit an analytical report, and (admin
 * only) transfer ownership. Review FEAT-3.
 *
 * The catalog is already staff-wide readable, so "sharing" here means
 * granting a specific colleague EDIT rights on a report they did not
 * author. An `edit` grant lets them change the report and publish new
 * versions; `view` is a recorded baseline with no RLS effect today.
 *
 * Self-contained overlay modal — loads its own shares + staff list.
 *
 * Props:
 *   report            — the analytical_reports row (needs id, name, created_by)
 *   currentUserId     — the acting user's users.id
 *   isAdmin           — whether the actor is an admin (gates ownership transfer)
 *   onClose           — close callback
 *   onOwnershipChanged(updatedReport) — fired after a successful transfer
 */

import { useEffect, useState } from 'react';
import { analyticalReportService } from '@core/services/analyticalReports';
import { staffService } from '@core/services/staff';

const PERMISSION_OPTIONS = [
  { value: 'edit', label: 'Can edit' },
  { value: 'view', label: 'Can view' },
];

export default function ReportSharePanel({
  report, currentUserId, isAdmin, onClose, onOwnershipChanged,
}) {
  const [shares, setShares] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [addUserId, setAddUserId] = useState('');
  const [addLevel, setAddLevel] = useState('edit');
  const [transferUserId, setTransferUserId] = useState('');

  const isOwner = Boolean(report?.created_by) && report.created_by === currentUserId;
  const canManage = isOwner || isAdmin;

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [sharesRes, staffRes] = await Promise.all([
        analyticalReportService.listShares(report.id),
        staffService.getAll({ activeOnly: true, pageSize: 200 }),
      ]);
      if (!alive) return;
      if (sharesRes.error) setError(sharesRes.error);
      if (Array.isArray(sharesRes.data)) setShares(sharesRes.data);
      if (Array.isArray(staffRes.data)) setStaff(staffRes.data);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [report.id]);

  function nameForUser(userId) {
    const member = staff.find((s) => s.user_id === userId);
    return member?.display_name || 'Unknown user';
  }

  async function reloadShares() {
    const res = await analyticalReportService.listShares(report.id);
    if (Array.isArray(res.data)) setShares(res.data);
  }

  const sharedIds = new Set(shares.map((s) => s.shared_with_user_id));
  const addCandidates = staff.filter(
    (s) => s.user_id && s.user_id !== report.created_by && !sharedIds.has(s.user_id),
  );
  const transferCandidates = staff.filter(
    (s) => s.user_id && s.user_id !== report.created_by,
  );

  async function handleAdd() {
    if (!addUserId) return;
    setBusy(true);
    setError('');
    const { error: err } = await analyticalReportService.share({
      report_id: report.id,
      shared_with_user_id: addUserId,
      permission_level: addLevel,
      granted_by: currentUserId,
    });
    setBusy(false);
    if (err) { setError(err); return; }
    setAddUserId('');
    setAddLevel('edit');
    await reloadShares();
  }

  async function handleLevelChange(share, level) {
    setBusy(true);
    setError('');
    const { error: err } = await analyticalReportService.updateShare(share.id, level);
    setBusy(false);
    if (err) { setError(err); return; }
    await reloadShares();
  }

  async function handleRemove(share) {
    setBusy(true);
    setError('');
    const { error: err } = await analyticalReportService.removeShare(share.id);
    setBusy(false);
    if (err) { setError(err); return; }
    await reloadShares();
  }

  async function handleTransfer() {
    if (!transferUserId) return;
    setBusy(true);
    setError('');
    const { data, error: err } = await analyticalReportService.transferOwnership(
      report.id, transferUserId,
    );
    setBusy(false);
    if (err) { setError(err); return; }
    setTransferUserId('');
    if (data && onOwnershipChanged) onOwnershipChanged(data);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Share report"
    >
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-800">
            Share “{report?.name || 'report'}”
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

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  People with access
                </h3>
                {shares.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Only the owner can edit this report. Add a colleague below.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {shares.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
                      >
                        <span className="text-sm text-slate-700">
                          {nameForUser(s.shared_with_user_id)}
                        </span>
                        <div className="flex items-center gap-2">
                          {canManage ? (
                            <select
                              value={s.permission_level}
                              onChange={(e) => handleLevelChange(s, e.target.value)}
                              disabled={busy}
                              className="rounded border border-slate-300 px-1.5 py-1 text-xs"
                              aria-label={`Permission for ${nameForUser(s.shared_with_user_id)}`}
                            >
                              {PERMISSION_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-slate-500">
                              {s.permission_level === 'edit' ? 'Can edit' : 'Can view'}
                            </span>
                          )}
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => handleRemove(s)}
                              disabled={busy}
                              className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {canManage && (
                <div className="border-t border-slate-100 pt-3">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Add a colleague
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={addUserId}
                      onChange={(e) => setAddUserId(e.target.value)}
                      className="min-w-[160px] flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
                      aria-label="Colleague to share with"
                    >
                      <option value="">— pick a colleague —</option>
                      {addCandidates.map((s) => (
                        <option key={s.user_id} value={s.user_id}>{s.display_name}</option>
                      ))}
                    </select>
                    <select
                      value={addLevel}
                      onChange={(e) => setAddLevel(e.target.value)}
                      className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                      aria-label="Permission level"
                    >
                      {PERMISSION_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAdd}
                      disabled={busy || !addUserId}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                  {addCandidates.length === 0 && (
                    <p className="mt-1 text-xs text-slate-400">No other staff available to add.</p>
                  )}
                </div>
              )}

              {isAdmin && (
                <div className="border-t border-slate-100 pt-3">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Transfer ownership
                  </h3>
                  <p className="mb-2 text-xs text-slate-500">
                    Current owner: {nameForUser(report.created_by)}. The new owner gains full control.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={transferUserId}
                      onChange={(e) => setTransferUserId(e.target.value)}
                      className="min-w-[160px] flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
                      aria-label="New owner"
                    >
                      <option value="">— pick the new owner —</option>
                      {transferCandidates.map((s) => (
                        <option key={s.user_id} value={s.user_id}>{s.display_name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleTransfer}
                      disabled={busy || !transferUserId}
                      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                    >
                      Transfer
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
