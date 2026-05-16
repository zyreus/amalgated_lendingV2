import { useCallback, useEffect, useMemo, useState } from 'react'
import PortalCard from '../../components/portal/PortalCard.jsx'
import { BorrowerPageHeader } from '../../components/portal/BorrowerPageHeader.jsx'

const STORAGE_KEY = 'al-borrower-tickets-v1'

function loadTickets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default function BorrowerTicketsPage() {
  const [tickets, setTickets] = useState(() => loadTickets())
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets))
    } catch {
      /* ignore */
    }
  }, [tickets])

  const onSubmit = useCallback(
    (e) => {
      e.preventDefault()
      const s = subject.trim()
      const b = body.trim()
      if (!s || !b) return
      const row = {
        id: `T-${Date.now()}`,
        subject: s,
        body: b,
        status: 'Open',
        createdAt: new Date().toISOString(),
      }
      setTickets((prev) => [row, ...prev])
      setSubject('')
      setBody('')
    },
    [subject, body],
  )

  const rows = useMemo(
    () =>
      tickets.map((t) => ({
        ...t,
        when: new Date(t.createdAt).toLocaleString(),
      })),
    [tickets],
  )

  return (
    <div className="space-y-8">
      <BorrowerPageHeader
        eyebrow="Support"
        title="Support tickets"
        description="Create a ticket for async follow-up. For urgent issues, use live chat — average first response under 10 minutes during business hours."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <PortalCard title="New ticket" subtitle="Stored locally in this browser (demo). Wire to Laravel in production.">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="t-subject" className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Subject
              </label>
              <input
                id="t-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none ring-brand-primary/0 transition focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/15 dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
                placeholder="e.g. Payment receipt not showing"
                maxLength={120}
              />
            </div>
            <div>
              <label htmlFor="t-body" className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Details
              </label>
              <textarea
                id="t-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                className="mt-1 w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/15 dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
                placeholder="What happened? Include dates and amounts if relevant."
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white shadow-brand-primary transition hover:bg-brand-primary-hover sm:w-auto sm:px-8"
            >
              Submit ticket
            </button>
          </form>
        </PortalCard>

        <PortalCard title="Your tickets" subtitle={rows.length ? `${rows.length} total` : 'No tickets yet'}>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">When you submit a ticket, it will appear here.</p>
          ) : (
            <ul className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {rows.map((t) => (
                <li key={t.id} className="rounded-xl border border-black/[0.06] bg-brand-background-alt/50 p-4 dark:border-white/10 dark:bg-[#0F172A]/60">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-brand-text dark:text-white">{t.subject}</p>
                    <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand-primary">{t.status}</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t.when}</p>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{t.body}</p>
                </li>
              ))}
            </ul>
          )}
        </PortalCard>
      </div>
    </div>
  )
}
