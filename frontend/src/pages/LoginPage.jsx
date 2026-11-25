import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useAuth } from '../hooks/useAuth'
import { getSafeNextPath } from '../routes/routeUtils'
import Input from '../components/common/Input'
import Button from '../components/common/Button'
import VanniLogo from '../components/common/VanniLogo'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState(null)

  const nextUrl = getSafeNextPath(location.search)
  const registerLink = location.search ? `/register${location.search}` : '/register'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (data) => {
    setServerError(null)
    try {
      await login(data.email, data.password)
      navigate(nextUrl, { replace: true })
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || 'Invalid email or password'
      setServerError(msg)
    }
  }

  return (
    <main className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 text-ink">
      <div className="mx-auto w-full max-w-[440px]">
        <div className="text-center mb-7">
          <Link to="/" className="inline-flex items-center mb-5 focus-accent rounded-2xl">
            <VanniLogo size="lg" />
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink heading-tight">
            Sign in to your account
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Don't have an account?{' '}
            <Link
              to={registerLink}
              className="font-semibold text-accent-text hover:underline transition-colors"
            >
              Create one for free
            </Link>
          </p>
        </div>

        <div className="glass-strong rounded-[28px] py-8 px-6 sm:px-9 animate-modal-in">
          {serverError && (
            <div
              role="alert"
              className="mb-6 p-3.5 rounded-2xl bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger-text)] text-sm flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            <Input
              label="Email Address"
              id="email"
              type="email"
              placeholder="you@vanni.app"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="Password"
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              autoComplete="current-password"
              error={errors.password?.message}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1.5 text-ink-subtle hover:text-ink rounded-xl transition-colors cursor-pointer focus-accent"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              }
              {...register('password')}
            />

            <Button
              type="submit"
              loading={isSubmitting}
              className="w-full mt-2 rounded-full"
            >
              Sign In
            </Button>
          </form>
        </div>
      </div>
    </main>
  )
}
