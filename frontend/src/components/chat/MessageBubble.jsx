import { formatTime } from '../../lib/formatters'
import { Clock, AlertCircle } from 'lucide-react'

export default function MessageBubble({ message, isMine, onRetry }) {
  const isPending = message.pending
  const isFailed = message.failed
  const isDeleted = message.deleted

  return (
    <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} mb-1.5 group`}>
      <div
        className={`max-w-[85%] sm:max-w-[70%] px-3.5 py-2 rounded-2xl break-words text-sm shadow-sm transition-all ${
          isMine
            ? isFailed
              ? 'bg-rose-950/80 border border-rose-800 text-rose-200 rounded-tr-xs'
              : 'bg-indigo-600 text-white rounded-tr-xs'
            : 'bg-slate-800/90 text-slate-100 border border-slate-700/50 rounded-tl-xs'
        } ${isPending ? 'opacity-70' : ''}`}
      >
        {/* Reply snippet if any */}
        {message.replyTo && (
          <div
            className={`mb-1.5 text-xs px-2.5 py-1 rounded-lg border-l-2 ${
              isMine
                ? 'bg-indigo-700/60 border-white/60 text-indigo-100'
                : 'bg-slate-900/60 border-indigo-400 text-slate-300'
            }`}
          >
            <span className="font-semibold block truncate">
              {message.replyTo.senderName}
            </span>
            <span className="truncate block opacity-80">
              {message.replyTo.snippet}
            </span>
          </div>
        )}

        {/* Message Content */}
        <p className="whitespace-pre-wrap leading-relaxed select-text">
          {isDeleted ? (
            <span className="italic text-xs opacity-70">
              This message was deleted
            </span>
          ) : (
            message.content
          )}
        </p>

        {/* Footer timestamp & status indicators */}
        <div
          className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
            isMine ? 'text-indigo-200/80' : 'text-slate-400'
          }`}
        >
          <span>{formatTime(message.createdAt)}</span>
          {isPending && <Clock className="w-3 h-3 animate-spin" />}
          {isFailed && (
            <button
              onClick={() => onRetry?.(message)}
              className="flex items-center gap-0.5 text-rose-300 hover:underline"
              title="Failed to send. Click to retry."
            >
              <AlertCircle className="w-3 h-3" />
              <span>Retry</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
