import { useState } from 'react'
import { Link } from 'react-router-dom'
import PortalCard from '../../components/portal/PortalCard.jsx'
import { BorrowerPageHeader } from '../../components/portal/BorrowerPageHeader.jsx'

const faqs = [
  { q: 'How fast can I get funded?', a: 'Many applications move same-week after documents are verified. Complex cases may take longer.' },
  { q: 'Can I pay early without penalties?', a: 'Check your loan agreement — many products allow early payoff or extra principal payments.' },
  { q: 'How do I reset my password?', a: 'Use Forgot password on the sign-in screen, or update in Password & security in the portal.' },
  { q: 'Is my data encrypted?', a: 'Yes. TLS in transit and encrypted storage for sensitive documents and PII.' },
]

export default function BorrowerHelpCenterPage() {
  const [open, setOpen] = useState(0)

  return (
    <div className="space-y-8">
      <BorrowerPageHeader
        eyebrow="Help center"
        title="Answers, fast"
        description="Search-style FAQ below. For account-specific help, open a ticket or chat with us live."
        actions={
          <>
            <Link to="/borrower/chat" className="rounded-xl bg-gradient-brand px-4 py-2.5 text-sm font-semibold text-white shadow-brand-primary hover:brightness-105">
              Live chat
            </Link>
            <Link to="/borrower/tickets" className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-text hover:border-brand-primary/40 dark:border-gray-600 dark:bg-[#111827] dark:text-white">
              Tickets
            </Link>
          </>
        }
      />

      <PortalCard title="Frequently asked" padding={false}>
        <div className="divide-y divide-black/[0.06] dark:divide-white/10">
          {faqs.map((item, i) => {
            const isOpen = open === i
            return (
              <div key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-brand-background-alt/80 dark:hover:bg-white/5 sm:px-6"
                  aria-expanded={isOpen}
                >
                  <span className="font-semibold text-brand-text dark:text-white">{item.q}</span>
                  <span className="text-brand-primary">{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen ? <div className="border-t border-black/[0.04] px-5 pb-4 pt-0 text-sm leading-relaxed text-gray-600 dark:border-white/10 sm:px-6 dark:text-gray-400">{item.a}</div> : null}
              </div>
            )
          })}
        </div>
      </PortalCard>
    </div>
  )
}
