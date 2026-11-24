import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../hooks/useAuth'
import Spinner from '../components/common/Spinner'

export default function PublicOnlyRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 text-white">
        <Spinner size="lg" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/app" replace />
  }

  return <Outlet />
}
