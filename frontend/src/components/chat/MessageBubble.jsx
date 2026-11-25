import { useState } from 'react'
import { formatTime } from '../../lib/formatters'
import {
  Clock,
  AlertCircle,
  Check,
  CheckCheck,
  Reply,
  Smile,
  Pencil,
  Trash2,
  Copy,
  Info,
} from 'lucide-react'
import AttachmentPreview from './AttachmentPreview'

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

function renderContentWithLinks(text) {
  if (!text) return null
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)

  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="underline text-indigo-200 dark:text-indigo-300 hover:text-white break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      )
    }
    return part
  })
}

export default function MessageBubble({
  message,
  isMine,
  isGroup,
  isGroupAdmin,
  onRetry,
  onShowReceipts,
  onReply,
  onEdit,
  onDelete,
  onToggleReaction,
  onJumpToMessage,
}) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [copied, setCopied] = useState(false)

  const isPending = message.pending
  const isFailed = message.failed
  const isDeleted = message.deleted
  const isSystem = message.messageType === 'SYSTEM' || message.type === 'SYSTEM'
  const status = message.status || 'SENT'
  const isRead = status === 'READ'
  const isDelivered = status === 'DELIVERED'

  // Can edit if sent by me, not deleted, within 15 minutes
  const [canEdit] = useState(() => {
    if (!isMine || isDeleted || isPending || isFailed || !message.createdAt) return false
    const ageMinutes = (Date.now() - new Date(message.createdAt).getTime()) / (1000 * 60)
    return ageMinutes <= 15
  })

  // Can delete if sent by me or caller is a group admin
  const canDelete = !isDeleted && !isPending && (isMine || (isGroup && isGroupAdmin))

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard?.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (isSystem) {
    return (
      <div className="flex justify-center my-2 select-text">
        <span className="text-[11px] font-medium bg-slate-800/80 dark:bg-slate-800/80 text-slate-400 px-3 py-1 rounded-full border border-slate-700/50 shadow-xs">
          {message.content}
        </span>
      </div>
    )
  }

  return (
    <div
      id={`msg-${message.id}`}
      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} mb-2 group relative transition-colors`}
    >
      {/* Sender name for group chats */}
      {isGroup && !isMine && message.sender?.name && (
        <span className="text-[11px] font-semibold text-indigo-400 mb-0.5 ml-1">
          {message.sender.name}
        </span>
      )}

      {/* Floating Action Menu (appears on hover) */}
      {!isDeleted && !isPending && !isFailed && (
        <div
          className={`opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity absolute -top-3 ${
            isMine ? 'right-2' : 'left-2'
          } z-10 flex items-center bg-slate-900 border border-slate-700/80 rounded-full px-1.5 py-0.5 shadow-md shadow-black/40 gap-0.5 text-slate-300`}
        >
          {/* Quick Reaction Bar Popover Toggle */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className="p-1 hover:text-amber-400 hover:bg-slate-800 rounded-full transition-colors"
              title="React"
              aria-label="React to message"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>

            {showEmojiPicker && (
              <div
                className={`absolute bottom-full mb-1 ${
                  isMine ? 'right-0' : 'left-0'
                } flex items-center gap-1 p-1 bg-slate-900 border border-slate-700 rounded-full shadow-xl z-30`}
              >
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onToggleReaction?.(message, emoji)
                      setShowEmojiPicker(false)
                    }}
                    className="p-1 hover:scale-125 transition-transform text-sm"
                    aria-label={`React with ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reply */}
          <button
            type="button"
            onClick={() => onReply?.(message)}
            className="p-1 hover:text-indigo-400 hover:bg-slate-800 rounded-full transition-colors"
            title="Reply"
            aria-label="Reply to message"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>

          {/* Copy Text */}
          {message.content && (
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
              title={copied ? 'Copied!' : 'Copy text'}
              aria-label={copied ? 'Copied' : 'Copy text'}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Edit (if sender, within 15 min) */}
          {canEdit && (
            <button
              type="button"
              onClick={() => onEdit?.(message)}
              className="p-1 hover:text-amber-400 hover:bg-slate-800 rounded-full transition-colors"
              title="Edit message"
              aria-label="Edit message"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Delete (if sender or group admin) */}
          {canDelete && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1 hover:text-rose-400 hover:bg-slate-800 rounded-full transition-colors"
              title="Delete message"
              aria-label="Delete message"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Message Info for Group Sender */}
          {isGroup && isMine && (
            <button
              type="button"
              onClick={() => onShowReceipts?.(message)}
              className="p-1 hover:text-sky-400 hover:bg-slate-800 rounded-full transition-colors"
              title="Message info"
              aria-label="Message info"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Main Bubble Body */}
      <div
        className={`max-w-[85%] sm:max-w-[70%] px-3.5 py-2 rounded-2xl break-words text-sm shadow-sm transition-all ${
          isMine
            ? isFailed
              ? 'bg-rose-950/80 border border-rose-800 text-rose-200 rounded-tr-xs'
              : 'bg-indigo-600 text-white rounded-tr-xs'
            : 'bg-slate-800/90 text-slate-100 border border-slate-700/50 rounded-tl-xs'
        } ${isPending ? 'opacity-70' : ''}`}
      >
        {/* Quoted Reply snippet */}
        {message.replyTo && (
          <div
            onClick={() => onJumpToMessage?.(message.replyTo.id)}
            className={`mb-1.5 text-xs px-2.5 py-1 rounded-lg border-l-2 cursor-pointer hover:opacity-90 transition-opacity ${
              isMine
                ? 'bg-indigo-700/60 border-white/60 text-indigo-100'
                : 'bg-slate-900/60 border-indigo-400 text-slate-300'
            }`}
            title="Click to jump to quoted message"
          >
            <span className="font-semibold block truncate">
              {message.replyTo.senderName}
            </span>
            <span className="truncate block opacity-80">
              {message.replyTo.snippet}
            </span>
          </div>
        )}

        {/* Attachments if any */}
        {message.attachments && message.attachments.length > 0 && !isDeleted && (
          <AttachmentPreview attachments={message.attachments} isMine={isMine} />
        )}

        {/* Message Content */}
        {(!isDeleted && message.content) || isDeleted ? (
          <p className="whitespace-pre-wrap leading-relaxed select-text">
            {isDeleted ? (
              <span className="italic text-xs opacity-70">
                This message was deleted
              </span>
            ) : (
              renderContentWithLinks(message.content)
            )}
          </p>
        ) : null}

        {/* Footer timestamp & status indicators */}
        <div
          className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
            isMine ? 'text-indigo-200/80' : 'text-slate-400'
          }`}
        >
          {message.editedAt && !isDeleted && (
            <span className="text-[9px] italic opacity-75">edited</span>
          )}
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
          {isMine && !isPending && !isFailed && (
            <button
              type="button"
              onClick={() => isGroup && onShowReceipts?.(message)}
              className={`inline-flex items-center ${
                isGroup ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
              }`}
              title={
                isGroup
                  ? `Status: ${status}. Click for details.`
                  : `Status: ${status}`
              }
            >
              {isRead ? (
                <CheckCheck className="w-3.5 h-3.5 text-sky-300" aria-label="Read" />
              ) : isDelivered ? (
                <CheckCheck className="w-3.5 h-3.5 text-indigo-200/80" aria-label="Delivered" />
              ) : (
                <Check className="w-3.5 h-3.5 text-indigo-200/80" aria-label="Sent" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Aggregated Reaction Pills */}
      {message.reactions && message.reactions.length > 0 && !isDeleted && (
        <div className={`flex flex-wrap gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
          {message.reactions.map((r) => (
            <button
              key={r.emoji}
              type="button"
              onClick={() => onToggleReaction?.(message, r.emoji)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                r.reactedByMe
                  ? 'bg-indigo-900/60 border-indigo-500 text-indigo-200 font-semibold shadow-xs'
                  : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-700/80'
              }`}
              title={`${r.count} reaction${r.count > 1 ? 's' : ''}`}
            >
              <span>{r.emoji}</span>
              <span className="text-[11px]">{r.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full shadow-2xl text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-white mb-2">Delete message?</h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              This message will be deleted for everyone in this conversation. Any attachments will be permanently removed.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false)
                  onDelete?.(message)
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors"
              >
                Delete for everyone
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
