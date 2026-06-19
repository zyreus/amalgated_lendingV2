import { useRef, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import SubPageHeader from '../components/SubPageHeader.jsx'
import Footer from '../components/Footer.jsx'
import luzonBranchImage from '../assets/luzon.png'
import visminBranchImage from '../assets/vismin.jpg'
import mangagoyBranchImage from '../assets/mangagoy branch.jpg'
import kidapawanBranchImage from '../assets/kidapawan.jpg'
import lagaoBranchImage from '../assets/lagao-branch.jpg'

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

/** Branch network photos: each location uses its own storefront image. */
const branches = [
  {
    name: 'Amalgated Lending Inc. - Kidapawan branch',
    image: kidapawanBranchImage,
    detail: 'A & S Landing Commercial Bldg., Brgy. Sudapin, Kidapawan City',
  },
  {
    name: 'Amalgated Lending Inc. - Mangagoy Branch',
    image: mangagoyBranchImage,
    detail: 'M.Conpinco Building Espiritu St. Mangagoy, Bislig City Surigao Del Sur 8311',
  },
  {
    name: 'Amalgated Lending Inc. - Lagao Branch',
    image: lagaoBranchImage,
    detail: 'Aradaza st. General Santos City',
  },
]

const serviceAreas = ['Mindanao', 'Visayas', 'Luzon', 'NCR']

function BranchImage({ src, alt, title, onPreview }) {
  return (
    <button
      type="button"
      className="group relative block aspect-[3/2] w-full overflow-hidden bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
      aria-label={`View larger photo of ${title}`}
      onClick={() => onPreview({ src, alt, title })}
    >
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        loading="lazy"
        decoding="async"
        onError={(e) => {
          e.target.onerror = null
          e.target.src = getPlaceholderImage(title)
        }}
      />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/20">
        <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-black opacity-0 shadow-sm transition group-hover:opacity-100">
          View photo
        </span>
      </span>
    </button>
  )
}

function BranchImageLightbox({ preview, onClose }) {
  useEffect(() => {
    if (!preview) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [preview, onClose])

  if (!preview) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={preview.title}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3 sm:px-5">
          <p className="text-sm font-semibold text-black sm:text-base">{preview.title}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-black/70 transition hover:bg-black/5"
          >
            Close
          </button>
        </div>
        <div className="bg-black/5 p-2 sm:p-4">
          <img
            src={preview.src}
            alt={preview.alt}
            className="mx-auto max-h-[75vh] w-full rounded-xl object-contain"
          />
        </div>
      </div>
    </div>
  )
}

export default function BranchesPage() {
  const officesRef = useRef(null)
  const branchesRef = useRef(null)
  const [imagePreview, setImagePreview] = useState(null)

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
    <div className="flex min-h-screen flex-col page-shell-bg">
      <SubPageHeader />
      <main className="app-container section-y flex-1">
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
                <BranchImage
                  src={office.image}
                  alt={office.name}
                  title={office.name}
                  onPreview={setImagePreview}
                />
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
                <BranchImage
                  src={branch.image}
                  alt={branch.name}
                  title={branch.name}
                  onPreview={setImagePreview}
                />
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
      <BranchImageLightbox preview={imagePreview} onClose={() => setImagePreview(null)} />
      <Footer />
    </div>
  )
}
