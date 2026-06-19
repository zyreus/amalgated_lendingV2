import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAdminApiAuth } from './context/useAdminApiAuth.js'
import { AdminPageSkeleton } from '../components/loading/SkeletonLoader.jsx'

export default function ProtectedAdminRoute() {
  const { authed, booting } = useAdminApiAuth()
  const location = useLocation()

  if (booting) {
    return (
      <div className="portal-page portal-shell-bg min-h-[50vh] p-4 sm:p-6 lg:pl-56">
        <div className="mx-auto max-w-[min(100%,var(--width-content-standard))]">
          <AdminPageSkeleton />
        </div>
      </div>
    )
  }

  if (!authed) {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    )
  }

  return <Outlet />
}

