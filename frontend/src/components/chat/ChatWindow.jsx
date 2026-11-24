import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { conversationApi } from '../../api/conversationApi'
import { messageApi } from '../../api/messageApi'
import ChatHeader from './ChatHeader'
import MessageList from './MessageList'
import MessageComposer from './MessageComposer'
import { MessageSquare, ShieldAlert } from 'lucide-react'

export default function ChatWindow({ conversationId, onBack, currentUserId }) {
  const queryClient = useQueryClient()
  const [olderMessages, setOlderMessages] = useState([])
  const [hasOlder, setHasOlder] = useState(true)
  const [isLoadingOlder, setIsLoadingOlder] = useState(false)

  // Fetch conversation details with 5s polling
  const {
    data: conversation,
    isLoading: isLoadingConv,
    error: convError,
  } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => conversationApi.get(conversationId),
    enabled: Boolean(conversationId),
    refetchInterval: 5000,
  })

  // Fetch newest messages with 5s polling
  const { data: latestMessages = [] } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => messageApi.list(conversationId, { size: 30 }),
    enabled: Boolean(conversationId),
    refetchInterval: 5000,
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

  // Send message mutation with optimistic update
  const sendMutation = useMutation({
    mutationFn: async ({ content, clientMessageId }) => {
      return messageApi.send(conversationId, {
        content,
        clientMessageId,
      })
    },
    onMutate: async ({ content, clientMessageId }) => {
      await queryClient.cancelQueries({ queryKey: ['messages', conversationId] })

      const optimisticMsg = {
        id: null,
        conversationId: Number(conversationId),
        content,
        clientMessageId,
        sender: { id: currentUserId },
        isMine: true,
        pending: true,
        createdAt: new Date().toISOString(),
      }

      queryClient.setQueryData(['messages', conversationId], (old = []) => [
        optimisticMsg,
        ...old,
      ])

      return { optimisticMsg }
    },
    onSuccess: (savedMsg, { clientMessageId }) => {
      queryClient.setQueryData(['messages', conversationId], (old = []) =>
        old.map((m) => (m.clientMessageId === clientMessageId ? savedMsg : m))
      )
      // Also invalidate conversations to update snippet & order
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
    onError: (_err, { clientMessageId }) => {
      queryClient.setQueryData(['messages', conversationId], (old = []) =>
        old.map((m) =>
          m.clientMessageId === clientMessageId
            ? { ...m, pending: false, failed: true }
            : m
        )
      )
    },
  })

  const handleSendMessage = (content) => {
    const clientMessageId = crypto.randomUUID()
    sendMutation.mutate({ content, clientMessageId })
  }

  const handleRetryMessage = (message) => {
    sendMutation.mutate({
      content: message.content,
      clientMessageId: message.clientMessageId,
    })
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
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      <ChatHeader
        conversation={conversation}
        onBack={onBack}
        currentUserId={currentUserId}
      />
      <MessageList
        messages={mergedMessages}
        currentUserId={currentUserId}
        onLoadOlder={loadOlderMessages}
        hasOlder={hasOlder}
        isLoadingOlder={isLoadingOlder}
        onRetryMessage={handleRetryMessage}
      />
      <MessageComposer
        onSendMessage={handleSendMessage}
        disabled={isLoadingConv || Boolean(convError)}
      />
    </div>
  )
}
