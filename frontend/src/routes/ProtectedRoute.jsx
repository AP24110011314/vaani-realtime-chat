import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../hooks/useAuth'
import Spinner from '../components/common/Spinner'

export default function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-ink">
        <div className="p-6 rounded-3xl glass-strong flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm font-medium text-ink-muted">Loading Vanni...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
