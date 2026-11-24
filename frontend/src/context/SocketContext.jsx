/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { createSocket } from '../lib/socket'
import { messageApi } from '../api/messageApi'
import { presenceApi } from '../api/presenceApi'
import { receiptApi } from '../api/receiptApi'
import ToastNotification from '../components/common/ToastNotification'

const defaultSocketContextValue = {
  status: 'disconnected',
  isConnected: false,
  sendMessage: () => false,
  sendTyping: () => false,
  sendDelivered: () => false,
  sendRead: () => false,
  fetchPresence: () => {},
  presenceMap: {},
  typingMap: {},
  removedEvent: null,
  activeConversationId: null,
  setActiveConversationId: () => {},
  toast: null,
  dismissToast: () => {},
}

const SocketContext = createContext(defaultSocketContextValue)

export function SocketProvider({ children }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('disconnected') // 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'offline'
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [presenceMap, setPresenceMap] = useState({})
  const [typingMap, setTypingMap] = useState({})
  const [removedEvent, setRemovedEvent] = useState(null)
  const [toast, setToast] = useState(null)

  const clientRef = useRef(null)
  const activeConversationRef = useRef(activeConversationId)
  const hasEverConnectedRef = useRef(false)
  const currentUserIdRef = useRef(user?.id)
  const toastTimerRef = useRef(null)

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(null)
  }, [])

  const triggerToast = useCallback((payload) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(payload)
    toastTimerRef.current = setTimeout(() => {
      setToast(null)
    }, 4000)
  }, [])

  useEffect(() => {
    activeConversationRef.current = activeConversationId
  }, [activeConversationId])

  useEffect(() => {
    currentUserIdRef.current = user?.id
  }, [user?.id])

  // Publish /app/chat.delivered frame over STOMP
  const sendDelivered = useCallback((conversationId, messageIds, upToMessageId) => {
    const client = clientRef.current
    if (!client || !client.connected || !conversationId) return false
    try {
      client.publish({
        destination: '/app/chat.delivered',
        body: JSON.stringify({
          conversationId: Number(conversationId),
          messageIds: messageIds || null,
          upToMessageId: upToMessageId ? Number(upToMessageId) : null,
        }),
      })
      return true
    } catch {
      return false
    }
  }, [])

  // Publish /app/chat.read frame over STOMP (with REST fallback)
  const sendRead = useCallback((conversationId, upToMessageId) => {
    const client = clientRef.current
    if (!client || !client.connected || !conversationId) {
      if (conversationId) {
        receiptApi.markRead(conversationId, upToMessageId).catch(() => {})
      }
      return false
    }
    try {
      client.publish({
        destination: '/app/chat.read',
        body: JSON.stringify({
          conversationId: Number(conversationId),
          upToMessageId: upToMessageId ? Number(upToMessageId) : null,
        }),
      })
      return true
    } catch {
      if (conversationId) {
        receiptApi.markRead(conversationId, upToMessageId).catch(() => {})
      }
      return false
    }
  }, [])

  // Handle incoming STOMP envelopes from /user/queue/events
  const handleEvent = useCallback(
    (envelope) => {
      if (!envelope || !envelope.type) return
      const { type, data } = envelope

      switch (type) {
        case 'message.created': {
          const convId = String(data.conversationId)
          const currentUserId = currentUserIdRef.current
          const isSender = data.sender?.id === currentUserId
          const isCurrentChatOpen = activeConversationRef.current === convId
          const isTabVisible = typeof document !== 'undefined' && document.visibilityState === 'visible'

          // Ack delivery for incoming messages
          if (!isSender && data.id) {
            sendDelivered(data.conversationId, [data.id])
            if (isCurrentChatOpen && isTabVisible) {
              sendRead(data.conversationId, data.id)
            } else if (!isCurrentChatOpen) {
              triggerToast({
                id: data.id,
                conversationId: convId,
                senderName: data.sender?.name || 'Someone',
                content: data.content,
              })
            }
          }

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
          const convIdStr = String(data.conversationId)
          setRemovedEvent({ conversationId: convIdStr, ts: Date.now() })
          queryClient.setQueryData(['conversations'], (oldConvs = []) => {
            if (!Array.isArray(oldConvs)) return oldConvs
            return oldConvs.filter((c) => String(c.id) !== convIdStr)
          })
          break
        }

        case 'presence.changed': {
          if (data?.userId) {
            setPresenceMap((prev) => ({
              ...prev,
              [data.userId]: {
                online: Boolean(data.online),
                lastSeenAt: data.lastSeenAt,
              },
            }))
          }
          break
        }

        case 'receipt.updated': {
          const convId = String(data.conversationId)
          const statusOrder = { SENT: 1, DELIVERED: 2, READ: 3 }

          queryClient.setQueryData(['messages', convId], (old = []) => {
            if (!Array.isArray(old)) return old
            return old.map((m) => {
              const matches =
                (data.messageId && m.id === data.messageId) ||
                (data.upToMessageId && m.id && m.id <= data.upToMessageId)
              if (matches) {
                const cur = statusOrder[m.status] || 0
                const next = statusOrder[data.status] || 0
                if (next > cur) {
                  return { ...m, status: data.status }
                }
              }
              return m
            })
          })

          queryClient.setQueryData(['conversations'], (oldConvs = []) => {
            if (!Array.isArray(oldConvs)) return oldConvs
            return oldConvs.map((conv) => {
              if (String(conv.id) === convId && conv.lastMessage) {
                if (!data.messageId || conv.lastMessage.id === data.messageId) {
                  const cur = statusOrder[conv.lastMessage.status] || 0
                  const next = statusOrder[data.status] || 0
                  if (next > cur) {
                    return {
                      ...conv,
                      lastMessage: {
                        ...conv.lastMessage,
                        status: data.status,
                      },
                    }
                  }
                }
              }
              return conv
            })
          })
          break
        }

        case 'unread.updated': {
          const convId = String(data.conversationId)
          queryClient.setQueryData(['conversations'], (oldConvs = []) => {
            if (!Array.isArray(oldConvs)) return oldConvs
            return oldConvs.map((c) =>
              String(c.id) === convId ? { ...c, unreadCount: data.unreadCount } : c
            )
          })
          break
        }

        case 'typing': {
          if (data?.conversationId && data?.userId) {
            const convId = String(data.conversationId)
            const userId = data.userId
            const userName = data.name

            setTypingMap((prev) => {
              const currentConv = { ...(prev[convId] || {}) }
              if (currentConv[userId]?.timerId) {
                clearTimeout(currentConv[userId].timerId)
              }

              if (data.typing) {
                const timerId = setTimeout(() => {
                  setTypingMap((state) => {
                    const c = { ...(state[convId] || {}) }
                    delete c[userId]
                    return { ...state, [convId]: c }
                  })
                }, 4000)

                currentConv[userId] = {
                  name: userName,
                  timerId,
                }
              } else {
                delete currentConv[userId]
              }

              return { ...prev, [convId]: currentConv }
            })
          }
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
    [queryClient, sendDelivered, sendRead, triggerToast]
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

  // Publish /app/chat.typing frame over STOMP
  const sendTyping = useCallback((conversationId, typing) => {
    const client = clientRef.current
    if (!client || !client.connected || !conversationId) {
      return false
    }

    try {
      client.publish({
        destination: '/app/chat.typing',
        body: JSON.stringify({
          conversationId: Number(conversationId),
          typing: Boolean(typing),
        }),
      })
      return true
    } catch {
      return false
    }
  }, [])

  // Fetch presence snapshot for a set of user IDs
  const fetchPresence = useCallback(async (userIds) => {
    if (!userIds || userIds.length === 0) return
    try {
      const list = await presenceApi.get(userIds)
      if (Array.isArray(list)) {
        setPresenceMap((prev) => {
          const next = { ...prev }
          for (const item of list) {
            next[item.userId] = {
              online: item.online,
              lastSeenAt: item.lastSeenAt,
            }
          }
          return next
        })
      }
    } catch (e) {
      console.warn('Failed to fetch initial presence snapshot:', e)
    }
  }, [])

  // Dynamic browser tab title (n) Vanni and focus auto-read
  useEffect(() => {
    const updateTitle = () => {
      const convs = queryClient.getQueryData(['conversations']) || []
      const totalUnread = Array.isArray(convs)
        ? convs.reduce((sum, c) => sum + (c.unreadCount || 0), 0)
        : 0

      if (typeof document !== 'undefined') {
        if (totalUnread > 0) {
          document.title = `(${totalUnread}) Vanni`
        } else {
          document.title = 'Vanni'
        }
      }
    }

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.query?.queryKey?.[0] === 'conversations') {
        updateTitle()
      }
    })

    const handleFocusOrVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && activeConversationRef.current) {
        sendRead(activeConversationRef.current)
      }
      updateTitle()
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocusOrVisible)
      document.addEventListener('visibilitychange', handleFocusOrVisible)
    }

    return () => {
      unsubscribe()
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocusOrVisible)
        document.removeEventListener('visibilitychange', handleFocusOrVisible)
      }
    }
  }, [queryClient, sendRead])

  const handleSelectToast = useCallback((convId) => {
    setActiveConversationId(convId)
    dismissToast()
  }, [dismissToast])

  const value = {
    status,
    isConnected: status === 'connected',
    sendMessage,
    sendTyping,
    sendDelivered,
    sendRead,
    fetchPresence,
    presenceMap,
    typingMap,
    removedEvent,
    activeConversationId,
    setActiveConversationId,
    toast,
    dismissToast,
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
      <ToastNotification toast={toast} onSelect={handleSelectToast} onDismiss={dismissToast} />
    </SocketContext.Provider>
  )
}

export function useSocketContext() {
  const context = useContext(SocketContext)
  return context || defaultSocketContextValue
}
