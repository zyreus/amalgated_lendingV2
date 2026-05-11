import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

const MAIN_OFFICE =
  'ACI IT and Corporate Centre, Doña Carolina Uykimpang Building, Cor. JP Laurel Avenue and Iñigo Street, Bajada, Davao City 8000'
const MAP_EMBED_SRC = `https://www.google.com/maps?q=${encodeURIComponent(MAIN_OFFICE)}&z=15&output=embed`

/**
 * Enterprise mega-menu rows — titles match public marketing; routes map to existing SPA pages.
 */
const MEGA_LOAN_PRODUCTS = [
  {
    to: '/loans/salary-loan',
    title: 'Salary Loan',
    desc: 'Payroll-backed financing for employed professionals with clear amortization.',
  },
  {
    to: '/loans/real-estate-mortgage',
    title: 'Collateral Loan',
    desc: 'Property-secured credit lines with structured appraisal and transparent charges.',
  },
  {
    to: '/loans/chattel-mortgage',
    title: 'Vehicle Loan',
    desc: 'Chattel mortgage for cars, trucks, and equipment with straightforward collateral terms.',
  },
]

const loanMegaCardClass =
  'group flex h-full flex-col rounded-xl border border-black/[0.07] bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-primary/35 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-[#111827]/80 dark:hover:border-brand-primary/45'

/** Resources dropdown — slightly softer border, longer hover transition, red accent on hover. */
const resourceNavCardClass =
  'group flex h-full min-h-[11.5rem] flex-col rounded-xl border border-black/[0.08] bg-white p-4 shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-brand-primary/55 hover:shadow-[0_12px_32px_rgba(0,0,0,0.1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary dark:border-white/10 dark:bg-[#111827]/85 dark:hover:border-brand-primary/60 dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.35)]'

/** Dropdown affordance only — no category icons in the navbar. */
function IconChevron({ open, className = '' }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`pointer-events-none inline-block h-3.5 w-3.5 shrink-0 self-center transition-transform duration-200 ${open ? 'rotate-180' : ''} ${className}`.trim()}
      aria-hidden
    >
      <path d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function megaPanelClass() {
  return 'rounded-2xl border border-black/[0.08] bg-white/[0.97] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.07)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0f172a]/96'
}

