import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { conversationApi } from '../../api/conversationApi'
import { inviteApi } from '../../api/inviteApi'
import { messageApi } from '../../api/messageApi'
import { useSocket } from '../../hooks/useSocket'
import { useTyping } from '../../hooks/useTyping'
import ChatHeader from './ChatHeader'
import MessageList from './MessageList'
import MessageComposer from './MessageComposer'
import GroupInfoPanel from './GroupInfoPanel'
import MessageReceiptModal from './MessageReceiptModal'
import UserAvatar from '../common/UserAvatar'
import { ShieldAlert, SquarePen, Users, X } from 'lucide-react'

export default function ChatWindow({
  conversationId,
  onBack,
  currentUserId,
  onOpenNewChat,
  onOpenNewGroup,
}) {
  const queryClient = useQueryClient()
  const { isConnected, sendMessage, setActiveConversationId, setIsChatAtBottom, removedEvent, sendRead } = useSocket()
  const { typingText, handleKeyStroke, handleStopTyping } = useTyping(conversationId)
  const [olderMessages, setOlderMessages] = useState([])
  const [hasOlder, setHasOlder] = useState(true)
  const [isLoadingOlder, setIsLoadingOlder] = useState(false)
  const [showGroupInfo, setShowGroupInfo] = useState(false)
  const [receiptModalMessage, setReceiptModalMessage] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [editingMessage, setEditingMessage] = useState(null)
  const [highlightedMessageId, setHighlightedMessageId] = useState(null)
  const [selectedMentionMember, setSelectedMentionMember] = useState(null)
  const [prevConversationId, setPrevConversationId] = useState(conversationId)
  const pendingTimersRef = useRef(new Map())

  // Reset local state if active conversation changes
  if (conversationId !== prevConversationId) {
    setPrevConversationId(conversationId)
    setOlderMessages([])
    setHasOlder(true)
    setShowGroupInfo(false)
    setReplyTo(null)
    setEditingMessage(null)
    setHighlightedMessageId(null)
    setSelectedMentionMember(null)
  }

  // Register active conversation with socket for events & catch-up
  useEffect(() => {
    setActiveConversationId(conversationId || null)
    setIsChatAtBottom?.(true)
    const isFocused = typeof document !== 'undefined' && (typeof document.hasFocus !== 'function' || document.hasFocus())
    if (conversationId && typeof document !== 'undefined' && document.visibilityState === 'visible' && isFocused) {
      sendRead?.(conversationId)
    }
    return () => setActiveConversationId(null)
  }, [conversationId, setActiveConversationId, setIsChatAtBottom, sendRead])

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

  const { data: pendingRequests = [] } = useQuery({
    queryKey: ['joinRequests', conversationId],
    queryFn: () => inviteApi.listRequests(conversationId, 'PENDING'),
    enabled: Boolean(conversationId && isGroupAdmin),
  })

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
    async ({
      content,
      clientMessageId,
      attachmentIds = [],
      attachments = [],
      replyToId = null,
      type = null,
    }) => {
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
            snippet: replyTo.snippet || replyTo.previewText || replyTo.content || '',
          }
        }

        const optimisticMsg = {
          id: null,
          conversationId: Number(conversationId),
          content: content ? content.trim() : null,
          messageType: type || (attachments.length > 0 ? 'FILE' : 'TEXT'),
          type: type || (attachments.length > 0 ? 'FILE' : 'TEXT'),
          clientMessageId,
          sender: { id: currentUserId },
          replyTo: replySnippet,
          attachments,
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
          ...(type ? { type } : {}),
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
          ...(type ? { type } : {}),
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
    let atts = []
    let r = replyToId
    let t = null
    if (typeof contentOrPayload === 'object' && contentOrPayload !== null) {
      c = contentOrPayload.content
      a = contentOrPayload.attachmentIds || []
      atts = contentOrPayload.attachments || []
      r = contentOrPayload.replyToId || null
      t = contentOrPayload.type || null
    }
    const clientMessageId = crypto.randomUUID()
    executeSend({
      content: c,
      clientMessageId,
      attachmentIds: a,
      attachments: atts,
      replyToId: r,
      type: t,
    })
    setReplyTo(null)
  }

  const handleRetryMessage = (message) => {
    const attachmentIds = message.attachments?.map((a) => a.id) || []
    executeSend({
      content: message.content,
      clientMessageId: message.clientMessageId,
      attachmentIds,
      attachments: message.attachments || [],
      replyToId: message.replyTo?.id || null,
      type: message.type || message.messageType || null,
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
            ? { ...m, deleted: true, content: null, attachments: [], previews: [] }
            : m
        )
      )
    } catch (err) {
      console.error('Failed to delete message', err)
    }
  }

  const handleRemovePreviews = async (message) => {
    try {
      await messageApi.removePreviews(message.id)
      queryClient.setQueryData(['messages', conversationId], (old = []) =>
        old.map((m) => (m.id === message.id ? { ...m, previews: [] } : m))
      )
    } catch (err) {
      console.error('Failed to remove previews', err)
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
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center rounded-[24px] md:rounded-[28px] glass overflow-hidden">
        {/* Layered floating glass speech-bubble illustration */}
        <div className="relative w-44 h-36 mb-6 flex items-center justify-center" aria-hidden="true">
          <div className="absolute -inset-2 rounded-full opacity-45 blur-xl accent-ring pointer-events-none" />
          <div className="relative w-28 h-16 -translate-x-5 -translate-y-4 rounded-[22px] rounded-bl-md glass-strong px-4 py-3 flex flex-col justify-center gap-2 animate-float-slow">
            <span className="h-2 w-16 rounded-full bg-[var(--text-primary)] opacity-25" />
            <span className="h-2 w-10 rounded-full bg-[var(--text-primary)] opacity-15" />
          </div>
          <div className="absolute right-2 bottom-3 w-28 h-16 rounded-[22px] rounded-br-md bubble-sent px-4 py-3 flex flex-col justify-center gap-2 animate-float-delayed">
            <span className="h-2 w-14 rounded-full bg-current opacity-85" />
            <span className="h-2 w-20 rounded-full bg-current opacity-65" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-ink heading-tight mb-2">
          Welcome to <span className="font-brand text-[28px] tracking-[-0.025em]">Vanni</span>
        </h2>
        <p className="text-sm text-ink-muted max-w-sm leading-relaxed mb-7">
          Select a chat from the sidebar or start a fresh conversation. Messages, groups, and media stay in sync in real time.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {onOpenNewChat && (
            <button
              type="button"
              onClick={onOpenNewChat}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full btn-accent text-xs font-semibold cursor-pointer focus-accent"
            >
              <SquarePen className="w-4 h-4" />
              <span>Start a chat</span>
            </button>
          )}
          {onOpenNewGroup && (
            <button
              type="button"
              onClick={onOpenNewGroup}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full btn-glass text-xs font-semibold cursor-pointer focus-accent"
            >
              <Users className="w-4 h-4 text-accent-text" />
              <span>Create a group</span>
            </button>
          )}
        </div>
      </div>
    )
  }

  if (convError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center rounded-[24px] md:rounded-[28px] glass">
        <div className="w-14 h-14 rounded-2xl glass-strong flex items-center justify-center text-[var(--danger-text)] mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-ink mb-1">
          Conversation not found
        </h3>
        <p className="text-xs text-ink-muted mb-5 max-w-xs">
          You might not have permission to view this conversation.
        </p>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-full btn-glass text-xs font-semibold cursor-pointer focus-accent"
        >
          Return to chats
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex h-full gap-3 min-w-0 overflow-hidden">
      {/* Main Chat Glass Card */}
      <div
        className={`flex-1 flex-col h-full min-w-0 rounded-[24px] md:rounded-[28px] glass overflow-hidden ${
          showGroupInfo && conversation?.type === 'GROUP' ? 'hidden md:flex' : 'flex'
        }`}
      >
        <ChatHeader
          key={`header-${conversationId}`}
          conversation={conversation}
          onBack={onBack}
          currentUserId={currentUserId}
          onToggleInfo={() => setShowGroupInfo((prev) => !prev)}
          onBlockChange={() => {
            queryClient.invalidateQueries({ queryKey: ['conversations'] })
            queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] })
          }}
          typingText={typingText}
          onSelectSearchMatch={(msgId) => setHighlightedMessageId(msgId)}
          pendingJoinCount={pendingRequests.length}
        />
        <MessageList
          key={`list-${conversationId}`}
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
          onRemovePreviews={handleRemovePreviews}
          onToggleReaction={handleToggleReaction}
          onSendQuickReply={(text) => handleSendMessage(text)}
          highlightedMessageId={highlightedMessageId}
          onMentionClick={(userId) => {
            const member = conversation?.members?.find((m) => m.id === userId)
            if (member) {
              setSelectedMentionMember(member)
            }
          }}
          onBottomStateChange={setIsChatAtBottom}
          onNearBottom={() => {
            const isFocused = typeof document !== 'undefined' && (typeof document.hasFocus !== 'function' || document.hasFocus())
            if (typeof document !== 'undefined' && document.visibilityState === 'visible' && isFocused) {
              sendRead?.(conversationId)
            }
          }}
        />
        <MessageComposer
          key={`composer-${conversationId}`}
          onSendMessage={handleSendMessage}
          onKeyStroke={handleKeyStroke}
          onStopTyping={handleStopTyping}
          disabled={isLoadingConv || Boolean(convError)}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          editingMessage={editingMessage}
          onCancelEdit={() => setEditingMessage(null)}
          onSaveEdit={handleSaveEdit}
          conversationId={conversationId}
          isGroup={conversation?.type === 'GROUP'}
          isGroupAdmin={isGroupAdmin}
          groupMembers={conversation?.members || []}
          currentUserId={currentUserId}
        />
      </div>

      {/* Optional Third Floating Glass Card for Group Info */}
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

      {selectedMentionMember && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center glass-modal-backdrop p-4"
            onClick={() => setSelectedMentionMember(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Member info"
              className="glass-strong rounded-3xl p-6 max-w-xs w-full text-ink animate-modal-in relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setSelectedMentionMember(null)}
                className="absolute right-4 top-4 p-1.5 text-ink-muted hover:text-ink rounded-xl hover:bg-[var(--glass-bg-hover)] transition-colors focus-accent cursor-pointer"
                aria-label="Close member info"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex flex-col items-center text-center gap-3">
                <UserAvatar
                  src={selectedMentionMember.avatarUrl}
                  name={selectedMentionMember.name}
                  seed={selectedMentionMember.id || selectedMentionMember.name}
                  size="lg"
                  isOnline={selectedMentionMember.online}
                />
                <div>
                  <h3 className="text-base font-bold text-ink">{selectedMentionMember.name}</h3>
                  {selectedMentionMember.role === 'ADMIN' && (
                    <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent-soft-bg)] text-accent-text border border-[var(--accent-soft-border)]">
                      Group Admin
                    </span>
                  )}
                </div>
                {selectedMentionMember.about && (
                  <p className="text-xs text-ink-muted leading-relaxed">{selectedMentionMember.about}</p>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
