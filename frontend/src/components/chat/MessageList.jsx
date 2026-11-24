import { useEffect, useRef, useLayoutEffect } from 'react'
import MessageBubble from './MessageBubble'
import { formatMessageDateGroup } from '../../lib/formatters'
import { Loader2 } from 'lucide-react'

export default function MessageList({
  messages = [],
  currentUserId,
  onLoadOlder,
  hasOlder,
  isLoadingOlder,
  onRetryMessage,
}) {
  const containerRef = useRef(null)
  const previousScrollHeightRef = useRef(0)
  const isInitialLoadRef = useRef(true)

  // Scroll to bottom on initial load and when sending new message
  useEffect(() => {
    if (isInitialLoadRef.current && messages.length > 0) {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight
      }
      isInitialLoadRef.current = false
    }
  }, [messages.length])

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
    if (!containerRef.current || isLoadingOlder || !hasOlder) return
    // Detect scroll near top
    if (containerRef.current.scrollTop < 60) {
      previousScrollHeightRef.current = containerRef.current.scrollHeight
      onLoadOlder()
    }
  }

  // Scroll to bottom helper for new message sent by user
  useEffect(() => {
    const lastMsg = messages[messages.length - 1]
    if (lastMsg && (lastMsg.sender?.id === currentUserId || lastMsg.pending)) {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight
      }
    }
  }, [messages, currentUserId])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
        <p className="text-sm font-medium text-slate-300">No messages yet</p>
        <p className="text-xs text-slate-500 mt-1">Send a message below to start the conversation!</p>
      </div>
    )
  }

  return (
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
            <MessageBubble
              message={message}
              isMine={isMine}
              onRetry={onRetryMessage}
            />
          </div>
        )
      })}
    </div>
  )
}
