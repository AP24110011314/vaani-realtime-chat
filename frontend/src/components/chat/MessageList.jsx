import { useEffect, useRef, useLayoutEffect, useState, useMemo } from 'react'
import MessageBubble from './MessageBubble'
import { formatMessageDateGroup } from '../../lib/formatters'
import { Loader2, ArrowDown } from 'lucide-react'

export default function MessageList({
  messages = [],
  currentUserId,
  isGroup = false,
  unreadCount = 0,
  onLoadOlder,
  hasOlder,
  isLoadingOlder,
  onRetryMessage,
  onShowReceipts,
  onNearBottom,
}) {
  const containerRef = useRef(null)
  const previousScrollHeightRef = useRef(0)
  const isInitialLoadRef = useRef(true)
  const prevMessagesLengthRef = useRef(messages.length)
  const [showNewMessagesPill, setShowNewMessagesPill] = useState(false)

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

  // Scroll to bottom on initial load and when sending new message
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

  const handleScroll = () => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 60

    if (isNearBottom) {
      setShowNewMessagesPill(false)
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
      setShowNewMessagesPill(false)
      onNearBottom?.()
    }
  }

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
          setShowNewMessagesPill(false)
          onNearBottom?.()
        } else {
          setShowNewMessagesPill(true)
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
            <div key={message.id || message.clientMessageId}>
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
                onRetry={onRetryMessage}
                onShowReceipts={onShowReceipts}
              />
            </div>
          )
        })}
      </div>

      {/* Floating New Messages Pill */}
      {showNewMessagesPill && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20">
          <button
            type="button"
            onClick={scrollToBottom}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-full shadow-lg shadow-black/50 transition-transform active:scale-95 animate-in fade-in"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            <span>New messages</span>
          </button>
        </div>
      )}
    </div>
  )
}
