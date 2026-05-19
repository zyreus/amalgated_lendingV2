import { useEffect, useMemo, useState } from 'react'
import { laravelRequest } from '../utils/lendingLaravelApi.js'

const LOCALE = 'en'
const NEWS_KEY = 'landing.newsletter.news'
const ANNOUNCEMENTS_KEY = 'landing.newsletter.announcements'

/** Keeps the skeleton visible long enough to read smoothly (avoids sub‑100ms flashes). */
const MIN_LOADING_MS = 1400

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function NewsletterLoadingSkeleton() {
  const bar = 'animate-pulse rounded-md bg-brand-text/[0.08] dark:bg-white/[0.08]'
  return (
    <section
      id="newsletter"
      className="app-container landing-section-divided border-brand-secondary/25 bg-transparent"
      aria-busy="true"
      aria-label="Loading news and announcements"
    >
      <div className="app-container">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/75 shadow-[0_8px_32px_rgba(217,34,67,0.05)] backdrop-blur-[2px]">
          <div className="grid md:grid-cols-2 md:divide-x md:divide-brand-secondary/25">
            {['Announcements', 'News'].map((label) => (
              <div key={label} className="flex flex-col p-8 sm:p-10">
                <div className={`h-3 w-36 ${bar}`} />
                <div className="mt-6 flex min-h-0 flex-1 flex-col gap-5">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={`${label}-${i}`}
                      className="rounded-xl border border-brand-secondary/20 bg-white/60 p-4 dark:bg-white/[0.04]"
                    >
                      <div className={`h-4 w-[min(100%,14rem)] ${bar}`} />
                      <div className={`mt-3 h-3 w-full ${bar}`} />
                      <div className={`mt-2 h-3 w-[88%] ${bar}`} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-brand-text/55">Loading news and announcements…</p>
      </div>
    </section>
  )
}

function parseItems(body) {
  if (!body) return []
  try {
    const parsed = JSON.parse(body)
    if (Array.isArray(parsed)) return parsed.filter(Boolean)
  } catch {
    // ignore JSON parse errors and fallback to text split
  }
  return String(body)
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((text, i) => ({ id: `line-${i}`, title: text }))
}

function normalizeCard(item, idx) {
  if (typeof item === 'string') {
    return { id: `item-${idx}`, title: item, summary: '' }
  }
  return {
    id: String(item?.id || `item-${idx}`),
    title: String(item?.title || item?.headline || `Update ${idx + 1}`),
    summary: String(item?.summary || item?.description || ''),
    date: String(item?.date || item?.publishedAt || ''),
  }
}

async function fetchCmsSection(sectionKey) {
  const rel = `/public/cms?section_key=${encodeURIComponent(sectionKey)}&locale=${encodeURIComponent(LOCALE)}`
  const { res } = await laravelRequest(rel, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res || !res.ok) return null
  const json = await res.json().catch(() => ({}))
  const rows = json?.data?.data ?? json?.data
  const list = Array.isArray(rows) ? rows : rows ? [rows] : []
  return list.find((row) => row?.section_key === sectionKey) || list[0] || null
}

export default function NewsletterSection() {
  const [news, setNews] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const started = typeof performance !== 'undefined' ? performance.now() : Date.now()
      try {
        const [newsRow, annRow] = await Promise.all([
          fetchCmsSection(NEWS_KEY),
          fetchCmsSection(ANNOUNCEMENTS_KEY),
        ])
        if (!cancelled) {
          const newsItems = parseItems(newsRow?.body).map(normalizeCard).slice(0, 4)
          const annItems = parseItems(annRow?.body).map(normalizeCard).slice(0, 4)
          setNews(newsItems)
          setAnnouncements(annItems)
        }
      } catch {
        if (!cancelled) {
          setNews([])
          setAnnouncements([])
        }
      } finally {
        const elapsed =
          (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started
        const remaining = Math.max(0, MIN_LOADING_MS - elapsed)
        if (remaining > 0) await delay(remaining)
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const hasContent = useMemo(() => news.length > 0 || announcements.length > 0, [news, announcements])

  if (loading) {
    return <NewsletterLoadingSkeleton />
  }

  if (!hasContent) return null

  const renderCards = (items) =>
    items.map((item) => (
      <article
        key={item.id}
        className="rounded-xl border border-brand-secondary/25 bg-white/80 p-6 shadow-sm backdrop-blur-sm sm:p-8"
      >
        <p className="text-sm font-semibold text-brand-text">{item.title}</p>
        {item.summary ? <p className="mt-2 text-sm leading-relaxed text-brand-text/75">{item.summary}</p> : null}
        {item.date ? <p className="mt-3 text-xs uppercase tracking-[0.14em] text-brand-text/55">{item.date}</p> : null}
      </article>
    ))

  return (
    <section id="newsletter" className="app-container landing-section-divided border-brand-secondary/25 bg-transparent">
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/75 shadow-[0_8px_32px_rgba(217,34,67,0.05)] backdrop-blur-[2px]">
          <div className="grid md:grid-cols-2 md:items-stretch md:divide-x md:divide-brand-secondary/25">
            <div className="flex flex-col p-8 sm:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Announcements</p>
              <div className="mt-6 flex min-h-0 flex-1 flex-col gap-5">{renderCards(announcements)}</div>
            </div>
            <div className="flex flex-col p-8 sm:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">News</p>
              <div className="mt-6 flex min-h-0 flex-1 flex-col gap-5">{renderCards(news)}</div>
            </div>
          </div>
      </div>
    </section>
  )
}

