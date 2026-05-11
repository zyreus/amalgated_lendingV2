import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

export default function SubPageHeader() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const navLinks = [
    { to: '/', label: 'Home' },
    { label: 'Trust', isSection: true, sectionId: 'trust' },
    { label: 'Calculator', isSection: true, sectionId: 'calculator' },
    { label: 'News', isSection: true, sectionId: 'newsletter' },
    { to: '/loan-products', label: 'Loan Products' },
    { to: '/application-flow', label: 'Application Flow' },
    { to: '/privacy-policy', label: 'Privacy Policy' },
    { to: '/borrower/login', label: 'Borrower Log in' },
  ]

  const goToSection = (id) => {
    if (location.pathname === '/') {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    navigate('/')
    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-brand-secondary/60 bg-brand-background-alt/95 backdrop-blur-md">
      <div className="app-container flex items-center justify-between gap-2 py-3 sm:py-4">
        <Link to="/" className="flex shrink-0 items-center gap-3 transition hover:opacity-90">
          <img
            src="/amalgated-lending-logo.png"
            alt="Amalgated Lending"
            width={48}
            height={48}
            decoding="async"
            fetchpriority="high"
            className="h-11 w-11 object-contain sm:h-12 sm:w-12"
          />
          <span className="hidden flex-col leading-tight sm:flex sm:flex-col">
            <span className="text-sm font-semibold tracking-wide text-brand-text">Amalgated Lending</span>
            <span className="text-xs text-brand-text/70">Trusted Lending Solutions</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-5 xl:gap-6 text-sm font-medium text-brand-text lg:flex">
          {navLinks.map(({ to, label, isSection, sectionId }) =>
            isSection ? (
              <button key={label} type="button" onClick={() => goToSection(sectionId || 'hero')} className="nav-link">
                {label}
              </button>
            ) : (
              <Link key={to} to={to} className="nav-link">
                {label}
              </Link>
            )
          )}
          <Link
            to="/apply"
            className="inline-flex items-center justify-center rounded-full bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white shadow-brand-primary transition hover:bg-brand-primary-hover hover:shadow-[0_4px_12px_rgba(220,38,38,0.4)]"
          >
            Apply Now
          </Link>
        </nav>

        <button
          type="button"
          className="flex h-11 min-w-[44px] items-center justify-center rounded-lg text-brand-text hover:bg-black/10 lg:hidden"
          onClick={() => setMobileOpen((o) => !o)}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-brand-secondary/40 px-4 py-4 lg:hidden">
          {navLinks.map(({ to, label, isSection, sectionId }) =>
            isSection ? (
              <button
                key={label}
                type="button"
                className="block w-full rounded-lg px-3 py-2.5 text-left text-brand-text hover:bg-brand-primary/10 hover:text-brand-primary"
                onClick={() => {
                  goToSection(sectionId || 'hero')
                  setMobileOpen(false)
                }}
              >
                {label}
              </button>
            ) : (
              <Link key={to} to={to} className="block rounded-lg px-3 py-2.5 text-brand-text hover:bg-brand-primary/10 hover:text-brand-primary" onClick={() => setMobileOpen(false)}>
                {label}
              </Link>
            )
          )}
          <Link to="/apply" className="mt-3 block rounded-xl bg-brand-primary px-4 py-3 text-center text-sm font-semibold text-white hover:bg-brand-primary-hover" onClick={() => setMobileOpen(false)}>
            Apply Now
          </Link>
        </div>
      )}
    </header>
  )
}
