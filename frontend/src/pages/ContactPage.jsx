import { useRef, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import SubPageHeader from '../components/SubPageHeader.jsx'
import Footer from '../components/Footer.jsx'
import { postPublicInquiry } from '../utils/lendingApi.js'

gsap.registerPlugin(ScrollTrigger)

const mainOfficeAddress = 'ACI IT and Corporate Centre, Doña Carolina Uykimpang Building, Cor. JP Laurel Avenue and Iñigo Street, Bajada, Davao City 8000'
const directionsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(mainOfficeAddress)

export default function ContactPage() {
  const cardRef = useRef(null)
  const mapRef = useRef(null)
  const [formData, setFormData] = useState({
    name: '',
    contactNumber: '',
    email: '',
    preferredLoanType: '',
    estimatedLoanAmount: '',
  })
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name || !formData.contactNumber || !formData.email || !formData.preferredLoanType || !formData.estimatedLoanAmount) {
      setStatus('error')
      setErrorMsg('Please complete all required fields.')
      return
    }
    setStatus('loading')
    setErrorMsg('')
    try {
      await postPublicInquiry(formData)
      setStatus('success')
      setFormData({
        name: '',
        contactNumber: '',
        email: '',
        preferredLoanType: '',
        estimatedLoanAmount: '',
      })
    } catch (err) {
      setStatus('error')
      setErrorMsg(err?.message || 'Unable to send your inquiry. Please try again.')
    }
  }


  useEffect(() => {
    const ctx = gsap.context(() => {
      const cols = cardRef.current?.querySelectorAll('.contact-col')
      if (cols?.length) {
        gsap.set(cols, { y: 60, opacity: 0 })
        gsap.to(cols, {
          y: 0,
          opacity: 1,
          duration: 0.7,
          stagger: 0.15,
          ease: 'power3.out',
          force3D: true,
        })
      }

      if (mapRef.current) {
        gsap.set(mapRef.current, { y: 80, opacity: 0 })
        gsap.to(mapRef.current, {
          y: 0,
          opacity: 1,
          duration: 0.7,
          ease: 'power3.out',
          force3D: true,
          scrollTrigger: { trigger: mapRef.current, start: 'top 85%', once: true },
        })
      }
    })
    return () => ctx.revert()
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SubPageHeader />
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
        <div ref={cardRef} className="rounded-2xl border border-black/10 bg-white p-8 shadow-md sm:p-10 lg:grid lg:grid-cols-2 lg:gap-12">
          <div className="contact-col">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-600">Contact</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-black sm:text-3xl">
              Send us your inquiry
            </h1>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-black/70">
              Interested in a loan? Submit a quick inquiry and continue your full application in the Borrower Portal.
            </p>

            <div className="mt-8 space-y-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/60">Main office location</p>
                <p className="mt-1.5 text-sm leading-relaxed text-black/90">{mainOfficeAddress}</p>
                <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:underline">
                  Get directions
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/60">Main office Luzon</p>
                <p className="mt-1.5 text-sm text-black/90">1220 Pedro Gil Street, Paco, Manila</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="contact-col mt-10 lg:mt-0">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block sm:col-span-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/60">Name</span>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="First and last name"
                  required
                  className="mt-2 w-full rounded-lg border border-black/15 bg-white px-4 py-3 text-sm text-black outline-none transition placeholder:text-black/40 focus:border-red-600 focus:ring-2 focus:ring-red-600/20"
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/60">Contact number</span>
                <input
                  type="tel"
                  name="contactNumber"
                  value={formData.contactNumber}
                  onChange={handleChange}
                  placeholder="+63 9XX XXX XXXX"
                  required
                  className="mt-2 w-full rounded-lg border border-black/15 bg-white px-4 py-3 text-sm text-black outline-none transition placeholder:text-black/40 focus:border-red-600 focus:ring-2 focus:ring-red-600/20"
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/60">Email</span>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="name@company.com"
                  required
                  className="mt-2 w-full rounded-lg border border-black/15 bg-white px-4 py-3 text-sm text-black outline-none transition placeholder:text-black/40 focus:border-red-600 focus:ring-2 focus:ring-red-600/20"
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/60">Preferred loan type</span>
                <select
                  name="preferredLoanType"
                  value={formData.preferredLoanType}
                  onChange={handleChange}
                  required
                  className="mt-2 w-full rounded-lg border border-black/15 bg-white px-4 py-3 text-sm text-black outline-none transition placeholder:text-black/40 focus:border-red-600 focus:ring-2 focus:ring-red-600/20"
                >
                  <option value="">Select loan type</option>
                  <option value="Personal Loan">Personal Loan</option>
                  <option value="Business Loan">Business Loan</option>
                  <option value="Salary Loan">Salary Loan</option>
                  <option value="Travel Assistance Loan">Travel Assistance Loan</option>
                  <option value="SSS Pension Loan">SSS Pension Loan</option>
                  <option value="Real Estate Mortgage">Real Estate Mortgage</option>
                  <option value="Chattel Mortgage">Chattel Mortgage</option>
                </select>
              </label>
            </div>
            <label className="mt-5 block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/60">Estimated loan amount (PHP)</span>
              <input
                type="number"
                min="1000"
                name="estimatedLoanAmount"
                value={formData.estimatedLoanAmount}
                onChange={handleChange}
                placeholder="100000"
                required
                className="mt-2 w-full rounded-lg border border-black/15 bg-white px-4 py-3 text-sm text-black outline-none transition placeholder:text-black/40 focus:border-red-600 focus:ring-2 focus:ring-red-600/20"
              />
            </label>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="submit"
                disabled={status === 'loading'}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:scale-[1.01] hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              >
                {status === 'loading' ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Sending...
                  </>
                ) : (
                  'Submit enquiry'
                )}
              </button>
              <Link
                to="/borrower/login"
                className="inline-flex w-full items-center justify-center rounded-lg border border-black/15 px-6 py-3 text-sm font-semibold text-black transition hover:bg-black/5 sm:w-auto"
              >
                Login to Borrower Portal
              </Link>
            </div>

            {status === 'success' && (
              <p className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                Inquiry submitted. Continue your complete loan application in the Borrower Portal.
              </p>
            )}
            {status === 'error' && (
              <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {errorMsg}
              </p>
            )}
          </form>
        </div>

        <section ref={mapRef} className="mt-12">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-black/80">Main office location</h2>
          <div className="overflow-hidden rounded-lg border border-black/10 shadow-sm">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3959.36126486874!2d125.6124840553452!3d7.084051134957256!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x32f96da651e42635%3A0x5bd7a84c2784dcf!2sAmalgated%20Capital%2C%20Inc.!5e0!3m2!1sen!2sph!4v1771920193547!5m2!1sen!2sph"
              width="100%"
              height="450"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Amalgated Lending main office"
            />
          </div>
        </section>

        <p className="mt-8 text-center text-sm text-black/60">
          <Link to="/" className="text-red-600 hover:underline">← Back to home</Link>
        </p>
      </main>
      <Footer />
    </div>
  )
}
