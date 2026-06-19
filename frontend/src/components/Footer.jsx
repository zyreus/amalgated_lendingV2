import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { laravelRequest } from '../utils/lendingLaravelApi.js'
import { COOKIE_PREFERENCES_EVENT } from './privacy/CookiePreferencesModal.jsx'
import { COMPANY_PHONES } from '../config/companyContact.js'

const AMALGATED_HOLDINGS_URL = import.meta.env.VITE_AMALGATED_HOLDINGS_URL || 'https://amalgatedholdings.com'

const MAIN_OFFICE_ADDRESS =
  'ACI IT and Corporate Centre, Doña Carolina Uykimpang Building, Cor. JP Laurel Ave. & Iñigo St., Bajada, Davao City 8000'

const CONTACT = {
  phones: COMPANY_PHONES,
  email: 'support@amalgatedlending.com',
  hours: 'Monday – Saturday · 8:30 AM – 5:30 PM (PH)',
}

const QUICK_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'About Us', to: '/#about-us' },
  { label: 'Services', to: '/loan-products' },
  { label: 'Apply Now', to: '/borrower/login' },
  { label: 'Contact', to: '/contact' },
]

const LOAN_SERVICES = [
  { label: 'Personal Loan', to: '/loan-products' },
  { label: 'Salary Loan', to: '/loans/salary-loan' },
  { label: 'Business Loan', to: '/loan-products' },
  { label: 'OFW Loan', to: '/loans/travel-assistance-loan' },
  { label: 'Auto Loan', to: '/loans/chattel-mortgage' },
]

const TRUST_BADGES = [
  { label: 'SSL secured portal', icon: 'shield' },
  { label: 'Licensed lending', icon: 'badge' },
  { label: 'Data Privacy Act aligned', icon: 'lock' },
]

function FooterColumnHeading({ children }) {
  return (
    <h3 className="font-accent text-[11px] font-semibold uppercase tracking-[0.2em] text-footer-primary">
      {children}
    </h3>
  )
}

function FooterNavLink({ to, children }) {
  return (
    <li>
      <Link to={to} className="group footer-link">
        <span
          className="h-1 w-1 shrink-0 rounded-full bg-footer-accent/0 transition-all duration-300 group-hover:w-2 group-hover:bg-footer-accent"
          aria-hidden
        />
        {children}
      </Link>
    </li>
  )
}

function SocialIconButton({ href, label, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="footer-social-btn">
      {children}
    </a>
  )
}

function TrustBadgeIcon({ type }) {
  const common = 'h-4 w-4 text-footer-accent'
  if (type === 'shield') {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7l8-4z" />
      </svg>
    )
  }
  if (type === 'lock') {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path strokeLinecap="round" d="M8 11V8a4 4 0 118 0v3" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  )
}

