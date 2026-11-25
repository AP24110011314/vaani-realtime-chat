import { useEffect, useRef, useLayoutEffect, useState, useMemo, useCallback } from 'react'
import MessageBubble from './MessageBubble'
import { formatMessageDateGroup } from '../../lib/formatters'
import { Loader2, ArrowDown, AtSign } from 'lucide-react'

// Imperative highlight helpers — avoids setState-in-effect entirely
const HIGHLIGHT_CLASSES = [
  'bg-[var(--accent-soft-bg)]',
  'ring-2',
  'ring-[var(--accent-solid)]',
  'p-1.5',
  'transition-all',
]

function applyHighlightDOM(id) {
  if (!id) return
  const el = document.getElementById(`msg-${id}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    HIGHLIGHT_CLASSES.forEach((cls) => el.classList.add(cls))
  }
}

function removeHighlightDOM(id) {
  if (!id) return
  const el = document.getElementById(`msg-${id}`)
  if (el) HIGHLIGHT_CLASSES.forEach((cls) => el.classList.remove(cls))
}

const QUICK_REPLIES = ['Hey', 'Hello 👋', 'Got a minute?']

export default function MessageList({
  messages = [],
  currentUserId,
  isGroup = false,
  isGroupAdmin = false,
  unreadCount = 0,
  onLoadOlder,
  hasOlder,
  isLoadingOlder,
  onRetryMessage,
  onShowReceipts,
  onNearBottom,
  onBottomStateChange,
  onReply,
  onEdit,
  onDelete,
  onToggleReaction,
  onSendQuickReply,
  highlightedMessageId,
  onMentionClick,
}) {
  const containerRef = useRef(null)
  const previousScrollHeightRef = useRef(0)
  const isInitialLoadRef = useRef(true)
  const prevLastMessageKeyRef = useRef(null)
  const [showScrollBottomPill, setShowScrollBottomPill] = useState(false)
  const [mentionCycleIdx, setMentionCycleIdx] = useState(0)
  const currentHighlightRef = useRef(null)
  const highlightTimerRef = useRef(null)

  const mentionMessageIds = useMemo(() => {
    if (!isGroup) return []
    return messages.filter((m) => m.mentionsMe && !m.deleted && m.id).map((m) => m.id)
  }, [isGroup, messages])

  const firstUnreadIndex = useMemo(() => {
    if (!unreadCount || unreadCount <= 0 || messages.length === 0) return -1
    let count = 0
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m.sender?.id !== currentUserId && !m.pending) {
        count++
        if (count === unreadCount) {
          return i
        }
      }
    }
    return -1
  }, [messages, unreadCount, currentUserId])

  useEffect(() => {
    if (isInitialLoadRef.current && messages.length > 0) {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight
      }
      const last = messages[messages.length - 1]
      prevLastMessageKeyRef.current = last ? last.id || last.clientMessageId : null
      isInitialLoadRef.current = false
      onBottomStateChange?.(true)
      onNearBottom?.()
    }
  }, [messages, onNearBottom, onBottomStateChange])

  useLayoutEffect(() => {
    if (previousScrollHeightRef.current > 0 && containerRef.current) {
      const heightDiff =
        containerRef.current.scrollHeight - previousScrollHeightRef.current
      containerRef.current.scrollTop += heightDiff
      previousScrollHeightRef.current = 0
    }
  }, [messages])

  useEffect(() => {
    if (!highlightedMessageId) return
    clearTimeout(highlightTimerRef.current)
    removeHighlightDOM(currentHighlightRef.current)
    currentHighlightRef.current = highlightedMessageId
    applyHighlightDOM(highlightedMessageId)
    highlightTimerRef.current = setTimeout(() => {
      removeHighlightDOM(highlightedMessageId)
      currentHighlightRef.current = null
    }, 2500)
    return () => {
      clearTimeout(highlightTimerRef.current)
    }
  }, [highlightedMessageId])

  const handleScroll = () => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 60
    const isScrolledUp = scrollHeight - scrollTop - clientHeight > 150

    setShowScrollBottomPill(isScrolledUp)
    onBottomStateChange?.(isNearBottom)

    if (isNearBottom) {
      onNearBottom?.()
    }

    if (scrollTop < 60 && !isLoadingOlder && hasOlder) {
      previousScrollHeightRef.current = scrollHeight
      onLoadOlder()
    }
  }

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth',
      })
      setShowScrollBottomPill(false)
      onNearBottom?.()
    }
  }

  const jumpToMessage = useCallback((targetId) => {
    if (!targetId) return
    clearTimeout(highlightTimerRef.current)
    removeHighlightDOM(currentHighlightRef.current)
    currentHighlightRef.current = targetId
    applyHighlightDOM(targetId)
    highlightTimerRef.current = setTimeout(() => {
      removeHighlightDOM(targetId)
      currentHighlightRef.current = null
    }, 2500)
  }, [])

  useEffect(() => {
    const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null
    const lastKey = lastMsg ? lastMsg.id || lastMsg.clientMessageId : null
    const appendedAtBottom = Boolean(lastKey && lastKey !== prevLastMessageKeyRef.current)

    if (appendedAtBottom && containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
      const isMine = lastMsg?.sender?.id === currentUserId || lastMsg?.pending

      if (isNearBottom || isMine) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight
        setShowScrollBottomPill(false)
        onBottomStateChange?.(true)
        onNearBottom?.()
      } else {
        setShowScrollBottomPill(true)
      }
    }
    prevLastMessageKeyRef.current = lastKey
  }, [messages, currentUserId, onNearBottom, onBottomStateChange])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="relative w-24 h-20 mb-4 flex items-center justify-center" aria-hidden="true">
          <div className="w-16 h-12 rounded-[18px] rounded-bl-sm glass-strong flex items-center justify-center gap-1.5 animate-float-slow">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-solid)]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-solid)] opacity-70" />
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-solid)] opacity-45" />
          </div>
        </div>
        <h3 className="text-base font-bold text-ink mb-1">Say hi</h3>
        <p className="text-xs text-ink-muted max-w-[230px] mb-4 leading-relaxed">
          No messages yet. Break the ice with a quick reply or write your own below.
        </p>
        {onSendQuickReply && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {QUICK_REPLIES.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => onSendQuickReply(chip)}
                className="px-3.5 py-1.5 rounded-full btn-glass text-xs font-semibold cursor-pointer focus-accent"
              >
                {chip}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-label="Conversation messages"
        className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-0.5 select-text"
      >
        {/* Loading older indicator at top */}
        {isLoadingOlder && (
          <div className="flex items-center justify-center py-2 text-xs text-accent-text">
            <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
            Loading older messages...
          </div>
        )}

        {messages.map((message, index) => {
          const dateHeader = formatMessageDateGroup(message.createdAt)
          const prevMessage = index > 0 ? messages[index - 1] : null
          const nextMessage = index < messages.length - 1 ? messages[index + 1] : null
          const prevDateHeader = prevMessage
            ? formatMessageDateGroup(prevMessage.createdAt)
            : null
          const nextDateHeader = nextMessage
            ? formatMessageDateGroup(nextMessage.createdAt)
            : null
          const showDateDivider = dateHeader !== prevDateHeader
          const showUnreadDivider = index === firstUnreadIndex

          const isMine =
            message.sender?.id === currentUserId ||
            message.isMine ||
            message.pending

          const isSystem = message.messageType === 'SYSTEM' || message.type === 'SYSTEM'
          const prevIsSystem =
            prevMessage && (prevMessage.messageType === 'SYSTEM' || prevMessage.type === 'SYSTEM')
          const nextIsSystem =
            nextMessage && (nextMessage.messageType === 'SYSTEM' || nextMessage.type === 'SYSTEM')

          const isGroupedWithPrev =
            !showDateDivider &&
            !showUnreadDivider &&
            !isSystem &&
            !prevIsSystem &&
            prevMessage &&
            prevMessage.sender?.id === message.sender?.id &&
            message.createdAt &&
            prevMessage.createdAt &&
            Math.abs(new Date(message.createdAt) - new Date(prevMessage.createdAt)) < 5 * 60 * 1000

          const isGroupedWithNext =
            !isSystem &&
            !nextIsSystem &&
            nextMessage &&
            nextDateHeader === dateHeader &&
            nextMessage.sender?.id === message.sender?.id &&
            message.createdAt &&
            nextMessage.createdAt &&
            Math.abs(new Date(nextMessage.createdAt) - new Date(message.createdAt)) < 5 * 60 * 1000

          return (
            <div
              key={message.id || message.clientMessageId}
              id={`msg-${message.id || message.clientMessageId}`}
              className="rounded-2xl"
            >
              {showDateDivider && (
                <div className="flex items-center justify-center my-4">
                  <span className="px-3.5 py-1 rounded-full glass-subtle text-[11px] font-semibold text-ink-muted tabular-nums">
                    {dateHeader}
                  </span>
                </div>
              )}

              {showUnreadDivider && (
                <div className="flex items-center justify-center my-3">
                  <span className="px-3.5 py-1 rounded-full glass-strong border-[var(--accent-soft-border)] text-[11px] font-bold text-accent-text">
                    {unreadCount} unread message{unreadCount > 1 ? 's' : ''}
                  </span>
                </div>
              )}

              <MessageBubble
                message={message}
                isMine={isMine}
                isGroup={isGroup}
                isGroupAdmin={isGroupAdmin}
                isGroupedWithPrev={isGroupedWithPrev}
                isGroupedWithNext={isGroupedWithNext}
                onRetry={onRetryMessage}
                onShowReceipts={onShowReceipts}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleReaction={onToggleReaction}
                onJumpToMessage={jumpToMessage}
                onMentionClick={onMentionClick}
              />
            </div>
          )
        })}
      </div>

      {/* Floating Jump Pills */}
      {(showScrollBottomPill || mentionMessageIds.length > 0) && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          {mentionMessageIds.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const idx = mentionCycleIdx % mentionMessageIds.length
                jumpToMessage(mentionMessageIds[idx])
                setMentionCycleIdx((idx + 1) % mentionMessageIds.length)
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 glass-strong border-[var(--accent-soft-border)] hover:bg-[var(--glass-bg-hover)] text-accent-text text-xs font-semibold rounded-full transition-transform active:scale-95 animate-msg-in cursor-pointer focus-accent"
              title="Jump to next mention"
            >
              <AtSign className="w-3.5 h-3.5" />
              <span>Jump to mention</span>
            </button>
          )}
          {showScrollBottomPill && (
            <button
              type="button"
              onClick={scrollToBottom}
              className="flex items-center gap-1.5 px-4 py-1.5 glass-strong hover:bg-[var(--glass-bg-hover)] text-ink text-xs font-semibold rounded-full transition-transform active:scale-95 animate-msg-in cursor-pointer focus-accent"
            >
              <ArrowDown className="w-3.5 h-3.5 text-accent-text" />
              <span>Jump to latest</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
