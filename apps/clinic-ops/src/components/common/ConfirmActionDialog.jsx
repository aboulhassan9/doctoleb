import { motion, AnimatePresence } from 'framer-motion';

export default function ConfirmActionDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) {
  const confirmClass = variant === 'danger'
    ? 'bg-critical text-white hover:brightness-110'
    : 'bg-primary text-white hover:brightness-110';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            className="w-full max-w-md rounded-[2rem] border border-white/40 bg-white p-7 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-xl font-black tracking-tight text-slate-950">{title}</h2>
            {description && <p className="mt-3 text-sm font-medium leading-relaxed text-slate-500">{description}</p>}
            <div className="mt-7 flex justify-end gap-3">
              <button type="button" onClick={onCancel} className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-600 transition-colors hover:bg-slate-200">
                {cancelLabel}
              </button>
              <button type="button" onClick={onConfirm} className={`rounded-xl px-5 py-3 text-sm font-black shadow-lg transition-all active:scale-[0.98] ${confirmClass}`}>
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
