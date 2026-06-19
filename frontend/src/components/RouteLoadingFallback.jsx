import { useLocation } from 'react-router-dom'
import { AdminPageSkeleton, BorrowerDashboardSkeleton } from './loading/SkeletonLoader.jsx'
import LoadingSpinner from './loading/LoadingSpinner.jsx'

/**
 * Shown while lazy route chunks load. Portal areas use skeleton placeholders.
 */
export default function RouteLoadingFallback() {
  const { pathname } = useLocation()
  const isBorrower = /^\/borrower(\/|$)/i.test(pathname)
  const isAdmin = /^\/admin(\/|$)/i.test(pathname)

  if (isBorrower) {
    return (
      <div className="portal-page portal-shell-bg min-h-[50vh] p-4 sm:p-6 lg:pl-56">
        <div className="mx-auto max-w-[min(100%,var(--width-content-standard))]">
          <BorrowerDashboardSkeleton />
        </div>
      </div>
    )
  }

  if (isAdmin) {
    return (
      <div className="portal-page portal-shell-bg min-h-[50vh] p-4 sm:p-6 lg:pl-56">
        <div className="mx-auto max-w-[min(100%,var(--width-content-standard))]">
          <AdminPageSkeleton />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center page-shell-bg text-slate-700">
      <div className="flex flex-col items-center gap-3 px-4 text-center">
        <LoadingSpinner size="lg" label="Loading page" className="text-brand-primary" />
        <p className="text-sm text-slate-600 dark:text-slate-400">Loading…</p>
      </div>
    </div>
  )
}
