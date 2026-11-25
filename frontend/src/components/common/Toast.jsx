export default function Toast({ message, type = 'info', onClose }) {
  if (!message) return null

  const types = {
    info: 'border-[var(--glass-border)] text-ink',
    success: 'border-[var(--success-border)] text-[var(--success-text)]',
    error: 'border-[var(--danger-border)] text-[var(--danger-text)]',
    warning: 'border-[var(--warning-border)] text-[var(--warning-text)]',
  }

  return (
    <div
      role="alert"
      className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-3xl glass-strong animate-modal-in ${types[type] || types.info}`}
    >
      <span className="text-sm font-medium">{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="text-ink-muted hover:text-ink p-1 rounded-xl hover:bg-[var(--glass-bg-hover)] transition-colors focus-accent cursor-pointer"
          title="Close"
          aria-label="Close"
        >
          &times;
        </button>
      )}
    </div>
  )
}
