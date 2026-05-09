import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import './App.css'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import CustomerFeedbackSection from './components/CustomerFeedbackSection.jsx'
import SeoMeta from './components/SeoMeta.jsx'
import HomeLoanCalculator from './components/home/HomeLoanCalculator.jsx'
import AboutUsSection from './components/home/AboutUsSection.jsx'
import AdvantagesSection from './components/home/AdvantagesSection.jsx'
import LoanRequirementsSection from './components/home/LoanRequirementsSection.jsx'
import LoanProcessSection from './components/home/LoanProcessSection.jsx'
import FaqSection from './components/home/FaqSection.jsx'
import SecurityPrivacySection from './components/home/SecurityPrivacySection.jsx'
import ContactSupportSection from './components/home/ContactSupportSection.jsx'
import NewsletterSection from './components/NewsletterSection.jsx'
import { FadeInView } from './components/animations/MotionPrimitives.jsx'
import ScrollProgressBar from './components/ScrollProgressBar.jsx'
import BackToTopButton from './components/BackToTopButton.jsx'

const AMALGATED_HOLDINGS_URL = import.meta.env.VITE_AMALGATED_HOLDINGS_URL || 'https://amalgatedholdings.com'

function App() {
  const reduceMotion = useReducedMotion()
  const webUrl = 'https://amalgatedlending.com'

  const homeJsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'FinancialService',
      name: 'Amalgated Lending',
      url: webUrl,
      areaServed: ['Davao', 'Mindanao', 'Philippines'],
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Davao City',
        addressCountry: 'PH',
      },
      telephone: '+63-919-067-5095',
      serviceType: ['Personal Loan', 'Business Loan', 'Salary Loan', 'Travel Assistance Loan'],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Amalgated Lending',
      url: webUrl,
      logo: `${webUrl}/amalgated-lending-logo.png`,
    },
  ]

  const sectionVariants = useMemo(
    () => ({
      hidden: reduceMotion ? {} : { opacity: 0, y: 40 },
      visible: (index) => ({
        opacity: 1,
        y: 0,
        transition: {
          duration: reduceMotion ? 0 : 0.7,
          delay: reduceMotion ? 0 : 0.12 * index,
          ease: [0.22, 1, 0.36, 1],
        },
      }),
    }),
    [reduceMotion]
  )

  useEffect(() => {
    const links = []
    const prefetchRoutes = ['/loan-products', '/application-flow', '/apply', '/contact']

    prefetchRoutes.forEach((href) => {
      const link = document.createElement('link')
      link.rel = 'prefetch'
      link.as = 'document'
      link.href = href
      document.head.appendChild(link)
      links.push(link)
    })

    const preconnect = document.createElement('link')
    preconnect.rel = 'preconnect'
    preconnect.href = AMALGATED_HOLDINGS_URL
    document.head.appendChild(preconnect)
    links.push(preconnect)

    return () => {
      links.forEach((link) => link.remove())
    }
  }, [])

  return (
    <div className="min-h-screen bg-brand-background-alt text-brand-text">
      <ScrollProgressBar />
      <SeoMeta
        title="Amalgated Lending | Trusted Loans in Davao & Mindanao"
        description="Apply for personal, business, salary, travel, and pension loans with transparent terms and secure processing."
        canonical={webUrl}
        image={`${webUrl}/amalgated-lending-logo.png`}
        jsonLd={homeJsonLd}
      />
      <div className="relative flex min-h-screen flex-col">
        <Header />

        <main className="flex-1">
          <motion.section
            id="hero"
            className="relative overflow-hidden bg-brand-dark py-20 text-white sm:py-28 lg:py-36"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.08 } },
            }}
          >
            <motion.div
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(135deg,rgba(220,38,38,0.2)_0%,transparent_50%)]"
              animate={reduceMotion ? {} : { y: [0, -6, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-brand-primary/50" aria-hidden />
            <div className="relative mx-auto min-w-0 max-w-7xl grid gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] items-center">
              <div className="space-y-0">
                <motion.p
                  variants={sectionVariants}
                  custom={0}
                  className="text-xs font-semibold uppercase tracking-[0.2em] text-red-200"
                >
                  Serving Davao & Mindanao
                </motion.p>
                <motion.h1
                  variants={sectionVariants}
                  custom={0.8}
                  className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl"
                >
                  {'Fast, Transparent, and Secure'.split(' ').map((word, i) => (
                    <motion.span key={i} className="inline-block will-change-transform" style={{ display: 'inline-block' }} variants={sectionVariants} custom={i / 10}>
                      {word}&nbsp;
                    </motion.span>
                  ))}
                  <span className="text-brand-primary">
                    {'Lending for Filipinos.'.split(' ').map((word, i) => (
                      <motion.span key={`r-${i}`} className="inline-block will-change-transform" style={{ display: 'inline-block' }} variants={sectionVariants} custom={0.6 + i / 10}>
                        {word}&nbsp;
                      </motion.span>
                    ))}
                  </span>
                </motion.h1>
                <motion.p variants={sectionVariants} custom={1.1} className="mt-4 max-w-2xl text-lg leading-relaxed text-white/85">
                  Get clear loan terms, strong data protection, and guided support from inquiry to disbursement. Built for individuals and micro-entrepreneurs across Davao and Mindanao.
                </motion.p>
                <motion.div variants={sectionVariants} custom={1.2} className="mt-8 flex flex-wrap items-center gap-4">
                  <Link
                    to="/borrower/login"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-primary px-6 py-3 text-sm font-semibold text-white shadow-brand-primary transition hover:scale-[1.02] hover:bg-brand-primary-hover hover:shadow-[0_4px_12px_rgba(220,38,38,0.4)]"
                  >
                    Apply Now
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  </Link>
                  <Link
                    to="/application-flow"
                    className="inline-flex items-center text-sm font-semibold text-white/90 transition hover:text-white"
                  >
                    Check Eligibility
                    <span className="ml-2 h-px w-6 bg-white/50" />
                  </Link>
                </motion.div>
                <motion.dl variants={sectionVariants} custom={1.3} className="mt-10 grid max-w-2xl grid-cols-1 gap-6 border-t border-white/10 pt-8 text-sm text-white/80 sm:grid-cols-3">
                  <div className="min-w-0">
                    <dt className="text-xs uppercase tracking-[0.18em] text-white/60">Happy clients</dt>
                    <dd className="mt-2 text-xl font-semibold text-white sm:text-2xl">1,500+</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs uppercase tracking-[0.18em] text-white/60">Established</dt>
                    <dd className="mt-2 text-xl font-semibold text-white sm:text-2xl">2015</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs uppercase tracking-[0.18em] text-white/60">Coverage</dt>
                    <dd className="mt-2 break-words text-lg font-semibold leading-snug text-white sm:text-2xl">Davao & Mindanao</dd>
                  </div>
                </motion.dl>
              </div>

              <motion.div variants={sectionVariants} custom={0.4} className="relative">
                <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/10 backdrop-blur-xl p-5 sm:p-7 lg:p-8">
                  <div className="absolute inset-x-[-40%] top-[-35%] h-56 rounded-[3rem] bg-brand-primary/20 blur-3xl" />

                  <div className="relative space-y-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.26em] text-white/60">
                          Loan application snapshot
                        </p>
                        <p className="text-sm font-semibold text-white">
                          Fast approval process
                        </p>
                      </div>
                      <span className="rounded-full bg-brand-primary/20 px-3 py-1 text-[11px] font-medium text-red-200 ring-1 ring-brand-primary/40">
                        In progress
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                      <div className="rounded-2xl bg-white/10 p-3">
                        <p className="text-[11px] text-white/60">Security</p>
                        <p className="mt-1 text-lg font-semibold text-brand-primary">SSL Encrypted</p>
                        <p className="mt-1 text-[11px] text-white/60">Your data is protected in transit and at rest.</p>
                      </div>
                      <div className="rounded-2xl bg-white/10 p-3">
                        <p className="text-[11px] text-white/60">Transparency</p>
                        <p className="mt-1 text-lg font-semibold text-white">No hidden fees</p>
                        <p className="mt-1 text-[11px] text-white/60">See rates, charges, and schedule before submission.</p>
                      </div>
                    </div>

                    <div className="mt-2 rounded-2xl bg-white/10 p-3.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-white/80">Next steps in your application</span>
                        <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-white/60">This week</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/80">Inquire</span>
                        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/80">Verify</span>
                        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/80">Release</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.section>

          <section id="trust" className="app-container py-12 sm:py-16">
            <div className="grid gap-4 md:grid-cols-4">
              {[
                ['Licensed & Legitimate', 'Registered Philippine lending operation.'],
                ['Davao Presence', 'Physical servicing for Davao and Mindanao clients.'],
                ['Data Protection', 'Encrypted forms and secure borrower portal.'],
                ['Transparent Terms', 'Clear rates, fees, and payment schedules.'],
              ].map(([title, desc], idx) => (
                <motion.div
                  key={title}
                  className="surface-card-light p-4 text-sm"
                  initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                  whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.4, delay: reduceMotion ? 0 : idx * 0.06 }}
                  whileHover={reduceMotion ? {} : { y: -3, scale: 1.01 }}
                >
                  <p className="font-semibold">{title}</p>
                  <p className="mt-1 text-brand-text/70">{desc}</p>
                </motion.div>
              ))}
            </div>
          </section>

          <AboutUsSection />
          <AdvantagesSection />

          <section className="app-container pb-10">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <HomeLoanCalculator />
              <div id="cta" className="surface-card-light p-6">
                <p className="section-title">Ready to apply?</p>
                <h2 className="mt-2 text-2xl font-semibold">Get your loan decision with guided support.</h2>
                <p className="mt-3 text-sm text-brand-text/70">Our team can help you choose the right product and prepare requirements quickly.</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link to="/borrower/login" className="rounded-full bg-brand-primary px-5 py-3 text-sm font-semibold text-white">Apply via Borrower Portal</Link>
                  <Link to="/application-flow" className="rounded-full border border-black/15 px-5 py-3 text-sm font-semibold">View Process</Link>
                </div>
                <ul className="mt-5 space-y-2 text-sm text-brand-text/70">
                  <li>• Personal, business, salary, pension, and travel products</li>
                  <li>• Borrower dashboard with payment tracking and SOA</li>
                  <li>• Support available during business hours</li>
                </ul>
              </div>
            </div>
          </section>

          <LoanRequirementsSection />
          <LoanProcessSection />

          <section id="stats" className="app-container py-8 sm:py-12">
            <FadeInView className="surface-card-light p-6">
              <p className="section-title">Social Proof</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div><p className="text-3xl font-bold text-brand-primary">₱250M+</p><p className="text-sm text-brand-text/70">Estimated loans facilitated</p></div>
                <div><p className="text-3xl font-bold text-brand-primary">1,500+</p><p className="text-sm text-brand-text/70">Borrowers served</p></div>
                <div><p className="text-3xl font-bold text-brand-primary">4.8/5</p><p className="text-sm text-brand-text/70">Client satisfaction</p></div>
              </div>
            </FadeInView>
          </section>

          <section id="testimonials" className="app-container py-6 sm:py-10">
            <CustomerFeedbackSection />
          </section>

          <NewsletterSection />

          <FaqSection />
          <SecurityPrivacySection />
          <ContactSupportSection />

          <section className="app-container pb-14">
            <div className="surface-card-light p-6 text-center">
              <h2 className="text-2xl font-semibold">Need funds with a trusted local lending partner?</h2>
              <p className="mt-2 text-sm text-brand-text/70">Apply online, track your status, and print your documents securely.</p>
              <div className="mt-5 flex justify-center gap-3">
                <Link to="/borrower/login" className="rounded-full bg-brand-primary px-6 py-3 text-sm font-semibold text-white">Apply Now</Link>
                <Link to="/contact" className="rounded-full border border-black/15 px-6 py-3 text-sm font-semibold">Contact Us</Link>
              </div>
            </div>
          </section>

          <motion.section className="border-t border-brand-secondary/30 bg-brand-background py-12" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.5 }}>
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
                <Link to="/loan-products" className="rounded-full border border-brand-secondary/60 bg-brand-background-alt px-6 py-3 text-sm font-medium text-brand-text transition hover:border-brand-primary hover:bg-brand-primary/10 hover:text-brand-primary">Loan Products</Link>
                <Link to="/application-flow" className="rounded-full border border-brand-secondary/60 bg-brand-background-alt px-6 py-3 text-sm font-medium text-brand-text transition hover:border-brand-primary hover:bg-brand-primary/10 hover:text-brand-primary">Application Flow</Link>
                <Link to="/borrower/login" className="rounded-full border border-brand-secondary/60 bg-brand-background-alt px-6 py-3 text-sm font-medium text-brand-text transition hover:border-brand-primary hover:bg-brand-primary/10 hover:text-brand-primary">Borrower Log in</Link>
                <a href={`${AMALGATED_HOLDINGS_URL}`} target="_blank" rel="noreferrer" className="rounded-full border border-brand-secondary/60 bg-brand-background-alt px-6 py-3 text-sm font-medium text-brand-text transition hover:border-brand-primary hover:bg-brand-primary/10 hover:text-brand-primary">Amalgated Holdings</a>
              </div>
            </div>
          </motion.section>
        </main>

        <Footer />
      </div>
      <BackToTopButton />
    </div>
  )
}

export default App
