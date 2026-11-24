import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../hooks/useAuth'
import Spinner from '../components/common/Spinner'

export default function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 text-white">
        <Spinner size="lg" />
        <p className="text-sm text-slate-400">Loading Vanni...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
