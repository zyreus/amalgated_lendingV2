import { useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import SubPageHeader from '../components/SubPageHeader.jsx'
import Footer from '../components/Footer.jsx'
import amalgatedWayImage from '../assets/AMALGATED WAY.png'

gsap.registerPlugin(ScrollTrigger)

const marketSegments = ['Corporate / Business', 'Government Lending', 'Household / Consumers']

const services = ['Personalized Products & Services', 'Targeted Marketing', 'Improved Risk Assessment']

const missionGroups = [
  'Mid-level businessmen',
  'SSS/GSIS pensioners',
  'Regular salary employees',
  'OFW - Overseas Filipino Workers',
  'PETS - Partners, Employees, Tenants and Suppliers',
]

const loanProducts = [
  'Travel Assistance Loan',
  'Show Money for Visa Application',
  'Salary Loan',
  'SSS/GSIS Pension Loan',
  'Appliance Loan',
  'Chattel Mortgage Loan',
  'Real Estate Mortgage Loan',
]

const businessBenefits = [
  'Enhanced customer satisfaction and loyalty',
  'Optimized product development',
  'Cross-selling opportunities',
]

export default function FeaturesPage() {
  const gridRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const cards = gridRef.current?.querySelectorAll('.feature-card')
      if (cards?.length) {
        gsap.set(cards, { y: 80, opacity: 0 })
        gsap.to(cards, {
          y: 0,
          opacity: 1,
          duration: 0.6,
          stagger: 0.1,
          ease: 'power3.out',
          force3D: true,
          scrollTrigger: { trigger: gridRef.current, start: 'top 85%', once: true },
        })
      }
    })
    return () => ctx.revert()
  }, [])

  return (
    <div className="flex min-h-screen flex-col page-shell-bg">
      <SubPageHeader />
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="border-l-4 border-red-600 pl-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-600">Features</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-black sm:text-3xl">
            Why Amalgated Lending Inc.
          </h1>
        </div>
        <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-black/70">
          The AMALGATED GROUP&apos;s story begins with a tiny, 20-square-meter office in Davao City, where they started
          lending and trading appliances with just Php 98,000. From this humble beginning, equipped with only two
          tables, they laid the foundation for what would become a major business enterprise.
        </p>

        <section className="mt-12">
          <h2 className="text-lg font-semibold text-black sm:text-xl">Our story and direction</h2>
          <div ref={gridRef} className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: 'Humble beginning',
                desc: 'Started from a 20-square-meter office in Davao City with only Php 98,000 and two tables.',
              },
              {
                title: 'Growth momentum',
                desc: 'Gained momentum and established market base for lending and leasing.',
              },
              {
                title: 'Service promise',
                desc: 'Everyday you get our best.',
              },
              {
                title: 'Market segmentation',
                desc: 'We incorporate market segmentation in all our dealings.',
              },
            ].map((f) => (
              <article
                key={f.title}
                className="feature-card rounded-2xl border border-black/10 bg-white p-5 shadow-sm transition hover:border-red-600/40 sm:p-6"
              >
                <h3 className="text-base font-semibold text-black">{f.title}</h3>
                <p className="mt-2 text-sm text-black/70">{f.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold text-black sm:text-xl">Vision and mission focus</h2>
          <div className="mt-4 grid gap-5 lg:grid-cols-2">
            <article className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="text-base font-semibold text-black">Vision</h3>
              <p className="mt-2 text-sm text-black/70">To be a premier lending institution in the Philippines.</p>
            </article>
            <article className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="text-base font-semibold text-black">Mission groups we serve</h3>
              <ul className="mt-3 space-y-1 text-sm text-black/70">
                {missionGroups.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold text-black sm:text-xl">Our market and services</h2>
          <div className="mt-4 grid gap-5 lg:grid-cols-2">
            <article className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="text-base font-semibold text-black">Our market</h3>
              <ul className="mt-3 space-y-1 text-sm text-black/70">
                {marketSegments.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </article>
            <article className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="text-base font-semibold text-black">Our services</h3>
              <ul className="mt-3 space-y-1 text-sm text-black/70">
                {services.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold text-black sm:text-xl">Loan products</h2>
          <div className="mt-4 rounded-2xl border border-black/10 bg-white p-5 shadow-sm sm:p-6">
            <ul className="grid gap-2 text-sm text-black/70 sm:grid-cols-2">
              {loanProducts.map((item) => (
                <li key={item} className="rounded-xl border border-black/10 px-3 py-2">
                  <p className="font-medium text-black">{item}</p>
                  <p className="mt-1 text-xs text-black/60">Fast Processing - Flexible Term - Competitive Rates</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold text-black sm:text-xl">Business benefits and terms</h2>
          <div className="mt-4 grid gap-5 lg:grid-cols-2">
            <article className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="text-base font-semibold text-black">Business benefits</h3>
              <ul className="mt-3 space-y-1 text-sm text-black/70">
                {businessBenefits.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </article>
            <article className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="text-base font-semibold text-black">Terms</h3>
              <p className="mt-2 text-sm text-black/70">Short-, Mid-, and Long-Term Agreements</p>
              <p className="mt-2 text-sm text-black/70">Interest Rates: 3.88% to 5.88% per month</p>
            </article>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold text-black sm:text-xl">The Amalgated Way</h2>
          <p className="mt-2 text-sm text-black/70">
            Compassion, Leadership, Integrity, Excellence, Nurtureship, Teamwork, Sense of Urgency, and Social Responsibility.
          </p>
          <div className="mt-6 overflow-hidden rounded-2xl border border-black/10 shadow-md">
            <img
              src={amalgatedWayImage}
              alt="The Amalgated Way — Core Values"
              className="w-full max-w-4xl object-contain"
            />
          </div>
        </section>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
          <Link to="/contact" className="inline-flex items-center justify-center rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-red-700">
            Get in touch
          </Link>
          <Link to="/" className="text-sm font-medium text-red-600 hover:underline">← Back to home</Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}
