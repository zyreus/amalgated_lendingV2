import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axios from 'axios'
import SubPageHeader from '../components/SubPageHeader.jsx'
import Footer from '../components/Footer.jsx'
import SeoMeta from '../components/SeoMeta.jsx'
import { formatLaravelUnreachableError, laravelApiBases, normalizeLaravelApiBase } from '../utils/lendingLaravelApi.js'

async function getPublicJson(path) {
  const rel = path.startsWith('/') ? path : `/${path}`
  let lastErr = null
  for (const base of laravelApiBases()) {
    const url =
      base === '' || base == null
        ? `/api/v1${rel}`
        : `${String(normalizeLaravelApiBase(base) || base).replace(/\/$/, '')}${rel}`
    try {
      const res = await axios.get(url, { validateStatus: () => true, timeout: 60000 })
      if (res.status === 404) return null
      if (res.status >= 200 && res.status < 300) return res.data
      lastErr = new Error(res.data?.message || `HTTP ${res.status}`)
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr || new Error(formatLaravelUnreachableError(null))
}

async function postPublicMultipart(path, formData) {
  const rel = path.startsWith('/') ? path : `/${path}`
  let lastErr = null
  for (const base of laravelApiBases()) {
    const url =
      base === '' || base == null
        ? `/api/v1${rel}`
        : `${String(normalizeLaravelApiBase(base) || base).replace(/\/$/, '')}${rel}`
    try {
      const res = await axios.post(url, formData, {
        headers: { Accept: 'application/json' },
        validateStatus: () => true,
        timeout: 120000,
      })
      if (res.status >= 200 && res.status < 300) return res.data
      const msg = res.data?.message || res.data?.error
      const flat = res.data?.errors ? Object.values(res.data.errors).flat().join(' ') : ''
      lastErr = new Error(msg || flat || `HTTP ${res.status}`)
      lastErr.body = res.data
      if (res.status < 500) throw lastErr
    } catch (e) {
      if (e.message && e.body) throw e
      lastErr = e
    }
  }
  throw lastErr || new Error(formatLaravelUnreachableError(null))
}

export default function CareerJobDetailPage() {
  const { slug } = useParams()
  const [job, setJob] = useState(null)
  const [err, setErr] = useState(null)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    portfolio_url: '',
    cover_letter: '',
    resume: null,
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await getPublicJson(`/public/careers/jobs/${encodeURIComponent(slug)}`)
        if (!cancelled) {
          if (res?.ok && res.data) setJob(res.data)
          else setErr('Job not found.')
        }
      } catch (e) {
        if (!cancelled) setErr(e.message || 'Could not load job.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug])

  const onSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setErr(null)
    try {
      const fd = new FormData()
      fd.append('first_name', form.first_name.trim())
      fd.append('last_name', form.last_name.trim())
      fd.append('email', form.email.trim())
      if (form.phone.trim()) fd.append('phone', form.phone.trim())
      if (form.portfolio_url.trim()) fd.append('portfolio_url', form.portfolio_url.trim())
      if (form.cover_letter.trim()) fd.append('cover_letter', form.cover_letter.trim())
      if (!form.resume) {
        setErr('Please attach your resume (PDF, DOC, or DOCX).')
        setSubmitting(false)
        return
      }
      fd.append('resume', form.resume)
      await postPublicMultipart(`/public/careers/jobs/${encodeURIComponent(slug)}/apply`, fd)
      setDone(true)
    } catch (e) {
      setErr(e.message || 'Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const title = job?.seo_title || job?.title || 'Careers'
  const desc = job?.seo_description || job?.summary || ''
  const employmentTypeLd = (() => {
    const t = String(job?.employment_type || 'full_time').toLowerCase()
    if (t.includes('part')) return 'PART_TIME'
    if (t.includes('contract')) return 'CONTRACTOR'
    if (t.includes('intern')) return 'INTERN'
    return 'FULL_TIME'
  })()
  const jsonLd = job
    ? {
        '@context': 'https://schema.org',
        '@type': 'JobPosting',
        title: job.title,
        description: desc || `${job.title} at Amalgated Lending`,
        datePosted: job.published_at || undefined,
        employmentType: employmentTypeLd,
        hiringOrganization: {
          '@type': 'Organization',
          name: 'Amalgated Lending',
        },
      }
    : undefined

  return (
    <div className="min-h-screen bg-brand-background-alt">
      <SeoMeta
        title={`${title} | Careers`}
        description={desc || 'Job opportunity at Amalgated Lending.'}
        canonical={`https://amalgatedlending.com/careers/${encodeURIComponent(slug)}`}
        jsonLd={jsonLd}
      />
      <SubPageHeader />
      <main className="app-container py-12 sm:py-16">
        <Link to="/careers" className="text-sm font-semibold text-brand-primary hover:underline">
          ← All openings
        </Link>

        {err && !job ? (
          <p className="mt-6 text-sm text-red-600">{err}</p>
        ) : !job ? (
          <p className="mt-6 text-sm text-brand-text/70">Loading…</p>
        ) : (
          <article className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
            <div>
              <header className="border-l-4 border-brand-primary pl-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Open role</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-brand-text">{job.title}</h1>
                <p className="mt-2 text-sm text-brand-text/65">
                  {[job.department, job.branch, job.employment_type?.replace(/_/g, ' ')].filter(Boolean).join(' · ')}
                  {job.application_deadline ? ` · Apply by ${job.application_deadline}` : ''}
                </p>
              </header>

              {job.salary_min != null || job.salary_max != null ? (
                <p className="mt-4 text-sm font-medium text-brand-text">
                  Compensation:{' '}
                  {job.salary_currency || 'PHP'}{' '}
                  {job.salary_min != null ? Number(job.salary_min).toLocaleString() : '—'} —{' '}
                  {job.salary_max != null ? Number(job.salary_max).toLocaleString() : '—'}
                </p>
              ) : null}

              {job.qualifications ? (
                <section className="mt-8">
                  <h2 className="text-lg font-semibold text-brand-text">Qualifications</h2>
                  <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-brand-text/80">{job.qualifications}</div>
                </section>
              ) : null}
              {job.responsibilities ? (
                <section className="mt-8">
                  <h2 className="text-lg font-semibold text-brand-text">Responsibilities</h2>
                  <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-brand-text/80">{job.responsibilities}</div>
                </section>
              ) : null}
              {job.requirements ? (
                <section className="mt-8">
                  <h2 className="text-lg font-semibold text-brand-text">Requirements</h2>
                  <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-brand-text/80">{job.requirements}</div>
                </section>
              ) : null}
              {job.benefits ? (
                <section className="mt-8">
                  <h2 className="text-lg font-semibold text-brand-text">Benefits</h2>
                  <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-brand-text/80">{job.benefits}</div>
                </section>
              ) : null}
              {job.application_instructions ? (
                <section className="mt-8 rounded-xl border border-black/10 bg-white/60 p-4">
                  <h2 className="text-sm font-semibold text-brand-text">How to apply</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-brand-text/80">{job.application_instructions}</p>
                </section>
              ) : null}
            </div>

            <aside>
              <div className="surface-card-light sticky top-28 p-5 sm:p-6">
                <h2 className="text-lg font-semibold text-brand-text">Apply online</h2>
                {done ? (
                  <p className="mt-3 text-sm leading-relaxed text-brand-text/80">
                    Thank you — your application was received. If your profile matches our needs, our HR team will contact you.
                  </p>
                ) : (
                  <form className="mt-4 space-y-3" onSubmit={onSubmit}>
                    {err ? <p className="text-sm text-red-600">{err}</p> : null}
                    <label className="block text-xs font-medium text-brand-text/70">
                      First name
                      <input
                        required
                        className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
                        value={form.first_name}
                        onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                      />
                    </label>
                    <label className="block text-xs font-medium text-brand-text/70">
                      Last name
                      <input
                        required
                        className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
                        value={form.last_name}
                        onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                      />
                    </label>
                    <label className="block text-xs font-medium text-brand-text/70">
                      Email
                      <input
                        required
                        type="email"
                        className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                      />
                    </label>
                    <label className="block text-xs font-medium text-brand-text/70">
                      Phone
                      <input
                        className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      />
                    </label>
                    <label className="block text-xs font-medium text-brand-text/70">
                      Portfolio URL (optional)
                      <input
                        type="url"
                        className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
                        value={form.portfolio_url}
                        onChange={(e) => setForm({ ...form, portfolio_url: e.target.value })}
                      />
                    </label>
                    <label className="block text-xs font-medium text-brand-text/70">
                      Cover letter (optional)
                      <textarea
                        className="mt-1 min-h-[100px] w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
                        value={form.cover_letter}
                        onChange={(e) => setForm({ ...form, cover_letter: e.target.value })}
                      />
                    </label>
                    <label className="block text-xs font-medium text-brand-text/70">
                      Resume (PDF, DOC, DOCX — max 5MB)
                      <input
                        required
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        className="mt-1 w-full text-sm"
                        onChange={(e) => setForm({ ...form, resume: e.target.files?.[0] || null })}
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="mt-2 w-full rounded-full bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-brand-primary transition hover:bg-brand-primary-hover disabled:opacity-50"
                    >
                      {submitting ? 'Submitting…' : 'Submit application'}
                    </button>
                  </form>
                )}
              </div>
            </aside>
          </article>
        )}
      </main>
      <Footer />
    </div>
  )
}
