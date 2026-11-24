/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { createSocket } from '../lib/socket'
import { messageApi } from '../api/messageApi'

const defaultSocketContextValue = {
  status: 'disconnected',
  isConnected: false,
  sendMessage: () => false,
  activeConversationId: null,
  setActiveConversationId: () => {},
}

const SocketContext = createContext(defaultSocketContextValue)

export function SocketProvider({ children }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('disconnected') // 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'offline'
  const [activeConversationId, setActiveConversationId] = useState(null)

  const clientRef = useRef(null)
  const activeConversationRef = useRef(activeConversationId)
  const hasEverConnectedRef = useRef(false)
  const currentUserIdRef = useRef(user?.id)

  useEffect(() => {
    activeConversationRef.current = activeConversationId
  }, [activeConversationId])

  useEffect(() => {
    currentUserIdRef.current = user?.id
  }, [user?.id])

  // Handle incoming STOMP envelopes from /user/queue/events
  const handleEvent = useCallback(
    (envelope) => {
      if (!envelope || !envelope.type) return
      const { type, data } = envelope

      switch (type) {
        case 'message.created': {
          const convId = String(data.conversationId)
          const currentUserId = currentUserIdRef.current

          // 1. Update message list in query cache for this conversation
          queryClient.setQueryData(['messages', convId], (old = []) => {
            if (!Array.isArray(old)) return [data]

            // Check if matching clientMessageId exists (optimistic message)
            let replaced = false
            const next = old.map((m) => {
              if (data.clientMessageId && m.clientMessageId === data.clientMessageId) {
                replaced = true
                return { ...data, pending: false, failed: false }
              }
              if (data.id && m.id === data.id) {
                replaced = true
                return { ...data, pending: false, failed: false }
              }
              return m
            })

            if (replaced) return next

            // Otherwise, append to existing messages
            return [...next, data]
          })

          // 2. Update conversation snippet and order in ['conversations']
          queryClient.setQueryData(['conversations'], (oldConvs = []) => {
            if (!Array.isArray(oldConvs)) return oldConvs

            const exists = oldConvs.some((c) => c.id === data.conversationId)
            if (!exists) {
              queryClient.invalidateQueries({ queryKey: ['conversations'] })
              return oldConvs
            }

            const isCurrentChatOpen = activeConversationRef.current === convId
            const isSender = data.sender?.id === currentUserId

            const updatedConvs = oldConvs.map((conv) => {
              if (conv.id === data.conversationId) {
                const unreadDelta = !isCurrentChatOpen && !isSender ? 1 : 0
                return {
                  ...conv,
                  lastMessage: {
                    id: data.id,
                    content: data.content,
                    senderName: data.sender?.name || '',
                    createdAt: data.createdAt,
                  },
                  lastMessageAt: data.createdAt,
                  unreadCount: (conv.unreadCount || 0) + unreadDelta,
                }
              }
              return conv
            })

            // Sort newest first
            return updatedConvs.sort((a, b) => {
              const timeA = new Date(a.lastMessageAt || a.updatedAt || a.createdAt).getTime()
              const timeB = new Date(b.lastMessageAt || b.updatedAt || b.createdAt).getTime()
              return timeB - timeA
            })
          })

          break
        }

        case 'conversation.created': {
          queryClient.setQueryData(['conversations'], (oldConvs = []) => {
            if (!Array.isArray(oldConvs)) return [data]
            if (oldConvs.some((c) => c.id === data.id)) return oldConvs
            return [data, ...oldConvs]
          })
          break
        }

        case 'conversation.updated': {
          queryClient.setQueryData(['conversations'], (oldConvs = []) => {
            if (!Array.isArray(oldConvs)) return oldConvs
            return oldConvs.map((c) => (c.id === data.id ? { ...c, ...data } : c))
          })
          queryClient.setQueryData(['conversation', String(data.id)], (old) =>
            old ? { ...old, ...data } : data
          )
          break
        }

        case 'conversation.removed': {
          queryClient.setQueryData(['conversations'], (oldConvs = []) => {
            if (!Array.isArray(oldConvs)) return oldConvs
            return oldConvs.filter((c) => c.id !== data.conversationId)
          })
          break
        }

        case 'error': {
          if (data?.clientMessageId) {
            const activeId = activeConversationRef.current
            if (activeId) {
              queryClient.setQueryData(['messages', activeId], (old = []) => {
                if (!Array.isArray(old)) return old
                return old.map((m) =>
                  m.clientMessageId === data.clientMessageId
                    ? { ...m, pending: false, failed: true, error: data.message }
                    : m
                )
              })
            }
          }
          break
        }

        default:
          break
      }
    },
    [queryClient]
  )

  // Handle reconnect catch-up for open conversation
  const handleReconnectCatchUp = useCallback(async () => {
    // 1. Invalidate conversations list so snippets/unreads are refreshed
    queryClient.invalidateQueries({ queryKey: ['conversations'] })

    // 2. Fetch missed messages for active open conversation
    const currentConvId = activeConversationRef.current
    if (!currentConvId) return

    try {
      const cachedMessages =
        queryClient.getQueryData(['messages', currentConvId]) || []
      const maxId = cachedMessages.reduce(
        (max, m) => (m.id && typeof m.id === 'number' && m.id > max ? m.id : max),
        0
      )

      if (maxId > 0) {
        const missed = await messageApi.list(currentConvId, {
          after: maxId,
          size: 50,
        })
        if (missed && missed.length > 0) {
          queryClient.setQueryData(['messages', currentConvId], (old = []) => {
            const existingIds = new Set(old.map((m) => m.id).filter(Boolean))
            const newToAdd = missed.filter((m) => !existingIds.has(m.id))
            return [...old, ...newToAdd]
          })
        }
      }
    } catch (err) {
      console.warn('Failed to catch up messages after reconnect:', err)
    }
  }, [queryClient])

  // Lifecycle: Connect when authenticated, disconnect when logged out
  useEffect(() => {
    if (!user) {
      if (clientRef.current) {
        clientRef.current.deactivate()
        clientRef.current = null
      }
      hasEverConnectedRef.current = false
      queueMicrotask(() => setStatus('disconnected'))
      return
    }

    // Set initial status based on browser connectivity
    queueMicrotask(() => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setStatus('offline')
      } else {
        setStatus('connecting')
      }
    })

    const client = createSocket({
      onConnect: () => {
        setStatus('connected')
        if (hasEverConnectedRef.current) {
          // Reconnection occurred!
          handleReconnectCatchUp()
        }
        hasEverConnectedRef.current = true
      },
      onStatus: (nextStatus) => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setStatus('offline')
        } else {
          setStatus(nextStatus)
        }
      },
      onEvent: handleEvent,
      onError: (err) => {
        console.warn('STOMP client error callback:', err)
      },
    })

    client.activate()
    clientRef.current = client

    // Window online/offline event listeners
    const handleOnline = () => {
      setStatus('reconnecting')
      if (clientRef.current && !clientRef.current.active) {
        clientRef.current.activate()
      }
    }

    const handleOffline = () => {
      setStatus('offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      client.deactivate()
      clientRef.current = null
    }
  }, [user, handleEvent, handleReconnectCatchUp])

  // Publish /app/chat.send message over STOMP
  const sendMessage = useCallback(({ conversationId, content, clientMessageId, replyToId }) => {
    const client = clientRef.current
    if (!client || !client.connected) {
      return false
    }

    try {
      client.publish({
        destination: '/app/chat.send',
        body: JSON.stringify({
          conversationId: Number(conversationId),
          content,
          clientMessageId,
          replyToId,
        }),
      })
      return true
    } catch (ex) {
      console.warn('Failed to publish /app/chat.send frame:', ex)
      return false
    }
  }, [])

  const value = {
    status,
    isConnected: status === 'connected',
    sendMessage,
    activeConversationId,
    setActiveConversationId,
  }

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}

export function useSocketContext() {
  const context = useContext(SocketContext)
  return context || defaultSocketContextValue
}
