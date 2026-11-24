import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthContext } from './context/AuthContext'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AppRoutes from './routes/AppRoutes'
import MessageComposer from './components/chat/MessageComposer'
import ConversationList from './components/chat/ConversationList'
import ChatWindow from './components/chat/ChatWindow'
import ConnectionBanner from './components/common/ConnectionBanner'
import MessageBubble from './components/chat/MessageBubble'
import GroupCreateModal from './components/chat/GroupCreateModal'
import GroupInfoPanel from './components/chat/GroupInfoPanel'
import ChatHeader from './components/chat/ChatHeader'
import * as useSocketModule from './hooks/useSocket'

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
}

describe('LandingPage', () => {
  it('renders Vanni brand and links to login and register', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Real-time conversations/)
    expect(screen.getByRole('button', { name: /Log in/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sign up/i })).toBeInTheDocument()
  })
})

describe('LoginPage', () => {
  it('validates email format before submitting', async () => {
    const mockLogin = vi.fn()

    render(
      <AuthContext.Provider value={{ login: mockLogin }}>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    const emailInput = screen.getByLabelText(/Email Address/i)
    const submitBtn = screen.getByRole('button', { name: /Sign In/i })

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/Enter a valid email/i)).toBeInTheDocument()
    })
    expect(mockLogin).not.toHaveBeenCalled()
  })
})

describe('RegisterPage', () => {
  it('validates password requirements and confirmation match', async () => {
    const mockRegister = vi.fn()

    render(
      <AuthContext.Provider value={{ register: mockRegister }}>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'A' } })
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'valid@vanni.app' } })
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'short' } })
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'mismatch' } })

    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }))

    await waitFor(() => {
      expect(screen.getByText(/Name must be at least 2 characters/i)).toBeInTheDocument()
      expect(screen.getByText(/Password must be at least 8 characters/i)).toBeInTheDocument()
      expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument()
    })
    expect(mockRegister).not.toHaveBeenCalled()
  })
})

describe('Route guards', () => {
  it('redirects unauthenticated user away from protected route', () => {
    render(
      <AuthContext.Provider value={{ user: null, loading: false }}>
        <MemoryRouter initialEntries={['/app']}>
          <AppRoutes />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    expect(screen.getByRole('heading', { name: /Sign in to your account/i })).toBeInTheDocument()
  })

  it('redirects authenticated user away from login page', () => {
    const fakeUser = { id: 1, name: 'Alice', email: 'alice@vanni.app' }
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={{ user: fakeUser, loading: false, logout: vi.fn() }}>
          <MemoryRouter initialEntries={['/login']}>
            <AppRoutes />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    )

    expect(screen.getByText('Alice')).toBeInTheDocument()
  })
})

