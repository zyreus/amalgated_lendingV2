import { Link } from 'react-router-dom'
import { COOKIE_PREFERENCES_EVENT } from './privacy/CookiePreferencesModal.jsx'

const AMALGATED_HOLDINGS_URL = import.meta.env.VITE_AMALGATED_HOLDINGS_URL || 'https://amalgatedholdings.com'

export default function Footer() {
  const openCookieSettings = () => {
    window.dispatchEvent(new CustomEvent(COOKIE_PREFERENCES_EVENT))
  }

  return (
    <footer className="mt-auto border-t border-white/10 bg-[#0a0a0a]">
      <div className="app-container py-10 sm:py-12">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/amalgated-lending-logo.png"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
              aria-hidden
              loading="lazy"
              decoding="async"
            />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold leading-none tracking-wide text-white">Amalgated Lending</p>
              <p className="text-sm text-white/70">Trusted Lending Solutions in Davao & Mindanao.</p>
            </div>
          </div>
          <div className="flex flex-col gap-4 lg:items-end">
            <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/80">
              <Link to="/loan-products" className="transition hover:text-white">Loan Products</Link>
              <Link to="/application-flow" className="transition hover:text-white">Application Flow</Link>
              <Link to="/privacy-policy" className="transition hover:text-white">Privacy Policy</Link>
              <Link to="/apply" className="transition hover:text-white">Apply</Link>
              <Link to="/borrower/login" className="transition hover:text-white">Borrower Log in</Link>
              <Link to="/contact" className="transition hover:text-white">Contact</Link>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-white/70">Follow us:</span>
              <a href="#" aria-label="Facebook" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:border-red-600/60 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-600/30">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                  <path d="M13.5 22v-8h2.68l.4-3.12H13.5V8.9c0-.9.25-1.52 1.55-1.52h1.66V4.6c-.29-.04-1.29-.12-2.45-.12-2.42 0-4.08 1.48-4.08 4.2v2.2H7.5V14h2.68v8h3.32Z" />
                </svg>
              </a>
              <a href="#" aria-label="Instagram" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:border-red-600/60 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-600/30">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <rect x="7" y="7" width="10" height="10" rx="3" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </a>
            </div>
          </div>
        </div>
        <div className="mt-8 border-t border-white/10 pt-8">
          <p className="text-center text-sm text-white/60">
            Amalgated Lending Inc. (ALI) · Part of the Amalgated Group of Companies
          </p>
          <p className="mt-1 text-center text-xs text-white/50">
            Davao City, Philippines · SEC/DTI details available upon request · SSL secured borrower portal
          </p>
          <p className="mt-1 text-center text-xs text-white/50">
            © {new Date().getFullYear()} All rights reserved.
          </p>
          <p className="mt-3 text-center">
            <a href={AMALGATED_HOLDINGS_URL} target="_blank" rel="noreferrer" className="text-xs text-white/50 underline hover:text-white/80">
              Amalgated Holdings
            </a>
          </p>
          <p className="mt-2 text-center">
            <button
              type="button"
              onClick={openCookieSettings}
              className="text-xs text-white/50 underline transition hover:text-white/80"
            >
              Cookie Settings
            </button>
          </p>
        </div>
      </div>
    </footer>
  )
}
