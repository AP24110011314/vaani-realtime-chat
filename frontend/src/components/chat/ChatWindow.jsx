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
import MessageReceiptModal from './MessageReceiptModal'
import { MessageSquare, ShieldAlert } from 'lucide-react'

export default function ChatWindow({ conversationId, onBack, currentUserId }) {
  const queryClient = useQueryClient()
  const { isConnected, sendMessage, setActiveConversationId, removedEvent, sendRead } = useSocket()
  const { typingText, handleKeyStroke, handleStopTyping } = useTyping(conversationId)
  const [olderMessages, setOlderMessages] = useState([])
  const [hasOlder, setHasOlder] = useState(true)
  const [isLoadingOlder, setIsLoadingOlder] = useState(false)
  const [showGroupInfo, setShowGroupInfo] = useState(false)
  const [receiptModalMessage, setReceiptModalMessage] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [editingMessage, setEditingMessage] = useState(null)
  const [highlightedMessageId, setHighlightedMessageId] = useState(null)
  const [prevConversationId, setPrevConversationId] = useState(conversationId)
  const pendingTimersRef = useRef(new Map())

  // Reset local state if active conversation changes
  if (conversationId !== prevConversationId) {
    setPrevConversationId(conversationId)
    setShowGroupInfo(false)
    setReplyTo(null)
    setEditingMessage(null)
    setHighlightedMessageId(null)
  }

  // Register active conversation with socket for events & catch-up
  useEffect(() => {
    setActiveConversationId(conversationId || null)
    if (conversationId && typeof document !== 'undefined' && document.visibilityState === 'visible') {
      sendRead?.(conversationId)
    }
    return () => setActiveConversationId(null)
  }, [conversationId, setActiveConversationId, sendRead])

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
    olderMessages.forEach((m) => {
      map.set(m.id || m.clientMessageId, m)
    })
    latestMessages.forEach((m) => {
      map.set(m.id || m.clientMessageId, m)
    })

    return Array.from(map.values()).sort((a, b) => {
      if (a.id && b.id) return a.id - b.id
      return new Date(a.createdAt) - new Date(b.createdAt)
    })
  }, [olderMessages, latestMessages])

  // Is current user admin in this group
  const isGroupAdmin = useMemo(() => {
    if (!conversation || conversation.type !== 'GROUP') return false
    const myMember = conversation.members?.find((m) => m.id === currentUserId)
    return myMember?.role === 'ADMIN'
  }, [conversation, currentUserId])

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
      if (!older || older.length === 0) {
        setHasOlder(false)
      } else {
        setOlderMessages((prev) => [...older, ...prev])
      }
    } catch {
      // Error loading older
    } finally {
      setIsLoadingOlder(false)
    }
  }, [conversationId, isLoadingOlder, hasOlder, mergedMessages])

  const executeSend = useCallback(
    async ({ content, clientMessageId, attachmentIds = [], replyToId = null }) => {
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
        let replySnippet = null
        if (replyTo) {
          replySnippet = {
            id: replyTo.id,
            senderName: replyTo.sender?.name || replyTo.senderName || '',
            snippet: replyTo.snippet || replyTo.content || '',
          }
        }

        const optimisticMsg = {
          id: null,
          conversationId: Number(conversationId),
          content: content ? content.trim() : null,
          clientMessageId,
          sender: { id: currentUserId },
          replyTo: replySnippet,
          attachments: [],
          reactions: [],
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
          content: content ? content.trim() : '',
          clientMessageId,
          replyToId,
          attachmentIds,
        })
        if (published) {
          return
        }
      }

      // Fall back to REST if disconnected or publish failed
      try {
        const saved = await messageApi.send(conversationId, {
          content: content ? content.trim() : '',
          clientMessageId,
          replyToId,
          attachmentIds,
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
    [conversationId, currentUserId, isConnected, queryClient, sendMessage, replyTo]
  )

  const handleSendMessage = (contentOrPayload, attachmentIds = [], replyToId = null) => {
    let c = contentOrPayload
    let a = attachmentIds
    let r = replyToId
    if (typeof contentOrPayload === 'object' && contentOrPayload !== null) {
      c = contentOrPayload.content
      a = contentOrPayload.attachmentIds || []
      r = contentOrPayload.replyToId || null
    }
    const clientMessageId = crypto.randomUUID()
    executeSend({ content: c, clientMessageId, attachmentIds: a, replyToId: r })
    setReplyTo(null)
  }

  const handleRetryMessage = (message) => {
    const attachmentIds = message.attachments?.map((a) => a.id) || []
    executeSend({
      content: message.content,
      clientMessageId: message.clientMessageId,
      attachmentIds,
      replyToId: message.replyTo?.id || null,
    })
  }

  const handleSaveEdit = async (messageId, newContent) => {
    try {
      const updatedDto = await messageApi.edit(messageId, newContent)
      queryClient.setQueryData(['messages', conversationId], (old = []) =>
        old.map((m) => (m.id === messageId ? updatedDto : m))
      )
      setEditingMessage(null)
    } catch (err) {
      console.error('Failed to edit message', err)
    }
  }

  const handleDeleteMessage = async (message) => {
    try {
      await messageApi.delete(message.id)
      queryClient.setQueryData(['messages', conversationId], (old = []) =>
        old.map((m) =>
          m.id === message.id
            ? { ...m, deleted: true, content: null, attachments: [] }
            : m
        )
      )
    } catch (err) {
      console.error('Failed to delete message', err)
    }
  }

  const handleToggleReaction = async (message, emoji) => {
    try {
      const updatedDto = await messageApi.react(message.id, emoji)
      queryClient.setQueryData(['messages', conversationId], (old = []) =>
        old.map((m) => (m.id === message.id ? updatedDto : m))
      )
    } catch (err) {
      console.error('Failed to toggle reaction', err)
    }
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
          onSelectSearchMatch={(msgId) => setHighlightedMessageId(msgId)}
        />
        <MessageList
          messages={mergedMessages}
          currentUserId={currentUserId}
          isGroup={conversation?.type === 'GROUP'}
          isGroupAdmin={isGroupAdmin}
          unreadCount={conversation?.unreadCount || 0}
          onLoadOlder={loadOlderMessages}
          hasOlder={hasOlder}
          isLoadingOlder={isLoadingOlder}
          onRetryMessage={handleRetryMessage}
          onShowReceipts={setReceiptModalMessage}
          onReply={(msg) => setReplyTo(msg)}
          onEdit={(msg) => setEditingMessage(msg)}
          onDelete={handleDeleteMessage}
          onToggleReaction={handleToggleReaction}
          highlightedMessageId={highlightedMessageId}
          onNearBottom={() => {
            if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
              sendRead?.(conversationId)
            }
          }}
        />
        <MessageComposer
          onSendMessage={handleSendMessage}
          onKeyStroke={handleKeyStroke}
          onStopTyping={handleStopTyping}
          disabled={isLoadingConv || Boolean(convError)}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          editingMessage={editingMessage}
          onCancelEdit={() => setEditingMessage(null)}
          onSaveEdit={handleSaveEdit}
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

      {receiptModalMessage && (
        <MessageReceiptModal
          isOpen={Boolean(receiptModalMessage)}
          onClose={() => setReceiptModalMessage(null)}
          message={receiptModalMessage}
        />
      )}
    </div>
  )
}
