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
import ConversationItem from './components/chat/ConversationItem'
import ChatWindow from './components/chat/ChatWindow'
import ConnectionBanner from './components/common/ConnectionBanner'
import MessageBubble from './components/chat/MessageBubble'
import MessageList from './components/chat/MessageList'
import GroupCreateModal from './components/chat/GroupCreateModal'
import GroupInfoPanel from './components/chat/GroupInfoPanel'
import ChatHeader from './components/chat/ChatHeader'
import MessageReceiptModal from './components/chat/MessageReceiptModal'
import ToastNotification from './components/common/ToastNotification'
import Sidebar from './components/chat/Sidebar'
import AttachmentPreview from './components/chat/AttachmentPreview'
import UserAvatar from './components/common/UserAvatar'
import ProfilePage from './pages/ProfilePage'
import SettingsPage from './pages/SettingsPage'
import { ThemeProvider } from './context/ThemeContext'
import { userApi } from './api/userApi'
import { authApi } from './api/authApi'
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

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Conversations that/i)
    expect(screen.getAllByRole('button', { name: /Sign In/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /Get Started/i }).length).toBeGreaterThan(0)
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

    expect(onSend).toHaveBeenCalledWith('Hello world', [])
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

    expect(screen.getByRole('heading', { name: /Welcome to Vanni/i })).toBeInTheDocument()
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

  describe('Phase 6 Receipts, Unread Counts & Notifications', () => {
    it('renders read/delivered/sent ticks correctly in MessageBubble', () => {
      const sentMsg = { id: 1, content: 'Sent msg', status: 'SENT', createdAt: '2026-11-24T10:00:00Z' }
      const deliveredMsg = { id: 2, content: 'Delivered msg', status: 'DELIVERED', createdAt: '2026-11-24T10:01:00Z' }
      const readMsg = { id: 3, content: 'Read msg', status: 'READ', createdAt: '2026-11-24T10:02:00Z' }

      const { rerender } = render(<MessageBubble message={sentMsg} isMine={true} />)
      expect(screen.getByLabelText('Sent')).toBeInTheDocument()

      rerender(<MessageBubble message={deliveredMsg} isMine={true} />)
      expect(screen.getByLabelText('Delivered')).toBeInTheDocument()

      rerender(<MessageBubble message={readMsg} isMine={true} />)
      expect(screen.getByLabelText('Read')).toBeInTheDocument()
    })

    it('renders unread divider in MessageList when unreadCount > 0', () => {
      const messages = [
        { id: 10, content: 'Old message', sender: { id: 1 }, createdAt: '2026-11-24T10:00:00Z' },
        { id: 11, content: 'Unread 1', sender: { id: 2 }, createdAt: '2026-11-24T10:05:00Z' },
        { id: 12, content: 'Unread 2', sender: { id: 2 }, createdAt: '2026-11-24T10:06:00Z' },
      ]

      render(
        <MessageList
          messages={messages}
          currentUserId={1}
          unreadCount={2}
          onLoadOlder={vi.fn()}
          hasOlder={false}
          isLoadingOlder={false}
        />
      )

      expect(screen.getByText('2 unread messages')).toBeInTheDocument()
    })

    it('filters unread conversations when Unread tab is clicked in Sidebar', () => {
      const queryClient = createTestQueryClient()
      const mockUser = { id: 1, name: 'Alice', email: 'alice@vanni.app' }
      const convs = [
        { id: 101, title: 'Chat With Bob', unreadCount: 0, members: [] },
        { id: 102, title: 'Team Chat', unreadCount: 3, members: [] },
      ]

      render(
        <MemoryRouter>
          <QueryClientProvider client={queryClient}>
            <AuthContext.Provider value={{ user: mockUser, logout: vi.fn() }}>
              <Sidebar
                conversations={convs}
                activeId={null}
                onSelectConversation={vi.fn()}
                onStartDirectChat={vi.fn()}
              />
            </AuthContext.Provider>
          </QueryClientProvider>
        </MemoryRouter>
      )

      expect(screen.getByText('Chat With Bob')).toBeInTheDocument()
      expect(screen.getByText('Team Chat')).toBeInTheDocument()

      // Click Unread tab
      fireEvent.click(screen.getByRole('button', { name: /unread/i }))
      expect(screen.queryByText('Chat With Bob')).not.toBeInTheDocument()
      expect(screen.getByText('Team Chat')).toBeInTheDocument()
    })

    it('renders ToastNotification for incoming messages with dismiss action', () => {
      const onSelect = vi.fn()
      const onDismiss = vi.fn()
      const toast = {
        id: 99,
        conversationId: 42,
        senderName: 'Charlie',
        content: 'Check out the new design',
      }

      render(<ToastNotification toast={toast} onSelect={onSelect} onDismiss={onDismiss} />)

      expect(screen.getByText('Charlie')).toBeInTheDocument()
      expect(screen.getByText('Check out the new design')).toBeInTheDocument()

      fireEvent.click(screen.getByText('Charlie'))
      expect(onSelect).toHaveBeenCalledWith(42)
    })

    it('renders MessageReceiptModal with message info header', () => {
      const queryClient = createTestQueryClient()
      const msg = { id: 88, content: 'Important update', createdAt: '2026-11-24T12:00:00Z' }

      render(
        <QueryClientProvider client={queryClient}>
          <MessageReceiptModal isOpen={true} onClose={vi.fn()} message={msg} />
        </QueryClientProvider>
      )

      expect(screen.getByText('Message Info')).toBeInTheDocument()
      expect(screen.getByText(/"Important update"/i)).toBeInTheDocument()
      expect(screen.getByText(/Recipients/i)).toBeInTheDocument()
    })
  })

  describe('Phase 7 Attachments and Profile', () => {
    it('renders UserAvatar with initials fallback and online indicator', () => {
      const { rerender } = render(
        <UserAvatar name="Alice Wonder" size="md" isOnline={true} />
      )
      expect(screen.getByText('A')).toBeInTheDocument()
      expect(screen.getByTitle('Online')).toBeInTheDocument()

      rerender(
        <UserAvatar
          src="https://example.com/avatar.png"
          name="Alice Wonder"
          size="md"
          isOnline={false}
        />
      )
      const img = screen.getByRole('img', { name: /Alice Wonder/i })
      expect(img).toHaveAttribute('src', 'https://example.com/avatar.png')
    })

    it('renders AttachmentPreview with image thumbnails and file cards', () => {
      const attachments = [
        {
          id: 1,
          fileName: 'screenshot.png',
          mimeType: 'image/png',
          size: 204800,
          url: '/api/attachments/1',
        },
        {
          id: 2,
          fileName: 'project-spec.pdf',
          mimeType: 'application/pdf',
          size: 1048576,
          url: '/api/attachments/2',
        },
      ]

      render(<AttachmentPreview attachments={attachments} isMine={false} />)

      // Image thumbnail
      const img = screen.getByRole('img', { name: /screenshot.png/i })
      expect(img).toHaveAttribute('src', '/api/attachments/1')

      // PDF file card
      expect(screen.getByText('project-spec.pdf')).toBeInTheDocument()
      expect(screen.getByText('1 MB')).toBeInTheDocument()
      const downloadLink = screen.getByTitle('Download file')
      expect(downloadLink).toHaveAttribute('href', '/api/attachments/2')
    })

    it('opens ImageLightbox when image thumbnail is clicked and closes on close button', () => {
      const attachments = [
        {
          id: 1,
          fileName: 'vacation.jpg',
          mimeType: 'image/jpeg',
          size: 512000,
          url: '/api/attachments/1',
        },
      ]

      render(<AttachmentPreview attachments={attachments} isMine={false} />)

      const img = screen.getByRole('img', { name: /vacation.jpg/i })
      fireEvent.click(img)

      // Lightbox opened
      expect(screen.getByLabelText('Close')).toBeInTheDocument()
      expect(screen.getByLabelText('Download image')).toBeInTheDocument()

      fireEvent.click(screen.getByLabelText('Close'))
      expect(screen.queryByLabelText('Close')).not.toBeInTheDocument()
    })

    it('rejects oversized files on the client in MessageComposer', async () => {
      render(<MessageComposer onSendMessage={vi.fn()} disabled={false} />)

      const largeFile = new File([new ArrayBuffer(12 * 1024 * 1024)], 'too-large.png', {
        type: 'image/png',
      })
      const fileInput = document.querySelector('input[type="file"]')

      fireEvent.change(fileInput, { target: { files: [largeFile] } })

      await waitFor(() => {
        expect(screen.getByText(/exceeds the 10 MB file limit/i)).toBeInTheDocument()
      })
    })

    it('rejects disallowed file extensions on the client in MessageComposer', async () => {
      render(<MessageComposer onSendMessage={vi.fn()} disabled={false} />)

      const exeFile = new File(['executable content'], 'danger.exe', {
        type: 'application/x-msdownload',
      })
      const fileInput = document.querySelector('input[type="file"]')

      fireEvent.change(fileInput, { target: { files: [exeFile] } })

      await waitFor(() => {
        expect(screen.getByText(/is not permitted for upload/i)).toBeInTheDocument()
      })
    })

    it('renders ProfilePage with display name, read-only email, and password change inputs', () => {
      const mockUser = {
        id: 1,
        name: 'Alice Wonder',
        email: 'alice@vanni.app',
        about: 'Building awesome apps',
        avatarUrl: null,
        showLastSeen: true,
        showReadReceipts: true,
      }

      render(
        <MemoryRouter>
          <AuthContext.Provider value={{ user: mockUser, updateUser: vi.fn(), logout: vi.fn() }}>
            <ProfilePage />
          </AuthContext.Provider>
        </MemoryRouter>
      )

      expect(screen.getByRole('heading', { name: /Profile & Settings/i })).toBeInTheDocument()
      expect(screen.getByDisplayValue('Alice Wonder')).toBeInTheDocument()
      expect(screen.getByDisplayValue('alice@vanni.app')).toBeDisabled()
      expect(screen.getByDisplayValue('Building awesome apps')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/Enter your current password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Update Password/i })).toBeInTheDocument()
    })
  })

  describe('Phase 8 Enhancements & Settings', () => {
    it('renders reactions pills and triggers reaction toggle on click in MessageBubble', () => {
      const mockToggle = vi.fn()
      const msg = {
        id: 101,
        content: 'Check out the new feature',
        createdAt: '2026-11-25T01:00:00Z',
        sender: { id: 2, name: 'Bob' },
        reactions: [
          { emoji: '👍', count: 2, reactedByMe: true },
          { emoji: '❤️', count: 1, reactedByMe: false },
        ],
      }

      render(
        <MessageBubble
          message={msg}
          isMine={false}
          onToggleReaction={mockToggle}
        />
      )

      expect(screen.getByText('👍')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('❤️')).toBeInTheDocument()
      expect(screen.getByText('1')).toBeInTheDocument()

      fireEvent.click(screen.getByText('👍'))
      expect(mockToggle).toHaveBeenCalledWith(msg, '👍')
    })

    it('renders edited label when message has editedAt timestamp', () => {
      const msg = {
        id: 102,
        content: 'Corrected text',
        createdAt: '2026-11-25T01:00:00Z',
        editedAt: '2026-11-25T01:05:00Z',
        sender: { id: 1 },
      }

      render(<MessageBubble message={msg} isMine={true} />)
      expect(screen.getByText('edited')).toBeInTheDocument()
      expect(screen.getByText('Corrected text')).toBeInTheDocument()
    })

    it('renders deleted message placeholder and suppresses content', () => {
      const msg = {
        id: 103,
        content: null,
        deleted: true,
        createdAt: '2026-11-25T01:00:00Z',
        sender: { id: 1 },
      }

      render(<MessageBubble message={msg} isMine={true} />)
      expect(screen.getByText('This message was deleted')).toBeInTheDocument()
    })

    it('renders quoted reply preview in MessageBubble and jumps on click', () => {
      const mockJump = vi.fn()
      const msg = {
        id: 104,
        content: 'Yes, absolutely!',
        createdAt: '2026-11-25T01:00:00Z',
        sender: { id: 2, name: 'Bob' },
        replyTo: {
          id: 50,
          senderName: 'Alice',
          snippet: 'Should we launch today?',
        },
      }

      render(<MessageBubble message={msg} isMine={false} onJumpToMessage={mockJump} />)
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Should we launch today?')).toBeInTheDocument()

      fireEvent.click(screen.getByText('Should we launch today?'))
      expect(mockJump).toHaveBeenCalledWith(50)
    })

    it('renders reply preview banner in MessageComposer and cancels on X click', () => {
      const mockCancel = vi.fn()
      const replyTo = {
        id: 50,
        senderName: 'Alice',
        snippet: 'Original question',
      }

      render(
        <MessageComposer
          onSendMessage={vi.fn()}
          disabled={false}
          replyTo={replyTo}
          onCancelReply={mockCancel}
        />
      )

      expect(screen.getByText(/Replying to Alice/i)).toBeInTheDocument()
      expect(screen.getByText('Original question')).toBeInTheDocument()

      const cancelBtn = screen.getByTitle('Cancel reply')
      fireEvent.click(cancelBtn)
      expect(mockCancel).toHaveBeenCalled()
    })

    it('renders pinned and muted icons and action menu in ConversationItem', () => {
      const mockUpdateSettings = vi.fn()
      const conv = {
        id: 77,
        type: 'DIRECT',
        title: 'Priority Work',
        pinned: true,
        muted: true,
        archived: false,
        lastMessage: { content: 'Urgent task', createdAt: '2026-11-25T02:00:00Z' },
        unreadCount: 0,
        members: [],
      }

      render(
        <ConversationItem
          conversation={conv}
          isActive={false}
          onClick={vi.fn()}
          currentUserId={1}
          onUpdateSettings={mockUpdateSettings}
        />
      )

      expect(screen.getByText('Priority Work')).toBeInTheDocument()

      // Open context menu
      const menuBtn = screen.getByLabelText('Chat options')
      fireEvent.click(menuBtn)

      expect(screen.getByText('Unpin chat')).toBeInTheDocument()
      expect(screen.getByText('Unmute chat')).toBeInTheDocument()
      expect(screen.getByText('Archive chat')).toBeInTheDocument()

      fireEvent.click(screen.getByText('Unpin chat'))
      expect(mockUpdateSettings).toHaveBeenCalledWith(77, { pinned: false })
    })

    it('renders SettingsPage with theme options, privacy settings, blocked users, and session logout', async () => {
      vi.spyOn(userApi, 'getBlocked').mockResolvedValue([
        { id: 99, name: 'Spam User', email: 'spam@bad.app', avatarUrl: null },
      ])
      const mockUnblock = vi.spyOn(userApi, 'unblock').mockResolvedValue({})
      vi.spyOn(authApi, 'logoutAll').mockResolvedValue({})

      const mockUser = {
        id: 1,
        name: 'Alice Wonder',
        email: 'alice@vanni.app',
        showLastSeen: true,
        showReadReceipts: true,
      }

      render(
        <MemoryRouter>
          <ThemeProvider>
            <AuthContext.Provider value={{ user: mockUser, updateUser: vi.fn(), logout: vi.fn() }}>
              <SettingsPage />
            </AuthContext.Provider>
          </ThemeProvider>
        </MemoryRouter>
      )

      expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
      expect(screen.getByText('Theme Appearance')).toBeInTheDocument()
      expect(screen.getByText('Desktop Notifications')).toBeInTheDocument()
      expect(screen.getByText('Privacy Settings')).toBeInTheDocument()
      expect(screen.getByText('Blocked Users')).toBeInTheDocument()
      expect(screen.getByText('Account Sessions')).toBeInTheDocument()

      // Wait for blocked user to load
      await waitFor(() => {
        expect(screen.getByText('Spam User')).toBeInTheDocument()
      })

      // Click Unblock
      const unblockBtn = screen.getByRole('button', { name: /Unblock/i })
      fireEvent.click(unblockBtn)
      await waitFor(() => {
        expect(mockUnblock).toHaveBeenCalledWith(99)
      })

      // Theme toggle buttons
      const lightBtn = screen.getByRole('button', { name: /Light/i })
      const darkBtn = screen.getByRole('button', { name: /Dark/i })
      const systemBtn = screen.getByRole('button', { name: /System/i })
      expect(lightBtn).toBeInTheDocument()
      expect(darkBtn).toBeInTheDocument()
      expect(systemBtn).toBeInTheDocument()

      // Clicking Light removes the .dark class on <html> and persists preference
      fireEvent.click(lightBtn)
      expect(document.documentElement.classList.contains('dark')).toBe(false)
      expect(document.documentElement.style.colorScheme).toBe('light')
      expect(localStorage.getItem('vanni_theme')).toBe('light')

      // Clicking Dark adds the .dark class on <html> and persists preference
      fireEvent.click(darkBtn)
      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(document.documentElement.style.colorScheme).toBe('dark')
      expect(localStorage.getItem('vanni_theme')).toBe('dark')

      // Clicking System persists system preference
      fireEvent.click(systemBtn)
      expect(localStorage.getItem('vanni_theme')).toBe('system')
    })
  })

  describe('QA Regression Fixes', () => {
    it('MessageComposer shows character counter near limit and rejects > 4000 chars', async () => {
      const onSend = vi.fn()
      render(<MessageComposer onSendMessage={onSend} />)

      const textarea = screen.getByPlaceholderText(/Type a message/i)
      const overLimit = 'a'.repeat(4005)
      fireEvent.change(textarea, { target: { value: overLimit } })

      expect(screen.getByText('4005/4000')).toBeInTheDocument()

      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
      expect(onSend).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toHaveTextContent(/4,000-character limit/i)
    })

    it('MessageBubble enables edit immediately when optimistic pending becomes false', () => {
      const baseMsg = {
        id: null,
        clientMessageId: 'cm-qa-1',
        content: 'Just sent',
        sender: { id: 1, name: 'Asha' },
        createdAt: new Date().toISOString(),
        pending: true,
        failed: false,
      }

      const { rerender } = render(
        <MessageBubble message={baseMsg} isMine={true} onEdit={vi.fn()} />
      )
      expect(screen.queryByRole('button', { name: /Edit message/i })).not.toBeInTheDocument()

      rerender(
        <MessageBubble
          message={{ ...baseMsg, id: 901, pending: false }}
          isMine={true}
          onEdit={vi.fn()}
        />
      )
      expect(screen.getByRole('button', { name: /Edit message/i })).toBeInTheDocument()
    })

    it('MessageList does not jump scroll to bottom when older messages are prepended', () => {
      const recent = [
        { id: 10, content: 'Recent 1', sender: { id: 2, name: 'Ravi' }, createdAt: new Date().toISOString() },
        { id: 11, content: 'My latest', sender: { id: 1, name: 'Asha' }, createdAt: new Date().toISOString() },
      ]

      const { rerender } = render(
        <MessageList
          messages={recent}
          currentUserId={1}
          onLoadOlder={vi.fn()}
          hasOlder={true}
          isLoadingOlder={false}
        />
      )

      const logEl = screen.getByRole('log')
      Object.defineProperty(logEl, 'scrollHeight', { value: 1200, configurable: true })
      Object.defineProperty(logEl, 'clientHeight', { value: 400, configurable: true })
      logEl.scrollTop = 250

      const withOlder = [
        { id: 8, content: 'Older 1', sender: { id: 2, name: 'Ravi' }, createdAt: new Date().toISOString() },
        { id: 9, content: 'Older 2', sender: { id: 1, name: 'Asha' }, createdAt: new Date().toISOString() },
        ...recent,
      ]

      rerender(
        <MessageList
          messages={withOlder}
          currentUserId={1}
          onLoadOlder={vi.fn()}
          hasOlder={true}
          isLoadingOlder={false}
        />
      )

      // Must NOT snap to scrollHeight (1200) when prepending older messages
      expect(logEl.scrollTop).toBe(250)
    })

    it('ChatHeader renders block toggle button in direct chats and GroupInfoPanel shows admin avatar upload', () => {
      const { rerender } = render(
        <ChatHeader
          conversation={{
            id: 55,
            type: 'DIRECT',
            title: 'Ravi',
            members: [
              { id: 1, name: 'Asha' },
              { id: 2, name: 'Ravi', online: true },
            ],
          }}
          currentUserId={1}
          onBack={vi.fn()}
        />
      )
      expect(screen.getByRole('button', { name: /Block user/i })).toBeInTheDocument()

      rerender(
        <QueryClientProvider client={new QueryClient()}>
          <GroupInfoPanel
            conversation={{
              id: 77,
              type: 'GROUP',
              title: 'QA Team',
              myRole: 'ADMIN',
              members: [{ id: 1, name: 'Asha', role: 'ADMIN' }],
            }}
            currentUserId={1}
            onClose={vi.fn()}
          />
        </QueryClientProvider>
      )
      expect(screen.getByRole('button', { name: /Change group avatar/i })).toBeInTheDocument()
    })
  })
})
