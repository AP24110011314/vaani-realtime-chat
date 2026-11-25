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

const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(80, 'Name cannot exceed 80 characters'),
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Enter a valid email')
      .max(190, 'Email cannot exceed 190 characters'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(72, 'Password cannot exceed 72 characters')
      .regex(
        /^(?=.*[A-Za-z])(?=.*\d).+$/,
        'Password must contain at least one letter and one number'
      ),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export default function RegisterPage() {
  const { register: registerUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [serverError, setServerError] = useState(null)

  const nextUrl = getSafeNextPath(location.search)
  const loginLink = location.search ? `/login${location.search}` : '/login'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  const onSubmit = async (data) => {
    setServerError(null)
    try {
      await registerUser(data.name, data.email, data.password)
      navigate(nextUrl, { replace: true })
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || 'Registration failed'
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
            Create your account
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Already have an account?{' '}
            <Link
              to={loginLink}
              className="font-semibold text-accent-text hover:underline transition-colors"
            >
              Sign in
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

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <Input
              label="Full Name"
              id="name"
              placeholder="Asha Verma"
              autoComplete="name"
              error={errors.name?.message}
              {...register('name')}
            />

            <Input
              label="Email Address"
              id="email"
              type="email"
              placeholder="asha@vanni.app"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="Password"
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Min 8 chars with letter & digit"
              autoComplete="new-password"
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

            <Input
              label="Confirm Password"
              id="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              placeholder="Repeat password"
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="p-1.5 text-ink-subtle hover:text-ink rounded-xl transition-colors cursor-pointer focus-accent"
                  title={showConfirm ? 'Hide password' : 'Show password'}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              }
              {...register('confirmPassword')}
            />

            <Button
              type="submit"
              loading={isSubmitting}
              className="w-full mt-3 rounded-full"
            >
              Create Account
            </Button>
          </form>
        </div>
      </div>
    </main>
  )
}