export default function Footer() {
  const reduceMotion = useReducedMotion()
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
          source: 'newsletter',
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

  const fadeUp = {
    hidden: reduceMotion ? {} : { opacity: 0, y: 20 },
    visible: (i = 0) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: reduceMotion ? 0 : 0.5,
        delay: reduceMotion ? 0 : 0.06 * i,
        ease: [0.22, 1, 0.36, 1],
      },
    }),
  }

  return (
    <footer className="relative mt-auto overflow-hidden" aria-labelledby="site-footer-heading">
      <div className="footer-brand-transition" aria-hidden />
      <div className="footer-shell relative overflow-hidden">
      <div className="footer-gradient-border" aria-hidden />
      <div
        className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-footer-primary/10 blur-3xl"
        aria-hidden
      />
      <motion.div
        className="pointer-events-none absolute -right-16 bottom-32 h-64 w-64 rounded-full bg-footer-secondary/15 blur-3xl"
        aria-hidden
        animate={reduceMotion ? {} : { opacity: [0.4, 0.7, 0.4], scale: [1, 1.05, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-footer-accent/5 blur-3xl"
        aria-hidden
        animate={reduceMotion ? {} : { opacity: [0.3, 0.55, 0.3] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div className="app-container relative z-10 pb-8 pt-12 sm:pb-10 sm:pt-14 lg:pb-12 lg:pt-16">
        <h2 id="site-footer-heading" className="sr-only">
          Site footer
        </h2>

        <motion.div
          className="grid gap-10 sm:gap-12 md:grid-cols-2 lg:grid-cols-12 lg:gap-x-8 xl:gap-x-10"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={fadeUp}
        >
          <motion.div className="flex flex-col gap-5 lg:col-span-4" variants={fadeUp} custom={0}>
            <Link
              to="/"
              className="inline-flex w-fit items-center gap-3 rounded-2xl transition-opacity duration-300 hover:opacity-90"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-footer-primary/25 bg-footer-primary/10 p-1.5 shadow-brand-primary backdrop-blur-md">
                <img
                  src="/amalgated-lending-logo.png"
                  alt=""
                  width={36}
                  height={36}
                  className="h-9 w-9 object-contain"
                  loading="lazy"
                  decoding="async"
                  aria-hidden
                />
              </span>
              <div className="min-w-0">
                <p className="font-display text-base font-semibold tracking-tight text-footer-white">
                  Amalgated Lending Inc.
                </p>
                <p className="text-xs text-footer-muted">Trusted lending · Philippines</p>
              </div>
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-footer-muted">
              Premium digital lending for individuals and businesses — transparent terms, secure borrower portal, and
              responsive support from our Davao headquarters nationwide.
            </p>
            <motion.div className="flex flex-wrap gap-2.5" variants={fadeUp} custom={1}>
              <SocialIconButton href="https://www.facebook.com/AmalgatedLendingOfficial" label="Facebook">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                  <path d="M13.5 22v-8h2.68l.4-3.12H13.5V8.9c0-.9.25-1.52 1.55-1.52h1.66V4.6c-.29-.04-1.29-.12-2.45-.12-2.42 0-4.08 1.48-4.08 4.2v2.2H7.5V14h2.68v8h3.32Z" />
                </svg>
              </SocialIconButton>
              <SocialIconButton
                href="https://www.instagram.com/amalgated.lending?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=="
                label="Instagram"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <rect x="7" y="7" width="10" height="10" rx="3" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </SocialIconButton>
            </motion.div>
          </motion.div>

          <motion.nav className="lg:col-span-2" aria-label="Quick links" variants={fadeUp} custom={2}>
            <FooterColumnHeading>Quick Links</FooterColumnHeading>
            <ul className="mt-5 space-y-3.5">
              {QUICK_LINKS.map((item) => (
                <FooterNavLink key={item.label} to={item.to}>
                  {item.label}
                </FooterNavLink>
              ))}
            </ul>
          </motion.nav>

          <motion.nav className="lg:col-span-2" aria-label="Loan services" variants={fadeUp} custom={3}>
            <FooterColumnHeading>Loan Services</FooterColumnHeading>
            <ul className="mt-5 space-y-3.5">
              {LOAN_SERVICES.map((item) => (
                <FooterNavLink key={item.label} to={item.to}>
                  {item.label}
                </FooterNavLink>
              ))}
            </ul>
          </motion.nav>

          <motion.div className="lg:col-span-4" variants={fadeUp} custom={4}>
            <FooterColumnHeading>Contact</FooterColumnHeading>
            <address className="mt-5 space-y-4 not-italic text-sm leading-relaxed text-footer-muted">
              <p>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-footer-white">
                  Address
                </span>
                {MAIN_OFFICE_ADDRESS}
              </p>
              <p>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-footer-white">Phone</span>
                <span className="flex flex-col gap-1">
                  {CONTACT.phones.map((phone) => (
                    <a
                      key={phone.raw}
                      href={phone.href}
                      className="transition-colors duration-300 hover:text-footer-primary"
                    >
                      {phone.display}
                    </a>
                  ))}
                </span>
              </p>
              <p>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-footer-white">Email</span>
                <a
                  href={`mailto:${CONTACT.email}`}
                  className="break-all transition-colors duration-300 hover:text-footer-primary"
                >
                  {CONTACT.email}
                </a>
              </p>
              <p>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-footer-white">
                  Office hours
                </span>
                {CONTACT.hours}
              </p>
            </address>
          </motion.div>
        </motion.div>

        <motion.div
          className="footer-glass-panel mt-12 p-6 shadow-[0_24px_64px_rgba(28,25,23,0.55)] sm:mt-14 sm:p-8 lg:flex lg:items-center lg:justify-between lg:gap-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={fadeUp}
          custom={5}
        >
          <motion.div className="min-w-0 flex-1" variants={fadeUp} custom={5}>
            <p className="font-accent text-xs font-semibold uppercase tracking-[0.2em] text-footer-accent">Ready to apply?</p>
            <p className="mt-2 font-display text-xl font-semibold tracking-tight text-footer-white sm:text-2xl">
              Start your loan journey in minutes
            </p>
            <p className="mt-2 max-w-lg text-sm text-footer-muted">
              Secure online application, clear requirements, and a dedicated team to guide you through approval.
            </p>
          </motion.div>
          <motion.div className="mt-6 shrink-0 lg:mt-0" variants={fadeUp} custom={6}>
            <Link to="/borrower/login" className="footer-btn-primary w-full sm:w-auto">
              Apply for a Loan
            </Link>
          </motion.div>
        </motion.div>

        <motion.div
          className="footer-glass-card mt-10 p-6 sm:p-8 lg:mt-12"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={fadeUp}
          custom={7}
        >
          <motion.div
            className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center lg:gap-10"
            variants={fadeUp}
            custom={7}
          >
            <motion.div className="min-w-0">
              <p className="font-accent text-xs font-semibold uppercase tracking-[0.2em] text-footer-primary">Newsletter</p>
              <p className="mt-2 font-display text-lg font-semibold text-footer-white">Rate drops &amp; product updates</p>
              <p className="mt-2 text-sm text-footer-muted">Short updates — no spam. Unsubscribe anytime.</p>
            </motion.div>
            <form
              onSubmit={submitNewsletter}
              className="grid w-full min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_auto] sm:items-stretch"
            >
              <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
              <input
                type="text"
                placeholder="First name (optional)"
                value={nlName}
                onChange={(e) => setNlName(e.target.value)}
                className="footer-input"
              />
              <input
                type="email"
                required
                placeholder="Email address"
                value={nlEmail}
                onChange={(e) => setNlEmail(e.target.value)}
                autoComplete="email"
                className="footer-input"
              />
              <button type="submit" disabled={nlStatus === 'loading'} className="footer-btn-outline w-full sm:w-auto">
                {nlStatus === 'loading' ? '…' : 'Join'}
              </button>
            </form>
          </motion.div>
          {nlError ? <p className="mt-3 text-sm text-footer-primary">{nlError}</p> : null}
          {nlStatus === 'success' ? (
            <p className="mt-3 text-sm font-semibold text-footer-accent">You&apos;re on the list. Watch your inbox.</p>
          ) : null}
        </motion.div>

        <motion.ul
          className="mt-10 flex flex-wrap justify-center gap-3 sm:mt-12 sm:gap-4"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={8}
        >
          {TRUST_BADGES.map((badge) => (
            <li
              key={badge.label}
              className="inline-flex items-center gap-2 rounded-full border border-footer-secondary/30 bg-footer-secondary/10 px-4 py-2 text-xs font-medium text-footer-muted backdrop-blur-sm transition-colors duration-300 hover:border-footer-accent/40 hover:text-footer-white"
            >
              <TrustBadgeIcon type={badge.icon} />
              {badge.label}
            </li>
          ))}
        </motion.ul>

        <div className="mt-10 border-t border-footer-primary/15 pt-8 sm:mt-12">
          <motion.div
            className="flex flex-col items-center gap-4 text-center sm:flex-row sm:flex-wrap sm:justify-between sm:text-left"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={9}
          >
            <p className="text-sm text-footer-muted">
              © {new Date().getFullYear()} Amalgated Lending Inc. All rights reserved.
            </p>
            <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm" aria-label="Legal">
              <Link to="/privacy-policy" className="footer-legal-link">
                Privacy Policy
              </Link>
              <Link to="/privacy-policy" className="footer-legal-link">
                Terms &amp; Conditions
              </Link>
              <button type="button" onClick={openCookieSettings} className="footer-legal-link">
                Cookies Policy
              </button>
            </nav>
          </motion.div>
          <p className="mt-4 text-center text-xs text-footer-muted/80">
            Amalgated Lending Inc. (ALI) · Part of the Amalgated Group of Companies · Davao City, Philippines
          </p>
          <p className="mt-2 text-center">
            <a
              href={AMALGATED_HOLDINGS_URL}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-footer-muted underline decoration-footer-primary/30 underline-offset-4 transition-colors duration-300 hover:text-footer-white"
            >
              Amalgated Holdings
            </a>
          </p>
        </div>
      </motion.div>
      </div>
    </footer>
  )
}
