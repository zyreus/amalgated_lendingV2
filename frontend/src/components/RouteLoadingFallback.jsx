import { useLocation } from 'react-router-dom'
import { BorrowerDashboardSkeleton } from './AppSkeletons.jsx'

/**
 * Shown while lazy route chunks load. Borrower portal uses skeleton placeholders
 * instead of a full-screen spinner for faster perceived load.
 */
export default function RouteLoadingFallback() {
  const { pathname } = useLocation()
  const isBorrower = /^\/borrower(\/|$)/i.test(pathname)

  if (isBorrower) {
    return (
      <div className="portal-page portal-shell-bg min-h-[50vh] p-4 sm:p-6 lg:pl-56">
        <div className="mx-auto max-w-[min(100%,var(--width-content-standard))]">
          <BorrowerDashboardSkeleton />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center page-shell-bg text-slate-700">
      <div className="flex flex-col items-center gap-3 px-4 text-center">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-[#C41E3A] border-t-transparent"
          aria-hidden
        />
        <p className="text-sm text-slate-600">Loading…</p>
      </div>
    </div>
  )
}
