import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Building2,
  Calculator,
  Car,
  ChevronDown,
  FileText,
  Home,
  Landmark,
  LockKeyhole,
  LogIn,
  MapPin,
  Menu,
  Newspaper,
  PiggyBank,
  Plane,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react'

const SECTION_NAV_ITEMS = [
  {
    key: 'trust',
    label: 'Trust',
    sectionId: 'trust',
    icon: ShieldCheck,
    description: 'Licensing, security, and borrower protection.',
  },
  {
    key: 'calculator',
    label: 'Calculator',
    sectionId: 'calculator',
    icon: Calculator,
    description: 'Estimate payments before applying.',
  },
  {
    key: 'news',
    label: 'News',
    sectionId: 'newsletter',
    icon: Newspaper,
    description: 'Announcements and lending updates.',
  },
]

const RESOURCE_LINKS = [
  { label: 'Resources', to: '/application-flow', icon: FileText, description: 'Application flow and borrower guidance.' },
  { label: 'Branches', to: '/branches', icon: MapPin, description: 'Davao HQ and nationwide service coverage.' },
]

const LOAN_PRODUCTS = [
  {
    title: 'Salary Loan',
    description: 'Payroll-backed financing for employed professionals with predictable monthly amortization.',
    to: '/loan-products/salary-loan',
    icon: Banknote,
  },
  {
    title: 'Chattel Mortgage Loan',
    description: 'Vehicle and equipment-backed loan options with structured collateral review.',
    to: '/loan-products/chattel-mortgage',
    icon: Car,
  },
  {
    title: 'Real Estate Mortgage Loan',
    description: 'Property-secured lending with appraisal-led terms and transparent fees.',
    to: '/loan-products/real-estate-mortgage',
    icon: Home,
  },
  {
    title: 'Appliance Loan',
    description: 'Flexible financing for household essentials and approved partner purchases.',
    to: '/loan-products/appliance-loan',
    icon: Smartphone,
  },
  {
    title: 'SSS Pension Loan',
    description: 'Dedicated pensioner financing with verification support and secure document upload.',
    to: '/loan-products/sss-pension-loan',
    icon: PiggyBank,
  },
  {
    title: 'GSIS Pension Loan',
    description: 'Pension-based financing pathway for qualified GSIS members and retirees.',
    to: '/loan-products/gsis-pension-loan',
    icon: Landmark,
  },
  {
    title: 'Travel Assistance Loan',
    description: 'Travel cost financing for OFWs, seafarers, students, tourists, and professionals.',
    to: '/loan-products/travel-assistance-loan',
    icon: Plane,
  },
]

function isRouteActive(pathname, to) {
  if (to === '/') return pathname === '/'
  return pathname === to || pathname.startsWith(`${to}/`)
}

function HeaderButton({ children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`group relative inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-2xl px-3 text-[13px] font-medium text-slate-700 outline-none transition duration-200 hover:bg-white/75 hover:text-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white 2xl:min-h-11 2xl:gap-2 2xl:px-3.5 2xl:text-sm ${className}`}
      {...props}
    >
      {children}
      <span className="absolute inset-x-3 -bottom-0.5 h-0.5 origin-left scale-x-0 rounded-full bg-gradient-to-r from-brand-primary to-orange-400 transition-transform duration-300 group-hover:scale-x-100 group-focus-visible:scale-x-100" />
    </button>
  )
}

function HeaderLink({ to, active, children, className = '', onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`group relative inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-2xl px-3 text-[13px] font-medium outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-brand-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white 2xl:min-h-11 2xl:gap-2 2xl:px-3.5 2xl:text-sm ${
        active
          ? 'bg-brand-primary/10 text-brand-primary'
          : 'text-slate-700 hover:bg-white/75 hover:text-brand-primary'
      } ${className}`}
    >
      {children}
      <span
        className={`absolute inset-x-3 -bottom-0.5 h-0.5 origin-left rounded-full bg-gradient-to-r from-brand-primary to-orange-400 transition-transform duration-300 ${
          active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100 group-focus-visible:scale-x-100'
        }`}
      />
    </Link>
  )
}

