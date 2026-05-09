const noop = () => {};

export function AppointmentCancelInlineConfirm({
  appointmentId,
  isConfirming,
  reason = '',
  submitting = false,
  onOpen = noop,
  onKeep = noop,
  onReasonChange = noop,
  onConfirm = noop,
  triggerLabel = 'Cancel',
  prompt = 'Cancel this appointment?',
  reasonLabel = 'Cancellation reason',
  keepLabel = 'Keep',
  confirmLabel = 'Yes, Cancel',
  className = '',
}) {
  if (!isConfirming) {
    return (
      <button
        type="button"
        onClick={() => onOpen(appointmentId)}
        className={className || 'px-3 py-1.5 text-xs font-medium text-red-500 border border-red-200 hover:bg-red-50 rounded-lg transition-all'}
      >
        {triggerLabel}
      </button>
    );
  }

  const trimmedReason = reason.trim();
  const reasonId = `cancel-reason-${appointmentId}`;

  return (
    <div className="flex w-72 max-w-full flex-col items-end gap-2">
      <p className="text-xs text-slate-600 font-medium">{prompt}</p>
      <label htmlFor={reasonId} className="sr-only">
        {reasonLabel}
      </label>
      <textarea
        id={reasonId}
        value={reason}
        onChange={(event) => onReasonChange(event.target.value)}
        placeholder={reasonLabel}
        rows="2"
        className="w-full rounded-lg border border-red-100 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition-all focus:border-red-300 focus:ring-2 focus:ring-red-100"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onKeep}
          className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
        >
          {keepLabel}
        </button>
        <button
          type="button"
          onClick={() => onConfirm(appointmentId, trimmedReason)}
          disabled={submitting || !trimmedReason}
          className="px-3 py-1.5 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-all disabled:opacity-50"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
