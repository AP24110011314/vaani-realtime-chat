import { useState } from 'react'
import { createPortal } from 'react-dom'
import { formatTime } from '../../lib/formatters'
import {
  Clock,
  Check,
  CheckCheck,
  AlertCircle,
  Copy,
  Pencil,
  Trash2,
  Reply,
  Smile,
  Info,
} from 'lucide-react'
import AttachmentPreview from './AttachmentPreview'

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

function renderContentWithLinks(text, isMine) {
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
          className={`underline break-all font-medium ${
            isMine
              ? 'opacity-95 hover:opacity-100'
              : 'text-accent-text hover:opacity-80'
          }`}
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
  isGroup = false,
  isGroupAdmin = false,
  isGroupedWithPrev = false,
  isGroupedWithNext = false,
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
      <div className="flex justify-center my-2.5 select-text">
        <span className="text-[11px] font-medium glass-subtle text-ink-muted px-3.5 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    )
  }

  const tailRadiusClass = isMine
    ? !isGroupedWithNext
      ? 'rounded-[20px] rounded-br-[6px]'
      : 'rounded-[20px]'
    : !isGroupedWithPrev
    ? 'rounded-[20px] rounded-tl-[6px]'
    : 'rounded-[20px]'

  return (
    <div
      id={`msg-${message.id}`}
      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} ${
        isGroupedWithNext ? 'mb-0.5' : 'mb-3'
      } group relative animate-msg-in`}
    >
      {/* Sender name for group chats (only first bubble of consecutive run) */}
      {isGroup && !isMine && !isGroupedWithPrev && message.sender?.name && (
        <span className="text-[11px] font-semibold text-accent-text mb-1 ml-2">
          {message.sender.name}
        </span>
      )}

      {/* Floating Glass Action Menu */}
      {!isDeleted && !isPending && !isFailed && (
        <div
          className={`opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity absolute -top-7 ${
            isMine ? 'right-1' : 'left-1'
          } z-10 flex items-center glass-strong rounded-full px-1.5 py-0.5 gap-0.5 text-ink-muted`}
        >
          {/* Quick Reaction Bar Popover Toggle */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className="p-1.5 hover:text-ink hover:bg-[var(--glass-bg-hover)] rounded-full transition-colors focus-accent cursor-pointer"
              title="React"
              aria-label="React to message"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>

            {showEmojiPicker && (
              <div
                className={`absolute bottom-full mb-1.5 ${
                  isMine ? 'right-0' : 'left-0'
                } flex items-center gap-1 p-1.5 glass-strong rounded-full z-30 animate-modal-in`}
              >
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onToggleReaction?.(message, emoji)
                      setShowEmojiPicker(false)
                    }}
                    className="p-1 hover:scale-125 transition-transform text-sm cursor-pointer"
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
            className="p-1.5 hover:text-accent-text hover:bg-[var(--glass-bg-hover)] rounded-full transition-colors focus-accent cursor-pointer"
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
              className="p-1.5 hover:text-ink hover:bg-[var(--glass-bg-hover)] rounded-full transition-colors focus-accent cursor-pointer"
              title={copied ? 'Copied!' : 'Copy text'}
              aria-label={copied ? 'Copied' : 'Copy text'}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-[var(--success-text)]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {/* Edit (if sender, within 15 min) */}
          {canEdit && (
            <button
              type="button"
              onClick={() => onEdit?.(message)}
              className="p-1.5 hover:text-[var(--warning-text)] hover:bg-[var(--glass-bg-hover)] rounded-full transition-colors focus-accent cursor-pointer"
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
              className="p-1.5 hover:text-[var(--danger-text)] hover:bg-[var(--glass-bg-hover)] rounded-full transition-colors focus-accent cursor-pointer"
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
              className="p-1.5 hover:text-accent-text hover:bg-[var(--glass-bg-hover)] rounded-full transition-colors focus-accent cursor-pointer"
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
        className={`max-w-[85%] sm:max-w-[70%] px-3.5 py-2.5 ${tailRadiusClass} break-words text-[15px] transition-all ${
          isMine
            ? isFailed
              ? 'bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger-text)]'
              : 'bubble-sent'
            : 'bubble-received'
        } ${isPending ? 'opacity-70' : ''}`}
      >
        {/* Quoted Reply snippet */}
        {message.replyTo && (
          <div
            onClick={() => onJumpToMessage?.(message.replyTo.id)}
            className={`mb-1.5 text-xs px-2.5 py-1.5 rounded-xl border-l-2 cursor-pointer hover:opacity-90 transition-opacity ${
              isMine
                ? 'bg-black/15 border-current/60'
                : 'bg-[var(--glass-bg-subtle)] border-[var(--accent-solid)] text-ink'
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
              <span className="italic text-xs opacity-75">
                This message was deleted
              </span>
            ) : (
              renderContentWithLinks(message.content, isMine)
            )}
          </p>
        ) : null}

        {/* Footer timestamp & status indicators inside bubble bottom-right */}
        <div
          className={`flex items-center justify-end gap-1 mt-1 text-[10px] tabular-nums ${
            isMine && !isFailed ? 'text-[var(--bubble-sent-meta)]' : 'text-ink-subtle'
          }`}
        >
          {message.editedAt && !isDeleted && (
            <span className="text-[9px] italic opacity-85">edited</span>
          )}
          <span>{formatTime(message.createdAt)}</span>
          {isPending && <Clock className="w-3 h-3 animate-spin" />}
          {isFailed && (
            <button
              onClick={() => onRetry?.(message)}
              className="flex items-center gap-0.5 text-[var(--danger-text)] font-semibold hover:underline cursor-pointer"
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
                <CheckCheck
                  className="w-3.5 h-3.5 text-sky-200 dark:text-[#031416] opacity-100"
                  aria-label="Read"
                />
              ) : isDelivered ? (
                <CheckCheck className="w-3.5 h-3.5 opacity-65" aria-label="Delivered" />
              ) : (
                <Check className="w-3.5 h-3.5 opacity-65" aria-label="Sent" />
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
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs transition-all cursor-pointer focus-accent ${
                r.reactedByMe
                  ? 'glass-strong border-[var(--accent-soft-border)] text-accent-text font-semibold'
                  : 'glass-subtle text-ink hover:bg-[var(--glass-bg-hover)]'
              }`}
              title={`${r.count} reaction${r.count > 1 ? 's' : ''}`}
            >
              <span>{r.emoji}</span>
              <span className="text-[11px] tabular-nums">{r.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Delete Confirmation Glass Modal */}
      {showDeleteConfirm &&
        (typeof document !== 'undefined'
          ? createPortal(
              <div
                className="fixed inset-0 z-50 flex items-center justify-center glass-modal-backdrop p-4"
                onClick={() => setShowDeleteConfirm(false)}
              >
                <div
                  className="glass-strong rounded-3xl p-6 max-w-sm w-full text-ink animate-modal-in"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-base font-bold text-ink mb-2">Delete message?</h3>
                  <p className="text-xs text-ink-muted mb-5 leading-relaxed">
                    This message will be deleted for everyone in this conversation. Any attachments will be permanently removed.
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-4 py-2 rounded-full text-xs font-semibold btn-glass cursor-pointer focus-accent"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteConfirm(false)
                        onDelete?.(message)
                      }}
                      className="px-4 py-2 rounded-full text-xs font-semibold bg-[var(--danger-solid)] hover:brightness-110 text-white transition-all active:scale-95 cursor-pointer focus-accent"
                    >
                      Delete for everyone
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )
          : null)}
    </div>
  )
}