export default function Header() {
  const baseId = useId()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileAccordion, setMobileAccordion] = useState(null)
  const [openMenu, setOpenMenu] = useState(null)
  const [scrolled, setScrolled] = useState(false)
  const closeTimer = useRef(null)
  const headerRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  const scheduleClose = useCallback(() => {
    clearCloseTimer()
    closeTimer.current = window.setTimeout(() => setOpenMenu(null), 140)
  }, [clearCloseTimer])

  const openOrToggle = useCallback(
    (key) => {
      setOpenMenu((prev) => (prev === key ? null : key))
    },
    [],
  )

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpenMenu(null)
        setMobileOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!openMenu) return undefined
    const onDoc = (e) => {
      if (headerRef.current && !headerRef.current.contains(e.target)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [openMenu])

  useEffect(() => {
    setOpenMenu(null)
    setMobileOpen(false)
  }, [location.pathname])

  const scrollToSection = useCallback((id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const goToSection = useCallback(
    (id) => {
      if (location.pathname === '/') {
        scrollToSection(id)
        return
      }
      navigate('/')
      window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
    },
    [location.pathname, navigate, scrollToSection],
  )

  const goHome = useCallback(() => {
    if (location.pathname === '/') {
      scrollToSection('hero')
      return
    }
    navigate('/')
    window.setTimeout(() => document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
  }, [location.pathname, navigate, scrollToSection])

  function MegaPanel({ menuKey, align = 'left', widthClass, children }) {
    const isOpen = openMenu === menuKey
    const w =
      widthClass ||
      'w-[min(100vw-2rem,560px)] sm:w-[min(100vw-2rem,640px)]'
    return (
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            id={`${baseId}-${menuKey}-mega`}
            role="region"
            aria-label={`${menuKey} menu`}
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
            exit={reduceMotion ? {} : { opacity: 0, y: 6 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className={`absolute top-full z-[70] pt-3 ${align === 'right' ? 'right-0' : 'left-0'}`}
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleClose}
          >
            <div className={`${megaPanelClass()} ${w}`}>{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    )
  }

  const triggerBtn = (menuKey, label) => {
    const isOpen = openMenu === menuKey
    return (
      <button
        type="button"
        className={`nav-mega-trigger inline-flex items-center gap-1 rounded-md px-2 py-2 text-[12px] font-medium leading-none tracking-normal text-brand-text transition-colors duration-200 xl:gap-1.5 xl:rounded-lg xl:px-3 xl:py-2.5 xl:text-[13px] xl:tracking-wide 2xl:px-3.5 ${
          isOpen ? 'bg-black/[0.04] text-brand-primary' : 'hover:bg-black/[0.03] hover:text-brand-primary'
        }`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-controls={isOpen ? `${baseId}-${menuKey}-mega` : undefined}
        id={`${baseId}-${menuKey}-trigger`}
        onMouseEnter={() => {
          clearCloseTimer()
          setOpenMenu(menuKey)
        }}
        onMouseLeave={scheduleClose}
        onClick={() => openOrToggle(menuKey)}
      >
        <span className="whitespace-nowrap">{label}</span>
        <IconChevron
          open={isOpen}
          className={`text-brand-text/55 transition-[color,transform] duration-200 dark:text-white/55 ${isOpen ? 'text-brand-primary dark:text-brand-primary' : ''}`}
        />
      </button>
    )
  }

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-[60] w-full border-b transition-[box-shadow,background-color,border-color] duration-300 ${
        scrolled
          ? 'border-black/[0.07] bg-white/[0.94] shadow-[0_4px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1220]/94'
          : 'border-black/[0.06] bg-brand-background-alt/[0.92] backdrop-blur-md dark:border-white/10 dark:bg-[#0b1220]/90'
      }`}
    >
      <div className="app-container flex items-center justify-between gap-2 py-3 sm:gap-3 sm:py-3.5 lg:gap-4 lg:py-3.5 xl:gap-6 xl:py-4">
        <button
          type="button"
          onClick={goHome}
          className="group mr-1 flex min-w-0 max-w-[min(100%,14rem)] shrink-0 items-center gap-2 pr-0.5 text-left transition-opacity hover:opacity-[0.92] sm:max-w-[min(100%,16rem)] sm:gap-2.5 sm:pr-1 lg:mr-2 lg:max-w-[min(100%,17rem)] xl:mr-3 xl:max-w-none xl:gap-3.5 xl:pr-2 2xl:mr-4"
        >
          <img
            src="/amalgated-lending-logo.png"
            alt="Amalgated Lending"
            width={48}
            height={48}
            decoding="async"
            fetchPriority="high"
            className="h-9 w-9 shrink-0 object-contain sm:h-[2.75rem] sm:w-[2.75rem]"
          />
          <span className="flex min-w-0 flex-col border-l border-black/[0.08] pl-2.5 leading-tight sm:pl-3 dark:border-white/10">
            <span className="truncate text-[0.8125rem] font-bold tracking-tight text-brand-text sm:text-[0.9375rem] dark:text-white">
              Amalgated Lending
            </span>
            <span className="mt-0.5 truncate text-[10px] font-medium leading-snug text-brand-text/60 sm:text-[11px] dark:text-white/60">
              Trusted Lending · Davao &amp; Nationwide
            </span>
          </span>
        </button>

        <div className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
          <nav
            className="relative isolate z-0 flex min-w-0 max-w-full flex-nowrap items-center justify-center gap-x-1.5 px-0.5 sm:px-0 xl:gap-x-2 2xl:gap-x-2.5"
            aria-label="Main menu"
          >
            <div
            className="relative flex shrink-0 self-stretch items-center"
            onMouseEnter={() => {
              clearCloseTimer()
              setOpenMenu('trust')
            }}
            onMouseLeave={scheduleClose}
          >
            {triggerBtn('trust', 'Trust')}
            <MegaPanel menuKey="trust">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-primary">Security &amp; trust</p>
                  <p className="mt-2 text-sm leading-relaxed text-brand-text/75 dark:text-white/75">
                    Licensed operations, encrypted borrower portal, and transparent terms — scroll to our trust pillars on the
                    homepage.
                  </p>
                  <button
                    type="button"
                    className="mt-4 inline-flex rounded-full bg-brand-primary px-4 py-2 text-xs font-semibold text-white hover:bg-brand-primary-hover"
                    onClick={() => {
                      goToSection('trust')
                      setOpenMenu(null)
                    }}
                  >
                    View trust section
                  </button>
                </div>
                <div className="rounded-xl bg-black/[0.03] p-4 dark:bg-white/5">
                  <p className="text-xs font-semibold text-brand-text/60 dark:text-white/55">Also explore</p>
                  <ul className="mt-2 space-y-2 text-sm">
                    <li>
                      <button type="button" className="font-medium text-brand-primary hover:underline" onClick={() => { goToSection('customer-feedback'); setOpenMenu(null) }}>
                        Borrower testimonials
                      </button>
                    </li>
                    <li>
                      <Link to="/privacy-policy" className="font-medium text-brand-primary hover:underline" onClick={() => setOpenMenu(null)}>
                        Privacy &amp; data protection
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            </MegaPanel>
          </div>

            <div className="relative flex shrink-0 self-stretch items-center" onMouseEnter={() => { clearCloseTimer(); setOpenMenu('calculator') }} onMouseLeave={scheduleClose}>
            {triggerBtn('calculator', 'Calculator')}
            <MegaPanel menuKey="calculator">
              <div className="grid gap-6 sm:grid-cols-[1fr_220px]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-primary">Loan calculator</p>
                  <p className="mt-2 text-sm text-brand-text/75 dark:text-white/75">
                    Estimate monthly payments across products before you apply. On the homepage, the live calculator loads your
                    current product mix from our API.
                  </p>
                  <button
                    type="button"
                    className="mt-4 inline-flex rounded-full border border-black/15 px-4 py-2 text-xs font-semibold hover:border-brand-primary/40 hover:bg-brand-primary/5 dark:border-white/20"
                    onClick={() => {
                      goToSection('calculator')
                      setOpenMenu(null)
                    }}
                  >
                    Open calculator
                  </button>
                </div>
                <div className="flex flex-col justify-center rounded-xl border border-dashed border-black/15 p-4 text-center dark:border-white/15">
                  <p className="text-xs text-brand-text/60 dark:text-white/55">Need a product-specific page?</p>
                  <Link to="/loan-products" className="mt-2 text-sm font-semibold text-brand-primary hover:underline" onClick={() => setOpenMenu(null)}>
                    Loan products hub →
                  </Link>
                </div>
              </div>
            </MegaPanel>
          </div>

          <div className="relative flex shrink-0 self-stretch items-center" onMouseEnter={() => { clearCloseTimer(); setOpenMenu('news') }} onMouseLeave={scheduleClose}>
            {triggerBtn('news', 'News')}
            <MegaPanel menuKey="news">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-primary">News &amp; announcements</p>
              <p className="mt-2 text-sm text-brand-text/75 dark:text-white/75">
                Product updates, holiday advisories, and borrower reminders appear in our newsletter section.
              </p>
              <button
                type="button"
                className="mt-4 inline-flex rounded-full bg-brand-primary px-4 py-2 text-xs font-semibold text-white hover:bg-brand-primary-hover"
                onClick={() => {
                  goToSection('newsletter')
                  setOpenMenu(null)
                }}
              >
                Go to news section
              </button>
            </MegaPanel>
          </div>

          <div className="relative flex shrink-0 self-stretch items-center" onMouseEnter={() => { clearCloseTimer(); setOpenMenu('loans') }} onMouseLeave={scheduleClose}>
            {triggerBtn('loans', 'Loan products')}
            <MegaPanel menuKey="loans" align="right" widthClass="w-[min(100vw-2rem,680px)] sm:w-[min(100vw-2rem,820px)]">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-black/[0.06] pb-4 dark:border-white/10">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-primary">Loan products</p>
                  <p className="mt-1 text-sm text-brand-text/70 dark:text-white/70">
                    Choose a category — each link opens the product page with rates and requirements.
                  </p>
                </div>
              </div>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {MEGA_LOAN_PRODUCTS.map((row) => (
                  <li key={`${row.to}-${row.title}`}>
                    <Link to={row.to} className={loanMegaCardClass} onClick={() => setOpenMenu(null)}>
                      <span className="text-sm font-semibold text-brand-text group-hover:text-brand-primary dark:text-white">
                        {row.title}
                      </span>
                      <span className="mt-2 block flex-1 text-xs leading-relaxed text-brand-text/65 dark:text-white/62">{row.desc}</span>
                      <span className="mt-3 text-xs font-semibold text-brand-primary opacity-90 transition group-hover:opacity-100">
                        Explore →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-5 border-t border-black/[0.06] pt-4 dark:border-white/10">
                <Link
                  to="/loan-products"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white shadow-[0_3px_14px_rgba(220,38,38,0.28)] transition hover:bg-brand-primary-hover hover:shadow-[0_5px_20px_rgba(220,38,38,0.32)] sm:w-auto"
                  onClick={() => setOpenMenu(null)}
                >
                  View all loan products
                </Link>
              </div>
            </MegaPanel>
          </div>

          <div className="relative flex shrink-0 self-stretch items-center" onMouseEnter={() => { clearCloseTimer(); setOpenMenu('resources') }} onMouseLeave={scheduleClose}>
            {triggerBtn('resources', 'Resources')}
            <MegaPanel menuKey="resources" align="right" widthClass="w-[min(100vw-2rem,700px)] sm:w-[min(100vw-2rem,900px)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-primary">Resources</p>
              <p className="mt-1.5 text-[13px] leading-snug text-brand-text/55 dark:text-white/55">
                Guides, trust, and company — everything you need in one place.
              </p>
              <div className="mt-5 flex flex-col gap-5">
                <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-4">
                  <Link
                    to="/application-flow"
                    className={resourceNavCardClass}
                    onClick={() => setOpenMenu(null)}
                  >
                    <span className="text-sm font-semibold tracking-tight text-brand-text group-hover:text-brand-primary dark:text-white">
                      Application flow
                    </span>
                    <span className="mt-2 block text-xs leading-relaxed text-brand-text/65 dark:text-white/62">
                      From eligibility to disbursement — know every step before you sign.
                    </span>
                    <span className="mt-auto pt-3 text-xs font-semibold text-brand-primary">Open guide →</span>
                  </Link>
                  <Link
                    to="/privacy-policy"
                    className={resourceNavCardClass}
                    onClick={() => setOpenMenu(null)}
                  >
                    <span className="text-sm font-semibold tracking-tight text-brand-text group-hover:text-brand-primary dark:text-white">
                      Privacy policy
                    </span>
                    <span className="mt-2 block text-xs leading-relaxed text-brand-text/65 dark:text-white/62">
                      How we handle personal data, cookies, and your rights as a borrower.
                    </span>
                    <span className="mt-auto pt-3 text-xs font-semibold text-brand-primary">Read policy →</span>
                  </Link>
                  <button
                    type="button"
                    className={`${resourceNavCardClass} w-full text-left`}
                    onClick={() => {
                      setOpenMenu(null)
                      goToSection('about-us')
                    }}
                  >
                    <span className="text-sm font-semibold tracking-tight text-brand-text group-hover:text-brand-primary dark:text-white">
                      About Us
                    </span>
                    <span className="mt-1.5 block text-xs font-medium leading-snug text-brand-primary/95 dark:text-brand-primary/90">
                      Learn who we are, our mission, values, and commitment to transparent lending.
                    </span>
                    <span className="mt-2 block text-xs leading-relaxed text-brand-text/65 dark:text-white/62">
                      Licensed financial solutions focused on secure, transparent, and borrower-friendly services.
                    </span>
                    <span className="mt-auto pt-3 text-xs font-semibold text-brand-primary">Explore company →</span>
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:gap-4">
                  <div className="flex min-h-[9.5rem] flex-col rounded-xl border border-brand-primary/20 bg-gradient-to-br from-brand-primary/[0.11] via-white to-white p-4 transition-colors duration-300 dark:border-brand-primary/25 dark:from-brand-primary/18 dark:via-[#111827] dark:to-[#0f172a]">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-primary">Why Amalgated</p>
                    <p className="mt-2 text-sm font-semibold text-brand-text dark:text-white">Transparent lending for real life</p>
                    <p className="mt-2 text-xs leading-relaxed text-brand-text/70 dark:text-white/68">
                      Licensed operations, documented fees, and a secure borrower portal so you always know where you stand.
                    </p>
                  </div>
                  <div className="flex min-h-[9.5rem] flex-col justify-between rounded-xl border border-black/[0.08] bg-black/[0.02] p-4 transition-colors duration-300 dark:border-white/10 dark:bg-white/[0.04]">
                    <div>
                      <p className="text-base font-semibold tracking-tight text-brand-text dark:text-white">Simple. Fast. Secure.</p>
                      <p className="mt-2 text-xs leading-relaxed text-brand-text/65 dark:text-white/65">
                        Apply online, upload requirements safely, and track status without guesswork.
                      </p>
                    </div>
                    <Link
                      to="/application-flow"
                      className="mt-4 inline-flex w-fit items-center rounded-lg border border-brand-primary/35 bg-white px-3 py-2 text-xs font-semibold text-brand-primary shadow-sm transition duration-300 hover:bg-brand-primary/5 dark:bg-[#111827] dark:hover:bg-brand-primary/10"
                      onClick={() => setOpenMenu(null)}
                    >
                      Learn more
                    </Link>
                  </div>
                </div>
              </div>
            </MegaPanel>
          </div>

            <span className="h-4 w-px shrink-0 self-center bg-black/[0.12] dark:bg-white/15" aria-hidden />

            <div className="relative flex shrink-0 self-stretch items-center" onMouseEnter={() => { clearCloseTimer(); setOpenMenu('branches') }} onMouseLeave={scheduleClose}>
            {triggerBtn('branches', 'Branches')}
            <MegaPanel menuKey="branches" align="right">
              <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-primary">Visit us</p>
                  <p className="mt-2 text-sm font-medium text-brand-text dark:text-white">Main office — Davao</p>
                  <p className="mt-1 text-xs leading-relaxed text-brand-text/70 dark:text-white/65">{MAIN_OFFICE}</p>
                  <p className="mt-3 text-xs text-brand-text/60 dark:text-white/55">
                    <span className="font-semibold text-brand-text dark:text-white">Hours:</span> Mon–Fri · 8:00 AM – 5:00 PM (PH)
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      className="rounded-full bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-primary-hover"
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(MAIN_OFFICE)}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setOpenMenu(null)}
                    >
                      Open in Google Maps
                    </a>
                    <Link to="/branches" className="rounded-full border border-black/15 px-3 py-1.5 text-xs font-semibold hover:bg-black/[0.04] dark:border-white/20" onClick={() => setOpenMenu(null)}>
                      All branches
                    </Link>
                  </div>
                </div>
                <div className="overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
                  <iframe title="Amalgated Lending Davao office map" className="h-44 w-full border-0 sm:h-full sm:min-h-[200px]" loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={MAP_EMBED_SRC} />
                </div>
              </div>
            </MegaPanel>
          </div>

          <Link
            to="/borrower/login"
            className="relative z-0 inline-flex min-h-[44px] shrink-0 self-stretch items-center justify-center whitespace-nowrap rounded-lg border border-black/15 bg-brand-primary px-3 py-2 text-[12px] font-semibold tracking-wide text-white shadow-[0_4px_20px_rgba(220,38,38,0.38)] transition hover:bg-brand-primary-hover hover:shadow-[0_6px_26px_rgba(220,38,38,0.42)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary xl:rounded-xl xl:px-4 xl:text-[13px] 2xl:px-5"
          >
            Borrower login
          </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2.5 lg:hidden">
          <Link
            to="/borrower/login"
            className="rounded-xl border border-black/15 bg-brand-primary px-3.5 py-2 text-xs font-semibold tracking-wide text-white shadow-[0_4px_18px_rgba(220,38,38,0.35)] sm:text-[13px]"
          >
            Log in
          </Link>
          <button
            type="button"
            className="flex h-11 min-w-[44px] items-center justify-center rounded-lg text-brand-text hover:bg-black/10 dark:text-white dark:hover:bg-white/10"
            onClick={() => setMobileOpen((o) => !o)}
            aria-expanded={mobileOpen}
            aria-controls={`${baseId}-mobile-nav`}
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
      </div>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.nav
            id={`${baseId}-mobile-nav`}
            className="border-t border-black/10 bg-white/98 backdrop-blur-xl lg:hidden dark:border-white/10 dark:bg-[#0b1220]/98"
            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
            animate={reduceMotion ? {} : { opacity: 1, height: 'auto' }}
            exit={reduceMotion ? {} : { opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            aria-label="Mobile"
          >
            <div className="app-container max-h-[min(80vh,640px)] space-y-1 overflow-y-auto py-4">
              {[
                { key: 'trust', title: 'Trust', body: 'Security, licensing, and testimonials on the homepage.', onGo: () => goToSection('trust') },
                { key: 'calculator', title: 'Calculator', body: 'Live payment estimates for our loan products.', onGo: () => goToSection('calculator') },
                { key: 'news', title: 'News', body: 'Announcements and newsletter signup.', onGo: () => goToSection('newsletter') },
              ].map((sec) => {
                const open = mobileAccordion === sec.key
                return (
                  <div key={sec.key} className="rounded-xl border border-black/8 dark:border-white/10">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-3.5 text-left text-[13px] font-semibold tracking-wide text-brand-text dark:text-white"
                      aria-expanded={open}
                      onClick={() => setMobileAccordion(open ? null : sec.key)}
                    >
                      <span>{sec.title}</span>
                      <IconChevron
                        open={open}
                        className={`text-brand-text/55 dark:text-white/55 ${open ? 'text-brand-primary dark:text-brand-primary' : ''}`}
                      />
                    </button>
                    {open ? (
                      <div className="border-t border-black/8 px-3 pb-3 pt-1 text-xs text-brand-text/75 dark:border-white/10 dark:text-white/70">
                        <p>{sec.body}</p>
                        <button type="button" className="mt-2 font-semibold text-brand-primary hover:underline" onClick={() => { sec.onGo(); setMobileOpen(false) }}>
                          Go →
                        </button>
                      </div>
                    ) : null}
                  </div>
                )
              })}

              <div className="rounded-xl border border-black/8 dark:border-white/10">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-3.5 text-left text-[13px] font-semibold tracking-wide text-brand-text dark:text-white"
                  aria-expanded={mobileAccordion === 'loans'}
                  onClick={() => setMobileAccordion(mobileAccordion === 'loans' ? null : 'loans')}
                >
                  <span>Loan products</span>
                  <IconChevron
                    open={mobileAccordion === 'loans'}
                    className={`text-brand-text/55 dark:text-white/55 ${mobileAccordion === 'loans' ? 'text-brand-primary dark:text-brand-primary' : ''}`}
                  />
                </button>
                {mobileAccordion === 'loans' ? (
                  <ul className="border-t border-black/8 px-2 py-2 dark:border-white/10">
                    {MEGA_LOAN_PRODUCTS.map((row) => (
                      <li key={`${row.to}-${row.title}`}>
                        <Link to={row.to} className="block rounded-lg px-2 py-2.5 text-sm hover:bg-brand-primary/10" onClick={() => setMobileOpen(false)}>
                          <span className="font-semibold">{row.title}</span>
                          <span className="mt-0.5 block text-xs text-brand-text/65 dark:text-white/60">{row.desc}</span>
                        </Link>
                      </li>
                    ))}
                    <li className="mt-1 border-t border-black/8 pt-2 dark:border-white/10">
                      <Link
                        to="/loan-products"
                        className="block rounded-lg bg-brand-primary px-2 py-2.5 text-center text-sm font-semibold text-white"
                        onClick={() => setMobileOpen(false)}
                      >
                        View all loan products
                      </Link>
                    </li>
                  </ul>
                ) : null}
              </div>

              <div className="rounded-xl border border-black/8 dark:border-white/10">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-3.5 text-left text-[13px] font-semibold tracking-wide text-brand-text dark:text-white"
                  aria-expanded={mobileAccordion === 'resources'}
                  onClick={() => setMobileAccordion(mobileAccordion === 'resources' ? null : 'resources')}
                >
                  <span>Resources</span>
                  <IconChevron
                    open={mobileAccordion === 'resources'}
                    className={`text-brand-text/55 dark:text-white/55 ${mobileAccordion === 'resources' ? 'text-brand-primary dark:text-brand-primary' : ''}`}
                  />
                </button>
                {mobileAccordion === 'resources' ? (
                  <div className="border-t border-black/8 space-y-2.5 px-2 py-3 dark:border-white/10">
                    <Link to="/application-flow" className="block rounded-lg px-2 py-2 text-sm font-semibold hover:bg-brand-primary/10" onClick={() => setMobileOpen(false)}>
                      Application flow
                    </Link>
                    <Link to="/privacy-policy" className="block rounded-lg px-2 py-2 text-sm font-semibold hover:bg-brand-primary/10" onClick={() => setMobileOpen(false)}>
                      Privacy policy
                    </Link>
                    <button
                      type="button"
                      className="block w-full rounded-xl border border-black/[0.08] bg-white px-2.5 py-3 text-left transition hover:border-brand-primary/45 hover:shadow-sm dark:border-white/10 dark:bg-[#111827]/60 dark:hover:border-brand-primary/50"
                      onClick={() => {
                        setMobileOpen(false)
                        goToSection('about-us')
                      }}
                    >
                      <span className="text-sm font-semibold text-brand-text dark:text-white">About Us</span>
                      <span className="mt-1 block text-[11px] font-medium leading-snug text-brand-primary">
                        Learn who we are, our mission, values, and commitment to transparent lending.
                      </span>
                      <span className="mt-1.5 block text-[11px] leading-relaxed text-brand-text/70 dark:text-white/65">
                        Licensed financial solutions focused on secure, transparent, and borrower-friendly services.
                      </span>
                      <span className="mt-2 text-xs font-semibold text-brand-primary">Explore company →</span>
                    </button>
                    <p className="rounded-lg bg-brand-primary/10 px-2 py-2 text-xs leading-relaxed text-brand-text/80 dark:text-white/75">
                      <span className="font-semibold text-brand-text dark:text-white">Simple. Fast. Secure.</span> Apply online and track your application in the borrower portal.
                    </p>
                    <Link to="/application-flow" className="block rounded-lg px-2 py-2 text-sm font-semibold text-brand-primary hover:underline" onClick={() => setMobileOpen(false)}>
                      Learn more
                    </Link>
                  </div>
                ) : null}
              </div>

              <Link to="/branches" className="block rounded-xl border border-black/8 px-3 py-3 text-sm font-semibold hover:bg-black/[0.04] dark:border-white/10 dark:hover:bg-white/5" onClick={() => setMobileOpen(false)}>
                Branches &amp; maps
              </Link>

              <button type="button" className="block w-full rounded-lg px-3 py-2.5 text-left text-sm text-brand-text hover:bg-brand-primary/10 dark:text-white" onClick={() => { goHome(); setMobileOpen(false) }}>
                Home
              </button>
              <Link
                to="/borrower/login"
                className="block w-full rounded-xl border border-black/15 bg-brand-primary py-3.5 text-center text-[13px] font-semibold tracking-wide text-white shadow-[0_4px_20px_rgba(220,38,38,0.38)]"
                onClick={() => setMobileOpen(false)}
              >
                Borrower login
              </Link>
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  )
}
