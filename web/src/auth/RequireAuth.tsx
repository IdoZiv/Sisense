import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="page">Loading…</div>
  if (!user) return <Navigate to="/" replace state={{ from: location.pathname }} />

  return <Outlet />
}