function BrandMark({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-0 max-w-[17rem] items-center gap-3 rounded-3xl p-1.5 pr-3 text-left outline-none transition hover:bg-white/70 focus-visible:ring-2 focus-visible:ring-brand-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:max-w-[21rem] xl:max-w-[19rem] 2xl:max-w-[23rem]"
      aria-label="Go to Amalgated Lending homepage"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white shadow-[0_12px_30px_rgba(15,23,42,0.10)] ring-1 ring-slate-200/80 transition duration-300 group-hover:-translate-y-0.5 group-hover:ring-brand-primary/30 sm:h-14 sm:w-14">
        <img
          src="/amalgated-lending-logo.png"
          alt=""
          width={52}
          height={52}
          decoding="async"
          fetchPriority="high"
          className="h-10 w-10 rounded-xl object-contain sm:h-12 sm:w-12"
        />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-base font-bold tracking-tight text-slate-950 sm:text-xl xl:text-lg 2xl:text-xl">
          Amalgated Lending Inc.
        </span>
        <span className="mt-0.5 hidden truncate text-sm font-medium text-slate-500 sm:block xl:text-xs 2xl:text-sm">
          Digital Lending • Davao HQ • Nationwide Service
        </span>
      </span>
    </button>
  )
}

function LoanMegaMenu({ id, isOpen, reduceMotion, onClose, onEnter, onLeave }) {
  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          id={id}
          role="region"
          aria-label="Loan products mega menu"
          initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.98 }}
          animate={reduceMotion ? {} : { opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? {} : { opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="absolute left-1/2 top-full z-[80] hidden w-[min(94vw,1080px)] -translate-x-1/2 pt-4 xl:block"
          onPointerEnter={onEnter}
          onPointerLeave={onLeave}
        >
          <div className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/95 shadow-[0_28px_80px_rgba(15,23,42,0.18)] ring-1 ring-brand-primary/10 backdrop-blur-2xl">
            <div className="grid gap-0 lg:grid-cols-[0.85fr_1.8fr]">
              <div className="bg-gradient-to-br from-brand-primary via-red-600 to-orange-500 p-6 text-white">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/25">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Borrower-first products
                </div>
                <h2 className="mt-5 text-2xl font-bold tracking-tight">Choose the right financing path.</h2>
                <p className="mt-3 text-sm leading-6 text-white/82">
                  Explore transparent loan categories, compare requirements, then continue through the secure borrower portal.
                </p>
                <div className="mt-6 rounded-2xl bg-white/12 p-4 ring-1 ring-white/20">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Service promise</p>
                  <p className="mt-2 text-sm font-medium">Davao-based support with nationwide digital processing.</p>
                </div>
                <Link
                  to="/loan-products"
                  onClick={onClose}
                  className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-brand-primary shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  View all products
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
                {LOAN_PRODUCTS.map((product) => {
                  const Icon = product.icon
                  return (
                    <Link
                      key={product.title}
                      to={product.to}
                      onClick={onClose}
                      className="group flex min-h-[13rem] flex-col rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/80 p-4 outline-none transition duration-300 hover:-translate-y-1 hover:border-brand-primary/35 hover:shadow-[0_18px_40px_rgba(15,23,42,0.10)] focus-visible:ring-2 focus-visible:ring-brand-primary/35"
                    >
                      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-primary/10 text-brand-primary transition group-hover:bg-brand-primary group-hover:text-white">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="mt-4 text-sm font-bold tracking-tight text-slate-950 group-hover:text-brand-primary">
                        {product.title}
                      </span>
                      <span className="mt-2 flex-1 text-xs leading-5 text-slate-600">{product.description}</span>
                      <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-brand-primary">
                        Apply now
                        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function MobileDrawer({ open, id, reduceMotion, close, goToSection, goHome }) {
  const drawerLinks = useMemo(
    () => [
      ...SECTION_NAV_ITEMS.map((item) => ({ ...item, type: 'section' })),
      { key: 'loan-products', label: 'Loan Products', to: '/loan-products', icon: Landmark, description: 'Browse every lending product.', type: 'route' },
      ...RESOURCE_LINKS.map((item) => ({ ...item, key: item.label.toLowerCase(), type: 'route' })),
    ],
    [],
  )

  useEffect(() => {
    if (!open) return undefined
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close navigation overlay"
            className="fixed inset-0 z-[70] bg-slate-950/35 backdrop-blur-sm xl:hidden"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={reduceMotion ? {} : { opacity: 1 }}
            exit={reduceMotion ? {} : { opacity: 0 }}
            onClick={close}
          />
          <motion.nav
            id={id}
            aria-label="Mobile navigation"
            className="fixed bottom-0 right-0 top-0 z-[80] flex w-[min(92vw,420px)] flex-col overflow-hidden border-l border-white/70 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.28)] xl:hidden"
            initial={reduceMotion ? false : { x: '100%' }}
            animate={reduceMotion ? {} : { x: 0 }}
            exit={reduceMotion ? {} : { x: '100%' }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4">
              <div>
                <p className="text-sm font-bold text-slate-950">Amalgated Lending</p>
                <p className="text-xs font-medium text-slate-500">Secure borrower navigation</p>
              </div>
              <button
                type="button"
                onClick={close}
                className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand-primary/35"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-5">
              <button
                type="button"
                onClick={() => {
                  goHome()
                  close()
                }}
                className="flex w-full items-center gap-3 rounded-3xl bg-slate-50 px-4 py-4 text-left transition hover:bg-brand-primary/8"
              >
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-brand-primary shadow-sm">
                  <Building2 className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-bold text-slate-950">Home</span>
                  <span className="text-xs text-slate-500">Return to main website</span>
                </span>
              </button>

              {drawerLinks.map((item) => {
                const Icon = item.icon
                if (item.type === 'section') {
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        goToSection(item.sectionId)
                        close()
                      }}
                      className="flex w-full items-center gap-3 rounded-3xl px-4 py-3 text-left transition hover:bg-brand-primary/8 focus-visible:ring-2 focus-visible:ring-brand-primary/35"
                    >
                      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-primary/10 text-brand-primary">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-slate-900">{item.label}</span>
                        <span className="line-clamp-1 text-xs text-slate-500">{item.description}</span>
                      </span>
                    </button>
                  )
                }
                return (
                  <Link
                    key={item.key}
                    to={item.to}
                    onClick={close}
                    className="flex w-full items-center gap-3 rounded-3xl px-4 py-3 text-left transition hover:bg-brand-primary/8 focus-visible:ring-2 focus-visible:ring-brand-primary/35"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-primary/10 text-brand-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-slate-900">{item.label}</span>
                      <span className="line-clamp-1 text-xs text-slate-500">{item.description}</span>
                    </span>
                  </Link>
                )
              })}

              <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-3">
                <p className="px-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Loan products</p>
                <div className="mt-2 grid gap-2">
                  {LOAN_PRODUCTS.map((product) => {
                    const Icon = product.icon
                    return (
                      <Link
                        key={product.title}
                        to={product.to}
                        onClick={close}
                        className="flex items-center gap-3 rounded-2xl bg-white px-3 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:text-brand-primary"
                      >
                        <Icon className="h-4 w-4 text-brand-primary" />
                        <span>{product.title}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="border-t border-slate-200/80 p-4">
              <div className="grid gap-3">
                <Link
                  to="/borrower/login"
                  onClick={close}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-primary via-red-600 to-orange-500 px-5 text-sm font-bold text-white shadow-[0_16px_36px_rgba(217,34,67,0.28)] transition hover:-translate-y-0.5"
                >
                  <LogIn className="h-4 w-4" />
                  Borrower Login
                </Link>
                <Link
                  to="/admin/login"
                  onClick={close}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-brand-primary/30 hover:text-brand-primary"
                >
                  <LockKeyhole className="h-4 w-4" />
                  Admin Portal
                </Link>
              </div>
            </div>
          </motion.nav>
        </>
      ) : null}
    </AnimatePresence>
  )
}

export default function Header() {
  const baseId = useId()
  const headerRef = useRef(null)
  const closeTimer = useRef(null)
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loanMenuOpen, setLoanMenuOpen] = useState(false)
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
    closeTimer.current = window.setTimeout(() => setLoanMenuOpen(false), 150)
  }, [clearCloseTimer])

  const openLoanMenu = useCallback(() => {
    clearCloseTimer()
    setLoanMenuOpen(true)
  }, [clearCloseTimer])

  const closeLoanMenu = useCallback(() => {
    clearCloseTimer()
    setLoanMenuOpen(false)
  }, [clearCloseTimer])

  const scrollToSection = useCallback((id) => {
    const tryScroll = (attempt = 0) => {
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
      if (attempt < 15) window.setTimeout(() => tryScroll(attempt + 1), 80)
    }
    tryScroll()
  }, [])

  const goToSection = useCallback(
    (id) => {
      closeLoanMenu()
      if (location.pathname === '/') {
        scrollToSection(id)
        return
      }
      navigate('/')
      window.setTimeout(() => scrollToSection(id), 120)
    },
    [closeLoanMenu, location.pathname, navigate, scrollToSection],
  )

  const goHome = useCallback(() => {
    closeLoanMenu()
    if (location.pathname === '/') {
      scrollToSection('hero')
      return
    }
    navigate('/')
    window.setTimeout(() => scrollToSection('hero'), 120)
  }, [closeLoanMenu, location.pathname, navigate, scrollToSection])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeLoanMenu()
        setMobileOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeLoanMenu])

  useEffect(() => {
    if (!loanMenuOpen) return undefined
    const onPointerDown = (event) => {
      if (headerRef.current?.contains(event.target)) return
      closeLoanMenu()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [closeLoanMenu, loanMenuOpen])

  useEffect(() => {
    closeLoanMenu()
    setMobileOpen(false)
  }, [closeLoanMenu, location.pathname])

  const loanMenuId = `${baseId}-loan-products-menu`
  const mobileMenuId = `${baseId}-mobile-menu`

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-[60] w-full border-b transition-all duration-300 ${
        scrolled
          ? 'border-white/70 bg-white/82 shadow-[0_18px_60px_rgba(15,23,42,0.10)] backdrop-blur-2xl'
          : 'border-white/55 bg-white/64 backdrop-blur-xl'
      }`}
    >
      <div className="app-container relative">
        <div className="flex min-h-[72px] items-center gap-3 py-2.5 xl:grid xl:min-h-[86px] xl:grid-cols-[minmax(270px,0.72fr)_minmax(560px,1fr)_auto] xl:gap-4 2xl:min-h-[92px] 2xl:grid-cols-[minmax(320px,0.9fr)_minmax(650px,1.15fr)_auto] 2xl:gap-6">
          <div className="min-w-0">
            <BrandMark onClick={goHome} />
          </div>

          <nav className="relative hidden items-center justify-center xl:flex" aria-label="Primary navigation">
            <div className="inline-flex items-center gap-0.5 rounded-[1.4rem] border border-white/80 bg-white/58 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_30px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/50 backdrop-blur-xl 2xl:gap-1">
              {SECTION_NAV_ITEMS.map((item) => {
                return (
                  <HeaderButton key={item.key} onClick={() => goToSection(item.sectionId)} aria-label={`Go to ${item.label}`}>
                    <span>{item.label}</span>
                  </HeaderButton>
                )
              })}

              <div className="relative" onPointerEnter={openLoanMenu} onPointerLeave={scheduleClose}>
                <HeaderButton
                  aria-haspopup="true"
                  aria-expanded={loanMenuOpen}
                  aria-controls={loanMenuOpen ? loanMenuId : undefined}
                  onClick={() => setLoanMenuOpen((open) => !open)}
                  onFocus={openLoanMenu}
                  className={loanMenuOpen ? 'bg-brand-primary/10 text-brand-primary' : ''}
                >
                  <span>Loan Products</span>
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${loanMenuOpen ? 'rotate-180' : ''}`} />
                </HeaderButton>
              </div>

              {RESOURCE_LINKS.map((item) => {
                return (
                  <HeaderLink
                    key={item.to}
                    to={item.to}
                    active={isRouteActive(location.pathname, item.to)}
                    onClick={closeLoanMenu}
                  >
                    <span>{item.label}</span>
                  </HeaderLink>
                )
              })}
            </div>

            <LoanMegaMenu
              id={loanMenuId}
              isOpen={loanMenuOpen}
              reduceMotion={reduceMotion}
              onClose={closeLoanMenu}
              onEnter={openLoanMenu}
              onLeave={scheduleClose}
            />
          </nav>

          <div className="ml-auto flex items-center justify-end gap-2 xl:ml-0">
            <Link
              to="/borrower/login"
              className="hidden min-h-11 items-center gap-2 rounded-2xl bg-gradient-to-r from-brand-primary via-red-600 to-orange-500 px-5 text-sm font-bold text-white shadow-[0_16px_36px_rgba(217,34,67,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_42px_rgba(246,157,57,0.28)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary/35 sm:inline-flex"
            >
              <LogIn className="h-4 w-4" />
              Borrower Login
            </Link>
            <button
              type="button"
              className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200/80 bg-white/78 text-slate-800 shadow-sm backdrop-blur transition hover:border-brand-primary/30 hover:text-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/35 xl:hidden"
              aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-controls={mobileMenuId}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((open) => !open)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      <MobileDrawer
        open={mobileOpen}
        id={mobileMenuId}
        reduceMotion={reduceMotion}
        close={() => setMobileOpen(false)}
        goToSection={goToSection}
        goHome={goHome}
      />
    </header>
  )
}
