import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { LoadingButton, FormLoadingOverlay } from '../../components/loading'
import { borrowerApi } from '../api/client.js'
import {
  AlertBanner,
  Field,
  PRIORITY_STYLES,
  PrioritySelector,
  SupportStepSidebar,
  TicketCategorySelector,
  WizardFooter,
  slideVariants,
  textInputClass,
} from '../components/SupportUi.jsx'

const TICKET_STEPS = [
  { id: 1, title: 'Issue category', description: 'What type of support do you need?' },
  { id: 2, title: 'Priority & subject', description: 'How urgent is this and what is it about?' },
  { id: 3, title: 'Details & submit', description: 'Describe the issue and review before sending.' },
]

export default function BorrowerTicketsPage() {
  const [tickets, setTickets] = useState([])
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)
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

  const goToStep = (nextStep) => {
    setDirection(nextStep > step ? 1 : -1)
    setStep(nextStep)
    setError('')
  }

  const validateStep = () => {
    if (step === 2 && !subject.trim()) {
      setError('Please enter a subject for your ticket.')
      return false
    }
    if (step === 3 && !body.trim()) {
      setError('Please describe your issue before submitting.')
      return false
    }
    setError('')
    return true
  }

  const onNext = () => {
    if (!validateStep()) return
    if (step < 3) goToStep(step + 1)
  }

  const onSubmit = useCallback(
    async (e) => {
      e?.preventDefault?.()
      const s = subject.trim()
      const b = body.trim()
      if (!s || !b) {
        setError('Subject and details are required.')
        return
      }
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
        setCategory('Payment Concern')
        setPriority('Medium')
        setStep(1)
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-primary">Support</p>
          <h1 className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100 sm:text-2xl">Support tickets</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            Create a ticket for async follow-up. For urgent issues, use{' '}
            <Link to="/borrower/chat" className="font-medium text-brand-primary hover:underline">
              live chat
            </Link>{' '}
            — average first response under 10 minutes during business hours.
          </p>
        </div>
        <Link
          to="/borrower/chat"
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-brand-primary/40 hover:text-brand-primary dark:border-[#1F2937] dark:bg-[#111827] dark:text-gray-200"
        >
          Live chat
        </Link>
      </div>

      {notice ? <AlertBanner type="success">{notice}</AlertBanner> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl dark:border-[#1F2937] dark:bg-[#111827]"
        >
          <div className="grid lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)]">
            <SupportStepSidebar
              steps={TICKET_STEPS}
              step={step}
              title="New ticket"
              subtitle="Guided submission sent to CRM for admin follow-up."
              onStepClick={goToStep}
            />

            <FormLoadingOverlay submitting={submitting} label="Submitting…">
              <form onSubmit={onSubmit} className="flex min-h-[480px] flex-col">
                <div className="border-b border-gray-100 bg-gradient-to-r from-white to-gray-50/80 px-5 py-4 dark:border-[#1F2937] dark:from-[#111827] dark:to-[#0F172A]/30 sm:px-6">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-primary">
                    Step {step} of {TICKET_STEPS.length}
                  </p>
                  <h2 className="mt-0.5 text-base font-semibold text-gray-900 dark:text-gray-100">
                    {TICKET_STEPS[step - 1]?.title}
                  </h2>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {TICKET_STEPS[step - 1]?.description}
                  </p>
                </div>

                <div className="flex flex-1 flex-col overflow-hidden">
                  {error ? (
                    <div className="px-5 pt-4 sm:px-6">
                      <AlertBanner type="error">{error}</AlertBanner>
                    </div>
                  ) : null}

                  <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                      key={step}
                      custom={direction}
                      variants={slideVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                      className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6"
                    >
                      {step === 1 ? (
                        <TicketCategorySelector value={category} onChange={setCategory} disabled={submitting} />
                      ) : null}

                      {step === 2 ? (
                        <div className="mx-auto max-w-lg space-y-5">
                          <Field label="Priority" hint="How urgent is this issue?">
                            <PrioritySelector value={priority} onChange={setPriority} />
                          </Field>
                          <Field
                            label="Subject"
                            hint="Short summary — e.g. Payment receipt not showing"
                            required
                          >
                            <input
                              id="t-subject"
                              value={subject}
                              onChange={(e) => setSubject(e.target.value)}
                              maxLength={120}
                              placeholder="Brief description of your issue"
                              className={textInputClass()}
                            />
                          </Field>
                        </div>
                      ) : null}

                      {step === 3 ? (
                        <div className="mx-auto max-w-lg space-y-5">
                          <Field
                            label="Details"
                            hint="Include dates, amounts, or reference numbers if relevant"
                            required
                          >
                            <textarea
                              id="t-body"
                              value={body}
                              onChange={(e) => setBody(e.target.value)}
                              rows={6}
                              placeholder="What happened? The more detail you provide, the faster we can help."
                              className={textInputClass()}
                            />
                          </Field>

                          <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4 dark:border-[#1F2937] dark:bg-[#0F172A]/40">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Review</p>
                            <dl className="mt-3 space-y-2 text-sm">
                              <div className="flex justify-between gap-4">
                                <dt className="text-gray-500">Category</dt>
                                <dd className="font-medium text-gray-900 dark:text-gray-100">{category}</dd>
                              </div>
                              <div className="flex justify-between gap-4">
                                <dt className="text-gray-500">Priority</dt>
                                <dd>
                                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${PRIORITY_STYLES[priority]}`}>
                                    {priority}
                                  </span>
                                </dd>
                              </div>
                              <div className="flex justify-between gap-4">
                                <dt className="text-gray-500">Subject</dt>
                                <dd className="max-w-[60%] text-right font-medium text-gray-900 dark:text-gray-100">
                                  {subject.trim() || '—'}
                                </dd>
                              </div>
                            </dl>
                          </div>

                          <LoadingButton
                            type="submit"
                            loading={submitting}
                            loadingKey="send"
                            disabled={!subject.trim() || !body.trim()}
                            minWidth="100%"
                            className="w-full rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white transition hover:bg-brand-primary-hover sm:w-auto sm:px-8"
                          >
                            Submit ticket
                          </LoadingButton>
                        </div>
                      ) : null}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {step < 3 ? (
                  <WizardFooter
                    showBack={step > 1}
                    onBack={() => goToStep(step - 1)}
                    onNext={onNext}
                    nextLabel={step === 2 ? 'Continue to details' : 'Continue'}
                    nextDisabled={step === 2 && !subject.trim()}
                  />
                ) : (
                  <div className="mt-auto border-t border-gray-100 bg-gray-50/70 px-5 py-4 dark:border-[#1F2937] dark:bg-[#0F172A]/25 sm:px-6">
                    <button
                      type="button"
                      onClick={() => goToStep(2)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:border-gray-300 dark:border-[#1F2937] dark:bg-[#111827] dark:text-gray-200"
                    >
                      Back
                    </button>
                  </div>
                )}
              </form>
            </FormLoadingOverlay>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-3xl border border-gray-200 bg-white shadow-xl dark:border-[#1F2937] dark:bg-[#111827]"
        >
          <div className="border-b border-gray-100 px-5 py-4 dark:border-[#1F2937] sm:px-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Your tickets</h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {rows.length ? `${rows.length} total` : 'No tickets yet'}
            </p>
          </div>

          <div className="p-5 sm:p-6">
            {loading ? (
              <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Loading tickets…</p>
            ) : rows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center dark:border-[#374151]">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">No tickets yet</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Submit a ticket using the guided form — it will appear here.
                </p>
              </div>
            ) : (
              <ul className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                {rows.map((t) => (
                  <motion.li
                    key={t.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 dark:border-[#1F2937] dark:bg-[#0F172A]/40"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{t.subject}</p>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                          {t.ticketNumber} · {t.category}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-primary">
                          {t.status}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${PRIORITY_STYLES[t.priority] || PRIORITY_STYLES.Medium}`}
                        >
                          {t.priority}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t.when}</p>
                    <p className="mt-2 line-clamp-3 text-sm text-gray-600 dark:text-gray-300">{t.body}</p>
                    {t.latestReply ? (
                      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-sm text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-200">
                        <p className="text-[10px] font-semibold uppercase tracking-wide">
                          Latest reply{t.latestReply.admin_name ? ` · ${t.latestReply.admin_name}` : ''}
                        </p>
                        <p className="mt-1">{t.latestReply.message}</p>
                      </div>
                    ) : null}
                  </motion.li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
