import Modal from './Modal';

/**
 * ConfirmDialog — Replaces window.confirm() with a styled modal.
 *
 * Usage with useConfirmDialog hook:
 *   const { isOpen, title, message, open, close, onConfirm } = useConfirmDialog();
 *   <ConfirmDialog isOpen={isOpen} title={title} message={message} onConfirm={onConfirm} onCancel={close} />
 *
 * @param {{ isOpen: boolean, title?: string, message: string, confirmLabel?: string, cancelLabel?: string, variant?: 'danger'|'warning'|'default', onConfirm: () => void, onCancel: () => void }} props
 */
export default function ConfirmDialog({
  isOpen,
  title = 'Confirm Action',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) {
  const variantStyles = {
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white',
    default: 'bg-primary hover:bg-primary-hover text-white',
  };

  const iconMap = {
    danger: { icon: 'warning', color: 'bg-red-50 text-red-600' },
    warning: { icon: 'help', color: 'bg-amber-50 text-amber-600' },
    default: { icon: 'info', color: 'bg-blue-50 text-blue-600' },
  };

  const { icon, color } = iconMap[variant] || iconMap.default;

  return (
    <Modal isOpen={isOpen} onClose={onCancel} size="sm">
      <div className="flex flex-col items-center text-center">
        <div className={`w-14 h-14 rounded-full ${color} flex items-center justify-center mb-4`}>
          <span className="material-symbols-outlined text-3xl">{icon}</span>
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 mb-6 max-w-xs">{message}</p>
        <div className="flex items-center gap-3 w-full">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${variantStyles[variant] || variantStyles.default}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
