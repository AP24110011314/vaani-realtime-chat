import { MessageSquare, X } from 'lucide-react'

export default function ToastNotification({ toast, onSelect, onDismiss }) {
  if (!toast) return null

  return (
    <div
      role="alert"
      className="fixed top-4 right-4 z-50 max-w-sm w-full animate-modal-in"
    >
      <div
        onClick={() => onSelect(toast.conversationId)}
        className="cursor-pointer flex items-start gap-3 p-3.5 glass-strong rounded-3xl border-[var(--accent-soft-border)] hover:border-[var(--accent-solid)] transition-colors"
      >
        <div className="w-9 h-9 rounded-2xl bg-[var(--accent-soft-bg)] border border-[var(--accent-soft-border)] text-accent-text flex items-center justify-center shrink-0">
          <MessageSquare className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center justify-between gap-2">
            <h5 className="text-xs font-bold text-ink truncate">{toast.senderName}</h5>
            <span className="text-[10px] font-semibold text-accent-text whitespace-nowrap">
              New message
            </span>
          </div>
          <p className="text-xs text-ink-muted truncate mt-0.5">
            {toast.content || 'Sent an attachment'}
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDismiss()
          }}
          className="text-ink-subtle hover:text-ink p-1 rounded-xl hover:bg-[var(--glass-bg-hover)] transition-colors focus-accent cursor-pointer"
          title="Dismiss notification"
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