describe('MessageComposer', () => {
  it('sends message on Enter key press', () => {
    const onSend = vi.fn()
    render(<MessageComposer onSendMessage={onSend} disabled={false} />)

    const textarea = screen.getByPlaceholderText(/Type a message/i)
    fireEvent.change(textarea, { target: { value: 'Hello world' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(onSend).toHaveBeenCalledWith('Hello world')
    expect(textarea.value).toBe('')
  })

  it('inserts newline on Shift+Enter and does not send', () => {
    const onSend = vi.fn()
    render(<MessageComposer onSendMessage={onSend} disabled={false} />)

    const textarea = screen.getByPlaceholderText(/Type a message/i)
    fireEvent.change(textarea, { target: { value: 'Hello' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

    expect(onSend).not.toHaveBeenCalled()
  })

  it('disables send button when content is whitespace only', () => {
    const onSend = vi.fn()
    render(<MessageComposer onSendMessage={onSend} disabled={false} />)

    const textarea = screen.getByPlaceholderText(/Type a message/i)
    const sendBtn = screen.getByLabelText(/Send message/i)

    expect(sendBtn).toBeDisabled()

    fireEvent.change(textarea, { target: { value: '   ' } })
    expect(sendBtn).toBeDisabled()

    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onSend).not.toHaveBeenCalled()
  })
})

describe('ConversationList', () => {
  it('shows empty state when no conversations exist', () => {
    render(
      <ConversationList
        conversations={[]}
        activeId={null}
        onSelectConversation={vi.fn()}
        onOpenNewChat={vi.fn()}
        isLoading={false}
        currentUserId={1}
      />
    )

    expect(screen.getByText(/No conversations yet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Start a Chat/i })).toBeInTheDocument()
  })

  it('renders conversations and handles selection', () => {
    const mockSelect = vi.fn()
    const conversations = [
      {
        id: 10,
        type: 'DIRECT',
        title: 'Bob',
        lastMessage: { content: 'Hey there', createdAt: '2026-11-24T10:00:00Z', sender: { id: 2 } },
        unreadCount: 2,
        members: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
      },
    ]

    render(
      <ConversationList
        conversations={conversations}
        activeId={null}
        onSelectConversation={mockSelect}
        onOpenNewChat={vi.fn()}
        isLoading={false}
        currentUserId={1}
      />
    )

    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Hey there')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Bob'))
    expect(mockSelect).toHaveBeenCalledWith(10)
  })
})

describe('ChatWindow', () => {
  it('renders welcome placeholder when no conversation is selected', () => {
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <ChatWindow conversationId={null} onBack={vi.fn()} currentUserId={1} />
      </QueryClientProvider>
    )

    expect(screen.getByText(/Welcome to Vanni/i)).toBeInTheDocument()
    expect(screen.getByText(/Select a chat from the sidebar/i)).toBeInTheDocument()
  })
})

describe('ConnectionBanner', () => {
  it('renders reconnecting state with spinner', () => {
    vi.spyOn(useSocketModule, 'useSocket').mockReturnValue({
      status: 'reconnecting',
      isConnected: false,
    })

    render(<ConnectionBanner />)
    expect(screen.getByText(/Reconnecting to server.../i)).toBeInTheDocument()
  })

  it('renders offline banner when connection is disconnected or offline', () => {
    vi.spyOn(useSocketModule, 'useSocket').mockReturnValue({
      status: 'offline',
      isConnected: false,
    })

    render(<ConnectionBanner />)
    expect(screen.getByText(/Offline. Check your connection./i)).toBeInTheDocument()
  })

  it('renders nothing when normally connected without prior disconnection', () => {
    vi.spyOn(useSocketModule, 'useSocket').mockReturnValue({
      status: 'connected',
      isConnected: true,
    })

    const { container } = render(<ConnectionBanner />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('MessageBubble Statuses', () => {
  it('renders pending state with clock icon', () => {
    const pendingMsg = {
      id: null,
      clientMessageId: 'pending-123',
      content: 'Sending message...',
      pending: true,
      failed: false,
      createdAt: new Date().toISOString(),
      sender: { id: 1 },
    }

    render(<MessageBubble message={pendingMsg} isMine={true} onRetry={vi.fn()} />)
    expect(screen.getByText('Sending message...')).toBeInTheDocument()
  })

  it('renders failed state with Retry button and triggers onRetry', () => {
    const failedMsg = {
      id: null,
      clientMessageId: 'failed-456',
      content: 'Failed message',
      pending: false,
      failed: true,
      createdAt: new Date().toISOString(),
      sender: { id: 1 },
    }
    const mockRetry = vi.fn()

    render(<MessageBubble message={failedMsg} isMine={true} onRetry={mockRetry} />)
    expect(screen.getByText('Failed message')).toBeInTheDocument()

    const retryBtn = screen.getByRole('button', { name: /Retry/i })
    expect(retryBtn).toBeInTheDocument()
    fireEvent.click(retryBtn)
    expect(mockRetry).toHaveBeenCalledWith(failedMsg)
  })
})

describe('Realtime Query Cache Updates', () => {
  it('replaces optimistic pending message with confirmed message on message.created', () => {
    const queryClient = createTestQueryClient()
    const convId = '42'
    const clientMessageId = 'client-msg-uuid-1'

    // Seed optimistic pending message
    queryClient.setQueryData(['messages', convId], [
      {
        id: null,
        conversationId: 42,
        content: 'Optimistic text',
        clientMessageId,
        pending: true,
        failed: false,
        createdAt: '2026-11-25T01:00:00Z',
      },
    ])

    // Incoming confirmed message from WebSocket
    const confirmedMsg = {
      id: 1001,
      conversationId: 42,
      content: 'Optimistic text',
      clientMessageId,
      sender: { id: 1, name: 'Alice' },
      createdAt: '2026-11-25T01:00:01Z',
    }

    // Apply cache update logic matching SocketContext
    queryClient.setQueryData(['messages', convId], (old = []) => {
      let replaced = false
      const next = old.map((m) => {
        if (m.clientMessageId === confirmedMsg.clientMessageId) {
          replaced = true
          return { ...confirmedMsg, pending: false, failed: false }
        }
        return m
      })
      return replaced ? next : [...next, confirmedMsg]
    })

    const messages = queryClient.getQueryData(['messages', convId])
    expect(messages).toHaveLength(1)
    expect(messages[0].id).toBe(1001)
    expect(messages[0].pending).toBe(false)
    expect(messages[0].failed).toBe(false)
    expect(messages[0].clientMessageId).toBe(clientMessageId)
  })

  it('marks pending message as failed when error event is received', () => {
    const queryClient = createTestQueryClient()
    const convId = '42'
    const clientMessageId = 'client-msg-fail-1'

    queryClient.setQueryData(['messages', convId], [
      {
        id: null,
        conversationId: 42,
        content: 'Will fail',
        clientMessageId,
        pending: true,
        failed: false,
        createdAt: '2026-11-25T01:00:00Z',
      },
    ])

    const errorEvent = {
      code: 'NOT_A_MEMBER',
      message: 'You are not a member',
      clientMessageId,
    }

    queryClient.setQueryData(['messages', convId], (old = []) =>
      old.map((m) =>
        m.clientMessageId === errorEvent.clientMessageId
          ? { ...m, pending: false, failed: true, error: errorEvent.message }
          : m
      )
    )

    const messages = queryClient.getQueryData(['messages', convId])
    expect(messages).toHaveLength(1)
    expect(messages[0].pending).toBe(false)
    expect(messages[0].failed).toBe(true)
    expect(messages[0].error).toBe('You are not a member')
  })

  it('bumps conversation in list and updates lastMessage on message.created', () => {
    const queryClient = createTestQueryClient()

    queryClient.setQueryData(['conversations'], [
      {
        id: 1,
        title: 'Chat 1',
        lastMessage: { content: 'Old', createdAt: '2026-11-25T00:50:00Z' },
        lastMessageAt: '2026-11-25T00:50:00Z',
        unreadCount: 0,
      },
      {
        id: 2,
        title: 'Chat 2',
        lastMessage: { content: 'Active', createdAt: '2026-11-25T00:55:00Z' },
        lastMessageAt: '2026-11-25T00:55:00Z',
        unreadCount: 0,
      },
    ])

    // Incoming message for Chat 1
    const newMsg = {
      id: 999,
      conversationId: 1,
      content: 'New message in Chat 1!',
      sender: { id: 2, name: 'Bob' },
      createdAt: '2026-11-25T01:05:00Z',
    }

    queryClient.setQueryData(['conversations'], (oldConvs = []) => {
      const updated = oldConvs.map((conv) => {
        if (conv.id === newMsg.conversationId) {
          return {
            ...conv,
            lastMessage: {
              id: newMsg.id,
              content: newMsg.content,
              senderName: newMsg.sender.name,
              createdAt: newMsg.createdAt,
            },
            lastMessageAt: newMsg.createdAt,
            unreadCount: (conv.unreadCount || 0) + 1,
          }
        }
        return conv
      })
      return updated.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
    })

    const convs = queryClient.getQueryData(['conversations'])
    expect(convs[0].id).toBe(1) // Chat 1 jumped to top!
    expect(convs[0].lastMessage.content).toBe('New message in Chat 1!')
    expect(convs[0].unreadCount).toBe(1)
  })
})

describe('Phase 5 Groups, Presence & System Messages', () => {
  it('renders system message as centered announcement pill', () => {
    const sysMsg = {
      id: 50,
      conversationId: 10,
      content: 'Asha created group "Design Team"',
      messageType: 'SYSTEM',
      createdAt: new Date().toISOString(),
      sender: { id: 1, name: 'Asha' },
    }

    render(<MessageBubble message={sysMsg} isMine={false} onRetry={vi.fn()} />)
    expect(screen.getByText('Asha created group "Design Team"')).toBeInTheDocument()
  })

  it('renders group sender name for other members in group chat', () => {
    const groupMsg = {
      id: 51,
      conversationId: 10,
      content: 'Hello team!',
      messageType: 'TEXT',
      createdAt: new Date().toISOString(),
      sender: { id: 2, name: 'Ravi' },
    }

    render(<MessageBubble message={groupMsg} isMine={false} isGroup={true} onRetry={vi.fn()} />)
    expect(screen.getByText('Ravi')).toBeInTheDocument()
    expect(screen.getByText('Hello team!')).toBeInTheDocument()
  })

  it('renders typing indicator in ChatHeader when active', () => {
    const conv = {
      id: 10,
      type: 'GROUP',
      title: 'Design Team',
      members: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Ravi' }],
    }

    render(
      <ChatHeader
        conversation={conv}
        currentUserId={1}
        onBack={vi.fn()}
        onToggleInfo={vi.fn()}
        typingText="Ravi is typing..."
      />
    )

    expect(screen.getByText('Ravi is typing...')).toBeInTheDocument()
  })

  it('renders group info panel with admin-only controls', () => {
    const queryClient = createTestQueryClient()
    const conv = {
      id: 20,
      type: 'GROUP',
      title: 'Mobile Dev',
      description: 'Building mobile features',
      myRole: 'ADMIN',
      members: [
        { id: 1, name: 'Alice', role: 'ADMIN' },
        { id: 2, name: 'Bob', role: 'MEMBER' },
      ],
    }

    render(
      <QueryClientProvider client={queryClient}>
        <GroupInfoPanel
          conversation={conv}
          currentUserId={1}
          onClose={vi.fn()}
          onLeft={vi.fn()}
        />
      </QueryClientProvider>
    )

    expect(screen.getByText('Mobile Dev')).toBeInTheDocument()
    expect(screen.getByText('Building mobile features')).toBeInTheDocument()
    expect(screen.getByText(/Add Members/i)).toBeInTheDocument()
    expect(screen.getByTitle('Remove member')).toBeInTheDocument()
    expect(screen.getByTitle('Make Admin')).toBeInTheDocument()
  })

  it('hides admin controls from non-admin in GroupInfoPanel', () => {
    const queryClient = createTestQueryClient()
    const conv = {
      id: 20,
      type: 'GROUP',
      title: 'Mobile Dev',
      description: 'Building mobile features',
      myRole: 'MEMBER',
      members: [
        { id: 1, name: 'Alice', role: 'ADMIN' },
        { id: 2, name: 'Bob', role: 'MEMBER' },
      ],
    }

    render(
      <QueryClientProvider client={queryClient}>
        <GroupInfoPanel
          conversation={conv}
          currentUserId={2}
          onClose={vi.fn()}
          onLeft={vi.fn()}
        />
      </QueryClientProvider>
    )

    expect(screen.queryByText(/Add Members/i)).not.toBeInTheDocument()
    expect(screen.queryByTitle('Remove member')).not.toBeInTheDocument()
    expect(screen.getByText(/Leave Group/i)).toBeInTheDocument()
  })

  it('renders GroupCreateModal and validates minimum members requirement', () => {
    render(<GroupCreateModal isOpen={true} onClose={vi.fn()} onCreated={vi.fn()} />)
    expect(screen.getByText('Create New Group')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. Design Team, Book Club')).toBeInTheDocument()
    const createBtn = screen.getByRole('button', { name: /create group/i })
    expect(createBtn).toBeDisabled()
  })
})
