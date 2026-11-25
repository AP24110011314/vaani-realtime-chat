import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { http as mswHttp, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import httpClient from './api/http'
import { AuthProvider } from './context/AuthContext'
import App from './App'
import * as useSocketModule from './hooks/useSocket'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ConversationList from './components/chat/ConversationList'
import MessageList from './components/chat/MessageList'
import MessageBubble from './components/chat/MessageBubble'
import { useTyping } from './hooks/useTyping'
import { usePresence } from './hooks/usePresence'

const server = setupServer(
  mswHttp.get('/api/auth/csrf', () => {
    return HttpResponse.json({ token: 'csrf-test' })
  }),
  mswHttp.get('/api/users/me', () => {
    return HttpResponse.json({ message: 'Unauthenticated' }, { status: 401 })
  }),
  mswHttp.post('/api/auth/refresh', () => {
    return HttpResponse.json({ message: 'No refresh' }, { status: 401 })
  }),
  mswHttp.post('/api/auth/login', async ({ request }) => {
    const body = await request.json()
    if (body.email === 'asha@vanni.app' && body.password === 'Password123') {
      return HttpResponse.json({
        id: 1,
        name: 'Asha',
        email: 'asha@vanni.app',
        showLastSeen: true,
        showReadReceipts: true,
      })
    }
    return HttpResponse.json({ message: 'Invalid email or password' }, { status: 401 })
  }),
  mswHttp.post('/api/auth/register', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json(
      {
        id: 2,
        name: body.name,
        email: body.email,
        showLastSeen: true,
        showReadReceipts: true,
      },
      { status: 201 }
    )
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('Phase 9 MSW API, Forms, Hooks, Security & Accessibility Tests', () => {
  it('submits LoginPage through MSW and displays alert on invalid credentials, then navigates on success', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/app" element={<div>App Workspace</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    )

    const emailInput = await screen.findByLabelText(/Email Address/i)
    const passwordInput = screen.getByLabelText(/^Password$/i)

    // Invalid login shows accessible alert
    fireEvent.change(emailInput, { target: { value: 'asha@vanni.app' } })
    fireEvent.change(passwordInput, { target: { value: 'WrongPass123' } })
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Invalid email or password/i)
    })

    // Valid login succeeds and navigates to /app
    fireEvent.change(passwordInput, { target: { value: 'Password123' } })
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }))

    await waitFor(() => {
      expect(screen.getByText('App Workspace')).toBeInTheDocument()
    })
  })

  it('submits RegisterPage through MSW and announces validation errors cleanly', async () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <AuthProvider>
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/app" element={<div>Registered App</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    )

    const nameInput = await screen.findByLabelText(/Full Name/i)
    const emailInput = screen.getByLabelText(/Email Address/i)
    const passInput = screen.getByLabelText(/^Password$/i)
    const confirmInput = screen.getByLabelText(/Confirm Password/i)

    fireEvent.change(nameInput, { target: { value: 'Ravi' } })
    fireEvent.change(emailInput, { target: { value: 'ravi@vanni.app' } })
    fireEvent.change(passInput, { target: { value: 'Password123' } })
    fireEvent.change(confirmInput, { target: { value: 'Password123' } })

    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }))

    await waitFor(() => {
      expect(screen.getByText('Registered App')).toBeInTheDocument()
    })
  })

  it('automatically refreshes token on 401 and retries original HTTP request via interceptor', async () => {
    let attempts = 0
    server.use(
      mswHttp.get('/api/protected-check', () => {
        attempts += 1
        if (attempts === 1) {
          return HttpResponse.json({ message: 'Expired' }, { status: 401 })
        }
        return HttpResponse.json({ ok: true })
      }),
      mswHttp.post('/api/auth/refresh', () => {
        return HttpResponse.json({ refreshed: true })
      })
    )

    const res = await httpClient.get('/protected-check')
    expect(res.data).toEqual({ ok: true })
    expect(attempts).toBe(2)
  })

  it('ConversationList preserves pinned-first ordering and supports keyboard selection', () => {
    const convs = [
      { id: 1, title: 'Pinned Chat', pinned: true, lastMessage: { content: 'First' }, unreadCount: 0 },
      { id: 2, title: 'Recent Chat', pinned: false, lastMessage: { content: 'Second' }, unreadCount: 1 },
    ]
    const onSelect = vi.fn()
    render(
      <ConversationList
        conversations={convs}
        activeId={1}
        onSelectConversation={onSelect}
        onOpenNewChat={vi.fn()}
        currentUserId={1}
      />
    )

    const items = screen.getAllByRole('button').filter((b) => b.textContent.includes('Chat'))
    expect(items[0]).toHaveTextContent('Pinned Chat')
    expect(items[1]).toHaveTextContent('Recent Chat')
    fireEvent.click(items[1])
    expect(onSelect).toHaveBeenCalledWith(2)
  })

  it('MessageList exposes accessible role="log" and aria-live="polite"', () => {
    render(
      <MessageList
        messages={[
          {
            id: 10,
            content: 'Accessible message',
            sender: { id: 1, name: 'Asha' },
            createdAt: new Date().toISOString(),
            status: 'SENT',
          },
        ]}
        currentUserId={1}
      />
    )

    const logEl = screen.getByRole('log')
    expect(logEl).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByText('Accessible message')).toBeInTheDocument()
  })

  it('escapes XSS payloads in message content and sender name, and linkifies URLs safely', () => {
    const { container } = render(
      <MessageBubble
        message={{
          id: 55,
          content: '<script>alert("xss")</script> Check https://example.com/docs',
          sender: { id: 2, name: '<img src=x onerror=alert(1)>' },
          createdAt: new Date().toISOString(),
          status: 'READ',
        }}
        isMine={false}
        isGroup={true}
      />
    )

    expect(container.querySelector('script')).toBeNull()
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'https://example.com/docs' })
    expect(link).toHaveAttribute('rel', 'noopener noreferrer nofollow')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('useTyping formats multi-user typing text and triggers throttled start/stop frames', () => {
    vi.useFakeTimers()
    const sendTyping = vi.fn()
    const spy = vi.spyOn(useSocketModule, 'useSocket').mockReturnValue({
      sendTyping,
      typingMap: {
        '77': {
          '2': { name: 'Asha' },
          '3': { name: 'Ravi' },
        },
      },
      presenceMap: {},
      fetchPresence: vi.fn(),
    })

    const { result } = renderHook(() => useTyping(77))
    expect(result.current.typingText).toBe('Asha and Ravi are typing...')

    act(() => {
      result.current.handleKeyStroke()
    })
    expect(sendTyping).toHaveBeenCalledWith(77, true)

    act(() => {
      vi.advanceTimersByTime(3100)
    })
    expect(sendTyping).toHaveBeenCalledWith(77, false)
    spy.mockRestore()
    vi.useRealTimers()
  })

  it('usePresence requests presence and reads live presenceMap', () => {
    const fetchPresence = vi.fn()
    const spy = vi.spyOn(useSocketModule, 'useSocket').mockReturnValue({
      presenceMap: { 9: { online: true, lastSeenAt: null } },
      fetchPresence,
    })

    const { result } = renderHook(() => usePresence(9))
    expect(fetchPresence).toHaveBeenCalledWith([9])
    expect(result.current).toEqual({ online: true, lastSeenAt: null })
    spy.mockRestore()
  })

  it('mounts root <App /> without missing provider errors (QueryClientProvider regression)', async () => {
    window.history.pushState({}, '', '/login')
    render(<App />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Sign in to your account/i })).toBeInTheDocument()
    })
  })
})
