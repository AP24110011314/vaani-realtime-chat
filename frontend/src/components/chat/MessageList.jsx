import { useEffect, useRef, useLayoutEffect, useState, useMemo, useCallback } from 'react'
import MessageBubble from './MessageBubble'
import { formatMessageDateGroup } from '../../lib/formatters'
import { Loader2, ArrowDown } from 'lucide-react'

// Imperative highlight helpers — avoids setState-in-effect entirely
const HIGHLIGHT_CLASSES = ['bg-indigo-950/70', 'ring-2', 'ring-indigo-500', 'p-1.5', 'transition-all']

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
  onReply,
  onEdit,
  onDelete,
  onToggleReaction,
  highlightedMessageId,
}) {
  const containerRef = useRef(null)
  const previousScrollHeightRef = useRef(0)
  const isInitialLoadRef = useRef(true)
  const prevMessagesLengthRef = useRef(messages.length)
  const [showScrollBottomPill, setShowScrollBottomPill] = useState(false)
  // Ref to track the currently highlighted message for cleanup
  const currentHighlightRef = useRef(null)
  const highlightTimerRef = useRef(null)

  // Find index of first unread message for the unread divider
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

  // Scroll to bottom on initial load
  useEffect(() => {
    if (isInitialLoadRef.current && messages.length > 0) {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight
      }
      isInitialLoadRef.current = false
      onNearBottom?.()
    }
  }, [messages.length, onNearBottom])

  // Maintain scroll position when prepending older messages
  useLayoutEffect(() => {
    if (previousScrollHeightRef.current > 0 && containerRef.current) {
      const heightDiff =
        containerRef.current.scrollHeight - previousScrollHeightRef.current
      containerRef.current.scrollTop += heightDiff
      previousScrollHeightRef.current = 0
    }
  }, [messages])

  // Imperative highlight effect — zero setState calls, purely DOM manipulation
  useEffect(() => {
    if (!highlightedMessageId) return
    // Clear previous highlight
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

  // jumpToMessage is called from MessageBubble (via onJumpToMessage prop) for quoted reply navigation
  // Uses imperative DOM manipulation — no setState needed
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

  // Detect when incoming message arrives while scrolled up
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      if (containerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
        const lastMsg = messages[messages.length - 1]
        const isMine = lastMsg?.sender?.id === currentUserId || lastMsg?.pending

        if (isNearBottom || isMine) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight
          setShowScrollBottomPill(false)
          onNearBottom?.()
        } else {
          setShowScrollBottomPill(true)
        }
      }
    }
    prevMessagesLengthRef.current = messages.length
  }, [messages, currentUserId, onNearBottom])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
        <p className="text-sm font-medium text-slate-300">No messages yet</p>
        <p className="text-xs text-slate-500 mt-1">Send a message below to start the conversation!</p>
      </div>
    )
  }

  return (
    <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-1 select-text"
      >
        {/* Loading older indicator at top */}
        {isLoadingOlder && (
          <div className="flex items-center justify-center py-2 text-xs text-indigo-400">
            <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
            Loading older messages...
          </div>
        )}

        {messages.map((message, index) => {
          const dateHeader = formatMessageDateGroup(message.createdAt)
          const prevMessage = index > 0 ? messages[index - 1] : null
          const prevDateHeader = prevMessage
            ? formatMessageDateGroup(prevMessage.createdAt)
            : null
          const showDateDivider = dateHeader !== prevDateHeader
          const showUnreadDivider = index === firstUnreadIndex

          const isMine =
            message.sender?.id === currentUserId ||
            message.isMine ||
            message.pending

          return (
            <div
              key={message.id || message.clientMessageId}
              id={`msg-${message.id || message.clientMessageId}`}
              className="rounded-2xl"
            >
              {showDateDivider && (
                <div className="flex items-center justify-center my-3">
                  <span className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[11px] font-medium text-slate-400 shadow-xs">
                    {dateHeader}
                  </span>
                </div>
              )}

              {showUnreadDivider && (
                <div className="flex items-center justify-center my-3">
                  <span className="px-3.5 py-1 rounded-full bg-indigo-950/90 border border-indigo-600/70 text-[11px] font-bold text-indigo-300 shadow-xs">
                    {unreadCount} unread message{unreadCount > 1 ? 's' : ''}
                  </span>
                </div>
              )}

              <MessageBubble
                message={message}
                isMine={isMine}
                isGroup={isGroup}
                isGroupAdmin={isGroupAdmin}
                onRetry={onRetryMessage}
                onShowReceipts={onShowReceipts}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleReaction={onToggleReaction}
                onJumpToMessage={jumpToMessage}
              />
            </div>
          )
        })}
      </div>

      {/* Floating Jump to Latest Button */}
      {showScrollBottomPill && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20">
          <button
            type="button"
            onClick={scrollToBottom}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-full shadow-lg shadow-black/50 transition-transform active:scale-95 animate-in fade-in"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            <span>Jump to latest</span>
          </button>
        </div>
      )}
    </div>
  )
}
