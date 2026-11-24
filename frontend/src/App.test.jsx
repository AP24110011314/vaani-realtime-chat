import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { AuthContext } from './context/AuthContext'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AppRoutes from './routes/AppRoutes'

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

    render(
      <AuthContext.Provider value={{ user: fakeUser, loading: false, logout: vi.fn() }}>
        <MemoryRouter initialEntries={['/login']}>
          <AppRoutes />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    expect(screen.getByText(/Welcome to Vanni, Alice!/i)).toBeInTheDocument()
  })
})
