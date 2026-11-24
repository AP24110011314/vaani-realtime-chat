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
