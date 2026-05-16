import { lazy, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import './App.css'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import SeoMeta from './components/SeoMeta.jsx'
import HomeLoanCalculator from './components/home/HomeLoanCalculator.jsx'
import HomeModernHero from './components/home/HomeModernHero.jsx'
import AboutUsSection from './components/home/AboutUsSection.jsx'
import AdvantagesSection from './components/home/AdvantagesSection.jsx'
import { FadeInView } from './components/animations/MotionPrimitives.jsx'
import ScrollProgressBar from './components/ScrollProgressBar.jsx'
import BackToTopButton from './components/BackToTopButton.jsx'
import LazySection from './components/LazySection.jsx'

/**
 * Below-the-fold sections are lazy-loaded with `React.lazy` + IntersectionObserver
 * (`LazySection`). This keeps them out of the homepage's initial JS chunk and only
 * downloads / mounts them when the visitor scrolls near them — a major LCP / TBT
 * win on the public landing page (the largest entry point for the SPA).
 */
const LoanRequirementsSection = lazy(() => import('./components/home/LoanRequirementsSection.jsx'))
const LoanProcessSection = lazy(() => import('./components/home/LoanProcessSection.jsx'))
const FaqSection = lazy(() => import('./components/home/FaqSection.jsx'))
const SecurityPrivacySection = lazy(() => import('./components/home/SecurityPrivacySection.jsx'))
const ContactSupportSection = lazy(() => import('./components/home/ContactSupportSection.jsx'))
const NewsletterSection = lazy(() => import('./components/NewsletterSection.jsx'))
const CustomerFeedbackSection = lazy(() => import('./components/CustomerFeedbackSection.jsx'))

const AMALGATED_HOLDINGS_URL = import.meta.env.VITE_AMALGATED_HOLDINGS_URL || 'https://amalgatedholdings.com'

function App() {
  const reduceMotion = useReducedMotion()
  const webUrl = 'https://amalgatedlending.com'

  const homeJsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'FinancialService',
      name: 'Amalgated Lending Inc.',
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
      name: 'Amalgated Lending Inc.',
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
    const prefetchRoutes = ['/loan-products', '/application-flow', '/apply', '/contact', '/branches']

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
    <div className="min-h-screen page-shell-bg text-brand-text">
      <ScrollProgressBar />
      <SeoMeta
        title="Amalgated Lending Inc. | Trusted Loans in Davao & Mindanao"
        description="Apply for personal, business, salary, travel, and pension loans with transparent terms and secure processing."
        canonical={webUrl}
        image={`${webUrl}/amalgated-lending-logo.png`}
        jsonLd={homeJsonLd}
      />
      <div className="relative flex min-h-screen flex-col">
        <Header />

        <main className="flex-1">
          <HomeModernHero />

          <section id="trust" className="app-container landing-section-after-hero">
            <div className="landing-card-grid md:grid-cols-2 lg:grid-cols-4">
              {[
                ['Licensed & Legitimate', 'Registered Philippine lending operation.'],
                ['Davao Presence', 'Physical servicing for Davao and Mindanao clients.'],
                ['Data Protection', 'Encrypted forms and secure borrower portal.'],
                ['Transparent Terms', 'Clear rates, fees, and payment schedules.'],
              ].map(([title, desc], idx) => (
                <motion.div
                  key={title}
                  className="landing-inner-card text-sm"
                  initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                  whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.4, delay: reduceMotion ? 0 : idx * 0.06 }}
                  whileHover={reduceMotion ? {} : { y: -3, scale: 1.01 }}
                >
                  <p className="font-semibold">{title}</p>
                  <p className="mt-2 leading-relaxed text-brand-text/70">{desc}</p>
                </motion.div>
              ))}
            </div>
          </section>

          <AboutUsSection />
          <AdvantagesSection />

          <section id="calculator" className="app-container landing-section scroll-mt-28">
            <div className="landing-card-grid items-stretch lg:grid-cols-[1.1fr_0.9fr]">
              <HomeLoanCalculator />
              <div id="cta" className="landing-panel flex h-full flex-col">
                <p className="section-title">Ready to apply?</p>
                <h2 className="landing-section-heading mt-2 text-2xl">Get your loan decision with guided support.</h2>
                <p className="landing-section-lead">Our team can help you choose the right product and prepare requirements quickly.</p>
                <div className="landing-btn-group mt-8">
                  <Link to="/borrower/login" className="landing-btn-primary">Apply via Borrower Portal</Link>
                  <Link to="/application-flow" className="landing-btn-secondary">View Process</Link>
                </div>
                <ul className="landing-stack mt-8 text-sm leading-relaxed text-brand-text/70">
                  <li>• Personal, business, salary, pension, and travel products</li>
                  <li>• Borrower dashboard with payment tracking and SOA</li>
                  <li>• Support available during business hours</li>
                </ul>
              </div>
            </div>
          </section>

          <LazySection minHeight={200}>
            <LoanRequirementsSection />
          </LazySection>
          <LazySection minHeight={200}>
            <LoanProcessSection />
          </LazySection>

          <section id="stats" className="app-container landing-section">
            <FadeInView className="landing-panel">
              <p className="section-title">Social Proof</p>
              <div className="landing-content-after-header landing-card-grid sm:grid-cols-3">
                <div><p className="text-3xl font-bold text-brand-primary">₱250M+</p><p className="mt-2 text-sm leading-relaxed text-brand-text/70">Estimated loans facilitated</p></div>
                <div><p className="text-3xl font-bold text-brand-primary">1,500+</p><p className="mt-2 text-sm leading-relaxed text-brand-text/70">Borrowers served</p></div>
                <div><p className="text-3xl font-bold text-brand-primary">4.8/5</p><p className="mt-2 text-sm leading-relaxed text-brand-text/70">Client satisfaction</p></div>
              </div>
            </FadeInView>
          </section>

          <LazySection id="customer-feedback" minHeight={200} className="scroll-mt-24 sm:scroll-mt-28">
            <CustomerFeedbackSection />
          </LazySection>

          <LazySection id="newsletter" minHeight={200} className="scroll-mt-28">
            <NewsletterSection />
          </LazySection>

          <LazySection minHeight={180}>
            <FaqSection />
          </LazySection>
          <LazySection minHeight={160}>
            <SecurityPrivacySection />
          </LazySection>
          <LazySection minHeight={180}>
            <ContactSupportSection />
          </LazySection>

          <section className="app-container landing-section-lg">
            <div className="landing-cta-banner">
              <h2 className="landing-section-heading text-center">Need funds with a trusted local lending partner?</h2>
              <p className="landing-section-lead mx-auto max-w-2xl text-center">
                Apply online, track your status, and print your documents securely.
              </p>
              <div className="landing-btn-group mt-10 justify-center">
                <Link to="/borrower/login" className="landing-btn-primary">Apply Now</Link>
                <Link to="/contact" className="landing-btn-secondary">Contact Us</Link>
              </div>
            </div>
          </section>

          <motion.section
            className="border-t border-red-100/40 bg-transparent"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
          >
            <div className="app-container pb-10 pt-8 sm:pb-12 sm:pt-10">
              <div className="landing-footer-pills">
                <Link to="/loan-products" className="rounded-full border border-red-200/55 bg-white/85 px-8 py-4 text-sm font-medium text-brand-text shadow-sm backdrop-blur-sm transition hover:border-brand-primary hover:bg-white hover:text-brand-primary">Loan Products</Link>
                <Link to="/application-flow" className="rounded-full border border-red-200/55 bg-white/85 px-8 py-4 text-sm font-medium text-brand-text shadow-sm backdrop-blur-sm transition hover:border-brand-primary hover:bg-white hover:text-brand-primary">Application Flow</Link>
                <Link to="/borrower/login" className="rounded-full border border-red-200/55 bg-white/85 px-8 py-4 text-sm font-medium text-brand-text shadow-sm backdrop-blur-sm transition hover:border-brand-primary hover:bg-white hover:text-brand-primary">Borrower Log in</Link>
                <a href={`${AMALGATED_HOLDINGS_URL}`} target="_blank" rel="noreferrer" className="rounded-full border border-red-200/55 bg-white/85 px-8 py-4 text-sm font-medium text-brand-text shadow-sm backdrop-blur-sm transition hover:border-brand-primary hover:bg-white hover:text-brand-primary">Amalgated Holdings</a>
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

