import { useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import SubPageHeader from '../components/SubPageHeader.jsx'
import Footer from '../components/Footer.jsx'
import luzonBranchImage from '../assets/luzon.png'
import visminBranchImage from '../assets/vismin.jpg'
import manilaBranchImage from '../assets/manila.jpg'

gsap.registerPlugin(ScrollTrigger)

function getPlaceholderImage(name) {
  const seed = encodeURIComponent((name || 'branch').replace(/\s+/g, '-'))
  return `https://picsum.photos/seed/${seed}/480/320`
}

const mainOffices = [
  {
    name: 'Main Office VisMin',
    address: 'ACI IT and Corporate Centre, Doña Carolina Uykimpang Building, Cor. JP Laurel Avenue and Iñigo Street, Bajada, Davao City 8000',
    note: 'Amalgated Lending Inc. corporate address.',
    image: visminBranchImage,
  },
  {
    name: 'Main Office Luzon',
    address: '1220 Pedro Gil Street, Paco, Manila',
    note: 'Luzon headquarters.',
    image: luzonBranchImage,
  },
]

/** Regional photos: Manila uses metro imagery; Visayas/Mindanao branches use VisMin. */
const branches = [
  {
    name: 'Amalgated Lending Inc. - Kidapawan branch',
    image: visminBranchImage,
    detail: 'A & S Landing Commercial Bldg., Brgy. Sudapin, Kidapawan City',
  },
  {
    name: 'Amalgated Lending Inc. - Mangagoy Branch',
    image: manilaBranchImage,
    detail: 'M.Conpinco Building Espiritu St. Mangagoy, Bislig City Surigao Del Sur 8311',
  },
  {
    name: 'Amalgated Lending Inc. - Lagao Branch',
    image: visminBranchImage,
    detail: 'Aradaza st. General Santos City',
  },
]

const serviceAreas = ['Mindanao', 'Visayas', 'Luzon', 'NCR']

export default function BranchesPage() {
  const officesRef = useRef(null)
  const branchesRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const animate = (container) => {
        const cards = container?.querySelectorAll('.branch-card')
        if (!cards?.length) return
        gsap.set(cards, { y: 80, opacity: 0 })
        gsap.to(cards, {
          y: 0,
          opacity: 1,
          duration: 0.6,
          stagger: 0.1,
          ease: 'power3.out',
          force3D: true,
          scrollTrigger: { trigger: container, start: 'top 85%', once: true },
        })
      }
      animate(officesRef.current)
      animate(branchesRef.current)
    })
    return () => ctx.revert()
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SubPageHeader />
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="border-l-4 border-red-600 pl-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-600">Branches</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-black sm:text-3xl">
            Find us nationwide
          </h1>
        </div>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-black/70">
          Amalgated Lending Inc. (ALI) serves individuals and businesses across Luzon, Visayas, and Mindanao with accessible lending solutions.
        </p>

        <section className="mt-12">
          <h2 className="text-lg font-semibold text-black sm:text-xl">Main offices</h2>
          <div ref={officesRef} className="mt-4 grid gap-6 sm:grid-cols-2">
            {mainOffices.map((office) => (
              <article key={office.name} className="branch-card overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm transition hover:shadow-md">
                <div className="aspect-[3/2] w-full overflow-hidden bg-black/5">
                  <img src={office.image} alt={office.name} className="h-full w-full object-cover" loading="lazy" decoding="async" onError={(e) => { e.target.onerror = null; e.target.src = getPlaceholderImage(office.name) }} />
                </div>
                <div className="p-5 sm:p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-600">{office.name}</p>
                  <p className="mt-2 text-sm font-medium text-black">{office.address}</p>
                  {office.note && <p className="mt-2 text-xs text-black/60">{office.note}</p>}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold text-black sm:text-xl">Branch network</h2>
          <p className="mt-2 text-sm text-black/70">Strategic locations across the Philippines.</p>
          <div ref={branchesRef} className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((branch) => (
              <article
                key={branch.name}
                className="branch-card overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="aspect-[3/2] w-full overflow-hidden bg-black/5">
                  <img
                    src={branch.image}
                    alt={`${branch.name} branch`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      e.target.onerror = null
                      e.target.src = getPlaceholderImage(branch.name)
                    }}
                  />
                </div>
                <div className="p-5">
                  <h3 className="font-semibold text-black">{branch.name}</h3>
                  <p className="mt-2 text-sm text-black/70">
                    {branch.detail ?? 'Apply in person or contact us for details.'}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-black/10 bg-black/[0.02] p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-black sm:text-xl">Service areas</h2>
          <p className="mt-2 text-sm text-black/70">We serve clients across Luzon, Visayas, Mindanao, and NCR.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {serviceAreas.map((area) => (
              <span key={area} className="rounded-full border border-red-600/30 bg-red-50/50 px-4 py-2 text-sm font-medium text-black">{area}</span>
            ))}
          </div>
        </section>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
          <Link to="/contact" className="inline-flex items-center justify-center rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-red-700">
            Contact us
          </Link>
          <Link to="/" className="text-sm font-medium text-red-600 hover:underline">← Back to home</Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}
