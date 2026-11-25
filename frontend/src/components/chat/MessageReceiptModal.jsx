import { useQuery } from '@tanstack/react-query'
import { X, Check, CheckCheck, Loader2, Info } from 'lucide-react'
import { receiptApi } from '../../api/receiptApi'
import { formatTime } from '../../lib/formatters'

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
    >
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <Info className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Message Info</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close message info"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message preview snippet */}
        <div className="p-3.5 bg-slate-950/60 border-b border-slate-800/80">
          <p className="text-xs text-slate-300 line-clamp-3 italic">
            "{message.content || 'Attachment'}"
          </p>
          <div className="mt-1 text-[10px] text-slate-500">
            Sent {message.createdAt ? formatTime(message.createdAt) : ''}
          </div>
        </div>

        {/* Recipient receipts list */}
        <div className="p-3.5 flex-1 overflow-y-auto space-y-2.5">
          <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Recipients ({receipts.length})
          </h4>

          {isLoading && (
            <div className="py-6 flex flex-col items-center justify-center text-slate-500 text-xs">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-400 mb-1.5" />
              <span>Loading delivery status...</span>
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
              {errorMessage || 'Failed to load receipts'}
            </div>
          )}

          {!isLoading && !error && receipts.length === 0 && (
            <p className="text-xs text-slate-500 italic py-4 text-center">No other members in this chat.</p>
          )}

          {!isLoading && !error && receipts.map((r) => {
            const isRead = r.status === 'READ'
            const isDelivered = r.status === 'DELIVERED'

            return (
              <div
                key={r.userId}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-950/40 border border-slate-800/60"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-xs font-semibold shrink-0">
                    {r.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{r.name}</p>
                    <p className="text-[10px] text-slate-400">
                      {r.updatedAt ? formatTime(r.updatedAt) : 'Pending'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isRead ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-sky-400 font-medium">
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Read</span>
                    </span>
                  ) : isDelivered ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Delivered</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
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
}
