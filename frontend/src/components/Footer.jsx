import { useState } from 'react'
import { Link } from 'react-router-dom'
import { laravelRequest } from '../utils/lendingLaravelApi.js'
import { COOKIE_PREFERENCES_EVENT } from './privacy/CookiePreferencesModal.jsx'

const AMALGATED_HOLDINGS_URL = import.meta.env.VITE_AMALGATED_HOLDINGS_URL || 'https://amalgatedholdings.com'

export default function Footer() {
  const openCookieSettings = () => {
    window.dispatchEvent(new CustomEvent(COOKIE_PREFERENCES_EVENT))
  }

  const [nlName, setNlName] = useState('')
  const [nlEmail, setNlEmail] = useState('')
  const [nlStatus, setNlStatus] = useState('idle')
  const [nlError, setNlError] = useState('')

  async function submitNewsletter(e) {
    e.preventDefault()
    setNlError('')
    setNlStatus('loading')
    try {
      const { res } = await laravelRequest('/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: nlName.trim() || 'Newsletter subscriber',
          email: nlEmail.trim(),
          message: 'Please add me to product updates and rate alerts from the website footer.',
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.message || `Subscribe failed (${res.status})`)
      setNlStatus('success')
      setNlEmail('')
      setNlName('')
    } catch (err) {
      setNlStatus('idle')
      setNlError(err.message || 'Could not subscribe.')
    }
  }

  return (
    <footer className="mt-auto">
      <div
        className="pointer-events-none h-12 bg-gradient-to-b from-brand-cream via-brand-primary to-[#5c1020] sm:h-16"
        aria-hidden
      />
      <div className="border-t border-white/10 bg-[#0c0c0c]">
        <div className="app-container pb-16 pt-10 sm:pb-20 sm:pt-12 lg:pb-24">
        <div className="landing-card-grid lg:grid-cols-[1.2fr_1fr_1fr]">
          <div className="flex flex-col gap-6">
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
                <p className="text-sm font-semibold leading-none tracking-wide text-white">Amalgated Lending Inc.</p>
                <p className="text-sm text-white/70">Premium digital lending for the Philippines — Davao HQ, nationwide online.</p>
              </div>
            </div>
            <p className="max-w-sm text-xs leading-relaxed text-white/55">
              Secure borrower portal, Laravel APIs, and staff tooling built for regulated lending — navy, emerald, and
              engineered for trust.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400/90">Borrow</p>
            <ul className="mt-5 space-y-3.5 text-sm leading-relaxed text-white/80">
              <li>
                <Link to="/loan-products" className="transition hover:text-white">
                  Loan products
                </Link>
              </li>
              <li>
                <Link to="/eligibility" className="transition hover:text-white">
                  Eligibility checker
                </Link>
              </li>
              <li>
                <Link to="/loan-calculator" className="transition hover:text-white">
                  Loan calculator
                </Link>
              </li>
              <li>
                <Link to="/borrower/register" className="transition hover:text-white">
                  Register
                </Link>
              </li>
              <li>
                <Link to="/borrower/login" className="transition hover:text-white">
                  Borrower log in
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400/90">Company</p>
            <ul className="mt-5 space-y-3.5 text-sm leading-relaxed text-white/80">
              <li>
                <Link to="/about" className="transition hover:text-white">
                  About us
                </Link>
              </li>
              <li>
                <Link to="/blog" className="transition hover:text-white">
                  Blog &amp; resources
                </Link>
              </li>
              <li>
                <Link to="/careers" className="transition hover:text-white">
                  Careers
                </Link>
              </li>
              <li>
                <Link to="/application-flow" className="transition hover:text-white">
                  Application flow
                </Link>
              </li>
              <li>
                <Link to="/contact" className="transition hover:text-white">
                  Contact
                </Link>
              </li>
              <li>
                <Link to="/privacy-policy" className="transition hover:text-white">
                  Privacy policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-8 lg:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-md">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]/95">Newsletter</p>
              <p className="mt-3 font-display text-lg font-bold text-white">Rate drops &amp; product drops</p>
              <p className="mt-3 text-sm leading-relaxed text-white/65">Short updates — no spam. Unsubscribe anytime (we’ll honor it).</p>
            </div>
            <form onSubmit={submitNewsletter} className="flex w-full max-w-lg flex-col gap-4 sm:flex-row sm:items-stretch">
              <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
              <input
                type="text"
                placeholder="First name (optional)"
                value={nlName}
                onChange={(e) => setNlName(e.target.value)}
                className="min-h-12 flex-1 rounded-2xl border border-white/15 bg-white/5 px-4 text-sm text-white placeholder:text-white/40 outline-none ring-brand-primary/40 focus:ring-2"
              />
              <input
                type="email"
                required
                placeholder="Email address"
                value={nlEmail}
                onChange={(e) => setNlEmail(e.target.value)}
                autoComplete="email"
                className="min-h-12 flex-[1.3] rounded-2xl border border-white/15 bg-white/5 px-4 text-sm text-white placeholder:text-white/40 outline-none ring-brand-primary/40 focus:ring-2"
              />
              <button
                type="submit"
                disabled={nlStatus === 'loading'}
                className="min-h-12 shrink-0 rounded-2xl bg-gradient-brand px-6 text-sm font-bold text-white shadow-lg transition enabled:hover:opacity-95 disabled:opacity-50"
              >
                {nlStatus === 'loading' ? '…' : 'Join'}
              </button>
            </form>
          </div>
          {nlError ? <p className="mt-3 text-sm text-red-300">{nlError}</p> : null}
          {nlStatus === 'success' ? (
            <p className="mt-3 text-sm font-semibold text-emerald-300">You’re on the list. Watch your inbox.</p>
          ) : null}
        </div>

        <div className="mt-12 flex flex-col gap-6 border-t border-white/10 pt-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm text-white/80">
            <Link to="/branches" className="transition hover:text-white">
              Branches &amp; maps
            </Link>
            <Link to="/loans/personal" className="transition hover:text-white">
              Personal loans
            </Link>
            <Link to="/loans/business" className="transition hover:text-white">
              Business loans
            </Link>
            <Link to="/apply" className="transition hover:text-white">
              Apply
            </Link>
          </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="text-white/70">Follow us:</span>
              <a
                href="https://www.facebook.com/AmalgatedLendingOfficial"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:border-brand-primary/60 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                  <path d="M13.5 22v-8h2.68l.4-3.12H13.5V8.9c0-.9.25-1.52 1.55-1.52h1.66V4.6c-.29-.04-1.29-.12-2.45-.12-2.42 0-4.08 1.48-4.08 4.2v2.2H7.5V14h2.68v8h3.32Z" />
                </svg>
              </a>
              <a
                href="https://www.instagram.com/amalgated.lending?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=="
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:border-brand-primary/60 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <rect x="7" y="7" width="10" height="10" rx="3" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </a>
            </div>
        </div>
        <div className="mt-12 border-t border-white/10 pt-10 space-y-2">
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
      </div>
    </footer>
  )
}
