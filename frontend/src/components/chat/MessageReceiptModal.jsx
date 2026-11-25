import { useQuery } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { X, Check, CheckCheck, Loader2, Info } from 'lucide-react'
import { receiptApi } from '../../api/receiptApi'
import { formatTime } from '../../lib/formatters'
import UserAvatar from '../common/UserAvatar'

export default function MessageReceiptModal({ isOpen, onClose, message }) {
  const {
    data: receipts = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['receipts', message?.id],
    queryFn: () => receiptApi.getReceipts(message.id),
    enabled: Boolean(isOpen && message?.id),
  })

  if (!isOpen || !message) return null

  const errorMessage = error?.response?.data?.message || error?.message

  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 glass-modal-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm glass-strong rounded-3xl overflow-hidden flex flex-col max-h-[85vh] animate-modal-in"
      >
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-[var(--glass-border)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-2xl bg-[var(--accent-soft-bg)] border border-[var(--accent-soft-border)] text-accent-text flex items-center justify-center">
              <Info className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-ink">Message Info</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-ink-muted hover:text-ink hover:bg-[var(--glass-bg-hover)] rounded-xl transition-colors focus-accent cursor-pointer"
            title="Close message info"
            aria-label="Close message info"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message preview snippet */}
        <div className="p-4 bg-[var(--glass-bg-subtle)] border-b border-[var(--glass-border)]">
          <p className="text-xs text-ink line-clamp-3 italic">
            "{message.content || 'Attachment'}"
          </p>
          <div className="mt-1.5 text-[10px] text-ink-subtle tabular-nums">
            Sent {message.createdAt ? formatTime(message.createdAt) : ''}
          </div>
        </div>

        {/* Recipient receipts list */}
        <div className="p-4 flex-1 overflow-y-auto space-y-2.5">
          <h4 className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider tabular-nums">
            Recipients ({receipts.length})
          </h4>

          {isLoading && (
            <div className="py-6 flex flex-col items-center justify-center text-ink-muted text-xs">
              <Loader2 className="w-5 h-5 animate-spin text-accent-text mb-1.5" />
              <span>Loading delivery status...</span>
            </div>
          )}

          {error && (
            <div role="alert" className="p-3 rounded-2xl bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger-text)] text-xs">
              {errorMessage || 'Failed to load receipts'}
            </div>
          )}

          {!isLoading && !error && receipts.length === 0 && (
            <p className="text-xs text-ink-subtle italic py-4 text-center">No other members in this chat.</p>
          )}

          {!isLoading && !error && receipts.map((r) => {
            const isRead = r.status === 'READ'
            const isDelivered = r.status === 'DELIVERED'

            return (
              <div
                key={r.userId}
                className="flex items-center justify-between p-2.5 rounded-2xl glass-subtle"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <UserAvatar name={r.name} seed={r.userId || r.name} size="sm" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink truncate">{r.name}</p>
                    <p className="text-[10px] text-ink-subtle tabular-nums">
                      {r.updatedAt ? formatTime(r.updatedAt) : 'Pending'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isRead ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-accent-text font-semibold">
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Read</span>
                    </span>
                  ) : isDelivered ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted font-medium">
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Delivered</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-ink-subtle">
                      <Check className="w-3.5 h-3.5" />
                      <span>Sent</span>
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal
}
