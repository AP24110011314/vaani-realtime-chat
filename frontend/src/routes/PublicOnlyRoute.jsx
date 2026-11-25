import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../hooks/useAuth'
import { getSafeNextPath } from './routeUtils'
import Spinner from '../components/common/Spinner'

export default function PublicOnlyRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-ink">
        <div className="p-6 rounded-3xl glass-strong flex flex-col items-center gap-3">
          <Spinner size="lg" />
        </div>
      </div>
    )
  }

  if (user) {
    return <Navigate to={getSafeNextPath(location.search)} replace />
  }

  return <Outlet />
}
