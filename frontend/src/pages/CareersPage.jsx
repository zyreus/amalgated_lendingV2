import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import SubPageHeader from '../components/SubPageHeader.jsx'
import Footer from '../components/Footer.jsx'
import SeoMeta from '../components/SeoMeta.jsx'
import { formatLaravelUnreachableError, laravelApiBases, normalizeLaravelApiBase } from '../utils/lendingLaravelApi.js'

async function fetchPublicJobs() {
  const rel = '/public/careers/jobs'
  let lastErr = null
  for (const base of laravelApiBases()) {
    const url =
      base === '' || base == null
        ? `/api/v1${rel}`
        : `${String(normalizeLaravelApiBase(base) || base).replace(/\/$/, '')}${rel}`
    try {
      const res = await axios.get(url, { validateStatus: () => true, timeout: 60000 })
      if (res.status >= 200 && res.status < 300 && res.data?.ok) return res.data.data || []
      lastErr = new Error(res.data?.message || `HTTP ${res.status}`)
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr || new Error(formatLaravelUnreachableError(null))
}

export default function CareersPage() {
  const [openings, setOpenings] = useState([])
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchPublicJobs()
        if (!cancelled) setOpenings(Array.isArray(data) ? data : [])
      } catch (e) {
        if (!cancelled) setLoadError(e.message || 'Could not load openings.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen bg-brand-background-alt">
      <SeoMeta
        title="Careers | Amalgated Lending"
        description="Join Amalgated Lending — careers in lending operations, credit risk, and customer experience in Davao and Mindanao."
        canonical="https://amalgatedlending.com/careers"
      />
      <SubPageHeader />
      <main className="app-container py-12 sm:py-16">
        <header className="max-w-3xl border-l-4 border-brand-primary pl-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Careers</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-brand-text sm:text-4xl">Build with a trusted lender</h1>
          <p className="mt-3 text-base leading-relaxed text-brand-text/75">
            We combine disciplined credit practices with modern tools so teams can focus on borrowers, not paperwork. Explore open roles
            and our hiring process below.
          </p>
        </header>

        <section className="mt-14 grid gap-10 lg:grid-cols-[1fr_320px]">
          <div>
            <h2 className="text-lg font-semibold text-brand-text">Open positions</h2>
            {loadError ? (
              <p className="mt-4 text-sm text-red-600">{loadError}</p>
            ) : null}
            <ul className="mt-4 space-y-4">
              {openings.length === 0 && !loadError ? (
                <li className="surface-card-light p-5 text-sm text-brand-text/70">
                  There are no published openings right now. Please check back soon or send a general inquiry to HR.
                </li>
              ) : (
                openings.map((job) => (
                  <li key={job.id || job.slug} className="surface-card-light p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-brand-text">{job.title}</h3>
                        <p className="mt-1 text-sm text-brand-text/60">
                          {[job.branch, job.department, job.employment_type?.replace(/_/g, ' ')].filter(Boolean).join(' · ')}
                          {job.application_deadline ? ` · Apply by ${job.application_deadline}` : ''}
                        </p>
                      </div>
                      <Link
                        to={`/careers/${job.slug}`}
                        className="shrink-0 rounded-full bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-brand-primary transition hover:bg-brand-primary-hover"
                      >
                        View &amp; apply
                      </Link>
                    </div>
                    {job.seo_description ? (
                      <p className="mt-3 text-sm leading-relaxed text-brand-text/75">{job.seo_description}</p>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
            <p className="mt-4 text-sm text-brand-text/60">
              Don&apos;t see a fit? Send your CV and cover letter to{' '}
              <a className="font-semibold text-brand-primary hover:underline" href="mailto:support@amalgatedlending.com">
                support@amalgatedlending.com
              </a>{' '}
              — we keep qualified profiles on file for future openings.
            </p>
          </div>

          <aside className="space-y-8">
            <div className="surface-card-light p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-text">Hiring process</h2>
              <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-brand-text/80">
                <li>Application &amp; screening</li>
                <li>Interview with hiring manager</li>
                <li>Skills or case assessment (role-dependent)</li>
                <li>Offer &amp; onboarding</li>
              </ol>
            </div>
            <div className="surface-card-light p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-text">Culture</h2>
              <p className="mt-3 text-sm leading-relaxed text-brand-text/75">
                Integrity, transparency, and respect for borrowers guide how we work. We invest in secure systems, clear policies, and
                continuous training so every team member can represent the brand with confidence.
              </p>
            </div>
            <div id="apply" className="scroll-mt-28">
              <Link
                to="/contact"
                className="block rounded-xl border border-black/10 bg-white px-4 py-3 text-center text-sm font-semibold text-brand-text transition hover:border-brand-primary/40 hover:bg-brand-primary/5"
              >
                Contact HR / general inquiries
              </Link>
            </div>
          </aside>
        </section>
      </main>
      <Footer />
    </div>
  )
}
