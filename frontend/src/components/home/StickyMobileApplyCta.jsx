import { Link } from 'react-router-dom'

/** Sticky conversion strip — mobile-first tap targets (hidden on `lg:` where header CTAs suffice). */
export default function StickyMobileApplyCta() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <div className="pointer-events-auto border-t border-slate-200/80 bg-brand-cream/95 px-4 py-3 shadow-[0_-8px_32px_rgba(217,34,67,0.08)] backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-brand-primary">Amalgated</p>
            <p className="truncate text-sm font-semibold text-brand-text">Tap to apply in under 5 min</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link
              to="/borrower/login"
              className="touch-target rounded-full border border-black/15 px-4 text-sm font-semibold text-brand-text"
            >
              Log in
            </Link>
            <Link
              to="/borrower/register"
              className="touch-target rounded-full bg-brand-primary px-5 text-sm font-semibold text-white shadow-brand-primary"
            >
              Apply
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
