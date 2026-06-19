import { useCallback, useEffect, useMemo, useState } from 'react'
import { LoadingButton, FormLoadingOverlay } from '../../components/loading'
import PortalCard from '../../components/portal/PortalCard.jsx'
import { BorrowerPageHeader } from '../../components/portal/BorrowerPageHeader.jsx'
import { borrowerApi } from '../api/client.js'

export default function BorrowerTicketsPage() {
  const [tickets, setTickets] = useState([])
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('Payment Concern')
  const [priority, setPriority] = useState('Medium')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadTickets = useCallback(async () => {
    try {
      const res = await borrowerApi('/borrower/tickets')
      setTickets(Array.isArray(res.data) ? res.data : [])
      setError('')
    } catch (err) {
      setError(err.message || 'Failed to load tickets.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTickets()
  }, [loadTickets])

  const onSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      const s = subject.trim()
      const b = body.trim()
      if (!s || !b) return
      setSubmitting(true)
      setError('')
      setNotice('')
      try {
        const res = await borrowerApi('/borrower/tickets', {
          method: 'POST',
          body: JSON.stringify({ subject: s, category, priority, body: b }),
        })
        if (res.ticket) {
          setTickets((prev) => [res.ticket, ...prev.filter((t) => Number(t.id) !== Number(res.ticket.id))])
        } else {
          await loadTickets()
        }
        setSubject('')
        setBody('')
        setNotice(res.message || 'Ticket submitted. Our team will follow up in CRM.')
      } catch (err) {
        setError(err.message || 'Failed to submit ticket.')
      } finally {
        setSubmitting(false)
      }
    },
    [subject, category, priority, body, loadTickets],
  )

  const rows = useMemo(
    () =>
      tickets.map((t) => ({
        ...t,
        when: new Date(t.created_at || t.createdAt).toLocaleString(),
        ticketNumber: t.ticket_number || `TKT-${String(t.id).padStart(5, '0')}`,
        category: t.category || 'Other',
        priority: t.priority || 'Medium',
        latestReply: Array.isArray(t.messages)
          ? [...t.messages].reverse().find((m) => m.sender_type === 'admin' && m.message)
          : null,
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
        <PortalCard title="New ticket" subtitle="Sent to CRM & Chat for admin follow-up.">
          <FormLoadingOverlay submitting={submitting} label="Sending...">
          <form onSubmit={onSubmit} className="space-y-4">
            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                {notice}
              </p>
            ) : null}
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="t-category" className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Category
                </label>
                <select
                  id="t-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/15 dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
                >
                  {['Payment Concern', 'Loan Application', 'Verification Issue', 'Technical Problem', 'Account Recovery', 'Billing Concern', 'Document Upload', 'Other'].map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="t-priority" className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Priority
                </label>
                <select
                  id="t-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/15 dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
                >
                  {['Low', 'Medium', 'High', 'Critical'].map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
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
            <LoadingButton
              type="submit"
              loading={submitting}
              loadingKey="send"
              disabled={!subject.trim() || !body.trim()}
              className="w-full rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white shadow-brand-primary transition hover:bg-brand-primary-hover sm:w-auto sm:px-8"
            >
              Submit ticket
            </LoadingButton>
          </form>
          </FormLoadingOverlay>
        </PortalCard>

        <PortalCard title="Your tickets" subtitle={rows.length ? `${rows.length} total` : 'No tickets yet'}>
          {loading ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading tickets...</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">When you submit a ticket, it will appear here.</p>
          ) : (
            <ul className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {rows.map((t) => (
                <li key={t.id} className="rounded-xl border border-black/[0.06] bg-brand-background-alt/50 p-4 dark:border-white/10 dark:bg-[#0F172A]/60">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-brand-text dark:text-white">{t.subject}</p>
                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {t.ticketNumber} · {t.category}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand-primary">{t.status}</span>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{t.priority}</span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t.when}</p>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{t.body}</p>
                  {t.latestReply ? (
                    <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100">
                      <p className="text-[11px] font-semibold uppercase tracking-wide">
                        Latest admin reply{t.latestReply.admin_name ? ` · ${t.latestReply.admin_name}` : ''}
                      </p>
                      <p className="mt-1">{t.latestReply.message}</p>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </PortalCard>
      </div>
    </div>
  )
}
