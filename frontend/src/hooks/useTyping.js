import { useRef, useCallback, useMemo } from 'react'
import { useSocket } from './useSocket'

export function useTyping(conversationId) {
  const { sendTyping: socketSendTyping, typingMap } = useSocket()
  const isTypingRef = useRef(false)
  const idleTimerRef = useRef(null)

  // Send typing frame with 3s idle debounce
  const handleKeyStroke = useCallback(() => {
    if (!conversationId) return

    if (!isTypingRef.current) {
      isTypingRef.current = true
      socketSendTyping(conversationId, true)
    }

    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
    }

    idleTimerRef.current = setTimeout(() => {
      isTypingRef.current = false
      socketSendTyping(conversationId, false)
    }, 3000)
  }, [conversationId, socketSendTyping])

  // Explicit stop on send
  const handleStopTyping = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
    if (isTypingRef.current) {
      isTypingRef.current = false
      socketSendTyping(conversationId, false)
    }
  }, [conversationId, socketSendTyping])

  // Formatted typing indicator text for this conversation
  const typingText = useMemo(() => {
    if (!conversationId) return null
    const convTyping = typingMap[String(conversationId)] || {}
    const activeNames = Object.values(convTyping)
      .map((t) => t.name)
      .filter(Boolean)

    if (activeNames.length === 0) return null
    if (activeNames.length === 1) return `${activeNames[0]} is typing...`
    if (activeNames.length === 2) return `${activeNames[0]} and ${activeNames[1]} are typing...`
    return `${activeNames.length} people are typing...`
  }, [conversationId, typingMap])

  return {
    typingText,
    handleKeyStroke,
    handleStopTyping,
  }
}
