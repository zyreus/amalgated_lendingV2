import { Link } from 'react-router-dom'
import PortalCard from '../../components/portal/PortalCard.jsx'
import { BorrowerPageHeader } from '../../components/portal/BorrowerPageHeader.jsx'
import { useState } from 'react'

export default function BorrowerPrivacyPrefsPage() {
  const [analytics, setAnalytics] = useState(true)

  return (
    <div className="space-y-8">
      <BorrowerPageHeader
        eyebrow="Settings"
        title="Privacy"
        description="You control optional analytics and marketing cookies from the site-wide cookie banner as well."
      />

      <PortalCard title="Data controls" subtitle="Enterprise-ready copy — wire DSAR endpoints in production.">
        <div className="space-y-4 text-sm text-gray-600 dark:text-gray-400">
          <p>
            Download a machine-readable export of your profile and application metadata. Large document files may be provided as secure
            links.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-xl border border-gray-200 bg-white px-4 py-2 font-semibold text-brand-text hover:border-brand-primary/40 dark:border-gray-600 dark:bg-[#111827] dark:text-white">
              Request data export
            </button>
            <button type="button" className="rounded-xl bg-brand-primary/10 px-4 py-2 font-semibold text-brand-primary hover:bg-brand-primary/15">
              Delete account (request)
            </button>
          </div>
        </div>

        <div className="mt-8 border-t border-black/[0.06] pt-6 dark:border-white/10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-brand-text dark:text-white">Product analytics</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Helps us improve flows — never sold to third parties.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={analytics}
              onClick={() => setAnalytics((v) => !v)}
              className={`relative h-9 w-14 shrink-0 rounded-full ${analytics ? 'bg-brand-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
            >
              <span className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow transition-transform ${analytics ? 'left-[calc(100%-1.9rem)]' : 'left-1'}`} />
            </button>
          </div>
        </div>

        <p className="mt-6 text-xs text-gray-500 dark:text-gray-400">
          Full policy:{' '}
          <Link to="/privacy-policy" className="font-semibold text-brand-primary hover:underline">
            Privacy Policy
          </Link>
        </p>
      </PortalCard>
    </div>
  )
}
