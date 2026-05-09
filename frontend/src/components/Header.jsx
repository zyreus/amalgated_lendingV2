import { useCallback, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()

  const scrollToSection = useCallback((id) => {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const goToSection = useCallback((id) => {
    if (location.pathname === '/') {
      scrollToSection(id)
      return
    }
    navigate('/')
    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
  }, [location.pathname, navigate, scrollToSection])

  const goHome = useCallback(() => {
    if (location.pathname === '/') {
      scrollToSection('hero')
      return
    }
    navigate('/')
    window.setTimeout(() => {
      document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
  }, [location.pathname, navigate, scrollToSection])

  return (
    <header className="sticky top-0 z-40 w-full border-b border-brand-secondary/60 bg-brand-background-alt/95 backdrop-blur-md">
      <div className="app-container flex items-center justify-between gap-2 py-3 sm:py-4">
        <button
          type="button"
          onClick={goHome}
          className="flex shrink-0 items-center gap-3 transition hover:opacity-90 text-left"
        >
          <img src="/amalgated-lending-logo.png" alt="Amalgated Lending" className="h-11 w-11 object-contain sm:h-12 sm:w-12" />
          <span className="hidden flex-col leading-tight sm:flex sm:flex-col">
            <span className="text-sm font-semibold tracking-wide text-brand-text">Amalgated Lending</span>
            <span className="text-xs text-brand-text/70">Trusted Lending Solutions</span>
          </span>
        </button>

        <nav className="hidden items-center gap-5 xl:gap-6 text-sm font-medium text-brand-text lg:flex">
          <span className="text-brand-text">Hi</span>
          <button type="button" onClick={goHome} className="nav-link">Home</button>
          <button type="button" onClick={() => goToSection('trust')} className="nav-link">Trust</button>
          <button type="button" onClick={() => goToSection('calculator')} className="nav-link">Calculator</button>
          <button type="button" onClick={() => goToSection('newsletter')} className="nav-link">News</button>
          <Link to="/loan-products" className="nav-link">Loan Products</Link>
          <Link to="/application-flow" className="nav-link">Application Flow</Link>
          <Link to="/privacy-policy" className="nav-link">Privacy Policy</Link>
          <Link to="/borrower/login" className="nav-link">Borrower Log in</Link>
          <Link
            to="/borrower/login"
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

      <AnimatePresence>
      {mobileOpen && (
        <motion.div
          className="border-t border-brand-secondary/40 px-4 py-4 lg:hidden"
          initial={reduceMotion ? false : { opacity: 0, y: -8 }}
          animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
          exit={reduceMotion ? {} : { opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-brand-text hover:bg-brand-primary/10 hover:text-brand-primary">
            <span className="shrink-0 text-sm font-medium">Hi</span>
            <button type="button" className="flex-1 text-left text-sm font-medium" onClick={() => { goHome(); setMobileOpen(false) }}>Home</button>
          </div>
          <button type="button" className="block w-full rounded-lg px-3 py-2.5 text-left text-brand-text hover:bg-brand-primary/10 hover:text-brand-primary" onClick={() => { goToSection('trust'); setMobileOpen(false) }}>Trust &amp; Security</button>
          <button type="button" className="block w-full rounded-lg px-3 py-2.5 text-left text-brand-text hover:bg-brand-primary/10 hover:text-brand-primary" onClick={() => { goToSection('calculator'); setMobileOpen(false) }}>Loan Calculator</button>
          <button type="button" className="block w-full rounded-lg px-3 py-2.5 text-left text-brand-text hover:bg-brand-primary/10 hover:text-brand-primary" onClick={() => { goToSection('newsletter'); setMobileOpen(false) }}>News &amp; Announcements</button>
          <Link to="/loan-products" className="block w-full rounded-lg px-3 py-2.5 text-left text-brand-text hover:bg-brand-primary/10 hover:text-brand-primary" onClick={() => setMobileOpen(false)}>Loan Products</Link>
          <Link to="/application-flow" className="block w-full rounded-lg px-3 py-2.5 text-left text-brand-text hover:bg-brand-primary/10 hover:text-brand-primary" onClick={() => setMobileOpen(false)}>Application Flow</Link>
          <Link to="/privacy-policy" className="block w-full rounded-lg px-3 py-2.5 text-left text-brand-text hover:bg-brand-primary/10 hover:text-brand-primary" onClick={() => setMobileOpen(false)}>Privacy Policy</Link>
          <Link to="/borrower/login" className="block w-full rounded-lg px-3 py-2.5 text-left text-brand-text hover:bg-brand-primary/10 hover:text-brand-primary" onClick={() => setMobileOpen(false)}>Borrower Log in</Link>
          <Link to="/borrower/login" className="mt-3 block w-full rounded-xl bg-brand-primary px-4 py-3 text-center text-sm font-semibold text-white" onClick={() => setMobileOpen(false)}>Apply Now</Link>
        </motion.div>
      )}
      </AnimatePresence>
    </header>
  )
}
