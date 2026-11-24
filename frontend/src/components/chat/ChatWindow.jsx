import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { conversationApi } from '../../api/conversationApi'
import { messageApi } from '../../api/messageApi'
import { useSocket } from '../../hooks/useSocket'
import { useTyping } from '../../hooks/useTyping'
import ChatHeader from './ChatHeader'
import MessageList from './MessageList'
import MessageComposer from './MessageComposer'
import GroupInfoPanel from './GroupInfoPanel'
import { MessageSquare, ShieldAlert } from 'lucide-react'

export default function ChatWindow({ conversationId, onBack, currentUserId }) {
  const queryClient = useQueryClient()
  const { isConnected, sendMessage, setActiveConversationId, removedEvent } = useSocket()
  const { typingText, handleKeyStroke, handleStopTyping } = useTyping(conversationId)
  const [olderMessages, setOlderMessages] = useState([])
  const [hasOlder, setHasOlder] = useState(true)
  const [isLoadingOlder, setIsLoadingOlder] = useState(false)
  const [showGroupInfo, setShowGroupInfo] = useState(false)
  const [prevConversationId, setPrevConversationId] = useState(conversationId)
  const pendingTimersRef = useRef(new Map())

  // Reset group info panel if active conversation changes
  if (conversationId !== prevConversationId) {
    setPrevConversationId(conversationId)
    setShowGroupInfo(false)
  }

  // Register active conversation with socket for events & catch-up
  useEffect(() => {
    setActiveConversationId(conversationId || null)
    return () => setActiveConversationId(null)
  }, [conversationId, setActiveConversationId])

  // Handle immediate removal from active conversation
  useEffect(() => {
    if (removedEvent?.conversationId === String(conversationId)) {
      onBack?.()
    }
  }, [removedEvent, conversationId, onBack])

  // Clear timers on unmount
  useEffect(() => {
    const timers = pendingTimersRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
    }
  }, [])

  // Fetch conversation details (no polling - updated via realtime events)
  const {
    data: conversation,
    isLoading: isLoadingConv,
    error: convError,
  } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => conversationApi.get(conversationId),
    enabled: Boolean(conversationId),
  })

  // Fetch newest messages (no polling - updated via realtime events)
  const { data: latestMessages = [] } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => messageApi.list(conversationId, { size: 30 }),
    enabled: Boolean(conversationId),
  })

  // Combined messages: olderMessages + latestMessages sorted ascending by id / createdAt
  const mergedMessages = useMemo(() => {
    const map = new Map()
    // Put older messages in map
    olderMessages.forEach((m) => {
      map.set(m.id || m.clientMessageId, m)
    })
    // Put latest messages in map
    latestMessages.forEach((m) => {
      map.set(m.id || m.clientMessageId, m)
    })

    // Sort ascending by ID / createdAt
    return Array.from(map.values()).sort((a, b) => {
      if (a.id && b.id) return a.id - b.id
      return new Date(a.createdAt) - new Date(b.createdAt)
    })
  }, [olderMessages, latestMessages])

  // Load older messages (cursor before)
  const loadOlderMessages = useCallback(async () => {
    if (!conversationId || isLoadingOlder || !hasOlder) return
    const oldest = mergedMessages[0]
    if (!oldest || !oldest.id) return

    setIsLoadingOlder(true)
    try {
      const older = await messageApi.list(conversationId, {
        before: oldest.id,
        size: 30,
      })
      if (older.length < 30) {
        setHasOlder(false)
      }
      setOlderMessages((prev) => [...older, ...prev])
    } catch {
      // Keep existing
    } finally {
      setIsLoadingOlder(false)
    }
  }, [conversationId, isLoadingOlder, hasOlder, mergedMessages])

  // Core send message logic supporting STOMP and REST fallback with 10s retry timeout
  const executeSend = useCallback(
    async (content, clientMessageId) => {
      if (!conversationId || !content.trim()) return

      // Cancel any existing timer for this clientMessageId
      if (pendingTimersRef.current.has(clientMessageId)) {
        clearTimeout(pendingTimersRef.current.get(clientMessageId))
        pendingTimersRef.current.delete(clientMessageId)
      }

      // Optimistic update
      queryClient.setQueryData(['messages', conversationId], (old = []) => {
        const existingIdx = old.findIndex(
          (m) => m.clientMessageId === clientMessageId
        )
        if (existingIdx >= 0) {
          return old.map((m, idx) =>
            idx === existingIdx ? { ...m, pending: true, failed: false } : m
          )
        }
        const optimisticMsg = {
          id: null,
          conversationId: Number(conversationId),
          content,
          clientMessageId,
          sender: { id: currentUserId },
          isMine: true,
          pending: true,
          failed: false,
          createdAt: new Date().toISOString(),
        }
        return [...old, optimisticMsg]
      })

      // Set 10-second client timeout to mark message as failed if no ack
      const timeoutId = setTimeout(() => {
        queryClient.setQueryData(['messages', conversationId], (old = []) =>
          old.map((m) =>
            m.clientMessageId === clientMessageId && m.pending
              ? { ...m, pending: false, failed: true }
              : m
          )
        )
        pendingTimersRef.current.delete(clientMessageId)
      }, 10000)

      pendingTimersRef.current.set(clientMessageId, timeoutId)

      // Try sending via WebSocket first if connected
      if (isConnected) {
        const published = sendMessage({
          conversationId: Number(conversationId),
          content,
          clientMessageId,
        })
        if (published) {
          return
        }
      }

      // Fall back to REST if disconnected or publish failed
      try {
        const saved = await messageApi.send(conversationId, {
          content,
          clientMessageId,
        })
        clearTimeout(timeoutId)
        pendingTimersRef.current.delete(clientMessageId)

        queryClient.setQueryData(['messages', conversationId], (old = []) =>
          old.map((m) =>
            m.clientMessageId === clientMessageId
              ? { ...saved, pending: false, failed: false }
              : m
          )
        )
        queryClient.invalidateQueries({ queryKey: ['conversations'] })
      } catch {
        clearTimeout(timeoutId)
        pendingTimersRef.current.delete(clientMessageId)

        queryClient.setQueryData(['messages', conversationId], (old = []) =>
          old.map((m) =>
            m.clientMessageId === clientMessageId
              ? { ...m, pending: false, failed: true }
              : m
          )
        )
      }
    },
    [conversationId, currentUserId, isConnected, queryClient, sendMessage]
  )

  const handleSendMessage = (content) => {
    const clientMessageId = crypto.randomUUID()
    executeSend(content, clientMessageId)
  }

  const handleRetryMessage = (message) => {
    executeSend(message.content, message.clientMessageId)
  }

  if (!conversationId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 bg-slate-950">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-4 shadow-xl">
          <MessageSquare className="w-8 h-8 text-indigo-500" />
        </div>
        <h2 className="text-lg font-bold text-slate-200 mb-1">
          Welcome to Vanni
        </h2>
        <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
          Select a chat from the sidebar or start a new conversation to start messaging.
        </p>
      </div>
    )
  }

  if (convError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-slate-950">
        <ShieldAlert className="w-10 h-10 text-rose-500 mb-3" />
        <h3 className="text-sm font-semibold text-slate-200 mb-1">
          Conversation not found
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          You might not have permission to view this conversation.
        </p>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
        >
          Return to chats
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex h-full bg-slate-950 overflow-hidden">
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <ChatHeader
          conversation={conversation}
          onBack={onBack}
          currentUserId={currentUserId}
          onToggleInfo={() => setShowGroupInfo((prev) => !prev)}
          typingText={typingText}
        />
        <MessageList
          messages={mergedMessages}
          currentUserId={currentUserId}
          isGroup={conversation?.type === 'GROUP'}
          onLoadOlder={loadOlderMessages}
          hasOlder={hasOlder}
          isLoadingOlder={isLoadingOlder}
          onRetryMessage={handleRetryMessage}
        />
        <MessageComposer
          onSendMessage={handleSendMessage}
          onKeyStroke={handleKeyStroke}
          onStopTyping={handleStopTyping}
          disabled={isLoadingConv || Boolean(convError)}
        />
      </div>

      {showGroupInfo && conversation?.type === 'GROUP' && (
        <GroupInfoPanel
          conversation={conversation}
          currentUserId={currentUserId}
          onClose={() => setShowGroupInfo(false)}
          onLeft={() => {
            setShowGroupInfo(false)
            onBack?.()
          }}
        />
      )}
    </div>
  )
}
