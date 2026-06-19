import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useBorrowerAuth } from './context/useBorrowerAuth.js'
import { BorrowerDashboardSkeleton } from '../components/loading/SkeletonLoader.jsx'

/**
 * Must render under BorrowerAuthProvider (see Root.jsx). Uses `<Outlet />` only — no `children` prop —
 * nested routes render into BorrowerLayout’s outlet.
 */
export default function BorrowerProtectedRoute() {
  const { authed, booting, user } = useBorrowerAuth()
  const location = useLocation()

  if (booting) {
    return (
      <div className="portal-page portal-shell-bg min-h-screen p-4 sm:p-6 lg:pl-56">
        <div className="mx-auto max-w-[min(100%,var(--width-content-standard))]">
          <BorrowerDashboardSkeleton />
        </div>
      </div>
    )
  }

  if (!authed) {
    return <Navigate to="/borrower/login" state={{ from: location }} replace />
  }
  if (user?.role !== 'borrower') {
    return <Navigate to="/unauthorized" replace />
  }

  return <Outlet />
}
